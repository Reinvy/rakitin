/**
 * lib/safety.js - Universal file-safety layer (v3).
 *
 * Every generator MUST route writes through this module so that:
 *   1. Existing user files are NEVER silently overwritten
 *      (write-if-absent + uniquely-named `.bak` backups),
 *   2. `--dry-run` collects a plan and prints it WITHOUT touching disk and
 *      without spawning any install/generation child process,
 *   3. Marker-based edits (router wiring, GraphQL SDL, WebSocket handlers,
 *      resource blocks) are idempotent and preserve every byte outside the
 *      marker region,
 *   4. JSON files (`package.json`, `.rakitinrc.json`) are mutated through
 *      `updateJsonFile` only - parsed, backed up, re-serialized.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Execution modes
// ---------------------------------------------------------------------------

const runtime = {
  dryRun: false,
  overwrite: false,
  /** Collected plan entries while in dry-run: {op, path, backup?}[] */
  plan: [],
};

function setDryRun(enabled) {
  runtime.dryRun = Boolean(enabled);
  if (!enabled) runtime.plan = [];
}

function isDryRun() {
  return runtime.dryRun;
}

/**
 * Global `--overwrite` mode: `writeFileIfNotExistsSafe` re-writes existing
 * files (always through `overwriteWithBackup`, so a `.bak` is kept) instead
 * of skipping them.
 * @param {boolean} enabled
 */
function setOverwrite(enabled) {
  runtime.overwrite = Boolean(enabled);
}

function isOverwrite() {
  return runtime.overwrite;
}

/** Start capturing operations as a plan (no disk writes). */
function beginPlan() {
  runtime.plan = [];
  runtime.dryRun = true;
}

/** Clear the collected plan AND leave plan/overwrite mode. */
function resetPlan() {
  runtime.plan = [];
  runtime.dryRun = false;
  runtime.overwrite = false;
}

/** Collected plan entries. */
function getPlan() {
  return runtime.plan.map((entry) => ({ ...entry }));
}

// ---------------------------------------------------------------------------
// Backup naming
// ---------------------------------------------------------------------------

/**
 * First free backup path for a file: `<file>.bak`, then `.bak.1`, `.bak.2`…
 * An existing backup is NEVER clobbered (v2 overwrote every `.bak`).
 * @param {string} filePath
 * @returns {string}
 */
function backupPathFor(filePath) {
  const first = `${filePath}.bak`;
  if (!fs.existsSync(first)) return first;
  let index = 1;
  for (;;) {
    const candidate = `${filePath}.bak.${index}`;
    if (!fs.existsSync(candidate)) return candidate;
    index += 1;
  }
}

// ---------------------------------------------------------------------------
// Core write helpers
// ---------------------------------------------------------------------------

/**
 * Write a file only when absent. In dry-run, records the intent instead.
 * In `--overwrite` mode an existing file is re-written through
 * `overwriteWithBackup` (so the previous content is preserved in `.bak`).
 * @param {string} filePath
 * @param {string} content
 * @param {{dryRun?: boolean, overwrite?: boolean}} [overrides]
 * @returns {{written: boolean, skipped: "exists"|null, backedUp?: boolean, backupPath?: string|null}}
 */
