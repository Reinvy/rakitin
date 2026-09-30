/**
 * "None" ORM integration - generates a module WITHOUT any database layer.
 *
 * The service layer (rendered from `service-none.ejs`) uses an in-memory
 * store so the module is fully functional out of the box. Swapping to a real
 * database later only touches `<module>.service.js`; the controller and
 * router layers stay untouched.
 */

const { ensureDir } = require("../../../utils");

/**
 * @param {string} moduleName
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
async function noneORM(moduleName) {
  if (!moduleName) throw new Error("Nama modul harus didefinisikan");
  return { created: [], skipped: [] };
}

module.exports = { noneORM, ensureDir };
