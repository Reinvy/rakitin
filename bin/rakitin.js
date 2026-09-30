#!/usr/bin/env node
"use strict";

/**
 * rakitin CLI - command surface v3.
 *
 * yargs 18 exposes its factory as `module.exports`, so the CLI must INVOKE
 * it (`yargs(argv)`) instead of chaining off the required module.
 */

const pkg = require("../package.json");

// A closed stdout (`rakitin list --json | head -1`) must not crash the CLI.
process.stdout.on("error", (error) => {
  if (error && error.code === "EPIPE") process.exit(0);
  throw error;
});

function loadYargs(args) {
  const mod = require("yargs");
  const factory = typeof mod === "function" ? mod : mod.default;
  if (typeof factory !== "function") {
    throw new Error("yargs tidak dapat dimuat (API factory tidak ditemukan).");
  }
  return factory(args);
}

const {
  buildContext,
  enterProjectRoot,
  printResult,
  printFailure,
  enableJsonMode,
  runWithPlugins,
} = require("../lib/commands/shared");
const safety = require("../lib/safety");
const { addCommand } = require("../lib/commands/add");
const { initCommand } = require("../lib/commands/init");
const { configCommand } = require("../lib/commands/config");
const { integrateCommand } = require("../lib/commands/integrate");
const { recipeCommand } = require("../lib/commands/recipe");
const { infoCommand, bareSummary } = require("../lib/commands/info");
const { doctorCommand } = require("../lib/commands/doctor");
const { listCommand } = require("../lib/commands/list");
const { pluginCommand } = require("../lib/commands/plugin");

const ORM_CHOICES = ["none", "prisma", "sequelize", "mongoose", "typeorm"];
const PM_CHOICES = ["npm", "pnpm", "yarn", "bun"];
const PRESET_CHOICES = ["basic", "intermediate", "advanced"];
const ADD_THINGS = [
  "module",
  "middleware",
  "util",
  "config",
  "endpoint",
  "validation",
  "docs",
  "test",
  "graphql",
  "websocket",
];

/**
 * Common wrapper: resolve context, apply `--cwd` once, run, print the
 * envelope, and translate failures into exit code 1.
 * @param {object} argv
 * @param {(context: object) => Promise<object>} fn
 */
async function run(argv, fn) {
  const json = Boolean(argv.json);
  if (json) enableJsonMode();

  let context;
  try {
    context = buildContext(argv);
    enterProjectRoot(context);
    if (context.dryRun) safety.beginPlan();
    else safety.resetPlan();
    safety.setOverwrite(context.overwrite);

    if (argv.cliVersion) {
      const result = { ok: true, created: [], skipped: [], data: { version: pkg.version } };
      if (context.json) {
        printResult({ ...result, message: pkg.version }, context);
      } else {
        process.stdout.write(`${pkg.version}\n`);
      }
      return;
    }

    const result = await runWithPlugins(context, { command: argv._?.[0] || null }, () =>
      fn(context)
    );
    if (context.dryRun && result && result.plan === undefined) {
      result.plan = safety.getPlan();
    }
    printResult(result, context);
  } catch (error) {
    printFailure(error, json);
    process.exitCode = 1;
  } finally {
    safety.resetPlan();
  }
}

