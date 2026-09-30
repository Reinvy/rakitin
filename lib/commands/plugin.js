/**
 * lib/commands/plugin.js - `rakitin plugin list|add|remove|info`.
 *
 * The config file (`.rakitinrc.json`) is the single source of truth for the
 * plugin list and every mutation goes through the safety layer
 * (`updateJsonFile`), so `--dry-run` plans instead of writing and an existing
 * file is always backed up first.
 *
 * Plugin loading errors are DATA, not failures: `list`/`info` report them in
 * `data.errors` and stay `ok: true` so a broken plugin never bricks the CLI.
 */

const path = require("path");
const logger = require("../utils/logger");
const safety = require("../safety");
const { Config } = require("../config");
const { loadPlugins, resetPlugins, resolveEntry } = require("../plugins");

const ACTIONS = ["list", "add", "remove", "info"];
const CONFIG_FILE = ".rakitinrc.json";

/**
 * Does a loaded plugin answer to `spec`? Accepts the plugin `name`, the raw
 * config entry, the resolved path, and its file basename (with/without ext).
 * @param {object} plugin
 * @param {string} spec
 * @returns {boolean}
 */
function matches(plugin, spec) {
  if (!spec) return false;
  if (plugin.name === spec || plugin.entry === spec || plugin.resolved === spec) {
    return true;
  }
  if (!plugin.resolved) return false;
  const base = path.basename(plugin.resolved);
  return base === spec || base.slice(0, base.length - path.extname(base).length) === spec;
}

/** Public shape of a loaded plugin (used by `list` and `info`). */
function describePlugin(plugin) {
  return {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    entry: plugin.entry,
    resolved: plugin.resolved,
    generators: [...plugin.generators],
    commands: [...plugin.commands],
    hooks: [...plugin.hooks],
  };
}

/**
 * Load plugins for the command's project root (never throws).
 *
 * The on-disk config is authoritative (this command mutates that very file,
 * so a stale `context.configValues` snapshot must not hide a same-process
 * `add`/`remove`); explicit context values are union-merged on top.
 */
function load(context) {
  const root = context?.root || process.cwd();
  let config;
  try {
    config = new Config().load(root).all();
  } catch (error) {
    // An unreadable/broken config is DATA (reported), never a crash.
    return {
      plugins: [],
      errors: [{ entry: CONFIG_FILE, message: error.message }],
      registry: null,
    };
  }

  try {
    const fromContext = context?.configValues || context?.config || null;
    const contextPlugins =
      fromContext && Array.isArray(fromContext.plugins) ? fromContext.plugins : [];
    const diskPlugins = Array.isArray(config.plugins) ? config.plugins : [];
    const plugins = [...new Set([...diskPlugins, ...contextPlugins])];
    return loadPlugins({ root, config: { ...config, plugins }, logger });
  } catch (error) {
    return { plugins: [], errors: [{ entry: null, message: error.message }], registry: null };
  }
}

function requireSpec(action, spec) {
  if (typeof spec === "string" && spec.trim() !== "") return spec.trim();
  const hint =
    action === "add"
      ? "rakitin plugin add ./plugins/my-plugin.js"
      : `rakitin plugin ${action} <nama-plugin>`;
  throw new Error(`Argumen plugin wajib ada. Contoh: ${hint}`);
}

/**
 * @param {"list"|"add"|"remove"|"info"} action
 * @param {string} [spec]
 * @param {object} [context]
 * @returns {Promise<object>} Result envelope payload.
 */
