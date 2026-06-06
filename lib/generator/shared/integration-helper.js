const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const PathResolver = require('./path-resolver');
const FileValidator = require('./file-validator');
const ErrorHandler = require('./error-handler');

/**
 * Integration Helper untuk menyediakan fungsi-fungsi bantu
 * untuk integrasi router dengan generator modul
 */
class IntegrationHelper {
  /**
   * Konstanta untuk lokasi router
   */
  static ROUTER_LOCATIONS = {
    APP: 'app',
    ROOT: 'root',
    APP_NEW: 'app_new',
    ROOT_NEW: 'root_new'
  };

  /**
   * Konstanta untuk arsitektur router
   */
  static ROUTER_ARCHITECTURES = {
    MODULAR: 'modular',
    SIMPLE: 'simple'
  };

  /**
   * Mendapatkan path router utama berdasarkan lokasi yang dipilih
   * @param {string} location - Lokasi router (app, root, app_new, root_new)
   * @param {string} basePath - Path dasar proyek
   * @returns {Object} { path: string, isNew: boolean }
   */
  static getMainRouterPath(location, basePath) {
    let routerPath;
    let isNew = false;

    switch (location) {
      case this.ROUTER_LOCATIONS.APP:
        routerPath = path.join(basePath, 'routes', 'index.js');
        break;
      case this.ROUTER_LOCATIONS.ROOT:
        routerPath = path.join(process.cwd(), 'routes', 'index.js');
        break;
      case this.ROUTER_LOCATIONS.APP_NEW:
        routerPath = path.join(basePath, 'routes', 'index.js');
        isNew = true;
        
        // Buat direktori routes jika belum ada
        const routesDir = path.join(basePath, 'routes');
        if (!fs.existsSync(routesDir)) {
          fs.mkdirSync(routesDir, { recursive: true });
        }
        break;
      case this.ROUTER_LOCATIONS.ROOT_NEW:
        routerPath = path.join(process.cwd(), 'routes', 'index.js');
        isNew = true;
        
        // Buat direktori routes jika belum ada
        const rootRoutesDir = path.join(process.cwd(), 'routes');
        if (!fs.existsSync(rootRoutesDir)) {
          fs.mkdirSync(rootRoutesDir, { recursive: true });
        }
        break;
      default:
        throw new Error(`Lokasi router tidak valid: ${location}`);
    }

    return { path: routerPath, isNew };
  }