const cli = loadYargs(process.argv.slice(2))
  .scriptName("rakitin")
  .usage("Usage: $0 [command] [options]")
  .example("$0 add module user --arch modular --orm none --yes", "generate modul user")
  .version(false)
  .help()
  .alias("help", "h")
  .option("cwd", { type: "string", describe: "Project root (default: cwd)" })
  .option("yes", { type: "boolean", alias: "y", describe: "Non-interaktif, pakai semua default" })
  .option("overwrite", {
    type: "boolean",
    alias: "o",
    describe: "Izinkan overwrite (selalu dengan backup .bak)",
  })
  .option("dry-run", { type: "boolean", describe: "Rencanakan tanpa menyentuh disk" })
  .option("json", { type: "boolean", describe: "Output machine-readable (CI/AI agent)" })
  .option("install", {
    type: "boolean",
    default: true,
    describe: "Install dependency (pakai --no-install untuk melewati)",
  })
  .option("auto-integrate", {
    type: "boolean",
    describe: "Auto-integrasi router modul baru (pakai --no-auto-integrate untuk mematikan)",
  })
  .option("preset", { type: "string", choices: PRESET_CHOICES })
  .option("arch", { type: "string", choices: ["simple", "modular"] })
  .option("orm", { type: "string", choices: ORM_CHOICES })
  .option("pm", { type: "string", choices: PM_CHOICES })
  .option("middleware", { type: "string", describe: "CSV middleware global untuk integrate" })
  .option("cli-version", { type: "boolean", describe: "Cetak versi rakitin lalu keluar" })
  .epilogue(
    "Integrasi-first: rakitin mendeteksi proyek existing, tidak pernah menimpa kode tanpa backup, dan semua blok router dikelola lewat marker."
  )

  /* $0 ---------------------------------------------------------------- */
  .command(
    "$0",
    "Ringkasan proyek + petunjuk langkah berikutnya",
    {},
    (argv) =>
      run(argv, async (context) => {
        const positionals = Array.isArray(argv._) ? argv._ : [];
        if (positionals.length) {
          throw new Error(
            `Command tidak dikenal: "${positionals[0]}". Lihat 'rakitin list'.`
          );
        }
        return bareSummary(context);
      })
  )

  /* init -------------------------------------------------------------- */
  .command(
    "init",
    "Inisialisasi proyek & konfigurasi .rakitinrc.json",
    (y) =>
      y
        .option("express", { type: "boolean", describe: "Scaffold Express baru" })
        .option("force", {
          type: "boolean",
          alias: "f",
          describe: "Regenerasi .rakitinrc.json (dengan backup)",
        }),
    (argv) => run(argv, (context) => initCommand(context))
  )

  /* config [action] [key] [value] ------------------------------------ */
  .command(
    "config [action] [key] [value]",
    "Lihat atau ubah konfigurasi .rakitinrc.json (list|get|set)",
    {},
    (argv) => run(argv, (context) => configCommand(argv, context))
  )

  /* add <thing> [name] ----------------------------------------------- */
  .command(
    "add <thing> [kind] [name]",
    `Generate komponen (${ADD_THINGS.join("|")})`,
    (y) =>
      y
        .positional("thing", { describe: `Salah satu dari: ${ADD_THINGS.join(", ")}` })
        .positional("kind", {
          describe: "Kind/tipe kedua (auth, jwt, openapi-json, ...) atau nama target",
        })
        .positional("name", { describe: "Nama kedua, contoh: add util custom my-helper" })
        .option("template", {
          type: "string",
          describe: "Varian template modul (crud|readonly|graphql|realtime)",
        })
        .option("with-tests", { type: "boolean", describe: "Sekalian buat file test modul" })
        .option("custom-name", { type: "string", describe: "Nama untuk kind custom" })
        .option("resource", { type: "string", describe: "Resource endpoint" })
        .option("fields", { type: "string", describe: "Spec field, contoh: name:string,price:number" })
        .option("from-module", { type: "string", describe: "Ambil field dari modul existing" })
        .option("common", { type: "boolean", describe: "Validator common (bukan per-modul)" })
        .option("title", { type: "string", describe: "Judul dokumentasi API" })
        .option("api-version", { type: "string", describe: "Versi API untuk dokumentasi" })
        .option("auth", {
          type: "boolean",
          default: true,
          describe: "Sertakan security scheme di docs (--no-auth untuk mematikan)",
        })
        .option("pagination", {
          type: "boolean",
          default: true,
          describe: "Endpoint dengan pagination (--no-pagination untuk mematikan)",
        })
        .option("filtering", {
          type: "boolean",
          default: true,
          describe: "Endpoint dengan filtering (--no-filtering untuk mematikan)",
        })
        .option("module", { type: "string", describe: "Modul target (graphql|websocket|test)" })
        .option("all", { type: "boolean", describe: "Terapkan ke semua modul (test)" })
        .option("path", { type: "string", describe: "Path WebSocket (default /ws)" }),
    (argv) =>
      run(argv, (context) =>
        addCommand(argv.thing, argv.kind ?? argv.name ?? null, {
          ...context,
          kind: argv.kind ?? null,
          name: argv.name ?? null,
        })
      )
  )

  /* recipe <name> ----------------------------------------------------- */
  .command(
    "recipe <name>",
    "Composite advanced-tier: auth|swagger|test|docker",
    {},
    (argv) => run(argv, (context) => recipeCommand(argv.name, context))
  )

  /* integrate --------------------------------------------------------- */
  .command(
    "integrate",
    "Sambungkan router utama ke seluruh modul (marker-based)",
    {},
    (argv) => run(argv, (context) => integrateCommand({ ...context, middleware: context.middleware }))
  )

  /* plugin <action> [spec] -------------------------------------------- */
  .command(
    "plugin <action> [spec]",
    "Kelola plugin rakitin (list|add|remove|info)",
    (y) => y.positional("action", { describe: "list|add|remove|info" }),
    (argv) => run(argv, (context) => pluginCommand(argv.action, argv.spec, context))
  )

  /* info / doctor / list ---------------------------------------------- */
  .command("info", "Ringkasan struktur proyek saat ini", {}, (argv) =>
    run(argv, (context) => Promise.resolve(infoCommand(context)))
  )
  .command("doctor", "Health-check proyek dengan rekomendasi perbaikan", {}, (argv) =>
    run(argv, (context) => doctorCommand(context))
  )
  .command("list", "Katalog generator yang tersedia", {}, (argv) =>
    run(argv, (context) => Promise.resolve(listCommand(context)))
  )

  .demandCommand(0)
  .strict(false)
  .wrap(Math.min(110, process.stdout.columns || 100));

