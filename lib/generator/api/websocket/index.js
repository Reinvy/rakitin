/**
 * lib/generator/api/websocket/index.js - WebSocket layer generator.
 *
 * Writes the always-on transport layer:
 *   - app/ws/index.js            (attachWebSocket / createWebSocketServer)
 *   - app/ws/handlers/index.js   (registry: handlers / register / dispatch)
 *   - app/ws/README.md           (protocol documentation)
 *
 * And, when `module` is given, one handler per module:
 *   - app/ws/handlers/<kebab>.handler.js  (delegates to the module service)
 * plus its registration inside the `// rakitin:ws:start|end` marker region.
 *
 * Everything is idempotent: existing files are reported in `skipped[]` and the
 * marker region is regenerated in place (never duplicated).
 *
 * Returns project-root-relative POSIX paths in `created[]` / `skipped[]`.
 */

const fs = require("fs");
const path = require("path");
const { assertSafeName, getModuleVariants } = require("../../../naming");
const {
  buildMarkedBlock,
  writeFileIfNotExistsSafe,
  overwriteWithBackup,
  writeOutcome,
  WS_BLOCK_START,
  WS_BLOCK_END,
} = require("../../../safety");
const { relativePosix } = require("../../../utils");
const { defaultEngine } = require("../../../template/engine");

const WS_TEMPLATES_DIR = path.join(__dirname, "..", "..", "..", "templates", "websocket");

/** Canonical artifact paths (project-root-relative, POSIX). */
const WS_PATHS = Object.freeze({
  dir: "app/ws",
  index: "app/ws/index.js",
  handlersDir: "app/ws/handlers",
  handlersIndex: "app/ws/handlers/index.js",
  readme: "app/ws/README.md",
});

/**
 * Render a websocket template through the shared EJS engine.
 * @param {string} templateFile e.g. "server.ejs"
 * @param {object} [data]
 * @returns {string}
 */
function render(templateFile, data = {}) {
  return defaultEngine.renderFile(path.join(WS_TEMPLATES_DIR, templateFile), data);
}

/**
 * Normalize the `--path` flag into a leading-slash WebSocket path.
 * @param {string} [value]
 * @returns {string}
 */
function normalizeWsPath(value) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : "/ws";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.replace(/\/+$/, "") || "/";
}

/**
 * POSIX require specifier from one file to another (always `./`-prefixed).
 * @param {string} fromFile
 * @param {string} toFile
 * @returns {string}
 */
function relativeRequire(fromFile, toFile) {
  const rel = path.relative(path.dirname(fromFile), toFile).split(path.sep).join("/");
  const specifier = rel.replace(/\.js$/, "");
  return specifier.startsWith(".") ? specifier : `./${specifier}`;
}

/**
 * Locate the module service file for either architecture.
 * @param {string} root
 * @param {string} kebab
 * @returns {string|null} Absolute service path, or null when the module is absent.
 */
