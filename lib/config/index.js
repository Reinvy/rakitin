/**
 * Configuration System - Multi-source configuration with override capability
 * Supports: .rakitinrc, rakitin.config.js, package.json, environment variables
 */

const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

/**
 * Default configuration values
 */
const DEFAULT_CONFIG = {
  // Project structure
  basePath: "app",
  modulesPath: "app/modules",
  sharedPath: "app/shared",
  routesPath: "app/routes",

  // Architecture defaults
  defaultArchitecture: "modular",
  defaultORM: "None",

  // Router settings
  autoIntegrateRouter: true,
  defaultRouterArchitecture: "modular",

  // ORM packages
  ormPackages: {
    prisma: ["@prisma/client", "prisma"],
    sequelize: ["sequelize", "mysql2"],
    mongoose: ["mongoose"],
    typeorm: ["typeorm", "reflect-metadata"],
  },

  // Logging
  logLevel: "info",
  enableFileLogging: false,
  logFilePath: "logs/rakitin.log",

  // UI settings
  enableColors: true,
  enableEmoji: true,
  verbose: false,

  // Package manager
  packageManager: "npm",

  // Generation options
  generateServiceLayer: true,
  generateValidationLayer: true,
  generateTestFiles: false,

  // File templates
  templateEngine: "ejs",
  includeComments: true,
  includeJSDoc: true,
};

/**
 * Config file names to search for (in order of priority)
 */
const CONFIG_FILES = [
  ".rakitinrc",
  ".rakitinrc.json",
  "rakitin.config.js",
  "rakitin.config.json",
];

/**
 * Configuration loader with multi-source support
 */
class Config {
  /**
   * Create a new Config instance
   * @param {Object} initialConfig - Initial configuration
   */
  constructor(initialConfig = {}) {
    this._config = { ...DEFAULT_CONFIG };
    this._sources = [];
    this._loaded = false;

    if (Object.keys(initialConfig).length > 0) {
      this._mergeConfig(initialConfig, "initial");
    }
  }

  /**
   * Merge configuration from a source
   * @param {Object} config - Configuration to merge
   * @param {string} source - Source name for tracking
   */
  _mergeConfig(config, source) {
    this._config = this._deepMerge(this._config, config);
    this._sources.push({ source, timestamp: new Date().toISOString() });
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object}
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        if (
          source[key] !== null &&
          typeof source[key] === "object" &&
          !Array.isArray(source[key])
        ) {
          result[key] = this._deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  /**
   * Load configuration from all available sources
   * @param {string} cwd - Current working directory
   * @returns {Config}
   */
  load(cwd = process.cwd()) {
    if (this._loaded) {
      logger.warn("Config already loaded. Use reload() to refresh.");
      return this;
    }

    // 1. Load from environment variables
    this._loadFromEnv();

    // 2. Load from package.json
    this._loadFromPackageJson(cwd);

    // 3. Load from config files
    this._loadFromConfigFiles(cwd);

    this._loaded = true;
    logger.debug("Configuration loaded from", this._sources.length, "sources");

    return this;
  }

  /**
   * Load configuration from environment variables
   */
  _loadFromEnv() {
    const envPrefix = "RAKITIN_";
    const envConfig = {};

    for (const key of Object.keys(process.env)) {
      if (key.startsWith(envPrefix)) {
        const configKey = key
          .substring(envPrefix.length)
          .toLowerCase()
          .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

        let value = process.env[key];

        // Parse boolean values
        if (value === "true" || value === "false") {
          value = value === "true";
        } else if (!isNaN(value) && value !== "") {
          value = Number(value);
        }

        envConfig[configKey] = value;
      }
    }

    if (Object.keys(envConfig).length > 0) {
      this._mergeConfig(envConfig, "environment");
    }
  }

  /**
   * Load configuration from package.json
   * @param {string} cwd - Working directory
   */
  _loadFromPackageJson(cwd) {
    try {
      const packageJsonPath = path.join(cwd, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

        if (packageJson.rakitin && typeof packageJson.rakitin === "object") {
          this._mergeConfig(packageJson.rakitin, "package.json");
        }
      }
    } catch (error) {
      logger.debug("Could not load from package.json:", error.message);
    }
  }

  /**
   * Load configuration from config files
   * @param {string} cwd - Working directory
   */
  _loadFromConfigFiles(cwd) {
    for (const configFile of CONFIG_FILES) {
      const configPath = path.join(cwd, configFile);

      if (fs.existsSync(configPath)) {
        try {
          let config;

          if (configFile.endsWith(".js")) {
            // Clear require cache for config files
            delete require.cache[require.resolve(configPath)];
            config = require(configPath);

            // Handle module.exports default export
            if (config && config.default) {
              config = config.default;
            }

            // If it's a function, call it with the current config
            if (typeof config === "function") {
              config = config(this._config);
            }
          } else {
            config = JSON.parse(fs.readFileSync(configPath, "utf8"));
          }

          if (config && typeof config === "object") {
            this._mergeConfig(config, configFile);
          }
        } catch (error) {
          logger.warn(`Failed to load config from ${configFile}:`, error.message);
        }

        // Stop at first valid config file found
        break;
      }
    }
  }

  /**
   * Get a configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @param {*} defaultValue - Default value if key not found
   * @returns {*}
   */
  get(key, defaultValue = undefined) {
    const keys = key.split(".");
    let value = this._config;

    for (const k of keys) {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * Set a configuration value
   * @param {string} key - Configuration key (supports dot notation)
   * @param {*} value - Value to set
   * @returns {Config}
   */
  set(key, value) {
    const keys = key.split(".");
    let obj = this._config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!obj[k] || typeof obj[k] !== "object") {
        obj[k] = {};
      }
      obj = obj[k];
    }

    obj[keys[keys.length - 1]] = value;
    this._sources.push({ source: "runtime", timestamp: new Date().toISOString() });

    return this;
  }

  /**
   * Check if a configuration key exists
   * @param {string} key - Configuration key
   * @returns {boolean}
   */
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

    // Final check: value should not be null or undefined
    return value !== null && value !== undefined;
  }

