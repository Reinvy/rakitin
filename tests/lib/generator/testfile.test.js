/**
 * testfile generator tests - real disk in the suite's isolated temp dir.
 */
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");
const safety = require("../../../lib/safety");
const {
  generateTestFiles,
  renderModuleTest,
  ensureTestInfra,
} = require("../../../lib/generator/api/testfile");

const root = () => global.tempDir;

function makeModule(kebab) {
  const dir = path.join(root(), "app", "modules", kebab);
  fs.ensureDirSync(path.join(dir, "routes"));
  fs.writeFileSync(path.join(dir, "routes", `${kebab}.router.js`), "module.exports = {};\n");
  return dir;
}

describe("renderModuleTest", () => {
  test("renders a compilable CommonJS test file for one module", () => {
    const src = renderModuleTest({ module: "invoice-item", root: root() });

    expect(() => new vm.Script(src)).not.toThrow();
    expect(src).toContain("module structure");
    expect(src).toContain('path.join(__dirname, "..", "..", "app", "modules", "invoice-item")');
    expect(src).toContain("fs.existsSync(MODULE_DIR)");
    expect(src).toContain('"/api/invoice-item"');
    // HTTP smoke is honored by SKIP_HTTP_TESTS=1
    expect(src).toContain(
      'const describeHttp = process.env.SKIP_HTTP_TESTS === "1" ? describe.skip : describe;'
    );
    // express/supertest only required inside the HTTP block
    const httpIndex = src.indexOf("describeHttp(");
    expect(src.indexOf('require("supertest")')).toBeGreaterThan(httpIndex);
    expect(src.indexOf('require("express")')).toBeGreaterThan(httpIndex);
  });
});

describe("generateTestFiles", () => {
  afterEach(() => safety.resetPlan());

  test("writes tests/modules/<kebab>.test.js and is idempotent", async () => {
    makeModule("invoice");

    const first = await generateTestFiles({ module: "invoice", root: root() });
    expect(first.created).toEqual(["tests/modules/invoice.test.js"]);
    expect(first.skipped).toEqual([]);
    expect(first.data).toEqual({ modules: ["invoice"], dir: "tests/modules" });
    expect(() => new vm.Script(fs.readFileSync(path.join(root(), first.created[0]), "utf8"))).not.toThrow();

    const second = await generateTestFiles({ module: "invoice", root: root() });
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual(["tests/modules/invoice.test.js"]);
  });

  test("throws an actionable error for an unknown module", async () => {
    await expect(generateTestFiles({ module: "ghost", root: root() })).rejects.toThrow(
      'Modul "ghost" tidak ditemukan. Buat dulu: rakitin add module ghost'
    );
  });

  test("rejects path-traversal module names", async () => {
    await expect(generateTestFiles({ module: "../evil", root: root() })).rejects.toThrow(
      "tidak valid"
    );
    expect(fs.existsSync(path.join(root(), "..", "evil.test.js"))).toBe(false);
  });

  test("throws when neither module nor --all is given", async () => {
    await expect(generateTestFiles({ root: root() })).rejects.toThrow(
      "Tentukan modul (rakitin add test <module>) atau pakai --all."
    );
  });

  test("--all covers every detected module", async () => {
    makeModule("alpha");
    makeModule("beta");

    const result = await generateTestFiles({ all: true, root: root() });
    expect(result.created.sort()).toEqual([
      "tests/modules/alpha.test.js",
      "tests/modules/beta.test.js",
    ]);
    expect(result.data.modules.sort()).toEqual(["alpha", "beta"]);
  });

  test("dry-run plans without writing", async () => {
    makeModule("invoice");
    safety.beginPlan();

    const result = await generateTestFiles({ module: "invoice", root: root() });
    expect(result.created).toEqual(["tests/modules/invoice.test.js"]);
    expect(fs.existsSync(path.join(root(), "tests/modules/invoice.test.js"))).toBe(false);
    expect(safety.getPlan()).toContainEqual({
      op: "create",
      path: path.join(root(), "tests/modules/invoice.test.js"),
    });
  });
});

describe("ensureTestInfra", () => {
  test("writes jest config + setup once", () => {
    const first = ensureTestInfra(root());
    expect(first.created).toEqual(["jest.config.js", "tests/setup.js"]);
    expect(first.skipped).toEqual([]);

    const config = fs.readFileSync(path.join(root(), "jest.config.js"), "utf8");
    expect(config).toContain('testEnvironment: "node"');
    expect(config).toContain('testMatch: ["**/tests/**/*.test.js"]');
    expect(fs.readFileSync(path.join(root(), "tests/setup.js"), "utf8")).toContain(
      "jest.setTimeout(15000)"
    );

    const second = ensureTestInfra(root());
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual(["jest.config.js", "tests/setup.js"]);
  });
});
