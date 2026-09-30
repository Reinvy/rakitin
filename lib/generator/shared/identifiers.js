/**
 * lib/generator/shared/identifiers.js - The single derivation of every
 * identifier/name variant a generated module file may interpolate into JS,
 * SQL-ish table names or ORM model names.
 *
 * Never hand-roll this: raw user input must not reach generated source.
 */

const { normalizeModuleName, toIdentifier } = require("../../naming");

/**
 * @param {string} rawName User-supplied module name.
 * @returns {{kebab: string, camelName: string, pascalName: string,
 *   storeName: string, snake: string, tableName: string}}
 */
function moduleIdentifiers(rawName) {
  const kebab = normalizeModuleName(rawName);
  const snake = kebab.replace(/-/g, "_");
  return {
    kebab,
    camelName: toIdentifier(kebab),
    pascalName: toIdentifier(kebab, { casing: "pascal" }),
    storeName: toIdentifier(`${kebab}-store`, { casing: "constant" }),
    snake,
    tableName: `${snake}s`,
  };
}

module.exports = { moduleIdentifiers };
