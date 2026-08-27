/**
 * lib/constants.js - Conventional project paths.
 *
 * IMPORTANT: paths are LAZY. They are resolved against the project root
 * (defaults to process.cwd()) at ACCESS time, never captured at
 * require-time. Use `getPaths(root)` when you need a resolved snapshot
 * for a specific directory (e.g. tests, --cwd flag).
 */

const path = require("path");

/**
 * Resolve all conventional rakitin paths for a project root.
 * @param {string} [root] Project root directory (default: process.cwd()).
 * @returns {object} Snapshot of paths.
 */
function getPaths(root = process.cwd()) {
  const basePath = path.join(root, "app");
  return {
    root,
    basePath,
    modulesPath: path.join(basePath, "modules"),
    sharedPath: path.join(basePath, "shared"),
    prismaPath: path.join(root, "prisma", "models"),
    typeormEntitiesPath: path.join(basePath, "modules"),
    mongooseModelsPath: path.join(basePath, "modules"),
    appRoutesPath: path.join(basePath, "routes"),
    rootRoutesPath: path.join(root, "routes"),
    validatorsPath: path.join(basePath, "shared", "validators"),
    docsPath: path.join(basePath, "docs"),
  };
}

module.exports = {
  /** Factory for a resolved path snapshot of an arbitrary root. */
  getPaths,

  // Lazy, always-current views on the default root (process.cwd()).
  get basePath() {
    return getPaths().basePath;
  },
  get modulesPath() {
    return getPaths().modulesPath;
  },
  get sharedPath() {
    return getPaths().sharedPath;
  },
  get prismaPath() {
    return getPaths().prismaPath;
  },
  get typeormEntitiesPath() {
    return getPaths().typeormEntitiesPath;
  },
  get mongooseModelsPath() {
    return getPaths().mongooseModelsPath;
  },
  get appRoutesPath() {
    return getPaths().appRoutesPath;
  },
  get rootRoutesPath() {
    return getPaths().rootRoutesPath;
  },
  get validatorsPath() {
    return getPaths().validatorsPath;
  },
  get docsPath() {
    return getPaths().docsPath;
  },
};
