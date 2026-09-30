/**
 * lib/commands/config.js - `rakitin config`
 * View, update, and manage rakitin project configuration (.rakitinrc.json).
 */

const fs = require("fs-extra");
const path = require("path");
const inquirer = require("inquirer");
const { overwriteWithBackup, writeFileIfNotExistsSafe } = require("../safety");
const { VALID_ORMS, VALID_ARCHS, VALID_PMS, DEFAULT_PRESETS } = require("./init");
const logger = require("../utils/logger");

const CONFIG_FILE = ".rakitinrc.json";

/**
 * @param {string} [action] "get" | "set" | "list"
 * @param {string} [key] Configuration key
 * @param {string} [value] New value for set
 * @param {object} [options] Options { json, cwd, yes }
 */
async function configCommand(action, key, value, options = {}) {
  const root = options.cwd || process.cwd();
  const configPath = path.join(root, CONFIG_FILE);

  const currentConfig = loadConfigFile(configPath);

  // Normalize action
  const act = (action || "list").toLowerCase();

  switch (act) {
    case "get":
      return handleGet(currentConfig, key, options);

    case "set":
      return handleSet(configPath, currentConfig, key, value, options);

    case "list":
      return handleList(currentConfig, options);

    case "interactive":
    default:
      // If user provided no action or unrecognized, run interactive if TTY
      if (!options.yes && Boolean(process.stdin.isTTY) && !process.env.RAKITIN_JSON && !process.env.JEST_WORKER_ID) {
        return handleInteractive(configPath, currentConfig, options);
      }
      return handleList(currentConfig, options);
  }
}

function loadConfigFile(configPath) {
  if (fs.existsSync(configPath)) {
    try {
      return fs.readJsonSync(configPath);
    } catch {
      return {};
    }
  }
  return {};
}

function handleGet(config, key, options) {
  if (!key) {
    return handleList(config, options);
  }

  const normalizedKey = normalizeConfigKey(key);
  const val = config[normalizedKey];

  if (val === undefined) {
    if (options.json) {
      process.stdout.write(JSON.stringify({ ok: false, error: `Config key "${key}" tidak ditemukan` }, null, 2) + "\n");
    } else {
      console.log(`⚠️  Config key "${key}" tidak ditemukan.`);
    }
    return { ok: false, key: normalizedKey, value: undefined };
  }

  if (options.json) {
    process.stdout.write(JSON.stringify({ ok: true, key: normalizedKey, value: val }, null, 2) + "\n");
  } else {
    console.log(`${normalizedKey}: ${val}`);
  }

  return { ok: true, key: normalizedKey, value: val };
}

function handleSet(configPath, config, key, value, options) {
  if (!key || value === undefined) {
    throw new Error("Penggunaan: rakitin config set <key> <value>");
  }

  const normalizedKey = normalizeConfigKey(key);
  const validatedValue = validateAndNormalizeConfigValue(normalizedKey, value);

  config[normalizedKey] = validatedValue;
  config.updatedAt = new Date().toISOString();

  saveConfigFile(configPath, config);

  if (options.json) {
    process.stdout.write(
      JSON.stringify(
        {
          ok: true,
          message: `Konfigurasi ${normalizedKey} berhasil diubah menjadi ${validatedValue}`,
          config,
        },
        null,
        2
      ) + "\n"
    );
  } else {
    logger.success(`✅ Konfigurasi "${normalizedKey}" berhasil diubah menjadi: ${validatedValue}`);
  }

  return { ok: true, key: normalizedKey, value: validatedValue, config };
}

function handleList(config, options) {
  if (options.json) {
    process.stdout.write(JSON.stringify({ ok: true, config }, null, 2) + "\n");
    return { ok: true, config };
  }

  console.log("⚙️  Konfigurasi Rakitin Aktif (.rakitinrc.json):");
  console.log("------------------------------------------------");
  const keys = ["defaultArchitecture", "orm", "autoIntegrateRouter", "packageManager", "preset", "version"];
  keys.forEach((k) => {
    if (config[k] !== undefined) {
      console.log(`  • ${k.padEnd(24)}: ${config[k]}`);
    }
  });

  if (config.detected) {
    console.log("\n🔍 Deteksi Proyek:");
    console.log(`  • Express Version         : ${config.detected.expressVersion || "tidak terdeteksi"}`);
    console.log(`  • Package Manager         : ${config.detected.packageManager || "npm"}`);
    console.log(`  • Modul                   : ${config.detected.modules ?? 0}`);
  }
  console.log("------------------------------------------------");
  console.log("💡 Ubah konfigurasi via: rakitin config set <key> <value> atau edit .rakitinrc.json\n");

  return { ok: true, config };
}

