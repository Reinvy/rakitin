/**
 * lib/installer.js - Package installation with retry logic.
 *
 * Supports npm, pnpm, yarn and bun. Every install runs through
 * `spawn(command, args, { shell: false })`: package specs are NEVER
 * interpolated into a shell string, so a malicious/odd package name cannot
 * escape into a shell command.
 *
 * Retries happen only for network/registry failures - deterministic
 * failures (EACCES, ENOENT, EUSAGE, unknown package manager) fail fast.
 */

const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");

const SILENT_FLAG = "--silent";

/**
 * Command builders. Each returns `{ command, args }` - never a shell string.
 */
const PACKAGE_MANAGERS = {
  npm: {
    install: (packages, options = {}) => ({
      command: "npm",
      args: [
        "install",
        options.saveDev ? "--save-dev" : "--save",
        ...(options.silent ? [SILENT_FLAG] : []),
        ...packages,
      ],
    }),
    uninstall: (packages, options = {}) => ({
      command: "npm",
      args: [
        "uninstall",
        ...(options.saveDev ? ["--save-dev"] : []),
        ...(options.silent ? [SILENT_FLAG] : []),
        ...packages,
      ],
    }),
  },
  pnpm: {
    install: (packages, options = {}) => ({
      command: "pnpm",
      args: [
        "add",
        ...(options.saveDev ? ["-D"] : []),
        ...(options.silent ? [SILENT_FLAG] : []),
        ...packages,
      ],
    }),
    uninstall: (packages, options = {}) => ({
      command: "pnpm",
      args: [
        "remove",
        ...(options.saveDev ? ["-D"] : []),
        ...(options.silent ? [SILENT_FLAG] : []),
        ...packages,
      ],
    }),
  },
  yarn: {
    install: (packages, options = {}) => ({
      command: "yarn",
      args: [
        "add",
        ...(options.saveDev ? ["--dev"] : []),
        ...(options.silent ? [SILENT_FLAG] : []),
        ...packages,
      ],
    }),
    uninstall: (packages, options = {}) => ({
      command: "yarn",
      args: [
        "remove",
        ...(options.saveDev ? ["--dev"] : []),
        ...(options.silent ? [SILENT_FLAG] : []),
        ...packages,
      ],
    }),
  },
  bun: {
    install: (packages, options = {}) => ({
      command: "bun",
      args: [
        "add",
        ...(options.saveDev ? ["-d"] : []),
        ...(options.silent ? [SILENT_FLAG] : []),
        ...packages,
      ],
    }),
    uninstall: (packages, options = {}) => ({
      command: "bun",
      args: [
        "remove",
        ...(options.saveDev ? ["-d"] : []),
        ...(options.silent ? [SILENT_FLAG] : []),
        ...packages,
      ],
    }),
  },
};

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/** Failures that can never succeed on retry - fail fast. */
const NON_RETRIABLE_PATTERN = /EACCES|ENOENT|EUSAGE|EPERM|ENOTSUP/;
/** Transport/registry hiccups worth retrying. */
const RETRIABLE_PATTERN =
  /EAI_AGAIN|ETIMEDOUT|ECONNRESET|ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|socket hang up|\b429\b|\b5\d{2}\b/;

