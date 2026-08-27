/**
 * lib/utils.js - Core file/directory utilities.
 *
 * Naming conventions live in lib/naming.js (single source of truth);
 * they are re-exported here for backward compatibility.
 */

const fs = require("fs");
const path = require("path");
const { getPaths } = require("./constants");

// Re-export canonical naming utilities (do not redefine them).
const {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
  normalizeModuleName,
} = require("./naming");

// ============================================================================
// PATH CACHE IMPLEMENTATION
// ============================================================================

class PathCache {
  constructor(maxSize = 100) {
    this._cache = new Map();
    this._maxSize = maxSize;
  }

  get(key) {
    return this._cache.get(key);
  }

  set(key, value) {
    if (this._cache.size >= this._maxSize) {
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
  }

  has(key) {
    return this._cache.has(key);
  }

  clear() {
    this._cache.clear();
  }

  get size() {
    return this._cache.size;
  }
}

const pathCache = new PathCache();

// ============================================================================
// DIRECTORY & FILE UTILITIES
// ============================================================================

/**
 * Ensure a directory exists (recursively creating parents when needed).
 * @param {string} dir
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Write content to a file only when the file does not already exist.
 * @param {string} filePath
 * @param {string} [content]
 */
function writeFileIfNotExists(filePath, content = "") {
  if (!fs.existsSync(filePath)) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  }
  return false;
}

/**
 * Ensure the conventional base structure (app/, app/modules/, app/shared/…)
 * exists under `root` (defaults to the current project root).
 * @param {string} [root]
 */
function ensureBaseStructure(root) {
  const p = getPaths(root);
  [p.modulesPath, p.sharedPath].forEach(ensureDir);
  ["middlewares", "config", "utils", "interfaces"].forEach((sub) =>
    ensureDir(path.join(p.sharedPath, sub))
  );
  writeFileIfNotExists(path.join(p.basePath, "app.js"), `// Express app init`);
  writeFileIfNotExists(path.join(p.basePath, "server.js"), `// App entry point`);
}

// ============================================================================
// PATH RESOLUTION UTILITIES (cached)
// ============================================================================

/**
 * Get cached conventional path for a module.
 * @param {string} moduleName
 * @param {string} basePath
 * @param {"router"|"controller"|"service"|"model"|"moduleDir"} type
 * @returns {string}
 */
function getCachedModulePath(moduleName, basePath, type) {
  const normalizedName = normalizeModuleName(moduleName);
  const cacheKey = `path:${normalizedName}:${type}:${basePath}`;

  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey);
  }

  let result;
  switch (type) {
    case "router":
      result = path.join(basePath, "modules", normalizedName, "routes", `${normalizedName}.router.js`);
      break;
    case "controller":
      result = path.join(basePath, "modules", normalizedName, "controllers", `${normalizedName}.controller.js`);
      break;
    case "service":
      result = path.join(basePath, "modules", normalizedName, "services", `${normalizedName}.service.js`);
      break;
    case "model":
      result = path.join(basePath, "modules", normalizedName, "models", `${normalizedName}.model.js`);
      break;
    case "moduleDir":
      result = path.join(basePath, "modules", normalizedName);
      break;
    default:
      result = path.join(basePath, "modules", normalizedName);
  }

  pathCache.set(cacheKey, result);
  return result;
}

function clearPathCache() {
  pathCache.clear();
}

function getPathCacheSize() {
  return pathCache.size;
}

module.exports = {
  // Directory/file utilities
  ensureDir,
  writeFileIfNotExists,
  ensureBaseStructure,

  // Naming (re-exported from lib/naming.js - single source of truth)
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
  normalizeModuleName,

  // Path resolution
  getCachedModulePath,
  clearPathCache,
  getPathCacheSize,

  PathCache,
};

module.exports.__esModule = true;
module.exports.default = module.exports;
