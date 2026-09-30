/**
 * lib/commands/list.js - `rakitin list`: the generator catalog.
 *
 * The catalog is DERIVED from the real registries (dependency manifest,
 * middleware/config/util kind lists, module architectures & templates,
 * recipes, plugin generators) so it can never drift from what the CLI
 * actually generates.
 */

const fs = require("fs");
const path = require("path");
const { KIND_DEPENDENCIES } = require("../deps/manifest");
const { loadPluginReport, pluginGenerators } = require("./plugin-seam");

/** Fallback `add util` kinds, used only when the util registry is absent. */
const FALLBACK_UTIL_KINDS = [
  "custom",
  "date",
  "string",
  "number",
  "array",
  "object",
  "file",
  "crypto",
  "uuid",
  "env",
  "url",
  "color",
  "math",
  "validation",
  "regex",
  "time",
];

const FALLBACK_MODULE_ARCHS = ["simple", "modular"];

const FALLBACK_MODULE_TEMPLATES = ["crud", "readonly", "graphql", "realtime"];

/** Commands that are not backed by a kind registry. */
const CORE_COMMANDS = [
  { command: "init", describe: "Inisialisasi proyek + .rakitinrc.json", tier: "basic" },
  { command: "integrate", describe: "Sambungkan router utama (marker, idempotent)", tier: "basic" },
  { command: "info", describe: "Ringkasan proyek terdeteksi", tier: "basic" },
  { command: "doctor", describe: "Health-check proyek + rekomendasi", tier: "basic" },
  { command: "list", describe: "Katalog generator", tier: "basic" },
];

const PLUGIN_ACTIONS = [
  { command: "plugin list", describe: "Daftar plugin + error pemuatan", tier: "plugin" },
  { command: "plugin add", describe: "Daftarkan plugin di .rakitinrc.json", tier: "plugin" },
  { command: "plugin remove", describe: "Hapus plugin dari .rakitinrc.json", tier: "plugin" },
  { command: "plugin info", describe: "Detail plugin terpasang", tier: "plugin" },
];

/** require() that tolerates a registry not existing yet. */
function optionalRequire(id) {
  try {
    return require(id);
  } catch {
    return null;
  }
}

function middlewareKinds() {
  const registry = optionalRequire("../generator/middleware/middleware");
  return Array.isArray(registry?.MIDDLEWARE_KINDS) ? registry.MIDDLEWARE_KINDS : [];
}

function configKinds() {
  const registry = optionalRequire("../generator/config/config");
  return Array.isArray(registry?.CONFIG_KINDS) ? registry.CONFIG_KINDS : [];
}

function utilKinds() {
  const registry = optionalRequire("../generator/util/util");
  return Array.isArray(registry?.UTIL_KINDS) ? registry.UTIL_KINDS : FALLBACK_UTIL_KINDS;
}

function moduleTemplates() {
  const registry = optionalRequire("../generator/module/verbs");
  return Array.isArray(registry?.TEMPLATES) ? registry.TEMPLATES : FALLBACK_MODULE_TEMPLATES;
}

function moduleArchitectures() {
  try {
    const dir = path.join(__dirname, "..", "generator", "module", "arch");
    const found = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".arch.js"))
      .map((file) => file.replace(".arch.js", ""));
    if (found.length) return found.sort();
  } catch {
    /* fall through */
  }
  return FALLBACK_MODULE_ARCHS;
}

function recipes() {
  const registry = optionalRequire("./recipe");
  return registry && typeof registry.RECIPES === "object" && registry.RECIPES
    ? registry.RECIPES
    : null;
}

/** `docs:openapi-json` -> `openapi-json`; the composite `complete` is explicit. */
function docsKinds() {
  const kinds = Object.keys(KIND_DEPENDENCIES)
    .filter((kind) => kind.startsWith("docs:"))
    .map((kind) => kind.slice("docs:".length));
  if (!kinds.includes("complete")) kinds.push("complete");
  return kinds;
}

/**
 * Build the catalog from the live registries.
 * @param {object} [context] Command context (`root`, `configValues`).
 * @returns {Array<{command: string, kind?: string, name?: string, describe: string, tier: string}>}
 */
