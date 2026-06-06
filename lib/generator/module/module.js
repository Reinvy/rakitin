const inquirer = require("inquirer");
const { simpleArch, modularArch } = require("./arch/arch");
const {
  prismaORM,
  sequelizeORM,
  mongooseORM,
  typeormORM,
} = require("./orm/orm");
const { installIfNeeded, installOrmPackages } = require("../../installer");
const {
  validateModuleName,
  validateOrm,
  validateArchitecture,
  handleError,
  createErrorMessage,
} = require("../shared/validation-utils");
const PathResolver = require("../shared/path-resolver");
const FileValidator = require("../shared/file-validator");
const ErrorHandler = require("../shared/error-handler");

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
      routerLocation,
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

    // Install package inquirer terlebih dahulu
    installIfNeeded(["inquirer"], false, true);

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
      // Jika autoIntegrateRouter dipilih, gunakan auto router yang mendukung penambahan modul baru tanpa perubahan manual
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
      }${
        autoIntegrateRouter ? " dan sudah diintegrasikan ke router utama" : ""
      }\n`
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
      const installResult = installOrmPackages(orm);

      if (installResult.success) {
        console.log(
          `🎉 Package ${orm} berhasil diinstall dan akan diintegrasikan ke dalam modul ini.`
        );
      } else {
        console.error(
          `❌ Gagal menginstall beberapa package untuk ${orm}: ${installResult.failed.join(
            ", "
          )}`
        );
      }
    } else {
      console.log(createErrorMessage("notSupported", "ORM yang dipilih"));
    }
  } else {
    console.log(
      "Tidak menggunakan ORM. Modul akan dibuat tanpa integrasi ORM."
    );
  }
}

/**
 * Menangani integrasi otomatis modul dengan router utama
 * @param {string} moduleName - Nama modul yang akan diintegrasikan
 * @param {string} architecture - Jenis arsitektur yang dipilih
 * @param {string} routerLocation - Lokasi router utama
 * @param {string} routerArchitecture - Arsitektur router yang dipilih
 */
async function handleAutoRouterIntegration(
  moduleName,
  architecture,
  routerLocation,
  routerArchitecture
) {
  try {
    const fs = require("fs");
    const path = require("path");
    const { basePath } = require("../../constants");

    // Router utama selalu di app/routes/index.js
    const appRouterPath = path.join(basePath, "routes", "index.js");
    let isNewRouter = false;

    // Validasi apakah router sudah ada
    if (!fs.existsSync(appRouterPath)) {
      isNewRouter = true;

      // Buat direktori routes jika belum ada
      const routesDir = path.join(basePath, "routes");
      if (!fs.existsSync(routesDir)) {
        fs.mkdirSync(routesDir, { recursive: true });
      }
    }

    // Validasi file yang akan diimpor
    const validation = FileValidator.validateRouterIntegration(
      [moduleName],
      basePath,
      routerArchitecture
    );

    if (!validation.isValid) {
      ErrorHandler.handleRouterIntegrationErrors(
        validation.errors,
        [moduleName],
        "Auto Router Integration Validation"
      );

      console.log(
        "⚠️  Validasi gagal. Tidak dapat melanjutkan integrasi router otomatis."
      );
      return;
    }

    const normalizedModule = PathResolver.normalizeModuleName(moduleName);

    if (isNewRouter) {
      // Buat file router baru
      let content = `const express = require('express');
const router = express.Router();
`;

      if (routerArchitecture === "modular") {
        const importPath =
          PathResolver.getModularRouterImportPath(normalizedModule);
        content += `const ${moduleName}Router = require('${importPath}');

router.use('/${normalizedModule}', ${moduleName}Router);

module.exports = router;`;
      } else {
        const importPath =
          PathResolver.getSimpleControllerImportPath(normalizedModule);
        content += `// Routes for ${moduleName}
const ${moduleName}Controller = require('${importPath}');

// ${moduleName} routes
router.get('/${normalizedModule}', ${moduleName}Controller.getAll);
router.get('/${normalizedModule}/:id', ${moduleName}Controller.getById);
router.post('/${normalizedModule}', ${moduleName}Controller.create);
router.put('/${normalizedModule}/:id', ${moduleName}Controller.update);
router.delete('/${normalizedModule}/:id', ${moduleName}Controller.delete);

