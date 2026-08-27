/**
 * lib/commands/recipe.js - Advanced-tier composite recipes.
 *
 * A recipe composes multiple primitives + config into one opinionated,
 * production-shaped result while still routing every write through the
 * safety layer (never clobbers user files).
 */

const fs = require("fs-extra");
const path = require("path");
const { createMiddleware } = require("../generator/middleware/middleware");
const { ensureDependencies, ormToKind } = require("../deps/manifest");
const { writeFileIfNotExistsSafe } = require("../safety");
const { renderAuthTemplate } = require("../template/auth-templates");
const logger = require("../utils/logger");

/** Registry of available recipes - drives `rakitin list` & dispatch. */
const RECIPES = {
  auth: {
    tier: "advanced",
    desc: "JWT auth lengkap: middleware + user module + joi validator",
    deps: ["jsonwebtoken", "joi", "bcryptjs"],
  },
  swagger: {
    tier: "advanced",
    desc: "OpenAPI 3 spec terhubung + swagger-ui endpoint",
    deps: ["swagger-ui-express", "swagger-jsdoc"],
  },
  test: {
    tier: "advanced",
    desc: "Jest + Supertest scaffold untuk semua modul existing",
    deps: ["jest", "supertest"],
  },
  docker: {
    tier: "advanced",
    desc: "Dockerfile multi-stage + compose + .dockerignore",
    deps: [],
  },
};

