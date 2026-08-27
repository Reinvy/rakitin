/**
 * Unit tests for Logger System
 */

const { Logger, LOG_LEVELS, SYMBOLS, COLORS } = require("../../lib/utils/logger");

describe("Logger", () => {
  let logger;

  beforeEach(() => {
    // Create a fresh logger instance for each test
    logger = new Logger({ level: LOG_LEVELS.DEBUG, enableColors: false });
  });

  afterEach(() => {
    // Clear any instances
    Logger.clearInstances();
  });

  describe("constructor", () => {
    it("should create logger with default config", () => {
      const defaultLogger = new Logger();
      expect(defaultLogger.config.level).toBe(LOG_LEVELS.INFO);
      expect(defaultLogger.config.enableColors).toBe(true);
      expect(defaultLogger.config.prefix).toBe("[rakitin]");
    });

    it("should merge custom config with defaults", () => {
      const customLogger = new Logger({ level: LOG_LEVELS.ERROR, prefix: "[custom]" });
      expect(customLogger.config.level).toBe(LOG_LEVELS.ERROR);
      expect(customLogger.config.prefix).toBe("[custom]");
      expect(customLogger.config.enableColors).toBe(true); // default
    });
  });

  describe("shouldLog", () => {
    it("should return true when level is >= configured level", () => {
      logger.setLevel(LOG_LEVELS.INFO);
      expect(logger.shouldLog(LOG_LEVELS.DEBUG)).toBe(false);
      expect(logger.shouldLog(LOG_LEVELS.INFO)).toBe(true);
      expect(logger.shouldLog(LOG_LEVELS.WARN)).toBe(true);
      expect(logger.shouldLog(LOG_LEVELS.ERROR)).toBe(true);
    });

    it("should return false for SILENT level", () => {
      logger.setLevel(LOG_LEVELS.SILENT);
      expect(logger.shouldLog(LOG_LEVELS.DEBUG)).toBe(false);
      expect(logger.shouldLog(LOG_LEVELS.ERROR)).toBe(false);
    });
  });

  describe("setLevel", () => {
    it("should set level by string", () => {
      logger.setLevel("debug");
      expect(logger.config.level).toBe(LOG_LEVELS.DEBUG);
    });

    it("should set level by number", () => {
      logger.setLevel(2);
      expect(logger.config.level).toBe(2);
    });

    it("should default to INFO for unknown strings", () => {
      logger.setLevel("unknown");
      expect(logger.config.level).toBe(LOG_LEVELS.INFO);
    });
  });

  describe("child logger", () => {
    it("should create child logger with extended prefix", () => {
      const child = logger.child("module");
      expect(child.config.prefix).toBe("[rakitin]module:");
    });

    it("should create nested child logger", () => {
      const child1 = logger.child("module");
      const child2 = child1.child("submodule");
      expect(child2.config.prefix).toBe("[rakitin]module:submodule:");
    });

    it("should inherit parent config", () => {
      logger.setColors(false);
      const child = logger.child("module");
      expect(child.config.enableColors).toBe(false);
    });
  });

  describe("getInstance (singleton)", () => {
    it("should return same instance for same name", () => {
      const instance1 = Logger.getInstance("test");
      const instance2 = Logger.getInstance("test");
      expect(instance1).toBe(instance2);
    });

    it("should return different instances for different names", () => {
      const instance1 = Logger.getInstance("test1");
      const instance2 = Logger.getInstance("test2");
      expect(instance1).not.toBe(instance2);
    });
  });

  describe("constants", () => {
    it("should have correct LOG_LEVELS", () => {
      expect(LOG_LEVELS.DEBUG).toBe(0);
      expect(LOG_LEVELS.INFO).toBe(1);
      expect(LOG_LEVELS.WARN).toBe(2);
      expect(LOG_LEVELS.ERROR).toBe(3);
      expect(LOG_LEVELS.SILENT).toBe(4);
    });

    it("should have SYMBOLS for all levels", () => {
      expect(SYMBOLS.debug).toBeDefined();
      expect(SYMBOLS.info).toBeDefined();
      expect(SYMBOLS.warn).toBeDefined();
      expect(SYMBOLS.error).toBeDefined();
      expect(SYMBOLS.success).toBeDefined();
    });

    it("should have COLORS defined", () => {
      expect(COLORS.reset).toBeDefined();
      expect(COLORS.red).toBeDefined();
      expect(COLORS.green).toBeDefined();
    });
  });
});

describe("Logger (module export)", () => {
  it("should export Logger class", () => {
    expect(Logger).toBeDefined();
    expect(typeof Logger).toBe("function");
  });

  it("should export LOG_LEVELS constant", () => {
    expect(LOG_LEVELS).toBeDefined();
    expect(typeof LOG_LEVELS).toBe("object");
  });
});
