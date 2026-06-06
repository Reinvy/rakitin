/**
 * API Endpoint Generator
 * Generate CRUD endpoints for existing modules
 */
const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { modulesPath, sharedPath } = require("../../../constants");
const { toPascalCase, toKebabCase, toCamelCase } = require("../../../utils");

async function generateEndpoint() {
  const modules = getAvailableModules();

  if (modules.length === 0) {
    console.log("⚠️  Tidak ada modul ditemukan. Buat modul terlebih dahulu.");
    return;
  }

  const { targetModule } = await inquirer.default.prompt([
    {
      type: "list",
      name: "targetModule",
      message: "Pilih modul target:",
      choices: modules,
    },
  ]);

  const { resourceName } = await inquirer.default.prompt([
    {
      type: "input",
      name: "resourceName",
      message: "Nama resource (contoh: posts, comments):",
      validate: (input) => input.trim() !== "" ? true : "Nama resource tidak boleh kosong",
    },
  ]);

  const { fieldsInput } = await inquirer.default.prompt([
    {
      type: "input",
      name: "fieldsInput",
      message: "Field schema (format: name:type, contoh: title:string,content:text,authorId:number):",
      default: "title:string,content:text",
    },
  ]);

  const { includePagination } = await inquirer.default.prompt([
    {
      type: "confirm",
      name: "includePagination",
      message: "Tambahkan pagination?",
      default: true,
    },
  ]);

  const { includeFiltering } = await inquirer.default.prompt([
    {
      type: "confirm",
      name: "includeFiltering",
      message: "Tambahkan filtering?",
      default: true,
    },
  ]);

  const parsedFields = parseFields(fieldsInput);
  const kebabResource = toKebabCase(resourceName);
  const pascalResource = toPascalCase(resourceName);
  const camelResource = toCamelCase(resourceName);
  const modulePath = path.join(modulesPath, targetModule);

  // Detect architecture
  const isModular = fs.existsSync(path.join(modulePath, "controllers"));

  if (isModular) {
    generateModularEndpoint(modulePath, kebabResource, pascalResource, camelResource, parsedFields, includePagination, includeFiltering);
  } else {
    generateSimpleEndpoint(modulePath, kebabResource, pascalResource, camelResource, parsedFields, includePagination, includeFiltering);
  }

  console.log(`✅ Endpoint '${resourceName}' berhasil dibuat!`);
}

function getAvailableModules() {
  if (!fs.existsSync(modulesPath)) return [];
  return fs.readdirSync(modulesPath).filter((f) => {
    const stat = fs.statSync(path.join(modulesPath, f));
    return stat.isDirectory() && !f.startsWith(".");
  });
}

function parseFields(fieldsInput) {
  return fieldsInput.split(",").map((f) => {
    const [name, type] = f.trim().split(":");
    return { name: name.trim(), type: type?.trim() || "string" };
  });
}

function generateModularEndpoint(modulePath, kebabResource, pascalResource, camelResource, fields, pagination, filtering) {
  const controllerDir = path.join(modulePath, "controllers");
  const serviceDir = path.join(modulePath, "services");
  const routeFile = path.join(modulePath, "routes", `${kebabResource}.router.js`);

  fs.mkdirSync(controllerDir, { recursive: true });
  fs.mkdirSync(serviceDir, { recursive: true });

  // Generate controller
  const controllerContent = generateController(pascalResource, camelResource, fields, pagination, filtering);
  fs.writeFileSync(path.join(controllerDir, `${kebabResource}.controller.js`), controllerContent);

  // Generate service
  const serviceContent = generateService(pascalResource, camelResource, fields);
  fs.writeFileSync(path.join(serviceDir, `${kebabResource}.service.js`), serviceContent);

  // Generate/Update routes
  const routeContent = generateRoutes(pascalResource, camelResource, kebabResource);
  fs.writeFileSync(routeFile, routeContent);

  console.log(`📁 Created: controllers/${kebabResource}.controller.js`);
  console.log(`📁 Created: services/${kebabResource}.service.js`);
  console.log(`📁 Created: routes/${kebabResource}.router.js`);
}

function generateSimpleEndpoint(modulePath, kebabResource, pascalResource, camelResource, fields, pagination, filtering) {
  const controllerFile = path.join(modulePath, `${kebabResource}.controller.js`);

  const controllerContent = generateController(pascalResource, camelResource, fields, pagination, filtering);
  fs.writeFileSync(controllerFile, controllerContent);

  // Update main router
  updateMainRouter(modulePath, pascalResource, camelResource, kebabResource);

  console.log(`📁 Created: ${kebabResource}.controller.js`);
}

