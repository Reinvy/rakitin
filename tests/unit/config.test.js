/**
 * Unit tests for Configuration System
 */

const {
  Config,
  createConfig,
  DEFAULT_CONFIG,
  CONFIG_FILES,
} = require("../../lib/config");

describe("Config", () => {
  let config;

  beforeEach(() => {
    config = new Config();
  });

  describe("constructor", () => {
    it("should create config with default values", () => {
      expect(config.get("defaultArchitecture")).toBe("modular");
      expect(config.get("defaultORM")).toBe("Prisma");
    });

    it("should merge initial config", () => {
      const customConfig = new Config({ defaultArchitecture: "simple" });
      expect(customConfig.get("defaultArchitecture")).toBe("simple");
    });
  });

  describe("get", () => {
    it("should get top-level config value", () => {
      expect(config.get("basePath")).toBe("app");
    });

    it("should get nested config value using dot notation", () => {
      expect(config.get("ormPackages.prisma")).toEqual(["@prisma/client", "prisma"]);
    });

    it("should return default value for missing keys", () => {
      expect(config.get("nonexistent", "default")).toBe("default");
    });

    it("should return undefined for missing keys without default", () => {
      expect(config.get("nonexistent")).toBeUndefined();
    });
  });

  describe("set", () => {
    it("should set top-level config value", () => {
      config.set("newKey", "newValue");
      expect(config.get("newKey")).toBe("newValue");
    });

    it("should set nested config value using dot notation", () => {
      config.set("custom.nested.value", "test");
      expect(config.get("custom.nested.value")).toBe("test");
    });

    it("should create intermediate objects for nested keys", () => {
      config.set("deep.nested.key", "value");
      expect(config.get("deep")).toBeDefined();
      expect(config.get("deep").nested).toBeDefined();
    });

    it("should return this for chaining", () => {
      const result = config.set("key", "value");
      expect(result).toBe(config);
    });
  });

  describe("has", () => {
    it("should return true for existing keys", () => {
      expect(config.has("basePath")).toBe(true);
      expect(config.has("ormPackages")).toBe(true);
    });

    it("should return true for existing nested keys", () => {
      expect(config.has("ormPackages.prisma")).toBe(true);
    });

    it("should return false for non-existing keys", () => {
      expect(config.has("nonexistent")).toBe(false);
    });

    it("should return false for null/undefined values", () => {
      config.set("nullValue", null);
      config.set("undefinedValue", undefined);
      expect(config.has("nullValue")).toBe(false);
      expect(config.has("undefinedValue")).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should return config as JSON object", () => {
      const json = config.toJSON();
      expect(json).toBeDefined();
      expect(json.basePath).toBe("app");
      expect(json.defaultArchitecture).toBe("modular");
    });

    it("should return a copy, not the original", () => {
      const json = config.toJSON();
      json.newKey = "newValue";
      expect(config.get("newKey")).toBeUndefined();
    });
  });

  describe("getSources", () => {
    it("should return empty array for fresh config", () => {
      expect(config.getSources()).toEqual([]);
    });

    it("should track sources after set operations", () => {
      config.set("key", "value");
      const sources = config.getSources();
      expect(sources.length).toBeGreaterThan(0);
      expect(sources[sources.length - 1].source).toBe("runtime");
    });
  });

  describe("load", () => {
    it("should return this for chaining", () => {
      const freshConfig = new Config();
      const result = freshConfig.load(__dirname);
      expect(result).toBe(freshConfig);
    });

    it("should set loaded flag", () => {
      const freshConfig = new Config();
      freshConfig.load(__dirname);
      expect(freshConfig._loaded).toBe(true);
    });

    it("should warn when reloading already loaded config", () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
      const freshConfig = new Config();
      freshConfig.load(__dirname);
      freshConfig.load(__dirname);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("reload", () => {
    it("should reset and reload config", () => {
      const freshConfig = new Config();
      freshConfig.set("test", "value");
      freshConfig.reload(__dirname);
      expect(freshConfig._loaded).toBe(true);
      // reload loads from package.json, so defaultArchitecture may be overwritten
    });
  });

  describe("reset", () => {
    it("should reset to default configuration", () => {
      config.set("custom", "value");
      config.reset();
      expect(config.get("custom")).toBeUndefined();
      expect(config.get("basePath")).toBe("app");
    });

    it("should clear sources", () => {
      config.set("key", "value");
      config.reset();
      expect(config.getSources()).toEqual([]);
    });
  });

  describe("validate", () => {
    it("should return valid for correct schema", () => {
      const schema = {
        basePath: { required: true, type: "string" },
        generateServiceLayer: { required: false, type: "boolean" },
      };

      const result = config.validate(schema);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should catch missing required fields", () => {
      const schema = {
        requiredField: { required: true },
      };

      const result = config.validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Missing required config: requiredField");
    });

    it("should catch type mismatches", () => {
      const schema = {
        basePath: { type: "number" },
      };

      const result = config.validate(schema);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("Invalid type");
    });

    it("should catch invalid enum values", () => {
      const testConfig = new Config();
      const schema = {
        customEnum: { enum: ["value1", "value2"] },
      };

      testConfig.set("customEnum", "value1");
      const result = testConfig.validate(schema);
      expect(result.valid).toBe(true);

      testConfig.set("customEnum", "Invalid");
      const invalidResult = testConfig.validate(schema);
      expect(invalidResult.valid).toBe(false);
    });

    it("should catch out of range numbers", () => {
      const testConfig = new Config();
      const schema = {
        port: { type: "number", min: 1, max: 65535 },
      };

      testConfig.set("port", 0);
      let result = testConfig.validate(schema);
      expect(result.valid).toBe(false);

      testConfig.set("port", 70000);
      result = testConfig.validate(schema);
      expect(result.valid).toBe(false);

      testConfig.set("port", 3000);
      result = testConfig.validate(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("child", () => {
    it("should create child config with prefixed values", () => {
      config.set("parent.child", "value");
      const child = config.child("parent");
      expect(child.get("child")).toBe("value");
    });

    it("should share sources with parent", () => {
      const child = config.child("parent");
      expect(child.getSources()).toEqual(config.getSources());
    });
  });
});

describe("createConfig", () => {
  it("should create new Config instance", () => {
    const cfg = createConfig();
    expect(cfg).toBeInstanceOf(Config);
  });

  it("should pass initial config to constructor", () => {
    const cfg = createConfig({ custom: "value" });
    expect(cfg.get("custom")).toBe("value");
  });
});

describe("DEFAULT_CONFIG", () => {
  it("should have all expected keys", () => {
    expect(DEFAULT_CONFIG.basePath).toBeDefined();
    expect(DEFAULT_CONFIG.modulesPath).toBeDefined();
    expect(DEFAULT_CONFIG.defaultArchitecture).toBeDefined();
    expect(DEFAULT_CONFIG.ormPackages).toBeDefined();
  });

  it("should have valid ORM packages", () => {
    expect(DEFAULT_CONFIG.ormPackages.prisma).toEqual(["@prisma/client", "prisma"]);
    expect(DEFAULT_CONFIG.ormPackages.sequelize).toBeDefined();
    expect(DEFAULT_CONFIG.ormPackages.mongoose).toBeDefined();
    expect(DEFAULT_CONFIG.ormPackages.typeorm).toBeDefined();
  });
});

describe("CONFIG_FILES", () => {
  it("should list all expected config file names", () => {
    expect(CONFIG_FILES).toContain(".rakitinrc");
    expect(CONFIG_FILES).toContain(".rakitinrc.json");
    expect(CONFIG_FILES).toContain("rakitin.config.js");
    expect(CONFIG_FILES).toContain("rakitin.config.json");
  });
});
