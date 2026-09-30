#!/usr/bin/env node
"use strict";

/**
 * test-real-project.js - Standalone E2E smoke suite for rakitin V3.
 *
 * Runs the real CLI binary (`bin/rakitin.js`) inside throwaway temp projects
 * under the OS temp dir. Nothing is ever written inside the repository, every
 * invocation passes `--no-install` (fully offline), and JSON output is parsed
 * against the `{ok,created,skipped,nextSteps}` envelope contract.
 *
 * Prints a per-scenario PASS/FAIL summary and exits non-zero on any failure.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const CLI = path.join(REPO_ROOT, "bin", "rakitin.js");

const ROUTES_START = "/* rakitin:routes:start */";
const ROUTES_END = "/* rakitin:routes:end */";
const PLAN_OPS = ["create", "overwrite", "mkdir", "install"];

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

const results = [];

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(`${message} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

/* ------------------------------------------------------------------ */
/* Fixtures & driver                                                   */
/* ------------------------------------------------------------------ */

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-e2e-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ name: "e2e-app", version: "1.0.0" }, null, 2)}\n`,
    "utf8"
  );
  return dir;
}

function run(dir, args, { json = false } = {}) {
  const env = { ...process.env };
  if (json) env.RAKITIN_JSON = "1";
  else delete env.RAKITIN_JSON;

  const finalArgs = [...args];
  if (!finalArgs.includes("--no-install")) finalArgs.push("--no-install");
  if (json && !finalArgs.includes("--json")) finalArgs.push("--json");

  const res = spawnSync(process.execPath, [CLI, ...finalArgs], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
  if (res.error) fail(`gagal menjalankan CLI: ${res.error.message}`);
  return res;
}

function runJson(dir, args) {
  const res = run(dir, [...args, "--json"], { json: true });
  assertEqual(res.status, 0, `exit code untuk: rakitan ${args.join(" ")}`);
  let envelope;
  try {
    envelope = JSON.parse(res.stdout);
  } catch (error) {
    fail(`stdout bukan JSON valid untuk "${args.join(" ")}": ${res.stdout}`);
  }
  assert(envelope.ok === true, `envelope.ok untuk "${args.join(" ")}"`);
  assert(Array.isArray(envelope.created), "envelope.created array");
  assert(Array.isArray(envelope.skipped), "envelope.skipped array");
  assert(Array.isArray(envelope.nextSteps), "envelope.nextSteps array");
  return envelope;
}

function runJsonError(dir, args) {
  const res = run(dir, [...args, "--json"], { json: true });
  assertEqual(res.status, 1, `exit code failure untuk: ${args.join(" ")}`);
  const envelope = JSON.parse(res.stdout);
  assertEqual(envelope.ok, false, "envelope.ok false");
  assert(typeof envelope.error === "string", "envelope.error string");
  return envelope;
}

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

function assertCreatedExist(dir, entries) {
  for (const entry of entries) {
    assert(typeof entry === "string", "created entry harus string");
    assert(!entry.startsWith("/"), `created entry relatif: ${entry}`);
    assert(fs.existsSync(path.join(dir, entry)), `created entry ada di disk: ${entry}`);
  }
}

function checkAllJs(dir) {
  const files = listFiles(dir).filter(
    (file) => file.endsWith(".js") && !file.includes("node_modules/")
  );
  assert(files.length > 0, "ada file .js yang dihasilkan");
  for (const file of files) {
    const res = spawnSync(process.execPath, ["--check", path.join(dir, file)], {
      encoding: "utf8",
    });
    assertEqual(res.status, 0, `node --check ${file}: ${res.stderr}`);
  }
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

const scenarios = [
  ["cli-version", "--cli-version prints the version", () => {
    const dir = makeProject();
    const res = run(dir, ["--cli-version"]);
    assertEqual(res.status, 0, "exit code");
    const expected = require(path.join(REPO_ROOT, "package.json")).version;
    assertEqual(res.stdout.trim(), expected, "versi");
  }],

  ["bare", "bare $0 prints hints", () => {
    const dir = makeProject();
    const res = run(dir, []);
    assertEqual(res.status, 0, "exit code");
    for (const hint of ["rakitin init", "rakitin add module", "rakitin integrate", "rakitin doctor"]) {
      assert(res.stdout.includes(hint), `stdout memuat hint: ${hint}`);
    }
  }],

  ["list-json", "list --json catalog >= 8", () => {
    const dir = makeProject();
    const envelope = runJson(dir, ["list"]);
    assert(envelope.data.catalog.length >= 8, "catalog >= 8 entri");
  }],

  ["info-json", "info --json summary", () => {
    const dir = makeProject();
    const envelope = runJson(dir, ["info"]);
    assertEqual(envelope.data.summary.packageName, "e2e-app", "packageName");
  }],

  ["doctor-json", "doctor --json checks", () => {
    const dir = makeProject();
    const envelope = runJson(dir, ["doctor"]);
    assert(Array.isArray(envelope.data.checks) && envelope.data.checks.length > 0, "checks non-empty");
    assert(envelope.data.summary, "summary ada");
  }],

  ["init", "init --orm none creates config + base router", () => {
    const dir = makeProject();
    const envelope = runJson(dir, ["init", "--orm", "none", "--yes"]);
    assertCreatedExist(dir, envelope.created);
    assert(envelope.created.includes(".rakitinrc.json"), "config dibuat");
    assert(envelope.created.includes("app/routes/index.js"), "base router dibuat");
    const config = JSON.parse(fs.readFileSync(path.join(dir, ".rakitinrc.json"), "utf8"));
    assertEqual(config.version, 3, "config version");
  }],

  ["add-module-modular", "add module modular", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    const envelope = runJson(dir, ["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    assertCreatedExist(dir, envelope.created);
    for (const file of [
      "app/modules/user/controllers/user.controller.js",
      "app/modules/user/services/user.service.js",
      "app/modules/user/routes/user.router.js",
    ]) {
      assert(envelope.created.includes(file), `created memuat ${file}`);
    }
  }],

  ["add-module-simple", "add module simple", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    const envelope = runJson(dir, ["add", "module", "product", "--arch", "simple", "--orm", "none", "--yes"]);
    assertCreatedExist(dir, envelope.created);
    assert(envelope.created.includes("app/modules/product/product.router.js"), "router simple dibuat");
  }],

  ["middleware-config", "add middleware + config", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    const mw = runJson(dir, ["add", "middleware", "auth"]);
    assert(mw.created.includes("app/shared/middlewares/auth.middleware.js"), "middleware auth dibuat");
    const cfg = runJson(dir, ["add", "config", "jwt"]);
    assert(cfg.created.includes("app/shared/config/jwt.config.js"), "config jwt dibuat");
    assert(fs.readFileSync(path.join(dir, ".env.example"), "utf8").includes("# JWT CONFIG"), "env marker");
  }],

  ["integrate", "integrate wires + is idempotent + keeps .bak", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    runJson(dir, ["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes", "--no-auto-integrate"]);
    runJson(dir, ["add", "module", "product", "--arch", "simple", "--orm", "none", "--yes", "--no-auto-integrate"]);

    runJson(dir, ["integrate"]);
    const routerPath = path.join(dir, "app/routes/index.js");
    const first = fs.readFileSync(routerPath, "utf8");
    assert(first.includes(ROUTES_START) && first.includes(ROUTES_END), "marker region ada");
    assert(first.includes("router.use('/user'"), "mount /user");
    assert(first.includes("router.use('/product'"), "mount /product");

    runJson(dir, ["integrate"]);
    const second = fs.readFileSync(routerPath, "utf8");
    const outside = (src) => {
      const s = src.indexOf(ROUTES_START);
      const e = src.indexOf(ROUTES_END);
      return s === -1 || e === -1 ? src : src.slice(0, s) + src.slice(e + ROUTES_END.length);
    };
    assertEqual(outside(second), outside(first), "byte di luar marker identik");

    const bak = `${routerPath}.bak`;
    assert(fs.existsSync(bak), ".bak dibuat");
    const bakBefore = fs.readFileSync(bak, "utf8");
    runJson(dir, ["integrate"]);
    assertEqual(fs.readFileSync(bak, "utf8"), bakBefore, ".bak tidak ditimpa run ketiga");
  }],

  ["node-check", "every emitted .js passes node --check", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    runJson(dir, ["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    runJson(dir, ["add", "module", "product", "--arch", "simple", "--orm", "none", "--yes"]);
    runJson(dir, ["add", "middleware", "auth"]);
    runJson(dir, ["add", "config", "jwt"]);
    checkAllJs(dir);
  }],

  ["dry-run", "--dry-run mutates nothing", () => {
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
      const envelope = runJson(dir, args);
      assert(Array.isArray(envelope.plan), `plan ada untuk ${args.join(" ")}`);
      for (const entry of envelope.plan) {
        assert(PLAN_OPS.includes(entry.op), `op dikenal: ${entry.op}`);
      }
    }
    assertEqual(JSON.stringify(listFiles(dir)), JSON.stringify(before), "tree tidak berubah");
    assert(!fs.existsSync(path.join(dir, "node_modules")), "node_modules tidak dibuat");
  }],

  ["sanitization", "traversal rejected, safe kebab accepted", () => {
    const dir = makeProject();
    runJson(dir, ["init", "--orm", "none", "--yes"]);
    const parent = path.dirname(dir);
    for (const bad of ["../evil", ".."]) {
      const envelope = runJsonError(dir, ["add", "module", bad, "--arch", "modular", "--orm", "none", "--yes"]);
      assert(/Nama module tidak valid/.test(envelope.error), "pesan error sanitasi");
    }
    assert(!fs.existsSync(path.join(parent, "evil")), "tidak menulis di luar project");
    for (const good of ["123abc", "class"]) {
      const envelope = runJson(dir, ["add", "module", good, "--arch", "modular", "--orm", "none", "--yes"]);
      assert(envelope.ok, `nama aman diterima: ${good}`);
      assert(fs.existsSync(path.join(dir, "app/modules", good)), `folder ${good} dibuat`);
    }
    checkAllJs(dir);
    assert(!fs.existsSync(path.join(parent, "app")), "tidak menulis app/ di luar project");
  }],

  ["recipe-docker", "recipe docker resolves entrypoint (positive + negative)", () => {
    const dir = makeProject();
    fs.mkdirSync(path.join(dir, "app"), { recursive: true });
    fs.writeFileSync(path.join(dir, "app", "server.js"), "// entry\n", "utf8");
    const envelope = runJson(dir, ["recipe", "docker"]);
    assert(envelope.created.includes("Dockerfile"), "Dockerfile dibuat");
    assert(
      fs.readFileSync(path.join(dir, "Dockerfile"), "utf8").includes('CMD ["node", "app/server.js"]'),
      "CMD entrypoint"
    );

    const empty = makeProject();
    const failed = runJsonError(empty, ["recipe", "docker"]);
    assert(/entrypoint/i.test(failed.error), "error entrypoint");
    assert(!fs.existsSync(path.join(empty, "Dockerfile")), "Dockerfile tidak ditulis saat gagal");
  }],
];

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

function runScenario([id, name, fn]) {
  const started = Date.now();
  try {
    fn();
    const ms = Date.now() - started;
    results.push({ id, name, ok: true, ms });
    console.log(`${COLORS.green}PASS${COLORS.reset} ${id.padEnd(22)} ${name} ${COLORS.dim}(${ms}ms)${COLORS.reset}`);
  } catch (error) {
    const ms = Date.now() - started;
    results.push({ id, name, ok: false, ms, error: error.message });
    console.log(`${COLORS.red}FAIL${COLORS.reset} ${id.padEnd(22)} ${name} ${COLORS.dim}(${ms}ms)${COLORS.reset}`);
    console.log(`     ${COLORS.red}${error.message}${COLORS.reset}`);
  }
}

function main() {
  console.log(`${COLORS.cyan}rakitin E2E smoke suite${COLORS.reset} ${COLORS.dim}(${CLI})${COLORS.reset}\n`);
  for (const scenario of scenarios) runScenario(scenario);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} skenario lulus`);
  if (failed > 0) {
    console.log(`${COLORS.red}${failed} skenario gagal${COLORS.reset}`);
    process.exit(1);
  }
  console.log(`${COLORS.green}semua skenario lulus${COLORS.reset}`);
}

main();
