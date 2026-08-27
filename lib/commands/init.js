/**
 * lib/commands/init.js - `rakitin init`
 * Detect the existing project and write .rakitinrc.json (idempotent),
 * so every subsequent rakitin command inherits project conventions.
 */

const fs = require("fs-extra");
const path = require("path");
const { detectProject } = require("../project/detector");
const { writeFileIfNotExistsSafe } = require("../safety");
const logger = require("../utils/logger");

const DEFAULT_PRESETS = ["basic", "intermediate", "advanced"];
const VALID_ORMS = ["prisma", "sequelize", "mongoose", "typeorm", "none"];

/**
 * @param {{preset?: string, orm?: string, arch?: string, force?: boolean}} [options]
 * @returns {object} summary { configFile, preset, orm, detected, created }
 */
async function initCommand(options = {}) {
  const root = process.cwd();
  const detected = detectProject(root);

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
  } else {
    // Auto-detect installed ORM, otherwise default to "prisma"
    const installed = Object.entries(detected.ormsInstalled).find(
      ([_, present]) => present
    );
    orm = installed ? installed[0].toLowerCase() : "prisma";
  }

  // Sensible auto-preset based on what the detector sees:
  // ORM already present => intermediate; else keep integration-friendly basic.
  if (!preset) {
    const anyOrm = Object.values(detected.ormsInstalled).some(Boolean);
    preset = anyOrm ? "intermediate" : "basic";
  }

  const defaultArchitecture = options.arch ? options.arch.toLowerCase() : "modular";
  const configPath = path.join(root, ".rakitinrc.json");
  const exists = fs.existsSync(configPath);
  if (exists && !options.force) {
    logger.warn(
      `Konfigurasi sudah ada di ${configPath} (gunakan --force untuk regenerasi).`
    );
    return { configFile: configPath, preset, orm, detected, created: false };
  }

  const content =
    JSON.stringify(
      {
        $schema: "./node_modules/rakitin/rakitin.schema.json",
        preset,
        orm,
        defaultArchitecture,
        version: 2,
        detected: {
          expressVersion: detected.expressVersion,
          packageManager: detected.packageManager,
          modules: detected.structure.modules.length,
          mixedArchitectures: detected.structure.mixedArchitectures,
        },
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + "\n";

  if (exists && options.force) {
    const { overwriteWithBackup } = require("../safety");
    overwriteWithBackup(configPath, content);
  } else {
    writeFileIfNotExistsSafe(configPath, content);
  }

  return { configFile: configPath, preset, orm, detected, created: true };
}

module.exports = { initCommand, DEFAULT_PRESETS, VALID_ORMS };
