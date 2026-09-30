/**
 * lib/commands/shared.js - Command-layer plumbing:
 * context resolution from global flags, single `--cwd` application,
 * the unified result envelope (human + JSON), and the plugin hook seam.
 */

const path = require("path");
const logger = require("../utils/logger");
const { Spinner } = require("../ui/progress");
const { PRESETS } = require("../config");

/** Does the target project declare any supported ORM dependency? */
function hasInstalledOrm(root) {
  try {
    const pkgPath = path.join(root, "package.json");
    if (!require("fs").existsSync(pkgPath)) return false;
    const pkg = JSON.parse(require("fs").readFileSync(pkgPath, "utf8"));
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    return Boolean(
      deps.prisma ||
        deps["@prisma/client"] ||
        deps.sequelize ||
        deps.mongoose ||
        deps.typeorm
    );
  } catch {
    return false;
  }
}

/**
 * Convert an absolute path to a POSIX path relative to `root`.
 * Every `created[]` / `skipped[]` entry is reported this way.
 * @param {string} target
 * @param {string} root
 * @returns {string}
 */
function toProjectRelative(target, root) {
  const rel = path.relative(root, path.resolve(root, target));
  return rel.split(path.sep).join("/");
}

function relativizeAll(entries, root) {
  if (!Array.isArray(entries)) return [];
  return entries.map((entry) =>
    typeof entry === "string" ? toProjectRelative(entry, root) : entry
  );
}

/** Lazily resolve the plugin host (never throws; plugins are optional). */
function pluginHost() {
  try {
    return require("./plugin-seam").loadPluginHost();
  } catch {
    return null;
  }
}

/**
 * Normalize the argv context every command receives from yargs.
 * @param {object} argv Parsed yargs arguments.
 * @returns {object} Normalized context.
 */
function buildContext(argv = {}) {
  const root = path.resolve(
    typeof argv.cwd === "string" && argv.cwd ? argv.cwd : process.cwd()
  );

  let configInstance = null;
  try {
    const { Config } = require("../config");
    configInstance = new Config().load(root);
  } catch {
    // A malformed config must not break context resolution.
  }
  const configValues = configInstance ? configInstance.all() : {};
  const configured = (key) =>
    Boolean(configInstance && configInstance.hasExplicit(key));

  const explicitOrm = argv.orm !== undefined && argv.orm !== null;
  const configuredOrm = configured("orm") ? configValues.orm : null;

  // Preset resolution (§2.9): explicit flag > rc file > auto-detect.
  // `--orm none` / a configured `none` declares the database-free basic tier,
  // so it does NOT count as "an ORM was chosen".
  let preset = argv.preset || (configured("preset") ? configValues.preset : null) || null;
  if (!preset) {
    const choseOrm =
      (explicitOrm && String(argv.orm).toLowerCase() !== "none") ||
      (configuredOrm && String(configuredOrm).toLowerCase() !== "none");
    preset = choseOrm || hasInstalledOrm(root) ? "intermediate" : "basic";
  }
  if (!PRESETS.includes(preset)) {
    throw new Error(
      `Preset tidak dikenal: "${preset}". Pilih salah satu: ${PRESETS.join(", ")}.`
    );
  }

  const orm = explicitOrm
    ? String(argv.orm).toLowerCase()
    : configuredOrm
      ? String(configuredOrm).toLowerCase()
      : preset === "basic"
        ? "none"
        : "prisma";

  const arch = String(
    argv.arch || argv.architecture || (configured("arch") ? configValues.arch : null) || "modular"
  ).toLowerCase();

  return {
    root,
    json: Boolean(argv.json),
    yes: Boolean(argv.yes || argv.y),
    overwrite: Boolean(argv.overwrite || argv.o),
    dryRun: Boolean(argv["dry-run"] || argv.dryRun),
    install: argv.install !== false,
    pm: argv.pm || (configured("packageManager") ? configValues.packageManager : null) || null,
    preset,
    arch,
    orm,
    ormExplicit: explicitOrm,
    generateValidationLayer: configured("generateValidationLayer")
      ? Boolean(configValues.generateValidationLayer)
      : preset !== "basic",
    generateTestFiles: configured("generateTestFiles")
      ? Boolean(configValues.generateTestFiles)
      : preset === "advanced",
    express: argv.express !== undefined ? Boolean(argv.express) : undefined,
    force: Boolean(argv.force || argv.f),
    autoIntegrateRouter:
      argv.autoIntegrate !== undefined
        ? Boolean(argv.autoIntegrate)
        : configured("autoIntegrateRouter")
          ? Boolean(configValues.autoIntegrateRouter)
          : true,
    // Command-specific inputs (declared per subcommand).
    name: argv.name || null,
    module: argv.module || null,
    kind: argv.kind || null,
    customName: argv.customName || null,
    resource: argv.resource || null,
    fields: argv.fields || null,
    fromModule: argv.fromModule || null,
    common: Boolean(argv.common),
    all: Boolean(argv.all),
    template: argv.template || "crud",
    withTests: Boolean(argv.withTests),
    title: argv.title || null,
    apiVersion: argv.apiVersion || null,
    auth: argv.auth !== undefined ? Boolean(argv.auth) : undefined,
    pagination: argv.pagination !== undefined ? Boolean(argv.pagination) : true,
    filtering: argv.filtering !== undefined ? Boolean(argv.filtering) : true,
    wsPath: argv.path || "/ws",
    middleware: argv.middleware || null,
    spec: argv.spec || null,
    configValues,
  };
}

