const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { modulesPath, basePath } = require("../../constants");
const { ensureDir, normalizeModuleName } = require("../../utils");
const PathResolver = require("../shared/path-resolver");
const FileValidator = require("../shared/file-validator");
const ErrorHandler = require("../shared/error-handler");

async function integrateRouter() {
  try {
  // Tanya apakah ingin integrasi otomatis atau manual
  const { integrationType } = await inquirer.default.prompt([
    {
      type: "list",
      name: "integrationType",
      message: "Pilih jenis integrasi router:",
      choices: [
        { name: "Otomatis (deteksi semua modul)", value: "automatic" },
        { name: "Manual (pilih modul yang diinginkan)", value: "manual" },
      ],
    },
  ]);

  let modules = [];

  if (integrationType === "automatic") {
    // Deteksi semua modul yang ada
    if (fs.existsSync(modulesPath)) {
      modules = fs
        .readdirSync(modulesPath)
        .filter((f) => fs.statSync(path.join(modulesPath, f)).isDirectory());
    }
  } else {
    // Manual selection
    if (fs.existsSync(modulesPath)) {
      const availableModules = fs
        .readdirSync(modulesPath)
        .filter((f) => fs.statSync(path.join(modulesPath, f)).isDirectory());

      if (availableModules.length === 0) {
        console.log("⚠️  Tidak ada modul yang ditemukan.");
        return;
      }

      const { selectedModules } = await inquirer.default.prompt([
        {
          type: "checkbox",
          name: "selectedModules",
          message: "Pilih modul yang ingin diintegrasikan:",
          choices: availableModules,
        },
      ]);

      modules = selectedModules;
    } else {
      console.log("⚠️  Folder modules tidak ditemukan.");
      return;
    }
  }

  if (modules.length === 0) {
    console.log("⚠️  Tidak ada modul yang dipilih untuk diintegrasikan.");
    return;
  }

  // Router utama selalu dibuat di app/routes/index.js
  const appRouterPath = path.join(basePath, "routes", "index.js");
  ensureDir(path.join(basePath, "routes"));

  // Tanya apakah ingin menggunakan arsitektur modular atau simple
  const { architecture } = await inquirer.default.prompt([
    {
      type: "list",
      name: "architecture",
      message: "Pilih arsitektur router:",
      choices: [
        { name: "Modular (setiap modul memiliki router terpisah)", value: "modular" },
        { name: "Simple (semua route dalam satu file)", value: "simple" },
      ],
    },
  ]);

  // Validasi file yang akan diimpor
  const validation = FileValidator.validateRouterIntegration(
    modules,
    basePath,
    architecture
  );
  
  if (!validation.isValid) {
    ErrorHandler.handleRouterIntegrationErrors(
      validation.errors,
      modules,
      "Router Integration Validation"
    );
    
    console.log("⚠️  Validasi gagal. Tidak dapat melanjutkan integrasi router.");
    return;
  }

  let content = "";
  let middlewares = [];

  // Tanya apakah ingin menggunakan middleware global
  const { useGlobalMiddleware } = await inquirer.default.prompt([
    {
      type: "confirm",
      name: "useGlobalMiddleware",
      message: "Apakah Anda ingin menggunakan middleware global?",
      default: true,
    },
  ]);

  if (useGlobalMiddleware) {
    const { selectedMiddlewares } = await inquirer.default.prompt([
      {
        type: "checkbox",
        name: "selectedMiddlewares",
        message: "Pilih middleware global yang ingin digunakan:",
        choices: [
          { name: "Authentication", value: "auth" },
          { name: "Authorization", value: "authorization" },
          { name: "Logging", value: "logging" },
          { name: "Rate Limiting", value: "rateLimit" },
          { name: "CORS", value: "cors" },
          { name: "Body Parser", value: "bodyParser" },
        ],
      },
    ]);

    middlewares = selectedMiddlewares;
  }

  if (architecture === "modular") {
    content = `const express = require('express');
const router = express.Router();
`;

    // Import middleware yang dipilih
    if (middlewares.length > 0) {
      content += "// Global Middleware\n";
      middlewares.forEach(middleware => {
        content += `const ${middleware}Middleware = require('../middleware/${middleware}.middleware');\n`;
      });
      content += "\n";
    }

    modules.forEach((m) => {
      const normalizedModule = normalizeModuleName(m);
      const importPath = PathResolver.getModularRouterImportPath(normalizedModule);
      
      // Validasi file sebelum import
      const routerValidation = FileValidator.validateModularRouterFile(
        normalizedModule,
        basePath
      );
      
      if (!routerValidation.isValid) {
        ErrorHandler.handleFileNotFoundError(routerValidation.path, "Modular Router Import");
        return;
      }
      
      content += `const ${m}Router = require('${importPath}');\n`;
    });

    content += "\n";

    // Terapkan middleware global
    if (middlewares.length > 0) {
      content += "// Apply global middleware\n";
      middlewares.forEach(middleware => {
        content += `router.use(${middleware}Middleware);\n`;
      });
      content += "\n";
    }

    modules.forEach((m) => {
      content += `router.use('/${m}', ${m}Router);\n`;
    });

    content += "\nmodule.exports = router;\n";
  } else {
    // Simple architecture
    content = `const express = require('express');
const router = express.Router();
`;

    // Import middleware yang dipilih
    if (middlewares.length > 0) {
      content += "// Global Middleware\n";
      middlewares.forEach(middleware => {
        content += `const ${middleware}Middleware = require('../middleware/${middleware}.middleware');\n`;
      });
      content += "\n";
    }

    modules.forEach((m) => {
      const normalizedModule = normalizeModuleName(m);
      const importPath = PathResolver.getSimpleControllerImportPath(normalizedModule);
      
      // Validasi file sebelum import
      const controllerValidation = FileValidator.validateSimpleControllerFile(
        normalizedModule,
        basePath
      );
      
      if (!controllerValidation.isValid) {
        ErrorHandler.handleFileNotFoundError(controllerValidation.path, "Simple Controller Import");
        return;
      }
      
      content += `// Routes for ${m}
const ${m}Controller = require('${importPath}');
`;
    });

    content += "\n";

    // Terapkan middleware global
    if (middlewares.length > 0) {
      content += "// Apply global middleware\n";
      middlewares.forEach(middleware => {
        content += `router.use(${middleware}Middleware);\n`;
      });
      content += "\n";
    }

    modules.forEach((m) => {
      content += `// ${m} routes
router.get('/${m}', ${m}Controller.getAll);
router.get('/${m}/:id', ${m}Controller.getById);
router.post('/${m}', ${m}Controller.create);
router.put('/${m}/:id', ${m}Controller.update);
router.delete('/${m}/:id', ${m}Controller.delete);

`;
    });

    content += "module.exports = router;\n";
  }

  try {
    fs.writeFileSync(appRouterPath, content, "utf8");
    console.log(`✅ Router utama berhasil dibuat di ${appRouterPath}`);
    console.log(`✅ ${modules.length} modul berhasil diintegrasikan!`);
  } catch (error) {
    ErrorHandler.handleFileCreationError(appRouterPath, error, "Main Router Creation");
    console.log(`❌ Gagal membuat file router utama di ${appRouterPath}`);
    return;
  }

  // Tanyakan apakah ingin membuat contoh penggunaan di app.js atau server.js
  const { createAppExample } = await inquirer.default.prompt([
    {
      type: "confirm",
      name: "createAppExample",
      message: "Apakah Anda ingin membuat contoh penggunaan router di app.js?",
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
          message: "File app.js sudah ada di root proyek. Apakah Anda ingin menambahkan contoh penggunaan router?",
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
          console.log("✅ Contoh penggunaan router berhasil ditambahkan ke app.js root");
        } catch (error) {
          ErrorHandler.handleFileCreationError(appPath, error, "App.js Update");
          console.log("❌ Gagal menambahkan contoh penggunaan router ke app.js root");
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
        console.log("✅ File app.js berhasil dibuat di root proyek dengan contoh penggunaan router");
      } catch (error) {
        ErrorHandler.handleFileCreationError(appPath, error, "App.js Creation");
        console.log("❌ Gagal membuat file app.js di root proyek dengan contoh penggunaan router");
      }
    }
  }
  } catch (error) {
    ErrorHandler.handleError(error, "Router Integration");
    console.log("❌ Integrasi router gagal. Silakan periksa error log untuk detail lebih lanjut.");
  }
}

