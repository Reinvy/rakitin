/**
 * tests/e2e/real-project.test.js - End-to-end suite that spawns the real CLI
 * binary inside throwaway temp projects.
 *
 * Hermetic rules honored here:
 *   - every fixture lives under `os.tmpdir()` (never inside the repo),
 *   - every CLI invocation passes `--no-install` (never touches the network),
 *   - JSON assertions parse the single stdout envelope and verify the
 *     `ok/created/skipped/nextSteps` contract,
 *   - generated `.js` is validated with `node --check` (never `require()`d).
 */

global.__RAKITIN_REAL_CHILD_PROCESS__ = true;

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CLI = path.join(REPO_ROOT, "bin/rakitin.js");
const PKG_VERSION = require(path.join(REPO_ROOT, "package.json")).version;

const ROUTES_START = "/* rakitin:routes:start */";
const ROUTES_END = "/* rakitin:routes:end */";
const PLAN_OPS = ["create", "overwrite", "mkdir", "install"];

/* ------------------------------------------------------------------ */
/* Fixtures & CLI driver                                               */
/* ------------------------------------------------------------------ */

/** Create an isolated temp project (never below the repo). */
function makeProject(seed = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-e2e-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ name: "e2e-app", version: "1.0.0", ...seed }, null, 2)}\n`,
    "utf8"
  );
  return dir;
}

/**
 * Spawn the CLI inside `dir`. `--no-install` is always appended.
 * @param {string} dir
 * @param {string[]} args
 * @param {{json?: boolean}} [options]
 */
function run(dir, args, options = {}) {
  const json = options.json !== false && args.includes("--json");
  const env = { ...process.env };
  if (json) env.RAKITIN_JSON = "1";
  else delete env.RAKITIN_JSON;

  const finalArgs = [...args];
  if (!finalArgs.includes("--no-install")) finalArgs.push("--no-install");
  if (json && !finalArgs.includes("--json")) finalArgs.push("--json");

  return spawnSync(process.execPath, [CLI, ...finalArgs], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
}

/** Run a JSON command and assert the envelope contract. */
function runJson(dir, args) {
  const res = run(dir, [...args, "--json"]);
  expect(res.status).toBe(0);
  let envelope;
  expect(() => {
    envelope = JSON.parse(res.stdout);
  }).not.toThrow();
  expect(envelope).toHaveProperty("ok");
  expect(Array.isArray(envelope.created)).toBe(true);
  expect(Array.isArray(envelope.skipped)).toBe(true);
  expect(Array.isArray(envelope.nextSteps)).toBe(true);
  return { res, envelope };
}

/** Run a JSON command expected to FAIL: `{ok:false,error}` + exit 1. */
function runJsonError(dir, args) {
  const res = run(dir, [...args, "--json"]);
  expect(res.status).toBe(1);
  const envelope = JSON.parse(res.stdout);
  expect(envelope.ok).toBe(false);
  expect(typeof envelope.error).toBe("string");
  return { res, envelope };
}

/** Every created/skipped entry must be a relative POSIX path on disk. */
function relativeEntriesExist(dir, entries) {
  for (const entry of entries) {
    expect(typeof entry).toBe("string");
    expect(entry.startsWith("/")).toBe(false);
    expect(entry.includes("\\")).toBe(false);
    expect(fs.existsSync(path.join(dir, entry))).toBe(true);
  }
}

/** Recursively list files (repo-relative-ish) below a directory. */
function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

/** `node --check` every emitted `.js` outside node_modules. */
function checkAllJs(dir) {
  const files = listFiles(dir).filter(
    (file) => file.endsWith(".js") && !file.includes("node_modules/")
  );
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const res = spawnSync(process.execPath, ["--check", path.join(dir, file)], {
      encoding: "utf8",
    });
    if (res.status !== 0) {
      throw new Error(`node --check gagal untuk ${file}:\n${res.stderr}`);
    }
  }
  return files;
}

/** Slice of the router source OUTSIDE the managed marker region. */
function outsideMarker(source) {
  const start = source.indexOf(ROUTES_START);
  const end = source.indexOf(ROUTES_END);
  if (start === -1 || end === -1) return source;
  return source.slice(0, start) + source.slice(end + ROUTES_END.length);
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

describe("rakitin V3 E2E (real CLI in temp projects)", () => {
  test("--cli-version prints the package version and exits 0", () => {
    const dir = makeProject();
    const res = run(dir, ["--cli-version"], { json: false });
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe(PKG_VERSION);
  });

  test("bare $0 prints a summary + numbered next steps, exit 0", () => {
    const dir = makeProject();
    const res = run(dir, [], { json: false });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("rakitin");
    expect(res.stdout).toContain("rakitin init");
    expect(res.stdout).toContain("rakitin add module");
    expect(res.stdout).toContain("rakitin integrate");
    expect(res.stdout).toContain("rakitin doctor");
  });

  test("list --json exposes a catalog of at least 8 generators", () => {
    const dir = makeProject();
    const { envelope } = runJson(dir, ["list"]);
    expect(envelope.ok).toBe(true);
    const catalog = envelope.data.catalog;
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBeGreaterThanOrEqual(8);
    expect(catalog.some((entry) => entry.command === "add module")).toBe(true);
  });

  test("info --json reports the detected project summary", () => {
    const dir = makeProject();
    const { envelope } = runJson(dir, ["info"]);
    expect(envelope.ok).toBe(true);
    expect(envelope.data.summary).toBeTruthy();
    expect(envelope.data.summary.packageName).toBe("e2e-app");
  });

  test("doctor --json emits checks + a summary", () => {
    const dir = makeProject();
    const res = run(dir, ["doctor", "--json"]);
    const envelope = JSON.parse(res.stdout);
    expect(Array.isArray(envelope.data.checks)).toBe(true);
    expect(envelope.data.checks.length).toBeGreaterThan(0);
    expect(envelope.data.summary).toBeTruthy();
    expect(typeof envelope.ok).toBe("boolean");
  });

  test("init --orm none --yes creates the config + base router", () => {
    const dir = makeProject();
    const { envelope } = runJson(dir, ["init", "--orm", "none", "--yes"]);
    expect(envelope.ok).toBe(true);
    relativeEntriesExist(dir, envelope.created);
    expect(envelope.created).toContain(".rakitinrc.json");
    expect(envelope.created).toContain("app/routes/index.js");

    const config = JSON.parse(
      fs.readFileSync(path.join(dir, ".rakitinrc.json"), "utf8")
    );
    expect(config.version).toBe(3);
    expect(config.orm).toBe("none");
  });

  test("add module (modular) writes the four-layer module", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    const { envelope } = runJson(dir, [
      "add",
      "module",
      "user",
      "--arch",
      "modular",
      "--orm",
      "none",
      "--yes",
    ]);
    expect(envelope.ok).toBe(true);
    relativeEntriesExist(dir, envelope.created);
    for (const file of [
      "app/modules/user/controllers/user.controller.js",
      "app/modules/user/services/user.service.js",
      "app/modules/user/routes/user.router.js",
      "app/modules/user/models/user.model.js",
    ]) {
      expect(envelope.created).toContain(file);
    }
  });

  test("add module (simple) writes the flat module", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    const { envelope } = runJson(dir, [
      "add",
      "module",
      "product",
      "--arch",
      "simple",
      "--orm",
      "none",
      "--yes",
    ]);
    expect(envelope.ok).toBe(true);
    relativeEntriesExist(dir, envelope.created);
    expect(envelope.created).toContain("app/modules/product/product.controller.js");
    expect(envelope.created).toContain("app/modules/product/product.router.js");
  });

  test("add middleware auth + add config jwt write to shared/", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);

    const mw = runJson(dir, ["add", "middleware", "auth"]);
    expect(mw.envelope.ok).toBe(true);
    expect(mw.envelope.created).toContain(
      "app/shared/middlewares/auth.middleware.js"
    );

    const cfg = runJson(dir, ["add", "config", "jwt"]);
    expect(cfg.envelope.ok).toBe(true);
    expect(cfg.envelope.created).toContain("app/shared/config/jwt.config.js");
    const env = fs.readFileSync(path.join(dir, ".env.example"), "utf8");
    expect(env).toContain("# JWT CONFIG");
  });

  test("integrate wires both modules, is idempotent, and preserves .bak", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    runJson(dir, [
      "add",
      "module",
      "user",
      "--arch",
      "modular",
      "--orm",
      "none",
      "--yes",
      "--no-auto-integrate",
    ]);
    runJson(dir, [
      "add",
      "module",
      "product",
      "--arch",
      "simple",
      "--orm",
      "none",
      "--yes",
      "--no-auto-integrate",
    ]);

    const routerPath = path.join(dir, "app/routes/index.js");
    const first = runJson(dir, ["integrate"]);
    expect(first.envelope.ok).toBe(true);

    const afterFirst = fs.readFileSync(routerPath, "utf8");
    expect(afterFirst).toContain(ROUTES_START);
    expect(afterFirst).toContain(ROUTES_END);
    expect(afterFirst).toContain("router.use('/user'");
    expect(afterFirst).toContain("router.use('/product'");

    const second = runJson(dir, ["integrate"]);
    expect(second.envelope.ok).toBe(true);
    const afterSecond = fs.readFileSync(routerPath, "utf8");
    expect(outsideMarker(afterSecond)).toBe(outsideMarker(afterFirst));

    const bakPath = `${routerPath}.bak`;
    expect(fs.existsSync(bakPath)).toBe(true);
    const bakAfterSecond = fs.readFileSync(bakPath, "utf8");

    runJson(dir, ["integrate"]);
    expect(fs.readFileSync(bakPath, "utf8")).toBe(bakAfterSecond);
    expect(fs.existsSync(`${routerPath}.bak.1`)).toBe(true);
  });

  test("every emitted .js passes node --check", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    runJson(dir, [
      "add",
      "module",
      "user",
      "--arch",
      "modular",
      "--orm",
      "none",
      "--yes",
    ]);
    runJson(dir, [
      "add",
      "module",
      "product",
      "--arch",
      "simple",
      "--orm",
      "none",
      "--yes",
    ]);
    runJson(dir, ["add", "middleware", "auth"]);
    runJson(dir, ["add", "config", "jwt"]);
    checkAllJs(dir);
  });

  test("--dry-run mutates nothing and plans only known ops", () => {
    const dir = makeProject();
    const before = listFiles(dir);

    const commands = [
      ["init", "--orm", "prisma", "--yes", "--dry-run"],
      ["add", "module", "ghost", "--arch", "modular", "--orm", "mongoose", "--yes", "--dry-run"],
      ["add", "middleware", "auth", "--dry-run"],
      ["recipe", "auth", "--dry-run"],
      ["recipe", "test", "--dry-run"],
    ];

    for (const args of commands) {
      const { res, envelope } = runJson(dir, args);
      expect(res.status).toBe(0);
      expect(envelope.plan).toBeDefined();
      for (const entry of envelope.plan) {
        expect(PLAN_OPS).toContain(entry.op);
        expect(typeof entry.path).toBe("string");
      }
    }

    expect(listFiles(dir)).toEqual(before);
    expect(fs.existsSync(path.join(dir, "node_modules"))).toBe(false);
  });

  test("sanitization: traversal names fail, safe kebab names are accepted", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    const parent = path.dirname(dir);

    for (const bad of ["../evil", ".."]) {
      const { envelope } = runJsonError(dir, [
        "add",
        "module",
        bad,
        "--arch",
        "modular",
        "--orm",
        "none",
        "--yes",
      ]);
      expect(envelope.error).toMatch(/Nama module tidak valid/);
    }
    expect(fs.existsSync(path.join(parent, "evil"))).toBe(false);

    for (const good of ["123abc", "class"]) {
      const { envelope } = runJson(dir, [
        "add",
        "module",
        good,
        "--arch",
        "modular",
        "--orm",
        "none",
        "--yes",
      ]);
      expect(envelope.ok).toBe(true);
      expect(fs.existsSync(path.join(dir, "app/modules", good))).toBe(true);
    }

    // Accepted names must yield valid identifiers, not just clean folders.
    checkAllJs(dir);

    // Nothing escaped the temp project.
    expect(fs.existsSync(path.join(parent, "app"))).toBe(false);
  });

  test("recipe docker resolves the entrypoint and fails without one", () => {
    const dir = makeProject();
    fs.writeFileSync(path.join(dir, "app.js"), "", "utf8");
    fs.mkdirSync(path.join(dir, "app"), { recursive: true });
    fs.writeFileSync(path.join(dir, "app", "server.js"), "// entry\n", "utf8");

    const { envelope } = runJson(dir, ["recipe", "docker"]);
    expect(envelope.ok).toBe(true);
    expect(envelope.created).toContain("Dockerfile");
    const dockerfile = fs.readFileSync(path.join(dir, "Dockerfile"), "utf8");
    expect(dockerfile).toContain('CMD ["node", "app/server.js"]');

    // Negative: no candidate entrypoint -> exit 1, nothing written.
    const empty = makeProject();
    const failed = runJsonError(empty, ["recipe", "docker"]);
    expect(failed.envelope.error).toMatch(/entrypoint/i);
    expect(fs.existsSync(path.join(empty, "Dockerfile"))).toBe(false);
  });
});
