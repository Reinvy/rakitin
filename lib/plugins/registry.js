/**
 * lib/plugins/registry.js - In-memory registry for loaded plugins (API v1).
 *
 * The registry is a plain data structure (no I/O): the loader fills it and
 * every consumer (`lib/plugins/index.js`, `lib/commands/plugin.js`) reads it.
 * Malformed contributions are recorded as `errors[]` entries and skipped -
 * loading a plugin NEVER aborts the running command.
 */

/** Hook names a plugin may contribute (API v1). */
const HOOK_NAMES = ["preGenerate", "postGenerate", "preInstall", "postInstall", "onError"];

/**
 * Default dependency kind for a plugin generator: `plugin:<generator-id>`.
 * Plugins may declare packages for it via `dependencies`.
 * @param {string} id Generator id.
 * @returns {string}
 */
function kindForGenerator(id) {
  return `plugin:${id}`;
}

/** @param {*} value @returns {boolean} */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Create an empty registry.
 * @returns {{plugins: object[], errors: object[], generators: object,
 *   commands: object[], hooks: Record<string, Function[]>, extraKinds: object}}
 */
function createRegistry() {
  return {
    plugins: [],
    errors: [],
    /** generator id -> { id, plugin, describe, generate } */
    generators: {},
    /** { name, describe, builder?, handler, plugin } */
    commands: [],
    /** hook name -> Function[] (flattened over all plugins) */
    hooks: HOOK_NAMES.reduce((acc, name) => {
      acc[name] = [];
      return acc;
    }, {}),
    /** kind -> package spec list (merged into KIND_DEPENDENCIES) */
    extraKinds: {},
  };
}

/**
 * Add `kind -> packages` to the registry's extra-kind map.
 * @param {object} registry
 * @param {string} kind
 * @param {string[]} packages
 * @returns {boolean} true when the kind was registered/merged.
 */
function registerKind(registry, kind, packages) {
  if (!registry || !isNonEmptyString(kind) || !Array.isArray(packages)) return false;
  const specs = packages.filter(isNonEmptyString);
  const existing = registry.extraKinds[kind] || [];
  registry.extraKinds[kind] = [...new Set([...existing, ...specs])];
  return true;
}

function registerGenerators(registry, record, plugin) {
  const generators = isPlainObject(plugin.generators) ? plugin.generators : {};
  for (const [id, spec] of Object.entries(generators)) {
    if (!isNonEmptyString(id)) continue;
    if (!isPlainObject(spec) || typeof spec.generate !== "function") {
      registry.errors.push({
        entry: record.entry,
        message: `Generator "${id}" dari plugin "${record.name}" tidak memiliki fungsi generate.`,
      });
      continue;
    }
    if (registry.generators[id]) {
      registry.errors.push({
        entry: record.entry,
        message: `Generator "${id}" dari plugin "${record.name}" bentrok dengan generator plugin lain.`,
      });
      continue;
    }
    registry.generators[id] = {
      id,
      plugin: record.name,
      describe: isNonEmptyString(spec.describe) ? spec.describe : "",
      generate: spec.generate,
    };
    record.generators.push(id);
    if (!registry.extraKinds[kindForGenerator(id)]) {
      registry.extraKinds[kindForGenerator(id)] = [];
    }
  }
}

function registerCommands(registry, record, plugin) {
  const commands = Array.isArray(plugin.commands) ? plugin.commands : [];
  for (const command of commands) {
    if (!isPlainObject(command) || !isNonEmptyString(command.name) || typeof command.handler !== "function") {
      registry.errors.push({
        entry: record.entry,
        message: `Command dari plugin "${record.name}" tidak valid (butuh "name" dan "handler").`,
      });
      continue;
    }
    const name = command.name.trim();
    if (registry.commands.some((entry) => entry.name === name)) {
      registry.errors.push({
        entry: record.entry,
        message: `Command "${name}" dari plugin "${record.name}" bentrok dengan command plugin lain.`,
      });
      continue;
    }
    registry.commands.push({
      name,
      describe: isNonEmptyString(command.describe) ? command.describe : "",
      builder: typeof command.builder === "function" ? command.builder : undefined,
      handler: command.handler,
      plugin: record.name,
    });
    record.commands.push(name);
  }
}

function registerHooks(registry, record, plugin) {
  const hooks = isPlainObject(plugin.hooks) ? plugin.hooks : {};
  for (const name of HOOK_NAMES) {
    if (typeof hooks[name] !== "function") continue;
    registry.hooks[name].push(hooks[name]);
    record.hooks.push(name);
  }
}

function registerDependencies(registry, record, plugin) {
  const dependencies = isPlainObject(plugin.dependencies) ? plugin.dependencies : {};
  for (const [kind, packages] of Object.entries(dependencies)) {
    if (!isNonEmptyString(kind) || !Array.isArray(packages)) {
      registry.errors.push({
        entry: record.entry,
        message: `Dependency kind "${kind}" dari plugin "${record.name}" tidak valid (butuh array paket).`,
      });
      continue;
    }
    registerKind(registry, kind, packages);
  }
}

/**
 * Validate + register a plugin module export.
 * @param {object} registry
 * @param {*} plugin Module export (already unwrapped from `default`).
 * @param {string} entry Config entry (for error reporting).
 * @param {string} [resolved] Absolute resolved path.
 * @returns {boolean} true when the plugin was accepted.
 */
function registerPlugin(registry, plugin, entry, resolved = null) {
  if (!isPlainObject(plugin)) {
    registry.errors.push({
      entry,
      message: `Plugin "${entry}" tidak valid: export harus berupa objek.`,
    });
    return false;
  }
  if (plugin.apiVersion !== 1) {
    registry.errors.push({
      entry,
      message: `Plugin "${entry}" memakai apiVersion ${JSON.stringify(
        plugin.apiVersion ?? null
      )}; rakitin hanya mendukung apiVersion 1.`,
    });
    return false;
  }
  if (!isNonEmptyString(plugin.name)) {
    registry.errors.push({
      entry,
      message: `Plugin "${entry}" tidak valid: properti "name" wajib berupa string.`,
    });
    return false;
  }

  const record = {
    name: plugin.name.trim(),
    version: isNonEmptyString(plugin.version) ? plugin.version : null,
    description: isNonEmptyString(plugin.description) ? plugin.description : "",
    entry,
    resolved,
    generators: [],
    commands: [],
    hooks: [],
  };

  registerGenerators(registry, record, plugin);
  registerCommands(registry, record, plugin);
  registerHooks(registry, record, plugin);
  registerDependencies(registry, record, plugin);

  registry.plugins.push(record);
  return true;
}

module.exports = {
  HOOK_NAMES,
  kindForGenerator,
  createRegistry,
  registerPlugin,
  registerKind,
};
