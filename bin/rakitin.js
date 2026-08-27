#!/usr/bin/env node

/**
 * rakitin CLI - command surface v2.
 *
 *   rakitin                     interactive menu (unchanged legacy UX)
 *   rakitin init [--preset basic|intermediate|advanced]
 *   rakitin add <thing> [name]  headless generators
 *   rakitin integrate           marker-based router wiring
 *   rakitin doctor | info | list
 *
 * Global flags: --cwd --yes --overwrite --dry-run --json --no-install
 *               --preset --arch --orm --pm --middleware auth,logger
 */

function ensurePackage(packageName) {
  try {
    require(packageName);
  } catch (e) {
    console.log(`📦 Menginstall ${packageName}...`);
    const { execSync } = require('child_process');
    try {
      execSync(`npm install ${packageName}`, { stdio: 'inherit' });
      console.log(`✅ ${packageName} berhasil diinstall`);
    } catch (installError) {
      console.error(`❌ Gagal menginstall ${packageName}: ${installError.message}`);
      process.exit(1);
    }
  }
}

ensurePackage("yargs");

const yargs = require("yargs");
const {
  buildContext,
  enterProjectRoot,
  printResult,
  enableJsonMode,
} = require("../lib/commands/shared");
const safety = require("../lib/safety");

// eslint-disable-next-line no-unused-vars
const cli = yargs
  .scriptName("rakitin")
  .usage("Usage: $0 [command] [options]")
  .example("$0 add module user --arch modular --orm mongoose", "generate modul user")
  .option("cwd", { type: "string", describe: "Project root (default: cwd)" })
  .option("yes", { alias: "y", type: "boolean", describe: "Asumsikan default & jangan tanya" })
  .option("overwrite", { alias: "o", type: "boolean", describe: "Izinkan overwrite terkontrol (.bak dibuat)" })
  .option("dry-run", { type: "boolean", describe: "Tampilkan rencana tanpa menulis file" })
  .option("json", { type: "boolean", describe: "Output machine-readable (CI/AI agent)" })
  .option("no-install", { type: "boolean", describe: "Lewati pemasangan dependency otomatis" })
  .option("preset", { type: "string", choices: ["basic", "intermediate", "advanced"] })
  .option("arch", { type: "string", choices: ["simple", "modular"] })
  .option("orm", { type: "string", choices: ["none", "prisma", "sequelize", "mongoose", "typeorm"] })
  .option("pm", { type: "string", choices: ["npm", "pnpm", "yarn", "bun"] })
  .epilogue(
    "Integrasi-first: rakitin mendeteksi proyek existing, tidak pernah menimpa kode tanpa backup, dan semua blok router dikelola lewat marker."
  )

  /* init ------------------------------------------------------------- */
  .command(
    "init",
    "Deteksi proyek & tulis konfigurasi .rakitinrc.json",
    {},
    async (argv) => {
      const ctx = buildContext(argv);
      enterProjectRoot(ctx);
      if (ctx.json) enableJsonMode();
      try {
        const { initCommand } = require("../lib/commands/init");
        const result = await initCommand({
          preset: argv.preset,
          force: Boolean(ctx.overwrite),
        });
        printResult({
          created: result.created ? [result.configFile] : [],
          skipped: result.created ? [] : [result.configFile],
          nextSteps: [
            result.created
              ? `Preset aktif: ${result.preset}`
              : `Konfigurasi sudah ada (preset: ${result.preset})`,
            "Jalankan: rakitin doctor untuk health-check",
          ],
        });
      } catch (err) {
        fail(err, ctx.json);
      }
    }
  )

  /* add <thing> [name] ----------------------------------------------- */
  .command(
    "add <thing> [name]",
    "Generate komponen (module|middleware|util|config|endpoint|validation|docs)",
    {},
    async (argv) => {
      await runAdd(argv);
    }
  )

  /* recipes ------------------------------------------------------------ */
  .command(
    "recipe <name>",
    "Composite advanced-tier: auth|swagger|test|docker",
    {},
    async (argv) => {
      const ctx = buildContext(argv);
      enterProjectRoot(ctx);
      if (ctx.json) enableJsonMode();
      if (ctx.dryRun) safety.beginPlan();

      try {
        const { recipeCommand } = require("../lib/commands/recipe");
        const result = await recipeCommand(argv.name, {
          arch: ctx.arch,
          pm: ctx.pm,
        });

        printResult({
          ...result,
          created: result?.createdFiles?.map((p) =>
            typeof p === "string" ? p : p.path
          ),
          plan: ctx.dryRun ? safety.getPlan() : undefined,
        });
        safety.resetPlan();
      } catch (err) {
        safety.resetPlan();
        fail(err, ctx.json);
      }
    }
  )

  /* integrate ---------------------------------------------------------- */
  .command(
    "integrate",
    "Sambungkan router utama ke seluruh modul (marker-based)",
    {
      auto: { type: "boolean", describe: "Auto-detect semua modul" },
      middleware: { type: "string", describe: "Middleware global koma-terpisah" },
    },
    async (argv) => {
      const ctx = buildContext(argv);
      enterProjectRoot(ctx);
      if (ctx.json) enableJsonMode();
      if (ctx.dryRun) safety.beginPlan();

      try {
        const { integrateCommand } = require("../lib/commands/integrate");
        const result = await integrateCommand({
          middleware: argv.middleware,
        });
        printResult({
          ...result,
          created: result.ok ? [`app/routes/index.js (${result.action})`] : [],
          plan: ctx.dryRun ? safety.getPlan() : undefined,
          message: result.ok ? undefined : result.message,
        });
        safety.resetPlan();
      } catch (err) {
        safety.resetPlan();
        fail(err, ctx.json);
      }
    }
  )

  /* info / doctor / list ------------------------------------------------ */
  .command("info", "Ringkasan struktur proyek saat ini", {}, async (argv) => {
    const ctx = buildContext(argv);
    enterProjectRoot(ctx);
    if (ctx.json) enableJsonMode();
    const { infoCommand } = require("../lib/commands/info");
    const { summary } = infoCommand();
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  })

  .command("doctor", "Health-check proyek dengan rekomendasi perbaikan", {}, async (argv) => {
    const ctx = buildContext(argv);
    enterProjectRoot(ctx);
    const { doctorCommand } = require("../lib/commands/info");
    const { checks } = doctorCommand();
    const icon = { ok: "✅", warn: "⚠️ ", fail: "❌", info: "ℹ️ " };
    checks.forEach((c) => {
      console.log(`${icon[c.status]} ${c.name}: ${c.detail || ""}`);
    });
    const failed = checks.filter((c) => c.status === "fail").length;
    console.log(
      `\n${failed === 0 ? "🩺 Semua check inti lulus." : `🩺 ${failed} masalah harus ditangani.`}`
    );
  })

  .command("list", "Katalog generator yang tersedia", {}, () => {
    const { listCommand } = require("../lib/commands/info");
    const { catalog } = listCommand();
    catalog.forEach((item) => {
      console.log(`• ${item.command.padEnd(28)} — ${item.desc}`);
      console.log(`   tier: ${Array.isArray(item.tiers) ? item.tiers.join(", ") : item.tiers}`);
    });
  })

  /* legacy router alias (backward compatibility) ----------------------- */
  .command("router", "[legacy] Integrasi router interaktif", {}, () => {
    require("../lib/generator/router/router")
      .integrateRouter()
      .catch((err) => fail(err));
  })

  .demandCommand(0)
  .help()
  .alias("help", "h")
  .wrap(Math.min(110, yargs.terminalWidth?.() ?? 100))
  .parse();

