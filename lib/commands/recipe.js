/**
 * lib/commands/recipe.js - `rakitin recipe <auth|swagger|test|docker>`
 *
 * A recipe composes multiple primitives into one opinionated, production-shaped
 * result while routing every write through the safety layer:
 *   - `--dry-run` collects a plan and never touches disk nor spawns installs,
 *   - `--no-install` skips dependency installs entirely,
 *   - existing user files are never clobbered (write-if-absent + `.bak`),
 *   - dependency needs live in `lib/deps/manifest.js`, never here.
 */

const fs = require("fs");
const path = require("path");
const { createMiddleware } = require("../generator/middleware/middleware");
const { ensureDependencies, ormToKind } = require("../deps/manifest");
const {
  writeFileIfNotExistsSafe,
  updateJsonFile,
  mergeEnvExample,
  getPlan,
} = require("../safety");
const { renderAuthTemplate } = require("../template/auth-templates");
const { relativePosix } = require("../utils");
const { runWithPluginInstall } = require("./shared");

/** Registry of available recipes - drives `rakitin list` & dispatch. */
const RECIPES = {
  auth: {
    tier: "advanced",
    desc: "JWT auth lengkap: middleware + modul user + validator joi",
  },
  swagger: {
    tier: "advanced",
    desc: "Konfigurasi swagger-jsdoc + endpoint swagger-ui",
  },
  test: {
    tier: "advanced",
    desc: "Jest + Supertest untuk seluruh modul existing",
  },
  docker: {
    tier: "advanced",
    desc: "Dockerfile multi-stage + .dockerignore",
  },
};

/** Candidate application entrypoints, in priority order (POSIX, root-relative). */
const ENTRYPOINT_CANDIDATES = ["app/server.js", "bin/www", "index.js", "app.js"];

/**
 * Resolve the application entrypoint a container must boot.
 * @param {string} [root]
 * @returns {string} root-relative POSIX path of the first existing candidate.
 */
function resolveEntrypoint(root = process.cwd()) {
  for (const candidate of ENTRYPOINT_CANDIDATES) {
    if (fs.existsSync(path.join(root, candidate))) return candidate;
  }
  throw new Error(
    `Tidak menemukan entrypoint aplikasi (${ENTRYPOINT_CANDIDATES.join(", ")}).`
  );
}

/**
 * @param {string} name Recipe name: `auth` | `swagger` | `test` | `docker`.
 * @param {object} [context] Result of `buildContext()`.
 * @returns {Promise<object>} result envelope
 */
