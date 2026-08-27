/**
 * lib/safety.js - Universal file-safety layer.
 *
 * Every generator MUST route writes through this module so that:
 *   1. Existing user files are NEVER silently overwritten,
 *      (write-if-absent + .bak backups),
 *   2. --dry-run collects a plan and prints it WITHOUT touching disk,
 *   3. Router edits use idempotent marker-based injection.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Execution modes
// ---------------------------------------------------------------------------

/**
 * Global runtime mode. Interactive CLI sets this once; library callers
 * may pass explicit overrides per call instead.
 */
const runtime = {
  dryRun: false,
  /** Collected plan entries while in dry-run: {op, path}[] */
  plan: [],
};

function setDryRun(enabled) {
  runtime.dryRun = Boolean(enabled);
  if (!enabled) resetPlan();
}

function isDryRun() {
  return runtime.dryRun;
}

/** Start capturing operations as a plan (no disk writes). */
function beginPlan() {
  setDryRun(true);
}

/** Collected plan entries. */
function getPlan() {
  return [...runtime.plan];
}

/** Clear the collected plan and leave dry-run mode. */
function resetPlan() {
  runtime.plan = [];
}

// ---------------------------------------------------------------------------
// Core write helpers
// ---------------------------------------------------------------------------

/**
 * Write a file only when absent. In dry-run, records the intent instead.
 * @param {string} filePath
 * @param {string} content
 * @param {{dryRun?: boolean}} [overrides]
 * @returns {{written: boolean, skipped: "exists"|null}}
 */
function writeFileIfNotExistsSafe(filePath, content = "", overrides = {}) {
  const dryRun = overrides.dryRun ?? runtime.dryRun;
  if (!fs.existsSync(filePath)) {
    if (dryRun) {
      runtime.plan.push({ op: "create", path: filePath });
      return { written: false, skipped: null };
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    return { written: true, skipped: null };
  }
  return { written: false, skipped: "exists" };
}

/**
 * Backward-compatible boolean wrapper - every legacy generator already
 * calls utils.writeFileIfNotExists; delegating HERE makes the entire
 * legacy surface dry-run/plan aware without touching each generator.
 * @param {string} filePath
 * @param {string} [content]
 * @returns {boolean} true when content hit disk (or was planned).
 */
function legacyWriteIfAbsent(filePath, content = "") {
  const res = writeFileIfNotExistsSafe(filePath, content);
  // In plan mode report "would write" so callers log optimistic paths;
  // on-disk semantics stay identical to the old helper.
  return res.written || res.skipped === null;
}

/**
 * Overwrite WITH a `.bak` backup of the previous version.
 * @param {string} filePath
 * @param {string} content
 * @param {{dryRun?: boolean}} [overrides]
 */
function overwriteWithBackup(filePath, content, overrides = {}) {
  const dryRun = overrides.dryRun ?? runtime.dryRun;
  let backedUp = false;
  if (fs.existsSync(filePath)) {
    if (dryRun) {
      runtime.plan.push({ op: "backup+overwrite", path: filePath });
    } else {
      fs.copyFileSync(filePath, `${filePath}.bak`);
      backedUp = true;
      fs.writeFileSync(filePath, content, "utf8");
    }
  } else {
    if (dryRun) {
      runtime.plan.push({ op: "create", path: filePath });
    } else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf8");
    }
  }
  return { written: !dryRun, backedUp };
}

// ---------------------------------------------------------------------------
// Marker-based router injection (idempotent)
// ---------------------------------------------------------------------------

const ROUTES_BLOCK_START = "/* rakitin:routes:start */";
const ROUTES_BLOCK_END = "/* rakitin:routes:end */";

const MAIN_ROUTER_HEADER = `const express = require('express');
const router = express.Router();
`;

function routesBlock(inner) {
  return [
    "",
    ROUTES_BLOCK_START,
    "// Routes managed by rakitin - safe to regenerate; keep custom",
    "// routes OUTSIDE these markers to preserve them.",
    inner.trimEnd(),
    "",
    ROUTES_BLOCK_END,
    "",
  ].join("\n");
}

/**
 * Compute the new content for app/routes/index.js:
 *   - No existing file            -> full header + marked block + export.
 *   - File exists with markers    -> replace ONLY the marked region.
 *   - File exists without markers -> append markers at the end so user
 *     code above stays byte-identical.
 * Pure function (no I/O) so it composes safely with dry-run.
 *
 * @param {string|null} existing Current index.js content or null.
 * @param {string} routeLines Lines of route wiring to insert.
 * @returns {{content: string, action: "create"|"inject"|"append"}}
 */
function buildRoutesContent(existing, routeLines) {
  if (existing == null) {
    return {
      content:
        MAIN_ROUTER_HEADER + routesBlock(routeLines) + "\nmodule.exports = router;\n",
      action: "create",
    };
  }

  if (existing.includes(ROUTES_BLOCK_START) && existing.includes(ROUTES_BLOCK_END)) {
    const startIdx = existing.indexOf(ROUTES_BLOCK_START);
    const endIdx = existing.indexOf(ROUTES_BLOCK_END) + ROUTES_BLOCK_END.length;
    // Preserve everything outside the markers, swap the block body.
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx);
    const content =
      before +
      ROUTES_BLOCK_START +
      "\n" +
      routeLines.trimEnd() +
      "\n\n" +
      ROUTES_BLOCK_END +
      after;
    return { content, action: "inject" };
  }

  // No markers yet - append our managed block before module.exports if
  // present, otherwise at end-of-file. User code stays intact.
  const block = routesBlock(routeLines);
  const exportIdx = existing.lastIndexOf("module.exports");
  if (exportIdx === -1) {
    return { content: existing.replace(/\s*$/, "") + "\n" + block, action: "append" };
  }
  return {
    content:
      existing.slice(0, exportIdx).replace(/\n*$/, "\n") +
      block +
      existing.slice(exportIdx),
    action: "inject",
  };
}

module.exports = {
  runtime,
  setDryRun,
  isDryRun,
  beginPlan,
  getPlan,
  resetPlan,

  writeFileIfNotExistsSafe,
  legacyWriteIfAbsent,
  overwriteWithBackup,

  ROUTES_BLOCK_START,
  ROUTES_BLOCK_END,
  MAIN_ROUTER_HEADER,
  routesBlock,
  buildRoutesContent,
};
