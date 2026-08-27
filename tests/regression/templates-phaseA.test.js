/**
 * Phase A migration guard: module-layer output rendered from
 * lib/templates/*.ejs MUST stay byte-identical to the historical inline
 * output, captured as golden fixtures under tests/fixtures/golden/.
 */
const fs = require("fs");
const path = require("path");
const { simpleArch, modularArch } = require("../../lib/generator/module/arch/arch");
const { generateServiceCode } = require("../../lib/generator/shared/orm-service-generator");
const { getPaths } = require("../../lib/constants");

const GOLDEN_DIR = path.join(__dirname, "..", "fixtures", "golden");

function golden(name) {
  return fs.readFileSync(path.join(GOLDEN_DIR, `${name}.golden`), "utf8");
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("Template Phase A - byte-identical golden output", () => {
  const MODULE = "user-profile"; // matches fixture naming exactly

  test("simple architecture controller & router match golden", async () => {
    await simpleArch(MODULE, "None");

    const dir = path.join(getPaths().modulesPath, MODULE);
    expect(
      fs.readFileSync(path.join(dir, "user-profile.controller.js"), "utf8")
    ).toBe(golden("controller.simple"));
    expect(
      fs.readFileSync(path.join(dir, "user-profile.router.js"), "utf8")
    ).toBe(golden("router.simple"));
  });

  test("modular architecture controller & router match golden", async () => {
    await modularArch(MODULE, "None");

    const dir = path.join(getPaths().modulesPath, MODULE);
    expect(
      fs.readFileSync(path.join(dir, "controllers", "user-profile.controller.js"), "utf8")
    ).toBe(golden("controller.modular"));
    expect(
      fs.readFileSync(path.join(dir, "routes", "user-profile.router.js"), "utf8")
    ).toBe(golden("router.modular"));
  });

  test("no-ORM service renders via EJS template byte-identically", () => {
    const code = generateServiceCode(MODULE, "None", "Modular");
    expect(code).toBe(golden("service-none"));
  });

  test("templates render for OTHER module names without leaking state", () => {
    const { renderModuleTemplate } = require("../../lib/template/module-templates");

    const out = renderModuleTemplate("router.simple.ejs", {
      moduleName: "Order Item",
      kebabName: "order-item",
    });
    expect(out).toContain("// Order Item Router");
    expect(out).toContain('require("./order-item.controller")');

    const service = generateServiceCode("Order Item", "None", "Simple");
    expect(service).toContain("ORDERITEM_STORE");
    expect(service).not.toContain("user-profile");
  });
});