async function handleInteractive(configPath, config, options) {
  const answers = await inquirer.default.prompt([
    {
      type: "select",
      name: "defaultArchitecture",
      message: "Pilih arsitektur default:",
      choices: [
        { name: "📦 Modular (controllers, services, models, routes terpisah)", value: "modular" },
        { name: "📄 Simple (controller, service, routes dalam satu folder)", value: "simple" },
      ],
      default: config.defaultArchitecture || "modular",
    },
    {
      type: "select",
      name: "orm",
      message: "Pilih ORM / Database default:",
      choices: [
        { name: "💎 Prisma", value: "prisma" },
        { name: "🐬 Sequelize", value: "sequelize" },
        { name: "🍃 Mongoose", value: "mongoose" },
        { name: "⚡ TypeORM", value: "typeorm" },
        { name: "🚫 None", value: "none" },
      ],
      default: config.orm || "prisma",
    },
    {
      type: "select",
      name: "packageManager",
      message: "Pilih package manager:",
      choices: ["npm", "pnpm", "yarn", "bun"],
      default: config.packageManager || "npm",
    },
    {
      type: "confirm",
      name: "autoIntegrateRouter",
      message: "Otomatis integrasikan modul baru ke router utama?",
      default: config.autoIntegrateRouter ?? true,
    },
  ]);

  config.defaultArchitecture = answers.defaultArchitecture;
  config.orm = answers.orm;
  config.packageManager = answers.packageManager;
  config.autoIntegrateRouter = answers.autoIntegrateRouter;
  config.updatedAt = new Date().toISOString();

  saveConfigFile(configPath, config);
  logger.success("✅ Konfigurasi .rakitinrc.json berhasil diperbarui.");

  return { ok: true, config };
}

function saveConfigFile(configPath, config) {
  const content = JSON.stringify(config, null, 2) + "\n";
  if (fs.existsSync(configPath)) {
    overwriteWithBackup(configPath, content);
  } else {
    writeFileIfNotExistsSafe(configPath, content);
  }
}

function normalizeConfigKey(key) {
  const map = {
    arch: "defaultArchitecture",
    architecture: "defaultArchitecture",
    defaultarchitecture: "defaultArchitecture",
    defaultArchitecture: "defaultArchitecture",
    orm: "orm",
    pm: "packageManager",
    packagemanager: "packageManager",
    packageManager: "packageManager",
    autointegraterouter: "autoIntegrateRouter",
    autointegrate: "autoIntegrateRouter",
    autoIntegrateRouter: "autoIntegrateRouter",
    autoIntegrate: "autoIntegrateRouter",
    preset: "preset",
  };
  return map[key.toLowerCase()] || key;
}

function validateAndNormalizeConfigValue(key, val) {
  const strVal = String(val).trim();

  if (key === "defaultArchitecture") {
    const lower = strVal.toLowerCase();
    if (!VALID_ARCHS.includes(lower)) {
      throw new Error(`Arsitektur tidak valid: "${val}". Pilihan: ${VALID_ARCHS.join(", ")}`);
    }
    return lower;
  }

  if (key === "orm") {
    const lower = strVal.toLowerCase();
    if (!VALID_ORMS.includes(lower)) {
      throw new Error(`ORM tidak valid: "${val}". Pilihan: ${VALID_ORMS.join(", ")}`);
    }
    return lower;
  }

  if (key === "packageManager") {
    const lower = strVal.toLowerCase();
    if (!VALID_PMS.includes(lower)) {
      throw new Error(`Package manager tidak valid: "${val}". Pilihan: ${VALID_PMS.join(", ")}`);
    }
    return lower;
  }

  if (key === "autoIntegrateRouter") {
    if (strVal === "true" || strVal === "1") return true;
    if (strVal === "false" || strVal === "0") return false;
    return Boolean(val);
  }

  if (key === "preset") {
    const lower = strVal.toLowerCase();
    if (!DEFAULT_PRESETS.includes(lower)) {
      throw new Error(`Preset tidak valid: "${val}". Pilihan: ${DEFAULT_PRESETS.join(", ")}`);
    }
    return lower;
  }

  return val;
}

module.exports = {
  configCommand,
  normalizeConfigKey,
  validateAndNormalizeConfigValue,
};
