const path = require("path");
const { modulesPath } = require("../../../constants");
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
} = require("../../../utils");
const { generateServiceCode } = require("../../shared/orm-service-generator");
const {
  validateModuleName,
  validateOrm,
  handleError
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
    const modulePath = path.join(modulesPath, kebabName);

    const dirs = ["controllers", "services", "models", "routes"];
    dirs.forEach((dir) => ensureDir(path.join(modulePath, dir)));

    writeFileIfNotExists(
      path.join(modulePath, "controllers", `${kebabName}.controller.js`),
      `// ${moduleName} Controller
const { getAll } = require("../services/${kebabName}.service");

exports.getAll = async (req, res, next) => {
  try {
    const data = await getAll(req);
    res.status(200).json({
      message: "Berhasil mendapatkan data",
      data,
    });
  } catch (err) {
    next(err);
  }
};`
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
      `// ${moduleName} Routes
const express = require("express");
const router = express.Router();
const { getAll } = require("../controllers/${kebabName}.controller");

router.get("/", getAll);

module.exports = router;`
    );
  } catch (error) {
    handleError("pembuatan modul modular", error);
  }
}

module.exports = { modularArch };