/**
 * Membuat template untuk app/routes/index.js yang mendukung otomatisasi
 * @param {string} architecture - Arsitektur router (modular atau simple)
 * @param {Array<string>} middlewares - Daftar middleware yang akan digunakan
 * @returns {string} Template untuk app/routes/index.js
 */
function createAutoRouterTemplate(architecture = 'modular', middlewares = []) {
  let template = `const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Fungsi untuk mendeteksi modul secara otomatis
function detectModules() {
  const modulesDir = path.join(__dirname, '..', 'modules');
  const modules = [];
  
  if (fs.existsSync(modulesDir)) {
    const items = fs.readdirSync(modulesDir);
    for (const item of items) {
      const itemPath = path.join(modulesDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        modules.push(item);
      }
    }
  }
  
  return modules;
}

// Fungsi untuk mendeteksi arsitektur modul
function detectModuleArchitecture(moduleName) {
  const normalizedModule = normalizeModuleName(moduleName);
  const modularRouterPath = path.join(__dirname, '..', 'modules', normalizedModule, 'routes', \`\${normalizedModule}.router.js\`);
  const simpleControllerPath = path.join(__dirname, '..', 'modules', normalizedModule, \`\${normalizedModule}.controller.js\`);
  
  if (fs.existsSync(modularRouterPath)) {
    return 'modular';
  } else if (fs.existsSync(simpleControllerPath)) {
    return 'simple';
  }
  
  return null; // Modul tidak memiliki struktur yang valid
}

// Deteksi semua modul yang tersedia
const availableModules = detectModules();
`;

  // Import middleware yang dipilih
  if (middlewares.length > 0) {
    template += "\n// Global Middleware\n";
    middlewares.forEach(middleware => {
      template += `const ${middleware}Middleware = require('../middleware/${middleware}.middleware');\n`;
    });
    template += "\n";
  }

  if (architecture === 'modular') {
    template += `// Import router modular untuk setiap modul
const modularModules = [];
availableModules.forEach(moduleName => {
  const normalizedModule = normalizeModuleName(moduleName);
  const moduleArchitecture = detectModuleArchitecture(moduleName);
  
  if (moduleArchitecture === 'modular') {
    try {
      const moduleRouter = require(\`../modules/\${normalizedModule}/routes/\${normalizedModule}.router.js\`);
      router.use(\`/\${normalizedModule}\`, moduleRouter);
      modularModules.push(moduleName);
      console.log(\`✅ Modular router for \${moduleName} loaded successfully\`);
    } catch (error) {
      console.error(\`❌ Failed to load modular router for \${moduleName}:\`, error.message);
    }
  }
});

if (modularModules.length > 0) {
  console.log(\`✅ Successfully loaded \${modularModules.length} modular modules\`);
} else {
  console.log('⚠️  No modular modules found');
}

`;
  } else {
    template += `// Import controller simple untuk setiap modul
const simpleModules = [];
availableModules.forEach(moduleName => {
  const normalizedModule = normalizeModuleName(moduleName);
  const moduleArchitecture = detectModuleArchitecture(moduleName);
  
  if (moduleArchitecture === 'simple') {
    try {
      const moduleController = require(\`../modules/\${normalizedModule}/\${normalizedModule}.controller.js\`);
      simpleModules.push({ name: moduleName, controller: moduleController });
      console.log(\`✅ Controller for \${moduleName} loaded successfully\`);
    } catch (error) {
      console.error(\`❌ Failed to load controller for \${moduleName}:\`, error.message);
    }
  }
});

// Terapkan middleware global
`;
    if (middlewares.length > 0) {
      middlewares.forEach(middleware => {
        template += `router.use(${middleware}Middleware);\n`;
      });
    }
    template += "\n";

    template += `// Buat route untuk controller simple
simpleModules.forEach(({ name, controller }) => {
  const normalizedModule = normalizeModuleName(name);
  
  if (controller.getAll) {
    router.get(\`/\${normalizedModule}\`, controller.getAll);
  }
  if (controller.getById) {
    router.get(\`/\${normalizedModule}/:id\`, controller.getById);
  }
  if (controller.create) {
    router.post(\`/\${normalizedModule}\`, controller.create);
  }
  if (controller.update) {
    router.put(\`/\${normalizedModule}/:id\`, controller.update);
  }
  if (controller.delete) {
    router.delete(\`/\${normalizedModule}/:id\`, controller.delete);
  }
  
  console.log(\`✅ Routes for \${name} created successfully\`);
});

if (simpleModules.length > 0) {
  console.log(\`✅ Successfully created routes for \${simpleModules.length} simple modules\`);
} else {
  console.log('⚠️  No simple modules found');
}

`;
  }

  template += "module.exports = router;\n";
  return template;
}

