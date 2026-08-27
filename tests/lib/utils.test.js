const fs = require("fs-extra");
const path = require("path");
const utils = require("../../lib/utils");
const { getPaths } = require("../../lib/constants");

describe("Utils", () => {
  describe("ensureDir", () => {
    test("should create directory if it does not exist", async () => {
      const testDir = path.join(global.tempDir, "test-dir");

      // Ensure directory doesn't exist
      if (fs.existsSync(testDir)) {
        await fs.remove(testDir);
      }

      utils.ensureDir(testDir);

      expect(fs.existsSync(testDir)).toBe(true);

      // Cleanup
      await fs.remove(testDir);
    });

    test("should not throw error if directory already exists", () => {
      const testDir = global.tempDir;

      expect(() => {
        utils.ensureDir(testDir);
      }).not.toThrow();
    });
  });

  describe("writeFileIfNotExists", () => {
    test("should write file if it does not exist", async () => {
      const testFile = path.join(global.tempDir, "test-file.js");
      const content = "test content";

      // Ensure file doesn't exist
      if (fs.existsSync(testFile)) {
        await fs.remove(testFile);
      }

      utils.writeFileIfNotExists(testFile, content);

      expect(fs.existsSync(testFile)).toBe(true);
      expect(await fs.readFile(testFile, "utf8")).toBe(content);

      // Cleanup
      await fs.remove(testFile);
    });

    test("should not overwrite file if it already exists", async () => {
      const testFile = path.join(global.tempDir, "test-file-existing.js");
      const originalContent = "original content";
      const newContent = "new content";

      // Create file with original content
      await fs.outputFile(testFile, originalContent);

      utils.writeFileIfNotExists(testFile, newContent);

      expect(fs.existsSync(testFile)).toBe(true);
      expect(await fs.readFile(testFile, "utf8")).toBe(originalContent);

      // Cleanup
      await fs.remove(testFile);
    });
  });

  describe("ensureBaseStructure", () => {
    test("should create base directory structure", () => {
      utils.ensureBaseStructure();

      // Read paths lazily AFTER cwd is switched to the temp dir
      const { basePath, modulesPath, sharedPath } = getPaths();
      expect(fs.existsSync(path.join(basePath, "app.js"))).toBe(true);
      expect(fs.existsSync(path.join(basePath, "server.js"))).toBe(true);
      expect(fs.existsSync(modulesPath)).toBe(true);
      expect(fs.existsSync(sharedPath)).toBe(true);
      expect(fs.existsSync(path.join(sharedPath, "middlewares"))).toBe(true);
      expect(fs.existsSync(path.join(sharedPath, "config"))).toBe(true);
      expect(fs.existsSync(path.join(sharedPath, "utils"))).toBe(true);
      expect(fs.existsSync(path.join(sharedPath, "interfaces"))).toBe(true);
    });
  });

  describe("toPascalCase", () => {
    test("should convert string to PascalCase", () => {
      expect(utils.toPascalCase("hello world")).toBe("HelloWorld");
      expect(utils.toPascalCase("hello-world")).toBe("HelloWorld");
      expect(utils.toPascalCase("hello_world")).toBe("HelloWorld");
      expect(utils.toPascalCase("helloWorld")).toBe("HelloWorld");
      expect(utils.toPascalCase("HelloWorld")).toBe("HelloWorld");
    });

    test("should handle edge cases", () => {
      expect(utils.toPascalCase("")).toBe("");
      expect(utils.toPascalCase("a")).toBe("A");
      expect(utils.toPascalCase("A")).toBe("A");
      expect(utils.toPascalCase(null)).toBe("");
      expect(utils.toPascalCase(undefined)).toBe("");
      expect(utils.toPascalCase(123)).toBe("");
    });
  });

  describe("toKebabCase", () => {
    test("should convert string to kebab-case", () => {
      expect(utils.toKebabCase("hello world")).toBe("hello-world");
      expect(utils.toKebabCase("helloWorld")).toBe("hello-world");
      expect(utils.toKebabCase("HelloWorld")).toBe("hello-world");
      expect(utils.toKebabCase("hello_world")).toBe("hello-world");
      expect(utils.toKebabCase("hello-world")).toBe("hello-world");
    });

    test("should handle edge cases", () => {
      expect(utils.toKebabCase("")).toBe("");
      expect(utils.toKebabCase("a")).toBe("a");
      expect(utils.toKebabCase("A")).toBe("a");
      expect(utils.toKebabCase(null)).toBe("");
      expect(utils.toKebabCase(undefined)).toBe("");
      expect(utils.toKebabCase(123)).toBe("");
    });
  });

  describe("toCamelCase", () => {
    test("should convert string to camelCase", () => {
      expect(utils.toCamelCase("hello world")).toBe("helloWorld");
      expect(utils.toCamelCase("hello-world")).toBe("helloWorld");
      expect(utils.toCamelCase("hello_world")).toBe("helloWorld");
      expect(utils.toCamelCase("HelloWorld")).toBe("helloWorld");
    });

    test("should handle edge cases", () => {
      expect(utils.toCamelCase("")).toBe("");
      expect(utils.toCamelCase("a")).toBe("a");
      expect(utils.toCamelCase("A")).toBe("a");
      expect(utils.toCamelCase(null)).toBe("");
      expect(utils.toCamelCase(undefined)).toBe("");
      expect(utils.toCamelCase(123)).toBe("");
    });
  });

  describe("toSnakeCase", () => {
    test("should convert string to snake_case", () => {
      expect(utils.toSnakeCase("hello world")).toBe("hello_world");
      expect(utils.toSnakeCase("helloWorld")).toBe("hello_world");
      expect(utils.toSnakeCase("HelloWorld")).toBe("hello_world");
      expect(utils.toSnakeCase("hello-world")).toBe("hello_world");
      expect(utils.toSnakeCase("hello_world")).toBe("hello_world");
    });

    test("should handle edge cases", () => {
      expect(utils.toSnakeCase("")).toBe("");
      expect(utils.toSnakeCase("a")).toBe("a");
      expect(utils.toSnakeCase("A")).toBe("a");
      expect(utils.toSnakeCase(null)).toBe("");
      expect(utils.toSnakeCase(undefined)).toBe("");
      expect(utils.toSnakeCase(123)).toBe("");
    });
  });

  describe("toTitleCase", () => {
    test("should convert string to Title Case", () => {
      expect(utils.toTitleCase("hello world")).toBe("Hello World");
      expect(utils.toTitleCase("hello-world")).toBe("Hello World");
      expect(utils.toTitleCase("hello_world")).toBe("Hello World");
      expect(utils.toTitleCase("helloWorld")).toBe("Helloworld");
    });

    test("should handle edge cases", () => {
      expect(utils.toTitleCase("")).toBe("");
      expect(utils.toTitleCase("a")).toBe("A");
      expect(utils.toTitleCase("A")).toBe("A");
      expect(utils.toTitleCase(null)).toBe("");
      expect(utils.toTitleCase(undefined)).toBe("");
      expect(utils.toTitleCase(123)).toBe("");
    });
  });

  describe("toConstantCase", () => {
    test("should convert string to CONSTANT_CASE", () => {
      expect(utils.toConstantCase("hello world")).toBe("HELLO_WORLD");
      expect(utils.toConstantCase("helloWorld")).toBe("HELLO_WORLD");
      expect(utils.toConstantCase("HelloWorld")).toBe("HELLO_WORLD");
      expect(utils.toConstantCase("hello-world")).toBe("HELLO_WORLD");
      expect(utils.toConstantCase("hello_world")).toBe("HELLO_WORLD");
    });

    test("should handle edge cases", () => {
      expect(utils.toConstantCase("")).toBe("");
      expect(utils.toConstantCase("a")).toBe("A");
      expect(utils.toConstantCase("A")).toBe("A");
      expect(utils.toConstantCase(null)).toBe("");
      expect(utils.toConstantCase(undefined)).toBe("");
      expect(utils.toConstantCase(123)).toBe("");
    });
  });
});
