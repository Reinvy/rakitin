/**
 * lib/generator/api/documentation/index.js - `rakitin add docs`
 *
 * Generates an OpenAPI 3.0 document (JSON and/or YAML) plus an optional
 * Swagger UI mount file. The spec is derived from the REAL module inventory:
 * a module is documented only when its router file exists, and per-resource
 * mounts written by `rakitin add endpoint` become their own paths.
 * Headless: no prompts, no console output.
 */

const fs = require("fs");
const path = require("path");
const { getPaths } = require("../../../constants");
const { detectProject } = require("../../../project/detector");
const { writeFileIfNotExistsSafe, writeOutcome, RESOURCE_BLOCK_START, RESOURCE_BLOCK_END } = require("../../../safety");
const { relativePosix } = require("../../../utils");
const { renderApiTemplate } = require("../../../template/api-templates");
const { dumpYaml } = require("./yaml");

const DOCS_KINDS = ["openapi-json", "openapi-yaml", "swagger-ui", "complete"];

const ID_PARAMETER = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string" },
};

/**
 * @param {string} tag
 * @param {string} label
 * @returns {object}
 */
function collectionOperations(tag, label) {
  return {
    get: {
      tags: [tag],
      summary: `Ambil daftar ${label}`,
      parameters: [
        { name: "search", in: "query", required: false, schema: { type: "string" } },
        { name: "page", in: "query", required: false, schema: { type: "integer" } },
        { name: "limit", in: "query", required: false, schema: { type: "integer" } },
      ],
      responses: { 200: { description: "Berhasil" } },
    },
    post: {
      tags: [tag],
      summary: `Buat ${label} baru`,
      requestBody: {
        required: true,
        content: { "application/json": { schema: { type: "object" } } },
      },
      responses: {
        201: { description: "Dibuat" },
        400: { description: "Payload tidak valid" },
      },
    },
  };
}

/**
 * @param {string} tag
 * @param {string} label
 * @returns {object}
 */
function itemOperations(tag, label) {
  return {
    get: {
      tags: [tag],
      summary: `Ambil ${label} berdasarkan id`,
      parameters: [ID_PARAMETER],
      responses: { 200: { description: "Berhasil" }, 404: { description: "Tidak ditemukan" } },
    },
    put: {
      tags: [tag],
      summary: `Perbarui ${label}`,
      parameters: [ID_PARAMETER],
      responses: {
        200: { description: "Berhasil diperbarui" },
        404: { description: "Tidak ditemukan" },
      },
    },
    delete: {
      tags: [tag],
      summary: `Hapus ${label}`,
      parameters: [ID_PARAMETER],
      responses: { 200: { description: "Berhasil dihapus" }, 404: { description: "Tidak ditemukan" } },
    },
  };
}

/**
 * Read the resource mount paths emitted into the module router's managed
 * `// rakitin:resources:` region.
 * @param {string} routerFile
 * @returns {string[]}
 */
