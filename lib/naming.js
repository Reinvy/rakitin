/**
 * lib/naming.js - Single source of truth for all naming conventions.
 *
 * Every generator MUST derive its identifiers/file-names from here.
 * Never hand-roll case conversion or interpolate raw user input into
 * JavaScript identifiers inside generated code.
 */

// ============================================================================
// CORE CASE CONVERTERS
// ============================================================================

/**
 * Convert a string to PascalCase ("user profile" -> "UserProfile").
 * @param {string} str
 * @returns {string}
 */
function toPascalCase(str) {
  const camel = toCamelCase(str);
  if (!camel) return "";
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/**
 * Convert a string to camelCase ("user profile" -> "userProfile").
 * @param {string} str
 * @returns {string}
 */
function toCamelCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/[-_ ]+(\w)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Convert a string to kebab-case ("User Profile" -> "user-profile",
 * "user_profile" -> "user-profile").
 * @param {string} str
 * @returns {string}
 */
function toKebabCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Convert a string to snake_case ("hello world" -> "hello_world").
 * @param {string} str
 * @returns {string}
 */
function toSnakeCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();
}

/**
 * Convert a string to Title Case ("hello world" -> "Hello World").
 * @param {string} str
 * @returns {string}
 */
function toTitleCase(str) {
  if (typeof str !== "string" || !str) return "";
  return str
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Convert a string to CONSTANT_CASE ("hello world" -> "HELLO_WORLD").
 * @param {string} str
 * @returns {string}
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

class NameCache {
  constructor(maxSize = 200) {
    this._cache = new Map();
    this._maxSize = maxSize;
  }
  has(key) {
    return this._cache.has(key);
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
  clear() {
    this._cache.clear();
  }
}

const nameCache = new NameCache();

/**
 * Normalize a module name to kebab-case directory form ("UserProfile",
 * "user profile", "user_profile" -> "user-profile").
 * Throws on empty/non-string input because callers rely on the result
 * being a real directory name.
 * @param {string} moduleName
 * @returns {string}
 */
function normalizeModuleName(moduleName) {
  if (typeof moduleName !== "string" || !moduleName.trim()) {
    throw new Error("Nama modul harus berupa string yang tidak kosong");
  }
  const cacheKey = `normalize:${moduleName}`;
  if (nameCache.has(cacheKey)) {
    return nameCache.get(cacheKey);
  }
  const result = moduleName
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
  nameCache.set(cacheKey, result);
  return result;
}

// ============================================================================
// IDENTIFIER SAFETY (critical for generated code correctness)
// ============================================================================

/** JavaScript reserved words that cannot be used as bare identifiers. */
const RESERVED_WORDS = new Set([
  "break", "case", "catch", "class", "const", "continue", "debugger", "default",
  "delete", "do", "else", "enum", "export", "extends", "false", "finally", "for",
  "function", "if", "import", "in", "instanceof", "new", "null", "return",
  "super", "switch", "this", "throw", "true", "try", "typeof", "var", "void",
  "while", "with", "await", "async", "yield", "let", "static", "implements",
  "interface", "package", "private", "protected", "public",
]);

/**
 * Sanitize an arbitrary user string into a SAFE JavaScript identifier.
 * "user-profile" -> "userProfile", "2fa" -> "_2fa", "my var!" -> "myVar".
 *
 * This is the ONLY sanctioned way to embed a user-provided name into
 * generated JS source (const declarations, destructuring, etc.).
 * @param {string} str
 * @param {object} [options]
 * @param {"camel"|"pascal"} [options.case="camel"]
 * @returns {string} A valid, non-reserved JS identifier.
 */
function toIdentifier(str, options = {}) {
  const { casing = "camel" } = options;
  let base =
    casing === "pascal" ? toPascalCase(str) : toCamelCase(toKebabCase(str));
  // Strip every character that is illegal inside an identifier.
  base = base.replace(/[^A-Za-z0-9_$]/g, "");
  if (!base) return "_";
  if (/^[0-9]/.test(base)) base = `_${base}`;
  if (RESERVED_WORDS.has(base)) base = `${base}_`;
  return base;
}

/**
 * Sanitize a string for safe use as a file name (keeps kebab readability,
 * strips path separators and control characters).
 * @param {string} str
 * @returns {string}
 */
function toSafeFileName(str) {
  if (typeof str !== "string") return "";
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_.]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .replace(/\.+$/, "");
}

/**
 * Compute every naming variant commonly required by generators in one call.
 * @param {string} moduleName Raw user-provided module name.
 * @returns {{raw:string, kebab:string, pascal:string, camel:string, snake:string, constant:string, identifier:string}}
 */
function getModuleVariants(moduleName) {
  const kebab = normalizeModuleName(moduleName);
  return {
    raw: moduleName,
    kebab,
    pascal: toPascalCase(kebab),
    camel: toCamelCase(kebab),
    snake: toSnakeCase(kebab),
    constant: toConstantCase(kebab),
    identifier: toIdentifier(moduleName),
  };
}

/**
 * Clear internal caches (useful in long-running processes/tests).
 */
function clearNamingCaches() {
  nameCache.clear();
}

module.exports = {
  // Case converters
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,

  // Module normalization
  normalizeModuleName,
  getModuleVariants,

  // Safety helpers
  toIdentifier,
  toSafeFileName,
  RESERVED_WORDS,
  clearNamingCaches,
};
