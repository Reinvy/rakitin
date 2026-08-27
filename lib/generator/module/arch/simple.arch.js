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
 * Membuat struktur modul dengan arsitektur sederhana
 * @param {string} moduleName - Nama modul yang akan dibuat
 * @param {string} orm - Jenis ORM yang digunakan
 */
async function simpleArch(moduleName, orm) {
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

    const controllerPath = path.join(modulePath, `${kebabName}.controller.js`);
    const servicePath = path.join(modulePath, `${kebabName}.service.js`);
    const routerPath = path.join(modulePath, `${kebabName}.router.js`);

    ensureDir(modulePath);
    writeFileIfNotExists(
      controllerPath,
      renderModuleTemplate("controller.simple.ejs", {
        moduleName,
        kebabName,
      })
    );
    writeFileIfNotExists(
      servicePath,
      generateServiceCode(moduleName, orm, "Simple") // Menggunakan fungsi bersama untuk generate service code
    );
    writeFileIfNotExists(
      routerPath,
      renderModuleTemplate("router.simple.ejs", {
        moduleName,
        kebabName,
      })
    );
  } catch (error) {
    handleError("pembuatan modul sederhana", error);
  }
}

module.exports = { simpleArch };
