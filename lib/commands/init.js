/**
 * lib/commands/init.js - `rakitin init`
 *
 * Creates `.rakitinrc.json`, the base router, the base ORM scaffolding and
 * (optionally) an Express project. `--dry-run` performs NO filesystem
 * mutation and NO child process: the express-generator invocation is
 * recorded as an `install` plan entry instead.
 */

const fs = require("fs");
const path = require("path");
const { detectProject } = require("../project/detector");
const {
  writeFileIfNotExistsSafe,
  updateJsonFile,
  mergeEnvExample,
  buildRoutesContent,
  overwriteWithBackup,
  isDryRun,
  runtime: safetyRuntime,
} = require("../safety");
const prisma = require("../generator/module/orm/prisma.orm");
const { ensureSequelizeDatabaseFile } = require("../generator/module/orm/sequelize.orm");
const { ensureMongooseDbConfig, ensureMongoEnv } = require("../generator/module/orm/mongoose.orm");
const { ensureDataSourceFile, ensureTypeormEnv } = require("../generator/module/orm/typeorm.orm");
const { ensureDependencies, ormToKind } = require("../deps/manifest");
const installer = require("../installer");
const logger = require("../utils/logger");
const { relativePosix } = require("../utils");
const { PRESETS, Config } = require("../config");

const SCHEMA_URL =
  "https://raw.githubusercontent.com/Reinvy/rakitin/main/rakitin.schema.json";

const VALID_ORMS = ["prisma", "sequelize", "mongoose", "typeorm", "none"];
const VALID_ARCHS = ["modular", "simple"];
const VALID_PMS = ["npm", "pnpm", "yarn", "bun"];

/**
 * @param {object} context result of buildContext()
 * @returns {Promise<object>} result envelope payload
 */
async function initCommand(context = {}) {
  const root = context.root || process.cwd();
  const created = [];
  const skipped = [];
  const record = (result, filePath) => {
    createdOrSkipped(result, created, skipped, root, filePath);
  };

  let detected = detectProject(root);

  const preset = context.preset;
  if (!PRESETS.includes(preset)) {
    throw new Error(`Preset tidak dikenal: "${preset}". Pilihan: ${PRESETS.join(", ")}`);
  }
  const orm = assertChoice("ORM", context.orm, VALID_ORMS);
  const arch = assertChoice("Arsitektur", context.arch, VALID_ARCHS);
  const pm = assertChoice("Package manager", context.pm || detected.packageManager || "npm", VALID_PMS);
  const autoIntegrate = context.autoIntegrateRouter !== false;
  const generateValidationLayer = context.generateValidationLayer ?? preset !== "basic";
  const generateTestFiles = context.generateTestFiles ?? preset === "advanced";

  warnIgnoredFlags(context, detected, { orm, arch, pm });

  const configPath = path.join(root, ".rakitinrc.json");
  const exists = fs.existsSync(configPath);

  if (exists && !context.force) {
    logger.warn(
      `Konfigurasi sudah ada di ${configPath} (gunakan --force untuk regenerasi dengan backup).`
    );
    const current = new Config().load(root).all();
    return {
      ok: true,
      created,
      skipped: [...skipped, relativePosix(root, configPath)],
      message: "Konfigurasi existing dipakai kembali (--force untuk menulis ulang).",
      nextSteps: nextStepsFor(current.preset || preset, current.orm || orm, current.arch || arch, false),
      data: {
        configFile: relativePosix(root, configPath),
        reused: true,
        preset: current.preset || preset,
        orm: current.orm || orm,
        arch: current.arch || arch,
        packageManager: current.packageManager || pm,
        autoIntegrateRouter: current.autoIntegrateRouter ?? autoIntegrate,
        generateValidationLayer: current.generateValidationLayer ?? generateValidationLayer,
        generateTestFiles: current.generateTestFiles ?? generateTestFiles,
        detected,
      },
    };
  }

  let expressGenerated = false;
  if (context.express) {
    expressGenerated = await scaffoldExpressProject(root, pm, context);
    detected = detectProject(root);
  }

  record(ensureBaseRouter(root), path.join(root, "app", "routes", "index.js"));

  for (const entry of setupBaseOrm(root, orm)) {
    record(entry, entry.path);
  }

  if (connectExpressApp(root)) {
    created.push(relativePosix(root, path.join(root, "app.js")));
  }

  const configObject = {
    $schema: SCHEMA_URL,
    version: 3,
    preset,
    arch,
    orm,
    packageManager: pm,
    autoIntegrateRouter: autoIntegrate,
    generateValidationLayer,
    generateTestFiles,
    plugins: readExistingPlugins(configPath),
  };

  if (exists && context.force) {
    const result = updateJsonFile(configPath, () => configObject);
    createdOrSkipped(result, created, skipped, root, configPath);
  } else {
    const result = writeFileIfNotExistsSafe(
      configPath,
      `${JSON.stringify(configObject, null, 2)}\n`
    );
    record(result, configPath);
  }

  let installResult = { success: true, installed: [], skipped: [], failed: [] };
  if (orm !== "none") {
    installResult = await ensureDependencies([ormToKind(orm)], {
      pm,
      install: context.install,
      silent: true,
      root,
    });
  }

  return {
    ok: true,
    created,
    skipped,
    nextSteps: nextStepsFor(preset, orm, arch, expressGenerated),
    data: {
      configFile: relativePosix(root, configPath),
      preset,
      orm,
      arch,
      packageManager: pm,
      autoIntegrateRouter: autoIntegrate,
      generateValidationLayer,
      generateTestFiles,
      expressGenerated,
      install: installResult,
      detected,
    },
  };
}

