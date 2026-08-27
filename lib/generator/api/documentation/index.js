/**
 * API Documentation Generator
 * Generate Swagger/OpenAPI documentation
 */
const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { getPaths } = require("../../../constants");
const { ensureDir } = require("../../../utils");
const { writeFileIfNotExistsSafe } = require("../../../safety");

/** Resolve lazily so cwd overrides are honored. */
function basePath() {
  return getPaths().basePath;
}
function modulesPath() {
  return getPaths().modulesPath;
}

async function generateDocumentation(docTypeArg, apiTitleArg, apiVersionArg, includeAuthArg) {
  const isInteractive = !docTypeArg;
  let docType = docTypeArg;
  if (!docType) {
    const ans = await inquirer.default.prompt([
      {
        type: "select",
        name: "docType",
        message: "Pilih tipe dokumentasi:",
        choices: [
          { name: "OpenAPI 3.0 Specification (JSON)", value: "openapi-json" },
          { name: "OpenAPI 3.0 Specification (YAML)", value: "openapi-yaml" },
          { name: "Swagger UI Setup", value: "swagger-ui" },
          { name: "Complete Documentation (All)", value: "complete" },
        ],
      },
    ]);
    docType = ans.docType;
  }

  let apiTitle = apiTitleArg;
  if (isInteractive && !apiTitle && docType !== "swagger-ui") {
    const ans = await inquirer.default.prompt([
      {
        type: "input",
        name: "apiTitle",
        message: "Judul API:",
        default: "My Express API",
      },
    ]);
    apiTitle = ans.apiTitle;
  }
  apiTitle = apiTitle || "My Express API";

  let apiVersion = apiVersionArg;
  if (isInteractive && !apiVersion && docType !== "swagger-ui") {
    const ans = await inquirer.default.prompt([
      {
        type: "input",
        name: "apiVersion",
        message: "Versi API:",
        default: "1.0.0",
      },
    ]);
    apiVersion = ans.apiVersion;
  }
  apiVersion = apiVersion || "1.0.0";

  let includeAuth = includeAuthArg;
  if (isInteractive && includeAuth === undefined && docType !== "swagger-ui") {
    const ans = await inquirer.default.prompt([
      {
        type: "confirm",
        name: "includeAuth",
        message: "Termasuk dokumentasi JWT Auth?",
        default: true,
      },
    ]);
    includeAuth = ans.includeAuth;
  }
  includeAuth = includeAuth !== undefined ? includeAuth : true;

  // Create docs directory
  const docsDir = path.join(basePath(), "docs");
  ensureDir(docsDir);

  const modules = getModules();
  const createdFiles = [];

  if (
    docType === "openapi-json" ||
    docType === "complete" ||
    docType === "openapi-yaml"
  ) {
    const specFiles = generateOpenAPISpec(
      docsDir,
      apiTitle,
      apiVersion,
      includeAuth,
      modules,
      docType === "openapi-yaml"
    );
    createdFiles.push(...specFiles);
  }

  if (docType === "swagger-ui" || docType === "complete") {
    const swaggerFiles = generateSwaggerUI(docsDir);
    createdFiles.push(...swaggerFiles);
  }

  console.log("✅ Dokumentasi API berhasil dibuat!");
  console.log(`📁 Lokasi: ${docsDir}`);
  return {
    created: true,
    createdFiles,
    nextSteps: [
      "Buka spesifikasi API di folder app/docs/",
    ],
  };
}

function getModules() {
  if (!fs.existsSync(modulesPath())) return [];
  return fs.readdirSync(modulesPath()).filter((f) => {
    const stat = fs.statSync(path.join(modulesPath(), f));
    return stat.isDirectory();
  });
}

