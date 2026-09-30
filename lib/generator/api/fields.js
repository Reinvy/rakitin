/**
 * lib/generator/api/fields.js - shared `--fields` spec parser.
 *
 * Spec format: `name:type[:required]`, comma separated, e.g.
 *   --fields title:string:true,price:number,email:email
 *
 * Field names are sanitized with `toFieldIdentifier` (they end up as JS
 * identifiers and query/body keys), and unknown types are a hard error -
 * silently degrading to `string` is how unvalidated payloads shipped.
 */

const { toFieldIdentifier } = require("../../naming");

/** Field types accepted in a `--fields` spec. */
const FIELD_TYPES = ["string", "number", "boolean", "date", "uuid", "email"];

/** Joi expression emitted for each supported field type. */
const FIELD_JOI_TYPES = {
  string: "string()",
  number: "number()",
  boolean: "boolean()",
  date: "date()",
  uuid: "string().uuid()",
  email: "string().email()",
};

/**
 * @param {string} raw
 * @returns {boolean}
 */
function isFieldType(raw) {
  return FIELD_TYPES.includes(String(raw || "").trim().toLowerCase());
}

/**
 * Parse a `--fields` spec into sanitized field descriptors.
 *
 * - duplicate names keep the first declaration
 * - empty/whitespace-only entry -> `Nama field tidak valid: "<raw>"`
 * - unknown type -> `Tipe field tidak dikenal: "<type>"`
 *
 * @param {string|string[]|null|undefined} spec
 * @returns {{name: string, type: string, required: boolean, raw: string}[]}
 */
function parseFieldSpec(spec) {
  const entries = Array.isArray(spec) ? spec.join(",") : String(spec ?? "");
  if (!entries.trim()) return [];

  const fields = [];
  const seen = new Set();

  for (const rawEntry of entries.split(",")) {
    if (!rawEntry.trim()) continue;
    const parts = rawEntry.trim().split(":");
    const rawName = parts[0];
    const rawType = (parts[1] ?? "").trim() || "string";
    const requiredFlag = (parts[2] ?? "").trim().toLowerCase();

    const name = toFieldIdentifier(rawName);
    const type = rawType.toLowerCase();
    if (!FIELD_TYPES.includes(type)) {
      throw new Error(
        `Tipe field tidak dikenal: "${rawType}". Pilihan: ${FIELD_TYPES.join(", ")}.`
      );
    }
    if (seen.has(name)) continue;
    seen.add(name);

    fields.push({
      name,
      type,
      required: requiredFlag === "true" || requiredFlag === "1" || requiredFlag === "yes",
      raw: String(rawName).trim(),
    });
  }

  return fields;
}

/** Characters/letters accepted at the start of a JS identifier. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Decorate sanitized fields with the JS syntax needed to reference them
 * safely: `toFieldIdentifier` may legitimately return a leading digit
 * (`2price`), which is not a valid identifier start.
 *
 * @param {object[]} fields
 * @returns {(object & {literal: string, key: string, access: string})[]}
 */
function decorateFieldNames(fields) {
  return fields.map((field) => {
    const literal = JSON.stringify(field.name);
    const isIdentifier = IDENTIFIER.test(field.name);
    return {
      ...field,
      literal,
      key: isIdentifier ? field.name : literal,
      access: isIdentifier ? `.${field.name}` : `[${literal}]`,
    };
  });
}

module.exports = { FIELD_TYPES, FIELD_JOI_TYPES, isFieldType, parseFieldSpec, decorateFieldNames };
