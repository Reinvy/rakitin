/**
 * lib/generator/api/validation/index.js - `rakitin add validation`
 *
 * Headless Joi validator generation. Two field sources:
 *   - `--fields name:type[:required]` (declared types always win)
 *   - `--from-module <module>` (reads the module's real Prisma/Mongoose schema)
 *
 * Unknown types and unreadable modules are hard errors: a validator that
 * silently degrades to `string` is worse than no validator at all.
 */

const fs = require("fs");
const path = require("path");
const { getPaths } = require("../../../constants");
const { assertSafeName, toIdentifier, getModuleVariants } = require("../../../naming");
const { writeFileIfNotExistsSafe, writeOutcome } = require("../../../safety");
const { relativePosix } = require("../../../utils");
const { renderApiTemplate } = require("../../../template/api-templates");
const { parseFieldSpec, FIELD_JOI_TYPES, decorateFieldNames } = require("../fields");

/** Prisma scalar type -> validator field type. */
const PRISMA_TYPE_MAP = {
  String: "string",
  Int: "number",
  Float: "number",
  Decimal: "number",
  BigInt: "number",
  Boolean: "boolean",
  DateTime: "date",
  Json: "string",
  Bytes: "string",
};

/** Mongoose schema type -> validator field type. */
const MONGOOSE_TYPE_MAP = {
  String: "string",
  Number: "number",
  Boolean: "boolean",
  Date: "date",
  ObjectId: "string",
  Decimal128: "number",
  Mixed: "string",
};

/**
 * Extract the balanced `{...}` body that follows the first `marker` in `src`.
 * @param {string} src
 * @param {string} marker
 * @returns {string|null}
 */
function extractBalancedBody(src, marker) {
  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) return null;
  const openIdx = src.indexOf("{", markerIdx);
  if (openIdx === -1) return null;

  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openIdx; index < src.length; index += 1) {
    const char = src[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(openIdx + 1, index);
    }
  }
  return null;
}

/**
 * Split a JS object body into its top-level entries (comma-separated).
 * @param {string} body
 * @returns {string[]}
 */
