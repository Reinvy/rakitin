const fs = require("fs");
const path = require("path");
const PathResolver = require("../../../lib/generator/shared/path-resolver");

// Mock fs module
jest.mock("fs");

describe("PathResolver", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
  });

  describe("normalizeModuleName", () => {
    test("should convert camelCase to kebab-case", () => {
      expect(PathResolver.normalizeModuleName("userModule")).toBe("user-module");
      expect(PathResolver.normalizeModuleName("myComplexModule")).toBe(
        "my-complex-module"
      );
    });

    test("should convert PascalCase to kebab-case", () => {
      expect(PathResolver.normalizeModuleName("UserModule")).toBe("user-module");
      expect(PathResolver.normalizeModuleName("MyComplexModule")).toBe(
        "my-complex-module"
      );
    });

    test("should convert spaces to hyphens", () => {
      expect(PathResolver.normalizeModuleName("user module")).toBe("user-module");
      expect(PathResolver.normalizeModuleName("my complex module")).toBe(
        "my-complex-module"
      );
    });

    test("should handle mixed cases", () => {
      expect(PathResolver.normalizeModuleName("User Module")).toBe("user-module");
      expect(PathResolver.normalizeModuleName("myComplex Module")).toBe(
        "my-complex-module"
      );
    });

    test("should handle already kebab-case", () => {
      expect(PathResolver.normalizeModuleName("user-module")).toBe("user-module");
      expect(PathResolver.normalizeModuleName("my-complex-module")).toBe(
        "my-complex-module"
      );
    });

    test("should throw error for empty string", () => {
      expect(() => PathResolver.normalizeModuleName("")).toThrow(
        "Nama modul harus berupa string yang tidak kosong"
      );
    });

    test("should throw error for non-string input", () => {
      expect(() => PathResolver.normalizeModuleName(null)).toThrow(
        "Nama modul harus berupa string yang tidak kosong"
      );
      expect(() => PathResolver.normalizeModuleName(undefined)).toThrow(
        "Nama modul harus berupa string yang tidak kosong"
      );
      expect(() => PathResolver.normalizeModuleName(123)).toThrow(
        "Nama modul harus berupa string yang tidak kosong"
      );
      expect(() => PathResolver.normalizeModuleName({})).toThrow(
        "Nama modul harus berupa string yang tidak kosong"
      );
    });
  });

  describe("getModularRouterPath", () => {
    test("should return correct path for modular router", () => {
      const basePath = path.join(global.tempDir, "app");
      const result = PathResolver.getModularRouterPath("userModule", basePath);

      expect(result).toBe(
        path.join(basePath, "modules", "user-module", "routes", "user-module.router.js")
      );
    });

    test("should normalize module name", () => {
      const basePath = path.join(global.tempDir, "app");
      const result = PathResolver.getModularRouterPath("UserModule", basePath);

      expect(result).toBe(
        path.join(basePath, "modules", "user-module", "routes", "user-module.router.js")
      );
    });
  });

  describe("getSimpleControllerPath", () => {
    test("should return correct path for simple controller", () => {
      const basePath = path.join(global.tempDir, "app");
      const result = PathResolver.getSimpleControllerPath("userModule", basePath);

      expect(result).toBe(
        path.join(basePath, "modules", "user-module", "user-module.controller.js")
      );
    });

    test("should normalize module name", () => {
      const basePath = path.join(global.tempDir, "app");
      const result = PathResolver.getSimpleControllerPath("UserModule", basePath);

      expect(result).toBe(
        path.join(basePath, "modules", "user-module", "user-module.controller.js")
      );
    });
  });

  describe("getModularRouterImportPath", () => {
    test("should return correct import path for modular router", () => {
      const result = PathResolver.getModularRouterImportPath("userModule");

      expect(result).toBe("../modules/user-module/routes/user-module.router.js");
    });

    test("should normalize module name", () => {
      const result = PathResolver.getModularRouterImportPath("UserModule");

      expect(result).toBe("../modules/user-module/routes/user-module.router.js");
    });
  });

  describe("getSimpleControllerImportPath", () => {
    test("should return correct import path for simple controller", () => {
      const result = PathResolver.getSimpleControllerImportPath("userModule");

      expect(result).toBe("../modules/user-module/user-module.controller.js");
    });

    test("should normalize module name", () => {
      const result = PathResolver.getSimpleControllerImportPath("UserModule");

      expect(result).toBe("../modules/user-module/user-module.controller.js");
    });
  });

  describe("getModulePath", () => {
    test("should return correct path for module", () => {
      const basePath = path.join(global.tempDir, "app");
      const result = PathResolver.getModulePath("userModule", basePath);

      expect(result).toBe(path.join(basePath, "modules", "user-module"));
    });

    test("should normalize module name", () => {
      const basePath = path.join(global.tempDir, "app");
      const result = PathResolver.getModulePath("UserModule", basePath);

      expect(result).toBe(path.join(basePath, "modules", "user-module"));
    });
  });

  describe("ensureDirectoryExists", () => {
    test("should create directory if it does not exist", () => {
      const filePath = path.join(
        global.tempDir,
        "modules",
        "user-module",
        "routes",
        "user-module.router.js"
      );
      const dir = path.dirname(filePath);

      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);

      PathResolver.ensureDirectoryExists(filePath);

      expect(fs.existsSync).toHaveBeenCalledWith(dir);
      expect(fs.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
    });

    test("should not create directory if it already exists", () => {
      const filePath = path.join(
        global.tempDir,
        "modules",
        "user-module",
        "routes",
        "user-module.router.js"
      );
      const dir = path.dirname(filePath);

      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);

      PathResolver.ensureDirectoryExists(filePath);

      expect(fs.existsSync).toHaveBeenCalledWith(dir);
      expect(fs.mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("isValidPath", () => {
    test("should return true for valid paths", () => {
      expect(PathResolver.isValidPath("/valid/path")).toBe(true);
      expect(PathResolver.isValidPath("relative/path")).toBe(true);
      expect(PathResolver.isValidPath("./current/path")).toBe(true);
      expect(PathResolver.isValidPath("../parent/path")).toBe(true);
    });

    test("should handle invalid paths", () => {
      // It's difficult to create a truly invalid path with path.normalize,
      // but we can check that it doesn't throw errors
      expect(() => PathResolver.isValidPath("some/path")).not.toThrow();
    });
  });
});