function writeFileIfNotExistsSafe(filePath, content = "", overrides = {}) {
  const dryRun = overrides.dryRun ?? runtime.dryRun;
  const overwrite = overrides.overwrite ?? runtime.overwrite;

  if (!fs.existsSync(filePath)) {
    if (dryRun) {
      runtime.plan.push({ op: "create", path: filePath });
      return { written: false, skipped: null };
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    return { written: true, skipped: null };
  }

  if (!overwrite) {
    return { written: false, skipped: "exists" };
  }

  const result = overwriteWithBackup(filePath, content, { dryRun });
  return {
    written: result.written,
    skipped: null,
    backedUp: result.backedUp,
    backupPath: result.backupPath,
  };
}

/**
 * Overwrite WITH a uniquely-named `.bak` backup of the previous version.
 * @param {string} filePath
 * @param {string} content
 * @param {{dryRun?: boolean}} [overrides]
 * @returns {{written: boolean, backedUp: boolean, backupPath: string|null}}
 */
function overwriteWithBackup(filePath, content, overrides = {}) {
  const dryRun = overrides.dryRun ?? runtime.dryRun;
  const exists = fs.existsSync(filePath);

  if (dryRun) {
    if (exists) {
      runtime.plan.push({
        op: "overwrite",
        path: filePath,
        backup: backupPathFor(filePath),
      });
    } else {
      runtime.plan.push({ op: "create", path: filePath });
    }
    return { written: false, backedUp: false, backupPath: null };
  }

  if (exists) {
    const backupPath = backupPathFor(filePath);
    fs.copyFileSync(filePath, backupPath);
    fs.writeFileSync(filePath, content, "utf8");
    return { written: true, backedUp: true, backupPath };
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
  return { written: true, backedUp: false, backupPath: null };
}

/**
 * Which reporting bucket does a write verdict belong to?
 * Every "nothing was written" reason (`"exists"` from
 * `writeFileIfNotExistsSafe`, `"marker-exists"` from `mergeEnvExample`,
 * `"unchanged"` from `updateJsonFile`) counts as skipped.
 * @param {{written?: boolean, skipped?: string|null}} result
 * @returns {"created"|"skipped"}
 */
function writeOutcome(result) {
  return result && result.skipped ? "skipped" : "created";
}

/**
 * The ONLY sanctioned way to mutate a user's JSON file (package.json,
 * .rakitinrc.json): parse, mutate, re-serialize, back up.
 *
 * `mutator(obj)` returns the object to persist, or `false` to signal
 * "nothing changed" (no write, no backup).
 *
 * @param {string} filePath
 * @param {(obj: object) => object|false} mutator
 * @param {{dryRun?: boolean}} [overrides]
 * @returns {{written: boolean, skipped: "unchanged"|null, backedUp: boolean, backupPath: string|null, value: object}}
 */
function updateJsonFile(filePath, mutator, overrides = {}) {
  const dryRun = overrides.dryRun ?? runtime.dryRun;
  let current = {};
  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf8");
    try {
      current = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `Gagal membaca JSON "${filePath}": ${error.message}. Perbaiki file tersebut terlebih dahulu.`,
        { cause: error }
      );
    }
    if (current === null || typeof current !== "object" || Array.isArray(current)) {
      throw new Error(`Isi "${filePath}" bukan objek JSON yang valid.`);
    }
  }

  const next = mutator(current);
  if (next === false || next === undefined || next === null) {
    return {
      written: false,
      skipped: "unchanged",
      backedUp: false,
      backupPath: null,
      value: current,
    };
  }

  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  const result = overwriteWithBackup(filePath, serialized, { dryRun });
  return {
    written: result.written,
    skipped: null,
    backedUp: result.backedUp,
    backupPath: result.backupPath,
    value: next,
  };
}

/**
 * Append a marked section to `<root>/.env.example`, at most once.
 * The marker line (`# JWT CONFIG`, `# PRISMA`, …) makes the merge
 * idempotent: a second call with the same marker is a no-op.
 *
 * @param {string} root Project root.
 * @param {string} marker Marker label without the leading `# `.
 * @param {string} content Variable lines to append.
 * @param {{dryRun?: boolean}} [overrides]
 * @returns {{written: boolean, skipped: "marker-exists"|null, path: string}}
 */
function mergeEnvExample(root, marker, content, overrides = {}) {
  const filePath = path.join(root, ".env.example");
  const markerLine = `# ${marker}`;
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;

  if (existing !== null && existing.split("\n").some((line) => line.trim() === markerLine)) {
    return { written: false, skipped: "marker-exists", path: filePath };
  }

  const body = String(content ?? "").trimEnd();
  const section = `${markerLine}\n${body}\n`;
  const next =
    existing === null || existing.trim() === ""
      ? `${section}`
      : `${existing.replace(/\s*$/, "")}\n\n${section}`;

  const result = overwriteWithBackup(filePath, next, overrides);
  return { written: result.written, skipped: null, path: filePath };
}

// ---------------------------------------------------------------------------
// Generic marker engine
// ---------------------------------------------------------------------------

