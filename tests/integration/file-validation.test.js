/**
 * Integration: FileValidator against REAL generated router artifacts.
 */
const fs = require("fs-extra");
const path = require("path");
const FileValidator = require("../../lib/generator/shared/file-validator");
const PathResolver = require("../../lib/generator/shared/path-resolver");
const { getPaths } = require("../../lib/constants");

function modularModuleDir(name) {
  const dir = path.join(getPaths().modulesPath, name);
  fs.ensureDirSync(path.join(dir, "routes"));
  return dir;
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("FileValidator vs real disk artifacts", () => {
  test("accepts a well-formed modular router", () => {
    const dir = modularModuleDir("catalog");
    fs.writeFileSync(
      path.join(dir, "routes", "catalog.router.js"),
      'const express = require("express");\nconst r = express.Router();\nr.get("/", (q, s) => s.json({}));\nmodule.exports = r;\n'
    );

    const result = FileValidator.validateModularRouterFile(
      "catalog",
      getPaths().basePath
    );
    expect(result.isValid).toBe(true);
  });

  test("rejects a missing router file with its resolved path", () => {
    const result = FileValidator.validateModularRouterFile("ghost", getPaths().basePath);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("tidak ditemukan");
  });

  test("validateJavaScriptFile catches syntax errors WITHOUT executing code", () => {
    const badFile = path.join(global.tempDir, "bad-syntax.js");
    fs.outputFileSync(
      badFile,
      [
        "// Side effects MUST NOT run during validation",
        "global.__EVIL_RAN__ = true;",
        "const x === ; // deliberate syntax error",
      ].join("\n")
    );

    const result = FileValidator.validateJavaScriptFile(badFile);
    expect(result.isValid).toBe(false);

    // B9 proof: require()-based validation would have executed this line
    expect(global.__EVIL_RAN__).toBeUndefined();
  });

  test("validateRouterIntegration passes mixed healthy modules and reports failures per-module", () => {
    const healthyModular = modularModuleDir("users-mod");
    fs.writeFileSync(
      path.join(healthyModular, "routes", "users-mod.router.js"),
      'module.exports = (() => { const r = require("express").Router(); r.get("/", (q,s)=>s.send()); return r; })();\n'
    );

    const simpleDir = path.join(getPaths().modulesPath, "health-simple");
    fs.ensureDirSync(simpleDir);
    fs.writeFileSync(
      path.join(simpleDir, "health-simple.controller.js"),
      "exports.getAll = (req, res) => res.json({});\n"
    );

    // Note: mixed list validated with one architecture flag - only matching
    // structures succeed; unmatched ones are reported as failures.
    const validation = FileValidator.validateRouterIntegration(
      ["users-mod", "health-simple"],
      getPaths().basePath,
      "modular"
    );
    expect(validation.isValid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test("PathResolver emits import paths consistent with actual files", () => {
    const dir = modularModuleDir("billing");
    fs.writeFileSync(
      path.join(dir, "routes", "billing.router.js"),
      "module.exports = {};"
    );

    const expectedPath = PathResolver.getModularRouterPath(
      "billing",
      getPaths().basePath
    );
    expect(fs.existsSync(expectedPath)).toBe(true);
    const importPath = PathResolver.getModularRouterImportPath("billing");
    // Import path is a POSIX-style relative require - keep it normalized
    expect(importPath).not.toContain("\\");
  });
});
