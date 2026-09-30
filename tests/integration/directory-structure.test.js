/**
 * Integration: the on-disk directory structure produced by the v3 module
 * generators, plus the returned `{created, skipped}` contract.
 */
const fs = require("fs-extra");
const path = require("path");
const { getPaths } = require("../../lib/constants");
const { simpleArch, modularArch } = require("../../lib/generator/module/arch/arch");
const prisma = require("../../lib/generator/module/orm/prisma.orm");

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

function rel(...segments) {
  return segments.join("/");
}

describe("Directory Structure (real disk)", () => {
  test("getPaths resolves the app skeleton under the project root", () => {
    const p = getPaths(global.tempDir);
    expect(p.basePath).toBe(path.join(global.tempDir, "app"));
    expect(p.modulesPath).toBe(path.join(global.tempDir, "app", "modules"));
    expect(p.sharedPath).toBe(path.join(global.tempDir, "app", "shared"));
    expect(p.appRoutesPath).toBe(path.join(global.tempDir, "app", "routes"));
    expect(p.prismaPath).toBe(path.join(global.tempDir, "prisma", "schema"));
  });

  test("simpleArch produces flat module files and reports them as created", async () => {
    const result = await simpleArch("payment", "None");

    const dir = path.join(getPaths().modulesPath, "payment");
    for (const file of [
      "payment.controller.js",
      "payment.service.js",
      "payment.router.js",
    ]) {
      expect(fs.existsSync(path.join(dir, file))).toBe(true);
    }
    expect(result.created.sort()).toEqual(
      [
        "app/modules/payment/payment.controller.js",
        "app/modules/payment/payment.router.js",
        "app/modules/payment/payment.service.js",
      ].sort()
    );
    expect(result.skipped).toEqual([]);
  });

  test("modularArch produces the four-layer structure", async () => {
    await modularArch("shipping", "None");

    const dir = path.join(getPaths().modulesPath, "shipping");
    for (const sub of ["controllers", "services", "models", "routes"]) {
      expect(fs.existsSync(path.join(dir, sub))).toBe(true);
    }
    expect(fs.existsSync(path.join(dir, "controllers", "shipping.controller.js"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "services", "shipping.service.js"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "routes", "shipping.router.js"))).toBe(true);
  });

  test("REGRESSION: real ORMs never get the None placeholder model", async () => {
    const result = await modularArch("order", "Sequelize");

    const dir = path.join(getPaths().modulesPath, "order");
    expect(fs.existsSync(path.join(dir, "models", "order.model.js"))).toBe(false);
    expect(result.created).not.toContain("app/modules/order/models/order.model.js");
  });

  test("module names normalize consistently across arch layers", async () => {
    await modularArch("StockLevel Report", "None");

    const dir = path.join(getPaths().modulesPath, "stock-level-report");
    expect(fs.existsSync(path.join(dir, "routes", "stock-level-report.router.js"))).toBe(
      true
    );

    // A camelCase input lands on the SAME canonical path
    await simpleArch("stockLevelReport", "None");
    expect(fs.existsSync(path.join(dir, "stock-level-report.controller.js"))).toBe(true);
  });

  test("re-running a generator reports everything as skipped", async () => {
    await simpleArch("billing", "None");
    const second = await simpleArch("billing", "None");

    expect(second.created).toEqual([]);
    expect(second.skipped.length).toBe(3);
    for (const entry of second.skipped) {
      expect(entry.startsWith("app/modules/billing/")).toBe(true);
      expect(fs.existsSync(path.join(global.tempDir, entry))).toBe(true);
    }
  });

  test("prisma helpers live under prisma/schema and shared/config", async () => {
    const base = prisma.ensurePrismaBaseSchema(global.tempDir);
    const db = prisma.ensurePrismaDbConfig(global.tempDir);

    expect(fs.existsSync(path.join(global.tempDir, rel("prisma", "schema", "base.prisma")))).toBe(
      true
    );
    expect(fs.existsSync(path.join(global.tempDir, rel("app", "shared", "config", "db.js")))).toBe(
      true
    );
    expect(base.path.endsWith(path.join("prisma", "schema", "base.prisma"))).toBe(true);
    expect(db.path.endsWith(path.join("app", "shared", "config", "db.js"))).toBe(true);
  });
});
