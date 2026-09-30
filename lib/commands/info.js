/**
 * lib/commands/info.js - `rakitin info` plus the bare (`$0`) invocation
 * summary. Both are introspection-only: they never write and never prompt.
 *
 * The generator catalog lives in `lib/commands/list.js` (single source of
 * truth) - this module only reports the *detected project*.
 */

const path = require("path");
const logger = require("../utils/logger");
const { detectProject } = require("../project/detector");
const { isJsonMode } = require("./shared");
const { loadPluginHost, pluginLoadErrors } = require("./plugin-seam");

/** `rakitin <cmd>` hints shown by the bare invocation, in order. */
const BARE_HINTS = [
  "rakitin init",
  "rakitin add module <name>",
  "rakitin integrate",
  "rakitin doctor",
];

function posixRelative(root, target) {
  if (!target) return null;
  return path.relative(root, target).split(path.sep).join("/");
}

/**
 * Full detected-project summary (single shape shared by `info` and `$0`).
 * @param {object} [context] Command context (`root`, `configValues`, flags).
 * @returns {object}
 */
function buildSummary(context = {}) {
  const root = context.root || process.cwd();
  const project = detectProject(root);
  const s = project.structure;
  const ormsInstalled = Object.keys(project.ormsInstalled).filter(
    (orm) => project.ormsInstalled[orm]
  );

  return {
    root: project.root,
    packageName: project.packageName,
    packageManager: project.packageManager || context.pm || "npm",
    hasExpress: project.hasExpress,
    expressVersion: project.expressVersion,
    nodeEngine: project.nodeEngine,
    modules: {
      total: s.modularCount + s.simpleCount,
      modular: s.modularCount,
      simple: s.simpleCount,
      mixed: s.mixedArchitectures,
      names: s.modules.map((m) => m.name),
    },
    ormsInstalled,
    config: {
      file: project.config.file
        ? posixRelative(root, project.config.file)
        : null,
      preset: project.config.preset,
      arch: project.config.defaultArchitecture,
      orm: project.config.orm,
    },
    router: {
      path: posixRelative(root, s.routerPath),
      exists: s.hasMainRouter,
      markerManaged: s.routerHasMarkers,
    },
    middlewares: s.availableMiddlewares,
    rakitin: {
      preset: context.preset || null,
      arch: context.arch || null,
      orm: context.orm || null,
      install: context.install !== false,
      pm: context.pm || project.packageManager || null,
      dryRun: Boolean(context.dryRun),
    },
    plugins: {
      available: Boolean(loadPluginHost()),
      errors: pluginLoadErrors(root, context.configValues || context.config || {}),
    },
  };
}

function routerLabel(summary) {
  if (!summary.router.exists) return "belum ada";
  return summary.router.markerManaged ? "marker rakitin ✓" : "tanpa marker";
}

function pluginErrorLines(summary) {
  if (!summary.plugins.errors.length) return [];
  return [
    `   plugin        : ${summary.plugins.errors.length} error`,
    ...summary.plugins.errors.map((e) => `      ⚠️  ${e.entry}: ${e.message}`),
  ];
}

/** Human-readable summary block (stdout only when JSON mode is off). */
function summaryLines(summary, { banner = false } = {}) {
  const lines = [];
  if (banner) lines.push("🧱 rakitin - ringkasan proyek");
  lines.push(`   root          : ${summary.root}`);
  lines.push(
    `   package       : ${summary.packageName || "(tanpa nama)"} · ${summary.packageManager}`
  );
  lines.push(
    `   express       : ${summary.expressVersion || "belum terpasang"}`
  );
  lines.push(`   node engine   : ${summary.nodeEngine || "tidak diset"}`);
  lines.push(
    `   modul         : ${summary.modules.total} total (modular ${summary.modules.modular} · simple ${summary.modules.simple}${
      summary.modules.mixed ? " · campuran" : ""
    })`
  );
  lines.push(
    `   orm           : ${
      summary.ormsInstalled.length ? summary.ormsInstalled.join(", ") : "belum ada"
    }`
  );
  lines.push(
    `   config        : ${summary.config.file || "belum ada"} (preset ${summary.config.preset || "-"} · arch ${
      summary.config.arch || "-"
    } · orm ${summary.config.orm || "-"})`
  );
  lines.push(`   router        : ${summary.router.path || "-"} - ${routerLabel(summary)}`);
  lines.push(
    `   middleware    : ${
      summary.middlewares.length ? summary.middlewares.join(", ") : "belum ada"
    }`
  );
  lines.push(
    `   rakitin       : preset ${summary.rakitin.preset || "-"} · arch ${
      summary.rakitin.arch || "-"
    } · orm ${summary.rakitin.orm || "-"} · pm ${summary.rakitin.pm || "-"}${
      summary.rakitin.install ? "" : " · --no-install"
    }`
  );
  lines.push(...pluginErrorLines(summary));
  return lines;
}

function nextActionSteps(summary) {
  const steps = [];
  if (!summary.hasExpress) steps.push("rakitin init --express");
  if (summary.modules.total === 0) steps.push("rakitin add module <name>");
  if (!summary.router.exists) steps.push("rakitin integrate");
  steps.push("rakitin doctor");
  return steps;
}

/**
 * `rakitin info` - detected project summary.
 * @param {object} [context]
 * @returns {{ok: boolean, created: string[], skipped: string[], data: object, nextSteps: string[]}}
 */
function infoCommand(context = {}) {
  const summary = buildSummary(context);
  if (!isJsonMode()) {
    logger.info(summaryLines(summary).join("\n"));
  }
  return {
    ok: true,
    created: [],
    skipped: [],
    data: { summary },
    nextSteps: nextActionSteps(summary),
  };
}

/**
 * Bare `rakitin` - short summary + numbered next steps, never interactive.
 * @param {object} [context]
 * @returns {{ok: boolean, created: string[], skipped: string[], message: string, data: object, nextSteps: string[]}}
 */
function bareSummary(context = {}) {
  const summary = buildSummary(context);
  const message = [
    ...summaryLines(summary, { banner: true }),
    "",
    "   command       : rakitin init | add module | integrate | doctor | list",
  ].join("\n");

  return {
    ok: true,
    created: [],
    skipped: [],
    message,
    data: { summary },
    nextSteps: BARE_HINTS,
  };
}

module.exports = { infoCommand, bareSummary, buildSummary };
