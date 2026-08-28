/**
 * Package Installer - Cross-platform package installation with retry logic.
 * Supports: npm, pnpm, yarn, bun with exponential backoff.
 *
 * Uses `spawn(command, { shell: true })` which resolves the correct shell
 * (cmd.exe on Windows, /bin/sh on POSIX) - never hard-code `cmd /c`.
 */

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const logger = require("./utils/logger");
const { createErrorMessage } = require("./generator/shared/validation-utils");

/**
 * Supported package managers
 */
const PACKAGE_MANAGERS = {
  npm: {
    install: (packages, options = {}) => {
      const flags = ["install"];
      if (options.saveDev) flags.push("--save-dev");
      if (options.save) flags.push("--save");
      if (options.global) flags.push("-g");
      if (options.silent) flags.push("--silent");
      return `npm ${flags.join(" ")} ${packages.join(" ")}`;
    },
    uninstall: (packages, options = {}) => {
      const flags = ["uninstall"];
      if (options.saveDev) flags.push("--save-dev");
      if (options.global) flags.push("-g");
      return `npm ${flags.join(" ")} ${packages.join(" ")}`;
    },
  },
  pnpm: {
    install: (packages, options = {}) => {
      const flags = ["add"];
      if (options.saveDev) flags.push("-D");
      if (options.global) flags.push("-g");
      return `pnpm ${flags.join(" ")} ${packages.join(" ")}`;
    },
    uninstall: (packages, options = {}) => {
      const flags = ["remove"];
      if (options.saveDev) flags.push("-D");
      if (options.global) flags.push("-g");
      return `pnpm ${flags.join(" ")} ${packages.join(" ")}`;
    },
  },
  yarn: {
    install: (packages, options = {}) => {
      const flags = ["add"];
      if (options.saveDev) flags.push("--dev");
      if (options.global) flags.push("--global");
      return `yarn ${flags.join(" ")} ${packages.join(" ")}`;
    },
    uninstall: (packages, options = {}) => {
      const flags = ["remove"];
      if (options.saveDev) flags.push("--dev");
      return `yarn ${flags.join(" ")} ${packages.join(" ")}`;
    },
  },
  bun: {
    install: (packages, options = {}) => {
      const flags = ["add"];
      if (options.saveDev) flags.push("--dev");
      if (options.global) flags.push("--global");
      return `bun ${flags.join(" ")} ${packages.join(" ")}`;
    },
    uninstall: (packages, options = {}) => {
      const flags = ["remove"];
      if (options.saveDev) flags.push("--dev");
      return `bun ${flags.join(" ")} ${packages.join(" ")}`;
    },
  },
};

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Extract base package name ignoring version specifiers (e.g. '@prisma/client@^7' -> '@prisma/client')
 */
function getBasePackageName(pkg) {
  if (!pkg) return "";
  if (pkg.startsWith("@")) {
    const parts = pkg.slice(1).split("@");
    return "@" + parts[0];
  }
  return pkg.split("@")[0];
}

/**
 * Check if package is installed (sync)
 * @param {string} packageName - Package name to check
 * @returns {boolean} - True if installed, false otherwise
 */
function isPackageInstalled(packageName) {
  try {
    const baseName = getBasePackageName(packageName);
    // Check node_modules first
    const nodeModulesPath = path.join(process.cwd(), "node_modules", baseName);
    if (fs.existsSync(nodeModulesPath)) {
      return true;
    }

    // Check package.json dependencies
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      return !!(
        (packageJson.dependencies && packageJson.dependencies[baseName]) ||
        (packageJson.devDependencies && packageJson.devDependencies[baseName])
      );
    }

    return false;
  } catch (error) {
    logger.debug(`Error checking package ${packageName}:`, error.message);
    return false;
  }
}

/**
 * Async version of isPackageInstalled
 * @param {string} packageName - Package name to check
 * @returns {Promise<boolean>}
 */
async function isPackageInstalledAsync(packageName) {
  return new Promise((resolve) => {
    resolve(isPackageInstalled(packageName));
  });
}

/**
 * Injectable internals - allows tests to stub shell execution and package
 * checks without mocking Node modules or touching the network.
 * Populated at the bottom of this file (function declarations hoist).
 */
