/**
 * "None" ORM integration - generates a module WITHOUT any database layer.
 *
 * The service layer produced by generateServiceCode("None") uses an
 * in-memory store so the module is fully functional out of the box.
 * Swapping to a real database later only touches <module>.service.js -
 * controller/router layers stay untouched.
 */

const { getPaths } = require("../../../constants");
const { writeFileIfNotExists } = require("../../../utils");

/**
 * Run the "None" ORM flow: nothing to install or scaffold beyond the
 * service layer itself, but we make sure app/shared structure exists.
 * @param {string} moduleName - Nama modul
 * @param {string} [architecture] - Jenis arsitektur ("Simple" | "Modular")
 */
async function noneORM(moduleName) {
  const p = getPaths();
  // Ensure shared config dir exists so future DB integrations have a home.
  const fs = require("fs");
  fs.mkdirSync(p.sharedPath, { recursive: true });

  console.log(
    `ℹ️  Modul "${moduleName}" dibuat TANPA ORM. Service memakai in-memory store - ganti operasinya dengan database kapan pun siap.`
  );
}

module.exports = { noneORM };
