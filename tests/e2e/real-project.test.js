/**
 * tests/e2e/real-project.test.js - Jest E2E suite for real-project testing
 */

const { spawnSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");

const REPO_ROOT = path.resolve(__dirname, "../..");
const TEST_PROJECT_DIR = path.resolve(REPO_ROOT, "tests/project");

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

function runCLI(args, input = null) {
  const binary = path.resolve(REPO_ROOT, "bin/rakitin.js");
  const nodeBin = process.execPath;
  const fullArgs = [binary, ...args];

  const res = spawnSync(nodeBin, fullArgs, {
    cwd: TEST_PROJECT_DIR,
    input: input != null ? input : undefined,
    encoding: "utf8",
    env: { ...process.env, RAKITIN_SILENT: "1" },
  });

  return {
    status: res.status,
    stdout: res.stdout || "",
    stderr: res.stderr || "",
  };
}

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
      expect(() => new vm.Script(src)).not.toThrow();
    }
  }
}

describe("Real Project E2E Suite (tests/project)", () => {
  beforeEach(() => {
    cleanProject();
  });

  afterAll(() => {
    cleanProject();
  });

  test("E2E: rakitin list outputs JSON catalog", () => {
    const res = runCLI(["list", "--json"]);
    expect(res.status).toBe(0);
    const data = JSON.parse(res.stdout);
    expect(Array.isArray(data.catalog)).toBe(true);
    expect(data.catalog.length).toBeGreaterThanOrEqual(8);
  });

  test("E2E: rakitin init generates .rakitinrc.json", () => {
    const res = runCLI(["init", "--preset", "basic", "--json"]);
    expect(res.status).toBe(0);
    const rcPath = path.join(TEST_PROJECT_DIR, ".rakitinrc.json");
    expect(fs.existsSync(rcPath)).toBe(true);
    const rc = fs.readJsonSync(rcPath);
    expect(rc.preset).toBe("basic");
    expect(rc.orm).toBe("prisma");
  });

  test("E2E: rakitin add module (modular & simple)", () => {
    // Modular
    let res = runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes", "--json"]);
    expect(res.status).toBe(0);
    expect(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/user/controllers/user.controller.js"))).toBe(true);

    // Simple
    res = runCLI(["add", "module", "product", "--arch", "simple", "--orm", "none", "--yes", "--json"]);
    expect(res.status).toBe(0);
    expect(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/modules/product/product.controller.js"))).toBe(true);

    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  test("E2E: rakitin add middleware & config", () => {
    let res = runCLI(["add", "middleware", "auth", "--no-install", "--json"]);
    expect(res.status).toBe(0);
    expect(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/middlewares/auth.middleware.js"))).toBe(true);

    res = runCLI(["add", "config", "jwt", "--json"]);
    expect(res.status).toBe(0);
    expect(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/config/jwt.config.js"))).toBe(true);

    const envExample = fs.readFileSync(path.join(TEST_PROJECT_DIR, ".env.example"), "utf8");
    expect(envExample).toContain("JWT_SECRET=");

    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  test("E2E: rakitin integrate wires modules to router", () => {
    runCLI(["add", "module", "user", "--arch", "modular", "--orm", "none", "--yes"]);
    runCLI(["add", "middleware", "auth", "--no-install"]);
    const res = runCLI(["integrate", "--middleware", "auth", "--json"]);
    expect(res.status).toBe(0);

    const routerPath = path.join(TEST_PROJECT_DIR, "app/routes/index.js");
    expect(fs.existsSync(routerPath)).toBe(true);
    const content = fs.readFileSync(routerPath, "utf8");
    expect(content).toContain("rakitin:routes:start");
    expect(content).toContain("/user");
    expect(content).toContain("authMiddleware");

    validateSyntaxInDir(path.join(TEST_PROJECT_DIR, "app"));
  });

  test("E2E: rakitin recipes (auth, swagger, docker, test)", () => {
    let res = runCLI(["recipe", "auth", "--arch", "modular", "--json"]);
    expect(res.status).toBe(0);
    expect(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/middlewares/auth.middleware.js"))).toBe(true);
    expect(fs.existsSync(path.join(TEST_PROJECT_DIR, "prisma/schema/user.prisma"))).toBe(true);
    expect(fs.existsSync(path.join(TEST_PROJECT_DIR, "app/shared/config/db.js"))).toBe(true);

    res = runCLI(["recipe", "docker", "--json"]);
    expect(res.status).toBe(0);
    expect(fs.existsSync(path.join(TEST_PROJECT_DIR, "Dockerfile"))).toBe(true);
  });
});
