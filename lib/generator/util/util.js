/**
 * lib/generator/util/util.js - `rakitin add util`
 *
 * Headless util generator. Every kind emits a working, dependency-audited
 * module at `app/shared/utils/<kebab>.util.js`: only `uuid` (kind uuid) and
 * `dayjs` (kind date) and `dotenv` (kind env) pull a package, and all three
 * are declared in `lib/deps/manifest.js`. Unknown kinds are a hard error -
 * the old stub fallback happily reported `created: true` for a file that
 * exported nothing.
 */

const path = require("path");
const { getPaths } = require("../../constants");
const { assertSafeName, toIdentifier } = require("../../naming");
const { writeFileIfNotExistsSafe, writeOutcome } = require("../../safety");
const { relativePosix } = require("../../utils");
const { renderApiTemplate } = require("../../template/api-templates");

/** Every util kind `rakitin add util` understands. */
const UTIL_KINDS = [
  "custom",
  "date",
  "string",
  "number",
  "array",
  "object",
  "file",
  "crypto",
  "uuid",
  "env",
  "url",
  "color",
  "math",
  "validation",
  "regex",
  "time",
];

/**
 * @param {string} kind
 * @param {string} [name] Required for the `custom` kind.
 * @returns {string} Rendered util source.
 */
function getDefaultUtilContent(kind, name) {
  const utilKind = String(kind ?? "")
    .trim()
    .toLowerCase();
  if (!UTIL_KINDS.includes(utilKind)) {
    throw new Error(
      `Jenis util tidak dikenal: "${kind}". Pilihan: ${UTIL_KINDS.join(", ")}.`
    );
  }
  if (utilKind === "custom") {
    const kebab = assertSafeName("util", name);
    return renderApiTemplate("util/custom.ejs", {
      name: kebab,
      camelName: toIdentifier(kebab),
    });
  }
  return renderApiTemplate(`util/${utilKind}.ejs`, {});
}

/**
 * @param {string} kind One of `UTIL_KINDS`.
 * @param {string} [name] Custom util name (required when kind === "custom").
 * @param {{root?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[], data: object}>}
 */
async function createUtil(kind, name, options = {}) {
  const root = options.root || process.cwd();
  const utilKind = String(kind ?? "")
    .trim()
    .toLowerCase();

  const content = getDefaultUtilContent(utilKind, name);
  const fileBase = utilKind === "custom" ? assertSafeName("util", name) : utilKind;
  const filePath = path.join(getPaths(root).sharedPath, "utils", `${fileBase}.util.js`);

  const outcome = writeFileIfNotExistsSafe(filePath, content);
  const created = [];
  const skipped = [];
  (writeOutcome(outcome) === "created" ? created : skipped).push(
    relativePosix(root, filePath)
  );

  return {
    created,
    skipped,
    data: {
      kind: utilKind,
      name: fileBase,
      file: relativePosix(root, filePath),
      available: UTIL_KINDS,
    },
  };
}

module.exports = { createUtil, UTIL_KINDS, getDefaultUtilContent };
