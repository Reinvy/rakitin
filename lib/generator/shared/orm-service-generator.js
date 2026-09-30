const { moduleIdentifiers } = require("./identifiers");
const { renderModuleTemplate } = require("../../template/module-templates");

/**
 * Generate the service layer for a module.
 * @param {string} moduleName
 * @param {"Prisma"|"Sequelize"|"TypeORM"|"Mongoose"|"None"} orm
 * @param {"Simple"|"Modular"} architecture
 * @returns {string}
 */
function generateServiceCode(moduleName, orm, architecture) {
  if (!moduleName || !orm) {
    throw new Error("Nama modul dan ORM harus didefinisikan");
  }

  const { kebab: kebabName, camelName, pascalName, storeName } = moduleIdentifiers(moduleName);

  // Model import path depends on architecture + ORM.
  const getModelPath = (type) => {
    if (architecture === "Modular") {
      switch (type) {
        case "prisma":
          return "../../../shared/config/db";
        case "sequelize":
          return `../models/${kebabName}.model`;
        case "typeorm":
          return `../entities/${kebabName}.entity`;
        case "mongoose":
          return `../models/${kebabName}.model`;
        default:
          return "";
      }
    }
    switch (type) {
      case "prisma":
        return "../../shared/config/db";
      case "sequelize":
        return `./${kebabName}.model`;
      case "typeorm":
        return "../../shared/config/data-source";
      case "mongoose":
        return `./${kebabName}.model`;
      default:
        return "";
    }
  };

  const operations = {
    Prisma: `
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
}`,

    Sequelize: `
async function getAll(req) {
  return await ${pascalName}.findAll();
}

async function getById(req) {
  const { id } = req.params;
  return await ${pascalName}.findByPk(id);
}

async function create(req) {
  const data = req.body;
  return await ${pascalName}.create(data);
}

async function update(req) {
  const { id } = req.params;
  const data = req.body;
  const record = await ${pascalName}.findByPk(id);
  if (!record) throw new Error("${camelName} tidak ditemukan");
  return await record.update(data);
}

async function remove(req) {
  const { id } = req.params;
  const record = await ${pascalName}.findByPk(id);
  if (!record) throw new Error("${camelName} tidak ditemukan");
  return await record.destroy();
}`,

    TypeORM: `${
      architecture === "Modular"
        ? `const { AppDataSource } = require("../../../shared/config/data-source");
const ${pascalName} = require("../entities/${kebabName}.entity");`
        : `const { AppDataSource } = require("../../shared/config/data-source");
const ${pascalName} = require("./${kebabName}.entity");`
    }

const repo = AppDataSource.getRepository(${pascalName});

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
  if (!existing) throw new Error("${camelName} tidak ditemukan");
  repo.merge(existing, data);
  return await repo.save(existing);
}

async function remove(req) {
  const { id } = req.params;
  const existing = await repo.findOneBy({ id: Number(id) });
  if (!existing) throw new Error("${camelName} tidak ditemukan");
  return await repo.remove(existing);
}`,

    Mongoose: `
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
}`,
  };

  switch (orm) {
    case "Prisma":
      return `// ${moduleName} Service
const { prisma } = require("${getModelPath("prisma")}");

${operations.Prisma}

module.exports = { getAll, getById, create, update, remove };`;

    case "Sequelize":
      return `// ${moduleName} Service
const ${pascalName} = require("${getModelPath("sequelize")}");

${operations.Sequelize}

module.exports = { getAll, getById, create, update, remove };`;

    case "TypeORM":
      return `// ${moduleName} Service
${operations.TypeORM}

module.exports = { getAll, getById, create, update, remove };`;

    case "Mongoose":
      return `// ${moduleName} Service
const ${camelName}Model = require("${getModelPath("mongoose")}");

${operations.Mongoose}

module.exports = { getAll, getById, create, update, remove };`;

    case "None":
      return renderModuleTemplate("service-none.ejs", { moduleName, storeName });

    default:
      throw new Error(`ORM ${orm} tidak didukung`);
  }
}

module.exports = {
  generateServiceCode,
  moduleIdentifiers,
};