module.exports = router;`;
      }

      try {
        fs.writeFileSync(appRouterPath, content, "utf8");
        console.log(`✅ Router utama baru berhasil dibuat di ${appRouterPath}`);
      } catch (error) {
        ErrorHandler.handleFileCreationError(
          appRouterPath,
          error,
          "Main Router Creation"
        );
        console.log(`❌ Gagal membuat file router utama di ${appRouterPath}`);
        return;
      }
    } else {
      // Update router yang sudah ada
      try {
        let existingContent = fs.readFileSync(appRouterPath, "utf8");

        // Cari posisi untuk menambahkan import dan route
        const moduleExportIndex = existingContent.indexOf("module.exports");

        if (moduleExportIndex === -1) {
          console.log("❌ File router utama tidak memiliki format yang valid.");
          return;
        }

        let newContent = "";

        if (routerArchitecture === "modular") {
          const importPath =
            PathResolver.getModularRouterImportPath(normalizedModule);
          const newImport = `const ${moduleName}Router = require('${importPath}');\n`;

          // Tambahkan import setelah import yang sudah ada
          const lastImportIndex = existingContent.lastIndexOf("require(");
          const endOfImportLine =
            existingContent.indexOf("\n", lastImportIndex) + 1;

          newContent =
            existingContent.slice(0, endOfImportLine) +
            "\n" +
            newImport +
            existingContent.slice(endOfImportLine, moduleExportIndex);

          // Tambahkan route sebelum module.exports
          const newRoute = `router.use('/${normalizedModule}', ${moduleName}Router);\n\n`;
          newContent += newRoute;
        } else {
          const importPath =
            PathResolver.getSimpleControllerImportPath(normalizedModule);
          const newImport = `// Routes for ${moduleName}\nconst ${moduleName}Controller = require('${importPath}');\n\n`;

          // Tambahkan import setelah import yang sudah ada
          const lastImportIndex = existingContent.lastIndexOf("require(");
          const endOfImportLine =
            existingContent.indexOf("\n", lastImportIndex) + 1;

          newContent =
            existingContent.slice(0, endOfImportLine) +
            "\n" +
            newImport +
            existingContent.slice(endOfImportLine, moduleExportIndex);

          // Tambahkan route sebelum module.exports
          const newRoutes = `// ${moduleName} routes
router.get('/${normalizedModule}', ${moduleName}Controller.getAll);
router.get('/${normalizedModule}/:id', ${moduleName}Controller.getById);
router.post('/${normalizedModule}', ${moduleName}Controller.create);
router.put('/${normalizedModule}/:id', ${moduleName}Controller.update);
router.delete('/${normalizedModule}/:id', ${moduleName}Controller.delete);

`;
          newContent += newRoutes;
        }

        newContent += existingContent.slice(moduleExportIndex);

        fs.writeFileSync(appRouterPath, newContent, "utf8");
        console.log(`✅ Router utama berhasil diperbarui di ${appRouterPath}`);
      } catch (error) {
        ErrorHandler.handleFileCreationError(
          appRouterPath,
          error,
          "Main Router Update"
        );
        console.log(
          `❌ Gagal memperbarui file router utama di ${appRouterPath}`
        );
        return;
      }
    }

    // Tanyakan apakah ingin membuat contoh penggunaan di app.js atau server.js
    const { createAppExample } = await inquirer.default.prompt([
      {
        type: "confirm",
        name: "createAppExample",
        message:
          "Apakah Anda ingin membuat contoh penggunaan router di app.js?",
        default: true,
      },
    ]);

    if (createAppExample) {
      const appPath = path.join(process.cwd(), "app.js");

      if (fs.existsSync(appPath)) {
        const { overwriteApp } = await inquirer.default.prompt([
          {
            type: "confirm",
            name: "overwriteApp",
            message:
              "File app.js sudah ada di root proyek. Apakah Anda ingin menambahkan contoh penggunaan router?",
            default: false,
          },
        ]);

        if (overwriteApp) {
          const relativePath = "./app/routes";
          const appContent = `
// Contoh penggunaan router
const routes = require('${relativePath}');
app.use('/api', routes);
`;

          try {
            fs.appendFileSync(appPath, appContent, "utf8");
            console.log(
              "✅ Contoh penggunaan router berhasil ditambahkan ke app.js root"
            );
          } catch (error) {
            ErrorHandler.handleFileCreationError(
              appPath,
              error,
              "App.js Update"
            );
            console.log(
              "❌ Gagal menambahkan contoh penggunaan router ke app.js root"
            );
          }
        }
      } else {
        const relativePath = "./app/routes";
        const appContent = `const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Contoh penggunaan router
const routes = require('${relativePath}');
app.use('/api', routes);

module.exports = app;
`;

        try {
          fs.writeFileSync(appPath, appContent, "utf8");
          console.log(
            "✅ File app.js berhasil dibuat di root proyek dengan contoh penggunaan router"
          );
        } catch (error) {
          ErrorHandler.handleFileCreationError(
            appPath,
            error,
            "App.js Creation"
          );
          console.log(
            "❌ Gagal membuat file app.js di root proyek dengan contoh penggunaan router"
          );
        }
      }
    }
  } catch (error) {
    ErrorHandler.handleError(error, "Auto Router Integration");
    console.log(
      "❌ Integrasi otomatis router gagal. Silakan periksa error log untuk detail lebih lanjut."
    );
  }
}

module.exports = generateModule;
