/**
 * lib/generator/router/wiring.js - The single engine that turns a module
 * inventory into main-router wiring.
 *
 * Wiring shape (uniform for BOTH architectures):
 *   const <id> = require('<relative>');
 *   router.use('/<kebab>', <id>);
 *
 * It never emits a `.get/.post(handler)` reference to a controller member,
 * which is what made the previous simple-architecture wiring crash at boot
 * (`Route.post() requires a callback function`).
 */

const fs = require("fs");
const path = require("path");
const { getPaths } = require("../../constants");
const { normalizeModuleName, toIdentifier } = require("../../naming");
const { relativePosix } = require("../../utils");

const MODULAR = "modular";

/**
 * Absolute path of a module's router file.
 * @param {string} root
 * @param {string} kebab
 * @param {"modular"|"simple"} architecture
 * @returns {string}
 */
function routerFileFor(root, kebab, architecture) {
  const modulesPath = getPaths(root).modulesPath;
  return architecture === MODULAR
    ? path.join(modulesPath, kebab, "routes", `${kebab}.router.js`)
    : path.join(modulesPath, kebab, `${kebab}.router.js`);
}

/**
 * Require specifier as seen from `app/routes/index.js`.
 * @param {string} kebab
 * @param {"modular"|"simple"} architecture
 * @returns {string}
 */
function requirePathFor(kebab, architecture) {
  return architecture === MODULAR
    ? `../modules/${kebab}/routes/${kebab}.router.js`
    : `../modules/${kebab}/${kebab}.router.js`;
}

/**
 * @param {string} kebab
 * @returns {string} JS identifier for the imported router
 */
function routerIdFor(kebab) {
  return toIdentifier(`${kebab}-router`);
}

/**
 * Build wiring entries for a module inventory, dropping (and reporting)
 * every module whose router file does not exist - a dangling require must
 * never reach the generated router.
 *
 * @param {Array<{dirName?: string, name?: string, architecture: string|null}>} modules
 * @param {{root?: string}} [options]
 * @returns {{entries: object[], skipped: Array<{name: string, reason: string}>}}
 */
function buildWiringEntries(modules = [], options = {}) {
  const root = options.root || process.cwd();
  const entries = [];
  const skipped = [];

  for (const mod of modules) {
    const kebab = normalizeModuleName(mod.name || mod.dirName || "");
    if (!kebab) continue;

    if (!mod.architecture) {
      skipped.push({ name: kebab, reason: "arsitektur modul tidak dikenali" });
      continue;
    }

    const routerFile = routerFileFor(root, kebab, mod.architecture);
    if (!fs.existsSync(routerFile)) {
      skipped.push({
        name: kebab,
        reason: `file router tidak ditemukan: ${relativePosix(root, routerFile)}`,
      });
      continue;
    }

    entries.push({
      kebab,
      architecture: mod.architecture,
      id: routerIdFor(kebab),
      mountPath: `/${kebab}`,
      routerFile,
      relRequireFromRoutes: requirePathFor(kebab, mod.architecture),
    });
  }

  return { entries, skipped };
}

/**
 * Build middleware entries for names that actually exist on disk.
 * @param {string[]} names
 * @param {{root?: string}} [options]
 * @returns {{entries: Array<{id: string, name: string, relRequireFromRoutes: string}>, skipped: Array<{name: string, reason: string}>}}
 */
function buildMiddlewareEntries(names = [], options = {}) {
  const root = options.root || process.cwd();
  const sharedPath = getPaths(root).sharedPath;
  const entries = [];
  const skipped = [];

  for (const raw of names) {
    const name = normalizeModuleName(raw);
    if (!name) continue;
    const filePath = path.join(sharedPath, "middlewares", `${name}.middleware.js`);
    if (!fs.existsSync(filePath)) {
      skipped.push({
        name,
        reason: `middleware tidak ditemukan: ${relativePosix(root, filePath)}`,
      });
      continue;
    }
    entries.push({
      id: toIdentifier(`${name}-middleware`),
      name,
      relRequireFromRoutes: `../shared/middlewares/${name}.middleware.js`,
    });
  }

  return { entries, skipped };
}

/**
 * Render the marked-region body for `app/routes/index.js`.
 * @param {object[]} entries from buildWiringEntries
 * @param {Array<{id: string, relRequireFromRoutes: string}>} [middleware] from buildMiddlewareEntries
 * @returns {string}
 */
function renderRouteLines(entries = [], middleware = []) {
  if (!entries.length) return "";

  const middlewareIds = middleware.map((m) => m.id);
  const lines = [
    ...middleware.map((m) => `const ${m.id} = require('${m.relRequireFromRoutes}');`),
    ...entries.map((e) => `const ${e.id} = require('${e.relRequireFromRoutes}');`),
    "",
    ...entries.map(
      (e) => `router.use('${e.mountPath}', ${[e.id, ...middlewareIds].join(", ")});`
    ),
  ];
  return lines.join("\n");
}

module.exports = {
  routerFileFor,
  requirePathFor,
  routerIdFor,
  buildWiringEntries,
  buildMiddlewareEntries,
  renderRouteLines,
};