/**
 * Membuat app/routes/index.js dengan kemampuan otomatisasi
 * @param {string} architecture - Arsitektur router (modular atau simple)
 * @param {Array<string>} middlewares - Daftar middleware yang akan digunakan
 * @returns {Promise<boolean>} True jika berhasil dibuat
 */
async function createAutoRouter(architecture = 'modular', middlewares = []) {
  try {
    const appRouterPath = path.join(basePath, "routes", "index.js");
    ensureDir(path.join(basePath, "routes"));
    
    const content = createAutoRouterTemplate(architecture, middlewares);
    
    fs.writeFileSync(appRouterPath, content, "utf8");
    console.log(`✅ Auto router berhasil dibuat di ${appRouterPath}`);
    console.log(`✅ Router akan secara otomatis mendeteksi dan mengimpor semua modul yang tersedia`);
    
    return true;
  } catch (error) {
    ErrorHandler.handleError(error, "Auto Router Creation");
    console.log("❌ Gagal membuat auto router. Silakan periksa error log untuk detail lebih lanjut.");
    return false;
  }
}

/**
 * Mengintegrasikan router dengan kemampuan otomatisasi penuh
 * @param {Object} options - Opsi integrasi
 * @param {boolean} options.autoDetect - Apakah mendeteksi modul secara otomatis
 * @param {string} options.architecture - Arsitektur router (modular atau simple)
 * @param {Array<string>} options.middlewares - Daftar middleware yang akan digunakan
 * @returns {Promise<boolean>} True jika berhasil
 */
