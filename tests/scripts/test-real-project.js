#!/usr/bin/env node

/**
 * test-real-project.js - Automated Real Project E2E Test Suite for rakitin
 *
 * Runs full real-project tests against /home/reinvy/Workspace/rakitin/tests/project
 * following the 6 Golden Rules defined in docs/real-project-testing-rules.md.
 */

const { execSync, spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = path.resolve(__dirname, "../..");
const TEST_PROJECT_DIR = path.resolve(REPO_ROOT, "tests/project");

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

let passedCount = 0;
let failedCount = 0;
const failures = [];

function logHeader(title) {
  console.log(`\n${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan} ${title}${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}══════════════════════════════════════════════════════════════${colors.reset}\n`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/** Clean slate helper - strictly wipes tests/project and creates clean package.json */
function cleanProject() {
  fs.ensureDirSync(TEST_PROJECT_DIR);
  const items = fs.readdirSync(TEST_PROJECT_DIR);
  for (const item of items) {
    fs.removeSync(path.join(TEST_PROJECT_DIR, item));
  }
  const cleanPackageJson = {
    name: "test-real-project",
    version: "1.0.0",
    description: "Clean test project for rakitin",
    main: "index.js",
    type: "commonjs",
    dependencies: {
      express: "^4.19.0",
    },
  };
  fs.writeFileSync(
    path.join(TEST_PROJECT_DIR, "package.json"),
    JSON.stringify(cleanPackageJson, null, 2) + "\n",
    "utf8"
  );
}

/** Execute command in tests/project directory */
function runCLI(args, input = null) {
  const binary = path.resolve(REPO_ROOT, "bin/rakitin.js");
  const nodeBin = process.execPath;
  const fullArgs = [binary, ...args];

  const res = spawnSync(nodeBin, fullArgs, {
    cwd: TEST_PROJECT_DIR,
    input: input != null ? input : undefined,
    encoding: "utf8",
    env: {
      ...process.env,
      RAKITIN_SILENT: "1",
      NODE_PATH: path.join(REPO_ROOT, "node_modules"),
    },
  });

  return {
    status: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
    error: res.error,
  };
}

/** Validate syntax of all .js files in a directory */
function validateSyntaxInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== "node_modules") validateSyntaxInDir(fullPath);
    } else if (item.endsWith(".js")) {
      const src = fs.readFileSync(fullPath, "utf8");
      try {
        new vm.Script(src);
      } catch (err) {
        throw new Error(`Syntax validation failed on ${fullPath}: ${err.message}`, { cause: err });
      }
    }
  }
}

function runScenario(id, name, fn) {
  process.stdout.write(`  [${id}] ${name} ... `);
  try {
    cleanProject();
    fn();
    passedCount++;
    console.log(`${colors.green}✓ PASSED${colors.reset}`);
  } catch (err) {
    failedCount++;
    failures.push({ id, name, error: err.message });
    console.log(`${colors.red}✗ FAILED: ${err.message}${colors.reset}`);
  }
}

// -----------------------------------------------------------------------------
// MAIN EXECUTION
// -----------------------------------------------------------------------------

