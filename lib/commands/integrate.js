/**
 * lib/commands/integrate.js - `rakitin integrate`
 * Marker-based router wiring. Idempotent: bytes outside the marker region
 * are preserved exactly, and a `--dry-run` plans without touching disk.
 */

const fs = require("fs");
const path = require("path");
const { detectProject } = require("../project/detector");
const { getPaths } = require("../constants");
const {
  buildRoutesContent,
  writeFileIfNotExistsSafe,
  overwriteWithBackup,
  isDryRun,
} = require("../safety");
const { relativePosix } = require("../utils");
const {
  buildWiringEntries,
  buildMiddlewareEntries,
  renderRouteLines,
} = require("../generator/router/wiring");

/**
 * @param {{middleware?: string[]|string, root?: string}} [options]
 * @returns {Promise<object>} result envelope payload
 */
async function integrateCommand(options = {}) {
  const root = options.root || process.cwd();
  const detected = detectProject(root);
  const p = getPaths(root);
  const routerPath = path.join(p.appRoutesPath, "index.js");

  const middlewareList = resolveMiddlewareList(options.middleware);
  const middleware = buildMiddlewareEntries(middlewareList, { root });
  const wiring = buildWiringEntries(detected.structure.modules, { root });

  if (!wiring.entries.length) {
    return {
      ok: false,
      created: [],
      skipped: [],
      message:
        "Tidak ada modul valid untuk diintegrasikan. Buat dulu: rakitin add module <name>",
      data: { action: "noop", wired: [], middlewareApplied: [], skippedModules: wiring.skipped },
    };
  }

  const routeLines = renderRouteLines(wiring.entries, middleware.entries);
  const existing = fs.existsSync(routerPath) ? fs.readFileSync(routerPath, "utf8") : null;
  const { content, action } = buildRoutesContent(existing, routeLines);

  let actionName;
  const created = [];
  const skipped = [];

  if (existing === null) {
    writeFileIfNotExistsSafe(routerPath, content);
    created.push(relativePosix(root, routerPath));
    actionName = "created";
  } else {
    overwriteWithBackup(routerPath, content);
    actionName = existing.includes("rakitin:routes:start")
      ? "markers-regenerated"
      : action === "inject"
        ? "block-injected"
        : "appended";
  }

  for (const entry of [...wiring.skipped, ...middleware.skipped]) {
    skipped.push(`${entry.name} (${entry.reason})`);
  }

  return {
    ok: true,
    created,
    skipped,
    nextSteps: [
      isDryRun()
        ? "Jalankan ulang tanpa --dry-run untuk menulis perubahan."
        : "Pasang router ke express app: app.use('/api', require('./app/routes'));",
    ],
    data: {
      action: actionName,
      wired: wiring.entries.map((e) => e.kebab),
      middlewareApplied: middleware.entries.map((m) => m.name),
      skippedModules: wiring.skipped,
      dryRun: isDryRun(),
    },
  };
}

/**
 * Normalize `--middleware` (csv or repeated flag) into a name list.
 * @param {string|string[]|null|undefined} mw
 * @returns {string[]}
 */
function resolveMiddlewareList(mw) {
  if (!mw) return [];
  if (Array.isArray(mw)) return mw.map((s) => String(s).trim()).filter(Boolean);
  return String(mw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

module.exports = { integrateCommand, resolveMiddlewareList };