  /**
   * Membuat konten untuk router utama baru dengan kemampuan otomatisasi
   * @param {Array<string>} modules - Daftar nama modul
   * @param {string} architecture - Arsitektur router (modular atau simple)
   * @param {Array<string>} middlewares - Daftar middleware yang akan digunakan
   * @returns {string} Konten router utama
   */
  static createMainRouterContent(modules, architecture, middlewares = []) {
    let content = `const express = require('express');
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
  const normalizedModule = PathResolver.normalizeModuleName(moduleName);
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
      content += "\n// Global Middleware\n";
      middlewares.forEach(middleware => {
        content += `const ${middleware}Middleware = require('../middleware/${middleware}.middleware');\n`;
      });
      content += "\n";
    }

    if (architecture === this.ROUTER_ARCHITECTURES.MODULAR) {
      content += `// Import router modular untuk setiap modul
const modularModules = [];
availableModules.forEach(moduleName => {
  const normalizedModule = PathResolver.normalizeModuleName(moduleName);
  const moduleArchitecture = detectModuleArchitecture(moduleName);
  
  if (moduleArchitecture === 'modular') {
    try {
      const moduleRouter = require(\`../modules/\${normalizedModule}/routes/\${normalizedModule}.router.js\`);
      router.use(\`/\${normalizedModule}\`, moduleRouter);
      modularModules.push(moduleName);
      console.log(\`✅ Modular router for \${moduleName} loaded automatically\`);
    } catch (error) {
      console.error(\`❌ Failed to load modular router for \${moduleName}:\`, error.message);
    }
  }
});

`;

      // Terapkan middleware global
      if (middlewares.length > 0) {
        content += "// Apply global middleware\n";
        middlewares.forEach(middleware => {
          content += `router.use(${middleware}Middleware);\n`;
        });
        content += "\n";
      }

      content += `if (modularModules.length > 0) {
  console.log(\`✅ Automatically loaded \${modularModules.length} modular modules\`);
} else {
  console.log('⚠️  No modular modules found. New modules will be automatically loaded when added.');
}

`;
    } else {
      content += `// Import controller simple untuk setiap modul
const simpleModules = [];
availableModules.forEach(moduleName => {
  const normalizedModule = PathResolver.normalizeModuleName(moduleName);
  const moduleArchitecture = detectModuleArchitecture(moduleName);
  
  if (moduleArchitecture === 'simple') {
    try {
      const moduleController = require(\`../modules/\${normalizedModule}/\${normalizedModule}.controller.js\`);
      simpleModules.push({ name: moduleName, controller: moduleController });
      console.log(\`✅ Controller for \${moduleName} loaded automatically\`);
    } catch (error) {
      console.error(\`❌ Failed to load controller for \${moduleName}:\`, error.message);
    }
  }
});

`;

      // Terapkan middleware global
      if (middlewares.length > 0) {
        content += "// Apply global middleware\n";
        middlewares.forEach(middleware => {
          content += `router.use(${middleware}Middleware);\n`;
        });
        content += "\n";
      }

      content += `// Buat route untuk controller simple
simpleModules.forEach(({ name, controller }) => {
  const normalizedModule = PathResolver.normalizeModuleName(name);
  
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
  
  console.log(\`✅ Routes for \${name} created automatically\`);
});

if (simpleModules.length > 0) {
  console.log(\`✅ Automatically created routes for \${simpleModules.length} simple modules\`);
} else {
  console.log('⚠️  No simple modules found. New modules will be automatically loaded when added.');
}

`;
    }

    content += "module.exports = router;\n";
    return content;
  }

  /**
   * Memperbarui router utama yang sudah ada dengan menambahkan modul baru
   * @param {string} routerPath - Path ke file router utama
   * @param {string} moduleName - Nama modul yang akan ditambahkan
   * @param {string} architecture - Arsitektur router (modular atau simple)
   * @returns {boolean} True jika berhasil diperbarui
   */
  static updateExistingRouter(routerPath, moduleName, architecture) {
    try {
      let existingContent = fs.readFileSync(routerPath, "utf8");
      
      // Cari posisi untuk menambahkan import dan route
      const moduleExportIndex = existingContent.indexOf("module.exports");
      
      if (moduleExportIndex === -1) {
        ErrorHandler.handleInvalidPathError(routerPath, "Router Update");
        return false;
      }
      
      let newContent = "";
      const normalizedModule = PathResolver.normalizeModuleName(moduleName);
      
      if (architecture === this.ROUTER_ARCHITECTURES.MODULAR) {
        const importPath = PathResolver.getModularRouterImportPath(normalizedModule);
        const newImport = `const ${moduleName}Router = require('${importPath}');\n`;
        
        // Tambahkan import setelah import yang sudah ada
        const lastImportIndex = existingContent.lastIndexOf("require(");
        const endOfImportLine = existingContent.indexOf("\n", lastImportIndex) + 1;
        
        newContent = existingContent.slice(0, endOfImportLine) + 
                    "\n" + newImport + 
                    existingContent.slice(endOfImportLine, moduleExportIndex);
        
        // Tambahkan route sebelum module.exports
        const newRoute = `router.use('/${normalizedModule}', ${moduleName}Router);\n\n`;
        newContent += newRoute;
      } else {
        const importPath = PathResolver.getSimpleControllerImportPath(normalizedModule);
        const newImport = `// Routes for ${moduleName}\nconst ${moduleName}Controller = require('${importPath}');\n\n`;
        
        // Tambahkan import setelah import yang sudah ada
        const lastImportIndex = existingContent.lastIndexOf("require(");
        const endOfImportLine = existingContent.indexOf("\n", lastImportIndex) + 1;
        
        newContent = existingContent.slice(0, endOfImportLine) + 
                    "\n" + newImport + 
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
      
      fs.writeFileSync(routerPath, newContent, "utf8");
      return true;
    } catch (error) {
      ErrorHandler.handleFileCreationError(routerPath, error, "Router Update");
      return false;
    }
  }

  /**
   * Menanyakan lokasi router utama kepada user
   * @returns {Promise<string>} Lokasi router yang dipilih
   */
  static async askRouterLocation() {
    // Router location is now root
    return this.ROUTER_LOCATIONS.ROOT;
  }

  /**
   * Menanyakan arsitektur router kepada user
   * @returns {Promise<string>} Arsitektur router yang dipilih
   */
  static async askRouterArchitecture() {
    const { architecture } = await inquirer.default.prompt([
      {
        type: "list",
        name: "architecture",
        message: "Pilih arsitektur router:",
        choices: [
          { name: "Modular (setiap modul memiliki router terpisah)", value: this.ROUTER_ARCHITECTURES.MODULAR },
          { name: "Simple (semua route dalam satu file)", value: this.ROUTER_ARCHITECTURES.SIMPLE },
        ],
      },
    ]);

    return architecture;
  }

  /**
   * Menanyakan middleware global kepada user
   * @returns {Promise<Array<string>>} Daftar middleware yang dipilih
   */
  static async askGlobalMiddleware() {
    const { useGlobalMiddleware } = await inquirer.default.prompt([
      {
        type: "confirm",
        name: "useGlobalMiddleware",
        message: "Apakah Anda ingin menggunakan middleware global?",
        default: true,
      },
    ]);

    if (!useGlobalMiddleware) {
      return [];
    }

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

    return selectedMiddlewares;
  }

  /**
   * Menanyakan apakah ingin membuat contoh penggunaan di app.js
   * @returns {Promise<boolean>} True jika ingin membuat contoh
   */
  static async askCreateAppExample() {
    const { createAppExample } = await inquirer.default.prompt([
      {
        type: "confirm",
        name: "createAppExample",
        message: "Apakah Anda ingin membuat contoh penggunaan router di app.js?",
        default: true,
      },
    ]);

    return createAppExample;
  }

  /**
   * Membuat contoh penggunaan router di app.js
   * @param {string} routerLocation - Lokasi router
   * @param {string} basePath - Path dasar proyek
   * @returns {Promise<boolean>} True jika berhasil
   */
  static async createAppExample(routerLocation, basePath) {
    try {
      const appPath = path.join(process.cwd(), "app.js");
      const relativePath = "./app/routes";
      
      if (fs.existsSync(appPath)) {
        const { overwriteApp } = await inquirer.default.prompt([
          {
            type: "confirm",
            name: "overwriteApp",
            message: "File app.js sudah ada di root proyek. Apakah Anda ingin menambahkan contoh penggunaan router?",
            default: false,
          },
        ]);

        if (!overwriteApp) {
          return false;
        }

        const appContent = `
// Contoh penggunaan router
const routes = require('${relativePath}');
app.use('/api', routes);
`;

        fs.appendFileSync(appPath, appContent, "utf8");
        console.log("✅ Contoh penggunaan router berhasil ditambahkan ke app.js root");
      } else {
        const appContent = `const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Contoh penggunaan router
const routes = require('${relativePath}');
app.use('/api', routes);

module.exports = app;
`;

        fs.writeFileSync(appPath, appContent, "utf8");
        console.log("✅ File app.js berhasil dibuat di root proyek dengan contoh penggunaan router");
      }
      
      return true;
    } catch (error) {
      ErrorHandler.handleFileCreationError(path.join(process.cwd(), "app.js"), error, "App.js Example Creation");
      return false;
    }
  }

  /**
   * Validasi integrasi router
   * @param {Array<string>} modules - Daftar nama modul
   * @param {string} basePath - Path dasar proyek
   * @param {string} architecture - Arsitektur router
   * @returns {Promise<boolean>} True jika validasi berhasil
   */
  static async validateRouterIntegration(modules, basePath, architecture) {
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
      return false;
    }
    
    return true;
  }
}

module.exports = IntegrationHelper;