const ROUTES_BLOCK_START = "/* rakitin:routes:start */";
const ROUTES_BLOCK_END = "/* rakitin:routes:end */";
const RESOURCE_BLOCK_START = "// rakitin:resources:start";
const RESOURCE_BLOCK_END = "// rakitin:resources:end";
const GRAPHQL_BLOCK_START = "# rakitin:graphql:start";
const GRAPHQL_BLOCK_END = "# rakitin:graphql:end";
const WS_BLOCK_START = "// rakitin:ws:start";
const WS_BLOCK_END = "// rakitin:ws:end";

const MAIN_ROUTER_HEADER = `const express = require('express');
const router = express.Router();
`;

/**
 * Generic, idempotent marker-region builder. Pure function (no I/O).
 *
 * - `existing === null`            -> `header` + marked block + `eofFallback`
 * - existing contains both tokens  -> replace ONLY the marked region
 * - otherwise                      -> insert the marked block before the
 *                                     last `module.exports` (or at EOF) so
 *                                     every user byte is preserved
 *
 * @param {object} options
 * @param {string|null} options.existing Current file content, or null.
 * @param {string} options.startToken
 * @param {string} options.endToken
 * @param {string} options.inner Lines to place inside the region.
 * @param {string} [options.header] Preamble for a brand-new file.
 * @param {string} [options.eofFallback] Trailing text for a brand-new file.
 * @param {string} [options.commentPrefix="@"] Prefix used for the
 *   "managed by rakitin" notice lines (language-appropriate).
 * @returns {{content: string, action: "create"|"inject"|"append"}}
 */
function buildMarkedBlock({
  existing,
  startToken,
  endToken,
  inner = "",
  header = "",
  eofFallback = "",
  commentPrefix = "//",
}) {
  const body = String(inner ?? "").trimEnd();
  const notice = [
    `${commentPrefix} rakitin-managed region: safe to regenerate.`,
    `${commentPrefix} Keep custom entries OUTSIDE these markers.`,
  ].join("\n");
  const region = `${startToken}\n${notice}\n${body}\n${endToken}\n`;

  if (existing == null) {
    return { content: `${header}${region}${eofFallback}`, action: "create" };
  }

  const hasMarkers =
    existing.includes(startToken) && existing.includes(endToken);
  if (hasMarkers) {
    const startIdx = existing.indexOf(startToken);
    const endIdx = existing.indexOf(endToken) + endToken.length;
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx);
    return {
      content: `${before}${startToken}\n${notice}\n${body}\n${endToken}${after}`,
      action: "inject",
    };
  }

  const exportIdx = existing.lastIndexOf("module.exports");
  if (exportIdx === -1) {
    const prefix = existing.trim() === "" ? existing : `${existing.replace(/\s*$/, "")}\n\n`;
    return { content: `${prefix}${region}`, action: "append" };
  }
  return {
    content:
      existing.slice(0, exportIdx).replace(/\n*$/, "\n") +
      `${region}\n` +
      existing.slice(exportIdx),
    action: "inject",
  };
}

/**
 * Compute the new content for `app/routes/index.js`.
 * @param {string|null} existing Current index.js content or null.
 * @param {string} routeLines Lines of route wiring to insert.
 * @returns {{content: string, action: "create"|"inject"|"append"}}
 */
function buildRoutesContent(existing, routeLines) {
  return buildMarkedBlock({
    existing,
    startToken: ROUTES_BLOCK_START,
    endToken: ROUTES_BLOCK_END,
    inner: routeLines,
    header: MAIN_ROUTER_HEADER,
    eofFallback: "\nmodule.exports = router;\n",
  });
}

module.exports = {
  runtime,
  setDryRun,
  isDryRun,
  setOverwrite,
  isOverwrite,
  beginPlan,
  resetPlan,
  getPlan,

  backupPathFor,
  writeFileIfNotExistsSafe,
  overwriteWithBackup,
  writeOutcome,
  updateJsonFile,
  mergeEnvExample,
  buildMarkedBlock,
  buildRoutesContent,

  ROUTES_BLOCK_START,
  ROUTES_BLOCK_END,
  RESOURCE_BLOCK_START,
  RESOURCE_BLOCK_END,
  GRAPHQL_BLOCK_START,
  GRAPHQL_BLOCK_END,
  WS_BLOCK_START,
  WS_BLOCK_END,
  MAIN_ROUTER_HEADER,
};