  /**
   * Get all configuration as an object
   * @returns {Object}
   */
  toJSON() {
    return { ...this._config };
  }

  /**
   * Get configuration sources
   * @returns {Array}
   */
  getSources() {
    return [...this._sources];
  }

  /**
   * Reload configuration from all sources
   * @param {string} cwd - Working directory
   * @returns {Config}
   */
  reload(cwd = process.cwd()) {
    this._config = { ...DEFAULT_CONFIG };
    this._sources = [];
    this._loaded = false;
    return this.load(cwd);
  }

  /**
   * Reset to default configuration
   * @returns {Config}
   */
  reset() {
    this._config = { ...DEFAULT_CONFIG };
    this._sources = [];
    this._loaded = false;
    return this;
  }

  /**
   * Validate configuration against schema
   * @param {Object} schema - Validation schema
   * @returns {Object} Validation result
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
          errors.push(
            `Invalid type for ${key}: expected ${rules.type}, got ${actualType}`
          );
        }
      }

      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`Invalid value for ${key}: must be one of ${rules.enum.join(", ")}`);
      }

      if (rules.min !== undefined && typeof value === "number" && value < rules.min) {
        errors.push(`Value for ${key} must be at least ${rules.min}`);
      }

      if (rules.max !== undefined && typeof value === "number" && value > rules.max) {
        errors.push(`Value for ${key} must be at most ${rules.max}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create a child config with prefix
   * @param {string} prefix - Key prefix
   * @returns {Config}
   */
  child(prefix) {
    const childConfig = new Config();
    childConfig._config = this.get(prefix, {});
    childConfig._sources = [...this._sources];
    childConfig._loaded = this._loaded;
    return childConfig;
  }
}

// Factory function for creating configs
function createConfig(initialConfig = {}) {
  return new Config(initialConfig);
}

// Load default config
const defaultConfig = new Config();

module.exports = {
  Config,
  createConfig,
  defaultConfig,
  DEFAULT_CONFIG,
  CONFIG_FILES,
};