async function main() {
  logHeader("RAKITIN REAL PROJECT E2E TEST SUITE");

  console.log(`${colors.bold}Langkah 1: Memperbarui global symlink binary (npm unlink -g && npm link)...${colors.reset}`);
  try {
    execSync("npm unlink -g rakitin 2>/dev/null || true", { cwd: REPO_ROOT, stdio: "pipe" });
    execSync("npm link", { cwd: REPO_ROOT, stdio: "pipe" });
    const rakitinVersion = execSync("rakitin --version", { encoding: "utf8" }).trim();
    console.log(`${colors.green}✓ Binary rakitin global aktif (versi: ${rakitinVersion})${colors.reset}\n`);
  } catch (err) {
    console.error(`${colors.red}Gagal memperbarui link rakitin global: ${err.message}${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.bold}Langkah 2: Menjalankan skenario pengujian pada ${TEST_PROJECT_DIR}${colors.reset}\n`);

  // E2E-01: Global link verification
  runScenario("E2E-01", "Verifikasi global binary & CLI list", () => {
    const res = runCLI(["list", "--json"]);
    assert(res.status === 0, `Exit code ${res.status}: ${res.stderr}`);
    const data = JSON.parse(res.stdout);
    assert(Array.isArray(data.catalog), "Catalog harus berupa array");
    assert(data.catalog.length >= 8, "Catalog harus memiliki generator yang terdaftar");
  });

  // E2E-02: rakitin init (basic preset)
  runScenario("E2E-02", "rakitin init --preset basic", () => {
    const res = runCLI(["init", "--preset", "basic", "--json"]);
    assert(res.status === 0, `Exit code ${res.status}: ${res.stderr}`);
    const rcPath = path.join(TEST_PROJECT_DIR, ".rakitinrc.json");
    assert(fs.existsSync(rcPath), ".rakitinrc.json harus dibuat");
    const rc = fs.readJsonSync(rcPath);
    assert(rc.preset === "basic", `Preset harus 'basic', didapat: ${rc.preset}`);
  });

  // E2E-03: rakitin init idempotency & overwrite
  runScenario("E2E-03", "rakitin init overwrite/force", () => {
    runCLI(["init", "--preset", "basic"]);
    const res = runCLI(["init", "--preset", "advanced", "--overwrite", "--json"]);
    assert(res.status === 0, `Exit code ${res.status}: ${res.stderr}`);
    const rc = fs.readJsonSync(path.join(TEST_PROJECT_DIR, ".rakitinrc.json"));
    assert(rc.preset === "advanced", `Preset harus terupdate menjadi 'advanced', didapat: ${rc.preset}`);
  });

  // E2E-04: rakitin add module (Modular, No ORM)
  runScenario("E2E-04", "rakitin add module user --arch modular --orm none --yes", () => {
    const res = runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes", "--json"]);
    assert(res.status === 0, `Exit code ${res.status}: ${res.stderr}`);
    const modDir = path.join(TEST_PROJECT_DIR, "app/modules/user");
    assert(fs.existsSync(path.join(modDir, "controllers/user.controller.js")), "user.controller.js harus ada");
    assert(fs.existsSync(path.join(modDir, "services/user.service.js")), "user.service.js harus ada");
    assert(fs.existsSync(path.join(modDir, "routes/user.router.js")), "user.router.js harus ada");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-05: rakitin add module (Simple, No ORM)
  runScenario("E2E-05", "rakitin add module product --arch simple --orm none --yes", () => {
    const res = runCLI(["add", "module", "product", "--arch", "simple", "--orm", "none", "--yes", "--json"]);
    assert(res.status === 0, `Exit code ${res.status}: ${res.stderr}`);
    const modDir = path.join(TEST_PROJECT_DIR, "app/modules/product");
    assert(fs.existsSync(path.join(modDir, "product.controller.js")), "product.controller.js harus ada");
    assert(fs.existsSync(path.join(modDir, "product.service.js")), "product.service.js harus ada");
    assert(fs.existsSync(path.join(modDir, "product.router.js")), "product.router.js harus ada");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-06: rakitin add module with ORMs (Mongoose, Prisma, Sequelize, TypeORM)
  runScenario("E2E-06", "rakitin add module with ORMs (no-install)", () => {
    // Mongoose
    let res = runCLI(["add", "module", "article", "--arch", "modular", "--orm", "mongoose", "--no-install", "--yes", "--json"]);
    assert(res.status === 0, `Mongoose module error: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/article/models/article.model.js")), "article.model.js harus ada");

    // Sequelize
    res = runCLI(["add", "module", "order", "--arch", "modular", "--orm", "sequelize", "--no-install", "--yes", "--json"]);
    assert(res.status === 0, `Sequelize module error: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/order/models/order.model.js")), "order.model.js harus ada");

    // TypeORM
    res = runCLI(["add", "module", "payment", "--arch", "modular", "--orm", "typeorm", "--no-install", "--yes", "--json"]);
    assert(res.status === 0, `TypeORM module error: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/payment/entities/payment.entity.js")), "payment.entity.js harus ada");

    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-07: rakitin add middleware (auth, logger, error, request-time, custom)
  runScenario("E2E-07", "rakitin add middleware (all standard kinds & custom)", () => {
    const kinds = ["auth", "logger", "error", "request-time"];
    for (const k of kinds) {
      const res = runCLI(["add", "middleware", k, "--no-install", "--json"]);
      assert(res.status === 0, `Middleware ${k} failed: ${res.stderr}`);
      assert(
        fs.existsSync(path.join(TEST_PROJECT_DIR, `app/shared/middlewares/${k}.middleware.js`)),
        `${k}.middleware.js harus ada`
      );
    }
    const customRes = runCLI(["add", "middleware", "custom", "--yes", "--json"]);
    assert(customRes.status === 0, `Custom middleware failed: ${customRes.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/middlewares/custom.middleware.js")), "custom.middleware.js harus ada");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-08: rakitin add config (app, jwt, database, cors, redis)
  runScenario("E2E-08", "rakitin add config (multiple kinds & .env.example merge)", () => {
    const kinds = ["app", "jwt", "database", "cors", "redis"];
    for (const k of kinds) {
      const res = runCLI(["add", "config", k, "--json"]);
      assert(res.status === 0, `Config ${k} failed: ${res.stderr}`);
      assert(fs.existsSync(path.join(TEST_PROJECT_DIR, `app/shared/config/${k}.config.js`)), `${k}.config.js harus ada`);
    }
    const envExample = fs.readFileSync(path.join(TEST_PROJECT_DIR, ".env.example"), "utf8");
    assert(envExample.includes("PORT="), ".env.example harus memiliki PORT");
    assert(envExample.includes("JWT_SECRET="), ".env.example harus memiliki JWT_SECRET");
    assert(envExample.includes("REDIS_HOST="), ".env.example harus memiliki REDIS_HOST");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-09: rakitin add util
  runScenario("E2E-09", "rakitin add util uuid", () => {
    const res = runCLI(["add", "util", "uuid"]);
    assert(res.status === 0, `Util uuid failed: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/utils/uuid.util.js")), "uuid.util.js harus ada");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-10: rakitin add endpoint
  runScenario("E2E-10", "rakitin add endpoint on user module", () => {
    // Generate user module first
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    const res = runCLI(["add", "endpoint", "user", "--resource", "profile"]);
    assert(res.status === 0, `Endpoint failed: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/user/routes/profile.router.js")), "profile.router.js harus ada");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-11: rakitin add validation
  runScenario("E2E-11", "rakitin add validation common", () => {
    const res = runCLI(["add", "validation", "common"]);
    assert(res.status === 0, `Validation failed: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/validators/common.validator.js")), "common.validator.js harus ada");
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/validators/email.validator.js")), "email.validator.js harus ada");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-12: rakitin add docs
  runScenario("E2E-12", "rakitin add docs openapi-json", () => {
    const res = runCLI(["add", "docs", "openapi-json"]);
    assert(res.status === 0, `Docs failed: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/docs/openapi.json")), "openapi.json harus ada");
  });

  // E2E-13: rakitin integrate (marker wiring & middleware)
  runScenario("E2E-13", "rakitin integrate with modules & middlewares", () => {
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    runCLI(["add", "module", "product", "--arch", "simple", "--orm", "none", "--yes"]);
    runCLI(["add", "middleware", "auth", "--no-install", "--json"]);
    runCLI(["add", "middleware", "logger", "--json"]);

    const res = runCLI(["integrate", "--middleware", "auth,logger", "--json"]);
    assert(res.status === 0, `Integrate failed: ${res.stderr}`);
    const routerPath = path.join(TEST_PROJECT_DIR, "app/routes/index.js");
    assert(fs.existsSync(routerPath), "app/routes/index.js harus ada");
    const routerContent = fs.readFileSync(routerPath, "utf8");
    assert(routerContent.includes("rakitin:routes:start"), "Marker start harus ada");
    assert(routerContent.includes("rakitin:routes:end"), "Marker end harus ada");
    assert(routerContent.includes("/user"), "Route /user harus terpasang");
    assert(routerContent.includes("/product"), "Route /product harus terpasang");
    assert(routerContent.includes("authMiddleware"), "Auth middleware harus terpasang");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-14: rakitin integrate idempotency & .bak backup
  runScenario("E2E-14", "rakitin integrate idempotency & .bak creation", () => {
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    runCLI(["integrate"]);
    const res = runCLI(["integrate", "--json"]);
    assert(res.status === 0, `Integrate rerun failed: ${res.stderr}`);
    const bakPath = path.join(TEST_PROJECT_DIR, "app/routes/index.js.bak");
    assert(fs.existsSync(bakPath), "Backup file index.js.bak harus dibuat pada integrasi ulang");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-15: rakitin recipe auth
  runScenario("E2E-15", "rakitin recipe auth", () => {
    const res = runCLI(["recipe", "auth", "--arch", "modular", "--json"]);
    assert(res.status === 0, `Recipe auth failed: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/middlewares/auth.middleware.js")), "auth.middleware.js harus ada");
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/user/routes/user.router.js")), "user module harus ada");
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/validators/user.validator.js")), "user.validator.js harus ada");
    const envExample = fs.readFileSync(path.join(TEST_PROJECT_DIR, ".env.example"), "utf8");
    assert(envExample.includes("JWT_SECRET="), "JWT_SECRET harus ada di .env.example");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-16: rakitin recipe swagger
  runScenario("E2E-16", "rakitin recipe swagger", () => {
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    const res = runCLI(["recipe", "swagger", "--json"]);
    assert(res.status === 0, `Recipe swagger failed: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/docs/openapi.json")), "openapi.json harus ada");
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/docs/swagger.setup.js")), "swagger.setup.js harus ada");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  // E2E-17: rakitin recipe docker
  runScenario("E2E-17", "rakitin recipe docker", () => {
    const res = runCLI(["recipe", "docker", "--json"]);
    assert(res.status === 0, `Recipe docker failed: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "Dockerfile")), "Dockerfile harus ada");
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "docker-compose.yml")), "docker-compose.yml harus ada");
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, ".dockerignore")), ".dockerignore harus ada");
  });

  // E2E-18: rakitin recipe test
  runScenario("E2E-18", "rakitin recipe test", () => {
    runCLI(["add", "module", "item", "--arch", "modular", "--orm", "none", "--yes"]);
    const res = runCLI(["recipe", "test", "--json"]);
    assert(res.status === 0, `Recipe test failed: ${res.stderr}`);
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "tests/setup.js")), "tests/setup.js harus ada");
    assert(fs.existsSync(path.join(TEST_PROJECT_DIR, "tests/modules/item.test.js")), "tests/modules/item.test.js harus ada");
    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "tests"));
  });

  // E2E-19: rakitin info & doctor
  runScenario("E2E-19", "rakitin info & doctor diagnostics", () => {
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    runCLI(["integrate"]);
    const infoRes = runCLI(["info"]);
    assert(infoRes.status === 0, `Info failed: ${infoRes.stderr}`);
    const info = JSON.parse(infoRes.stdout);
    assert(info.npmProject === true, "info.npmProject harus true");
    assert(info.modules.modular === 1, "info.modules.modular harus 1");
    assert(info.mainRouter.exists === true, "info.mainRouter.exists harus true");

    const docRes = runCLI(["doctor"]);
    assert(docRes.status === 0, `Doctor failed: ${docRes.stderr}`);
    assert(docRes.stdout.includes("package.json"), "Doctor harus memeriksa package.json");
  });

  // E2E-20: Dry Run Flag Inspection
  runScenario("E2E-20", "rakitin add module --dry-run", () => {
    const res = runCLI(["add", "module", "ghost", "--arch", "modular", "--orm", "none", "--dry-run", "--yes", "--json"]);
    assert(res.status === 0, `Dry run failed: ${res.stderr}`);
    assert(!fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/ghost")), "Modul ghost TIDAK boleh dibuat pada disk saat dry-run");
  });

  // E2E-21: Full App Integration & Runtime Smoke Test
  runScenario("E2E-21", "Full App Boot & Router Import Smoke Test", () => {
    runCLI(["init", "--preset", "intermediate", "--yes"]);
    runCLI(["add", "module", "account", "--arch", "modular", "--orm", "none", "--yes"]);
    runCLI(["add", "module", "order", "--arch", "simple", "--orm", "none", "--yes"]);
    runCLI(["add", "middleware", "auth", "--no-install"]);
    runCLI(["add", "middleware", "logger"]);
    runCLI(["add", "config", "app"]);
    runCLI(["integrate", "--middleware", "auth,logger"]);

    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));

    // Verify router export in Node runtime with minimal express/jwt loader
    const testScript = "const Module = require('module'); const orig = Module._load; Module._load = function(req) { if (req === 'express') return { Router: () => ({ use: () => {}, get: () => {}, post: () => {} }) }; if (req === 'jsonwebtoken') return { sign: () => 'token', verify: () => ({}) }; return orig.apply(this, arguments); }; const router = require('./app/routes/index.js'); if (!router) throw new Error('Router export is empty');";
    const res = spawnSync(process.execPath, ["-e", testScript], {
      cwd: TEST_PROJECT_DIR,
      encoding: "utf8",
    });
    assert(res.status === 0, `Router runtime import failed: ${res.stderr}`);
  });

  // E2E-22: Runtime Require Validation of All ORMs (Prisma, Sequelize, Mongoose, TypeORM) in Both Architectures
  runScenario("E2E-22", "Runtime Require Validation for All ORMs (Modular & Simple)", () => {
    // Generate modular ORMs
    runCLI(["add", "module", "pMod", "--arch", "modular", "--orm", "prisma", "--no-install", "--yes"]);
    runCLI(["add", "module", "sMod", "--arch", "modular", "--orm", "sequelize", "--no-install", "--yes"]);
    runCLI(["add", "module", "mMod", "--arch", "modular", "--orm", "mongoose", "--no-install", "--yes"]);
    runCLI(["add", "module", "tMod", "--arch", "modular", "--orm", "typeorm", "--no-install", "--yes"]);

    // Generate simple ORMs
    runCLI(["add", "module", "pSim", "--arch", "simple", "--orm", "prisma", "--no-install", "--yes"]);
    runCLI(["add", "module", "sSim", "--arch", "simple", "--orm", "sequelize", "--no-install", "--yes"]);
    runCLI(["add", "module", "mSim", "--arch", "simple", "--orm", "mongoose", "--no-install", "--yes"]);
    runCLI(["add", "module", "tSim", "--arch", "simple", "--orm", "typeorm", "--no-install", "--yes"]);

    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));

    // Verify each generated service and model can resolve its relative requires without MODULE_NOT_FOUND
    const runtimeLoaderScript = `
      const Module = require('module');
      const orig = Module._load;
      Module._load = function(req, parent, isMain) {
        if (req === '@prisma/client') {
          return { PrismaClient: function() { return {}; } };
        }
        if (req === 'sequelize') {
          function SequelizeMock() {
            this.define = () => ({});
          }
          SequelizeMock.DataTypes = { INTEGER: 'INTEGER', STRING: 'STRING' };
          SequelizeMock.Sequelize = SequelizeMock;
          return SequelizeMock;
        }
        if (req === 'mongoose') {
          const Schema = function() {};
          return { Schema, model: () => ({}) };
        }
        if (req === 'typeorm') {
          return {
            EntitySchema: function() {},
            DataSource: function() {
              this.getRepository = () => ({
                find: async () => [],
                findOneBy: async () => ({}),
                create: (d) => d,
                save: async (d) => d,
                delete: async () => ({}),
              });
            },
          };
        }
        return orig.apply(this, arguments);
      };

      // Test Modular requires
      require('./app/modules/p-mod/services/p-mod.service.js');
      require('./app/modules/s-mod/services/s-mod.service.js');
      require('./app/modules/m-mod/services/m-mod.service.js');
      require('./app/modules/t-mod/services/t-mod.service.js');
      require('./app/modules/s-mod/models/s-mod.model.js');
      require('./app/modules/m-mod/models/m-mod.model.js');
      require('./app/modules/t-mod/entities/t-mod.entity.js');

      // Test Simple requires
      require('./app/modules/p-sim/p-sim.service.js');
      require('./app/modules/s-sim/s-sim.service.js');
      require('./app/modules/m-sim/m-sim.service.js');
      require('./app/modules/t-sim/t-sim.service.js');
      require('./app/modules/s-sim/s-sim.model.js');
      require('./app/modules/m-sim/m-sim.model.js');
      require('./app/modules/t-sim/t-sim.entity.js');
    `;

    const res = spawnSync(process.execPath, ["-e", runtimeLoaderScript], {
      cwd: TEST_PROJECT_DIR,
      encoding: "utf8",
    });
    assert(res.status === 0, `ORM runtime require validation failed: ${res.stderr}`);
  });

  // E2E-23: Runtime Require Validation of Endpoint Generator (Modular & Simple)
  runScenario("E2E-23", "Runtime Require Validation for Endpoint Generator (Modular & Simple)", () => {
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    runCLI(["add", "module", "product", "--arch", "simple", "--orm", "none", "--yes"]);

    runCLI(["add", "endpoint", "user", "--resource", "profile"]);
    runCLI(["add", "endpoint", "product", "--resource", "item"]);

    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));

    const endpointLoaderScript = `
      const Module = require('module');
      const orig = Module._load;
      Module._load = function(req) {
        if (req === 'express') return { Router: () => ({ get: () => {}, post: () => {}, put: () => {}, delete: () => {} }) };
        return orig.apply(this, arguments);
      };

      // Modular endpoint components
      require('./app/modules/user/routes/profile.router.js');
      require('./app/modules/user/controllers/profile.controller.js');
      require('./app/modules/user/services/profile.service.js');

      // Simple endpoint components
      require('./app/modules/product/item.router.js');
      require('./app/modules/product/item.controller.js');
      require('./app/modules/product/item.service.js');
    `;

    const res = spawnSync(process.execPath, ["-e", endpointLoaderScript], {
      cwd: TEST_PROJECT_DIR,
      encoding: "utf8",
    });
    assert(res.status === 0, `Endpoint runtime require failed: ${res.stderr}`);
  });

  // E2E-24: Runtime Require Validation of Utils, Configs, Validators, Middlewares, and Docs
  runScenario("E2E-24", "Runtime Require Validation for Shared Utilities, Configs, Validators, Docs", () => {
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    runCLI(["add", "util", "string"]);
    runCLI(["add", "util", "number"]);
    runCLI(["add", "util", "array"]);
    runCLI(["add", "config", "app"]);
    runCLI(["add", "config", "jwt"]);
    runCLI(["add", "config", "cors"]);
    runCLI(["add", "middleware", "auth", "--no-install"]);
    runCLI(["add", "middleware", "logger"]);
    runCLI(["add", "validation", "common"]);
    runCLI(["add", "validation", "from-module", "user"]);
    runCLI(["add", "docs", "swagger-ui"]);

    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));

    const sharedLoaderScript = `
      const Module = require('module');
      const orig = Module._load;
      Module._load = function(req) {
        if (req === 'jsonwebtoken') return { verify: () => ({}) };
        if (req === 'swagger-ui-express') return { serve: () => {}, setup: () => () => {} };
        if (req === 'swagger-jsdoc') return () => ({});
        if (req === 'joi') {
          const createChain = () => new Proxy(function() {}, {
            get: (target, prop) => {
              if (prop === 'then') return undefined;
              return (...args) => createChain();
            },
            apply: (target, thisArg, args) => createChain(),
          });
          return createChain();
        }
        return orig.apply(this, arguments);
      };

      require('./app/shared/utils/string.util.js');
      require('./app/shared/utils/number.util.js');
      require('./app/shared/utils/array.util.js');
      require('./app/shared/config/app.config.js');
      require('./app/shared/config/jwt.config.js');
      require('./app/shared/config/cors.config.js');
      require('./app/shared/middlewares/auth.middleware.js');
      require('./app/shared/middlewares/logger.middleware.js');
      require('./app/shared/validators/common.validator.js');
      require('./app/shared/validators/user.validator.js');
      const { mountSwagger } = require('./app/docs/swagger-setup.js');
      if (typeof mountSwagger !== 'function') throw new Error('mountSwagger is not a function');
    `;

    const res = spawnSync(process.execPath, ["-e", sharedLoaderScript], {
      cwd: TEST_PROJECT_DIR,
      encoding: "utf8",
    });
    assert(res.status === 0, `Shared components runtime require failed: ${res.stderr}`);
  });

  // E2E-25: Comprehensive Dry Run across all generator kinds
  runScenario("E2E-25", "Strict Dry-Run Validation (Zero disk writes across all generators)", () => {
    // None of these should write to disk when --dry-run is passed
    runCLI(["add", "module", "dryMod", "--arch", "modular", "--orm", "none", "--dry-run", "--yes"]);
    runCLI(["add", "util", "uuid", "--dry-run"]);
    runCLI(["add", "config", "redis", "--dry-run"]);
    runCLI(["add", "middleware", "error", "--dry-run", "--no-install"]);
    runCLI(["add", "validation", "common", "--dry-run"]);
    runCLI(["add", "docs", "openapi-json", "--dry-run"]);

    assert(!fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/dry-mod")), "dry-mod folder TIDAK boleh dibuat");
    assert(!fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/utils/uuid.util.js")), "uuid.util TIDAK boleh dibuat");
    assert(!fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/config/redis.config.js")), "redis.config TIDAK boleh dibuat");
    assert(!fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/middlewares/error.middleware.js")), "error.middleware TIDAK boleh dibuat");
    assert(!fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/validators/common.validator.js")), "common.validator TIDAK boleh dibuat");
    assert(!fs.existsSync(path.join(TEST_PROJECT_DIR, "app/docs/openapi.json")), "openapi.json TIDAK boleh dibuat");
  });

  // E2E-26: Live Express Server & HTTP Request Test
  runScenario("E2E-26", "Live Express App & Controller Execution Test", () => {
    runCLI(["init", "--preset", "advanced", "--yes"]);
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    runCLI(["add", "module", "product", "--arch", "simple", "--orm", "none", "--yes"]);
    runCLI(["add", "middleware", "logger", "--json"]);
    runCLI(["integrate", "--middleware", "logger", "--json"]);

    const liveServerScript = `
      const Module = require('module');
      const orig = Module._load;
      const routes = [];
      Module._load = function(req) {
        if (req === 'express') {
          const createRouter = () => ({
            routes: [],
            use(pathOrMw, maybeMw) {
              if (typeof pathOrMw === 'string' && maybeMw && Array.isArray(maybeMw.routes)) {
                for (const r of maybeMw.routes) {
                  routes.push({ method: r.method, path: pathOrMw + (r.path === '/' ? '' : r.path), handler: r.handler });
                }
              }
            },
            get(p, h) {
              this.routes.push({ method: 'GET', path: p, handler: h });
              routes.push({ method: 'GET', path: p, handler: h });
            },
            post(p, h) {
              this.routes.push({ method: 'POST', path: p, handler: h });
              routes.push({ method: 'POST', path: p, handler: h });
            },
            put(p, h) {
              this.routes.push({ method: 'PUT', path: p, handler: h });
              routes.push({ method: 'PUT', path: p, handler: h });
            },
            delete(p, h) {
              this.routes.push({ method: 'DELETE', path: p, handler: h });
              routes.push({ method: 'DELETE', path: p, handler: h });
            },
          });
          const fn = () => createRouter();
          fn.Router = createRouter;
          return fn;
        }
        return orig.apply(this, arguments);
      };

      const router = require('./app/routes/index.js');
      async function testEndpoint(modulePath) {
        const route = routes.find(r => r.path === modulePath && r.method === 'GET');
        if (!route) throw new Error('Route not found: ' + modulePath + ' in: ' + JSON.stringify(routes.map(r => r.path)));
        let responseData = null;
        let responseStatus = null;
        const mockReq = { query: {}, params: {}, body: {} };
        const mockRes = {
          status(s) { responseStatus = s; return this; },
          json(d) { responseData = d; return this; },
        };
        await route.handler(mockReq, mockRes, (err) => { if (err) throw err; });
        if (responseStatus !== 200) throw new Error('Expected status 200, got ' + responseStatus);
        if (!responseData || !responseData.message) throw new Error('Expected message in response for ' + modulePath);
      }

      (async () => {
        await testEndpoint('/user');
        await testEndpoint('/product');
      })().catch(err => {
        console.error(err);
        process.exit(1);
      });
    `;
    const res = spawnSync(process.execPath, ["-e", liveServerScript], {
      cwd: TEST_PROJECT_DIR,
      encoding: "utf8",
      timeout: 10000,
    });
    assert(res.status === 0, `Live express test failed: ${res.stderr || res.stdout}`);
  });

  // Teardown: leave tests/project in clean state
  cleanProject();

  logHeader("HASIL PENGUJIAN REAL PROJECT");
  console.log(`  Total Skenario: ${passedCount + failedCount}`);
  console.log(`  ${colors.green}Passed: ${passedCount}${colors.reset}`);
  console.log(`  ${failedCount > 0 ? colors.red : colors.green}Failed: ${failedCount}${colors.reset}\n`);

  if (failedCount > 0) {
    console.log(`${colors.red}${colors.bold}Daftar Kegagalan:${colors.reset}`);
    failures.forEach((f) => console.log(`  - [${f.id}] ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log(`${colors.green}${colors.bold}🎉 Seluruh ${passedCount} skenario pengujian real-project sukses 100%!${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
