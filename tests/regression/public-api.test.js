/**
 * tests/regression/public-api.test.js
 *
 * Guards the published library surface: the runtime export names of every
 * `exports` subpath must equal a hardcoded expected list, and every name must
 * appear in `types/index.d.ts` (which is the `types` entry for all of them).
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const TYPES_SOURCE = fs.readFileSync(path.join(REPO_ROOT, "types/index.d.ts"), "utf8");

/** subpath -> { file, names } where `names` is the exact runtime surface. */
const SURFACE = {
  ".": {
    file: "lib/index.js",
    names: [
      "version",
      "bareSummary",
      "config",
      "naming",
      "safety",
      "project",
      "commands",
      "deps",
      "plugins",
    ],
  },
  "./config": {
    file: "lib/config/index.js",
    names: ["Config", "createConfig", "DEFAULT_CONFIG", "CONFIG_FILES", "CONFIG_KEYS", "PRESETS"],
  },
  "./naming": {
    file: "lib/naming.js",
    names: [
      "toPascalCase",
      "toCamelCase",
      "toKebabCase",
      "toSnakeCase",
      "toTitleCase",
      "toConstantCase",
      "normalizeModuleName",
      "getModuleVariants",
      "toIdentifier",
      "toSafeFileName",
      "assertSafeName",
      "sanitizeFieldName",
      "toFieldIdentifier",
      "RESERVED_WORDS",
      "clearNamingCaches",
    ],
  },
  "./safety": {
    file: "lib/safety.js",
    names: [
      "runtime",
      "setDryRun",
      "isDryRun",
      "setOverwrite",
      "isOverwrite",
      "beginPlan",
      "resetPlan",
      "getPlan",
      "backupPathFor",
      "writeFileIfNotExistsSafe",
      "overwriteWithBackup",
      "writeOutcome",
      "updateJsonFile",
      "mergeEnvExample",
      "buildMarkedBlock",
      "buildRoutesContent",
      "ROUTES_BLOCK_START",
      "ROUTES_BLOCK_END",
      "RESOURCE_BLOCK_START",
      "RESOURCE_BLOCK_END",
      "GRAPHQL_BLOCK_START",
      "GRAPHQL_BLOCK_END",
      "WS_BLOCK_START",
      "WS_BLOCK_END",
      "MAIN_ROUTER_HEADER",
    ],
  },
  "./utils": {
    file: "lib/utils/index.js",
    names: [
      "ensureDir",
      "writeFileIfNotExists",
      "relativePosix",
      "toPascalCase",
      "toCamelCase",
      "toKebabCase",
      "toSnakeCase",
      "toTitleCase",
      "toConstantCase",
      "normalizeModuleName",
    ],
  },
  "./ui": {
    file: "lib/ui/index.js",
    names: [
      "Spinner",
      "ProgressBar",
      "StepProgress",
      "createSpinner",
      "createProgressBar",
      "createStepProgress",
      "SPINNER_FRAMES",
      "CHECKMARK",
      "CROSS",
      "ARROW",
      "COLORS",
    ],
  },
  "./template": {
    file: "lib/template/index.js",
    names: ["TemplateEngine", "renderTemplate", "defaultEngine"],
  },
  "./template/engine": {
    file: "lib/template/engine.js",
    names: ["TemplateEngine", "renderTemplate", "defaultEngine"],
  },
  "./ui/progress": {
    file: "lib/ui/progress.js",
    names: [
      "Spinner",
      "ProgressBar",
      "StepProgress",
      "createSpinner",
      "createProgressBar",
      "createStepProgress",
      "SPINNER_FRAMES",
      "CHECKMARK",
      "CROSS",
      "ARROW",
      "COLORS",
    ],
  },
};

const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));

/** The logger subpath exports a Logger INSTANCE - asserted separately. */
const LOGGER_SUBPATH = "./utils/logger";

describe("published export map", () => {
  test("every declared subpath resolves to a file that exists", () => {
    for (const [subpath, target] of Object.entries(packageJson.exports)) {
      expect(target.default).toBeDefined();
      expect(target.types).toBe("./types/index.d.ts");
      expect(fs.existsSync(path.join(REPO_ROOT, target.default))).toBe(true);
      if (subpath === LOGGER_SUBPATH) continue;
      if (!SURFACE[subpath]) {
        throw new Error(`no surface expectation for ${subpath}`);
      }
    }
    expect(Object.keys(packageJson.exports).sort()).toEqual(
      [...Object.keys(SURFACE), LOGGER_SUBPATH].sort()
    );
  });

  for (const [subpath, entry] of Object.entries(SURFACE)) {
    test(`${subpath} exports exactly the documented names`, () => {
      const runtime = require(path.join(REPO_ROOT, entry.file));
      expect(Object.keys(runtime).sort()).toEqual([...entry.names].sort());
    });
  }

  test("rakitin/utils/logger exposes the logger instance + statics", () => {
    const logger = require(path.join(REPO_ROOT, "lib/utils/logger.js"));
    for (const name of ["Logger", "LOG_LEVELS", "SYMBOLS", "COLORS"]) {
      expect(Object.keys(logger)).toContain(name);
    }
    for (const method of ["debug", "info", "warn", "error", "success", "child", "setLevel"]) {
      expect(typeof logger[method]).toBe("function");
      expect(TYPES_SOURCE).toContain(method);
    }
  });

  test("every exported name is declared in types/index.d.ts", () => {
    const missing = [];
    for (const entry of Object.values(SURFACE)) {
      for (const name of entry.names) {
        if (!new RegExp(`\\b${name}\\b`).test(TYPES_SOURCE)) missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });

  test("types/index.d.ts does not redeclare removed modules", () => {
    for (const gone of ["PathResolver", "FileValidator", "ErrorHandler"]) {
      expect(new RegExp(`\\b${gone}\\b`).test(TYPES_SOURCE)).toBe(false);
    }
  });

  test("package metadata matches the v3 contract", () => {
    expect(packageJson.main).toBe("lib/index.js");
    expect(packageJson.types).toBe("types/index.d.ts");
    expect(packageJson.engines.node).toBe("^22.13.0 || >=23.5.0");
    expect(Object.keys(packageJson.dependencies).sort()).toEqual([
      "ejs",
      "inquirer",
      "yargs",
    ]);
    for (const script of ["build", "build:cjs", "build:esm", "build:clean", "postinstall"]) {
      expect(packageJson.scripts[script]).toBeUndefined();
    }
    expect(fs.existsSync(path.join(REPO_ROOT, "dist"))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, "index.js"))).toBe(false);
  });
});
