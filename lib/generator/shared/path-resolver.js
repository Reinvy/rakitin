const path = require("path");
const fs = require("fs");

/**
 * Path Resolver untuk menangani path resolution dengan konsisten
 * di seluruh proyek rakitin
 */
class PathResolver {
  /**
   * Mendapatkan path absolut untuk file router modular
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {string} Path absolut ke file router
   */
  static getModularRouterPath(moduleName, basePath) {
    const kebabName = this.normalizeModuleName(moduleName);
    return path.join(basePath, "modules", kebabName, "routes", `${kebabName}.router.js`);
  }

  /**
   * Mendapatkan path absolut untuk file router simple
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {string} Path absolut ke file router
   */
  static getSimpleRouterPath(moduleName, basePath) {
    const kebabName = this.normalizeModuleName(moduleName);
    return path.join(basePath, "modules", kebabName, `${kebabName}.router.js`);
  }

  /**
   * Mendapatkan path absolut untuk file controller simple
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {string} Path absolut ke file controller
   */
  static getSimpleControllerPath(moduleName, basePath) {
    const kebabName = this.normalizeModuleName(moduleName);
    return path.join(basePath, "modules", kebabName, `${kebabName}.controller.js`);
  }

  /**
   * Mendapatkan path absolut untuk file controller modular
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {string} Path absolut ke file controller
   */
  static getModularControllerPath(moduleName, basePath) {
    const kebabName = this.normalizeModuleName(moduleName);
    return path.join(
      basePath,
      "modules",
      kebabName,
      "controllers",
      `${kebabName}.controller.js`
    );
  }

  /**
   * Mendapatkan path relatif untuk import router modular
   * @param {string} moduleName - Nama modul
   * @returns {string} Path relatif untuk import
   */
  static getModularRouterImportPath(moduleName) {
    const kebabName = this.normalizeModuleName(moduleName);
    return `../modules/${kebabName}/routes/${kebabName}.router.js`;
  }

  /**
   * Mendapatkan path relatif untuk import router simple
   * @param {string} moduleName - Nama modul
   * @returns {string} Path relatif untuk import
   */
  static getSimpleRouterImportPath(moduleName) {
    const kebabName = this.normalizeModuleName(moduleName);
    return `../modules/${kebabName}/${kebabName}.router.js`;
  }

  /**
   * Mendapatkan path relatif untuk import controller simple
   * @param {string} moduleName - Nama modul
   * @returns {string} Path relatif untuk import
   */
  static getSimpleControllerImportPath(moduleName) {
    const kebabName = this.normalizeModuleName(moduleName);
    return `../modules/${kebabName}/${kebabName}.controller.js`;
  }

  /**
   * Mendapatkan path relatif untuk import controller modular
   * @param {string} moduleName - Nama modul
   * @returns {string} Path relatif untuk import
   */
  static getModularControllerImportPath(moduleName) {
    const kebabName = this.normalizeModuleName(moduleName);
    return `../modules/${kebabName}/controllers/${kebabName}.controller.js`;
  }

  /**
   * Normalisasi nama modul ke kebab-case
   * @param {string} moduleName - Nama modul yang akan dinormalisasi
   * @returns {string} Nama modul dalam format kebab-case
   */
  static normalizeModuleName(moduleName) {
    if (typeof moduleName !== "string" || !moduleName) {
      throw new Error("Nama modul harus berupa string yang tidak kosong");
    }

    return moduleName
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/\s+/g, "-")
      .toLowerCase();
  }

  /**
   * Memastikan direktori ada untuk path yang diberikan
   * @param {string} filePath - Path file
   */
  static ensureDirectoryExists(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Mendapatkan path absolut untuk modul
   * @param {string} moduleName - Nama modul
   * @param {string} basePath - Path dasar proyek
   * @returns {string} Path absolut ke direktori modul
   */
  static getModulePath(moduleName, basePath) {
    const kebabName = this.normalizeModuleName(moduleName);
    return path.join(basePath, "modules", kebabName);
  }

  /**
   * Memvalidasi bahwa path yang diberikan valid untuk sistem file
   * @param {string} filePath - Path yang akan divalidasi
   * @returns {boolean} True jika path valid
   */
  static isValidPath(filePath) {
    try {
      path.normalize(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = PathResolver;
