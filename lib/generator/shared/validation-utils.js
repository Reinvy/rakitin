/**
 * lib/generator/shared/validation-utils.js - ORM name validator.
 *
 * Module/identifier safety lives in `lib/naming.js` (`assertSafeName`,
 * `toIdentifier`); this module only keeps the `{isValid, message}` shape
 * the module-architecture generators use for the ORM flag.
 */

const VALID_ORMS = ["Prisma", "Sequelize", "TypeORM", "Mongoose", "None"];

/**
 * @param {string} orm
 * @returns {{isValid: boolean, message: string}}
 */
function validateOrm(orm) {
  if (!orm) return { isValid: false, message: "ORM tidak boleh kosong" };
  if (typeof orm !== "string") {
    return { isValid: false, message: "ORM harus berupa string" };
  }
  if (!VALID_ORMS.includes(orm)) {
    return {
      isValid: false,
      message: `ORM tidak valid. Pilihan yang tersedia: ${VALID_ORMS.join(", ")}`,
    };
  }
  return { isValid: true, message: "ORM valid" };
}

module.exports = { VALID_ORMS, validateOrm };
