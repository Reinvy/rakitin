/**
 * lib/generator/api/testfile/index.js - Jest test-file generator.
 *
 * Emits `tests/modules/<kebab>.test.js` for one module or for every module in
 * the detected project. Rendering is EJS-based (`lib/templates/test/`), so
 * `recipe test` and `add test` share the exact same output.
 *
 * Contract:
 *   generateTestFiles({ module, all, root }) -> { created, skipped, data }
 *   renderModuleTest({ module, root })       -> string
 *   ensureTestInfra(root)                    -> { created, skipped }
 */

const fs = require("fs");
const path = require("path");
const { assertSafeName, getModuleVariants } = require("../../../naming");
const { relativePosix } = require("../../../utils");
const { writeFileIfNotExistsSafe, writeOutcome } = require("../../../safety");
const { defaultEngine } = require("../../../template/engine");

const TEST_TEMPLATE = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "templates",
  "test",
  "module.test.ejs"
);

const TEST_DIR = path.join("tests", "modules");
const JEST_CONFIG = `/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
};
`;

const TEST_SETUP = "jest.setTimeout(15000);\n";

/**
 * Render the Jest test source for a single module.
 * @param {{module: string, root?: string}} params
 * @returns {string}
 */
function renderModuleTest({ module: moduleName, root } = {}) {
  const kebab = assertSafeName("module", moduleName);
  const variants = getModuleVariants(kebab);
  return defaultEngine.renderFile(TEST_TEMPLATE, {
    root,
    moduleName: kebab,
    kebab: variants.kebab,
    pascal: variants.pascal,
    camel: variants.camel,
  });
}

/**
 * Names of every module currently present in the project.
 * @param {string} root
 * @returns {string[]}
 */
function listModules(root) {
  const { detectProject } = require("../../../project/detector");
  const detected = detectProject(root);
  return detected.structure.modules.map((entry) => entry.name);
}

/**
 * Generate test files for one module or for every module.
 * @param {{module?: string, all?: boolean, root?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[], data: {modules: string[], dir: string}}>}
 */
async function generateTestFiles({ module: moduleName, all = false, root = process.cwd() } = {}) {
  let targets;

  if (all === true) {
    targets = listModules(root);
  } else {
    if (moduleName === undefined || moduleName === null || String(moduleName).trim() === "") {
      throw new Error("Tentukan modul (rakitin add test <module>) atau pakai --all.");
    }
    const kebab = assertSafeName("module", moduleName);
    const moduleDir = path.join(root, "app", "modules", kebab);
    if (!fs.existsSync(moduleDir)) {
      throw new Error(
        `Modul "${kebab}" tidak ditemukan. Buat dulu: rakitin add module ${kebab}`
      );
    }
    targets = [kebab];
  }

  const created = [];
  const skipped = [];
  const modules = [];

  for (const kebab of targets) {
    modules.push(kebab);
    const filePath = path.join(root, TEST_DIR, `${kebab}.test.js`);
    const content = renderModuleTest({ module: kebab, root });
    const verdict = writeFileIfNotExistsSafe(filePath, content);
    const relative = relativePosix(root, filePath);
    if (writeOutcome(verdict) === "created") created.push(relative);
    else skipped.push(relative);
  }

  return {
    created,
    skipped,
    data: { modules, dir: "tests/modules" },
  };
}

/**
 * Write the minimal Jest infrastructure (`jest.config.js` + `tests/setup.js`)
 * when absent. Dependency-free and idempotent.
 * @param {string} [root]
 * @returns {{created: string[], skipped: string[]}}
 */
function ensureTestInfra(root = process.cwd()) {
  const created = [];
  const skipped = [];

  const files = [
    { filePath: path.join(root, "jest.config.js"), content: JEST_CONFIG },
    { filePath: path.join(root, "tests", "setup.js"), content: TEST_SETUP },
  ];

  for (const { filePath, content } of files) {
    const verdict = writeFileIfNotExistsSafe(filePath, content);
    const relative = relativePosix(root, filePath);
    if (writeOutcome(verdict) === "created") created.push(relative);
    else skipped.push(relative);
  }

  return { created, skipped };
}

module.exports = { generateTestFiles, renderModuleTest, ensureTestInfra };
