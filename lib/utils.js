/**
 * lib/utils.js - Core file/directory utilities.
 *
 * Naming conventions live in lib/naming.js (single source of truth) and are
 * re-exported here for backward compatibility.
 */

const fs = require("fs");
const path = require("path");
const { writeFileIfNotExistsSafe, isDryRun, runtime: safetyRuntime } = require("./safety");

// Canonical naming utilities (defined in lib/naming.js, never here).
const {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
  normalizeModuleName,
} = require("./naming");

/**
 * Ensure a directory exists (recursively creating parents when needed).
 * Dry-run aware: in plan mode a missing directory is RECORDED, not created.
 * @param {string} dir
 */
function ensureDir(dir) {
  if (isDryRun()) {
    if (!fs.existsSync(dir)) {
      safetyRuntime.plan.push({ op: "mkdir", path: dir });
    }
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Write content to a file only when it does not already exist.
 * Delegates to the safety layer so every caller honors plan mode.
 * @param {string} filePath
 * @param {string} [content]
 * @returns {boolean} true when the content hit disk (or was planned).
 */
function writeFileIfNotExists(filePath, content = "") {
  const result = writeFileIfNotExistsSafe(filePath, content);
  return result.written || result.skipped === null;
}

/**
 * POSIX path relative to a project root (the canonical shape of every
 * `created[]` / `skipped[]` entry).
 * @param {string} root
 * @param {string} target
 * @returns {string}
 */
function relativePosix(root, target) {
  return path.relative(root, path.resolve(root, target)).split(path.sep).join("/");
}

/** Public surface of the utils module. */
module.exports = {
  ensureDir,
  writeFileIfNotExists,
  relativePosix,

  // Naming (re-exported from lib/naming.js - single source of truth)
  toPascalCase,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  toTitleCase,
  toConstantCase,
  normalizeModuleName,
};
