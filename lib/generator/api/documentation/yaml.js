/**
 * lib/generator/api/documentation/yaml.js - dependency-free YAML emitter.
 *
 * The previous `yamlDump` produced invalid YAML for arrays of objects and
 * for any string containing `:` or `#`. This emitter handles nested maps,
 * sequences, sequences of maps, empty containers, and quotes any scalar
 * that would otherwise be re-parsed as a number/boolean/null or that
 * contains YAML-significant punctuation.
 */

const PAD = "  ";

const NUMERIC_LIKE = /^[-+]?(?:\d+|\d*\.\d+)(?:[eE][-+]?\d+)?$/;
const YAML_KEYWORDS = /^(?:true|false|null|yes|no|on|off|~)$/i;
const INDICATOR_START = /^[-?:,[\]{}#&*!|>'"%@`]/;
const SIGNIFICANT_CHARS = /[:#[\]{}",&*?|<>=!%@`]/;
const MULTILINE = /[\n\r\t]/;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isScalar(value) {
  return value === null || typeof value !== "object";
}

/**
 * @param {string} raw
 * @returns {boolean}
 */
function needsQuote(raw) {
  if (raw === "") return true;
  if (/^\s|\s$/.test(raw)) return true;
  if (MULTILINE.test(raw)) return true;
  if (NUMERIC_LIKE.test(raw)) return true;
  if (YAML_KEYWORDS.test(raw)) return true;
  if (INDICATOR_START.test(raw)) return true;
  if (SIGNIFICANT_CHARS.test(raw)) return true;
  return false;
}

/**
 * Render a key (map key or sequence-of-maps key).
 * @param {string} raw
 * @returns {string}
 */
function formatKey(raw) {
  const key = String(raw);
  return needsQuote(key) ? JSON.stringify(key) : key;
}

/**
 * Render a scalar value. JSON double-quoted strings are valid YAML
 * double-quoted scalars, so JSON.stringify is a safe quoting strategy.
 * @param {unknown} value
 * @returns {string}
 */
function formatScalar(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "null";
  }
  const raw = String(value);
  return needsQuote(raw) ? JSON.stringify(raw) : raw;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmptyContainer(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

/**
 * Flatten nested blocks into a single string.
 * @param {string[]} lines
 * @returns {string}
 */
function joinBlocks(lines) {
  return lines.join("\n");
}

/**
 * Render a map entry as one or more lines.
 * @param {string} key
 * @param {unknown} value
 * @param {number} indent
 * @returns {string}
 */
function renderMapEntry(key, value, indent) {
  const pad = PAD.repeat(indent);
  const label = formatKey(key);
  if (isScalar(value)) return `${pad}${label}: ${formatScalar(value)}`;
  if (isEmptyContainer(value)) {
    return `${pad}${label}: ${Array.isArray(value) ? "[]" : "{}"}`;
  }
  return `${pad}${label}:\n${renderBlock(value, indent + 1)}`;
}

/**
 * Render a sequence item as one or more lines.
 * @param {unknown} item
 * @param {number} indent
 * @returns {string}
 */
function renderSequenceItem(item, indent) {
  const pad = PAD.repeat(indent);
  if (isScalar(item)) return `${pad}- ${formatScalar(item)}`;
  if (isEmptyContainer(item)) {
    return `${pad}- ${Array.isArray(item) ? "[]" : "{}"}`;
  }
  if (Array.isArray(item)) {
    return `${pad}-\n${renderBlock(item, indent + 1)}`;
  }

  const entries = Object.entries(item).filter(([, value]) => value !== undefined);
  const [firstKey, firstValue] = entries[0];
  const lines = [];

  if (isScalar(firstValue)) {
    lines.push(`${pad}- ${formatKey(firstKey)}: ${formatScalar(firstValue)}`);
  } else if (isEmptyContainer(firstValue)) {
    lines.push(
      `${pad}- ${formatKey(firstKey)}: ${Array.isArray(firstValue) ? "[]" : "{}"}`
    );
  } else {
    lines.push(`${pad}- ${formatKey(firstKey)}:`);
    lines.push(renderBlock(firstValue, indent + 2));
  }
  for (const [key, value] of entries.slice(1)) {
    lines.push(renderMapEntry(key, value, indent + 1));
  }
  return joinBlocks(lines);
}

/**
 * Render an object/array body (keys or dashes) at the given indent level.
 * @param {unknown} value
 * @param {number} indent
 * @returns {string}
 */
function renderBlock(value, indent) {
  if (Array.isArray(value)) {
    return joinBlocks(value.map((item) => renderSequenceItem(item, indent)));
  }
  return joinBlocks(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => renderMapEntry(key, item, indent))
  );
}

/**
 * Serialize a JS value to YAML.
 * @param {unknown} value
 * @returns {string} YAML document ending with exactly one newline.
 */
function dumpYaml(value) {
  let body;
  if (isScalar(value)) {
    body = formatScalar(value);
  } else if (isEmptyContainer(value)) {
    body = Array.isArray(value) ? "[]" : "{}";
  } else {
    body = renderBlock(value, 0);
  }
  return `${body.replace(/\n+$/, "")}\n`;
}

module.exports = { dumpYaml, needsQuote };
