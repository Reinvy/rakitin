/**
 * lib/config/index.js - Configuration loader.
 *
 * Sources (in order of priority, first match wins):
 *   1. environment variables (`RAKITIN_*`)
 *   2. `package.json#rakitin`
 *   3. the first existing config file (.rakitinrc.json, .rakitinrc,
 *      rakitin.config.js, rakitin.config.json)
 *
 * The configuration file is JSON (or a CommonJS module); JSON with comments
 * is rejected explicitly rather than silently misparsed.
 */

const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

/**
 * Canonical configuration shape (v3). These are exactly the keys `init`
 * writes plus the plugin list; `rakitin.schema.json` allows nothing else.
 */
const DEFAULT_CONFIG = {
  version: 3,
  preset: null,
  arch: null,
  orm: null,
  packageManager: null,
  autoIntegrateRouter: true,
  generateValidationLayer: false,
  generateTestFiles: false,
  plugins: [],
};

/** Config file candidates, highest priority first. */
const CONFIG_FILES = [
  ".rakitinrc.json",
  ".rakitinrc",
  "rakitin.config.json",
  "rakitin.config.js",
];

/** Keys `config set` accepts (mirrors rakitin.schema.json). */
const CONFIG_KEYS = [
  "version",
  "preset",
  "arch",
  "orm",
  "packageManager",
  "autoIntegrateRouter",
  "generateValidationLayer",
  "generateTestFiles",
  "plugins",
];

const PRESETS = ["basic", "intermediate", "advanced"];

class Config {
  /**
   * @param {object} [initialConfig]
   */
  constructor(initialConfig = {}) {
    this._config = { ...DEFAULT_CONFIG };
    this._sources = [];
    this._loaded = false;
    this._explicit = new Set();
    if (Object.keys(initialConfig).length > 0) {
      this._mergeConfig(initialConfig, "initial");
    }
  }

  _mergeConfig(config, source) {
    this._config = this._deepMerge(this._config, config);
    for (const key of Object.keys(config)) this._explicit.add(key);
    this._sources.push({ source, timestamp: new Date().toISOString() });
  }

  /**
   * Was `key` set by a real source (env, package.json#rakitin, config file)?
   * `DEFAULT_CONFIG` values are NOT explicit, which is how callers tell
   * "the user asked for false" apart from "the library default is false".
   * @param {string} key Top-level key (a dotted key uses its first segment).
   * @returns {boolean}
   */
  hasExplicit(key) {
    return this._explicit.has(String(key).split(".")[0]);
  }

  /** Every explicitly configured top-level key. */
  explicitKeys() {
    return [...this._explicit];
  }

