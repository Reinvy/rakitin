/**
 * GraphQL generator - `app/graphql/*` bootstrap and per-module wiring.
 *
 * Artifacts (relative to the project root, all writes through lib/safety.js):
 *   app/graphql/index.js        schema loader + `mountGraphQL(app, basePath)`
 *   app/graphql/schema.graphql  SDL roots + managed `# rakitin:graphql:` region
 *   app/graphql/resolvers.js    `rootValue` map + managed `// rakitin:graphql:` region
 *   app/graphql/README.md
 *
 * `rakitin add graphql --module <name>` appends the module's type, queries and
 * mutations into BOTH managed regions. The append is idempotent (per-module
 * sentinel `# rakitin:module:<kebab>` / `// rakitin:module:<kebab>`) and every
 * byte outside the region is preserved (`safety.buildMarkedBlock`).
 */

const fs = require("fs");
const path = require("path");
const { getPaths } = require("../../../constants");
const { assertSafeName, getModuleVariants } = require("../../../naming");
const {
  writeFileIfNotExistsSafe,
  overwriteWithBackup,
  writeOutcome,
  buildMarkedBlock,
  GRAPHQL_BLOCK_START,
  GRAPHQL_BLOCK_END,
} = require("../../../safety");
const { relativePosix } = require("../../../utils");
const { defaultEngine } = require("../../../template/engine");

const TEMPLATES_DIR = path.join(__dirname, "..", "..", "..", "templates", "graphql");

/** Project-root-relative POSIX paths of every generated artifact. */
const GRAPHQL_PATHS = Object.freeze({
  dir: "app/graphql",
  index: "app/graphql/index.js",
  schema: "app/graphql/schema.graphql",
  resolvers: "app/graphql/resolvers.js",
  readme: "app/graphql/README.md",
});

/**
 * The SDL region uses the shared `# rakitin:graphql:*` tokens; the JavaScript
 * region uses the same tokens with a JS comment prefix.
 */
