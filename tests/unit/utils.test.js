/**
 * Unit tests for lib/utils.js.
 *
 * Disk-based: every path lives inside `global.tempDir` (tests/setup.js) and
 * dry-run assertions go through the real safety layer - no fs mocking.
 */

const fs = require("fs");
const path = require("path");
const utils = require("../../lib/utils");
const safety = require("../../lib/safety");
const naming = require("../../lib/naming");

const { ensureDir, writeFileIfNotExists, relativePosix } = utils;

describe("lib/utils", () => {
  afterEach(() => {
    // Never leave plan mode latched for the next test in the suite.
    safety.resetPlan();
  });

  describe("module surface", () => {
    test("exports only the v3 helpers plus naming re-exports", () => {
      expect(Object.keys(utils).sort()).toEqual(
        [
          "ensureDir",
          "normalizeModuleName",
          "relativePosix",
          "toCamelCase",
          "toConstantCase",
          "toKebabCase",
          "toPascalCase",
          "toSnakeCase",
          "toTitleCase",
          "writeFileIfNotExists",
        ].sort()
      );
    });

    test("the removed v2 path-cache API is gone", () => {
      expect(utils.PathCache).toBeUndefined();
      expect(utils.getCachedModulePath).toBeUndefined();
      expect(utils.clearPathCache).toBeUndefined();
      expect(utils.getPathCacheSize).toBeUndefined();
      expect(utils.ensureBaseStructure).toBeUndefined();
    });

    test("naming re-exports are the very same functions as lib/naming.js", () => {
      expect(utils.toPascalCase).toBe(naming.toPascalCase);
      expect(utils.toCamelCase).toBe(naming.toCamelCase);
      expect(utils.toKebabCase).toBe(naming.toKebabCase);
      expect(utils.toSnakeCase).toBe(naming.toSnakeCase);
      expect(utils.toTitleCase).toBe(naming.toTitleCase);
      expect(utils.toConstantCase).toBe(naming.toConstantCase);
      expect(utils.normalizeModuleName).toBe(naming.normalizeModuleName);
    });
  });

  describe("ensureDir", () => {
    test("creates nested directories recursively", () => {
      const dir = path.join(global.tempDir, "a", "b", "c");

      ensureDir(dir);

      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    });

    test("is a no-op for an existing directory", () => {
      const dir = path.join(global.tempDir, "already");
      fs.mkdirSync(dir, { recursive: true });

      expect(() => ensureDir(dir)).not.toThrow();
    });

    test("in dry-run records {op:'mkdir'} and creates nothing", () => {
      safety.beginPlan();
      const dir = path.join(global.tempDir, "planned", "nested");

      ensureDir(dir);

      expect(safety.isDryRun()).toBe(true);
      expect(fs.existsSync(path.join(global.tempDir, "planned"))).toBe(false);
      expect(safety.getPlan()).toEqual([{ op: "mkdir", path: dir }]);
    });

    test("in dry-run does not record a directory that already exists", () => {
      const dir = path.join(global.tempDir, "existing-planned");
      fs.mkdirSync(dir, { recursive: true });
      safety.beginPlan();

      ensureDir(dir);

      expect(safety.getPlan()).toEqual([]);
    });
  });

  describe("writeFileIfNotExists", () => {
    test("writes once and reports true, then false for the existing file", () => {
      const file = path.join(global.tempDir, "nested", "note.txt");

      expect(writeFileIfNotExists(file, "v1")).toBe(true);
      expect(fs.readFileSync(file, "utf8")).toBe("v1");

      expect(writeFileIfNotExists(file, "v2")).toBe(false);
      expect(fs.readFileSync(file, "utf8")).toBe("v1");
    });

    test("returns true in dry-run but leaves the file absent", () => {
      safety.beginPlan();
      const file = path.join(global.tempDir, "dry", "note.txt");

      expect(writeFileIfNotExists(file, "content")).toBe(true);
      expect(safety.isDryRun()).toBe(true);
      expect(fs.existsSync(file)).toBe(false);
      expect(safety.getPlan()).toEqual([{ op: "create", path: file }]);
    });

    test("returns false in dry-run for a file that already exists", () => {
      const file = path.join(global.tempDir, "dry-existing.txt");
      fs.writeFileSync(file, "keep", "utf8");
      safety.beginPlan();

      expect(writeFileIfNotExists(file, "new")).toBe(false);
      expect(safety.getPlan()).toEqual([]);
      expect(fs.readFileSync(file, "utf8")).toBe("keep");
    });
  });

  describe("relativePosix", () => {
    test("returns a POSIX path relative to the project root", () => {
      const root = path.join(global.tempDir, "proj");

      expect(
        relativePosix(root, path.join(root, "app", "modules", "user", "user.controller.js"))
      ).toBe("app/modules/user/user.controller.js");
      expect(relativePosix(root, root)).toBe("");
    });

    test("resolves relative targets against the root", () => {
      const root = path.join(global.tempDir, "proj2");

      expect(relativePosix(root, path.join("app", "routes", "index.js"))).toBe(
        "app/routes/index.js"
      );
    });
  });
});