function generateOpenAPISpec(
  docsDir,
  title,
  version,
  includeAuth,
  modules,
  asYaml = false
) {
  const paths = {};

  // Generate paths from modules
  modules.forEach((module) => {
    const kebabModule = module.toLowerCase().replace(/\s+/g, "-");
    paths[`/${kebabModule}`] = {
      get: {
        tags: [module],
        summary: `Get all ${module}`,
        responses: {
          200: { description: "Successful response" },
        },
      },
      post: {
        tags: [module],
        summary: `Create new ${module}`,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { 201: { description: "Created" } },
      },
    };
    paths[`/${kebabModule}/{id}`] = {
      get: {
        tags: [module],
        summary: `Get ${module} by ID`,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          200: { description: "Successful" },
          404: { description: "Not found" },
        },
      },
      put: {
        tags: [module],
        summary: `Update ${module}`,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Updated" } },
      },
      delete: {
        tags: [module],
        summary: `Delete ${module}`,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Deleted" } },
      },
    };
  });

  const spec = {
    openapi: "3.0.0",
    info: {
      title,
      version,
      description: "API Documentation generated by rakitin",
    },
    servers: [{ url: "http://localhost:3000", description: "Development server" }],
    paths,
    components: {
      schemas: {},
    },
  };

  if (includeAuth) {
    spec.components.securitySchemes = {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    };
    spec.security = [{ BearerAuth: [] }];
  }

  const fileName = asYaml ? "openapi.yaml" : "openapi.json";
  const filePath = path.join(docsDir, fileName);
  const fileContent = asYaml ? yamlDump(spec) : JSON.stringify(spec, null, 2);
  const { written } = writeFileIfNotExistsSafe(filePath, fileContent);
  const created = written ? [filePath] : [];

  console.log(`📄 Created: ${fileName}`);
  return created;
}

function generateSwaggerUI(docsDir) {
  const created = [];
  // Generate swagger.json (spec)
  const swaggerSpec = {
    swagger: "2.0",
    info: { title: "Express API", version: "1.0.0" },
    paths: {},
  };
  const jsonPath = path.join(docsDir, "swagger.json");
  const { written: wroteJson } = writeFileIfNotExistsSafe(
    jsonPath,
    JSON.stringify(swaggerSpec, null, 2)
  );
  if (wroteJson) created.push(jsonPath);

  // Generate app.js setup
  const appSetup = `// Swagger UI Setup
// Install: npm install swagger-ui-express swagger-jsdoc

const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Express API",
      version: "1.0.0",
    },
    servers: [{ url: "http://localhost:3000" }],
  },
  apis: ["./app/docs/openapi.json"],
};

const specs = swaggerJsdoc(options);

function mountSwagger(app, basePath = "/api-docs") {
  app.use(basePath, swaggerUi.serve, swaggerUi.setup(specs));
}

module.exports = { specs, mountSwagger };
`;
  const setupPath = path.join(docsDir, "swagger-setup.js");
  const { written: wroteSetup } = writeFileIfNotExistsSafe(setupPath, appSetup);
  if (wroteSetup) created.push(setupPath);

  // Generate index.html
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <title>API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUI.create({ url: "/api/docs/openapi.json" }).appendTo("#swagger-ui");
  </script>
</body>
</html>
`;
  const htmlPath = path.join(docsDir, "index.html");
  const { written: wroteHtml } = writeFileIfNotExistsSafe(htmlPath, htmlContent);
  if (wroteHtml) created.push(htmlPath);

  console.log("📄 Created: swagger.json, swagger-setup.js, index.html");
  return created;
}

function yamlDump(obj, indent = 0) {
  const spaces = "  ".repeat(indent);
  let result = "";

  if (Array.isArray(obj)) {
    obj.forEach((item) => {
      if (typeof item === "object") {
        result += `${spaces}- ${yamlDump(item, indent + 1).trim()}\n`;
      } else {
        result += `${spaces}- ${item}\n`;
      }
    });
  } else if (typeof obj === "object" && obj !== null) {
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === "object") {
        result += `${spaces}${key}:\n${yamlDump(value, indent + 1)}`;
      } else {
        result += `${spaces}${key}: ${value}\n`;
      }
    });
  } else {
    result += `${spaces}${obj}\n`;
  }

  return result;
}

module.exports = generateDocumentation;
