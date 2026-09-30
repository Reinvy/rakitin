/**
 * lib/plugins/loader.js - Resolve + load plugin modules declared in the
 * project configuration (`plugins: ["./plugins/x.js", "some-plugin-pkg"]`).
 *
 * Loading is best-effort by design: a broken entry produces an `errors[]`
 * record, never an exception, so `doctor` / `plugin list` can surface it and
 * the rest of the command still runs.
 */

const path = require("path");
const logger = require("../utils/logger");
const { createRegistry, registerPlugin } = require("./registry");

/**
 * Normalize the config source into a list of plugin entries.
 * Accepts an array, a plain config object (`{ plugins: [...] }`) or a
 * `Config` instance (anything exposing `get("plugins")`).
 * @param {*} config
 * @returns {Array<*>}
 */
function extractEntries(config) {
  if (!config) return [];
  if (Array.isArray(config)) return config;
  if (Array.isArray(config.plugins)) return config.plugins;
  if (typeof config.get === "function") {
    const value = config.get("plugins");
    if (Array.isArray(value)) return value;
  }
  return [];
}

/**
 * Resolve a config entry to an absolute module path.
 * Relative/absolute entries resolve against the project root (NOT the
 * CLI's module directory); bare specifiers resolve via the project's
 * node_modules chain.
 * @param {string} entry
 * @param {string} root
 * @returns {string}
 */
function resolveEntry(entry, root) {
  if (entry.startsWith(".") || path.isAbsolute(entry)) {
    return require.resolve(path.resolve(root, entry));
  }
  return require.resolve(entry, { paths: [root] });
}

/** `require` failures carry a multi-line "Require stack" - keep line one. */
function firstLine(error) {
  return String(error && error.message ? error.message : error).split("\n")[0];
}

/**
 * Load every plugin declared in `config`.
 * @param {{root?: string, config?: *, logger?: object}} [options]
 * @returns {{plugins: object[], errors: object[], registry: object}}
 */
function loadPlugins({ root = process.cwd(), config = null, logger: log = logger } = {}) {
  const registry = createRegistry();
  const entries = extractEntries(config);

  for (const rawEntry of entries) {
    if (typeof rawEntry !== "string" || rawEntry.trim() === "") {
      registry.errors.push({
        entry: String(rawEntry),
        message: `Entri plugin tidak valid: ${JSON.stringify(rawEntry ?? null)}.`,
      });
      continue;
    }

    const entry = rawEntry.trim();
    let resolved;
    try {
      resolved = resolveEntry(entry, root);
    } catch (error) {
      registry.errors.push({
        entry,
        message: `Tidak bisa memuat plugin "${entry}": ${firstLine(error)}`,
      });
      continue;
    }

    let mod;
    try {
      mod = require(resolved);
    } catch (error) {
      registry.errors.push({
        entry,
        message: `Tidak bisa memuat plugin "${entry}": ${firstLine(error)}`,
      });
      continue;
    }

    const plugin = mod && mod.__esModule && mod.default ? mod.default : mod;
    registerPlugin(registry, plugin, entry, resolved);
  }

  if (log && typeof log.debug === "function") {
    log.debug(
      `Plugin: ${registry.plugins.length} dimuat, ${registry.errors.length} error.`
    );
  }

  return { plugins: registry.plugins, errors: registry.errors, registry };
}

module.exports = { loadPlugins, resolveEntry, extractEntries };