function createdOrSkipped(result, created, skipped, root, filePath) {
  if (result && result.skipped === "exists") skipped.push(relativePosix(root, filePath));
  else created.push(relativePosix(root, filePath));
}

function assertChoice(label, value, allowed) {
  const normalized = String(value || "").toLowerCase();
  if (!allowed.includes(normalized)) {
    throw new Error(
      `${label} tidak dikenal: "${value}". Pilihan: ${allowed.join(", ")}`
    );
  }
  return normalized;
}

function readExistingPlugins(configPath) {
  try {
    if (!fs.existsSync(configPath)) return [];
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    return Array.isArray(parsed.plugins) ? parsed.plugins : [];
  } catch {
    return [];
  }
}

function warnIgnoredFlags(context, detected, resolved) {
  if (context.express && detected.hasExpress) {
    logger.warn(
      "--express diabaikan: proyek ini sudah memakai Express. Scaffolding dilewati."
    );
  }
  if (!context.ormExplicit) return;
  const installed = Object.entries(detected.ormsInstalled || {}).find(([, present]) => present);
  if (installed && installed[0].toLowerCase() !== resolved.orm && resolved.orm !== "none") {
    logger.warn(`--orm ${resolved.orm} dipakai, walau ${installed[0]} terdeteksi di proyek.`);
  }
}

function nextStepsFor(preset, orm, arch, expressGenerated) {
  const steps = [];
  if (expressGenerated) steps.push("Jalankan server Express: npm start");
  steps.push(`Preset aktif: ${preset} (ORM: ${orm}, Arsitektur: ${arch})`);
  steps.push("Buat modul pertama Anda: rakitin add module <nama-modul>");
  steps.push("Jalankan health-check: rakitin doctor");
  return steps;
}

/**
 * Scaffold an Express project with `express-generator`.
 * In dry-run mode nothing is executed: the invocation is recorded.
 * @param {string} root
 * @param {string} pm
 * @param {object} context
 * @returns {Promise<boolean>}
 */
