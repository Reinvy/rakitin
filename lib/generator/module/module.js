const inquirer = require("inquirer");
const path = require("path");
const { modulesPath } = require("../../constants");
const { ensureDir, writeFileIfNotExists, toKebabCase } = require("../../utils");

async function generateModule() {
  const { moduleName, architecture } = await inquirer.default.prompt([
    {
      type: "input",
      name: "moduleName",
      message: "Nama modul:",
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
  ]);

  const kebabName = toKebabCase(moduleName);
  const modulePath = path.join(modulesPath, kebabName);

  if (architecture === "Simple") {
    const controllerPath = path.join(modulePath, `${kebabName}.controller.js`);
    const servicePath = path.join(modulePath, `${kebabName}.service.js`);
    const routerPath = path.join(modulePath, `${kebabName}.routes.js`);

    ensureDir(modulePath);
    writeFileIfNotExists(
      controllerPath,
      `// ${moduleName} Controller

import { StatusCodes } from "http-status-codes";
const { getAll } = require("./${kebabName}.service");

exports.getAll = async (req, res, next) => {
  try {
      const data = await getAll(req);
      res.status(StatusCodes.OK).json({
        message: "",
        data,
      });
      logger(req, "", "${moduleName} Controller - getAll", "info");
    } catch (err) {
      next(err);
    }
};`
    );
    writeFileIfNotExists(
      servicePath,
      `// ${moduleName} Service
exports.getAll = async (req) => {
  // Logika bisnis untuk mengambil data ${moduleName}
};

exports.create = async (data) => {
  // Logika bisnis untuk membuat data ${moduleName}
};`
    );
    writeFileIfNotExists(
      routerPath,
      `// ${moduleName} Router
const express = require("express");
const router = express.Router();
const { example } = require("./${kebabName}Controller");

router.get("/", example);

module.exports = router;`
    );
  } else if (architecture === "Modular") {
    const dirs = ["controllers", "services", "models", "routes"];
    dirs.forEach((dir) => ensureDir(path.join(modulePath, dir)));

    writeFileIfNotExists(
      path.join(modulePath, "controllers", `${kebabName}.controller.js`),
      `// ${moduleName} Controller
exports.example = (req, res) => {
  res.send("Hello from ${moduleName} controller");
};`
    );

    writeFileIfNotExists(
      path.join(modulePath, "services", `${kebabName}.service.js`),
      `// ${moduleName} Service
exports.getData = () => {
  return "Data from ${moduleName} service";
};`
    );

    writeFileIfNotExists(
      path.join(modulePath, "models", `${kebabName}.model.js`),
      `// ${moduleName} Model
// Schema atau ORM Model bisa ditulis di sini.`
    );

    writeFileIfNotExists(
      path.join(modulePath, "routes", `${kebabName}.routes.js`),
      `// ${moduleName} Routes
const express = require("express");
const router = express.Router();
const { example } = require("../controllers/${kebabName}.controller");

router.get("/", example);

module.exports = router;`
    );
  }

  console.log(
    `\n✅ Modul \"${moduleName}\" berhasil dibuat dengan arsitektur ${architecture}\n`
  );
}

module.exports = generateModule;
