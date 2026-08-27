const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { getPaths } = require("../../constants");

/** Resolve lazily so cwd overrides are honored. */
function modulesPath() { return getPaths().modulesPath; }
function basePath() { return getPaths().basePath; }
const { ensureDir } = require("../../utils");
const { normalizeModuleName, toIdentifier } = require("../../naming");
const PathResolver = require("../shared/path-resolver");
const FileValidator = require("../shared/file-validator");
const ErrorHandler = require("../shared/error-handler");

// Only offer global middleware that the middleware generator can actually
// produce - previously the menu advertised options (cors, rateLimit,
// bodyParser) that nothing ever generated, shipping broken requires.
const GLOBAL_MIDDLEWARE_CHOICES = [
  { name: "Authentication (JWT)", value: "auth" },
  { name: "Request Logging", value: "logger" },
  { name: "Global Error Handler", value: "error" },
  { name: "Request Time", value: "request-time" },
];

/**
 * Build a require line for a generated middleware. Middlewares live in
 * app/shared/middlewares/<kebab>.middleware.js relative to app/routes/.
 */
function middlewareRequireLine(middlewareName) {
  const fileName = normalizeModuleName(middlewareName);
  return `const ${toIdentifier(
    middlewareName + "-middleware"
  )} = require('../shared/middlewares/${fileName}.middleware');`;
}

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
    if (fs.existsSync(modulesPath())) {
      modules = fs
        .readdirSync(modulesPath())
        .filter((f) => fs.statSync(path.join(modulesPath(), f)).isDirectory());
    }
  } else {
    // Manual selection
    if (fs.existsSync(modulesPath())) {
      const availableModules = fs
        .readdirSync(modulesPath())
        .filter((f) => fs.statSync(path.join(modulesPath(), f)).isDirectory());

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
  const appRouterPath = path.join(basePath(), "routes", "index.js");
  ensureDir(path.join(basePath(), "routes"));

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
    basePath(),
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
        choices: GLOBAL_MIDDLEWARE_CHOICES,
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
      middlewares.forEach((middleware) => {
        content += `${middlewareRequireLine(middleware)}\n`;
      });
      content += "\n";
    }

    modules.forEach((m) => {
      const normalizedModule = normalizeModuleName(m);
      const moduleId = toIdentifier(m + "-router");
      const importPath = PathResolver.getModularRouterImportPath(normalizedModule);

      // Validasi file sebelum import
      const routerValidation = FileValidator.validateModularRouterFile(
        normalizedModule,
        basePath()
      );

      if (!routerValidation.isValid) {
        ErrorHandler.handleFileNotFoundError(routerValidation.path, "Modular Router Import");
        return;
      }

      content += `const ${moduleId} = require('${importPath}');\n`;
    });

    content += "\n";

    // Terapkan middleware global
    if (middlewares.length > 0) {
      content += "// Apply global middleware\n";
      middlewares.forEach((middleware) => {
        content += `router.use(${toIdentifier(middleware + "-middleware")});\n`;
      });
      content += "\n";
    }

    modules.forEach((m) => {
      const normalizedModule = normalizeModuleName(m);
      const moduleId = toIdentifier(m + "-router");
      content += `router.use('/${normalizedModule}', ${moduleId});\n`;
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
      middlewares.forEach((middleware) => {
        content += `${middlewareRequireLine(middleware)}\n`;
      });
      content += "\n";
    }

    modules.forEach((m) => {
      const normalizedModule = normalizeModuleName(m);
      const controllerId = toIdentifier(m + "-controller");
      const importPath = PathResolver.getSimpleControllerImportPath(normalizedModule);

      // Validasi file sebelum import
      const controllerValidation = FileValidator.validateSimpleControllerFile(
        normalizedModule,
        basePath()
      );

      if (!controllerValidation.isValid) {
        ErrorHandler.handleFileNotFoundError(controllerValidation.path, "Simple Controller Import");
        return;
      }

      content += `// Routes for ${normalizedModule}
const ${controllerId} = require('${importPath}');
`;
    });

    content += "\n";

    // Terapkan middleware global
    if (middlewares.length > 0) {
      content += "// Apply global middleware\n";
      middlewares.forEach((middleware) => {
        content += `router.use(${toIdentifier(middleware + "-middleware")});\n`;
      });
      content += "\n";
    }

    modules.forEach((m) => {
      const normalizedModule = normalizeModuleName(m);
      const controllerId = toIdentifier(m + "-controller");
      content += `// ${normalizedModule} routes
router.get('/${normalizedModule}', ${controllerId}.getAll);
router.get('/${normalizedModule}/:id', ${controllerId}.getById);
router.post('/${normalizedModule}', ${controllerId}.create);
router.put('/${normalizedModule}/:id', ${controllerId}.update);
router.delete('/${normalizedModule}/:id', ${controllerId}.delete);

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
 * Membuat template app/routes/index.js yang auto-detect semua modul.
 *
 * Self-contained: helper naming di-EMBED langsung ke dalam file hasil
 * generate sehingga tidak ada referensi ke modul rakitin (yang tidak akan
 * ada di project user). Setiap modul dideteksi strukturnya secara
 * independen saat runtime - modular dan simple bisa dicampur.
 *
 * @param {string} architecture - Keperluan kompatibilitas, tidak lagi
 *   memaksa satu jenis arsitektur untuk semua modul.
 * @param {Array<string>} middlewares - Middleware global yang dipakai.
 * @returns {string} Template untuk app/routes/index.js
 */
function createAutoRouterTemplate(architecture = 'modular', middlewares = []) {
  let template = `const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// --- embedded helpers (self-contained, no external deps) ---
function normalizeModuleName(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\\s_]+/g, '-')
    .toLowerCase();
}

function toIdentifier(name) {
  const kebab = normalizeModuleName(name);
  let id = kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  id = id.replace(/[^A-Za-z0-9_$]/g, '');
  if (!id) return '_';
  if (/^[0-9]/.test(id)) return '_' + id;
  return id;
}
// --- end helpers ---

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

const availableModules = detectModules();
`;

  // Import middleware yang dipilih
  if (middlewares.length > 0) {
    template += "\n// Global middleware\n";
    middlewares.forEach((middleware) => {
      template += `${middlewareRequireLine(middleware)}\n`;
      template += `router.use(${toIdentifier(middleware + "-middleware")});\n`;
    });
    template += "\n";
  }

  template += `let loadedCount = 0;

availableModules.forEach((moduleName) => {
  const normalizedModule = normalizeModuleName(moduleName);

  // 1) Modular structure: modules/<name>/routes/<name>.router.js
  const modularRouterPath = path.join(
    __dirname, '..', 'modules', normalizedModule,
    'routes', normalizedModule + '.router.js'
  );

  // 2) Simple structure: modules/<name>/<name>.controller.js
  const simpleControllerPath = path.join(
    __dirname, '..', 'modules', normalizedModule,
    normalizedModule + '.controller.js'
  );

  try {
    if (fs.existsSync(modularRouterPath)) {
      const moduleRouter = require(modularRouterPath);
      router.use('/' + normalizedModule, moduleRouter);
      loadedCount += 1;
      console.log('[rakitin] Modular router loaded: ' + normalizedModule);
    } else if (fs.existsSync(simpleControllerPath)) {
      const controller = require(simpleControllerPath);

      if (typeof controller.getAll === 'function') {
        router.get('/' + normalizedModule, controller.getAll);
      }
      if (typeof controller.getById === 'function') {
        router.get('/' + normalizedModule + '/:id', controller.getById);
      }
      if (typeof controller.create === 'function') {
        router.post('/' + normalizedModule, controller.create);
      }
      if (typeof controller.update === 'function') {
        router.put('/' + normalizedModule + '/:id', controller.update);
      }
      if (typeof controller.delete === 'function') {
        router.delete('/' + normalizedModule + '/:id', controller.delete);
      }
      loadedCount += 1;
      console.log('[rakitin] Simple routes created: ' + normalizedModule);
    } else {
      console.warn(
        '[rakitin] Skipping "' + moduleName +
        '": no valid modular/simple structure detected.'
      );
    }
  } catch (error) {
    console.error(
      '[rakitin] Failed to load module "' + moduleName + '":', error.message
    );
  }
});

console.log('[rakitin] Auto-loaded ' + loadedCount + ' module(s).');

module.exports = router;
`;

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
    const appRouterPath = path.join(basePath(), "routes", "index.js");
    ensureDir(path.join(basePath(), "routes"));
    
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
      if (fs.existsSync(modulesPath())) {
        modules = fs
          .readdirSync(modulesPath())
          .filter((f) => fs.statSync(path.join(modulesPath(), f)).isDirectory());
      }
      
      if (modules.length === 0) {
        console.log("⚠️  Tidak ada modul yang ditemukan.");
        return false;
      }
      
      console.log(`✅ Ditemukan ${modules.length} modul: ${modules.join(', ')}`);

      // NOTE: no strict pre-validation of module structure here.
      // The generated auto-router detects each module's architecture
      // independently at runtime, so mixed modular/simple layouts are
      // valid and modules missing one structure are skipped gracefully
      // (previously a single mismatch aborted the whole integration).

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