if (!process.argv.slice(2).length) {
  banner();
  require("../index.js");
}

/** Shared handler for `rakitin add <thing> [name]`. */
async function runAdd(argv) {
  const ctx = buildContext(argv);
  enterProjectRoot(ctx);
  if (ctx.json) enableJsonMode();
  if (ctx.dryRun) safety.beginPlan();

  try {
    // `util` still uses its dedicated interactive flow (rich kind menu);
    // everything else supports full headless generation.
    let result;
    if (argv.thing === "util") {
      const utilModule = require("../lib/generator/util/util");
      const generateUtil = utilModule.generateUtil || utilModule;
      result = (await generateUtil()) || {};
    } else if (argv.thing === "recipe") {
      // Convenience alias: rakitin add recipe <name>
      const { recipeCommand } = require("../lib/commands/recipe");
      result = await recipeCommand(argv.name, { arch: ctx.arch, pm: ctx.pm });
    } else {
      const { addCommand } = require("../lib/commands/add");
      result = await addCommand(argv.thing, argv.name, ctx);
    }

    printResult({
      ...result,
      createdFiles: result?.createdFiles?.map((p) =>
        typeof p === "string" ? p : p.path
      ),
      plan: ctx.dryRun ? safety.getPlan() : undefined,
    });
    safety.resetPlan();
  } catch (err) {
    safety.resetPlan();
    fail(err, ctx.json);
  }
}

function runLegacyGenerator(fn) {
  return fn();
}

function banner() {
  console.log("🚀 rakitin — integration-first boilerplate CLI");
}

function fail(error, json = false) {
  if (json) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`
    );
  } else {
    console.error("\n❌ Terjadi error:", error.message);
    console.error(error.stack ? error.stack.split("\n")[1] : "");
  }
  process.exit(1);
}
