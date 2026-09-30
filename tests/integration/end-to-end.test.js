/**
 * Integration: end-to-end flow through the REAL CLI binary.
 *
 * The old suite drove the removed interactive `index.js` main loop; this one
 * spawns `bin/rakitin.js` headlessly inside a temp project and validates both
 * the on-disk artifacts and the single-object JSON envelope contract.
 */

global.__RAKITIN_REAL_CHILD_PROCESS__ = true;

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CLI = path.join(REPO_ROOT, "bin", "rakitin.js");

const ROUTES_START = "/* rakitin:routes:start */";
const ROUTES_END = "/* rakitin:routes:end */";

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-int-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ name: "int-app", version: "1.0.0" }, null, 2)}\n`,
    "utf8"
  );
  return dir;
}

function runJson(dir, args) {
  const res = spawnSync(process.execPath, [CLI, ...args, "--json", "--no-install"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, RAKITIN_JSON: "1" },
  });
  expect(res.status).toBe(0);
  const envelope = JSON.parse(res.stdout); // throws on any extra stdout bytes
  expect(envelope.ok).toBe(true);
  expect(Array.isArray(envelope.created)).toBe(true);
  expect(Array.isArray(envelope.skipped)).toBe(true);
  expect(Array.isArray(envelope.nextSteps)).toBe(true);
  return envelope;
}

describe("CLI dispatch (bin/rakitin.js)", () => {
  test("init -> add module -> integrate yields a wired, marker-managed router", () => {
    const dir = makeProject();

    const init = runJson(dir, ["init", "--orm", "none", "--yes"]);
    expect(init.created).toContain(".rakitinrc.json");

    const add = runJson(dir, [
      "add",
      "module",
      "search-index",
      "--arch",
      "simple",
      "--orm",
      "none",
      "--yes",
      "--no-auto-integrate",
    ]);
    for (const entry of add.created) {
      expect(fs.existsSync(path.join(dir, entry))).toBe(true);
    }
    const moduleDir = path.join(dir, "app", "modules", "search-index");
    expect(fs.existsSync(path.join(moduleDir, "search-index.controller.js"))).toBe(true);
    expect(fs.existsSync(path.join(moduleDir, "search-index.router.js"))).toBe(true);

    const integrate = runJson(dir, ["integrate"]);
    expect(integrate.data.wired).toContain("search-index");

    const router = fs.readFileSync(path.join(dir, "app/routes/index.js"), "utf8");
    expect(router).toContain(ROUTES_START);
    expect(router).toContain(ROUTES_END);
    expect(router).toContain("router.use('/search-index'");

    // No dangling handler wiring: only a router require + use().
    expect(router).not.toMatch(/controller\.(create|update|remove)\b/);
  });

  test("every JSON command writes exactly one envelope object to stdout", () => {
    const dir = makeProject();
    const commands = [
      ["list"],
      ["info"],
      ["doctor"],
      ["init", "--orm", "none", "--yes"],
      ["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"],
      ["integrate"],
    ];

    for (const args of commands) {
      const res = spawnSync(process.execPath, [CLI, ...args, "--json", "--no-install"], {
        cwd: dir,
        encoding: "utf8",
        env: { ...process.env, RAKITIN_JSON: "1" },
      });
      // Exactly one JSON value: JSON.parse consumes the whole stdout.
      const envelope = JSON.parse(res.stdout);
      expect(typeof envelope.ok).toBe("boolean");
      // Diagnostics (if any) must never leak into stdout.
      expect(res.stdout.trim().startsWith("{")).toBe(true);
      expect(res.stdout.trim().endsWith("}")).toBe(true);
    }
  });
});