async function pluginCommand(action, spec, context = {}) {
  const normalized = typeof action === "string" ? action.trim() : "";
  if (!ACTIONS.includes(normalized)) {
    throw new Error(
      `Aksi plugin tidak dikenal: "${action ?? ""}". Pilihan: ${ACTIONS.join(", ")}.`
    );
  }

  const root = context?.root || process.cwd();
  const configPath = path.join(root, CONFIG_FILE);

  if (normalized === "list") {
    const { plugins, errors } = load(context);
    const names = plugins.map(
      (plugin) => `${plugin.name}${plugin.version ? `@${plugin.version}` : ""}`
    );
    return {
      ok: true,
      created: [],
      skipped: [],
      message:
        plugins.length === 0
          ? "🔌 Tidak ada plugin terdaftar."
          : `🔌 ${plugins.length} plugin dimuat: ${names.join(", ")}${
              errors.length ? ` (${errors.length} error, lihat --json)` : ""
            }`,
      data: { plugins: plugins.map(describePlugin), errors },
    };
  }

  if (normalized === "info") {
    const name = requireSpec(normalized, spec);
    const { plugins, errors } = load(context);
    const plugin = plugins.find((entry) => matches(entry, name));
    if (!plugin) {
      throw new Error(`Plugin "${name}" tidak ditemukan.`);
    }
    return {
      ok: true,
      created: [],
      skipped: [],
      message: `🔌 ${plugin.name}${plugin.version ? `@${plugin.version}` : ""}: generators [${
        plugin.generators.join(", ") || "-"
      }], commands [${plugin.commands.join(", ") || "-"}], hooks [${
        plugin.hooks.join(", ") || "-"
      }]`,
      data: { plugin: describePlugin(plugin), errors },
    };
  }

  const entry = requireSpec(normalized, spec);

  if (normalized === "add") {
    // Verify the entry resolves BEFORE mutating the config.
    let resolvedTarget;
    try {
      resolvedTarget = resolveEntry(entry, root);
    } catch {
      throw new Error(`Plugin "${entry}" tidak bisa di-resolve dari proyek ini.`);
    }

    // The same plugin reachable through a different spec string must not be
    // registered twice (the second load would collide on generator ids).
    const existing = load(context).plugins.find(
      (plugin) => plugin.resolved === resolvedTarget
    );
    if (existing) {
      return {
        ok: true,
        created: [],
        skipped: [CONFIG_FILE],
        message: `Plugin "${entry}" sudah terdaftar sebagai "${existing.entry}".`,
        data: { action: "add", entry, resolved: resolvedTarget },
      };
    }

    const outcome = safety.updateJsonFile(configPath, (obj) => {
      const list = Array.isArray(obj.plugins) ? obj.plugins : [];
      if (list.includes(entry)) return false;
      obj.plugins = [...new Set([...list, entry])];
      return obj;
    });

    const alreadyListed = outcome.skipped === "unchanged";
    resetPlugins();
    return {
      ok: true,
      created: alreadyListed ? [] : [CONFIG_FILE],
      skipped: alreadyListed ? [CONFIG_FILE] : [],
      ...(safety.isDryRun() ? { plan: safety.getPlan() } : {}),
      message: alreadyListed
        ? `Plugin "${entry}" sudah terdaftar di ${CONFIG_FILE}.`
        : `Plugin "${entry}" ditambahkan ke ${CONFIG_FILE}.`,
      data: { action: "add", entry, resolved: resolvedTarget },
    };
  }

  // remove
  const { plugins } = load(context);
  const found = plugins.find((candidate) => matches(candidate, entry));
  const targets = new Set([entry]);
  if (found) targets.add(found.entry);

  const outcome = safety.updateJsonFile(configPath, (obj) => {
    const list = Array.isArray(obj.plugins) ? obj.plugins : [];
    const next = list.filter((item) => !targets.has(item));
    if (next.length === list.length) return false;
    // An explicit empty array would shadow `package.json#rakitin.plugins`
    // (config files win in Config precedence), so drop the key instead.
    if (next.length === 0) {
      delete obj.plugins;
      return obj;
    }
    obj.plugins = next;
    return obj;
  });

  const removed = outcome.skipped !== "unchanged";
  resetPlugins();
  return {
    ok: true,
    created: removed ? [CONFIG_FILE] : [],
    skipped: removed ? [] : [CONFIG_FILE],
    ...(safety.isDryRun() ? { plan: safety.getPlan() } : {}),
    message: removed
      ? `Plugin "${entry}" dihapus dari ${CONFIG_FILE}.`
      : found
        ? `Plugin "${entry}" tidak terdaftar di ${CONFIG_FILE} (mungkin berasal dari package.json#rakitin.plugins).`
        : `Plugin "${entry}" tidak terdaftar di ${CONFIG_FILE}.`,
    data: { action: "remove", entry },
  };
}

module.exports = { pluginCommand };
