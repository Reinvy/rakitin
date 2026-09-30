/**
 * lib/commands/doctor.js - `rakitin doctor`: health-check of the target
 * project with evidence a maintainer can act on.
 *
 * Checks never execute target code (a `vm.Script` compile pass is the
 * strongest verification used) and never call `process.exit()`; a failing
 * check only sets `process.exitCode` + `ok: false` on the envelope.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { builtinModules } = require("module");

const logger = require("../utils/logger");
const { detectProject } = require("../project/detector");
const { getPaths } = require("../constants");
const { KIND_DEPENDENCIES } = require("../deps/manifest");
const { isJsonMode } = require("./shared");
const { loadPluginReport } = require("./plugin-seam");

const STATUS_SYMBOL = { ok: "✅", warn: "⚠️ ", fail: "❌" };

/** Directories never worth scanning for dangling requires. */
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage"]);

/** `jest@^29` -> `jest`, `@scope/pkg@1` -> `@scope/pkg`. */
function dependencyNameOf(spec) {
  const raw = String(spec || "").trim();
  if (!raw) return "";
  if (raw.startsWith("@")) {
    const at = raw.indexOf("@", 1);
    return at === -1 ? raw : raw.slice(0, at);
  }
  const at = raw.indexOf("@");
  return at === -1 ? raw : raw.slice(0, at);
}

/** `@scope/pkg/sub` -> `@scope/pkg`, `pkg/sub` -> `pkg`. */
function packageNameOf(spec) {
  const raw = String(spec || "");
  if (raw.startsWith("@")) {
    const [scope, name] = raw.split("/");
    return name ? `${scope}/${name}` : scope;
  }
  return raw.split("/")[0];
}

function isRelativeSpec(spec) {
  return (
    spec.startsWith("./") ||
    spec.startsWith("../") ||
    spec === "." ||
    spec === ".." ||
    path.isAbsolute(spec)
  );
}

function isBuiltinSpec(spec) {
  if (spec.startsWith("node:")) return true;
  const base = spec.split("/")[0];
  return builtinModules.includes(spec) || builtinModules.includes(base);
}

/** Recursively collect `.js` files, tolerating permission errors & symlinks. */
function collectJsFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJsFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function extractRequires(source) {
  const specs = [];
  const pattern = /require\(\s*["']([^"']+)["']\s*\)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) specs.push(match[1]);
  return specs;
}

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function hasFileWithSuffix(dir, suffixes, depth = 4) {
  if (!dir) return false;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    if (entry.isSymbolicLink()) continue;
    if (entry.isFile() && suffixes.some((suffix) => entry.name.endsWith(suffix))) {
      return true;
    }
    if (entry.isDirectory() && depth > 0) {
      if (hasFileWithSuffix(path.join(dir, entry.name), suffixes, depth - 1)) return true;
    }
  }
  return false;
}

/** Features on disk -> the dependency kind their output requires. */
const FEATURE_KINDS = [
  {
    kind: "middleware:auth",
    describe: "middleware auth",
    present: (root, paths) =>
      fs.existsSync(path.join(paths.sharedPath, "middlewares", "auth.middleware.js")),
  },
  {
    kind: "validation:joi",
    describe: "validator Joi",
    present: (root, paths) => hasFileWithSuffix(path.join(paths.sharedPath, "validators"), [".js"]),
  },
  {
    kind: "docs:openapi-yaml",
    describe: "dokumentasi OpenAPI YAML",
    present: (root, paths) => hasFileWithSuffix(path.join(paths.basePath, "docs"), [".yaml", ".yml"]),
  },
  {
    kind: "graphql:core",
    describe: "GraphQL",
    present: (root) => fs.existsSync(path.join(root, "app", "graphql")),
  },
  {
    kind: "websocket:ws",
    describe: "WebSocket",
    present: (root) => fs.existsSync(path.join(root, "app", "ws")),
  },
  {
    kind: "test:dev",
    describe: "file test",
    present: (root) => hasFileWithSuffix(path.join(root, "tests"), [".test.js"]),
  },
  {
    kind: "module:prisma",
    describe: "skema Prisma",
    present: (root) => fs.existsSync(path.join(root, "prisma", "schema")),
  },
];

/**
 * @param {object} [context]
 * @returns {Promise<{ok: boolean, created: string[], skipped: string[], data: object, message: string, nextSteps: string[]}>}
 */
