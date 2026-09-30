/**
 * tests/regression/presets.test.js
 *
 * Presets must have OBSERVABLE effects (§2.9) and a `.rakitinrc.json` value
 * must win over the preset-derived default - historically the presets were
 * documented but inert, and the library defaults masked explicit `false`.
 */

const fs = require("fs");
const path = require("path");
const { buildContext } = require("../../lib/commands/shared");
const { initCommand } = require("../../lib/commands/init");
const safety = require("../../lib/safety");

const CLI = path.resolve(__dirname, "../../bin/rakitin.js");

function write(name, content) {
  const file = path.join(global.tempDir, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

beforeEach(() => {
  safety.resetPlan();
  for (const entry of fs.readdirSync(global.tempDir)) {
    fs.rmSync(path.join(global.tempDir, entry), { recursive: true, force: true });
  }
});

describe("context preset inference", () => {
  test("a bare project is the basic tier (no ORM, no validation layer, no tests)", () => {
    write("package.json", JSON.stringify({ name: "t", version: "1.0.0" }));
    const context = buildContext({});
    expect(context.preset).toBe("basic");
    expect(context.orm).toBe("none");
    expect(context.generateValidationLayer).toBe(false);
    expect(context.generateTestFiles).toBe(false);
  });

  test("an installed ORM promotes the project to intermediate", () => {
    write(
      "package.json",
      JSON.stringify({ name: "t", version: "1.0.0", dependencies: { sequelize: "^6" } })
    );
    const context = buildContext({});
    expect(context.preset).toBe("intermediate");
    expect(context.orm).toBe("prisma");
    expect(context.generateValidationLayer).toBe(true);
    expect(context.generateTestFiles).toBe(false);
  });

  test("--orm none declares the basic tier instead of intermediate", () => {
    write("package.json", JSON.stringify({ name: "t", version: "1.0.0" }));
    const context = buildContext({ orm: "none" });
    expect(context.preset).toBe("basic");
    expect(context.orm).toBe("none");
  });

  test("--preset advanced turns test-file generation on", () => {
    write("package.json", JSON.stringify({ name: "t", version: "1.0.0" }));
    const context = buildContext({ preset: "advanced" });
    expect(context.preset).toBe("advanced");
    expect(context.generateValidationLayer).toBe(true);
    expect(context.generateTestFiles).toBe(true);
  });

  test("--preset basic wins over an installed ORM", () => {
    write(
      "package.json",
      JSON.stringify({ name: "t", version: "1.0.0", dependencies: { mongoose: "^9" } })
    );
    const context = buildContext({ preset: "basic" });
    expect(context.preset).toBe("basic");
    expect(context.orm).toBe("none");
    expect(context.generateValidationLayer).toBe(false);
  });

  test("an explicit rc value overrides the preset-derived default", () => {
    write(
      "package.json",
      JSON.stringify({ name: "t", version: "1.0.0" })
    );
    write(
      ".rakitinrc.json",
      JSON.stringify({
        version: 3,
        preset: "advanced",
        generateTestFiles: false,
        generateValidationLayer: false,
      })
    );
    const context = buildContext({});
    expect(context.preset).toBe("advanced");
    expect(context.generateTestFiles).toBe(false);
    expect(context.generateValidationLayer).toBe(false);
  });

  test("rc preset/orm/arch/packageManager are honored", () => {
    write("package.json", JSON.stringify({ name: "t", version: "1.0.0" }));
    write(
      ".rakitinrc.json",
      JSON.stringify({
        version: 3,
        preset: "intermediate",
        orm: "mongoose",
        arch: "simple",
        packageManager: "pnpm",
        autoIntegrateRouter: false,
      })
    );
    const context = buildContext({});
    expect(context.preset).toBe("intermediate");
    expect(context.orm).toBe("mongoose");
    expect(context.arch).toBe("simple");
    expect(context.pm).toBe("pnpm");
    expect(context.autoIntegrateRouter).toBe(false);
  });

  test("an unknown preset is rejected", () => {
    write("package.json", JSON.stringify({ name: "t", version: "1.0.0" }));
    expect(() => buildContext({ preset: "ultra" })).toThrow(/Preset tidak dikenal/);
  });
});

describe("init writes the resolved preset", () => {
  test("advanced preset persists test-file generation", async () => {
    write("package.json", JSON.stringify({ name: "t", version: "1.0.0" }));
    const result = await initCommand(
      buildContext({ preset: "advanced", orm: "none", yes: true, install: false })
    );
    const rc = JSON.parse(fs.readFileSync(path.join(global.tempDir, ".rakitinrc.json"), "utf8"));
    expect(rc.version).toBe(3);
    expect(rc.preset).toBe("advanced");
    expect(rc.generateValidationLayer).toBe(true);
    expect(rc.generateTestFiles).toBe(true);
    expect(result.ok).toBe(true);
  });

  test("basic preset keeps the database layer off", async () => {
    write("package.json", JSON.stringify({ name: "t", version: "1.0.0" }));
    await initCommand(buildContext({ yes: true, install: false }));
    const rc = JSON.parse(fs.readFileSync(path.join(global.tempDir, ".rakitinrc.json"), "utf8"));
    expect(rc.preset).toBe("basic");
    expect(rc.orm).toBe("none");
    expect(rc.generateValidationLayer).toBe(false);
    expect(rc.generateTestFiles).toBe(false);
  });
});

describe("CLI preset plumbing", () => {
  test("CLI module exposes the documented global flags", () => {
    const source = fs.readFileSync(CLI, "utf8");
    for (const flag of ["cwd", "yes", "overwrite", "dry-run", "json", "install", "preset", "arch", "orm", "pm", "cli-version"]) {
      expect(source).toContain(`"${flag}"`);
    }
  });
});
