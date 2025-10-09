const path = require("path");
const { modulesPath } = require("../../../constants");
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
  toCamelCase,
} = require("../../../utils");

async function modularArch(moduleName, orm) {
  const kebabName = toKebabCase(moduleName);
  const modulePath = path.join(modulesPath, kebabName);

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
    service(moduleName, orm) // Menggunakan fungsi service yang sesuai dengan ORM
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
const { ${camelName} } = require("../../models");

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
    const camelName = toCamelCase(moduleName);

    return `// ${moduleName} Service
const { AppDataSource } = require("../../config/data-source");
const { ${pascalCase(moduleName)} } = require("../../entities/${pascalCase(
      moduleName
    )}");

const repo = AppDataSource.getRepository(${pascalCase(moduleName)});

async function getAll(req) {
  return await repo.find();
}

async function getById(req) {
  const { id } = req.params;
  return await repo.findOneBy({ id: Number(id) });
}

async function create(req) {
  const data = req.body;
  const instance = repo.create(data);
  return await repo.save(instance);
}

async function update(req) {
  const { id } = req.params;
  const data = req.body;
  const existing = await repo.findOneBy({ id: Number(id) });
  if (!existing) throw new Error("${camelName} not found");
  repo.merge(existing, data);
  return await repo.save(existing);
}

async function remove(req) {
  const { id } = req.params;
  const existing = await repo.findOneBy({ id: Number(id) });
  if (!existing) throw new Error("${camelName} not found");
  return await repo.remove(existing);
}

module.exports = { getAll, getById, create, update, remove };
`;
  } else if (orm === "Mongoose") {
    const camelName = toCamelCase(moduleName);

    return `// ${moduleName} Service
const { ${camelName}Model } = require("../../models/${camelName}.model");

async function getAll(req) {
  return await ${camelName}Model.find();
}

async function getById(req) {
  const { id } = req.params;
  return await ${camelName}Model.findById(id);
}

async function create(req) {
  const data = req.body;
  return await ${camelName}Model.create(data);
}

async function update(req) {
  const { id } = req.params;
  const data = req.body;
  return await ${camelName}Model.findByIdAndUpdate(id, data, { new: true });
}

async function remove(req) {
  const { id } = req.params;
  return await ${camelName}Model.findByIdAndDelete(id);
}

module.exports = { getAll, getById, create, update, remove };
`;
  } else {
    throw new Error(`ORM ${orm} tidak didukung`);
  }
}

module.exports = { modularArch };