/** Command names owned by the core CLI (plugins may not shadow them). */
const CORE_COMMANDS = new Set([
  "init",
  "config",
  "add",
  "recipe",
  "integrate",
  "plugin",
  "info",
  "doctor",
  "list",
  "$0",
]);

/** Read `--cwd <dir>` / `--cwd=<dir>` before yargs has parsed anything. */
function preScanCwd(argv) {
  const index = argv.indexOf("--cwd");
  if (index !== -1 && argv[index + 1]) return argv[index + 1];
  const inline = argv.find((arg) => arg.startsWith("--cwd="));
  return inline ? inline.slice("--cwd=".length) : process.cwd();
}

/**
 * Make plugin-contributed commands (plugin API v1 `commands[]`) dispatchable.
 * Malformed entries and id collisions with core commands are skipped.
 * @param {object} cli The yargs instance.
 */
function registerPluginCommands(cli) {
  let host;
  try {
    host = require("../lib/commands/plugin-seam").loadPluginHost();
  } catch {
    // The plugin layer is optional.
  }
  if (!host || typeof host.getPluginCommands !== "function") return;

  const root = preScanCwd(process.argv.slice(2));
  const commands = safePluginCommands(host, root);

  for (const command of commands) {
    if (!command || typeof command.name !== "string" || typeof command.handler !== "function") {
      continue;
    }
    if (CORE_COMMANDS.has(command.name)) continue;

    const name = command.name;
    cli.command({
      command: name,
      describe: command.describe || `Plugin command: ${name}`,
      builder: typeof command.builder === "function" ? command.builder : {},
      handler: (argv) =>
        run(argv, async (context) => {
          const pluginHost = require("../lib/plugins");
          const pluginContext = pluginHost.buildPluginContext(context, { command: name });
          const output = await command.handler(argv, pluginContext);
          return output && typeof output === "object" ? output : { ok: true };
        }),
    });
  }
}

/** Resolved config for the project root, or `{}` when unreadable. */
function safeConfigValues(root) {
  try {
    const { Config } = require("../lib/config");
    return new Config().load(root).all();
  } catch {
    return {};
  }
}

/** Plugin-contributed commands, or `[]` when the host cannot provide them. */
function safePluginCommands(host, root) {
  try {
    return host.getPluginCommands({ root, configValues: safeConfigValues(root) });
  } catch {
    return [];
  }
}

registerPluginCommands(cli);
cli.parse();
