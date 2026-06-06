/**
 * Utility Functions - Core utilities for rakitin library
 * Refactored to remove duplication, add caching, and support dual exports
 */

const fs = require("fs");
const path = require("path");
const { modulesPath, sharedPath, basePath } = require("./constants");

// ============================================================================
// PATH CACHE IMPLEMENTATION
// ============================================================================

/**
 * Simple cache implementation for path resolution
 */
class PathCache {
  constructor(maxSize = 100) {
    this._cache = new Map();
    this._maxSize = maxSize;
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*}
   */
  get(key) {
    return this._cache.get(key);
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    if (this._cache.size >= this._maxSize) {
      // Remove oldest entry (FIFO)
      const firstKey = this._cache.keys().next().value;
      this._cache.delete(firstKey);
    }
    this._cache.set(key, value);
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    return this._cache.has(key);
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this._cache.clear();
  }

  /**
   * Get cache size
   * @returns {number}
   */
  get size() {
    return this._cache.size;
  }
}

// Global path cache instance - reused across function calls
const pathCache = new PathCache();

// ============================================================================
// DIRECTORY & FILE UTILITIES
// ============================================================================

/**
 * Memastikan sebuah direktori ada. Jika tidak, direktori akan dibuat.
 * @param {string} dir Path ke direktori.
 */
function ensureDir(dir) {
  // fs.mkdirSync dengan { recursive: true } sudah menangani kasus jika direktori sudah ada,
  // jadi pemeriksaan fs.existsSync() tidak diperlukan.
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Menulis konten ke file hanya jika file tersebut belum ada.
 * @param {string} filePath Path ke file.
 * @param {string} content Konten yang akan ditulis.
 */
function writeFileIfNotExists(filePath, content = "") {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, "utf8");
  }
}

/**
 * Memastikan struktur direktori dasar aplikasi ada. Jika belum, strukturnya akan dibuat.
 * Struktur direktori dasar yang dimaksud adalah app/, app/modules/, app/shared/, dan folder
 * di dalam app/shared/, yaitu config/, interfaces/, middlewares/, dan utils/. File app.js
 * dan server.js juga akan dibuat jika belum ada.
 */
function ensureBaseStructure() {
  [modulesPath, sharedPath].forEach(ensureDir);
  ["middlewares", "config", "utils", "interfaces"].forEach((sub) =>
    // Menggunakan path.join untuk kompatibilitas lintas platform yang lebih baik.
    ensureDir(path.join(sharedPath, sub))
  );
  writeFileIfNotExists(path.join(basePath, "app.js"), `// Express app init`);
  writeFileIfNotExists(path.join(basePath, "server.js"), `// App entry point`);
}

// ============================================================================
// STRING CONVERSION UTILITIES
// ============================================================================

/**
 * Mengkonversi string ke dalam format PascalCase.
 * Contoh: "Hello World" menjadi "HelloWorld".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toPascalCase(str) {
  // Menambahkan validasi input untuk mencegah error.
  if (typeof str !== "string" || !str) return "";
  // Memanfaatkan toCamelCase untuk logika yang lebih andal dan konsisten.
  const camelCase = toCamelCase(str);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Mengkonversi string ke dalam format kebab-case.
 * Contoh: "Hello World" menjadi "hello-world".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toKebabCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

/**
 * Mengkonversi string ke dalam format camelCase.
 * Contoh: "Hello World" menjadi "helloWorld".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toCamelCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Mengkonversi string ke dalam format snake_case.
 * Contoh: "Hello World" menjadi "hello_world".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toSnakeCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

/**
 * Mengkonversi string ke dalam format title case.
 * Contoh: "hello world" menjadi "Hello World".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toTitleCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Mengkonversi string ke dalam format konstanta (UPPER_CASE_WITH_UNDERSCORES).
 * Contoh: "hello world" menjadi "HELLO_WORLD".
 * @param {string} str String yang akan dikonversi.
 * @returns {string} String yang sudah dikonversi.
 */
function toConstantCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toUpperCase();
}

// ============================================================================
// MODULE NAME NORMALIZATION (cached)
// ============================================================================

/**
 * Normalisasi nama modul ke kebab-case (cached for performance)
 * @param {string} moduleName - Nama modul yang akan dinormalisasi
 * @returns {string} Nama modul dalam format kebab-case
 */
function normalizeModuleName(moduleName) {
  if (typeof moduleName !== 'string' || !moduleName) {
    throw new Error('Nama modul harus berupa string yang tidak kosong');
  }

  // Check cache first
  const cacheKey = `normalize:${moduleName}`;
  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey);
  }

  const result = moduleName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();

  // Store in cache
  pathCache.set(cacheKey, result);
  return result;
}

// ============================================================================
// PATH RESOLUTION UTILITIES (cached)
// ============================================================================

/**
 * Get cached path for module
 * @param {string} moduleName - Module name
 * @param {string} basePath - Base path
 * @param {string} type - Path type (router, controller, service, etc.)
 * @returns {string} Cached or computed path
 */
function getCachedModulePath(moduleName, basePath, type) {
  const normalizedName = normalizeModuleName(moduleName);
  const cacheKey = `path:${normalizedName}:${type}:${basePath}`;

  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey);
  }

  const kebabName = normalizeModuleName(moduleName);
  let result;

  switch (type) {
    case 'router':
      result = path.join(basePath, 'modules', kebabName, 'routes', `${kebabName}.router.js`);
      break;
    case 'controller':
      result = path.join(basePath, 'modules', kebabName, 'controllers', `${kebabName}.controller.js`);
      break;
    case 'service':
      result = path.join(basePath, 'modules', kebabName, 'services', `${kebabName}.service.js`);
      break;
    case 'model':
      result = path.join(basePath, 'modules', kebabName, 'models', `${kebabName}.model.js`);
      break;
    case 'moduleDir':
      result = path.join(basePath, 'modules', kebabName);
      break;
    default:
      result = path.join(basePath, 'modules', kebabName);
  }

  pathCache.set(cacheKey, result);
  return result;
}

/**
 * Clear all path caches
 */
function clearPathCache() {
  pathCache.clear();
}

/**
 * Get path cache size
 * @returns {number}
 */
function getPathCacheSize() {
  return pathCache.size;
}

// ============================================================================
// EXPORTS
// ============================================================================

// CommonJS exports
module.exports = {
  // Directory utilities
  ensureDir,
  writeFileIfNotExists,
  ensureBaseStructure,

  // String conversion utilities
  toPascalCase,
  toKebabCase,
  toCamelCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,

  // Module name utilities
  normalizeModuleName,

  // Path resolution utilities
  getCachedModulePath,
  clearPathCache,
  getPathCacheSize,

  // Export cache class for external use
  PathCache,
};

// For ESM compatibility - these will be used when library is built as ESM
module.exports.__esModule = true;
module.exports.default = module.exports;