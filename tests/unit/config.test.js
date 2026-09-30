/**
 * Unit tests for lib/config/index.js (`Config`).
 *
 * Every fixture is written inside `global.tempDir`, which is also the
 * process.cwd() for this suite.
 */

const fs = require("fs");
const path = require("path");
const {
  Config,
  createConfig,
  DEFAULT_CONFIG,
  CONFIG_FILES,
  CONFIG_KEYS,
  PRESETS,
} = require("../../lib/config");

const CONFIG_KEYS_EXPECTED = [
  "version",
  "preset",
  "arch",
  "orm",
  "packageManager",
  "autoIntegrateRouter",
  "generateValidationLayer",
  "generateTestFiles",
  "plugins",
];

/** Fresh project dir inside the suite temp dir. */
function makeRoot(name) {
  const root = path.join(global.tempDir, name);
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function write(root, file, content) {
  fs.writeFileSync(path.join(root, file), content, "utf8");
}

describe("lib/config", () => {
  const savedEnv = {};

  beforeAll(() => {
    require("../../lib/utils/logger").setLevel("silent");
  });

  afterAll(() => {
    require("../../lib/utils/logger").setLevel("info");
  });

  beforeEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("RAKITIN_")) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    }
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("RAKITIN_")) delete process.env[key];
    }
    Object.assign(process.env, savedEnv);
    for (const key of Object.keys(savedEnv)) delete savedEnv[key];
  });

  describe("constants", () => {
    test("DEFAULT_CONFIG holds exactly the v3 keys", () => {
      expect(Object.keys(DEFAULT_CONFIG).sort()).toEqual([...CONFIG_KEYS_EXPECTED].sort());
      expect(DEFAULT_CONFIG).toEqual({
        version: 3,
        preset: null,
        arch: null,
        orm: null,
        packageManager: null,
        autoIntegrateRouter: true,
        generateValidationLayer: false,
        generateTestFiles: false,
        plugins: [],
      });
    });

    test("CONFIG_FILES lists the four candidates in priority order", () => {
      expect(CONFIG_FILES).toEqual([
        ".rakitinrc.json",
        ".rakitinrc",
        "rakitin.config.json",
        "rakitin.config.js",
      ]);
    });

    test("CONFIG_KEYS mirrors the schema allowlist", () => {
      expect(CONFIG_KEYS).toEqual(CONFIG_KEYS_EXPECTED);
    });

    test("PRESETS lists the three presets", () => {
      expect(PRESETS).toEqual(["basic", "intermediate", "advanced"]);
    });
  });

  describe("load", () => {
    test("reads .rakitinrc.json", () => {
      const root = makeRoot("rc-json");
      write(root, ".rakitinrc.json", JSON.stringify({ orm: "mongoose", arch: "simple" }));

      const config = new Config().load(root);

      expect(config.get("orm")).toBe("mongoose");
      expect(config.get("arch")).toBe("simple");
      expect(config.get("version")).toBe(3);
    });

    test("falls through to .rakitinrc when the earlier candidate is absent", () => {
      const root = makeRoot("rc-bare");
      write(root, ".rakitinrc", JSON.stringify({ arch: "modular" }));

      expect(new Config().load(root).get("arch")).toBe("modular");
    });

    test("falls through to rakitin.config.json when both rc files are absent", () => {
      const root = makeRoot("rc-config-json");
      write(root, "rakitin.config.json", JSON.stringify({ packageManager: "pnpm" }));

      expect(new Config().load(root).get("packageManager")).toBe("pnpm");
    });

    test("falls through to rakitin.config.js when every JSON candidate is absent", () => {
      const root = makeRoot("rc-config-js");
      write(root, "rakitin.config.js", 'module.exports = { preset: "advanced" };\n');

      expect(new Config().load(root).get("preset")).toBe("advanced");
    });

    test("stops at the first existing candidate", () => {
      const root = makeRoot("rc-priority");
      write(root, ".rakitinrc.json", JSON.stringify({ orm: "prisma" }));
      write(root, ".rakitinrc", JSON.stringify({ orm: "sequelize" }));
      write(root, "rakitin.config.json", JSON.stringify({ orm: "mongoose" }));

      expect(new Config().load(root).get("orm")).toBe("prisma");
    });

    test("rejects JSON with comments with an explicit message", () => {
      const root = makeRoot("rc-comments");
      write(root, ".rakitinrc.json", '{\n  // komentar\n  "orm": "prisma"\n}\n');

      expect(() => new Config().load(root)).toThrow(/Komentar tidak didukung/);
      expect(() => new Config().load(root)).toThrow(/bukan JSON yang valid/);
    });

    test("merges package.json#rakitin", () => {
      const root = makeRoot("rc-package-json");
      write(
        root,
        "package.json",
        JSON.stringify({ name: "t", version: "1.0.0", rakitin: { orm: "typeorm" } })
      );

      expect(new Config().load(root).get("orm")).toBe("typeorm");
    });

    test("merges package.json#rakitin keys verbatim (no allowlist here)", () => {
      const root = makeRoot("rc-package-json-unknown");
      write(root, "package.json", JSON.stringify({ name: "t", rakitin: { nope: 1 } }));

      const config = new Config().load(root);
      // `load` merges whatever the user declared; CONFIG_KEYS is enforced by
      // `config set` and rakitin.schema.json, not by the loader.
      expect(config.get("nope")).toBe(1);
      expect(config.get("version")).toBe(3);
    });

    test("applies environment overrides (RAKITIN_*)", () => {
      const root = makeRoot("rc-env");
      process.env.RAKITIN_ORM = "sequelize";
      process.env.RAKITIN_GENERATE_TEST_FILES = "true";
      process.env.RAKITIN_UNRELATED = "ignored";

      const config = new Config().load(root);

      expect(config.get("orm")).toBe("sequelize");
      expect(config.get("generateTestFiles")).toBe(true);
      expect(config.get("unrelated")).toBeUndefined();
    });

    test("is a no-op on a second call and returns the same instance", () => {
      const root = makeRoot("rc-twice");
      write(root, ".rakitinrc.json", JSON.stringify({ orm: "prisma" }));
      const config = new Config().load(root);

      expect(config.load(root)).toBe(config);
      expect(config.get("orm")).toBe("prisma");
    });

    test("reload() re-reads from disk", () => {
      const root = makeRoot("rc-reload");
      write(root, ".rakitinrc.json", JSON.stringify({ orm: "prisma" }));
      const config = new Config().load(root);
      expect(config.get("orm")).toBe("prisma");

      write(root, ".rakitinrc.json", JSON.stringify({ orm: "mongoose" }));
      config.reload(root);

      expect(config.get("orm")).toBe("mongoose");
    });
  });

  describe("accessors", () => {
    test("get supports dot-notation and defaults", () => {
      const config = createConfig({ database: { host: "localhost" } });

      expect(config.get("database.host")).toBe("localhost");
      expect(config.get("database.missing")).toBeUndefined();
      expect(config.get("database.missing", 5432)).toBe(5432);
      expect(config.get("nothing.at.all", "fallback")).toBe("fallback");
    });

    test("set is chainable and creates intermediate objects", () => {
      const config = new Config();

      expect(config.set("orm", "prisma")).toBe(config);
      config.set("database.host", "db.internal");

      expect(config.get("orm")).toBe("prisma");
      expect(config.get("database.host")).toBe("db.internal");
    });

    test("has reports presence for non-null values only", () => {
      const config = new Config();

      expect(config.has("orm")).toBe(false); // default null
      config.set("orm", "prisma");
      expect(config.has("orm")).toBe(true);
      expect(config.has("database")).toBe(false);
    });

    test("all()/toJSON() return a detached copy", () => {
      const config = createConfig({ orm: "prisma" });

      const snapshot = config.all();
      snapshot.orm = "mutated";

      expect(config.get("orm")).toBe("prisma");
      expect(config.toJSON()).toEqual(config.all());
    });

    test("validate() reports type, required and enum violations", () => {
      const config = createConfig({ orm: "prisma", preset: "basic", version: 3 });

      const schema = {
        version: { required: true, type: "number" },
        orm: { type: "string", enum: ["prisma", "mongoose", "sequelize"] },
        preset: { required: true, enum: PRESETS },
        arch: { required: true, type: "string" },
      };

      const result = config.validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "Missing required config: arch",
        ])
      );
    });

    test("validate() passes for a well-formed config", () => {
      const config = createConfig({ arch: "modular", orm: "prisma", preset: "basic" });

      expect(
        config.validate({
          arch: { required: true, type: "string", enum: ["simple", "modular"] },
          orm: { required: true, type: "string" },
          preset: { required: true, type: "string", enum: PRESETS },
        })
      ).toEqual({ valid: true, errors: [] });
    });

    test("child(prefix) exposes a nested subtree", () => {
      const config = createConfig({ database: { host: "localhost" } });

      expect(config.child("database").get("host")).toBe("localhost");
    });
  });

  describe("reset", () => {
    test("restores DEFAULT_CONFIG", () => {
      const config = createConfig({ orm: "prisma" });
      config.reset();

      expect(config.all()).toEqual(DEFAULT_CONFIG);
    });
  });
});
