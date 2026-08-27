/**
 * API Validation Generator
 * Generate Joi validation schemas
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
const { toPascalCase, toKebabCase } = require("../../../utils");

async function generateValidation(typeArg, nameArg, fieldsArg) {
  let validatorType = typeArg;
  if (!validatorType) {
    const ans = await inquirer.default.prompt([
      {
        type: "select",
        name: "validatorType",
        message: "Pilih tipe validator:",
        choices: [
          { name: "Generate from module", value: "from-module" },
          { name: "Create new validator", value: "new" },
          { name: "Common validators", value: "common" },
        ],
      },
    ]);
    validatorType = ans.validatorType;
  }

  if (validatorType === "from-module") {
    await generateFromModule(nameArg, fieldsArg);
  } else if (validatorType === "new") {
    await generateNewValidator(nameArg, fieldsArg);
  } else {
    await generateCommonValidators();
  }
}

async function generateFromModule(moduleArg, fieldsArg) {
  const modules = getAvailableModules();

  if (modules.length === 0) {
    console.log("⚠️  Tidak ada modul ditemukan.");
    return;
  }

  let targetModule = moduleArg;
  if (!targetModule) {
    const ans = await inquirer.default.prompt([
      {
        type: "select",
        name: "targetModule",
        message: "Pilih modul:",
        choices: modules,
      },
    ]);
    targetModule = ans.targetModule;
  }

  let fieldsInput = fieldsArg;
  if (!fieldsInput) {
    const ans = await inquirer.default.prompt([
      {
        type: "input",
        name: "fieldsInput",
        message:
          "Field schema (format: name:type:required, contoh: email:string:true,password:string:true):",
        default: "title:string:true,content:text:false",
      },
    ]);
    fieldsInput = ans.fieldsInput;
  }
  fieldsInput = fieldsInput || "title:string:true,content:text:false";

  const parsedFields = parseValidationFields(fieldsInput);
  const validatorName = toPascalCase(targetModule);
  const kebabName = toKebabCase(targetModule);

  const validatorDir = path.join(sharedPath(), "validators");
  fs.mkdirSync(validatorDir, { recursive: true });

  const content = generateJoiSchema(validatorName, parsedFields);
  const filePath = path.join(validatorDir, `${kebabName}.validator.js`);

  fs.writeFileSync(filePath, content);
  console.log(`✅ Validator '${kebabName}.validator.js' berhasil dibuat!`);
  console.log(`📁 Lokasi: app/shared/validators/${kebabName}.validator.js`);
}

async function generateNewValidator(nameArg, fieldsArg) {
  const isInteractive = !nameArg;
  let validatorName = nameArg;
  if (!validatorName) {
    const ans = await inquirer.default.prompt([
      {
        type: "input",
        name: "validatorName",
        message: "Nama validator (contoh: User, Product):",
        validate: (input) => (input.trim() !== "" ? true : "Nama tidak boleh kosong"),
      },
    ]);
    validatorName = ans.validatorName;
  }
  validatorName = validatorName || "Item";

  let fieldsInput = fieldsArg;
  if (isInteractive && !fieldsInput) {
    const ans = await inquirer.default.prompt([
      {
        type: "input",
        name: "fieldsInput",
        message: "Field schema (format: name:type:required):",
        default: "name:string:true,email:email:true,password:string:true",
      },
    ]);
    fieldsInput = ans.fieldsInput;
  }
  fieldsInput = fieldsInput || "name:string:true,email:string:true";

  const parsedFields = parseValidationFields(fieldsInput);
  const pascalName = toPascalCase(validatorName);
  const kebabName = toKebabCase(validatorName);

  const validatorDir = path.join(sharedPath(), "validators");
  fs.mkdirSync(validatorDir, { recursive: true });

  const content = generateJoiSchema(pascalName, parsedFields);
  const filePath = path.join(validatorDir, `${kebabName}.validator.js`);

  fs.writeFileSync(filePath, content);
  console.log(`✅ Validator '${kebabName}.validator.js' berhasil dibuat!`);
}

async function generateCommonValidators() {
  const validatorDir = path.join(sharedPath(), "validators");
  fs.mkdirSync(validatorDir, { recursive: true });

  // Generate common validators
  const commonValidators = {
    "common.validator.js": generateCommonValidator(),
    "email.validator.js": generateEmailValidator(),
    "pagination.validator.js": generatePaginationValidator(),
  };

  Object.entries(commonValidators).forEach(([fileName, content]) => {
    const filePath = path.join(validatorDir, fileName);
    fs.writeFileSync(filePath, content);
    console.log(`📄 Created: ${fileName}`);
  });

  console.log("✅ Common validators berhasil dibuat!");
}

function parseValidationFields(fieldsInput) {
  return fieldsInput.split(",").map((f) => {
    const [name, type, required] = f.trim().split(":");
    return {
      name: name.trim(),
      type: type?.trim() || "string",
      required: required?.trim() === "true",
    };
  });
}

function generateJoiSchema(name, fields) {
  // NOTE: each property line ends with a comma - without it every
  // generated schema was syntactically invalid (caught by regression tests).
  const schemaFields = fields
    .map((f) => {
      const joiType = mapToJoiType(f.type, f.name);
      const requiredMark = f.required ? ".required()" : ".optional()";
      return `    ${f.name}: Joi.${joiType}${requiredMark},`;
    })
    .join("\n");

  return `// ${name} Validation Schema
const Joi = require("joi");

const ${name}Schema = Joi.object({
${schemaFields}
});

const ${name}CreateSchema = ${name}Schema.keys({
${fields
  .filter((f) => f.required)
  .map((f) => `  ${f.name}: Joi.${mapToJoiType(f.type, f.name)}.required()`)
  .join(",\n")}
});

const ${name}UpdateSchema = ${name}Schema.keys({
${fields.map((f) => `  ${f.name}: Joi.${mapToJoiType(f.type, f.name)}.optional()`).join(",\n")}
}).min(1);

module.exports = {
  ${name}Schema,
  ${name}CreateSchema,
  ${name}UpdateSchema,
};
`;
}

function mapToJoiType(type, fieldName) {
  const typeMap = {
    string: "string()",
    text: "string()",
    email: "string().email()",
    number: "number()",
    integer: "number().integer()",
    boolean: "boolean()",
    date: "date()",
    uuid: "string().uuid()",
    url: "string().uri()",
  };

  // Auto-detect based on field name
  if (fieldName.toLowerCase().includes("email")) return "string().email()";
  if (fieldName.toLowerCase().includes("password")) return "string().min(6)";
  if (fieldName.toLowerCase().includes("id")) return "string()";
  if (fieldName.toLowerCase().includes("url") || fieldName.toLowerCase().includes("link"))
    return "string().uri()";
  if (
    fieldName.toLowerCase().includes("age") ||
    fieldName.toLowerCase().includes("count")
  )
    return "number().integer()";

  return typeMap[type.toLowerCase()] || "string()";
}

function generateCommonValidator() {
  return `// Common Validation Schemas
const Joi = require("joi");

const idSchema = Joi.string().required();
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sort: Joi.string().default("-createdAt"),
  search: Joi.string().allow(""),
});

const filterSchema = Joi.object({
  status: Joi.string().valid("active", "inactive", "pending"),
  createdFrom: Joi.date(),
  createdTo: Joi.date(),
});

module.exports = {
  idSchema,
  paginationSchema,
  filterSchema,
};
`;
}

function generateEmailValidator() {
  return `// Email Validation Schema
const Joi = require("joi");

const emailSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Format email tidak valid",
    "any.required": "Email wajib diisi",
  }),
});

const emailVerificationSchema = Joi.object({
  email: Joi.string().email().required(),
  token: Joi.string().required(),
});

module.exports = {
  emailSchema,
  emailVerificationSchema,
};
`;
}

function generatePaginationValidator() {
  return `// Pagination Validation Schema
const Joi = require("joi");

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  offset: Joi.number().integer().min(0),
});

const cursorPaginationSchema = Joi.object({
  cursor: Joi.string(),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

module.exports = {
  paginationSchema,
  cursorPaginationSchema,
};
`;
}

function getAvailableModules() {
  if (!fs.existsSync(modulesPath())) return [];
  return fs.readdirSync(modulesPath()).filter((f) => {
    const stat = fs.statSync(path.join(modulesPath(), f));
    return stat.isDirectory() && !f.startsWith(".");
  });
}

module.exports = generateValidation;

// Injectable internals for regression tests on generated code quality.
module.exports.internals = {
  generateJoiSchema,
  mapToJoiType,
};