function splitTopLevelEntries(body) {
  const entries = [];
  let depth = 0;
  let start = 0;
  let quote = null;
  let escaped = false;

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{" || char === "[" || char === "(") depth += 1;
    else if (char === "}" || char === "]" || char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      entries.push(body.slice(start, index));
      start = index + 1;
    }
  }
  const tail = body.slice(start);
  if (tail.trim()) entries.push(tail);
  return entries;
}

/**
 * @param {object[]} fields
 * @param {string} name
 * @returns {boolean}
 */
function alreadyHas(fields, name) {
  return fields.some((field) => field.name === name);
}

/**
 * Parse `<root>/prisma/schema/<kebab>.prisma` scalar fields.
 * @param {string} root
 * @param {string} kebab
 * @returns {object[]|null}
 */
function parsePrismaFields(root, kebab) {
  const file = path.join(getPaths(root).prismaPath, `${kebab}.prisma`);
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, "utf8");

  const fields = [];
  const modelPattern = /model\s+([A-Za-z_$][\w$]*)\s*\{([^}]*)\}/g;
  let match = modelPattern.exec(src);
  while (match) {
    for (const rawLine of match[2].split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("//") || line.startsWith("@@")) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;
      const [rawName, rawType, ...attributes] = parts;
      if (rawType.endsWith("[]")) continue; // relation list
      const optional = rawType.endsWith("?");
      const prismaType = optional ? rawType.slice(0, -1) : rawType;
      const mapped = PRISMA_TYPE_MAP[prismaType];
      if (!mapped) continue; // relation / enum / unsupported scalar

      const name = rawName.replace(/[^A-Za-z0-9_$]/g, "");
      if (!name || alreadyHas(fields, name)) continue;

      const joinedAttrs = attributes.join(" ");
      let type = mapped;
      if (joinedAttrs.includes("@relation")) continue;
      if (prismaType === "String") {
        if (/@default\(\s*uuid\(/.test(joinedAttrs)) type = "uuid";
        else if (/email/i.test(name)) type = "email";
      }
      fields.push({ name, type, required: !optional });
    }
    match = modelPattern.exec(src);
  }
  return fields.length ? fields : null;
}

/**
 * Parse a Mongoose model file (`models/<kebab>.model.js` or
 * `<kebab>.model.js` for the simple architecture) schema keys.
 * @param {string} root
 * @param {string} kebab
 * @returns {object[]|null}
 */
function parseMongooseFields(root, kebab) {
  const moduleDir = path.join(getPaths(root).modulesPath, kebab);
  const candidates = [
    path.join(moduleDir, "models", `${kebab}.model.js`),
    path.join(moduleDir, `${kebab}.model.js`),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  if (!file) return null;

  const body = extractBalancedBody(fs.readFileSync(file, "utf8"), "Schema(");
  if (body === null) return null;

  const fields = [];
  for (const entry of splitTopLevelEntries(body)) {
    const entryMatch = entry.match(/^\s*([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/);
    if (!entryMatch) continue;
    const name = entryMatch[1];
    const value = entryMatch[2].trim();
    if (alreadyHas(fields, name)) continue;

    const typeMatch = value.match(/type\s*:\s*([A-Za-z_$.][\w$.[\]|]*)/);
    const rawType = typeMatch ? typeMatch[1] : value;
    if (rawType.includes("[") || rawType.includes("|")) continue; // array / union

    const base = rawType.split(".").pop().replace(/[[\]?]/g, "");
    const mapped = MONGOOSE_TYPE_MAP[base];
    if (!mapped) continue;

    const required = /required\s*:\s*true/.test(value);
    fields.push({ name, type: mapped, required });
  }
  return fields.length ? fields : null;
}

/**
 * Read the field list of an existing module from its ORM schema.
 *
 * @param {string} root Project root.
 * @param {string} moduleName Module name (kebab or any casing).
 * @param {string} [orm] Optional ORM hint ("prisma" | "mongoose") to pick a
 *   parser; when omitted both parsers are attempted.
 * @returns {{name: string, type: string, required: boolean}[]}
 */
function extractModuleFields(root, moduleName, orm) {
  const projectRoot = root || process.cwd();
  const kebab = assertSafeName("module", moduleName);

  const parsers = [];
  const hint = String(orm || "").toLowerCase();
  if (!hint || hint.includes("prisma")) parsers.push(() => parsePrismaFields(projectRoot, kebab));
  if (!hint || hint.includes("mongo") || hint.includes("mongoose")) {
    parsers.push(() => parseMongooseFields(projectRoot, kebab));
  }

  for (const parser of parsers) {
    const fields = parser();
    if (fields && fields.length) return fields;
  }

  throw new Error(
    `Tidak bisa membaca field dari modul "${kebab}". Gunakan --fields <a:string,b:number>.`
  );
}

/**
 * @param {string} name Validator name, or "common".
 * @param {{fields?: string, fromModule?: string, common?: boolean, orm?: string, root?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[], data: object}>}
 */
async function generateValidation(name, options = {}) {
  const root = options.root || process.cwd();
  const rawName = String(name ?? "").trim();
  const validatorsDir = path.join(getPaths(root).sharedPath, "validators");

  const created = [];
  const skipped = [];
  const record = (outcome, filePath) => {
    const bucket = writeOutcome(outcome) === "created" ? created : skipped;
    bucket.push(relativePosix(root, filePath));
  };

  if (options.common === true || rawName.toLowerCase() === "common") {
    const filePath = path.join(validatorsDir, "common.validator.js");
    const outcome = writeFileIfNotExistsSafe(
      filePath,
      renderApiTemplate("validation/common.validator.ejs", {})
    );
    record(outcome, filePath);
    return {
      created,
      skipped,
      data: { kind: "common", file: relativePosix(root, filePath) },
    };
  }

  let fields;
  let source;
  let targetName = rawName;

  const hasFields = options.fields !== undefined && String(options.fields ?? "").trim() !== "";
  if (hasFields) {
    fields = parseFieldSpec(options.fields);
    if (fields.length === 0) {
      throw new Error(
        "Tidak ada field valid pada --fields. Contoh: --fields name:string,price:number"
      );
    }
    source = "fields";
  } else if (options.fromModule) {
    const kebabModule = assertSafeName("module", options.fromModule);
    fields = extractModuleFields(root, kebabModule, options.orm);
    source = `from-module:${kebabModule}`;
    if (!targetName) targetName = kebabModule;
  } else {
    throw new Error(
      "Field validator wajib diisi. Contoh: rakitin add validation product --fields name:string,price:number (atau --from-module <module>)"
    );
  }

  const kebabName = assertSafeName("validator", targetName);
  const variants = getModuleVariants(kebabName);
  const decorated = decorateFieldNames(
    fields.map((field) => ({
      ...field,
      joi: FIELD_JOI_TYPES[field.type],
    }))
  );

  const filePath = path.join(validatorsDir, `${kebabName}.validator.js`);
  const outcome = writeFileIfNotExistsSafe(
    filePath,
    renderApiTemplate("validation/joi.validator.ejs", {
      camelName: toIdentifier(kebabName),
      pascalName: variants.pascal,
      fields: decorated,
      requiredFields: decorated.filter((field) => field.required),
      optionalFields: decorated.filter((field) => !field.required),
      source,
    })
  );
  record(outcome, filePath);

  return {
    created,
    skipped,
    data: {
      kind: "validator",
      name: kebabName,
      source,
      file: relativePosix(root, filePath),
      fields: decorated.map((field) => ({
        name: field.name,
        type: field.type,
        required: field.required,
      })),
    },
  };
}

module.exports = { generateValidation, extractModuleFields };
