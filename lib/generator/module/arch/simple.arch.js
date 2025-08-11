const path = require("path");
const { modulesPath } = require("../../../constants");
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
} = require("../../../utils");
async function simpleArch(moduleName) {
  const kebabName = toKebabCase(moduleName);
  const modulePath = path.join(modulesPath, kebabName);

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
const { example } = require("./${kebabName}.controller");

router.get("/", example);

module.exports = router;`
  );
}

module.exports = { simpleArch };