const RESOLVERS_BLOCK_START = GRAPHQL_BLOCK_START.replace(/^#/, "//");
const RESOLVERS_BLOCK_END = GRAPHQL_BLOCK_END.replace(/^#/, "//");

/** EJS template → content (rendered through the shared default engine). */
function renderTemplate(fileName, data = {}) {
  return defaultEngine.renderFile(path.join(TEMPLATES_DIR, fileName), data);
}

/** Lines that `safety.buildMarkedBlock` writes as part of its region notice. */
const NOTICE_FRAGMENTS = ["rakitin-managed region", "Keep custom entries"];

/**
 * Inner text of an existing managed region, with the notice lines removed and
 * surrounding blank lines dropped. Per-line indentation is preserved verbatim.
 * @param {string|null} existing
 * @param {string} startToken
 * @param {string} endToken
 * @returns {string}
 */
function extractRegionInner(existing, startToken, endToken) {
  if (!existing) return "";
  const startIdx = existing.indexOf(startToken);
  const endIdx = existing.indexOf(endToken);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return "";

  const lines = existing
    .slice(startIdx + startToken.length, endIdx)
    .split("\n")
    .filter((line) => !NOTICE_FRAGMENTS.some((fragment) => line.includes(fragment)));

  while (lines.length && lines[0].trim() === "") lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.join("\n");
}

/**
 * Merge an optional new block into the managed region of `existing`.
 * @param {string|null} existing Current file content, or null for a new file.
 * @param {string} moduleBlock New per-module block ("" when none).
 * @param {"#"|"//"} commentPrefix
 * @param {string} startToken
 * @param {string} endToken
 * @returns {{content: string, action: "create"|"inject"|"append"}}
 */
function withModuleBlock(existing, moduleBlock, commentPrefix, startToken, endToken) {
  const previous = extractRegionInner(existing, startToken, endToken);
  const inner = [previous, moduleBlock]
    .filter((part) => part && part.trim() !== "")
    .join("\n\n");
  return buildMarkedBlock({
    existing,
    startToken,
    endToken,
    inner,
    commentPrefix,
  });
}

/**
 * Locate an existing module service file (modular first, then simple).
 * @param {string} root
 * @param {string} kebab
 * @returns {string|null} absolute path
 */
function resolveModuleService(root, kebab) {
  const moduleDir = path.join(getPaths(root).modulesPath, kebab);
  const candidates = [
    path.join(moduleDir, "services", `${kebab}.service.js`),
    path.join(moduleDir, `${kebab}.service.js`),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Generate the GraphQL layer.
 *
 * @param {{module?: string|null, root?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[], data: object}>}
 */
async function generateGraphQL({ module: moduleArg, root: rootArg } = {}) {
  const root = rootArg || process.cwd();
  const rawModule = typeof moduleArg === "string" ? moduleArg.trim() : "";
  const kebab = rawModule ? assertSafeName("module", rawModule) : null;

  const graphqlDir = path.join(root, GRAPHQL_PATHS.dir);
  const indexPath = path.join(root, GRAPHQL_PATHS.index);
  const schemaPath = path.join(root, GRAPHQL_PATHS.schema);
  const resolverPath = path.join(root, GRAPHQL_PATHS.resolvers);
  const readmePath = path.join(root, GRAPHQL_PATHS.readme);

  let moduleSdl = "";
  let moduleResolvers = "";
  if (kebab) {
    const serviceFile = resolveModuleService(root, kebab);
    if (!serviceFile) {
      throw new Error(
        `Modul "${rawModule}" tidak ditemukan. Buat dulu: rakitin add module ${rawModule}`
      );
    }
    const variants = getModuleVariants(kebab);
    // Require path from app/graphql/resolvers.js to the real module service.
    const servicePath = relativePosix(graphqlDir, serviceFile).replace(/\.js$/, "");
    moduleSdl = renderTemplate("module-sdl.ejs", variants).trimEnd();
    moduleResolvers = renderTemplate("module-resolvers.ejs", {
      ...variants,
      servicePath,
    }).trimEnd();
  }

  const sdlSentinel = `# rakitin:module:${kebab}`;
  const resolverSentinel = `// rakitin:module:${kebab}`;

  const mergeSdl = (existing, block) =>
    withModuleBlock(existing, block, "#", GRAPHQL_BLOCK_START, GRAPHQL_BLOCK_END);
  const mergeResolvers = (existing, block) =>
    withModuleBlock(existing, block, "//", RESOLVERS_BLOCK_START, RESOLVERS_BLOCK_END);

  /** @type {{rel: string, bucket: "created"|"skipped"}[]} */
  const results = [];

  /**
   * Create the file when absent; otherwise report it untouched.
   * @param {string} filePath
   * @param {string} content
   */
  function ensureArtifact(filePath, content) {
    const verdict = writeFileIfNotExistsSafe(filePath, content);
    results.push({
      rel: relativePosix(root, filePath),
      bucket: writeOutcome(verdict),
    });
  }

  /**
   * Create the file when absent; when it exists, merge `nextContent` only if
   * it actually differs (marker-aware, `.bak`-backed overwrite).
   * @param {string} filePath
   * @param {string} newFileContent
   * @param {(existing: string) => string} merge
   * @param {string|null} sentinel
   */
  function upsertArtifact(filePath, newFileContent, merge, sentinel) {
    const rel = relativePosix(root, filePath);
    if (!fs.existsSync(filePath)) {
      const verdict = writeFileIfNotExistsSafe(filePath, newFileContent);
      results.push({ rel, bucket: writeOutcome(verdict) });
      return;
    }
    const existing = fs.readFileSync(filePath, "utf8");
    if (!sentinel || existing.includes(sentinel)) {
      results.push({ rel, bucket: "skipped" });
      return;
    }
    const merged = merge(existing);
    if (merged === existing) {
      results.push({ rel, bucket: "skipped" });
      return;
    }
    overwriteWithBackup(filePath, merged);
    results.push({ rel, bucket: "created" });
  }

  ensureArtifact(indexPath, renderTemplate("index.ejs"));
  ensureArtifact(readmePath, renderTemplate("README.md.ejs"));

  upsertArtifact(
    schemaPath,
    renderTemplate("schema.graphql.ejs", {
      block: mergeSdl(null, moduleSdl).content,
    }),
    (existing) => mergeSdl(existing, moduleSdl).content,
    moduleSdl ? sdlSentinel : null
  );

  upsertArtifact(
    resolverPath,
    renderTemplate("resolvers.ejs", {
      block: mergeResolvers(null, moduleResolvers).content,
    }),
    (existing) => mergeResolvers(existing, moduleResolvers).content,
    moduleResolvers ? resolverSentinel : null
  );

  return {
    created: results.filter((r) => r.bucket === "created").map((r) => r.rel),
    skipped: results.filter((r) => r.bucket === "skipped").map((r) => r.rel),
    data: {
      module: kebab,
      files: results.map((r) => r.rel),
      schemaPath: GRAPHQL_PATHS.schema,
      resolverPath: GRAPHQL_PATHS.resolvers,
    },
  };
}

module.exports = { generateGraphQL, GRAPHQL_PATHS };
