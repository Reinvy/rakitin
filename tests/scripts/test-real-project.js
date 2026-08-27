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
        throw new Error(`Syntax validation failed on ${fullPath}: ${err.message}`);
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
    console.log(`${colors.green}${colors.bold}🎉 Seluruh 21 skenario pengujian real-project sukses 100%!${colors.reset}\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