/**
 * Resolve the project root exactly once (`--cwd`), then chdir so every
 * lazy path helper agrees without touching their signatures.
 * @param {object} context
 */
function enterProjectRoot(context) {
  if (context.root && context.root !== process.cwd()) {
    process.chdir(context.root);
  }
}

function isJsonMode() {
  return Boolean(process.env.RAKITIN_JSON);
}

/** Enable JSON-only stdout mode (used by --json). */
function enableJsonMode() {
  logger.setLevel("silent");
  process.env.RAKITIN_JSON = "1";
}

/**
 * Print the unified result envelope.
 *
 * JSON mode: exactly ONE object on stdout:
 *   { ok, created, skipped, plan?, nextSteps, message?, data? }
 * Human mode: created/skipped/next-steps sections.
 *
 * @param {object} result
 * @param {object} [context] Used to relativize path entries against `root`.
 */
function printResult(result = {}, context = null) {
  const root = context?.root || process.cwd();
  const ok = result.ok !== false;
  const created = relativizeAll(result.created, root);
  const skipped = relativizeAll(result.skipped, root);
  const nextSteps = result.nextSteps || [];
  const plan = Array.isArray(result.plan) ? result.plan : undefined;

  if (isJsonMode()) {
    const payload = { ok, created, skipped };
    if (plan) payload.plan = plan;
    payload.nextSteps = nextSteps;
    if (result.message) payload.message = result.message;
    if (result.data !== undefined) payload.data = result.data;
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  if (result.message) process.stdout.write(`\n${result.message}\n`);

  if (plan) {
    if (plan.length) {
      process.stdout.write("\n📋 Rencana perubahan (dry-run):\n");
      plan.forEach((entry) => {
        const suffix = entry.backup ? ` (backup: ${entry.backup})` : "";
        process.stdout.write(`   • [${entry.op}] ${entry.path}${suffix}\n`);
      });
    } else {
      process.stdout.write("\n📋 Tidak ada perubahan yang direncanakan.\n");
    }
  } else if (created.length) {
    process.stdout.write("\n📁 File yang dibuat:\n");
    created.forEach((p) => process.stdout.write(`   • ${p}\n`));
  }

  if (skipped.length) {
    process.stdout.write(
      `ℹ️  ${skipped.length} file dilewati karena sudah ada (gunakan --overwrite untuk kontrol lebih).\n`
    );
  }

  if (nextSteps.length) {
    process.stdout.write("\n🧭 Next steps:\n");
    nextSteps.forEach((s, i) => process.stdout.write(`   ${i + 1}. ${s}\n`));
  }
  process.stdout.write("\n");
}

/**
 * Print a failure envelope and set exit code 1.
 * @param {Error|string} error
 * @param {boolean} [json]
 */
function printFailure(error, json = false) {
  const message = error instanceof Error ? error.message : String(error);
  if (json || isJsonMode()) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: message }, null, 2)}\n`);
  } else {
    logger.error(message);
  }
}

/**
 * Fire plugin hooks around a command body.
 * `preGenerate` -> fn -> `postGenerate`; the optional ops seam lets a
 * command wrap its install step with `runWithPluginInstall`.
 *
 * @param {object} context
 * @param {object} pluginArgs Extra args handed to plugin hooks.
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
async function runWithPlugins(context, pluginArgs, fn) {
  const host = pluginHost();
  if (!host || typeof host.getHooks !== "function") return fn();

  const ctx = host.buildPluginContext(context, pluginArgs);
  const hooks = host.getHooks(ctx);
  for (const hook of hooks.preGenerate) await hook(ctx);
  try {
    const result = await fn();
    for (const hook of hooks.postGenerate) await hook(ctx, result);
    return result;
  } catch (error) {
    for (const hook of hooks.onError) await hook(ctx, error);
    throw error;
  }
}

/**
 * Wrap an install step with `preInstall`/`postInstall` plugin hooks.
 * @param {object} context
 * @param {() => Promise<any>} fn
 * @returns {Promise<any>}
 */
async function runWithPluginInstall(context, fn) {
  const host = pluginHost();
  if (!host || typeof host.getHooks !== "function") return fn();

  const ctx = host.buildPluginContext(context, {});
  const hooks = host.getHooks(ctx);
  for (const hook of hooks.preInstall) await hook(ctx);
  const result = await fn();
  for (const hook of hooks.postInstall) await hook(ctx, result);
  return result;
}

/**
 * Run an async task with a spinner when the terminal supports it;
 * silently resolves in non-TTY/JSON mode to keep CI logs clean.
 */
async function withSpinner(label, fn) {
  const isTty =
    Boolean(process.stdout.isTTY) &&
    !process.env.RAKITIN_JSON &&
    !process.env.JEST_WORKER_ID;
  if (!isTty) return fn();

  const spinner = new Spinner({ text: label });
  spinner.start();
  try {
    const out = await fn();
    spinner.succeed();
    return out;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}

module.exports = {
  buildContext,
  enterProjectRoot,
  printResult,
  printFailure,
  isJsonMode,
  enableJsonMode,
  runWithPlugins,
  runWithPluginInstall,
  toProjectRelative,
  withSpinner,
};