const internals = {};

/**
 * Execute command with retry logic and exponential backoff
 * @param {string} command - Command to execute
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} - { success: boolean, stdout: string, stderr: string }
 */
async function executeWithRetry(command, options = {}) {
  const {
    maxRetries = DEFAULT_RETRY_CONFIG.maxRetries,
    baseDelay = DEFAULT_RETRY_CONFIG.baseDelay,
    maxDelay = DEFAULT_RETRY_CONFIG.maxDelay,
    backoffMultiplier = DEFAULT_RETRY_CONFIG.backoffMultiplier,
    stdio = "inherit",
  } = options;

  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      logger.debug(`Executing (attempt ${attempt + 1}/${maxRetries + 1}): ${command}`);

      const result = await internals.execCommand(command, { stdio });

      logger.debug(`Command succeeded on attempt ${attempt + 1}`);
      return { success: true, ...result };
    } catch (error) {
      lastError = error;
      logger.warn(
        `Command failed (attempt ${attempt + 1}/${maxRetries + 1}): ${error.message}`
      );

      if (attempt < maxRetries) {
        // Calculate delay with exponential backoff
        const delay = Math.min(
          baseDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );
        logger.debug(`Retrying in ${delay}ms...`);

        await sleep(delay);
      }
    }
  }

  return {
    success: false,
    stdout: lastError?.stdout || "",
    stderr: lastError?.stderr || lastError?.message || "",
    error: lastError,
  };
}

/**
 * Execute shell command asynchronously, on any platform.
 * `spawn(command, { shell: true })` lets Node pick the right shell
 * (cmd.exe / command.com on Windows, /bin/sh on POSIX).
 * @param {string} command - Command to execute
 * @param {Object} options - Options
 * @returns {Promise<Object>} - { stdout: string, stderr: string }
 */