function generateController(pascalResource, camelResource, fields, pagination, filtering) {
  const fieldParams = fields.map((f) => `${f.name}: req.body.${f.name}`).join(", ");

  let paginationCode = "";
  if (pagination) {
    paginationCode = `
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;`;
  }

  let filteringCode = "";
  if (filtering) {
    filteringCode = `
    const filters = {};
    if (req.query.search) filters.search = req.query.search;
    if (req.query.status) filters.status = req.query.status;`;
  }

  return `// ${pascalResource} Controller
const ${pascalResource}Service = require("../services/${camelResource}.service");

exports.getAll = async (req, res, next) => {
  try {${paginationCode}${filteringCode}
    const data = await ${pascalResource}Service.getAll({ page, limit, offset, filters, ...req.query });
    res.status(200).json({
      success: true,
      message: "${pascalResource} retrieved successfully",
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const data = await ${pascalResource}Service.getById(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: "${pascalResource} not found" });
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = await ${pascalResource}Service.create(${fieldParams ? `{ ${fieldParams} }` : "req.body"});
    res.status(201).json({ success: true, message: "${pascalResource} created", data });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const data = await ${pascalResource}Service.update(req.params.id, req.body);
    if (!data) {
      return res.status(404).json({ success: false, message: "${pascalResource} not found" });
    }
    res.status(200).json({ success: true, message: "${pascalResource} updated", data });
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const data = await ${pascalResource}Service.delete(req.params.id);
    if (!data) {
      return res.status(404).json({ success: false, message: "${pascalResource} not found" });
    }
    res.status(200).json({ success: true, message: "${pascalResource} deleted" });
  } catch (err) {
    next(err);
  }
};
`;
}

function generateService(pascalResource, camelResource, fields) {
  const idType = fields.find((f) => f.name.toLowerCase().includes("id"))?.type || "string";

  return `// ${pascalResource} Service
// Mock data store - replace with actual database operations
const ${pascalResource.toUpperCase()}_DATA = [];

exports.getAll = async (filters = {}) => {
  let data = [...${pascalResource.toUpperCase()}_DATA];

  if (filters.search) {
    data = data.filter((item) =>
      item.title?.toLowerCase().includes(filters.search.toLowerCase())
    );
  }

  if (filters.page && filters.limit) {
    const offset = (filters.page - 1) * filters.limit;
    data = data.slice(offset, offset + parseInt(filters.limit));
  }

  return {
    data,
    total: ${pascalResource.toUpperCase()}_DATA.length,
    page: filters.page || 1,
    limit: filters.limit || 10,
  };
};

exports.getById = async (id) => {
  return ${pascalResource.toUpperCase()}_DATA.find((item) => item.id === id);
};

exports.create = async (data) => {
  const newItem = { id: Date.now().toString(), ...data, createdAt: new Date() };
  ${pascalResource.toUpperCase()}_DATA.push(newItem);
  return newItem;
};

exports.update = async (id, data) => {
  const index = ${pascalResource.toUpperCase()}_DATA.findIndex((item) => item.id === id);
  if (index === -1) return null;
  ${pascalResource.toUpperCase()}_DATA[index] = { ...${pascalResource.toUpperCase()}_DATA[index], ...data, updatedAt: new Date() };
  return ${pascalResource.toUpperCase()}_DATA[index];
};

exports.delete = async (id) => {
  const index = ${pascalResource.toUpperCase()}_DATA.findIndex((item) => item.id === id);
  if (index === -1) return null;
  return ${pascalResource.toUpperCase()}_DATA.splice(index, 1)[0];
};
`;
}

function generateRoutes(pascalResource, camelResource, kebabResource) {
  return `// ${pascalResource} Routes
const express = require("express");
const router = express.Router();
const ${pascalResource}Controller = require("../../controllers/${kebabResource}.controller");

router.get("/", ${pascalResource}Controller.getAll);
router.get("/:id", ${pascalResource}Controller.getById);
router.post("/", ${pascalResource}Controller.create);
router.put("/:id", ${pascalResource}Controller.update);
router.delete("/:id", ${pascalResource}Controller.delete);

module.exports = router;
`;
}

function updateMainRouter(modulePath, pascalResource, camelResource, kebabResource) {
  const routerFile = path.join(modulePath, `${kebabResource}.router.js`);
  const controllerFile = path.join(modulePath, `${camelResource}.controller.js`);

  const content = generateSimpleRouter(pascalResource, camelResource, kebabResource);
  fs.writeFileSync(routerFile, content);

  // Copy controller to module root
  const controllerContent = generateController(pascalResource, camelResource, [], false, false);
  fs.writeFileSync(controllerFile, controllerContent);
}

function generateSimpleRouter(pascalResource, camelResource, kebabResource) {
  return `// ${pascalResource} Router
const express = require("express");
const router = express.Router();
const ${pascalResource}Controller = require("./${camelResource}.controller");

router.get("/", ${pascalResource}Controller.getAll);
router.get("/:id", ${pascalResource}Controller.getById);
router.post("/", ${pascalResource}Controller.create);
router.put("/:id", ${pascalResource}Controller.update);
router.delete("/:id", ${pascalResource}Controller.delete);

module.exports = router;
`;
}

module.exports = generateEndpoint;