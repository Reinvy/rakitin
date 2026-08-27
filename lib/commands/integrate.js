/**
 * lib/commands/integrate.js - `rakitin integrate`
 * Marker-based router wiring without prompts when flags allow.
 */

const fs = require("fs");
const path = require("path");
const { detectProject } = require("../project/detector");
const { getPaths } = require("../constants");
const { normalizeModuleName, toIdentifier } = require("../naming");
const {
  buildRoutesContent,
  writeFileIfNotExistsSafe,
  overwriteWithBackup,
} = require("../safety");

/**
 * @param {{auto?: boolean, arch?: string, middleware?: string[]|string}} options
 */
async function integrateCommand(options = {}) {
  const root = process.cwd();
  const detected = detectProject(root);
  const modules = detected.structure.modules.filter((m) => m.architecture);
  const p = getPaths(root);

  if (!modules.length) {
    return {
      ok: false,
      message:
        "Tidak ada modul valid untuk diintegrasikan. Buat dulu: rakitin add module <name>",
    };
  }

  // Middleware exists-check happens ONCE, not per module (no dup requires).
  const mwList = resolveMiddlewareList(options.middleware);
  const mwLines = [];
  const applied = [];
  for (const m of mwList) {
    const fileName = normalizeModuleName(m);
    const filePath = path.join(
      p.sharedPath,
      "middlewares",
      `${fileName}.middleware.js`
    );
    if (!fs.existsSync(filePath)) {
      // Only wire what actually exists - never emit dangling requires.
      continue;
    }
    const mwId = toIdentifier(`${m}-middleware`);
    mwLines.push(
      `const ${mwId} = require('../shared/middlewares/${fileName}.middleware');`,
      `router.use(${mwId});`
    );
    applied.push(fileName);
  }

  // Build route lines respecting EACH module's real architecture.
  const lines = [...mwLines];
  const wired = [];
  for (const mod of modules) {
    const kebab = normalizeModuleName(mod.name);
    if (mod.architecture === "modular") {
      const id = toIdentifier(`${mod.name}-router`);
      lines.push(
        `const ${id} = require('../modules/${kebab}/routes/${kebab}.router');`,
        `router.use('/${kebab}', ${id});`
      );
    } else {
      const id = toIdentifier(`${mod.name}-controller`);
      lines.push(
        `const ${id} = require('../modules/${kebab}/${kebab}.controller');`,
        `router.get('/${kebab}', ${id}.getAll);`,
        `router.post('/${kebab}', ${id}.create);`
      );
    }
    lines.push("");
    wired.push(kebab);
  }

  const routerPath = path.join(p.appRoutesPath, "index.js");
  const existing = fs.existsSync(routerPath)
    ? fs.readFileSync(routerPath, "utf8")
    : null;
  const { content, action } = buildRoutesContent(existing, lines.join("\n"));

  let writeSummary;
  if (existing == null) {
    writeFileIfNotExistsSafe(routerPath, content);
    writeSummary = "created";
  } else {
    overwriteWithBackup(routerPath, content);
    writeSummary = existing.includes("rakitin:routes:start")
      ? "markers-regenerated"
      : action === "inject"
        ? "block-injected"
        : "appended";
  }

  return {
    ok: true,
    action: writeSummary,
    wired,
    middlewareApplied: applied,
    nextSteps: [
      "Pasang router ke express app: app.use('/api', require('./app/routes'))",
    ],
  };
}

function resolveMiddlewareList(mw) {
  if (!mw) return [];
  return Array.isArray(mw) ? mw : String(mw).split(",").map((s) => s.trim()).filter(Boolean);
}

module.exports = { integrateCommand };
