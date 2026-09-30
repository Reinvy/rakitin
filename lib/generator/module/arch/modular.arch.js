/**
 * Modular-architecture module generator:
 * `app/modules/<kebab>/{controllers,services,models,routes}/…`.
 *
 * Returns `{ created, skipped }` (project-root-relative POSIX paths).
 * The `models/<kebab>.model.js` placeholder is written ONLY for the "None"
 * ORM - real ORMs own that path (a placeholder there used to shadow the real
 * model, which broke every sequelize/mongoose module at boot).
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
async function modularArch(moduleName, orm, options = {}) {
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
      path: path.join(modulePath, "controllers", `${fileBase}.controller.js`),
      content: renderModuleTemplate("controller.modular.ejs", locals),
    },
    {
      path: path.join(modulePath, "services", `${fileBase}.service.js`),
      content: generateServiceCode(moduleName, orm, "Modular"),
    },
    {
      path: path.join(modulePath, "routes", `${fileBase}.router.js`),
      content: renderModuleTemplate("router.modular.ejs", locals),
    },
  ];

  if (orm === "None") {
    files.push({
      path: path.join(modulePath, "models", `${fileBase}.model.js`),
      content: `// ${variants.pascal} Model
// Modul ini memakai in-memory store (ORM: None).
// Tulis schema/ORM model di sini setelah beralih ke database nyata.
`,
    });
  }

  const bucket = { created: [], skipped: [] };
  for (const file of files) {
    const result = writeFileIfNotExistsSafe(file.path, file.content);
    bucket[writeOutcome(result)].push(relativePosix(root, file.path));
  }
  return bucket;
}

module.exports = { modularArch };
