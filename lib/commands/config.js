/**
 * lib/commands/config.js - `rakitin config`
 *
 * Headless management of `.rakitinrc.json` (v3 schema):
 *   rakitin config list
 *   rakitin config get <key>
 *   rakitin config set <key> <value>
 *
 * v3 removals: interactive prompts, key aliases (`arch` -> `defaultArchitecture`),
 * `updatedAt`/`detected` snapshots. The file is mutated exclusively through
 * `safety.updateJsonFile`, so a `.bak` is kept and `--dry-run` never writes.
 */

const path = require("path");
const { updateJsonFile, getPlan } = require("../safety");
const { Config, CONFIG_KEYS, PRESETS } = require("../config");
const { relativePosix } = require("../utils");

const CONFIG_FILE = ".rakitinrc.json";
const SCHEMA_URL = "https://raw.githubusercontent.com/Reinvy/rakitin/main/rakitin.schema.json";

/** Value domains - kept in lockstep with `rakitin.schema.json`. */
const VALUE_CHOICES = {
  preset: PRESETS,
  arch: ["simple", "modular"],
  orm: ["none", "prisma", "sequelize", "mongoose", "typeorm"],
  packageManager: ["npm", "pnpm", "yarn", "bun"],
};

const BOOLEAN_KEYS = ["autoIntegrateRouter", "generateValidationLayer", "generateTestFiles"];

/** Canonical key order - exactly what `init` writes. */
const KEY_ORDER = ["$schema", ...CONFIG_KEYS];

/**
 * @param {string} action
 * @param {object} argv Parsed yargs arguments (`action`, `key`, `value`, `_`).
 * @param {object} context Result of `buildContext()`.
 * @returns {Promise<object>} result envelope
 */
async function configCommand(argv = {}, context = {}) {
  const root = context.root || process.cwd();
  const positionals = Array.isArray(argv._) ? argv._.slice(1) : [];
  const action = String(argv.action || positionals[0] || "list").toLowerCase();
  const key = argv.key ?? positionals[1] ?? null;
  const value = argv.value ?? positionals[2] ?? null;

  switch (action) {
    case "list":
      return listConfig(root, context);
    case "get":
      return getConfig(root, key);
    case "set":
      return setConfig(root, key, value, context);
    default:
      throw new Error(`Aksi config tidak dikenal: "${action}". Pilihan: list, get, set.`);
  }
}

/**
 * Every resolved value (env + package.json#rakitin + rc file) with defaults.
 * @param {string} root
 * @returns {object}
 */
function resolvedConfig(root) {
  return new Config().load(root).all();
}

function listConfig(root, context) {
  const resolved = resolvedConfig(root);
  const project = summarizeProject(root);
  const data = { config: resolved, project };

  const message = context.json ? undefined : renderConfigTable(resolved, project);

  return { ok: true, created: [], skipped: [], message, data };
}

function getConfig(root, key) {
  if (!key) throw new Error("Penggunaan: rakitin config get <key>");

  const normalized = assertKnownKey(key);
  const value = resolvedConfig(root)[normalized];
  if (value === undefined || value === null) {
    throw new Error(`Config key "${normalized}" belum diset di proyek ini.`);
  }

  return {
    ok: true,
    created: [],
    skipped: [],
    data: { key: normalized, value },
  };
}

function setConfig(root, key, rawValue, context) {
  if (!key || rawValue === null || rawValue === undefined) {
    throw new Error("Penggunaan: rakitin config set <key> <value>");
  }

  const normalized = assertKnownKey(key);
  const value = coerceValue(normalized, rawValue);
  const configPath = path.join(root, CONFIG_FILE);
  const relative = relativePosix(root, configPath);
  const dryRun = Boolean(context.dryRun);

  const outcome = updateJsonFile(
    configPath,
    (current) => {
      const next = canonicalize(current, normalized, value);
      return JSON.stringify(next, null, 2) + "\n" === JSON.stringify(current, null, 2) + "\n"
        ? false
        : next;
    },
    { dryRun }
  );

  const unchanged = outcome.skipped === "unchanged";
  const bucket = unchanged ? { created: [], skipped: [relative] } : { created: [relative], skipped: [] };

  return {
    ok: true,
    ...bucket,
    plan: dryRun ? getPlan() : undefined,
    message: unchanged
      ? `Konfigurasi "${normalized}" sudah bernilai ${JSON.stringify(value)}.`
      : `Konfigurasi "${normalized}" diset ke ${JSON.stringify(value)}.`,
    data: { key: normalized, value, config: outcome.value },
  };
}

// ---------------------------------------------------------------------------
// Key/value validation
// ---------------------------------------------------------------------------