function execCommand(command, options = {}) {
  return new Promise((resolve, reject) => {
    const { stdio = "pipe", cwd = process.cwd(), env = process.env } = options;

    const child = spawn(command, {
      stdio,
      shell: true,
      cwd,
      env,
    });

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
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        error.code = code;
        reject(error);
      }
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Install packages if needed (async with retry)
 * @param {string[]} packageNames - List of package names to install
 * @param {Object} options - Installation options
 * @returns {Promise<Object>} - { success: boolean, installed: string[], failed: string[] }
 */
async function installIfNeeded(packageNames = [], options = {}) {
  const { isDev = false, silent = false, packageManager = "npm", retry = true } = options;

  const result = {
    success: true,
    installed: [],
    failed: [],
  };

  // Validate input
  if (!Array.isArray(packageNames) || packageNames.length === 0) {
    if (!silent) logger.warn("No packages to install.");
    return result;
  }

  // Filter packages that are not installed (routed through internals for testability)
  const packagesToInstall = packageNames.filter(
    (pkg) => !internals.isPackageInstalled(pkg)
  );

  if (packagesToInstall.length === 0) {
    if (!silent) logger.success("All packages already installed.");
    return result;
  }

  // Get package manager
  const pm = PACKAGE_MANAGERS[packageManager] || PACKAGE_MANAGERS.npm;
  const installCommand = pm.install(packagesToInstall, { saveDev: isDev, silent });

  if (!silent) {
    logger.info(
      `Installing ${packagesToInstall.length} packages: ${packagesToInstall.join(", ")}`
    );
    logger.debug(`Using package manager: ${packageManager}`);
  }

  // Execute installation with retry
  const execOptions = retry ? {} : { maxRetries: 0 };

  try {
    const execResult = await executeWithRetry(installCommand, execOptions);

    if (execResult.success) {
      result.installed = packagesToInstall;
      if (!silent) {
        logger.success(`Successfully installed ${packagesToInstall.length} packages`);
      }
    } else {
      result.success = false;
      result.failed = packagesToInstall;

      const errorMessage = createErrorMessage(
        "system",
        `installing packages: ${execResult.stderr}`
      );
      if (!silent) {
        logger.error(errorMessage);
      }
    }
  } catch (error) {
    result.success = false;
    result.failed = packagesToInstall;

    const errorMessage = createErrorMessage(
      "system",
      `installing packages: ${error.message}`
    );
    if (!silent) {
      logger.error(errorMessage);
    }
  }

  return result;
}

/**
 * Install packages synchronously (legacy support)
 * @param {string[]} packageNames - List of package names
 * @param {Object} options - Installation options
 * @returns {Object} - { success: boolean, installed: string[], failed: string[] }
 */
function installIfNeededSync(packageNames = [], options = {}) {
  const { isDev = false, silent = false, packageManager = "npm" } = options;

  const result = {
    success: true,
    installed: [],
    failed: [],
  };

  if (!Array.isArray(packageNames) || packageNames.length === 0) {
    if (!silent) logger.warn("No packages to install.");
    return result;
  }

  const packagesToInstall = packageNames.filter((pkg) => !isPackageInstalled(pkg));

  if (packagesToInstall.length === 0) {
    if (!silent) logger.success("All packages already installed.");
    return result;
  }

  const pm = PACKAGE_MANAGERS[packageManager] || PACKAGE_MANAGERS.npm;
  const installCommand = pm.install(packagesToInstall, { saveDev: isDev, silent: true });

  try {
    execSync(installCommand, { stdio: silent ? "pipe" : "inherit" });
    result.installed = packagesToInstall;
    if (!silent) {
      logger.success(`Successfully installed ${packagesToInstall.length} packages`);
    }
  } catch (error) {
    result.success = false;
    result.failed = packagesToInstall;
    if (!silent) {
      logger.error(`Failed to install packages: ${error.message}`);
    }
  }

  return result;
}

/**
 * Install ORM packages based on type
 * @param {string} orm - ORM type
 * @param {Object} options - Installation options
 * @returns {Promise<Object>} - { success: boolean, installed: string[], failed: string[] }
 */
async function installOrmPackages(orm, options = {}) {
  const ormPackages = {
    Prisma: ["@prisma/client", "prisma"],
    Sequelize: ["sequelize", "mysql2"],
    Mongoose: ["mongoose"],
    TypeORM: ["typeorm", "reflect-metadata"],
  };

  if (!orm || !ormPackages[orm]) {
    logger.warn(`Unknown ORM "${orm}". No packages to install.`);
    return { success: true, installed: [], failed: [] };
  }

  return internals.installIfNeeded(ormPackages[orm], options);
}

/**
 * Detect the package manager used by the current project (lock-file based).
 * @returns {string} One of: pnpm, yarn, bun, npm.
 */
function getPackageManager() {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  if (
    fs.existsSync(path.join(cwd, "bun.lockb")) ||
    fs.existsSync(path.join(cwd, "bun.lock"))
  ) {
    return "bun";
  }
  if (fs.existsSync(path.join(cwd, "package-lock.json"))) {
    return "npm";
  }

  // Default to npm
  return "npm";
}

/**
 * Check if a command is available on PATH (cross-platform).
 * @param {string} command - Command name
 * @returns {boolean}
 */
function isCommandAvailable(command) {
  try {
    // `command --version` via shell works on both cmd.exe and POSIX shells.
    execSync(`${command} --version`, { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get available package managers
 * @returns {string[]}
 */
function getAvailablePackageManagers() {
  return Object.keys(PACKAGE_MANAGERS).filter((pm) => isCommandAvailable(pm));
}

// Populate injectable internals (function declarations are hoisted,
// so all references are defined by the time callers execute).
Object.assign(internals, {
  execCommand,
  isPackageInstalled,
  installIfNeeded,
});

// Export for CommonJS
module.exports = {
  // Installation functions
  installIfNeeded,
  installIfNeededSync,
  installOrmPackages,

  // Package checking
  isPackageInstalled,
  isPackageInstalledAsync,

  // Package manager utilities
  getPackageManager,
  isCommandAvailable,
  getAvailablePackageManagers,
  PACKAGE_MANAGERS,

  // Execution utilities
  executeWithRetry,
  execCommand,
  /** Injectable internals for test stubbing. */
  internals,
  sleep,

  // Retry configuration
  DEFAULT_RETRY_CONFIG,
};

// Export for ESM compatibility
module.exports.__esModule = true;
module.exports.default = module.exports;