/** @param {keyof typeof RECIPES} recipeName @param {{arch?: string, orm?: string, pm?: string}} options */
async function recipeCommand(recipeName, options = {}) {
  switch (recipeName) {
    case "auth":
      return authRecipe(options);
    case "swagger":
      return swaggerRecipe(options);
    case "test":
      return testRecipe(options);
    case "docker":
      return dockerRecipe();
    default:
      throw new Error(
        `Recipe tidak dikenal: "${recipeName}". Pilihan: ${Object.keys(RECIPES).join(", ")}`
      );
  }
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

async function authRecipe(options = {}) {
  const createdFiles = [];

  // 1. JWT middleware
  const mwResult = await createMiddleware("auth");
  if (mwResult.created) createdFiles.push(...mwResult.createdFiles);

  // Resolve ORM: options.orm -> config -> default "Prisma"
  let orm = options.orm;
  if (!orm) {
    try {
      const { Config } = require("../config");
      const cfg = new Config().load(process.cwd());
      orm = cfg.get("orm") || cfg.get("defaultORM") || "prisma";
    } catch {
      orm = "prisma";
    }
  }

  const ormName =
    typeof orm === "string"
      ? orm.toLowerCase() === "none"
        ? "None"
        : orm.toLowerCase() === "typeorm"
          ? "TypeORM"
          : orm.charAt(0).toUpperCase() + orm.slice(1).toLowerCase()
      : "Prisma";

  // Resolve architecture: options.arch -> config -> default "modular"
  let arch = options.arch;
  if (!arch) {
    try {
      const { Config } = require("../config");
      const cfg = new Config().load(process.cwd());
      arch = cfg.get("arch") || cfg.get("defaultArchitecture") || "modular";
    } catch {
      arch = "modular";
    }
  }
  const isModular = arch !== "simple";

  // 2. User module directory layout
  const userModuleDir = path.join(process.cwd(), "app", "modules", "user");
  if (isModular) {
    fs.ensureDirSync(path.join(userModuleDir, "controllers"));
    fs.ensureDirSync(path.join(userModuleDir, "services"));
    fs.ensureDirSync(path.join(userModuleDir, "routes"));
    if (ormName === "Sequelize" || ormName === "Mongoose") {
      fs.ensureDirSync(path.join(userModuleDir, "models"));
    } else if (ormName === "TypeORM") {
      fs.ensureDirSync(path.join(userModuleDir, "entities"));
    }
  } else {
    fs.ensureDirSync(userModuleDir);
  }

  const controllerPath = isModular
    ? path.join(userModuleDir, "controllers", "user.controller.js")
    : path.join(userModuleDir, "user.controller.js");

  const servicePath = isModular
    ? path.join(userModuleDir, "services", "user.service.js")
    : path.join(userModuleDir, "user.service.js");

  const routerPath = isModular
    ? path.join(userModuleDir, "routes", "user.router.js")
    : path.join(userModuleDir, "user.router.js");

  // Controller
  const controllerContent = renderAuthTemplate(
    isModular ? "controller.modular.ejs" : "controller.simple.ejs"
  );
  const { written: wroteCtrl } = writeFileIfNotExistsSafe(controllerPath, controllerContent);
  if (wroteCtrl) createdFiles.push(path.relative(process.cwd(), controllerPath));

  // Service
  const serviceTemplate =
    {
      Prisma: "service.prisma.ejs",
      Sequelize: "service.sequelize.ejs",
      Mongoose: "service.mongoose.ejs",
      TypeORM: "service.typeorm.ejs",
      None: "service.none.ejs",
    }[ormName] || "service.prisma.ejs";

  const serviceData = {
    dbPath: isModular ? "../../../shared/config/db" : "../../shared/config/db",
    modelPath: isModular ? "../models/user.model" : "./user.model",
    dataSourcePath: isModular
      ? "../../../shared/config/data-source"
      : "../../shared/config/data-source",
    entityPath: isModular ? "../entities/user.entity" : "./user.entity",
  };

  const serviceContent = renderAuthTemplate(serviceTemplate, serviceData);
  const { written: wroteSvc } = writeFileIfNotExistsSafe(servicePath, serviceContent);
  if (wroteSvc) createdFiles.push(path.relative(process.cwd(), servicePath));

  // Router
  const routerContent = renderAuthTemplate(
    isModular ? "router.modular.ejs" : "router.simple.ejs"
  );
  const { written: wroteRouter } = writeFileIfNotExistsSafe(routerPath, routerContent);
  if (wroteRouter) createdFiles.push(path.relative(process.cwd(), routerPath));

  // 3. User model per ORM
  if (ormName === "Prisma") {
    const {
      checkAndInitPrisma,
      ensurePrismaBaseSchema,
      ensurePrismaDbConfig,
    } = require("../generator/module/orm/prisma.orm");
    await checkAndInitPrisma();
    ensurePrismaBaseSchema();
    ensurePrismaDbConfig();

    const { getPaths } = require("../constants");
    const schemaDir = getPaths(process.cwd()).prismaPath;
    fs.ensureDirSync(schemaDir);
    const modelPath = path.join(schemaDir, "user.prisma");
    const modelContent = renderAuthTemplate("model.prisma.ejs");
    const { written: wroteModel } = writeFileIfNotExistsSafe(modelPath, modelContent);
    if (wroteModel) createdFiles.push(path.relative(process.cwd(), modelPath));
  } else if (ormName === "Sequelize") {
    const dbConfigPath = path.join(process.cwd(), "app", "shared", "config", "database.js");
    if (!fs.existsSync(dbConfigPath)) {
      fs.ensureDirSync(path.dirname(dbConfigPath));
      writeFileIfNotExistsSafe(
        dbConfigPath,
        `// Sequelize Database Connection
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "test_db",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
    logging: false,
  }
);

module.exports = sequelize;
`
      );
    }
    const modelPath = isModular
      ? path.join(userModuleDir, "models", "user.model.js")
      : path.join(userModuleDir, "user.model.js");
    const modelContent = renderAuthTemplate("model.sequelize.ejs", {
      dbPath: isModular ? "../../../shared/config/database" : "../../shared/config/database",
    });
    const { written: wroteModel } = writeFileIfNotExistsSafe(modelPath, modelContent);
    if (wroteModel) createdFiles.push(path.relative(process.cwd(), modelPath));
  } else if (ormName === "Mongoose") {
    const modelPath = isModular
      ? path.join(userModuleDir, "models", "user.model.js")
      : path.join(userModuleDir, "user.model.js");
    const modelContent = renderAuthTemplate("model.mongoose.ejs");
    const { written: wroteModel } = writeFileIfNotExistsSafe(modelPath, modelContent);
    if (wroteModel) createdFiles.push(path.relative(process.cwd(), modelPath));
  } else if (ormName === "TypeORM") {
    const dataSourcePath = path.join(
      process.cwd(),
      "app",
      "shared",
      "config",
      "data-source.js"
    );
    if (!fs.existsSync(dataSourcePath)) {
      fs.ensureDirSync(path.dirname(dataSourcePath));
      writeFileIfNotExistsSafe(
        dataSourcePath,
        `// TypeORM Data Source
const { DataSource } = require("typeorm");

const AppDataSource = new DataSource({
  type: "mysql",
  host: "localhost",
  port: 3306,
  username: "root",
  password: "",
  database: "test_db",
  synchronize: true,
  logging: false,
  entities: ["app/modules/**/*.entity.js"],
  migrations: [],
  subscribers: [],
});

module.exports = { AppDataSource };
`
      );
    }
    const entityPath = isModular
      ? path.join(userModuleDir, "entities", "user.entity.js")
      : path.join(userModuleDir, "user.entity.js");
    const entityContent = renderAuthTemplate("model.typeorm.ejs");
    const { written: wroteModel } = writeFileIfNotExistsSafe(entityPath, entityContent);
    if (wroteModel) createdFiles.push(path.relative(process.cwd(), entityPath));
  }

  // 4. Registration/login/profile Joi validator
  const validatorsDir = path.join(process.cwd(), "app", "shared", "validators");
  const validatorPath = path.join(validatorsDir, "user.validator.js");
  const validatorContent = renderAuthTemplate("validator.ejs");
  const { written: wroteVal } = writeFileIfNotExistsSafe(validatorPath, validatorContent);
  if (wroteVal) createdFiles.push(path.relative(process.cwd(), validatorPath));

  // 5. Install dependencies
  const depsToInstall = ["recipe:auth"];
  if (ormName !== "None") {
    depsToInstall.push(ormToKind(ormName));
  }

  await ensureDependencies(depsToInstall, {
    silent: !process.stdout.isTTY,
    pm: options.pm,
  });

  const envLines = ["JWT_SECRET=change-me-please", "JWT_EXPIRES_IN=7d"];
  if (ormName === "Prisma") {
    envLines.unshift('DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"');
  }
  mergeEnvExample(envLines);

  const nextSteps = [
    "Hubungkan route user ke router utama: rakitin integrate",
    "Set JWT_SECRET di .env sebelum deploy",
  ];
  if (ormName !== "None") {
    nextSteps.unshift(
      "Periksa kredensial database di .env lalu jalankan migration/push sesuai ORM Anda"
    );
  } else {
    nextSteps.unshift("Ganti store in-memory di user.service dengan DB Anda");
  }

  return {
    createdFiles,
    nextSteps,
  };
}

// ---------------------------------------------------------------------------
// swagger
// ---------------------------------------------------------------------------

async function swaggerRecipe() {
  const createdFiles = [];
  const docsDir = path.join(process.cwd(), "app", "docs");
  fs.ensureDirSync(docsDir);

  // Real OpenAPI 3 skeleton pre-populated from detected modules
  const { detectProject } = require("../project/detector");
  const project = detectProject(process.cwd());
  const pathsObj = {};
  for (const mod of project.structure.modules.filter((m) => m.architecture)) {
    pathsObj[`/${mod.name}`] = SWAGGER_PATH_TEMPLATE(mod.name);
  }

  const openapiPath = path.join(docsDir, "openapi.json");
  const { written: wroteSpec } = writeFileIfNotExistsSafe(
    openapiPath,
    JSON.stringify({ ...OPENAPI_BASE, paths: pathsObj }, null, 2) + "\n"
  );
  if (wroteSpec) createdFiles.push(openapiPath);

  const setupPath = path.join(docsDir, "swagger.setup.js");
  const { written: wroteSetup } = writeFileIfNotExistsSafe(
    setupPath,
    `// Swagger UI wiring - generated by rakitin.
// Usage in app.js/server.js:
//   const { mountSwagger } = require('./app/docs/swagger.setup');
//   mountSwagger(app);
const swaggerUiExpress = require("swagger-ui-express");
const spec = require("./openapi.json");

function mountSwagger(app, basePath = "/api-docs") {
  app.use(basePath, swaggerUiExpress.serve, swaggerUiExpress.setup(spec));
}

module.exports = { mountSwagger };
`
  );
  if (wroteSetup) createdFiles.push(setupPath);

  const readmePath = path.join(docsDir, "README.md");
  writeFileIfNotExistsSafe(
    readmePath,
    `# API Docs

Spesifikasi OpenAPI berada di \`app/docs/openapi.json\` dan sudah mencakup
setiap modul rakitin yang terdeteksi saat generate.

\`\`\`js
// app.js / server.js
const { mountSwagger } = require("./app/docs/swagger.setup");
mountSwagger(app); // buka /api-docs
\`\`\`

Regenerasi kerangka: \`rakitin recipe swagger --overwrite\` (.bak dibuat otomatis).
`
  );

  await ensureDependencies(["docs:swagger-ui"], {
    silent: !process.stdout.isTTY,
  });
  mergeEnvExample(["API_BASE_URL=/api"]);

  return {
    createdFiles,
    nextSteps: [
      "require('./app/docs/swagger.setup').mountSwagger(app) di server Anda",
      "Install dep bila belum: npm i swagger-ui-express swagger-jsdoc",
    ],
  };
}

function SWAGGER_PATH_TEMPLATE(moduleName) {
  return {
    get: { summary: `List ${moduleName}`, responses: { 200: { description: "OK" } } },
    post: {
      summary: `Create ${moduleName}`,
      responses: { 201: { description: "Created" } },
    },
  };
}

const OPENAPI_BASE = {
  openapi: "3.0.0",
  info: {
    title: "Generated API",
    version: "1.0.0",
    description: "OpenAPI scaffolding by rakitin - extend freely.",
  },
};

// ---------------------------------------------------------------------------
// test scaffold
// ---------------------------------------------------------------------------

async function testRecipe(options) {
  const createdFiles = [];
  const testsRoot = path.join(process.cwd(), "tests", "modules");
  fs.ensureDirSync(testsRoot);

  const setupPath = path.join(testsRoot, "..", "setup.js");
  const { written: wroteSetup } = writeFileIfNotExistsSafe(setupPath, TEST_SETUP_JS);
  if (wroteSetup) createdFiles.push(setupPath);

  // One test file per EXISTING module
  const { detectProject } = require("../project/detector");
  const project = detectProject(process.cwd());
  for (const mod of project.structure.modules.filter((m) => m.architecture)) {
    const testFile = path.join(testsRoot, `${mod.name}.test.js`);
    const { written } = writeFileIfNotExistsSafe(testFile, MODULE_TEST_TEMPLATE(mod));
    if (written) createdFiles.push(testFile);
  }

  applyTestScripts();

  try {
    await installDevPackages(["jest@^29", "supertest"], options.pm);
  } catch (error) {
    logger.warn(`Instalasi dev dependencies dilewati: ${error.message}`);
  }

  return {
    createdFiles,
    nextSteps: [
      "npx jest --watch untuk development",
      "Sesuaikan test/setup.js dengan cara export express app Anda",
    ],
  };
}

const TEST_SETUP_JS = `// Test bootstrap - generated by rakitin.
let app;

try {
  // Recommended: export the bare express instance from app/app.js
  app = require("../../app/app.js");
} catch (_) {
  console.warn("[rakitin] app/app.js not found - HTTP assertions will skip.");
}

global.getApp = () => app;
`;

function MODULE_TEST_TEMPLATE(mod) {
  const base = `/api/${mod.name}`;
  return `// Generated by rakitin - extend freely.
describe("${mod.name}", () => {
  const app = global.getApp ? global.getApp() : null;
  const skipHttp = process.env.SKIP_HTTP_TESTS || !app;

  it("module directory exists on disk", () => {
    expect(require("fs").existsSync("app/modules/${mod.name}")).toBe(true);
  });

  (skipHttp ? describe.skip : describe)("http endpoints", () => {
    it("GET ${base} responds", async () => {
      const request = require("supertest");
      const res = await request(app).get("${base}");
      expect([200, 201, 404]).toContain(res.status);
    });
  });
});
`;
}

function applyTestScripts() {
  const pkgPath = path.join(process.cwd(), "package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts.test) {
      pkg.scripts.test = "jest";
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
      logger.success("npm script 'test' ditambahkan ke package.json");
    }
  } catch {
    logger.warn("package.json tidak dapat dibaca - script test tidak ditambahkan");
  }
}

