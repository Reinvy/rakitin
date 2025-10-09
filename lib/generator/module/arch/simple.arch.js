const path = require("path");
const { modulesPath } = require("../../../constants");
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
  toCamelCase,
} = require("../../../utils");
async function simpleArch(moduleName, orm) {
  const kebabName = toKebabCase(moduleName);
  const modulePath = path.join(modulesPath, kebabName);

  const controllerPath = path.join(modulePath, `${kebabName}.controller.js`);
  const servicePath = path.join(modulePath, `${kebabName}.service.js`);
  const routerPath = path.join(modulePath, `${kebabName}.routes.js`);

  ensureDir(modulePath);
  writeFileIfNotExists(
    controllerPath,
    `// ${moduleName} Controller

const { StatusCodes } = require("http-status-codes");
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
    service(moduleName, orm) // Menggunakan fungsi service yang sesuai dengan ORM
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

function service(moduleName, orm) {
  if (orm === "Prisma") {
    const camelName = toCamelCase(moduleName);

    return `// ${moduleName} Service
const { prisma } = require("../../config/db");

async function getAll(req) {
  return await prisma.${camelName}.findMany();
}

async function getById(req) {
  const { id } = req.params;
  return await prisma.${camelName}.findUnique({ where: { id: Number(id) } });
}

async function create(req) {
  const data = req.body;
  return await prisma.${camelName}.create({ data });
}

async function update(req) {
  const { id } = req.params;
  const data = req.body;
  return await prisma.${camelName}.update({
    where: { id: Number(id) },
    data,
  });
}

async function remove(req) {
  const { id } = req.params;
  return await prisma.${camelName}.delete({ where: { id: Number(id) } });
}

module.exports = { getAll, getById, create, update, remove };
`;
  } else if (orm === "Sequelize") {
    const camelName = toCamelCase(moduleName);

    return `// ${moduleName} Service
const { ${camelName} } = require("./${toKebabCase(moduleName)}.model");

async function getAll(req) {
  return await ${camelName}.findAll();
}

async function getById(req) {
  const { id } = req.params;
  return await ${camelName}.findByPk(id);
}

async function create(req) {
  const data = req.body;
  return await ${camelName}.create(data);
}

async function update(req) {
  const { id } = req.params;
  const data = req.body;
  const record = await ${camelName}.findByPk(id);
  if (!record) throw new Error("${camelName} not found");
  return await record.update(data);
}

async function remove(req) {
  const { id } = req.params;
  const record = await ${camelName}.findByPk(id);
  if (!record) throw new Error("${camelName} not found");
  return await record.destroy();
}

module.exports = { getAll, getById, create, update, remove };
`;
  } else if (orm === "TypeORM") {
    // TODO: Add TypeORM
  } else if (orm === "Mongoose") {
    // TODO: Add Mongoose
  } else {
    throw new Error(`ORM ${orm} tidak didukung`);
  }
}

module.exports = { simpleArch };
