/**
 * Regression guards for the P0 generator bugs (carried into v3).
 *
 * Each guard below protects a class of failure that once shipped broken:
 *   (a) hostile module names ("user-profile", "123abc", "class", "../evil")
 *       must either be rejected or produce VALID JavaScript identifiers,
 *   (b) marker-managed router edits must preserve every byte outside the
 *       marker region and stay idempotent,
 *   (c) raw user names must never be interpolated straight into generated
 *       identifiers.
 *
 * Generated code is compiled with `vm.Script`; it is NEVER `require()`d.
 */
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");

const {
  assertSafeName,
  toIdentifier,
  getModuleVariants,
} = require("../../lib/naming");
const safety = require("../../lib/safety");
const { simpleArch, modularArch } = require("../../lib/generator/module/arch/arch");
const {
  generateServiceCode,
} = require("../../lib/generator/shared/orm-service-generator");
const { routerIdFor } = require("../../lib/generator/router/wiring");

/** Compile-check helper: throws on syntax errors. */
function assertParses(source) {
  expect(() => new vm.Script(source)).not.toThrow();
}

/** Every `.js` a generator wrote must parse. */
function assertGeneratedFilesParse(relativePaths) {
  expect(relativePaths.length).toBeGreaterThan(0);
  for (const relative of relativePaths) {
    const full = path.join(global.tempDir, relative);
    expect(fs.existsSync(full)).toBe(true);
    assertParses(fs.readFileSync(full, "utf8"));
  }
}

describe("Bugfix regressions: generated code must be valid JavaScript", () => {
  describe("(a) hostile names produce valid identifiers", () => {
    test("assertSafeName rejects path traversal and separators", () => {
      for (const bad of ["../evil", "..", "a/b", "a\\b", ".hidden", "", "  "]) {
        expect(() => assertSafeName("module", bad)).toThrow(/Nama module/);
      }
    });

    test("assertSafeName normalizes accepted names to kebab-case", () => {
      expect(assertSafeName("module", "user-profile")).toBe("user-profile");
      expect(assertSafeName("module", "User Profile")).toBe("user-profile");
      expect(assertSafeName("module", "user_profile")).toBe("user-profile");
      expect(assertSafeName("module", "class")).toBe("class");
      expect(assertSafeName("module", "123abc")).toBe("123abc");
    });

    test("toIdentifier emits valid JS for hyphen/digit/reserved inputs", () => {
      const cases = {
        "user-profile": "userProfile",
        "user-profile-router": "userProfileRouter",
        "123abc": "_123abc",
        class: "class_",
        "my var!": "myVar",
      };
      for (const [raw, expected] of Object.entries(cases)) {
        const id = toIdentifier(raw);
        expect(id).toBe(expected);
        assertParses(`const ${id} = require('./x');`);
      }
    });

    test("getModuleVariants exposes a safe identifier", () => {
      expect(getModuleVariants("user-profile").identifier).toBe("userProfile");
      expect(getModuleVariants("123abc").identifier).toBe("_123abc");
    });

    test("router wiring derives identifiers from the name, never raw", () => {
      const id = routerIdFor("user-profile");
      expect(id).toBe("userProfileRouter");
      assertParses(`const ${id} = require('../modules/user-profile/user-profile.router.js');`);
    });
  });

  describe("(a) generated modules parse for hostile-but-legal names", () => {
    test("hyphenated modular module parses", async () => {
      const result = await modularArch("user-profile", "None");
      assertGeneratedFilesParse(result.created);
    });

    test("reserved-word simple module parses", async () => {
      const result = await simpleArch("class", "None");
      assertGeneratedFilesParse(result.created);
    });

    test("spaced/caps name reuses the safe kebab identifiers", async () => {
      const result = await simpleArch("My Module", "None");
      assertGeneratedFilesParse(result.created);

      const controller = fs.readFileSync(
        path.join(global.tempDir, "app/modules/my-module/my-module.controller.js"),
        "utf8"
      );
      // The raw name must not leak into a declaration/identifier position.
      expect(controller).not.toContain("const My Module");
      expect(controller).toContain('require("./my-module.service")');
    });
  });

  describe("(c) service generation never interpolates raw names", () => {
    test('generateServiceCode("None") is self-contained and parses', () => {
      const code = generateServiceCode("User", "None", "Simple");
      assertParses(code);
      expect(code).toContain("in-memory");
    });

    test("no-ORM works for modular architecture too", () => {
      const code = generateServiceCode("User Profile", "None", "Modular");
      assertParses(code);
    });

    test("Sequelize service imports the model via its PascalCase binding", () => {
      const code = generateServiceCode("User Profile", "Sequelize", "Modular");
      assertParses(code);
      expect(code).toContain('const UserProfile = require("../models/user-profile.model")');
      expect(code).not.toContain("const { userProfile }");
    });

    test("Mongoose service requires the kebab-case model file", () => {
      const code = generateServiceCode("User Profile", "Mongoose", "Modular");
      assertParses(code);
      expect(code).toContain("../models/user-profile.model");
    });

    test("none.orm.js exports a callable noneORM", () => {
      const { noneORM } = require("../../lib/generator/module/orm/none.orm");
      expect(typeof noneORM).toBe("function");
    });
  });

  describe("(b) marker-region byte preservation", () => {
    const ROUTE_LINES = "router.use('/user-profile', userProfileRouter);";

    test("a fresh router is created with the managed header", () => {
      const { content, action } = safety.buildRoutesContent(null, ROUTE_LINES);
      expect(action).toBe("create");
      expect(content.startsWith(safety.MAIN_ROUTER_HEADER)).toBe(true);
      expect(content).toContain(ROUTE_LINES);
      expect(content).toContain(safety.ROUTES_BLOCK_START);
      expect(content.trimEnd().endsWith("module.exports = router;")).toBe(true);
    });

    test("user code above the markers stays byte-identical", () => {
      const userCode = [
        "// MY PRECIOUS CUSTOM ROUTES",
        "router.get('/health', healthHandler);",
        "",
      ].join("\n");

      const first = safety.buildRoutesContent(null, ROUTE_LINES).content;
      const editedByUser = first.replace(
        safety.ROUTES_BLOCK_START,
        `${userCode}\n${safety.ROUTES_BLOCK_START}`
      );

      const secondPass = safety.buildRoutesContent(
        editedByUser,
        "router.use('/new-module', newModuleRouter);"
      );

      expect(secondPass.action).toBe("inject");
      expect(secondPass.content.match(/MY PRECIOUS CUSTOM ROUTES/g)).toHaveLength(1);
      expect(secondPass.content).toContain("router.get('/health'");
      expect(secondPass.content).toContain("/new-module");
      expect(secondPass.content).not.toContain("'/user-profile', userProfileRouter");
    });

    test("injection is idempotent - repeated passes never duplicate wiring", () => {
      let content = safety.buildRoutesContent(null, ROUTE_LINES).content;
      content = safety.buildRoutesContent(content, ROUTE_LINES).content;
      content = safety.buildRoutesContent(content, ROUTE_LINES).content;

      expect(content.match(/userProfileRouter/g)).toHaveLength(1);
      expect(content.match(/rakitin:routes:start/g)).toHaveLength(1);
      expect(content.match(/rakitin:routes:end/g)).toHaveLength(1);
    });
  });
});
