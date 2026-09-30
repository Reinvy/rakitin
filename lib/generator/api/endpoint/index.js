/**
 * lib/generator/api/endpoint/index.js - `rakitin add endpoint`
 *
 * Generates a self-contained CRUD resource (Express router + controller) for
 * an existing module and mounts it into the module router's managed
 * `// rakitin:resources:` region. Headless: no prompts, no console output.
 *
 * Every emitted `router.use(...)` points at a file this generator just wrote,
 * so a generated project can never boot with an undefined handler or a
 * dangling require.
 */

const fs = require("fs");
const path = require("path");
const { getPaths } = require("../../../constants");
const { assertSafeName, toIdentifier } = require("../../../naming");
const {
  writeFileIfNotExistsSafe,
  overwriteWithBackup,
  writeOutcome,
  buildMarkedBlock,
  RESOURCE_BLOCK_START,
  RESOURCE_BLOCK_END,
} = require("../../../safety");
const { relativePosix } = require("../../../utils");
const { renderApiTemplate } = require("../../../template/api-templates");
const { parseFieldSpec, decorateFieldNames } = require("../fields");

/** Lines buildMarkedBlock() owns inside a managed region. */
const MANAGED_NOTICE = /^\/\/ (?:rakitin-managed region|Keep custom entries OUTSIDE)/;

/**
 * @param {string} moduleDir
 * @param {string} kebab
 * @returns {"modular"|"simple"|null}
 */
function detectArchitecture(moduleDir, kebab) {
  if (fs.existsSync(path.join(moduleDir, "routes", `${kebab}.router.js`))) return "modular";
  if (fs.existsSync(path.join(moduleDir, `${kebab}.controller.js`))) return "simple";
  return null;
}

/**
 * Read the current managed-region lines (requires + mounts), dropping the
 * generated notice lines so they are not duplicated on re-runs.
 * @param {string} existing
 * @param {string} startToken
 * @param {string} endToken
 * @returns {string[]}
 */
function readManagedRegion(existing, startToken, endToken) {
  const start = existing.indexOf(startToken);
  const end = existing.indexOf(endToken);
  if (start === -1 || end === -1 || end < start) return [];
  return existing
    .slice(start + startToken.length, end)
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "" && !MANAGED_NOTICE.test(line.trim()));
}

/**
 * @param {string} moduleName
 * @param {{resource?: string, fields?: string, pagination?: boolean, filtering?: boolean, root?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[], data: object}>}
 */
async function generateEndpoint(moduleName, options = {}) {
  const root = options.root || process.cwd();
  const kebabModule = assertSafeName("module", moduleName);

  if (options.resource === undefined || options.resource === null || !String(options.resource).trim()) {
    throw new Error(
      "Nama resource wajib diisi. Contoh: rakitin add endpoint user --resource items --fields title:string,price:number"
    );
  }
  const kebabResource = assertSafeName("resource", options.resource);

  const fields = parseFieldSpec(options.fields);
  if (fields.length === 0) {
    throw new Error(
      "Field endpoint wajib diisi. Contoh: rakitin add endpoint user --resource items --fields title:string,price:number"
    );
  }

  const decorations = decorateFieldNames(fields);
  const pagination = options.pagination !== false;
  const filtering = options.filtering !== false;

  const p = getPaths(root);
  const moduleDir = path.join(p.modulesPath, kebabModule);
  if (!fs.existsSync(moduleDir) || !fs.statSync(moduleDir).isDirectory()) {
    throw new Error(
      `Modul "${kebabModule}" tidak ditemukan. Buat dulu: rakitin add module ${kebabModule}`
    );
  }

  const architecture = detectArchitecture(moduleDir, kebabModule);
  if (!architecture) {
    throw new Error(
      `Struktur modul "${kebabModule}" tidak dikenali (controller/router modul hilang). Buat ulang: rakitin add module ${kebabModule}`
    );
  }

  const routerFile =
    architecture === "modular"
      ? path.join(moduleDir, "routes", `${kebabModule}.router.js`)
      : path.join(moduleDir, `${kebabModule}.router.js`);
  const controllerFile =
    architecture === "modular"
      ? path.join(moduleDir, "controllers", `${kebabModule}.controller.js`)
      : path.join(moduleDir, `${kebabModule}.controller.js`);

  if (!fs.existsSync(routerFile)) {
    throw new Error(
      `Router modul "${kebabModule}" tidak ditemukan di ${relativePosix(root, routerFile)}.`
    );
  }
  if (!fs.existsSync(controllerFile)) {
    throw new Error(
      `Controller modul "${kebabModule}" tidak ditemukan di ${relativePosix(root, controllerFile)}.`
    );
  }

  const resourcesDir = path.join(moduleDir, "resources");
  const resourceRouterFile = path.join(resourcesDir, `${kebabResource}.resource.js`);
  const resourceControllerFile = path.join(resourcesDir, `${kebabResource}.controller.js`);

  const locals = {
    kebabModule,
    resource: kebabResource,
    fields: decorations,
    searchFields: decorations.map((field) => field.name),
    pagination,
    filtering,
    autoId: !fields.some((field) => field.name === "id"),
    reservedKeysLiteral: filtering
      ? pagination
        ? '"search", "page", "limit"'
        : '"search"'
      : "",
  };

  const created = [];
  const skipped = [];

  const files = [
    { path: resourceRouterFile, content: renderApiTemplate("endpoint/resource.router.ejs", locals) },
    {
      path: resourceControllerFile,
      content: renderApiTemplate("endpoint/resource.controller.ejs", locals),
    },
  ];

  for (const file of files) {
    const outcome = writeFileIfNotExistsSafe(file.path, file.content);
    const bucket = writeOutcome(outcome) === "created" ? created : skipped;
    bucket.push(relativePosix(root, file.path));
  }

  // --- Mount into the module router's managed resource region -------------
  const existing = fs.readFileSync(routerFile, "utf8");
  const requirePath =
    architecture === "modular"
      ? `../resources/${kebabResource}.resource`
      : `./resources/${kebabResource}.resource`;
  const routerId = toIdentifier(`${kebabResource}-resource`);
  const requireLine = `const ${routerId} = require("${requirePath}");`;
  const useLine = `router.use("/${kebabResource}", ${routerId});`;

  const inner = readManagedRegion(existing, RESOURCE_BLOCK_START, RESOURCE_BLOCK_END);
  const alreadyMounted = inner.some(
    (line) =>
      line.includes(`router.use("/${kebabResource}"`) ||
      line.includes(`router.use('/${kebabResource}'`)
  );
  if (!alreadyMounted) {
    if (!inner.some((line) => line.includes(requirePath))) inner.push(requireLine);
    inner.push(useLine);
  }

  const marked = buildMarkedBlock({
    existing,
    startToken: RESOURCE_BLOCK_START,
    endToken: RESOURCE_BLOCK_END,
    inner: inner.join("\n"),
    commentPrefix: "//",
  });

  const mounted = marked.content !== existing;
  if (mounted) overwriteWithBackup(routerFile, marked.content);

  return {
    created,
    skipped,
    data: {
      module: kebabModule,
      architecture,
      resource: kebabResource,
      fields: fields.map((field) => ({
        name: field.name,
        type: field.type,
        required: field.required,
      })),
      pagination,
      filtering,
      mount: {
        file: relativePosix(root, routerFile),
        updated: mounted,
        action: mounted ? marked.action : "unchanged",
      },
    },
  };
}

module.exports = { generateEndpoint };
