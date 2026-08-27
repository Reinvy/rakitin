/**
 * lib/commands/add.js - Headless `rakitin add <thing> [name]`.
 *
 * Flags (context) fully bypass interactive prompts:
 *   rakitin add module user --orm none --arch modular --yes
 *   rakitin add middleware auth
 *   rakitin add config jwt
 *
 * All writes flow through the safety layer; dependencies resolve through
 * the unified manifest with the detected package manager.
 */

const inquirer = require("inquirer");
const { simpleArch, modularArch } = require("../generator/module/arch/arch");
const { createMiddleware } = require("../generator/middleware/middleware");
const { createConfig } = require("../generator/config/config");
const generateEndpointCmd = require("../generator/api/endpoint");
const generateValidationCmd = require("../generator/api/validation");
const generateDocumentationCmd = require("../generator/api/documentation");
const { ensureDependencies, ormToKind } = require("../deps/manifest");
const logger = require("../utils/logger");

/**
 * @param {"module"|"middleware"|"util"|"config"|"endpoint"|"validation"|"docs"} thing
 * @param {string|undefined} name
 * @param {object} context result of buildContext()
 */
async function addCommand(thing, name, context) {
  switch (thing) {
    case "module":
      return addModule(name, context);
    case "middleware":
      return addMiddleware(name, context);
    case "config":
      return addConfig(name, context);
    case "endpoint":
      return generateEndpointCmd();
    case "validation":
      return generateValidationCmd();
    case "docs":
      return generateDocumentationCmd();
    default:
      throw new Error(
        `Generator tidak dikenal: "${thing}". Lihat 'rakitin list'.`
      );
  }
}

// ---------------------------------------------------------------------------
// module
// ---------------------------------------------------------------------------

async function addModule(name, context) {
  let moduleName = name;
  let architecture = (context.arch || "").toLowerCase();
  let orm = context.orm;

  // Fill missing decisions interactively ONLY when not running unattended.
  const needPrompts =
    !moduleName || !architecture || orm === undefined || orm === null;
  if (!context.yes && needPrompts) {
    const answers = await inquirer.default.prompt([
      {
        type: "input",
        name: "moduleName",
        message: "Nama modul:",
        when: !moduleName,
        validate: (v) => Boolean(String(v).trim()) || "Nama modul wajib diisi",
      },
      {
        type: "list",
        name: "architecture",
        message: "Arsitektur modul:",
        choices: ["Simple", "Modular"],
        when: !architecture,
      },
      {
        type: "confirm",
        name: "useORM",
        message: "Gunakan ORM?",
        default: true,
        when: orm === null || orm === undefined,
      },
      {
        type: "list",
        name: "ormChoice",
        message: "Pilih ORM:",
        choices: ["Prisma", "Sequelize", "Mongoose", "TypeORM", "None"],
        when: (a) => a.useORM === true,
      },
    ]);
    moduleName = moduleName || answers.moduleName;
    architecture = architecture || answers.architecture;
    orm = orm !== null && orm !== undefined ? orm : answers.ormChoice || "None";
  }

  if (!moduleName) throw new Error("Nama modul wajib ada (--yes tanpa nama tidak valid).");
  architecture = architecture || "modular";

  // Normalize ORM naming ("none"/"no-orm" -> None)
  const ormName =
    typeof orm === "string"
      ? orm.toLowerCase() === "none"
        ? "None"
        : orm.charAt(0).toUpperCase() + orm.slice(1).toLowerCase()
      : "None";

  const archFn = architecture === "simple" ? simpleArch : modularArch;

  const summary = await runGeneration(`Generating ${moduleName} module...`, () =>
    archFn(moduleName, ormName)
  );

  // Headless parity with the interactive flow: actual ORM side-effect
  // files (Prisma model+db.js, Sequelize/Mongoose models, TypeORM entity
  // + data-source) must be generated, not just referenced in the service.
  if (ormName !== "None") {
    const orm = require("../generator/module/orm/orm");
    const ormFn = {
      Prisma: orm.prismaORM,
      Sequelize: orm.sequelizeORM,
      Mongoose: orm.mongooseORM,
      TypeORM: orm.typeormORM,
    }[ormName];

    if (ormFn) {
      await ormFn(
        moduleName,
        architecture === "simple" ? "Simple" : "Modular"
      );
    }
  }

  // One-shot dependency resolution for the whole kind set.
  let installResult = { success: true };
  if (context.install && ormName !== "None") {
    installResult = await ensureDependencies([ormToKind(ormName)], {
      silent: !!context.json,
      pm: context.pm,
    });
  }

  return {
    createdFiles: summary?.createdFiles,
    skipped: summary?.skipped,
    nextSteps: buildModuleNextSteps(moduleName, architecture, ormName),
    meta: { installResult },
  };
}

function runGeneration(label, fn) {
  const { withSpinner } = require("./shared");
  return withSpinner(label, fn);
}

function buildModuleNextSteps(moduleName, architecture, orm) {
  const steps = [
    `Wire module '${moduleName}' ke router utama: rakitin integrate`,
  ];
  if (orm !== "None") {
    steps.push("Periksa kredensial database di .env lalu jalankan migration/push sesuai ORM Anda");
  }
  steps.push("Tambahkan resource endpoint: rakitin add endpoint <resource>");
  return steps;
}

// ---------------------------------------------------------------------------
// middleware / config
// ---------------------------------------------------------------------------

async function addMiddleware(kindOrName, context) {
  const type = (kindOrName || "custom").toLowerCase();
  if (!context.yes && type === "custom") {
    const { customName } = await inquirer.default.prompt([
      { type: "input", name: "customName", message: "Nama middleware custom:" },
    ]);
    return createMiddleware(type, customName);
  }
  const result = await createMiddleware(type);

  // Manifest-driven deps so generated imports never dangle.
  if (result.created && context.install) {
    await ensureDependencies([`middleware:${type}`], {
      silent: !!context.json,
      pm: context.pm,
    });
  }
  return {
    ...result,
    nextSteps: [
      "Regenerate router integrasi bila ingin middleware ini global: rakitin integrate",
    ],
  };
}

async function addConfig(kindOrName, context) {
  const type = (kindOrName || "app").toLowerCase();
  return createConfig(type, { withEnvExample: true });
}

module.exports = { addCommand };