async function doctorCommand(context = {}) {
  const root = context.root || process.cwd();
  const project = detectProject(root);
  const paths = getPaths(root);
  const declared = Object.keys(project.dependencies);
  const checks = [];

  /* (e) package.json / express / app base ----------------------------- */
  checks.push({
    name: "package.json",
    status: project.isNpmProject ? "ok" : "fail",
    detail: project.isNpmProject
      ? `${project.packageName || "(tanpa nama)"} · engine ${
          project.nodeEngine || "tidak diset"
        }`
      : "Tidak ada package.json di direktori ini",
  });

  checks.push({
    name: "Express",
    status: project.hasExpress ? "ok" : "warn",
    detail: project.hasExpress
      ? `terpasang (${project.expressVersion})`
      : "Belum terpasang - jalankan `rakitin init --express` atau install express",
  });

  checks.push({
    name: "Struktur app/",
    status: project.structure.hasAppBase ? "ok" : "warn",
    detail: project.structure.hasAppBase
      ? "app/ ditemukan"
      : "app/ belum ada (dibuat saat generate pertama)",
  });

  /* (d) router marker state ------------------------------------------- */
  checks.push(routerCheck(project));

  /* module inventory --------------------------------------------------- */
  const total = project.structure.modularCount + project.structure.simpleCount;
  checks.push({
    name: "Modul",
    status: total === 0 ? "warn" : project.structure.mixedArchitectures ? "warn" : "ok",
    detail:
      total === 0
        ? "Belum ada modul - jalankan `rakitin add module <name>`"
        : `${project.structure.modularCount} modular · ${project.structure.simpleCount} simple${
            project.structure.mixedArchitectures ? " (arsitektur campuran)" : ""
          }`,
  });

  /* (a) dangling requires ---------------------------------------------- */
  for (const spec of danglingRequires(root, declared)) {
    checks.push({
      name: `require "${spec}"`,
      status: "warn",
      detail: `require "${spec}" belum terpasang`,
    });
  }

  /* (b) plugin load errors --------------------------------------------- */
  const pluginReport = loadPluginReport(root, context.configValues || context.config || {});
  if (!pluginReport.available) {
    checks.push({
      name: "plugins",
      status: "ok",
      detail: "modul plugin belum tersedia",
    });
  } else {
    for (const error of pluginReport.errors) {
      checks.push({
        name: "plugins",
        status: "warn",
        detail: `${error.entry}: ${error.message}`,
      });
    }
    if (!pluginReport.errors.length) {
      checks.push({
        name: "plugins",
        status: "ok",
        detail: `${pluginReport.plugins.length} plugin dimuat tanpa error`,
      });
    }
  }

  /* (c) missing dependencies implied by generated features -------------- */
  for (const feature of FEATURE_KINDS) {
    if (!featurePresent(feature, root, paths)) continue;

    const required = KIND_DEPENDENCIES[feature.kind] || [];
    const missing = required.filter((spec) => !declared.includes(dependencyNameOf(spec)));
    if (!missing.length) continue;

    checks.push({
      name: `dependency ${feature.kind}`,
      status: "warn",
      detail: `${feature.describe} butuh paket yang belum terpasang: ${missing
        .map(dependencyNameOf)
        .join(", ")}`,
    });
  }

  const summary = {
    ok: checks.filter((c) => c.status === "ok").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };
  const ok = summary.fail === 0;
  if (!ok) process.exitCode = 1;

  if (!isJsonMode()) {
    const lines = checks.map(
      (c) => `${STATUS_SYMBOL[c.status] || "ℹ️ "} ${c.name}: ${c.detail}`
    );
    logger.info(lines.join("\n"));
  }

  return {
    ok,
    created: [],
    skipped: [],
    message: `🩺 doctor: ${summary.ok} ok · ${summary.warn} warn · ${summary.fail} fail`,
    data: { checks, summary },
    nextSteps: checks
      .filter((c) => c.status !== "ok")
      .map((c) => `${c.name}: ${c.detail}`),
  };
}

/** `app/routes/index.js` existence + marker + parse state. */
function routerCheck(project) {
  const s = project.structure;
  if (!s.hasMainRouter) {
    return {
      name: "Router utama",
      status: "warn",
      detail: "app/routes/index.js belum ada - jalankan `rakitin integrate`",
    };
  }

  const source = readFileSafe(s.routerPath);
  if (source === null) {
    return {
      name: "Router utama",
      status: "fail",
      detail: `${s.routerPath} tidak dapat dibaca`,
    };
  }

  try {
    new vm.Script(source, { filename: s.routerPath });
  } catch (error) {
    return {
      name: "Router utama",
      status: "fail",
      detail: `app/routes/index.js gagal di-parse: ${error.message}`,
    };
  }

  return {
    name: "Router utama",
    status: s.routerHasMarkers ? "ok" : "warn",
    detail: s.routerHasMarkers
      ? "menggunakan marker rakitin (aman diregenerasi)"
      : "ada tapi tanpa marker - integrasi menyisipkan blok + backup .bak",
  };
}

/** Feature predicates must never abort doctor - swallow filesystem errors. */
function featurePresent(feature, root, paths) {
  try {
    return Boolean(feature.present(root, paths));
  } catch {
    return false;
  }
}

/** Distinct non-relative, non-builtin, undeclared `require()` targets. */
function danglingRequires(root, declared) {
  const appDir = path.join(root, "app");
  if (!fs.existsSync(appDir)) return [];

  const missing = new Set();
  for (const file of collectJsFiles(appDir)) {
    const source = readFileSafe(file);
    if (source === null) continue;
    for (const spec of extractRequires(source)) {
      if (isRelativeSpec(spec) || isBuiltinSpec(spec)) continue;
      if (declared.includes(packageNameOf(spec))) continue;
      missing.add(packageNameOf(spec));
    }
  }
  return [...missing].sort();
}

module.exports = { doctorCommand };