  _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      const value = source[key];
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        result[key] = this._deepMerge(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Load configuration from every available source.
   * @param {string} [root] Project root.
   * @returns {Config}
   */
  load(root = process.cwd()) {
    if (this._loaded) {
      logger.warn("Config sudah dimuat. Gunakan reload() untuk menyegarkan.");
      return this;
    }
    this._loadFromEnv();
    this._loadFromPackageJson(root);
    this._loadFromConfigFile(root);
    this._loaded = true;
    logger.debug("Configuration loaded from", this._sources.length, "sources");
    return this;
  }

  _loadFromEnv() {
    const envPrefix = "RAKITIN_";
    const envConfig = {};
    for (const key of Object.keys(process.env)) {
      if (!key.startsWith(envPrefix)) continue;
      const configKey = key
        .substring(envPrefix.length)
        .toLowerCase()
        .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      if (!CONFIG_KEYS.includes(configKey)) continue;

      let value = process.env[key];
      if (value === "true" || value === "false") value = value === "true";
      else if (value !== "" && !Number.isNaN(Number(value))) value = Number(value);
      envConfig[configKey] = value;
    }
    if (Object.keys(envConfig).length > 0) this._mergeConfig(envConfig, "environment");
  }

  _loadFromPackageJson(root) {
    try {
      const packageJsonPath = path.join(root, "package.json");
      if (!fs.existsSync(packageJsonPath)) return;
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      if (packageJson.rakitin && typeof packageJson.rakitin === "object") {
        this._mergeConfig(packageJson.rakitin, "package.json");
      }
    } catch (error) {
      logger.debug("Could not load from package.json:", error.message);
    }
  }

  _loadFromConfigFile(root) {
    for (const configFile of CONFIG_FILES) {
      const configPath = path.join(root, configFile);
      if (!fs.existsSync(configPath)) continue;

      let config;
      if (configFile.endsWith(".js")) {
        delete require.cache[require.resolve(configPath)];
        config = require(configPath);
        if (config && config.default) config = config.default;
        if (typeof config === "function") config = config(this._config);
      } else {
        const raw = fs.readFileSync(configPath, "utf8");
        try {
          config = JSON.parse(raw);
        } catch (error) {
          throw new Error(
            `Config "${configFile}" bukan JSON yang valid: ${error.message}. ` +
              "Komentar tidak didukung - hapus komentar lalu coba lagi.",
            { cause: error }
          );
        }
      }

      if (config && typeof config === "object") {
        this._mergeConfig(config, configFile);
      }
      return; // first existing candidate wins
    }
  }

  /**
   * @param {string} key Dot-notation key.
   * @param {*} [defaultValue]
   */
  get(key, defaultValue = undefined) {
    const keys = key.split(".");
    let value = this._config;
    for (const k of keys) {
      if (value === null || value === undefined) return defaultValue;
      value = value[k];
    }
    return value !== undefined ? value : defaultValue;
  }

  set(key, value) {
    const keys = key.split(".");
    let obj = this._config;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!obj[k] || typeof obj[k] !== "object") obj[k] = {};
      obj = obj[k];
    }
    obj[keys[keys.length - 1]] = value;
    this._sources.push({ source: "runtime", timestamp: new Date().toISOString() });
    return this;
  }

  has(key) {
    const keys = key.split(".");
    let value = this._config;
    for (const k of keys) {
      if (
        value === null ||
        value === undefined ||
        !Object.prototype.hasOwnProperty.call(value, k)
      ) {
        return false;
      }
      value = value[k];
    }
    return value !== null && value !== undefined;
  }

  /** Every resolved key/value pair. */
  all() {
    return JSON.parse(JSON.stringify(this._config));
  }

  toJSON() {
    return this.all();
  }

  getSources() {
    return [...this._sources];
  }

  reload(root = process.cwd()) {
    this._config = { ...DEFAULT_CONFIG };
    this._sources = [];
    this._explicit = new Set();
    this._loaded = false;
    return this.load(root);
  }

  reset() {
    this._config = { ...DEFAULT_CONFIG };
    this._sources = [];
    this._explicit = new Set();
    this._loaded = false;
    return this;
  }

  /**
   * Validate against a `{ key: { required, type, enum } }` schema.
   * @param {object} schema
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate(schema) {
    const errors = [];
    for (const [key, rules] of Object.entries(schema)) {
      const value = this.get(key);
      if (rules.required && (value === undefined || value === null)) {
        errors.push(`Missing required config: ${key}`);
        continue;
      }
      if (value !== undefined && rules.type) {
        const actualType = Array.isArray(value) ? "array" : typeof value;
        if (actualType !== rules.type) {
          errors.push(`Invalid type for ${key}: expected ${rules.type}, got ${actualType}`);
        }
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: must be one of ${rules.enum.join(", ")}`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  child(prefix) {
    const childConfig = new Config();
    childConfig._config = this.get(prefix, {});
    childConfig._sources = [...this._sources];
    childConfig._explicit = new Set(this._explicit);
    childConfig._loaded = this._loaded;
    return childConfig;
  }
}

function createConfig(initialConfig = {}) {
  return new Config(initialConfig);
}

module.exports = {
  Config,
  createConfig,
  DEFAULT_CONFIG,
  CONFIG_FILES,
  CONFIG_KEYS,
  PRESETS,
};