function findModuleService(root, kebab) {
  const moduleDir = path.join(root, "app", "modules", kebab);
  const candidates = [
    path.join(moduleDir, "services", `${kebab}.service.js`),
    path.join(moduleDir, `${kebab}.service.js`),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

/**
 * Events already registered inside the marker region, in file order.
 * @param {string|null} existing
 * @returns {string[]}
 */
function readRegisteredEvents(existing) {
  if (!existing) return [];
  const startIdx = existing.indexOf(WS_BLOCK_START);
  const endIdx = existing.indexOf(WS_BLOCK_END);
  const scope =
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
      ? existing.slice(startIdx, endIdx)
      : existing;

  const events = [];
  const pattern = /^[ \t]*register\(\s*["']([^"']+)["']/gm;
  let match = pattern.exec(scope);
  while (match !== null) {
    if (!events.includes(match[1])) events.push(match[1]);
    match = pattern.exec(scope);
  }
  return events;
}

/**
 * Build the handlers registry file content (header + marker region + footer).
 * @param {string|null} existing Current content, or null when absent.
 * @param {string[]} events Ordered registered module names.
 * @returns {{content: string, action: string}}
 */
function buildHandlersIndex(existing, events) {
  const inner = events
    .map((name) => {
      const identifier = getModuleVariants(name).identifier;
      return [
        `const ${identifier}Handler = require("./${name}.handler");`,
        `register("${name}", ${identifier}Handler);`,
      ].join("\n");
    })
    .join("\n");

  const built = buildMarkedBlock({
    existing,
    startToken: WS_BLOCK_START,
    endToken: WS_BLOCK_END,
    inner,
    header: render("handlers-header.ejs"),
    eofFallback: render("handlers-footer.ejs"),
  });

  // `buildMarkedBlock` appends blindly when a foreign file has neither markers
  // nor `module.exports`; make sure the registry still exports its API.
  if (!built.content.includes("module.exports")) {
    built.content = `${built.content.trimEnd()}\n${render("handlers-footer.ejs").trimStart()}`;
  }
  return built;
}

/**
 * Effective path of an already-emitted transport (never overwritten, so the
 * path reported in `data` must match what `attachWebSocket` actually uses).
 * @param {string} serverFile
 * @param {string} fallback
 * @returns {string}
 */
function readEffectivePath(serverFile, fallback) {
  try {
    const source = fs.readFileSync(serverFile, "utf8");
    const match = source.match(/const DEFAULT_PATH = "([^"]*)"/);
    return match && match[1] ? match[1] : fallback;
  } catch (_error) {
    return fallback;
  }
}

/**
 * Generate (or refresh) the WebSocket layer.
 * @param {object} [options]
 * @param {string} [options.module] Module to wire a handler for.
 * @param {string} [options.path] WebSocket path (default "/ws").
 * @param {string} [options.root] Project root (default process.cwd()).
 * @returns {Promise<{created: string[], skipped: string[], data: {module: string|null, files: string[], path: string}}>}
 */
async function generateWebSocket({ module: rawModule, path: wsPath, root = process.cwd() } = {}) {
  const kebab =
    rawModule === undefined || rawModule === null || rawModule === ""
      ? null
      : assertSafeName("module", rawModule);
  const resolvedPath = normalizeWsPath(wsPath);

  // Fail fast (before any write) when the target module does not exist yet.
  let serviceFile = null;
  if (kebab) {
    serviceFile = findModuleService(root, kebab);
    if (!serviceFile) {
      throw new Error(`Modul "${kebab}" tidak ditemukan. Buat dulu: rakitin add module ${kebab}`);
    }
  }

  const created = [];
  const skipped = [];
  const files = [];
  const wsDir = path.join(root, "app", "ws");

  const bucketFor = (result) => (writeOutcome(result) === "created" ? created : skipped);
  const record = (bucket, filePath) => {
    const rel = relativePosix(root, filePath);
    if (!files.includes(rel)) files.push(rel);
    if (!bucket.includes(rel)) bucket.push(rel);
  };

  // 1. Transport layer: app/ws/index.js
  const serverFile = path.join(wsDir, "index.js");
  const serverResult = writeFileIfNotExistsSafe(
    serverFile,
    render("server.ejs", { path: resolvedPath })
  );
  record(bucketFor(serverResult), serverFile);

  // 2. Per-module handler (before touching the registry so the require target exists).
  if (kebab) {
    const handlerFile = path.join(wsDir, "handlers", `${kebab}.handler.js`);
    const handlerResult = writeFileIfNotExistsSafe(
      handlerFile,
      render("handler.ejs", {
        kebab,
        serviceRequire: relativeRequire(handlerFile, serviceFile),
      })
    );
    record(bucketFor(handlerResult), handlerFile);
  }

  // 3. Handler registry with its marker region (idempotent regeneration).
  const handlersFile = path.join(wsDir, "handlers", "index.js");
  const existing = fs.existsSync(handlersFile) ? fs.readFileSync(handlersFile, "utf8") : null;
  const events = readRegisteredEvents(existing);
  if (kebab && !events.includes(kebab)) events.push(kebab);

  const built = buildHandlersIndex(existing, events);
  if (existing !== null && built.content === existing) {
    record(skipped, handlersFile);
  } else {
    record(bucketFor(overwriteWithBackup(handlersFile, built.content)), handlersFile);
  }

  // 4. Protocol documentation.
  const readmeFile = path.join(wsDir, "README.md");
  const readmeResult = writeFileIfNotExistsSafe(
    readmeFile,
    render("readme.ejs", { path: resolvedPath, events })
  );
  record(bucketFor(readmeResult), readmeFile);

  const effectivePath = readEffectivePath(serverFile, resolvedPath);

  return { created, skipped, data: { module: kebab, files, path: effectivePath } };
}

module.exports = { generateWebSocket, WS_PATHS };