function readResourceMounts(routerFile) {
  const source = fs.readFileSync(routerFile, "utf8");
  const start = source.indexOf(RESOURCE_BLOCK_START);
  const end = source.indexOf(RESOURCE_BLOCK_END);
  const region = start !== -1 && end > start ? source.slice(start, end) : "";

  const mounts = [];
  const pattern = /router\.use\(\s*["'](\/[^"']*)["']/g;
  let match = pattern.exec(region);
  while (match) {
    if (!mounts.includes(match[1])) mounts.push(match[1]);
    match = pattern.exec(region);
  }
  return mounts;
}

/**
 * @param {object} module Detector inventory entry `{dirName, name, architecture}`.
 * @param {string} root
 * @returns {string|null}
 */
function moduleRouterFile(module, root) {
  const modulesDir = getPaths(root).modulesPath;
  if (module.architecture === "modular") {
    return path.join(modulesDir, module.dirName, "routes", `${module.name}.router.js`);
  }
  if (module.architecture === "simple") {
    return path.join(modulesDir, module.dirName, `${module.name}.router.js`);
  }
  return null;
}

/**
 * Build the OpenAPI 3.0 spec object from the on-disk project.
 * @param {{title: string, apiVersion: string, auth: boolean, root: string}} options
 * @returns {{spec: object, documented: string[], skippedModules: string[]}}
 */
function buildSpec({ title, apiVersion, auth, root }) {
  const detected = detectProject(root);
  const paths = {};
  const tags = [];
  const documented = [];
  const skippedModules = [];

  for (const module of detected.structure.modules) {
    const routerFile = moduleRouterFile(module, root);
    if (!routerFile || !fs.existsSync(routerFile)) {
      skippedModules.push(module.name);
      continue;
    }

    documented.push(module.name);
    tags.push({ name: module.name, description: `Modul ${module.name}` });

    const base = `/api/${module.name}`;
    paths[base] = collectionOperations(module.name, module.name);
    paths[`${base}/{id}`] = itemOperations(module.name, module.name);

    for (const mount of readResourceMounts(routerFile)) {
      const resourceBase = `${base}${mount}`;
      paths[resourceBase] = collectionOperations(module.name, `${module.name}${mount}`);
      paths[`${resourceBase}/{id}`] = itemOperations(
        module.name,
        `${module.name}${mount}`
      );
    }
  }

  const spec = {
    openapi: "3.0.0",
    info: {
      title,
      version: apiVersion,
      description: "API Documentation generated by rakitin",
    },
    servers: [{ url: "http://localhost:3000", description: "Development server" }],
    tags,
    paths,
    components: { schemas: {} },
  };

  if (auth) {
    spec.components.securitySchemes = {
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    };
    spec.security = [{ BearerAuth: [] }];
  }

  return { spec, documented, skippedModules };
}

/**
 * @param {string} kind openapi-json | openapi-yaml | swagger-ui | complete
 * @param {{title?: string, apiVersion?: string, auth?: boolean, root?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[], data: object}>}
 */
async function generateDocumentation(kind, options = {}) {
  const docsKind = String(kind ?? "")
    .trim()
    .toLowerCase();
  if (!DOCS_KINDS.includes(docsKind)) {
    throw new Error(
      `Jenis dokumentasi tidak dikenal: "${kind}". Pilihan: ${DOCS_KINDS.join(", ")}.`
    );
  }

  const root = options.root || process.cwd();
  const title = options.title || "Rakitin API";
  const apiVersion = options.apiVersion || "1.0.0";
  const auth = options.auth !== false;

  const docsDir = getPaths(root).docsPath;
  const { spec, documented, skippedModules } = buildSpec({ title, apiVersion, auth, root });

  const targets = {
    "openapi-json": {
      file: path.join(docsDir, "openapi.json"),
      render: () =>
        renderApiTemplate("docs/openapi-json.ejs", {
          content: `${JSON.stringify(spec, null, 2)}\n`,
        }),
    },
    "openapi-yaml": {
      file: path.join(docsDir, "openapi.yaml"),
      render: () => renderApiTemplate("docs/openapi-yaml.ejs", { content: dumpYaml(spec) }),
    },
    "swagger-ui": {
      file: path.join(docsDir, "swagger-ui.js"),
      render: () =>
        renderApiTemplate("docs/swagger-ui.ejs", {
          specJson: JSON.stringify(spec, null, 2),
        }),
    },
  };

  const selected =
    docsKind === "complete" ? ["openapi-json", "openapi-yaml", "swagger-ui"] : [docsKind];

  const created = [];
  const skipped = [];

  for (const target of selected) {
    const { file, render } = targets[target];
    const outcome = writeFileIfNotExistsSafe(file, render());
    const bucket = writeOutcome(outcome) === "created" ? created : skipped;
    bucket.push(relativePosix(root, file));
  }

  return {
    created,
    skipped,
    data: {
      kind: docsKind,
      title,
      apiVersion,
      auth,
      openapi: spec.openapi,
      modules: documented,
      skippedModules,
    },
  };
}

module.exports = { generateDocumentation, DOCS_KINDS };
