/**
 * Recipe (advanced tier) tests - real disk, no network.
 *
 * Recipes return the unified `{ok, created, skipped, nextSteps, data}`
 * envelope with project-root-relative POSIX paths, and route every write
 * through the safety layer. `install: false` keeps the suite offline.
 */
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");
const { recipeCommand, RECIPES } = require("../../lib/commands/recipe");

beforeEach(() => {
  fs.outputJsonSync(path.join(global.tempDir, "package.json"), {
    name: "recipe-demo",
    dependencies: { express: "^4.0.0" },
  });
});

function ctx(extra = {}) {
  return { root: global.tempDir, install: false, ...extra };
}

function assertParses(source) {
  expect(() => new vm.Script(source)).not.toThrow();
}

describe("recipe registry", () => {
  test("all four advanced recipes registered without dependency duplication", () => {
    expect(Object.keys(RECIPES).sort()).toEqual(["auth", "docker", "swagger", "test"]);
    for (const recipe of Object.values(RECIPES)) {
      expect(recipe.tier).toBe("advanced");
      expect(typeof recipe.desc).toBe("string");
      // Dependency needs live in lib/deps/manifest.js only.
      expect(recipe.deps).toBeUndefined();
    }
  });

  test("unknown recipe throws with the option list", async () => {
    await expect(recipeCommand("graphql-magic", ctx())).rejects.toThrow(/Pilihan:/);
  });
});

describe("auth recipe", () => {
  test("composes middleware + user module + validator + env keys", async () => {
    const result = await recipeCommand("auth", ctx({ arch: "modular", orm: "None" }));

    expect(result.ok).toBe(true);
    expect(result.created).toContain("app/shared/middlewares/auth.middleware.js");
    expect(result.created).toContain("app/modules/user/controllers/user.controller.js");
    expect(result.created).toContain("app/modules/user/services/user.service.js");
    expect(result.created).toContain("app/modules/user/routes/user.router.js");
    expect(result.created).toContain("app/shared/validators/user.validator.js");

    for (const entry of result.created) {
      expect(fs.existsSync(path.join(global.tempDir, entry))).toBe(true);
    }

    // Every generated JS file parses standalone.
    const validator = fs.readFileSync(
      path.join(global.tempDir, "app/shared/validators/user.validator.js"),
      "utf8"
    );
    assertParses(validator);
    expect(validator).toContain("registerSchema");
    expect(validator).toContain("loginSchema");

    const env = fs.readFileSync(path.join(global.tempDir, ".env.example"), "utf8");
    expect(env).toContain("# AUTH RECIPE");
    expect(env).toContain("JWT_SECRET=");
  });

  test("is idempotent - second run keeps the first files intact", async () => {
    await recipeCommand("auth", ctx({ arch: "modular", orm: "None" }));
    const mwFile = path.join(global.tempDir, "app/shared/middlewares/auth.middleware.js");
    const before = fs.readFileSync(mwFile, "utf8");

    const second = await recipeCommand("auth", ctx({ arch: "modular", orm: "None" }));

    expect(second.created).toEqual([]);
    expect(second.skipped).toContain("app/shared/middlewares/auth.middleware.js");
    expect(fs.readFileSync(mwFile, "utf8")).toBe(before);
  });
});

describe("swagger recipe", () => {
  test("writes the swagger config + mount-ready docs entry", async () => {
    const result = await recipeCommand("swagger", ctx());

    expect(result.created).toContain("app/shared/config/swagger.config.js");
    expect(result.created).toContain("app/docs/index.js");
    expect(result.data.mountPath).toBe("/api-docs");

    assertParses(fs.readFileSync(path.join(global.tempDir, "app/docs/index.js"), "utf8"));
    const config = fs.readFileSync(
      path.join(global.tempDir, "app/shared/config/swagger.config.js"),
      "utf8"
    );
    expect(config).toContain("mountSwagger");

    const env = fs.readFileSync(path.join(global.tempDir, ".env.example"), "utf8");
    expect(env).toContain("# API DOCS");
  });
});

describe("test recipe", () => {
  test("generates per-module test files + adds npm scripts", async () => {
    seedModule("billing");

    const before = JSON.parse(
      fs.readFileSync(path.join(global.tempDir, "package.json"), "utf8")
    );
    expect(before.scripts?.test).toBeUndefined();

    const result = await recipeCommand("test", ctx());

    expect(fs.existsSync(path.join(global.tempDir, "tests/setup.js"))).toBe(true);
    expect(
      fs.existsSync(path.join(global.tempDir, "tests/modules/billing.test.js"))
    ).toBe(true);
    expect(result.data.scriptsAdded).toContain("test");

    const pkg = JSON.parse(
      fs.readFileSync(path.join(global.tempDir, "package.json"), "utf8")
    );
    expect(pkg.scripts.test).toBe("jest");
  });
});

describe("docker recipe", () => {
  test("resolves the entrypoint and emits Dockerfile + .dockerignore", async () => {
    fs.outputFileSync(path.join(global.tempDir, "app/server.js"), "// entry\n");

    const first = await recipeCommand("docker", ctx());
    expect(first.created.sort()).toEqual([".dockerignore", "Dockerfile"]);
    expect(first.data.entrypoint).toBe("app/server.js");
    expect(fs.readFileSync(path.join(global.tempDir, "Dockerfile"), "utf8")).toContain(
      'CMD ["node", "app/server.js"]'
    );

    // Second run creates nothing new
    const second = await recipeCommand("docker", ctx());
    expect(second.created).toEqual([]);
  });

  test("throws when no application entrypoint exists", async () => {
    const emptyRoot = path.join(global.tempDir, "empty-root");
    fs.ensureDirSync(emptyRoot);

    await expect(recipeCommand("docker", { root: emptyRoot, install: false })).rejects.toThrow(
      /entrypoint/i
    );
    expect(fs.existsSync(path.join(emptyRoot, "Dockerfile"))).toBe(false);
  });
});

function seedModule(name) {
  const dir = path.join(global.tempDir, "app", "modules", name);
  fs.ensureDirSync(path.join(dir, "routes"));
  fs.outputFileSync(path.join(dir, "routes", `${name}.router.js`), "");
}
