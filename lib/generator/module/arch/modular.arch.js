const path = require("path");
const { getPaths } = require("../../../constants");
const { ensureDir, writeFileIfNotExists, toKebabCase } = require("../../../utils");
const { renderModuleTemplate } = require("../../../template/module-templates");
const { generateServiceCode } = require("../../shared/orm-service-generator");
const {
  validateModuleName,
  validateOrm,
  handleError,
} = require("../../shared/validation-utils");

/**
 * Membuat struktur modul dengan arsitektur modular
 * @param {string} moduleName - Nama modul yang akan dibuat
 * @param {string} orm - Jenis ORM yang digunakan
 */
async function modularArch(moduleName, orm) {
  try {
    // Validasi input
    const moduleValidation = validateModuleName(moduleName);
    if (!moduleValidation.isValid) {
      throw new Error(moduleValidation.message);
    }

    const ormValidation = validateOrm(orm);
    if (!ormValidation.isValid) {
      throw new Error(ormValidation.message);
    }

    const kebabName = toKebabCase(moduleName);
    // Resolve lazily so tests/processes can point cwd elsewhere safely.
    const modulePath = path.join(getPaths().modulesPath, kebabName);

    const dirs = ["controllers", "services", "models", "routes"];
    dirs.forEach((dir) => ensureDir(path.join(modulePath, dir)));

    writeFileIfNotExists(
      path.join(modulePath, "controllers", `${kebabName}.controller.js`),
      renderModuleTemplate("controller.modular.ejs", {
        moduleName,
        kebabName,
      })
    );

    writeFileIfNotExists(
      path.join(modulePath, "services", `${kebabName}.service.js`),
      generateServiceCode(moduleName, orm, "Modular") // Menggunakan fungsi bersama untuk generate service code
    );

    writeFileIfNotExists(
      path.join(modulePath, "models", `${kebabName}.model.js`),
      `// ${moduleName} Model
// Schema atau ORM Model bisa ditulis di sini.`
    );

    writeFileIfNotExists(
      path.join(modulePath, "routes", `${kebabName}.router.js`),
      renderModuleTemplate("router.modular.ejs", {
        moduleName,
        kebabName,
      })
    );
  } catch (error) {
    handleError("pembuatan modul modular", error);
  }
}

module.exports = { modularArch };
