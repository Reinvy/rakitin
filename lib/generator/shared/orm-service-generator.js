const { toCamelCase, toPascalCase, toKebabCase } = require("../../utils");

/**
 * Menghasilkan kode untuk service layer berdasarkan ORM yang dipilih
 * @param {string} moduleName - Nama modul
 * @param {string} orm - Jenis ORM (Prisma, Sequelize, TypeORM, Mongoose)
 * @param {string} architecture - Jenis arsitektur (Simple, Modular)
 * @returns {string} Kode untuk service layer
 */
function generateServiceCode(moduleName, orm, architecture) {
  if (!moduleName || !orm) {
    throw new Error("Nama modul dan ORM harus didefinisikan");
  }

  const camelName = toCamelCase(moduleName);
  const pascalName = toPascalCase(moduleName);
  const kebabName = toKebabCase(moduleName);

  // Path relatif tergantung arsitektur
  const getModelPath = (type) => {
    if (architecture === "Modular") {
      switch (type) {
        case "prisma":
          return "../../config/db";
        case "sequelize":
          return `../../models/${kebabName}.model`;
        case "typeorm":
          return `../../entities/${kebabName}.entity`;
        case "mongoose":
          return `../../models/${kebabName}.model`;
        default:
          return "";
      }
    } else {
      // Simple architecture
      switch (type) {
        case "prisma":
          return "../../config/db";
        case "sequelize":
          return `./${kebabName}.model`;
        case "typeorm":
          return "../../../shared/config/data-source";
        case "mongoose":
          return `./${kebabName}.model`;
        default:
          return "";
      }
    }
  };

  // Generate common service operations
  const generateServiceOperations = (ormType) => {
    switch (ormType) {
      case "Prisma":
        return `
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
}`;

      case "Sequelize":
        return `
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
}`;

      case "TypeORM": {
        const typeormImport =
          architecture === "Modular"
            ? `const { AppDataSource } = require("../../config/data-source");
const ${pascalName} = require("../../entities/${kebabName}.entity");`
            : `const { AppDataSource } = require("../../../shared/config/data-source");
const ${pascalName} = require("./${kebabName}.entity");`;

        return `${typeormImport}

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
}`;
      }
      case "Mongoose":
        return `
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
}`;

      case "None":
        // No-ORM mode: plain in-memory CRUD with zero dependencies.
        // Users swap the internal operations for a DB later without
        // touching controller/router layers.
        return `
const ${camelName.toUpperCase()}_STORE = [];

async function getAll(req) {
  const { page = 1, limit = 10 } = req.query;
  const start = (Number(page) - 1) * Number(limit);
  const items = ${camelName.toUpperCase()}_STORE.slice(start, start + Number(limit));
  return { items, total: ${camelName.toUpperCase()}_STORE.length };
}

async function getById(req) {
  const { id } = req.params;
  return ${camelName.toUpperCase()}_STORE.find((item) => item.id === id) || null;
}

async function create(req) {
  const item = { id: Date.now().toString(), ...req.body };
  ${camelName.toUpperCase()}_STORE.push(item);
  return item;
}

async function update(req) {
  const { id } = req.params;
  const index = ${camelName.toUpperCase()}_STORE.findIndex((item) => item.id === id);
  if (index === -1) return null;
  ${camelName.toUpperCase()}_STORE[index] = { ...${camelName.toUpperCase()}_STORE[index], ...req.body };
  return ${camelName.toUpperCase()}_STORE[index];
}

async function remove(req) {
  const { id } = req.params;
  const index = ${camelName.toUpperCase()}_STORE.findIndex((item) => item.id === id);
  if (index === -1) return null;
  return ${camelName.toUpperCase()}_STORE.splice(index, 1)[0];
}`;

      default:
        throw new Error(`ORM ${orm} tidak didukung`);
    }
  };

  // Generate full service code based on ORM
  switch (orm) {
    case "Prisma":
      return `// ${moduleName} Service
const { prisma } = require("${getModelPath("prisma")}");

${generateServiceOperations("Prisma")}

module.exports = { getAll, getById, create, update, remove };`;

    case "Sequelize":
      return `// ${moduleName} Service
const ${pascalName} = require("${getModelPath("sequelize")}");

${generateServiceOperations("Sequelize")}

module.exports = { getAll, getById, create, update, remove };`;

    case "TypeORM":
      return `// ${moduleName} Service
${generateServiceOperations("TypeORM")}

module.exports = { getAll, getById, create, update, remove };`;

    case "Mongoose":
      return `// ${moduleName} Service
const ${camelName}Model = require("${getModelPath("mongoose")}");

${generateServiceOperations("Mongoose")}

module.exports = { getAll, getById, create, update, remove };`;

    case "None":
      return `// ${moduleName} Service (No ORM - in-memory store)
// Replace the in-memory operations with real database calls when ready.

${generateServiceOperations("None")}

module.exports = { getAll, getById, create, update, remove };`;

    default:
      throw new Error(`ORM ${orm} tidak didukung`);
  }
}

module.exports = {
  generateServiceCode,
};
