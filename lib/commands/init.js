/**
 * lib/commands/init.js - `rakitin init`
 * Project initialization with interactive wizard, express-generator scaffolding,
 * base ORM setup, and .rakitinrc.json configuration generation.
 */

const fs = require("fs-extra");
const path = require("path");
const inquirer = require("inquirer");
const { detectProject } = require("../project/detector");
const {
  writeFileIfNotExistsSafe,
  overwriteWithBackup,
} = require("../safety");
const { createAutoRouterTemplate } = require("../generator/router/router");
const {
  ensurePrismaBaseSchema,
  ensurePrismaConfigFile,
  ensurePrismaDbConfig,
  ensureEnvDatabaseUrl,
  updatePackageJsonWithPrismaSchema,
} = require("../generator/module/orm/prisma.orm");
const { ensureDependencies, ormToKind } = require("../deps/manifest");
const installer = require("../installer");
const logger = require("../utils/logger");

const DEFAULT_PRESETS = ["basic", "intermediate", "advanced"];
const VALID_ORMS = ["prisma", "sequelize", "mongoose", "typeorm", "none"];
const VALID_ARCHS = ["modular", "simple"];
const VALID_PMS = ["npm", "pnpm", "yarn", "bun"];

/**
 * @param {{
 *   preset?: string,
 *   orm?: string,
 *   arch?: string,
 *   pm?: string,
 *   express?: boolean,
 *   autoIntegrate?: boolean,
 *   force?: boolean,
 *   yes?: boolean,
 *   json?: boolean,
 *   install?: boolean
 * }} [options]
 * @returns {Promise<object>} summary
 */
