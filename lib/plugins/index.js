/**
 * lib/plugins/index.js - Public plugin host seam.
 *
 * Consumers (see the acceptance contract):
 *   - `lib/commands/shared.js#runWithPlugins` -> `buildPluginContext` + `getHooks`
 *   - `lib/commands/add.js#addCommand`        -> `getGenerators` (plugin generators
 *     are reachable as `rakitin add <generator-id>`; the core-id collision rule
 *     lives in `add.js`/`bin/rakitin.js`)
 *   - `lib/commands/list.js` / `doctor.js`    -> `getGenerators` / `getExtraKinds`
 *
 * Registries are cached per project root + declared plugin list so a single
 * CLI run loads each plugin once; `resetPlugins()` clears the cache (tests,
 * and after `plugin add|remove` mutates the config).
 */

const logger = require("../utils/logger");
const safety = require("../safety");
const naming = require("../naming");
const { loadPlugins: loadPluginsModule, resolveEntry } = require("./loader");
const { createRegistry, registerKind } = require("./registry");

/** @type {{signature: string, root: string, registry: object}|null} */
let state = null;

function rootOf(context) {
  if (context && typeof context.root === "string" && context.root) return context.root;
  return process.cwd();
}

function configOf(context) {
  if (!context) return null;
  const candidate = context.configValues || context.config;
  if (candidate && typeof candidate === "object") return candidate;
  // Partial context (no resolved config): discover it from the project root,
  // so hooks/generators work for consumers that pass `{ root }` only.
  try {
    const { Config } = require("../config");
    return new Config().load(rootOf(context)).all();
  } catch {
    return null;
  }
}

function declaredPlugins(config) {
  if (!config) return null;
  if (Array.isArray(config.plugins)) return config.plugins;
  if (typeof config.get === "function") {
    const value = config.get("plugins");
    if (Array.isArray(value)) return value;
  }
  return null;
}

function signatureFor(root, config) {
  return `${root}\u0000${JSON.stringify(declaredPlugins(config))}`;
}

/** Load (or reuse) the registry for the project described by `context`. */
function registryFor(context) {
  const root = rootOf(context);
  const config = configOf(context);
  const signature = signatureFor(root, config);
  if (state && state.signature === signature) return state.registry;

  const loaded = loadPluginsModule({ root, config });
  state = { signature, root, registry: loaded.registry };
  return state.registry;
}

/** Drop the cached registry (tests + after the plugin list changes). */
function resetPlugins() {
  state = null;
}

/**
 * Load plugins without caching.
 * @param {{root?: string, config?: *, logger?: object}} options
 * @returns {{plugins: object[], errors: object[], registry: object}}
 */
function loadPlugins(options = {}) {
  return loadPluginsModule(options);
}

/**
 * Plugin generators, keyed by generator id.
 * @param {object} [context]
 * @returns {Record<string, {id: string, plugin: string, describe: string, generate: Function}>}
 */
function getGenerators(context = {}) {
  const registry = registryFor(context);
  /** @type {Record<string, object>} */
  const generators = {};
  for (const [id, generator] of Object.entries(registry.generators)) {
    generators[id] = {
      id,
      plugin: generator.plugin,
      describe: generator.describe,
      generate: generator.generate,
    };
  }
  return generators;
}

/**
 * Extra dependency kinds contributed by plugins (passed to
 * `ensureDependencies(kinds, { extraKinds })`).
 * @param {object} [context]
 * @returns {Record<string, string[]>}
 */
function getExtraKinds(context = {}) {
  const registry = registryFor(context);
  return { ...registry.extraKinds };
}

/** Plugin commands (API v1), for hosts that register them with yargs. */
function getPluginCommands(context = {}) {
  const registry = registryFor(context);
  return registry.commands.map((command) => ({ ...command }));
}

/**
 * Flattened hook functions over every loaded plugin.
 * @param {object} [ctx] A context (or plugin context) carrying `root`.
 * @returns {{preGenerate: Function[], postGenerate: Function[],
 *   preInstall: Function[], postInstall: Function[], onError: Function[]}}
 */
function getHooks(ctx = {}) {
  const registry = registryFor(ctx);
  return {
    preGenerate: [...registry.hooks.preGenerate],
    postGenerate: [...registry.hooks.postGenerate],
    preInstall: [...registry.hooks.preInstall],
    postInstall: [...registry.hooks.postInstall],
    onError: [...registry.hooks.onError],
  };
}

/**
 * Build the plugin-facing context handed to generators, commands and hooks.
 * Tolerates a partial/empty `context` (never throws).
 * @param {object} [context] Normalized CLI context (`buildContext`).
 * @param {object} [pluginArgs] Command-specific extras.
 * @returns {object}
 */
function buildPluginContext(context = {}, pluginArgs = {}) {
  const safeContext = context && typeof context === "object" ? context : {};
  const extras = pluginArgs && typeof pluginArgs === "object" ? pluginArgs : {};
  const root = rootOf(safeContext);
  const registry = registryFor({ ...safeContext, root });

  return {
    root,
    command: extras.command || safeContext.command || process.argv[2] || null,
    args: { ...safeContext, ...extras },
    json: Boolean(safeContext.json),
    dryRun:
      safeContext.dryRun !== undefined ? Boolean(safeContext.dryRun) : safety.isDryRun(),
    config: configOf(safeContext) || {},
    logger,
    safety,
    naming,
    plan: safety.getPlan(),
    registerKind(kind, packages) {
      return registerKind(registry, kind, packages);
    },
  };
}

module.exports = {
  createRegistry,
  loadPlugins,
  getHooks,
  buildPluginContext,
  getGenerators,
  getExtraKinds,
  getPluginCommands,
  resolveEntry,
  resetPlugins,
};