function buildCatalog(context = {}) {
  const catalog = [];

  for (const entry of CORE_COMMANDS) {
    catalog.push({ command: entry.command, name: entry.command, describe: entry.describe, tier: entry.tier });
  }

  for (const arch of moduleArchitectures()) {
    catalog.push({
      command: "add module",
      kind: arch,
      describe: `Modul arsitektur ${arch} (controller/service/router + wiring)`,
      tier: "basic",
    });
  }
  for (const template of moduleTemplates()) {
    catalog.push({
      command: "add module",
      name: template,
      describe: `Varian template modul: ${template}`,
      tier: template === "crud" ? "basic" : "intermediate",
    });
  }

  for (const kind of middlewareKinds()) {
    catalog.push({
      command: "add middleware",
      kind,
      describe: `Middleware Express: ${kind}`,
      tier: "basic",
    });
  }

  for (const kind of configKinds()) {
    catalog.push({
      command: "add config",
      kind,
      describe: `Config berbasis env: ${kind}`,
      tier: "basic",
    });
  }

  for (const kind of utilKinds()) {
    catalog.push({
      command: "add util",
      kind,
      describe: `Utility: ${kind}`,
      tier: "basic",
    });
  }

  catalog.push({
    command: "add endpoint",
    kind: "resource",
    describe: "CRUD endpoint (+ pagination/filtering) pada modul existing",
    tier: "intermediate",
  });
  catalog.push({
    command: "add validation",
    kind: "joi",
    describe: "Skema validasi Joi (modul | common | baru)",
    tier: "intermediate",
  });
  for (const kind of docsKinds()) {
    catalog.push({
      command: "add docs",
      kind,
      describe: `Dokumentasi API: ${kind}`,
      tier: "advanced",
    });
  }
  catalog.push({
    command: "add test",
    name: "module",
    describe: "File test Jest + supertest per modul",
    tier: "advanced",
  });
  catalog.push({
    command: "add graphql",
    name: "core",
    describe: "GraphQL schema + resolver + handler Express",
    tier: "intermediate",
  });
  catalog.push({
    command: "add websocket",
    name: "ws",
    describe: "WebSocket server + registry handler",
    tier: "intermediate",
  });

  const recipeRegistry = recipes();
  if (recipeRegistry) {
    for (const [name, recipe] of Object.entries(recipeRegistry)) {
      catalog.push({
        command: `recipe ${name}`,
        name,
        describe: recipe?.desc || `Recipe ${name}`,
        tier: recipe?.tier || "advanced",
      });
    }
  } else {
    for (const name of ["auth", "swagger", "test", "docker"]) {
      catalog.push({ command: `recipe ${name}`, name, describe: `Recipe ${name}`, tier: "advanced" });
    }
  }

  for (const entry of PLUGIN_ACTIONS) {
    catalog.push({ ...entry, name: entry.command });
  }

  const root = context.root || process.cwd();
  const config = context.configValues || context.config || {};
  const report = loadPluginReport(root, config);
  if (!report.available) {
    catalog.push({
      command: "plugin",
      name: "plugins",
      describe: "Layer plugin belum tersedia di instalasi ini",
      tier: "plugin",
    });
  }
  for (const generator of pluginGenerators(root, config)) {
    catalog.push({
      command: `add ${generator.id}`,
      name: generator.id,
      describe:
        generator.describe ||
        `Generator plugin ${generator.plugin || "?"}: ${generator.id}`,
      tier: "plugin",
    });
  }

  return catalog;
}

/**
 * `rakitin list` - machine-readable catalog of every reachable generator.
 * @param {object} [context]
 * @returns {{ok: boolean, created: string[], skipped: string[], data: {catalog: object[]}, nextSteps: string[]}}
 */
function listCommand(context = {}) {
  const catalog = buildCatalog(context);
  return {
    ok: true,
    created: [],
    skipped: [],
    data: { catalog },
    nextSteps: [
      `rakitin add module <name> --arch ${context.arch || "modular"} --orm ${context.orm || "none"}`,
      "rakitin info",
    ],
  };
}

module.exports = { listCommand, buildCatalog };