/** Shell metacharacters that make a raw command string unsafe to tokenize. */
const SHELL_METACHARACTERS = /[|&;<>()`$\\\n"'*?{}[\]~!]/;

/**
 * Extract the bare package name from a spec (`@prisma/client@^7` -> `@prisma/client`).
 * @param {string} pkg
 * @returns {string}
 */
function getBasePackageName(pkg) {
  if (!pkg) return "";
  if (pkg.startsWith("@")) {
    const parts = pkg.slice(1).split("@");
    return `@${parts[0]}`;
  }
  return pkg.split("@")[0];
}

/**
 * Is a package present in `<root>/node_modules` or declared in
 * `<root>/package.json`?
 * @param {string} packageName
 * @param {string} [root]
 * @returns {boolean}
 */
function isPackageInstalled(packageName, root = process.cwd()) {
  try {
    const baseName = getBasePackageName(packageName);
    if (fs.existsSync(path.join(root, "node_modules", baseName))) return true;

    const packageJsonPath = path.join(root, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return Boolean(
        (pkg.dependencies && pkg.dependencies[baseName]) ||
          (pkg.devDependencies && pkg.devDependencies[baseName])
      );
    }
    return false;
  } catch (error) {
    logger.debug(`Error checking package ${packageName}: ${error.message}`);
    return false;
  }
}

/**
 * Injectable internals - tests stub these instead of mocking node modules.
 */
const internals = {};

/**
 * Normalize a command spec into `{ command, args }`.
 * Accepts either the canonical object form or a plain string that contains
 * no shell metacharacters (legacy `npx express-generator --no-view .`).
 * @param {string|{command: string, args?: string[]}} spec
 * @returns {{command: string, args: string[]}}
 */
function normalizeCommandSpec(spec) {
  if (spec && typeof spec === "object") {
    return { command: spec.command, args: [...(spec.args || [])] };
  }
  if (typeof spec !== "string" || !spec.trim()) {
    throw new Error("Perintah tidak valid: harus berupa string atau { command, args }");
  }
  if (SHELL_METACHARACTERS.test(spec)) {
    throw new Error(
      `Perintah mengandung karakter shell yang tidak diizinkan: "${spec}". ` +
        "Gunakan bentuk { command, args }."
    );
  }
  const [command, ...args] = spec.trim().split(/\s+/);
  return { command, args };
}

/**
 * Run a command without a shell. Rejects on non-zero exit / spawn error.
 * @param {string|{command: string, args?: string[]}} spec
 * @param {{stdio?: string, cwd?: string, env?: object}} [options]
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function execCommand(spec, options = {}) {
  const { stdio = "pipe", cwd = process.cwd(), env = process.env } = options;
  const { command, args } = normalizeCommandSpec(spec);

  return new Promise((resolve, reject) => {
    const child = internals.spawn(command, args, { stdio, shell: false, cwd, env });

    let stdout = "";
    let stderr = "";

    if (stdio === "pipe") {
      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });
      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });
    }

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      const error = new Error(`Command failed with exit code ${code}`);
      error.stdout = stdout;
      error.stderr = stderr;
      error.code = code;
      reject(error);
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Should this failure be retried?
 * @param {Error} error
 * @returns {boolean}
 */
function isRetriableError(error) {
  const haystack = `${error?.stderr || ""}\n${error?.stdout || ""}\n${error?.message || ""}`;
  if (NON_RETRIABLE_PATTERN.test(haystack)) return false;
  return RETRIABLE_PATTERN.test(haystack);
}

/**
 * Execute a command with exponential backoff for network/registry failures.
 * @param {string|{command: string, args?: string[]}} spec
 * @param {object} [options]
 * @returns {Promise<{success: boolean, stdout: string, stderr: string, error?: Error}>}
 */
async function executeWithRetry(spec, options = {}) {
  const {
    maxRetries = DEFAULT_RETRY_CONFIG.maxRetries,
    baseDelay = DEFAULT_RETRY_CONFIG.baseDelay,
    maxDelay = DEFAULT_RETRY_CONFIG.maxDelay,
    backoffMultiplier = DEFAULT_RETRY_CONFIG.backoffMultiplier,
    stdio = "inherit",
    cwd,
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Executing (attempt ${attempt + 1}/${maxRetries + 1}): ${describe(spec)}`);
      const result = await internals.execCommand(spec, { stdio, cwd });
      return { success: true, ...result };
    } catch (error) {
      lastError = error;
      logger.warn(
        `Command failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`
      );

      if (attempt >= maxRetries || !isRetriableError(error)) break;

      const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt), maxDelay);
      logger.debug(`Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  return {
    success: false,
    stdout: lastError?.stdout || "",
    stderr: lastError?.stderr || lastError?.message || "",
    error: lastError,
  };
}

function describe(spec) {
  if (typeof spec === "string") return spec;
  return [spec.command, ...(spec.args || [])].join(" ");
}

/**
 * Install the given packages that are not installed yet.
 * @param {string[]} packageNames
 * @param {{isDev?: boolean, silent?: boolean, packageManager?: string, retry?: boolean, root?: string}} [options]
 * @returns {Promise<{success: boolean, installed: string[], skipped: string[], failed: string[]}>}
 */
async function installIfNeeded(packageNames = [], options = {}) {
  const {
    isDev = false,
    silent = false,
    packageManager = "npm",
    retry = true,
    root = process.cwd(),
  } = options;

  const result = { success: true, installed: [], skipped: [], failed: [] };

  if (!Array.isArray(packageNames) || packageNames.length === 0) {
    return result;
  }

  const pm = PACKAGE_MANAGERS[packageManager];
  if (!pm) {
    result.success = false;
    result.failed = [...packageNames];
    logger.error(`Package manager tidak dikenal: "${packageManager}"`);
    return result;
  }

  const toInstall = [];
  for (const pkg of packageNames) {
    if (internals.isPackageInstalled(pkg, root)) result.skipped.push(pkg);
    else toInstall.push(pkg);
  }

  if (toInstall.length === 0) {
    if (!silent) logger.success("Semua dependency sudah terpasang.");
    return result;
  }

  const spec = pm.install(toInstall, { saveDev: isDev, silent });
  if (!silent) {
    logger.info(`Memasang ${toInstall.length} package: ${toInstall.join(", ")}`);
    logger.debug(`Menggunakan package manager: ${packageManager}`);
  }

  const execResult = await executeWithRetry(spec, retry ? { cwd: root } : { maxRetries: 0, cwd: root });

  if (execResult.success) {
    result.installed = toInstall;
    if (!silent) logger.success(`Berhasil memasang ${toInstall.length} package`);
  } else {
    result.success = false;
    result.failed = toInstall;
    if (!silent) {
      logger.error(`Gagal memasang package: ${execResult.stderr}`);
    }
  }

  return result;
}

/**
 * Install a project's declared dependencies (`npm install` with no specs).
 * @param {{packageManager?: string, silent?: boolean, root?: string}} [options]
 * @returns {Promise<{success: boolean, stderr: string}>}
 */
async function installProjectDependencies(options = {}) {
  const { packageManager = "npm", silent = false, root = process.cwd() } = options;
  const pm = PACKAGE_MANAGERS[packageManager];
  if (!pm) {
    logger.error(`Package manager tidak dikenal: "${packageManager}"`);
    return { success: false, stderr: `Package manager tidak dikenal: "${packageManager}"` };
  }
  const spec = {
    command: packageManager,
    args: ["install", ...(silent ? [SILENT_FLAG] : [])],
  };
  const result = await executeWithRetry(spec, { cwd: root, stdio: silent ? "ignore" : "inherit" });
  return { success: result.success, stderr: result.stderr };
}

/**
 * Detect the package manager used by a project (lock-file based).
 * @param {string} [root] Project root (defaults to cwd - pass it explicitly
 *   when inspecting another directory).
 * @returns {"pnpm"|"yarn"|"bun"|"npm"}
 */
function getPackageManager(root = process.cwd()) {
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  if (
    fs.existsSync(path.join(root, "bun.lockb")) ||
    fs.existsSync(path.join(root, "bun.lock"))
  ) {
    return "bun";
  }
  if (fs.existsSync(path.join(root, "package-lock.json"))) return "npm";
  return "npm";
}

Object.assign(internals, {
  spawn,
  execCommand,
  isPackageInstalled,
  installIfNeeded,
});

module.exports = {
  installIfNeeded,
  installProjectDependencies,
  isPackageInstalled,
  getPackageManager,
  PACKAGE_MANAGERS,
  executeWithRetry,
  execCommand,
  isRetriableError,
  sleep,
  DEFAULT_RETRY_CONFIG,
  /** Injectable internals for test stubbing. */
  internals,
};
