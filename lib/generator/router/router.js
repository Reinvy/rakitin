const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { modulesPath, basePath } = require("../../constants");
const { ensureDir } = require("../../utils");

async function integrateRouter() {
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

  // Tanya di mana router utama akan dibuat
  const { routerLocation } = await inquirer.default.prompt([
    {
      type: "list",
      name: "routerLocation",
      message: "Di mana router utama akan dibuat?",
      choices: [
        { name: "Di folder app/routes", value: "app" },
        { name: "Di folder root", value: "root" },
      ],
    },
  ]);

  let appRouterPath;
  if (routerLocation === "app") {
    appRouterPath = path.join(basePath, "routes", "index.js");
    ensureDir(path.join(basePath, "routes"));
  } else {
    appRouterPath = path.join(process.cwd(), "routes", "index.js");
    ensureDir(path.join(process.cwd(), "routes"));
  }

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

  let content = "";

  if (architecture === "modular") {
    content = `const express = require('express');
const router = express.Router();
`;

    modules.forEach((m) => {
      content += `const ${m}Router = require('../modules/${m}/${m}-router');\n`;
    });

    content += "\n";

    modules.forEach((m) => {
      content += `router.use('/${m}', ${m}Router);\n`;
    });

    content += "\nmodule.exports = router;\n";
  } else {
    // Simple architecture
    content = `const express = require('express');
const router = express.Router();
`;

    modules.forEach((m) => {
      content += `// Routes for ${m}
const ${m}Controller = require('../modules/${m}/${m}-controller');
`;
    });

    content += "\n";

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

  fs.writeFileSync(appRouterPath, content, "utf8");
  console.log(`✅ Router utama berhasil dibuat di ${appRouterPath}`);
  console.log(`✅ ${modules.length} modul berhasil diintegrasikan!`);

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
    const appPath = path.join(basePath, "app.js");
    
    if (fs.existsSync(appPath)) {
      const { overwriteApp } = await inquirer.default.prompt([
        {
          type: "confirm",
          name: "overwriteApp",
          message: "File app.js sudah ada. Apakah Anda ingin menambahkan contoh penggunaan router?",
          default: false,
        },
      ]);

      if (overwriteApp) {
        const relativePath = routerLocation === "app" ? "./routes" : "./routes";
        const appContent = `
// Contoh penggunaan router
const routes = require('${relativePath}');
app.use('/api', routes);
`;

        fs.appendFileSync(appPath, appContent, "utf8");
        console.log("✅ Contoh penggunaan router berhasil ditambahkan ke app.js");
      }
    } else {
      const relativePath = routerLocation === "app" ? "./routes" : "./routes";
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
      console.log("✅ File app.js berhasil dibuat dengan contoh penggunaan router");
    }
  }
}

module.exports = { integrateRouter };
