/**
 * lib/commands/shared.js - Common helpers for the command layer:
 * context resolution from global flags, headless prompting bypass,
 * unified result printing (human table or machine-readable JSON),
 * and the signature "Next steps" block.
 */

const logger = require("../utils/logger");
const { Spinner } = require("../ui/progress");

/**
 * Normalize the argv context every command receives from yargs.
 * @param {object} argv yargs-parsed arguments.
 */
function buildContext(argv = {}) {
  const extraArgs = Array.isArray(argv._)
    ? argv._.filter((x) => !["add", argv.thing, argv.name, argv.$0].includes(x))
    : [];

  return {
    cwd: typeof argv.cwd === "string" ? argv.cwd : process.cwd(),
    yes: Boolean(argv.yes || argv.y),
    overwrite: Boolean(argv.overwrite || argv.o),
    dryRun: Boolean(argv["dry-run"] || argv.dryRun),
    json: Boolean(argv.json),
    install: argv.install !== false,
    preset: argv.preset || null,
    arch: argv.arch || argv.architecture || null,
    orm: argv.orm || null,
    pm: argv.pm || null,
    resource: argv.resource || null,
    fields: argv.fields || null,
    title: argv.title || null,
    version: argv.version || null,
    auth: argv.auth !== undefined ? Boolean(argv.auth) : undefined,
    pagination: argv.pagination !== undefined ? Boolean(argv.pagination) : undefined,
    filtering: argv.filtering !== undefined ? Boolean(argv.filtering) : undefined,
    validatorName:
      argv.validatorName ||
      argv.module ||
      argv.targetModule ||
      extraArgs[0] ||
      null,
    module: argv.module || argv.targetModule || extraArgs[0] || null,
    customName: argv.customName || extraArgs[0] || null,
    extraArgs,
  };
}

/**
 * Resolve paths relative to an explicit root. Generators read process.cwd()
 * via lazy getPaths() - in headless/command mode we chdir so ALL internal
 * helpers agree without touching their signatures everywhere.
 */
function enterProjectRoot(context) {
  if (context.cwd && context.cwd !== process.cwd()) {
    process.chdir(context.cwd);
  }
}

/**
 * Print a generated-files summary + actionable next steps. In JSON mode a
 * single structured object is emitted instead (CI/AI friendly).
 * @param {object} result { created?: string[], skipped?: string[], plan?, nextSteps?: string[] }
 */
function printResult(result) {
  const { created = [], skipped = [], plan, nextSteps = [], message } = result;

  if (isJsonMode()) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, created, skipped, plan, nextSteps }, null, 2)}\n`
    );
    return;
  }

  if (message) console.log(`\n${message}\n`);

  const items = plan && plan.length ? plan : created;
  if (items.length) {
    const label =
      plan && plan.length ? "Rencana perubahan (dry-run)" : "File yang dibuat";
    console.log(`📁 ${label}:`);
    items.forEach((p) => console.log(`   • ${typeof p === "string" ? p : p.path}`));
    const skippedCount = skipped.length;
    if (skippedCount > 0) {
      console.log(
        `ℹ️  ${skippedCount} file dilewati karena sudah ada (gunakan --overwrite untuk kontrol lebih).`
      );
    }
  }

  if (nextSteps.length) {
    console.log("\n🧭 Next steps:");
    nextSteps.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
  }
  console.log();
}

function isJsonMode() {
  return Boolean(process.env.RAKITIN_JSON);
}

/** Enable JSON-only stdout mode (used by --json). */
function enableJsonMode() {
  // Quiets the layered logger so stdout stays machine-parseable.
  logger.setLevel("error", { silent: true });
  process.env.RAKITIN_JSON = "1";
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
  isJsonMode,
  enableJsonMode,
  withSpinner,
};
