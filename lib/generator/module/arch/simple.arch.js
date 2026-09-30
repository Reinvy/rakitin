/**
 * Simple-architecture module generator: `<module>/<module>.controller.js`,
 * `<module>.service.js`, `<module>.router.js` inside `app/modules/<kebab>/`.
 *
 * Returns `{ created, skipped }` (project-root-relative POSIX paths) and
 * writes only through the safety layer.
 */

const path = require("path");
const { getPaths } = require("../../../constants");
const { assertSafeName, getModuleVariants, toSafeFileName } = require("../../../naming");
const { writeFileIfNotExistsSafe, writeOutcome } = require("../../../safety");
const { relativePosix } = require("../../../utils");
const { renderModuleTemplate } = require("../../../template/module-templates");
const { generateServiceCode } = require("../../shared/orm-service-generator");
const { validateOrm } = require("../../shared/validation-utils");
const { moduleTemplateLocals, verbsForTemplate } = require("../verbs");

/**
 * @param {string} moduleName
 * @param {string} orm ORM display name (Prisma|Sequelize|TypeORM|Mongoose|None)
 * @param {{template?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
async function simpleArch(moduleName, orm, options = {}) {
  assertSafeName("module", moduleName);
  const ormValidation = validateOrm(orm);
  if (!ormValidation.isValid) throw new Error(ormValidation.message);

  const root = process.cwd();
  const variants = getModuleVariants(moduleName);
  const verbs = verbsForTemplate(options.template);
  const locals = moduleTemplateLocals({ ...variants, verbs });
  const modulePath = path.join(getPaths(root).modulesPath, variants.kebab);
  const fileBase = toSafeFileName(variants.kebab);

  const files = [
    {
      path: path.join(modulePath, `${fileBase}.controller.js`),
      content: renderModuleTemplate("controller.simple.ejs", locals),
    },
    {
      path: path.join(modulePath, `${fileBase}.service.js`),
      content: generateServiceCode(moduleName, orm, "Simple"),
    },
    {
      path: path.join(modulePath, `${fileBase}.router.js`),
      content: renderModuleTemplate("router.simple.ejs", locals),
    },
  ];

  const bucket = { created: [], skipped: [] };
  for (const file of files) {
    const result = writeFileIfNotExistsSafe(file.path, file.content);
    bucket[writeOutcome(result)].push(relativePosix(root, file.path));
  }
  return bucket;
}

module.exports = { simpleArch };