async function installDevPackages(pkgs, pm) {
  const missing = pkgs.filter((nameAndRange) => {
    const name = nameAndRange.split("@")[0];
    return !fs.existsSync(path.join(process.cwd(), "node_modules", name));
  });
  if (!missing.length) return;

  const installer = require("../installer");
  const pmCfg = installer.PACKAGE_MANAGERS[pm || installer.getPackageManager()];
  const { execSync } = require("child_process");
  execSync(pmCfg.install(missing, { saveDev: true }), {
    stdio: "ignore",
    shell: true,
  });
  logger.success(`Dev dependencies terpasang: ${missing.join(", ")}`);
}

// ---------------------------------------------------------------------------
// docker
// ---------------------------------------------------------------------------

async function dockerRecipe() {
  const createdFiles = [];
  const root = process.cwd();

  const files = {
    Dockerfile: DOCKERFILE,
    "docker-compose.yml": COMPOSE_YML,
    ".dockerignore": ".git\nnode_modules\ncoverage\n*.log\n.env\n",
  };

  for (const [name, content] of Object.entries(files)) {
    const filePath = path.join(root, name);
    const { written } = writeFileIfNotExistsSafe(filePath, content);
    if (written) createdFiles.push(filePath);
  }

  mergeEnvExample(["NODE_ENV=production"]);

  return {
    createdFiles,
    nextSteps: [
      "docker build -t my-api .",
      "docker compose up -d",
      "Pin versi node sesuai engines proyek Anda bila berbeda",
    ],
  };
}

const DOCKERFILE = `# Multi-stage Node build - generated by rakitin
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "app/server.js"]
`;

const COMPOSE_YML = `# docker-compose - generated by rakitin
services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped
`;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Append key=value lines to .env.example without clobbering user edits. */
function mergeEnvExample(lines) {
  const envPath = path.join(process.cwd(), ".env.example");
  const marker = "# RAKITIN RECIPE ENV";

  let existing = "";
  if (fs.existsSync(envPath)) {
    existing = fs.readFileSync(envPath, "utf8");
  }
  const missing = lines.filter((l) => !existing.includes(l.split("=")[0]));
  if (!missing.length) return;

  const block = `\n${marker}\n${missing.join("\n")}\n`;
  if (existing) {
    fs.appendFileSync(envPath, block);
  } else {
    fs.writeFileSync(envPath, block.trimStart());
  }
}

module.exports = { recipeCommand, RECIPES };
