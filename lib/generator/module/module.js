const inquirer = require("inquirer");
const { simpleArch, modularArch } = require("./arch/arch");
const { prismaORM, sequelizeORM, mongooseORM, typeormORM } = require("./orm/orm");
const { installOrmPackages } = require("../../installer");
const { Config } = require("../../config");
const {
  validateModuleName,
  validateOrm,
  validateArchitecture,
  handleError,
  createErrorMessage,
} = require("../shared/validation-utils");

/**
 * Membuat modul baru dengan validasi input yang lebih baik
 */
async function generateModule() {
  try {
    let configuredOrm = "prisma";
    let configuredArch = "modular";
    let autoIntegrate = true;

    try {
      const config = new Config().load(process.cwd());
      const rawOrm = config.get("orm") || config.get("defaultORM");
      const rawArch = config.get("defaultArchitecture");
      if (rawOrm || rawArch) {
        if (rawOrm) configuredOrm = rawOrm.toLowerCase();
        if (rawArch) configuredArch = rawArch.toLowerCase();
        if (config.get("autoIntegrateRouter") !== undefined) {
          autoIntegrate = Boolean(config.get("autoIntegrateRouter"));
        }
      }
    } catch {
      // fallback to defaults
    }

    const defaultOrmName =
      configuredOrm === "typeorm"
        ? "TypeORM"
        : configuredOrm === "none"
          ? "None"
          : configuredOrm.charAt(0).toUpperCase() + configuredOrm.slice(1).toLowerCase();

    const defaultArchName = configuredArch === "simple" ? "Simple" : "Modular";

    let architecture = defaultArchName;
    let useORM = defaultOrmName === "None" ? "No" : "Yes";
    let orm = defaultOrmName;
    let autoIntegrateRouter = autoIntegrate;
    let routerArchitecture = configuredArch;

    const configCandidateFiles = [".rakitinrc.json", ".rakitinrc", "rakitin.config.js", "rakitin.config.json"];
    const hasConfigFile = configCandidateFiles.some((f) => {
      try {
        return require("fs").existsSync(require("path").join(process.cwd(), f));
      } catch {
        return false;
      }
    });

    if (hasConfigFile) {
      console.log(`📦 Konfigurasi aktif: Arsitektur ${defaultArchName}, ORM ${defaultOrmName}`);
    }

    const answers = await inquirer.default.prompt([
      {
        type: "input",
        name: "moduleName",
        message: "Nama modul:",
        validate: (input) => {
          const validation = validateModuleName(input);
          return validation.isValid ? true : validation.message;
        },
      },
      {
        type: "select",
        name: "architecture",
        message: "Pilih arsitektur:",
        choices: ["Simple", "Modular"],
        default: defaultArchName,
        when: !hasConfigFile,
      },
      {
        type: "select",
        name: "useORM",
        message: "Apakah ingin menggunakan ORM?",
        choices: ["Yes", "No"],
        default: defaultOrmName === "None" ? "No" : "Yes",
        when: !hasConfigFile,
      },
      {
        type: "select",
        name: "orm",
        message: "Pilih ORM/Database:",
        choices: ["Prisma", "Sequelize", "Mongoose", "TypeORM"],
        default: defaultOrmName === "None" ? "Prisma" : defaultOrmName,
        when: (a) => !hasConfigFile && a.useORM === "Yes",
      },
      {
        type: "confirm",
        name: "autoIntegrateRouter",
        message: "Apakah ingin secara otomatis mengintegrasikan modul ini ke router utama?",
        default: autoIntegrate,
        when: !hasConfigFile,
      },
      {
        type: "select",
        name: "routerArchitecture",
        message: "Pilih arsitektur router:",
        choices: [
          { name: "Modular (setiap modul memiliki router terpisah)", value: "modular" },
          { name: "Simple (semua route dalam satu file)", value: "simple" },
        ],
        default: "modular",
        when: (a) => !hasConfigFile && a.autoIntegrateRouter,
      },
    ]);

    const moduleName = answers.moduleName;
    architecture = answers.architecture || defaultArchName;
    useORM = answers.useORM || (defaultOrmName === "None" ? "No" : "Yes");
    orm = answers.orm || (useORM === "No" ? "None" : defaultOrmName);
    autoIntegrateRouter =
      answers.autoIntegrateRouter !== undefined
        ? answers.autoIntegrateRouter
        : autoIntegrate;
    routerArchitecture = answers.routerArchitecture || configuredArch || "modular";

    // Validasi input tambahan
    const archValidation = validateArchitecture(architecture);
    if (!archValidation.isValid) {
      throw new Error(archValidation.message);
    }

    // Jika menggunakan ORM, validasi pilihan ORM
    if (useORM === "Yes") {
      const ormValidation = validateOrm(orm);
      if (!ormValidation.isValid) {
        throw new Error(ormValidation.message);
      }
    }

    // Buat modul sesuai arsitektur yang dipilih
    if (architecture === "Simple") {
      await simpleArch(moduleName, useORM === "Yes" ? orm : "None");
      await setupOrmIntegration(useORM, orm, architecture, moduleName);
    } else if (architecture === "Modular") {
      await modularArch(moduleName, useORM === "Yes" ? orm : "None");
      await setupOrmIntegration(useORM, orm, architecture, moduleName);
    }

    // Integrasi otomatis dengan router jika dipilih
    if (autoIntegrateRouter) {
      const { integrateAutoRouter } = require("../router/router");
      await integrateAutoRouter({
        autoDetect: true,
        architecture: routerArchitecture || "modular",
        middlewares: [],
      });
    }

    console.log(
      `\n✅ Modul "${moduleName}" berhasil dibuat dengan arsitektur ${architecture}${
        useORM === "Yes" ? ` dan ORM ${orm}` : ""
      }${autoIntegrateRouter ? " dan sudah diintegrasikan ke router utama" : ""}\n`
    );
  } catch (error) {
    handleError("pembuatan modul", error);
  }
}

/**
 * Mengatur integrasi ORM berdasarkan pilihan user
 * @param {string} useORM - Apakah menggunakan ORM ("Yes" atau "No")
 * @param {string} orm - Jenis ORM yang dipilih
 * @param {string} architecture - Jenis arsitektur yang dipilih
 * @param {string} moduleName - Nama modul
 */
async function setupOrmIntegration(useORM, orm, architecture, moduleName) {
  if (useORM === "Yes") {
    console.log(`Menggunakan ORM: ${orm}`);

    const ormFunctions = {
      Prisma: () => prismaORM(moduleName),
      Sequelize: () => sequelizeORM(moduleName, architecture),
      Mongoose: () => mongooseORM(moduleName, architecture),
      TypeORM: () => typeormORM(moduleName, architecture),
    };

    if (ormFunctions[orm]) {
      await ormFunctions[orm]();
      // NOTE: must await - previously fire-and-forget made the result a
      // Promise whose .success/.failed reads crashed the success path.
      const installResult = await installOrmPackages(orm);

      if (installResult?.success) {
        console.log(
          `🎉 Package ${orm} berhasil diinstall dan akan diintegrasikan ke dalam modul ini.`
        );
      } else {
        console.error(
          `❌ Gagal menginstall beberapa package untuk ${orm}: ${(
            installResult?.failed || []
          ).join(", ")}`
        );
      }
    } else {
      console.log(createErrorMessage("notSupported", "ORM yang dipilih"));
    }
  } else {
    console.log("Tidak menggunakan ORM. Modul akan dibuat tanpa integrasi ORM.");
  }
}

module.exports = generateModule;