function assertKnownKey(key) {
  const normalized = String(key).trim();
  if (!CONFIG_KEYS.includes(normalized)) {
    throw new Error(
      `Kunci config tidak dikenal: "${key}". Pilihan: ${CONFIG_KEYS.join(", ")}.`
    );
  }
  return normalized;
}

/**
 * Coerce a CLI string into the JSON type `rakitin.schema.json` demands.
 * @param {string} key
 * @param {string|boolean} raw
 * @returns {*}
 */
function coerceValue(key, raw) {
  if (key === "version") {
    const num = Number(String(raw).trim());
    if (!Number.isInteger(num) || num !== 3) {
      throw new Error(`Nilai version harus 3 (skema config rakitin v3). Diterima: "${raw}".`);
    }
    return 3;
  }

  if (VALUE_CHOICES[key]) {
    const allowed = VALUE_CHOICES[key];
    const value = String(raw).trim().toLowerCase();
    if (!allowed.includes(value)) {
      throw new Error(`Nilai ${key} tidak valid: "${raw}". Pilihan: ${allowed.join(", ")}.`);
    }
    return value;
  }

  if (BOOLEAN_KEYS.includes(key)) {
    if (typeof raw === "boolean") return raw;
    const value = String(raw).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(value)) return true;
    if (["false", "0", "no", "n"].includes(value)) return false;
    throw new Error(`Nilai ${key} harus boolean (true|false). Diterima: "${raw}".`);
  }

  if (key === "plugins") return parsePlugins(raw);

  throw new Error(`Kunci config tidak dikenal: "${key}".`);
}

/** `'["a","b"]'`, `a,b` and `''` are all accepted; anything else is rejected. */
function parsePlugins(raw) {
  const text = String(raw).trim();
  let list;
  if (text.startsWith("[")) {
    try {
      list = JSON.parse(text);
    } catch (error) {
      throw new Error(
        `Nilai plugins harus array JSON, contoh: ["rakitin-plugin-x","./plugins/x.js"]. Diterima: "${raw}".`,
        { cause: error }
      );
    }
  } else {
    list = text === "" ? [] : text.split(",");
  }

  if (
    !Array.isArray(list) ||
    list.some((entry) => typeof entry !== "string" || entry.trim() === "")
  ) {
    throw new Error(
      `Nilai plugins harus array string (nama paket atau path relatif). Diterima: "${raw}".`
    );
  }
  return list.map((entry) => entry.trim());
}

// ---------------------------------------------------------------------------
// File shaping
// ---------------------------------------------------------------------------

/**
 * Merge `key: value` into the current rc, seeding `$schema`/`version` when the
 * file is new so the result always validates against `rakitin.schema.json`.
 * Unknown (legacy) keys are preserved - user data is never dropped.
 */
function canonicalize(current, key, value) {
  const merged = { ...current, [key]: value };
  if (merged.version === undefined) merged.version = 3;
  if (merged.$schema === undefined) merged.$schema = SCHEMA_URL;

  const ordered = {};
  for (const candidate of KEY_ORDER) {
    if (merged[candidate] !== undefined) ordered[candidate] = merged[candidate];
  }
  for (const candidate of Object.keys(merged)) {
    if (!Object.prototype.hasOwnProperty.call(ordered, candidate)) {
      ordered[candidate] = merged[candidate];
    }
  }
  return ordered;
}

// ---------------------------------------------------------------------------
// Reporting helpers
// ---------------------------------------------------------------------------

function summarizeProject(root) {
  try {
    const { detectProject } = require("../project/detector");
    const detected = detectProject(root);
    return {
      packageName: detected.packageName,
      packageManager: detected.packageManager,
      expressVersion: detected.expressVersion,
      ormsInstalled: detected.ormsInstalled,
      modules: detected.structure.modules.length,
      architectures: {
        modular: detected.structure.modularCount,
        simple: detected.structure.simpleCount,
      },
      routerHasMarkers: detected.structure.routerHasMarkers,
    };
  } catch {
    return null;
  }
}

function renderConfigTable(resolved, project) {
  const lines = ["Konfigurasi rakitin (.rakitinrc.json):"];
  for (const key of CONFIG_KEYS) {
    lines.push(`  ${key.padEnd(24)}: ${formatValue(resolved[key])}`);
  }
  if (project && project.modules > 0) {
    lines.push(
      `\nProyek terdeteksi: ${project.modules} modul ` +
        `(modular: ${project.architectures.modular}, simple: ${project.architectures.simple})`
    );
  }
  return lines.join("\n");
}

function formatValue(value) {
  if (value === undefined || value === null) return "(belum diset)";
  return Array.isArray(value) ? JSON.stringify(value) : String(value);
}

module.exports = { configCommand };