async function scaffoldExpressProject(root, pm = "npm", context = {}) {
  if (isDryRun()) {
    safetyRuntime.plan.push({ op: "install", path: "npx express-generator --no-view ." });
    return false;
  }

  logger.info("Membuat project Express baru dengan express-generator...");
  try {
    await installer.internals.execCommand(
      { command: "npx", args: ["--yes", "express-generator", "--no-view", "--force", "."] },
      { stdio: context.json ? "ignore" : "ignore", cwd: root }
    );

    if (context.install !== false) {
      logger.info(`Menginstall dependency Express menggunakan ${pm}...`);
      await installer.installProjectDependencies({
        packageManager: pm,
        silent: true,
        root,
      });
    }
    logger.success("Scaffolding Express project berhasil dibuat.");
    return true;
  } catch (error) {
    logger.warn(`express-generator dilewati: ${error.message}`);
    return false;
  }
}

/**
 * Ensure `app/routes/index.js` exists with the managed marker region.
 * @param {string} root
 * @returns {{written: boolean, skipped: "exists"|null, path: string}}
 */
function ensureBaseRouter(root) {
  const routerPath = path.join(root, "app", "routes", "index.js");
  if (fs.existsSync(routerPath)) {
    return { written: false, skipped: "exists", path: routerPath };
  }
  const { content } = buildRoutesContent(null, "");
  const result = writeFileIfNotExistsSafe(routerPath, content);
  return { ...result, path: routerPath };
}

/**
 * Base ORM scaffolding (schema files, client singletons, env sections).
 * @param {string} root
 * @param {string} orm
 * @returns {Array<{written: boolean, skipped: "exists"|null, path: string}>}
 */
function setupBaseOrm(root, orm) {
  const entries = [];
  const push = (entry) => {
    if (entry) entries.push(entry);
  };

  switch (orm) {
    case "prisma":
      push(prisma.ensurePrismaBaseSchema(root));
      push(prisma.ensurePrismaConfigFile(root));
      push(prisma.ensurePrismaDbConfig(root));
      push(prisma.ensureEnvDatabaseUrl(root));
      break;
    case "mongoose":
      push(ensureMongooseDbConfig(root));
      push(ensureMongoEnv(root));
      break;
    case "sequelize":
      push(ensureSequelizeDatabaseFile(root));
      push(mergeEnvSection(root, "SEQUELIZE", SEQUELIZE_ENV));
      break;
    case "typeorm":
      push(ensureDataSourceFile(root));
      push(ensureTypeormEnv(root));
      break;
    case "none":
    default:
      break;
  }
  return entries;
}

const SEQUELIZE_ENV = `DB_NAME=rakitin_db
DB_USER=root
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=3306
DB_DIALECT=mysql`;

function mergeEnvSection(root, marker, content) {
  const result = mergeEnvExample(root, marker, content);
  return { written: result.written, skipped: result.skipped, path: result.path };
}

/**
 * Wire `app/routes` into a scaffolded `app.js` at `/api`.
 * @param {string} root
 * @returns {boolean} true when app.js was modified
 */
function connectExpressApp(root) {
  const appPath = path.join(root, "app.js");
  if (!fs.existsSync(appPath)) return false;

  const src = fs.readFileSync(appPath, "utf8");
  if (src.includes("app/routes") || src.includes("app.use('/api'")) return false;

  const exportIdx = src.lastIndexOf("module.exports = app;");
  const injection =
    "\n// Rakitin API routes\nconst rakitinRouter = require('./app/routes');\napp.use('/api', rakitinRouter);\n\n";
  const updated =
    exportIdx === -1
      ? `${src.trimEnd()}\n${injection}`
      : src.slice(0, exportIdx) + injection + src.slice(exportIdx);

  overwriteWithBackup(appPath, updated);
  return true;
}

module.exports = {
  initCommand,
  scaffoldExpressProject,
  connectExpressApp,
  setupBaseOrm,
  ensureBaseRouter,
  SCHEMA_URL,
  VALID_ORMS,
  VALID_ARCHS,
  VALID_PMS,
};
