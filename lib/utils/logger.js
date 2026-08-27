/**
 * Logger System - Abstraction layer untuk logging dengan multiple levels
 * Support untuk file output, stdout, dan silent mode
 */

/**
 * Log levels dengan prioritas
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4,
};

/**
 * ANSI color codes untuk terminal output
 */
const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

/**
 * Simbol untuk setiap log level
 */
const SYMBOLS = {
  debug: "🔍",
  info: "ℹ️ ",
  warn: "⚠️ ",
  error: "❌",
  success: "✅",
};

/**
 * Default configuration untuk logger
 */
const DEFAULT_CONFIG = {
  level: LOG_LEVELS.INFO,
  enableColors: true,
  enableTimestamp: true,
  enableFileLogging: false,
  logFilePath: "logs/rakitin.log",
  prefix: "[rakitin]",
};

/**
 * Logger class untuk handle semua logging operations
 */
class Logger {
  /**
   * Create a new Logger instance
   * @param {Object} config - Configuration object
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._cache = new Map();
  }

  /**
   * Check if a log level should be outputted
   * @param {number} level - Log level to check
   * @returns {boolean}
   */
  shouldLog(level) {
    return level >= this.config.level;
  }

  /**
   * Format timestamp untuk log
   * @returns {string}
   */
  getTimestamp() {
    if (!this.config.enableTimestamp) return "";
    const now = new Date();
    const timestamp = now.toISOString();
    return `${COLORS.dim}${timestamp}${COLORS.reset}`;
  }

  /**
   * Apply color ke message
   * @param {string} message - Message yang akan diwarnai
   * @param {string} color - Color code
   * @returns {string}
   */
  applyColor(message, color) {
    if (!this.config.enableColors) return message;
    return `${color}${message}${COLORS.reset}`;
  }

  /**
   * Format log message
   * @param {string} level - Level name
   * @param {string} message - Message
   * @param {Object} options - Additional options
   * @returns {string}
   */
  formatMessage(level, message, options = {}) {
    const { prefix = true } = options;
    const prefixStr = prefix ? `${this.config.prefix} ` : "";
    const symbol = SYMBOLS[level] || "";
    const timestamp = this.getTimestamp();

    if (this.config.enableColors) {
      const colorMap = {
        debug: COLORS.dim,
        info: COLORS.cyan,
        warn: COLORS.yellow,
        error: COLORS.red,
        success: COLORS.green,
      };
      const color = colorMap[level] || COLORS.white;
      return `${timestamp} ${this.applyColor(`${symbol} ${prefixStr}${message}`, color)}`;
    }

    return `${timestamp} ${symbol} ${prefixStr}${message}`;
  }

  /**
   * Write to file if file logging is enabled
   * @param {string} message - Message untuk ditulis
   */
  writeToFile(message) {
    if (!this.config.enableFileLogging) return;

    try {
      const fs = require("fs");
      const path = require("path");

      // Ensure log directory exists
      const logDir = path.dirname(this.config.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logEntry = `${new Date().toISOString()} ${message}\n`;
      fs.appendFileSync(this.config.logFilePath, logEntry, "utf8");
    } catch (error) {
      // Silently fail for file logging errors
      console.warn("Failed to write to log file:", error.message);
    }
  }

  /**
   * Debug logging
   * @param {...any} args
   */
  debug(...args) {
    if (!this.shouldLog(LOG_LEVELS.DEBUG)) return;
    const message = this.formatMessage("debug", args.join(" "));
    console.log(message);
    this.writeToFile(`[DEBUG] ${args.join(" ")}`);
  }

  /**
   * Info logging
   * @param {...any} args
   */
  info(...args) {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    const message = this.formatMessage("info", args.join(" "));
    console.log(message);
    this.writeToFile(`[INFO] ${args.join(" ")}`);
  }

  /**
   * Warn logging
   * @param {...any} args
   */
  warn(...args) {
    if (!this.shouldLog(LOG_LEVELS.WARN)) return;
    const message = this.formatMessage("warn", args.join(" "));
    console.warn(message);
    this.writeToFile(`[WARN] ${args.join(" ")}`);
  }

  /**
   * Error logging
   * @param {...any} args
   */
  error(...args) {
    if (!this.shouldLog(LOG_LEVELS.ERROR)) return;
    const message = this.formatMessage("error", args.join(" "));
    console.error(message);
    this.writeToFile(`[ERROR] ${args.join(" ")}`);
  }

  /**
   * Success logging (alias untuk info dengan simbol ✅)
   * @param {...any} args
   */
  success(...args) {
    if (!this.shouldLog(LOG_LEVELS.INFO)) return;
    const message = this.formatMessage("success", args.join(" "));
    console.log(message);
    this.writeToFile(`[SUCCESS] ${args.join(" ")}`);
  }

  /**
   * Create a child logger dengan prefix tambahan
   * @param {string} childPrefix - Prefix untuk child logger
   * @returns {Logger}
   */
  child(childPrefix) {
    return new Logger({
      ...this.config,
      prefix: `${this.config.prefix}${childPrefix}:`,
    });
  }

  /**
   * Set log level
   * @param {string|number} level - Level name or number
   */
  setLevel(level) {
    if (typeof level === "string") {
      this.config.level = LOG_LEVELS[level.toUpperCase()] ?? LOG_LEVELS.INFO;
    } else {
      this.config.level = level;
    }
  }

  /**
   * Enable file logging
   * @param {string} filePath - Path untuk log file
   */
  enableFileLogging(filePath) {
    this.config.enableFileLogging = true;
    this.config.logFilePath = filePath || this.config.logFilePath;
  }

  /**
   * Disable file logging
   */
  disableFileLogging() {
    this.config.enableFileLogging = false;
  }

  /**
   * Enable/disable colors
   * @param {boolean} enabled
   */
  setColors(enabled) {
    this.config.enableColors = enabled;
  }

  /**
   * Enable/disable timestamp
   * @param {boolean} enabled
   */
  setTimestamp(enabled) {
    this.config.enableTimestamp = enabled;
  }

  /**
   * Create a cached logger instance (singleton pattern)
   * @param {string} name - Logger name
   * @param {Object} config - Configuration
   * @returns {Logger}
   */
  static getInstance(name = "default", config = {}) {
    const key = `${name}:${JSON.stringify(config)}`;
    if (!Logger._instances) {
      Logger._instances = new Map();
    }
    if (!Logger._instances.has(key)) {
      Logger._instances.set(key, new Logger(config));
    }
    return Logger._instances.get(key);
  }

  /**
   * Clear all cached instances
   */
  static clearInstances() {
    if (Logger._instances) {
      Logger._instances.clear();
    }
  }
}

// Export singleton instance
const logger = new Logger();

// Export for both CommonJS and ESM compatibility
module.exports = logger;
module.exports.Logger = Logger;
module.exports.LOG_LEVELS = LOG_LEVELS;
module.exports.SYMBOLS = SYMBOLS;
module.exports.COLORS = COLORS;
