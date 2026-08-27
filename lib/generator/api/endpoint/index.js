/**
 * API Endpoint Generator
 * Generate CRUD endpoints for existing modules
 */
const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { getPaths } = require("../../../constants");

/** Resolve lazily so cwd overrides are honored. */
function modulesPath() {
  return getPaths().modulesPath;
}
function sharedPath() {
  return getPaths().sharedPath;
}
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
      validate: (input) =>
        input.trim() !== "" ? true : "Nama resource tidak boleh kosong",
    },
  ]);

  const { fieldsInput } = await inquirer.default.prompt([
    {
      type: "input",
      name: "fieldsInput",
      message:
        "Field schema (format: name:type, contoh: title:string,content:text,authorId:number):",
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
  const modulePath = path.join(modulesPath(), targetModule);

  // Detect architecture
  const isModular = fs.existsSync(path.join(modulePath, "controllers"));

  if (isModular) {
    generateModularEndpoint(
      modulePath,
      kebabResource,
      pascalResource,
      camelResource,
      parsedFields,
      includePagination,
      includeFiltering
    );
  } else {
    generateSimpleEndpoint(
      modulePath,
      kebabResource,
      pascalResource,
      camelResource,
      parsedFields,
      includePagination,
      includeFiltering
    );
  }

  console.log(`✅ Endpoint '${resourceName}' berhasil dibuat!`);
}

function getAvailableModules() {
  if (!fs.existsSync(modulesPath())) return [];
  return fs.readdirSync(modulesPath()).filter((f) => {
    const stat = fs.statSync(path.join(modulesPath(), f));
    return stat.isDirectory() && !f.startsWith(".");
  });
}

function parseFields(fieldsInput) {
  return fieldsInput.split(",").map((f) => {
    const [name, type] = f.trim().split(":");
    return { name: name.trim(), type: type?.trim() || "string" };
  });
}

function generateModularEndpoint(
  modulePath,
  kebabResource,
  pascalResource,
  camelResource,
  fields,
  pagination,
  filtering
) {
  const controllerDir = path.join(modulePath, "controllers");
  const serviceDir = path.join(modulePath, "services");
  const routeFile = path.join(modulePath, "routes", `${kebabResource}.router.js`);

  fs.mkdirSync(controllerDir, { recursive: true });
  fs.mkdirSync(serviceDir, { recursive: true });

  // Generate controller
  const controllerContent = generateController(
    pascalResource,
    camelResource,
    fields,
    pagination,
    filtering
  );
  fs.writeFileSync(
    path.join(controllerDir, `${kebabResource}.controller.js`),
    controllerContent
  );

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

function generateSimpleEndpoint(
  modulePath,
  kebabResource,
  pascalResource,
  camelResource,
  fields,
  pagination,
  filtering
) {
  const controllerFile = path.join(modulePath, `${kebabResource}.controller.js`);

  const controllerContent = generateController(
    pascalResource,
    camelResource,
    fields,
    pagination,
    filtering
  );
  fs.writeFileSync(controllerFile, controllerContent);

  // Resource router that reuses the SAME controller file (kebab-case).
  // Previously this wrote a second camelCase "twin" controller with the
  // field schema silently dropped - removed.
  const routerFile = path.join(modulePath, `${kebabResource}.router.js`);
  fs.writeFileSync(routerFile, generateSimpleRouter(pascalResource, kebabResource));

  console.log(`📁 Created: ${kebabResource}.controller.js`);
  console.log(`📁 Created: ${kebabResource}.router.js`);
}

function generateController(
  pascalResource,
  camelResource,
  fields,
  pagination,
  filtering
) {
  const fieldParams = fields.map((f) => `${f.name}: req.body.${f.name}`).join(", ");

  // Always emit the query-parsing block so generated code can never hit a
  // ReferenceError; toggles only decide whether values are parsed from
  // query params or kept as safe defaults.
  let queryParams = "";
  if (pagination) {
    queryParams += `
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;`;
  } else {
    queryParams += `
    const page = 1;
    const limit = Number.MAX_SAFE_INTEGER;
    const offset = 0;`;
  }

  if (filtering) {
    const searchableFields = fields.filter((f) => ["string", "text"].includes(f.type));
    queryParams += `
    const filters = {};
    ${searchableFields
      .map(
        (f) =>
          `if (req.query.${f.name}) filters.${f.name} = String(req.query.${f.name}).toLowerCase();`
      )
      .join("\n    ")}`;
  } else {
    queryParams += `
    const filters = {};`;
  }

  return `// ${pascalResource} Controller
const ${pascalResource}Service = require("../services/${toKebabCase(pascalResource)}.service");

exports.getAll = async (req, res, next) => {
  try {${queryParams}
    const data = await ${pascalResource}Service.getAll({ page, limit, offset, filters });
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
  const STORE = `${pascalResource.toUpperCase()}_DATA`;

  // Search/filter across every declared text field instead of a hardcoded
  // field name so generated services match the user-defined schema.
  const searchableFields = fields.filter((f) => ["string", "text"].includes(f.type));
  const searchLogic = searchableFields.length
    ? searchableFields
        .map(
          (f) =>
            `(item.${f.name} || "").toString().toLowerCase().includes(filters.search)`
        )
        .join(" || ")
    : '(item.id || "").toString().toLowerCase().includes(filters.search)';

  return `// ${pascalResource} Service
// In-memory data store - replace with actual database operations when ready.
const ${STORE} = [];

exports.getAll = async (options = {}) => {
  const { page = 1, limit = 10, offset = 0, filters = {} } = options;
  let data = [...${STORE}];

  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    data = data.filter((item) => ${searchLogic});
  }

  if (Number.isFinite(limit)) {
    data = data.slice(offset, offset + limit);
  }

  return {
    data,
    total: ${STORE}.length,
    page,
    limit,
  };
};

exports.getById = async (id) => {
  return ${STORE}.find((item) => item.id === id);
};

exports.create = async (data) => {
  const newItem = { id: Date.now().toString(), ...data, createdAt: new Date() };
  ${STORE}.push(newItem);
  return newItem;
};

exports.update = async (id, data) => {
  const index = ${STORE}.findIndex((item) => item.id === id);
  if (index === -1) return null;
  ${STORE}[index] = { ...${STORE}[index], ...data, updatedAt: new Date() };
  return ${STORE}[index];
};

exports.delete = async (id) => {
  const index = ${STORE}.findIndex((item) => item.id === id);
  if (index === -1) return null;
  return ${STORE}.splice(index, 1)[0];
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

function generateSimpleRouter(pascalResource, kebabResource) {
  return `// ${pascalResource} Routes
const express = require("express");
const router = express.Router();
const ${pascalResource}Controller = require("./${kebabResource}.controller");

router.get("/", ${pascalResource}Controller.getAll);
router.get("/:id", ${pascalResource}Controller.getById);
router.post("/", ${pascalResource}Controller.create);
router.put("/:id", ${pascalResource}Controller.update);
router.delete("/:id", ${pascalResource}Controller.delete);

module.exports = router;
`;
}

module.exports = generateEndpoint;

// Injectable internals for regression tests on generated code quality.
module.exports.internals = {
  generateController,
  generateService,
  generateRoutes,
  generateSimpleEndpoint,
  parseFields,
};