async function recipeCommand(name, context = {}) {
  const recipe = String(name || "").toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(RECIPES, recipe)) {
    throw new Error(
      `Recipe tidak dikenal: "${name}". Pilihan: ${Object.keys(RECIPES).join(", ")}.`
    );
  }

  const root = context.root || process.cwd();
  switch (recipe) {
    case "auth":
      return authRecipe(root, context);
    case "swagger":
      return swaggerRecipe(root, context);
    case "test":
      return testRecipe(root, context);
    case "docker":
      return dockerRecipe(root, context);
    default:
      throw new Error(`Recipe tidak dikenal: "${name}".`);
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Collect root-relative POSIX paths into `created` / `skipped` buckets.
 * A non-null `skipped` verdict (exists / marker-exists / unchanged) means the
 * file was left untouched.
 */
function makeBucket(root) {
  const created = [];
  const skipped = [];
  return {
    created,
    skipped,
    record(result, absPath) {
      const target = absPath || (result && result.path);
      const relative = target ? relativePosix(root, target) : null;
      const bucket = result && result.skipped ? skipped : created;
      if (relative && !bucket.includes(relative)) bucket.push(relative);
      return result;
    },
    merge(subResult) {
      if (!subResult) return subResult;
      for (const entry of subResult.created || []) {
        if (entry && !created.includes(entry)) created.push(entry);
      }
      for (const entry of subResult.skipped || []) {
        if (entry && !skipped.includes(entry)) skipped.push(entry);
      }
      return subResult;
    },
  };
}

function envelope(bucket, context, { nextSteps = [], message, data } = {}) {
  return {
    ok: true,
    created: bucket.created,
    skipped: bucket.skipped,
    plan: context.dryRun ? getPlan() : undefined,
    message,
    nextSteps,
    data,
  };
}

/** Install the given kinds once, honoring `--no-install` / `--dry-run` / `--pm`. */
async function installKinds(kinds, root, context, { dev = false } = {}) {
  return ensureDependencies(kinds, {
    pm: context.pm || undefined,
    install: context.install !== false,
    dev,
    silent: true,
    root,
  });
}

/** Surface install failures without aborting the recipe. */
function installNote(result, nextSteps) {
  if (result && result.failed && result.failed.length) {
    nextSteps.push(
      `Instalasi gagal untuk: ${result.failed.join(", ")}. Jalankan instalasi manual lalu ulangi.`
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

const ORM_DISPLAY = {
  prisma: "Prisma",
  sequelize: "Sequelize",
  mongoose: "Mongoose",
  typeorm: "TypeORM",
  none: "None",
};

function resolveOrmName(context) {
  const raw = String(context.orm || "prisma").toLowerCase();
  const ormName = ORM_DISPLAY[raw];
  if (!ormName) {
    throw new Error(
      `ORM tidak dikenal: "${context.orm}". Pilihan: ${Object.keys(ORM_DISPLAY).join(", ")}.`
    );
  }
  return ormName;
}

/**
 * Paths + relative import specifiers of the generated `user` auth module.
 * @param {string} root
 * @param {boolean} isModular
 */
function authModulePaths(root, isModular) {
  const moduleDir = path.join(root, "app", "modules", "user");
  if (isModular) {
    return {
      controller: path.join(moduleDir, "controllers", "user.controller.js"),
      service: path.join(moduleDir, "services", "user.service.js"),
      router: path.join(moduleDir, "routes", "user.router.js"),
      model: path.join(moduleDir, "models", "user.model.js"),
      entity: path.join(moduleDir, "entities", "user.entity.js"),
      templateData: {
        dbPath: "../../../shared/config/db",
        modelPath: "../models/user.model",
        dataSourcePath: "../../../shared/config/data-source",
        entityPath: "../entities/user.entity",
      },
      sequelizeDbPath: "../../../shared/config/database",
    };
  }

  return {
    controller: path.join(moduleDir, "user.controller.js"),
    service: path.join(moduleDir, "user.service.js"),
    router: path.join(moduleDir, "user.router.js"),
    model: path.join(moduleDir, "user.model.js"),
    entity: path.join(moduleDir, "user.entity.js"),
    templateData: {
      dbPath: "../../shared/config/db",
      modelPath: "./user.model",
      dataSourcePath: "../../shared/config/data-source",
      entityPath: "./user.entity",
    },
    sequelizeDbPath: "../../shared/config/database",
  };
}

/**
 * Write the auth user model plus the ORM-owned singletons/env sections.
 *
 * The model content comes from `lib/templates/auth/model.*.ejs` (auth-shaped
 * fields: email/password/role) while the connection singleton, prisma base
 * schema and `.env.example` sections are delegated to the ORM generators so
 * every module shares one connection setup.
 */
function ensureOrmModel(root, ormName, paths, bucket) {
  switch (ormName) {
    case "Prisma": {
      const prisma = require("../generator/module/orm/prisma.orm");
      const { getPaths } = require("../constants");
      const modelPath = path.join(getPaths(root).prismaPath, "user.prisma");
      bucket.record(
        writeFileIfNotExistsSafe(modelPath, renderAuthTemplate("model.prisma.ejs")),
        modelPath
      );
      for (const result of [
        prisma.ensurePrismaBaseSchema(root),
        prisma.ensurePrismaConfigFile(root),
        prisma.ensurePrismaDbConfig(root),
        prisma.ensureEnvDatabaseUrl(root),
      ]) {
        bucket.record(result);
      }
      return;
    }
    case "Sequelize": {
      const { ensureSequelizeDatabaseFile } = require("../generator/module/orm/sequelize.orm");
      bucket.record(
        writeFileIfNotExistsSafe(
          paths.model,
          renderAuthTemplate("model.sequelize.ejs", { dbPath: paths.sequelizeDbPath })
        ),
        paths.model
      );
      bucket.record(ensureSequelizeDatabaseFile(root));
      return;
    }
    case "Mongoose": {
      const {
        ensureMongooseDbConfig,
        ensureMongoEnv,
      } = require("../generator/module/orm/mongoose.orm");
      bucket.record(
        writeFileIfNotExistsSafe(paths.model, renderAuthTemplate("model.mongoose.ejs")),
        paths.model
      );
      bucket.record(ensureMongooseDbConfig(root));
      bucket.record(ensureMongoEnv(root));
      return;
    }
    case "TypeORM": {
      const {
        ensureDataSourceFile,
        ensureTypeormEnv,
      } = require("../generator/module/orm/typeorm.orm");
      bucket.record(
        writeFileIfNotExistsSafe(paths.entity, renderAuthTemplate("model.typeorm.ejs")),
        paths.entity
      );
      bucket.record(ensureDataSourceFile(root));
      bucket.record(ensureTypeormEnv(root));
      return;
    }
    default:
      // "None": the in-memory service is self-contained.
      return;
  }
}

async function authRecipe(root, context) {
  const bucket = makeBucket(root);
  const isModular = String(context.arch || "modular").toLowerCase() !== "simple";
  const ormName = resolveOrmName(context);
  const paths = authModulePaths(root, isModular);

  // 1. JWT middleware (shared).
  bucket.merge(await createMiddleware("auth", null, { root }));

  // 2. User module: controller / service / router.
  const controllerPath = paths.controller;
  bucket.record(
    writeFileIfNotExistsSafe(
      controllerPath,
      renderAuthTemplate(isModular ? "controller.modular.ejs" : "controller.simple.ejs")
    ),
    controllerPath
  );

  const serviceTemplate = {
    Prisma: "service.prisma.ejs",
    Sequelize: "service.sequelize.ejs",
    Mongoose: "service.mongoose.ejs",
    TypeORM: "service.typeorm.ejs",
    None: "service.none.ejs",
  }[ormName];
  bucket.record(
    writeFileIfNotExistsSafe(
      paths.service,
      renderAuthTemplate(serviceTemplate, paths.templateData)
    ),
    paths.service
  );

  bucket.record(
    writeFileIfNotExistsSafe(
      paths.router,
      renderAuthTemplate(isModular ? "router.modular.ejs" : "router.simple.ejs")
    ),
    paths.router
  );

  // 3. Joi validator (register/login/profile/change-password).
  const validatorPath = path.join(root, "app", "shared", "validators", "user.validator.js");
  bucket.record(
    writeFileIfNotExistsSafe(validatorPath, renderAuthTemplate("validator.ejs")),
    validatorPath
  );

  // 4. Model + ORM singletons.
  ensureOrmModel(root, ormName, paths, bucket);

  // 5. Env keys + dependencies.
  bucket.record(
    mergeEnvExample(root, "AUTH RECIPE", "JWT_SECRET=change-me-please\nJWT_EXPIRES_IN=7d")
  );

  const installResult = await runWithPluginInstall(context, () =>
    installKinds(["recipe:auth", ormToKind(ormName)], root, context)
  );

  const nextSteps = [
    "Hubungkan modul user ke router utama: rakitin integrate",
    "Set JWT_SECRET di .env sebelum deploy",
  ];
  if (ormName === "None") {
    nextSteps.push("Ganti store in-memory di user.service.js dengan database Anda");
  } else {
    nextSteps.push(
      `Jalankan migration/push sesuai ${ormName} sebelum menjalankan server`
    );
  }
  installNote(installResult, nextSteps);

  return envelope(bucket, context, {
    nextSteps,
    message: `Recipe auth selesai (ORM: ${ormName}, arsitektur: ${isModular ? "modular" : "simple"}).`,
    data: { orm: ormName, arch: isModular ? "modular" : "simple" },
  });
}

// ---------------------------------------------------------------------------
// swagger
// ---------------------------------------------------------------------------

const SWAGGER_CONFIG_JS = `// Swagger / OpenAPI config - generated by rakitin (recipe swagger).
const path = require("path");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const spec = swaggerJSDoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Express API",
      version: "1.0.0",
      description: "OpenAPI spec collected from JSDoc annotations - extend freely.",
    },
    servers: [{ url: process.env.API_BASE_URL || "/api" }],
  },
  apis: [path.join(__dirname, "..", "..", "modules", "**", "*.js")],
});

function mountSwagger(app, basePath = "/api-docs") {
  app.use(basePath, swaggerUi.serve, swaggerUi.setup(spec));
  return app;
}

module.exports = { spec, mountSwagger };
`;

const SWAGGER_DOCS_ENTRY_JS = `// Mount-ready API docs entry - generated by rakitin (recipe swagger).
// Usage: const { mountSwagger } = require("./app/docs"); mountSwagger(app);
const { mountSwagger, spec } = require("../shared/config/swagger.config");

module.exports = { mountSwagger, spec };
`;

async function swaggerRecipe(root, context) {
  const bucket = makeBucket(root);

  const configPath = path.join(root, "app", "shared", "config", "swagger.config.js");
  bucket.record(writeFileIfNotExistsSafe(configPath, SWAGGER_CONFIG_JS), configPath);

  const entryPath = path.join(root, "app", "docs", "index.js");
  bucket.record(writeFileIfNotExistsSafe(entryPath, SWAGGER_DOCS_ENTRY_JS), entryPath);

  bucket.record(mergeEnvExample(root, "API DOCS", "API_BASE_URL=/api"));

  const installResult = await runWithPluginInstall(context, () =>
    installKinds(["docs:swagger-ui"], root, context)
  );

  const nextSteps = [
    'Pasang di server Anda: require("./app/docs").mountSwagger(app) lalu buka /api-docs',
    "Tambahkan anotasi @openapi pada route modul agar masuk ke spec",
  ];
  installNote(installResult, nextSteps);

  return envelope(bucket, context, {
    nextSteps,
    message: "Recipe swagger selesai.",
    data: { mountPath: "/api-docs", entry: relativePosix(root, entryPath) },
  });
}

// ---------------------------------------------------------------------------
// test scaffold
// ---------------------------------------------------------------------------

const TEST_SCRIPTS = { test: "jest", "test:watch": "jest --watch" };

async function testRecipe(root, context) {
  const bucket = makeBucket(root);

  // Infra (jest.config.js, tests/setup.js) + per-module specs are owned by the
  // test-file generator so `recipe test` and `add test --all` cannot drift.
  const testfile = require("../generator/api/testfile");
  if (typeof testfile.ensureTestInfra === "function") {
    bucket.merge(await testfile.ensureTestInfra(root));
  }
  bucket.merge(await testfile.generateTestFiles({ all: true, root }));

  const packagePath = path.join(root, "package.json");
  const added = [];
  const scriptsResult = updateJsonFile(
    packagePath,
    (pkg) => {
      const scripts = { ...(pkg.scripts || {}) };
      for (const [name, command] of Object.entries(TEST_SCRIPTS)) {
        if (!scripts[name]) {
          scripts[name] = command;
          added.push(name);
        }
      }
      if (!added.length) return false;
      return { ...pkg, scripts };
    },
    { dryRun: context.dryRun }
  );

  const installResult = await runWithPluginInstall(context, () =>
    installKinds(["test:dev"], root, context, { dev: true })
  );

  const nextSteps = ["Jalankan: npx jest", "Sesuaikan tests/setup.js dengan cara export app Anda"];
  if (scriptsResult.skipped === "unchanged") {
    nextSteps.push("Script npm test sudah ada - tidak diubah");
  }
  installNote(installResult, nextSteps);

  return envelope(bucket, context, {
    nextSteps,
    message: added.length
      ? `Recipe test selesai - script ditambahkan: ${added.join(", ")}.`
      : "Recipe test selesai.",
    data: { scriptsAdded: added, scriptsWritten: scriptsResult.written },
  });
}

// ---------------------------------------------------------------------------
// docker
// ---------------------------------------------------------------------------

const DOCKERIGNORE = `# Generated by rakitin (recipe docker)
.git
.gitignore
node_modules
coverage
*.log
.env
.env.*
!.env.example
Dockerfile
.dockerignore
`;

function renderDockerfile(entrypoint) {
  return `# Multi-stage Node build - generated by rakitin (recipe docker)
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "${entrypoint}"]
`;
}

async function dockerRecipe(root, context) {
  const bucket = makeBucket(root);
  const entrypoint = resolveEntrypoint(root);

  const dockerfilePath = path.join(root, "Dockerfile");
  bucket.record(
    writeFileIfNotExistsSafe(dockerfilePath, renderDockerfile(entrypoint)),
    dockerfilePath
  );

  const ignorePath = path.join(root, ".dockerignore");
  bucket.record(writeFileIfNotExistsSafe(ignorePath, DOCKERIGNORE), ignorePath);

  return envelope(bucket, context, {
    nextSteps: [
      "docker build -t my-api .",
      "docker run -p 3000:3000 my-api",
      `Pastikan ${entrypoint} membaca process.env.PORT`,
    ],
    message: `Recipe docker selesai (entrypoint: ${entrypoint}).`,
    data: { entrypoint },
  });
}

module.exports = { recipeCommand, RECIPES, resolveEntrypoint };