async function initCommand(options = {}) {
  const root = process.cwd();
  let detected = detectProject(root);

  let preset = options.preset;
  if (preset && !DEFAULT_PRESETS.includes(preset)) {
    throw new Error(
      `Preset tidak dikenal: "${preset}". Pilihan: ${DEFAULT_PRESETS.join(", ")}`
    );
  }

  let orm = options.orm;
  if (orm) {
    const normalizedOrm = orm.toLowerCase();
    if (!VALID_ORMS.includes(normalizedOrm)) {
      throw new Error(
        `ORM tidak dikenal: "${orm}". Pilihan: ${VALID_ORMS.join(", ")}`
      );
    }
    orm = normalizedOrm;
  }

  let arch = options.arch || options.architecture;
  if (arch) {
    const normalizedArch = arch.toLowerCase();
    if (!VALID_ARCHS.includes(normalizedArch)) {
      throw new Error(
        `Arsitektur tidak dikenal: "${arch}". Pilihan: ${VALID_ARCHS.join(", ")}`
      );
    }
    arch = normalizedArch;
  }

  let pm = options.pm || options.packageManager;
  if (pm) {
    const normalizedPm = pm.toLowerCase();
    if (!VALID_PMS.includes(normalizedPm)) {
      throw new Error(
        `Package manager tidak dikenal: "${pm}". Pilihan: ${VALID_PMS.join(", ")}`
      );
    }
    pm = normalizedPm;
  }

  let autoIntegrate = options.autoIntegrate !== undefined ? Boolean(options.autoIntegrate) : undefined;
  let express = options.express;

  const configPath = path.join(root, ".rakitinrc.json");
  const exists = fs.existsSync(configPath);
  if (exists && !options.force) {
    logger.warn(
      `Konfigurasi sudah ada di ${configPath} (gunakan --force untuk regenerasi).`
    );
    let currentConfig = {};
    try {
      currentConfig = fs.readJsonSync(configPath);
    } catch {
      // ignore
    }
    return {
      configFile: configPath,
      preset: currentConfig.preset || preset || "basic",
      orm: currentConfig.orm || orm || "prisma",
      defaultArchitecture: currentConfig.defaultArchitecture || arch || "modular",
      autoIntegrateRouter: currentConfig.autoIntegrateRouter ?? true,
      detected,
      created: false,
    };
  }

  // Check if interactive prompt should run
  const isInteractive =
    !options.yes &&
    Boolean(process.stdin.isTTY) &&
    !process.env.RAKITIN_JSON &&
    !process.env.JEST_WORKER_ID;

  if (isInteractive) {
    const detectedOrm = Object.entries(detected.ormsInstalled).find(
      ([_, present]) => present
    );
    const defaultOrmChoice = orm || (detectedOrm ? detectedOrm[0].toLowerCase() : "prisma");
    const defaultPmChoice = pm || detected.packageManager || "npm";
    const defaultArchChoice = arch || "modular";
    const defaultExpressChoice = express !== undefined ? express : !detected.hasExpress;

    const answers = await inquirer.default.prompt([
      {
        type: "confirm",
        name: "express",
        message: "Apakah Anda ingin membuat project Express baru dari awal menggunakan express-generator?",
        default: defaultExpressChoice,
        when: express === undefined,
      },
      {
        type: "select",
        name: "arch",
        message: "Pilih arsitektur default untuk proyek:",
        choices: [
          { name: "📦 Modular (controllers, services, models, routes terpisah) [Recommended]", value: "modular" },
          { name: "📄 Simple (controller, service, routes dalam satu folder modul)", value: "simple" },
        ],
        default: defaultArchChoice,
        when: !arch,
      },
      {
        type: "select",
        name: "orm",
        message: "Pilih ORM / Database default:",
        choices: [
          { name: "💎 Prisma (Type-safe ORM & multi-file schema) [Recommended]", value: "prisma" },
          { name: "🐬 Sequelize (SQL ORM untuk MySQL/Postgres/SQLite)", value: "sequelize" },
          { name: "🍃 Mongoose (MongoDB ODM)", value: "mongoose" },
          { name: "⚡ TypeORM (Data Mapper ORM)", value: "typeorm" },
          { name: "🚫 None (Tanpa ORM / in-memory store)", value: "none" },
        ],
        default: defaultOrmChoice,
        when: !orm,
      },
      {
        type: "select",
        name: "pm",
        message: "Pilih package manager yang digunakan:",
        choices: [
          { name: "npm", value: "npm" },
          { name: "pnpm", value: "pnpm" },
          { name: "yarn", value: "yarn" },
          { name: "bun", value: "bun" },
        ],
        default: defaultPmChoice,
        when: !pm,
      },
      {
        type: "confirm",
        name: "autoIntegrate",
        message: "Integrasikan route modul baru ke router utama secara otomatis?",
        default: true,
        when: autoIntegrate === undefined,
      },
    ]);

    if (express === undefined && answers.express !== undefined) express = answers.express;
    if (!arch && answers.arch) arch = answers.arch;
    if (!orm && answers.orm) orm = answers.orm;
    if (!pm && answers.pm) pm = answers.pm;
    if (autoIntegrate === undefined && answers.autoIntegrate !== undefined) autoIntegrate = answers.autoIntegrate;
  }

  // Resolve defaults for non-prompted / non-specified values
  if (!orm) {
    const installed = Object.entries(detected.ormsInstalled).find(
      ([_, present]) => present
    );
    orm = installed ? installed[0].toLowerCase() : "prisma";
  }

  if (!arch) {
    arch = "modular";
  }

  if (!pm) {
    pm = detected.packageManager || "npm";
  }

  if (autoIntegrate === undefined) {
    autoIntegrate = true;
  }

  if (!preset) {
    const anyOrm = orm !== "none" || Object.values(detected.ormsInstalled).some(Boolean);
    preset = anyOrm ? "intermediate" : "basic";
  }

  let expressGenerated = false;

  // Step 1: Run express-generator if requested
  if (express) {
    expressGenerated = await scaffoldExpressProject(root, pm, options);
    // Re-detect project structure after express-generator
    detected = detectProject(root);
  }

  // Step 2: Setup Base Router (app/routes/index.js)
  ensureBaseRouter(root);

  // Step 3: Setup Base ORM configuration & database client singletons
  setupBaseOrm(root, orm);

  // Step 4: If Express app.js exists, wire rakitin routes seamlessly
  connectExpressApp(root);

  // Step 5: Write .rakitinrc.json
  const configContent =
    JSON.stringify(
      {
        $schema: "./node_modules/rakitin/rakitin.schema.json",
        preset,
        orm,
        defaultArchitecture: arch,
        autoIntegrateRouter: autoIntegrate,
        packageManager: pm,
        version: 2,
        detected: {
          expressVersion: detected.expressVersion,
          packageManager: pm,
          modules: detected.structure.modules.length,
          mixedArchitectures: detected.structure.mixedArchitectures,
        },
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n";

  if (exists && options.force) {
    overwriteWithBackup(configPath, configContent);
  } else {
    writeFileIfNotExistsSafe(configPath, configContent);
  }

  // Step 6: Ensure ORM dependencies installed if needed
  if (options.install !== false && orm !== "none") {
    try {
      await ensureDependencies([ormToKind(orm)], {
        silent: !!options.json,
        pm,
      });
    } catch (installErr) {
      logger.warn(`Instalasi dependency ORM (${orm}) dilewati: ${installErr.message}`);
    }
  }

  const nextSteps = [
    `Preset aktif: ${preset} (ORM: ${orm}, Arsitektur: ${arch})`,
    "Buat modul pertama Anda: rakitin add module <nama-modul>",
    "Jalankan health-check: rakitin doctor",
  ];

  if (expressGenerated) {
    nextSteps.unshift("Jalankan server Express: npm start");
  }

  return {
    configFile: configPath,
    preset,
    orm,
    defaultArchitecture: arch,
    autoIntegrateRouter: autoIntegrate,
    packageManager: pm,
    expressGenerated,
    detected,
    created: true,
    nextSteps,
  };
}

/**
 * Scaffolding Express project using npx express-generator --no-view
 */
async function scaffoldExpressProject(root, pm = "npm", options = {}) {
  logger.info("🚀 Membuat project Express baru dengan express-generator...");
  try {
    const cmd = "npx --yes express-generator --no-view --force .";
    await installer.internals.execCommand(cmd, {
      stdio: options.json ? "ignore" : "inherit",
      cwd: root,
    });

    if (options.install !== false) {
      logger.info(`📦 Menginstall dependency Express menggunakan ${pm}...`);
      const pmCfg = installer.PACKAGE_MANAGERS[pm] || installer.PACKAGE_MANAGERS.npm;
      const installCmd = pm === "npm" ? "npm install" : pmCfg.install([]);
      await installer.internals.execCommand(installCmd, {
        stdio: options.json ? "ignore" : "inherit",
        cwd: root,
      });
    }

    logger.success("✅ Scaffolding Express project berhasil dibuat.");
    return true;
  } catch (error) {
    logger.warn(`Peringatan: express-generator menghasilkan: ${error.message}`);
    return false;
  }
}

/**
 * Ensure app/routes/index.js exists with auto-router template
 */
function ensureBaseRouter(root) {
  const routesDir = path.join(root, "app", "routes");
  const routerPath = path.join(routesDir, "index.js");

  if (!fs.existsSync(routerPath)) {
    fs.mkdirSync(routesDir, { recursive: true });
    const content = createAutoRouterTemplate("modular", []);
    writeFileIfNotExistsSafe(routerPath, content);
  }
}

/**
 * Ensure base configuration & singleton connection for the chosen ORM
 */
function setupBaseOrm(root, orm) {
  const sharedConfigDir = path.join(root, "app", "shared", "config");
  fs.mkdirSync(sharedConfigDir, { recursive: true });

  switch (orm) {
    case "prisma":
      ensurePrismaBaseSchema();
      ensurePrismaConfigFile();
      ensurePrismaDbConfig();
      ensureEnvDatabaseUrl();
      updatePackageJsonWithPrismaSchema();
      break;

    case "mongoose": {
      const dbPath = path.join(sharedConfigDir, "db.js");
      writeFileIfNotExistsSafe(
        dbPath,
        `// MongoDB / Mongoose connection singleton
const mongoose = require("mongoose");

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/rakitin_db";

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
  }
}

module.exports = { connectDB, mongoose };
`
      );
      appendEnvVariable(root, "MONGODB_URI", "mongodb://localhost:27017/rakitin_db");
      break;
    }

    case "sequelize": {
      const dbPath = path.join(sharedConfigDir, "db.js");
      writeFileIfNotExistsSafe(
        dbPath,
        `// Sequelize database connection singleton
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "rakitin_db",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT || "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
  }
);

module.exports = { sequelize };
`
      );
      appendEnvVariable(root, "DB_NAME", "rakitin_db");
      appendEnvVariable(root, "DB_USER", "root");
      appendEnvVariable(root, "DB_PASSWORD", "");
      appendEnvVariable(root, "DB_HOST", "localhost");
      appendEnvVariable(root, "DB_PORT", "3306");
      appendEnvVariable(root, "DB_DIALECT", "mysql");
      break;
    }

    case "typeorm": {
      const dsPath = path.join(sharedConfigDir, "data-source.js");
      writeFileIfNotExistsSafe(
        dsPath,
        `// TypeORM DataSource singleton
const { DataSource } = require("typeorm");

const AppDataSource = new DataSource({
  type: process.env.DB_TYPE || "mysql",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "rakitin_db",
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV === "development",
  entities: ["app/modules/**/*.entity.js"],
});

module.exports = { AppDataSource };
`
      );
      appendEnvVariable(root, "DB_TYPE", "mysql");
      appendEnvVariable(root, "DB_NAME", "rakitin_db");
      appendEnvVariable(root, "DB_USER", "root");
      appendEnvVariable(root, "DB_PASSWORD", "");
      appendEnvVariable(root, "DB_HOST", "localhost");
      appendEnvVariable(root, "DB_PORT", "3306");
      break;
    }

    case "none":
    default:
      break;
  }
}

/**
 * Connect Express app.js with Rakitin main router
 */
function connectExpressApp(root) {
  const appPath = path.join(root, "app.js");
  if (!fs.existsSync(appPath)) return;

  try {
    const src = fs.readFileSync(appPath, "utf8");
    if (src.includes("app/routes") || src.includes("app.use('/api'")) {
      return; // Already linked
    }

    const exportIdx = src.lastIndexOf("module.exports = app;");
    const injection =
      "\n// Rakitin API routes\nconst rakitinRouter = require('./app/routes');\napp.use('/api', rakitinRouter);\n\n";

    let updated;
    if (exportIdx !== -1) {
      updated = src.slice(0, exportIdx) + injection + src.slice(exportIdx);
    } else {
      updated = src.trimEnd() + "\n" + injection;
    }

    overwriteWithBackup(appPath, updated);
    logger.success("✅ Rakitin API router berhasil dihubungkan ke app.js di '/api'");
  } catch (error) {
    logger.debug(`Koneksi router ke app.js dilewati: ${error.message}`);
  }
}

/**
 * Helper to append missing key=value to .env.example
 */
function appendEnvVariable(root, key, defaultValue) {
  try {
    const envExamplePath = path.join(root, ".env.example");
    let content = "";
    if (fs.existsSync(envExamplePath)) {
      content = fs.readFileSync(envExamplePath, "utf8");
      if (content.includes(`${key}=`)) {
        return;
      }
    }
    const line = `${key}=${defaultValue}\n`;
    fs.writeFileSync(envExamplePath, (content ? content.trimEnd() + "\n" : "") + line, "utf8");
  } catch {
    // non-fatal
  }
}

module.exports = {
  initCommand,
  scaffoldExpressProject,
  connectExpressApp,
  setupBaseOrm,
  DEFAULT_PRESETS,
  VALID_ORMS,
  VALID_ARCHS,
  VALID_PMS,
};