async function integrateAutoRouter(options = {}) {
  try {
    const {
      autoDetect = true,
      architecture = 'modular',
      middlewares = []
    } = options;
    
    if (autoDetect) {
      console.log("🔍 Mendeteksi modul secara otomatis...");
      
      // Deteksi semua modul yang ada
      let modules = [];
      if (fs.existsSync(modulesPath)) {
        modules = fs
          .readdirSync(modulesPath)
          .filter((f) => fs.statSync(path.join(modulesPath, f)).isDirectory());
      }
      
      if (modules.length === 0) {
        console.log("⚠️  Tidak ada modul yang ditemukan.");
        return false;
      }
      
      console.log(`✅ Ditemukan ${modules.length} modul: ${modules.join(', ')}`);
      
      // Validasi file yang akan diimpor
      const validation = FileValidator.validateRouterIntegration(
        modules,
        basePath,
        architecture
      );
      
      if (!validation.isValid) {
        ErrorHandler.handleRouterIntegrationErrors(
          validation.errors,
          modules,
          "Auto Router Integration Validation"
        );
        
        console.log("⚠️  Validasi gagal. Tidak dapat melanjutkan integrasi router otomatis.");
        return false;
      }
      
      // Buat auto router
      return await createAutoRouter(architecture, middlewares);
    } else {
      // Gunakan integrasi manual biasa
      return await integrateRouter();
    }
  } catch (error) {
    ErrorHandler.handleError(error, "Auto Router Integration");
    console.log("❌ Integrasi auto router gagal. Silakan periksa error log untuk detail lebih lanjut.");
    return false;
  }
}

module.exports = {
  integrateRouter,
  createAutoRouterTemplate,
  createAutoRouter,
  integrateAutoRouter
};
