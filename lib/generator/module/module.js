const inquirer = require("inquirer");
const { simpleArch, modularArch } = require("./arch/arch");
const { prismaORM, sequelizeORM, mongooseORM, typeormORM } = require("./orm/orm");
const { installOrmPackages } = require("../../installer");
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
    const {
      moduleName,
      architecture,
      useORM,
      orm,
      autoIntegrateRouter,
      routerArchitecture,
    } = await inquirer.default.prompt([
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
        type: "list",
        name: "architecture",
        message: "Pilih arsitektur:",
        choices: ["Simple", "Modular"],
      },
      {
        type: "list",
        name: "useORM",
        message: "Apakah ingin menggunakan ORM?",
        choices: ["Yes", "No"],
        default: "Yes",
      },
      {
        type: "list",
        name: "orm",
        message: "Pilih ORM/Database:",
        choices: ["Prisma", "Sequelize", "Mongoose", "TypeORM"],
        when: (answers) => answers.useORM === "Yes",
      },
      {
        type: "confirm",
        name: "autoIntegrateRouter",
        message:
          "Apakah ingin secara otomatis mengintegrasikan modul ini ke router utama?",
        default: false,
      },
      {
        type: "list",
        name: "routerArchitecture",
        message: "Pilih arsitektur router:",
        choices: [
          {
            name: "Modular (setiap modul memiliki router terpisah)",
            value: "modular",
          },
          { name: "Simple (semua route dalam satu file)", value: "simple" },
        ],
        default: "modular",
        when: (answers) => answers.autoIntegrateRouter,
      },
    ]);

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
      // Auto router mendukung penambahan modul baru tanpa perubahan manual.
      // NOTE: arsitektur modul dan arsitektur router adalah dimensi berbeda;
      // integrasi harus memvalidasi struktur modul aktual di disk.
      const { integrateAutoRouter } = require("../router/router");
      await integrateAutoRouter({
        autoDetect: true,
        architecture: routerArchitecture,
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
