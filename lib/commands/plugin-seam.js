/**
 * lib/commands/plugin-seam.js - Lazy bridge to the plugin host
 * (`lib/plugins`).
 *
 * The plugin layer is optional: `info`, `doctor` and `list` must keep working
 * (and report a clean "belum tersedia" status) when it is absent or
 * malformed. Nothing here throws and nothing loads at require-time.
 */

const logger = require("../utils/logger");

/** @returns {object|null} The plugin host module, or null when unavailable. */
function loadPluginHost() {
  try {
    return require("../plugins");
  } catch {
    return null;
  }
}

/** Context object accepted by the plugin host (`root` + resolved config). */
function pluginContext(root, config = {}) {
  return { root, configValues: config && typeof config === "object" ? config : {} };
}

function isAsync(value) {
  return Boolean(value) && typeof value.then === "function";
}

/**
 * Run the host's loader defensively.
 * @param {string} root Project root.
 * @param {object} [config] Resolved `.rakitinrc.json` values.
 * @returns {{available: boolean, plugins: object[], errors: Array<{entry: string, message: string}>}}
 */
function loadPluginReport(root, config = {}) {
  const host = loadPluginHost();
  if (!host || typeof host.loadPlugins !== "function") {
    return { available: false, plugins: [], errors: [] };
  }

  try {
    const result = host.loadPlugins({
      root,
      config: config && typeof config === "object" ? config : null,
      logger,
    });
    if (isAsync(result)) return { available: true, plugins: [], errors: [] };
    return {
      available: true,
      plugins: Array.isArray(result?.plugins) ? result.plugins : [],
      errors: Array.isArray(result?.errors)
        ? result.errors.map((error) => ({
            entry: error && error.entry ? String(error.entry) : "(plugin)",
            message:
              error && error.message ? String(error.message) : String(error),
          }))
        : [],
    };
  } catch (error) {
    return {
      available: true,
      plugins: [],
      errors: [{ entry: "(plugin host)", message: error.message }],
    };
  }
}

/** Convenience wrapper: just the `errors[]` of {@link loadPluginReport}. */
function pluginLoadErrors(root, config = {}) {
  return loadPluginReport(root, config).errors;
}

/**
 * Plugin-contributed generators, normalized to
 * `{ id, describe, plugin }` records.
 * @param {string} root
 * @param {object} [config]
 * @returns {Array<{id: string, describe: string, plugin: string|null}>}
 */
function pluginGenerators(root, config = {}) {
  const host = loadPluginHost();
  if (host && typeof host.getGenerators === "function") {
    try {
      const generators = host.getGenerators(pluginContext(root, config));
      if (generators && !isAsync(generators) && typeof generators === "object") {
        return Object.values(generators).map((generator) => ({
          id: String(generator?.id ?? ""),
          describe: generator?.describe ? String(generator.describe) : "",
          plugin: generator?.plugin ? String(generator.plugin) : null,
        }));
      }
      return [];
    } catch {
      /* fall through to the raw plugin modules */
    }
  }

  const records = [];
  for (const plugin of loadPluginReport(root, config).plugins) {
    const generators =
      plugin?.generators && typeof plugin.generators === "object" ? plugin.generators : {};
    for (const [id, generator] of Object.entries(generators)) {
      records.push({
        id,
        describe: generator?.describe ? String(generator.describe) : "",
        plugin: plugin?.name ? String(plugin.name) : null,
      });
    }
  }
  return records;
}

module.exports = {
  loadPluginHost,
  loadPluginReport,
  pluginLoadErrors,
  pluginGenerators,
};
