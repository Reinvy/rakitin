/**
 * lib/project/detector.js - Inspect an existing project so every
 * generator can integrate instead of overwrite ("detect-first" principle).
 */

const fs = require("fs");
const path = require("path");
const { getPaths } = require("../constants");
const { getPackageManager } = require("../installer");

/** Fields of a dependency we care about (dependency-less detection). */
function readPackageJson(root) {
  const pkgPath = path.join(root, "package.json");
  try {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  } catch {
    return null;
  }
}

function listDependencies(pkg) {
  if (!pkg) return {};
  return { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
}

function normalizeModuleName(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

function detectModuleArchitecture(moduleDir, kebabName) {
  if (fs.existsSync(path.join(moduleDir, "routes", `${kebabName}.router.js`))) {
    return "modular";
  }
  if (fs.existsSync(path.join(moduleDir, `${kebabName}.controller.js`))) {
    return "simple";
  }
  return null;
}

/**
 * Build a full picture of the target project.
 * @param {string} [root] Defaults to process.cwd().
 * @returns {object} Structural summary used by commands & flags.
 */
function detectProject(root = process.cwd()) {
  const pkg = readPackageJson(root);
  const deps = listDependencies(pkg);
  const paths = getPaths(root);

  // --- Framework & infrastructure -------------------------------------
  const hasExpress = Boolean(deps.express);
  const ormsInstalled = {
    Prisma: Boolean(deps.prisma || deps["@prisma/client"]),
    Sequelize: Boolean(deps.sequelize),
    Mongoose: Boolean(deps.mongoose),
    TypeORM: Boolean(deps.typeorm),
  };

  // --- Conventional structure ------------------------------------------
  const modulesDirExists = fs.existsSync(paths.modulesPath);
  let modules = [];
  if (modulesDirExists) {
    modules = fs
      .readdirSync(paths.modulesPath)
      .filter((entry) => {
        const full = path.join(paths.modulesPath, entry);
        return (
          fs.statSync(full).isDirectory() && !entry.startsWith(".")
        );
      })
      .map((dirName) => {
        const kebab = normalizeModuleName(dirName);
        return {
          dirName,
          name: kebab,
          architecture: detectModuleArchitecture(
            path.join(paths.modulesPath, dirName),
            kebab
          ),
        };
      });
  }

  // Existing router?
  const mainRouterPath = path.join(paths.appRoutesPath, "index.js");
  const hasMainRouter = fs.existsSync(mainRouterPath);
  let routerHasMarkers = false;
  if (hasMainRouter) {
    const src = fs.readFileSync(mainRouterPath, "utf8");
    routerHasMarkers =
      src.includes("/* rakitin:routes:start */") &&
      src.includes("/* rakitin:routes:end */");
  }

  // Shared middleware inventory (what global middleware actually exists)
  const middlewaresDir = path.join(paths.sharedPath, "middlewares");
  const availableMiddlewares = fs.existsSync(middlewaresDir)
    ? fs
        .readdirSync(middlewaresDir)
        .filter((f) => f.endsWith(".middleware.js"))
        .map((f) => f.replace(".middleware.js", ""))
    : [];

  // --- Configuration ----------------------------------------------------
  const configCandidates = [
    ".rakitinrc.json",
    ".rakitinrc",
    "rakitin.config.json",
  ];
  const configFile = configCandidates.find((c) =>
    fs.existsSync(path.join(root, c))
  );

  return {
    root,
    detectedAt: new Date().toISOString(),
    isNpmProject: Boolean(pkg),
    packageName: pkg?.name || null,
    nodeEngine: pkg?.engines?.node || null,
    hasExpress,
    expressVersion: deps.express || null,
    packageManager: pkg ? getPackageManager() : null,
    dependencies: deps,
    ormsInstalled,

    structure: {
      hasAppBase: fs.existsSync(paths.basePath),
      modulesDirExists,
      modules,
      modularCount: modules.filter((m) => m.architecture === "modular").length,
      simpleCount: modules.filter((m) => m.architecture === "simple").length,
      mixedArchitectures:
        modules.filter((m) => m.architecture === "modular").length > 0 &&
        modules.filter((m) => m.architecture === "simple").length > 0,
      hasMainRouter,
      routerPath: mainRouterPath,
      routerHasMarkers,
      availableMiddlewares,
    },

    config: {
      file: configFile ? path.join(root, configFile) : null,
      preset: (() => {
        if (!configFile) return null;
        try {
          return JSON.parse(
            fs.readFileSync(path.join(root, configFile), "utf8")
          ).preset;
        } catch {
          return undefined;
        }
      })(),
    },
  };
}

module.exports = { detectProject, readPackageJson };
