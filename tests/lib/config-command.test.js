/**
 * Tests for lib/commands/config.js (`rakitin config`) - v3 contract.
 * Every write lands in `global.tempDir` (the suite never touches the repo).
 */
const fs = require("fs");
const path = require("path");
const { configCommand } = require("../../lib/commands/config");
const safety = require("../../lib/safety");

const SCHEMA_URL =
  "https://raw.githubusercontent.com/Reinvy/rakitin/main/rakitin.schema.json";

const argv = (action, key, value) => ({ action, key, value, _: ["config"] });
const context = (extra = {}) => ({ root: global.tempDir, json: true, dryRun: false, ...extra });

const rcPath = () => path.join(global.tempDir, ".rakitinrc.json");
const readRc = () => JSON.parse(fs.readFileSync(rcPath(), "utf8"));

beforeEach(() => {
  fs.writeFileSync(
    path.join(global.tempDir, "package.json"),
    JSON.stringify({ name: "config-demo", version: "1.0.0" }, null, 2) + "\n"
  );
  safety.resetPlan();
});

afterEach(() => {
  safety.resetPlan();
});

describe("config list", () => {
  test("reports the resolved config plus a project summary", async () => {
    fs.writeFileSync(rcPath(), JSON.stringify({ $schema: SCHEMA_URL, version: 3, orm: "prisma" }));

    const result = await configCommand(argv("list"), context());

    expect(result.ok).toBe(true);
    expect(result.created).toEqual([]);
    expect(result.data.config.orm).toBe("prisma");
    expect(result.data.config.version).toBe(3);
    expect(result.data.project.packageName).toBe("config-demo");
    expect(result.message).toBeUndefined(); // JSON mode keeps stdout to one object
  });

  test("renders a human table outside JSON mode", async () => {
    const result = await configCommand(argv("list"), context({ json: false }));

    expect(result.message).toContain("orm");
    expect(result.message).toContain("(belum diset)");
  });
});

describe("config get", () => {
  test("returns the resolved value of a known key", async () => {
    fs.writeFileSync(rcPath(), JSON.stringify({ version: 3, orm: "mongoose" }));

    const result = await configCommand(argv("get", "orm"), context());

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ key: "orm", value: "mongoose" });
  });

  test("falls back to process positionals", async () => {
    fs.writeFileSync(rcPath(), JSON.stringify({ version: 3, orm: "typeorm" }));

    const result = await configCommand({ _: ["config", "get", "orm"] }, context());

    expect(result.data.value).toBe("typeorm");
  });

  test("rejects unknown keys", async () => {
    await expect(configCommand(argv("get", "nope"), context())).rejects.toThrow(
      /Kunci config tidak dikenal: "nope"\. Pilihan: version, preset, arch, orm, packageManager/
    );
  });

  test("rejects known-but-unset keys", async () => {
    await expect(configCommand(argv("get", "preset"), context())).rejects.toThrow(
      /belum diset/
    );
  });
});

describe("config set", () => {
  test("creates .rakitinrc.json seeded with $schema and version 3", async () => {
    const result = await configCommand(argv("set", "orm", "prisma"), context());

    expect(result.ok).toBe(true);
    expect(result.created).toEqual([".rakitinrc.json"]);
    expect(result.skipped).toEqual([]);
    expect(readRc()).toEqual({ $schema: SCHEMA_URL, version: 3, orm: "prisma" });
  });

  test("updates the existing file and preserves unrelated keys", async () => {
    fs.writeFileSync(
      rcPath(),
      JSON.stringify({ $schema: SCHEMA_URL, version: 3, orm: "prisma", defaultArchitecture: "simple" })
    );

    const result = await configCommand(argv("set", "orm", "sequelize"), context());

    expect(result.created).toEqual([".rakitinrc.json"]);
    expect(readRc().orm).toBe("sequelize");
    expect(readRc().defaultArchitecture).toBe("simple");
  });

  test("reports an unchanged file in skipped (no backup)", async () => {
    fs.writeFileSync(rcPath(), JSON.stringify({ $schema: SCHEMA_URL, version: 3, orm: "prisma" }));

    const result = await configCommand(argv("set", "orm", "prisma"), context());

    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([".rakitinrc.json"]);
    expect(fs.existsSync(`${rcPath()}.bak`)).toBe(false);
  });

  test("writes a backup when overwriting", async () => {
    fs.writeFileSync(rcPath(), JSON.stringify({ $schema: SCHEMA_URL, version: 3, orm: "prisma" }));

    await configCommand(argv("set", "orm", "mongoose"), context());

    expect(JSON.parse(fs.readFileSync(`${rcPath()}.bak`, "utf8")).orm).toBe("prisma");
  });

  test("is a no-op under --dry-run", async () => {
    safety.beginPlan();
    const result = await configCommand(argv("set", "orm", "prisma"), context({ dryRun: true }));

    expect(fs.existsSync(rcPath())).toBe(false);
    expect(result.plan).toEqual([
      { op: "create", path: rcPath() },
    ]);
    expect(result.created).toEqual([".rakitinrc.json"]);
  });

  test("coerces booleans and plugin lists", async () => {
    await configCommand(argv("set", "generateTestFiles", "true"), context());
    await configCommand(argv("set", "plugins", '["rakitin-plugin-a","./plugins/x.js"]'), context());
    await configCommand(argv("set", "preset", "Advanced"), context());

    const rc = readRc();
    expect(rc.generateTestFiles).toBe(true);
    expect(rc.plugins).toEqual(["rakitin-plugin-a", "./plugins/x.js"]);
    expect(rc.preset).toBe("advanced");
  });

  test("accepts a comma separated plugin list", async () => {
    await configCommand(argv("set", "plugins", "a,b"), context());
    expect(readRc().plugins).toEqual(["a", "b"]);
  });

  test.each([
    ["nope", "1", /Kunci config tidak dikenal: "nope"/],
    ["version", "2", /Nilai version harus 3/],
    ["preset", "extreme", /Nilai preset tidak valid/],
    ["arch", "monolith", /Nilai arch tidak valid/],
    ["orm", "knex", /Nilai orm tidak valid/],
    ["packageManager", "cargo", /Nilai packageManager tidak valid/],
    ["autoIntegrateRouter", "maybe", /harus boolean/],
    ["plugins", "[1,2]", /array string/],
  ])("rejects %s=%s", async (key, value, pattern) => {
    await expect(configCommand(argv("set", key, value), context())).rejects.toThrow(pattern);
  });

  test("requires key and value", async () => {
    await expect(configCommand(argv("set", "orm"), context())).rejects.toThrow(
      /Penggunaan: rakitin config set <key> <value>/
    );
  });
});

describe("config <unknown action>", () => {
  test("rejects unknown actions", async () => {
    await expect(configCommand(argv("wobble"), context())).rejects.toThrow(
      /Aksi config tidak dikenal: "wobble"\. Pilihan: list, get, set\./
    );
  });
});
