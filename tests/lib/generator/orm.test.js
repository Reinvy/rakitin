/**
 * ORM generator tests - driver-free.
 *
 * `child_process` is globally mocked (tests/setup.js), so any attempt to
 * shell out from a generator would throw `[hermetic] child_process.spawn …`.
 * Each generator uses `process.cwd()` (= this suite's temp dir).
 */

const fs = require("fs");
const path = require("path");
const {
  prismaORM,
  sequelizeORM,
  mongooseORM,
  typeormORM,
} = require("../../../lib/generator/module/orm/orm");
const installer = require("../../../lib/installer");

const read = (rel) => fs.readFileSync(path.join(global.tempDir, rel), "utf8");
const exists = (rel) => fs.existsSync(path.join(global.tempDir, rel));

function expectRelativeAndOnDisk(entries) {
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(path.isAbsolute(entry)).toBe(false);
    expect(entry).not.toContain("\\");
    expect(exists(entry)).toBe(true);
  }
}

describe("ORM generators", () => {
  test("never spawn an installer (installs are declared in the manifest)", async () => {
    await prismaORM("spawnfree");
    await sequelizeORM("spawnfree", "Modular");
    await mongooseORM("spawnfree", "Modular");
    await typeormORM("spawnfree", "Modular");

    expect(installer.internals.spawn).not.toHaveBeenCalled();
    expect(installer.internals.execCommand).not.toHaveBeenCalled();
  });

  describe("prisma", () => {
    test("writes the model, the multi-file base schema, config, client and DATABASE_URL", async () => {
      const result = await prismaORM("order");

      expectRelativeAndOnDisk(result.created);
      expect(result.created).toEqual(
        expect.arrayContaining([
          "prisma/schema/order.prisma",
          "prisma/schema/base.prisma",
          "prisma.config.js",
          "app/shared/config/db.js",
          ".env.example",
        ])
      );

      expect(read("prisma/schema/order.prisma")).toContain("model Order");
      // Prisma 7 multi-file schema: datasource lives in base.prisma, the
      // connection URL is supplied by prisma.config.js from DATABASE_URL.
      expect(read("prisma/schema/base.prisma")).toContain("datasource db {");
      expect(read("prisma/schema/base.prisma")).toContain('provider = "postgresql"');
      expect(read("prisma.config.js")).toContain('require("dotenv").config()');
      expect(read("prisma.config.js")).toContain('schema: "prisma/schema"');
      expect(read("prisma.config.js")).toContain('url: process.env["DATABASE_URL"]');
      expect(read("app/shared/config/db.js")).toContain("module.exports = { prisma }");
      expect(read(".env.example")).toContain("DATABASE_URL");
    });

    test("is idempotent on rerun", async () => {
      await prismaORM("order-again");
      const second = await prismaORM("order-again");

      expect(second.created).toEqual([]);
      expect(second.skipped).toEqual(
        expect.arrayContaining([
          "prisma/schema/order-again.prisma",
          "prisma/schema/base.prisma",
          "prisma.config.js",
          "app/shared/config/db.js",
          ".env.example",
        ])
      );
    });
  });

  describe("sequelize", () => {
    test("writes a modular model exporting the PascalCase model + database singleton", async () => {
      const result = await sequelizeORM("invoice", "Modular");

      expectRelativeAndOnDisk(result.created);
      expect(result.created).toEqual(
        expect.arrayContaining([
          "app/modules/invoice/models/invoice.model.js",
          "app/shared/config/database.js",
        ])
      );
      expect(read("app/modules/invoice/models/invoice.model.js")).toContain(
        "module.exports = Invoice;"
      );
      expect(read("app/modules/invoice/models/invoice.model.js")).toContain(
        'require("../../../shared/config/database")'
      );
      expect(read("app/shared/config/database.js")).toContain("new Sequelize(");
    });

    test("writes a simple-architecture model beside the module files", async () => {
      const result = await sequelizeORM("receipt", "Simple");

      expect(result.created).toContain("app/modules/receipt/receipt.model.js");
      expect(read("app/modules/receipt/receipt.model.js")).toContain(
        "module.exports = Receipt;"
      );
    });

    test("is idempotent on rerun", async () => {
      await sequelizeORM("invoice", "Modular");
      const second = await sequelizeORM("invoice", "Modular");

      expect(second.created).toEqual([]);
      expect(second.skipped).toEqual(
        expect.arrayContaining([
          "app/modules/invoice/models/invoice.model.js",
          "app/shared/config/database.js",
        ])
      );
    });
  });

  describe("mongoose", () => {
    test("writes a model exporting <camel>Model + the connection singleton", async () => {
      const result = await mongooseORM("customer", "Modular");

      expectRelativeAndOnDisk(result.created);
      expect(result.created).toEqual(
        expect.arrayContaining([
          "app/modules/customer/models/customer.model.js",
          "app/shared/config/db.js",
          ".env.example",
        ])
      );
      expect(read("app/modules/customer/models/customer.model.js")).toContain(
        "module.exports = customerModel;"
      );
      expect(read("app/modules/customer/models/customer.model.js")).toContain(
        "mongoose.model("
      );
      expect(read("app/shared/config/db.js")).toContain("mongoose.connect");
      expect(read(".env.example")).toContain("MONGODB_URI");
    });

    test("writes a simple-architecture model beside the module files", async () => {
      const result = await mongooseORM("contact", "Simple");

      expect(result.created).toContain("app/modules/contact/contact.model.js");
      expect(read("app/modules/contact/contact.model.js")).toContain(
        "module.exports = contactModel;"
      );
    });

    test("is idempotent on rerun", async () => {
      await mongooseORM("customer", "Modular");
      const second = await mongooseORM("customer", "Modular");

      expect(second.created).toEqual([]);
      expect(second.skipped).toEqual(
        expect.arrayContaining([
          "app/modules/customer/models/customer.model.js",
          "app/shared/config/db.js",
          ".env.example",
        ])
      );
    });
  });

  describe("typeorm", () => {
    test("writes an entity + the DataSource singleton", async () => {
      const result = await typeormORM("product", "Modular");

      expectRelativeAndOnDisk(result.created);
      expect(result.created).toEqual(
        expect.arrayContaining([
          "app/modules/product/entities/product.entity.js",
          "app/shared/config/data-source.js",
          ".env.example",
        ])
      );
      expect(read("app/modules/product/entities/product.entity.js")).toContain(
        "module.exports = Product;"
      );
      expect(read("app/shared/config/data-source.js")).toContain("new DataSource(");
      expect(read("app/shared/config/data-source.js")).toContain("module.exports = { AppDataSource }");
    });

    test("writes a simple-architecture entity beside the module files", async () => {
      const result = await typeormORM("shipment", "Simple");

      expect(result.created).toContain("app/modules/shipment/shipment.entity.js");
      expect(read("app/modules/shipment/shipment.entity.js")).toContain(
        "module.exports = Shipment;"
      );
    });

    test("is idempotent on rerun", async () => {
      await typeormORM("product", "Modular");
      const second = await typeormORM("product", "Modular");

      expect(second.created).toEqual([]);
      expect(second.skipped).toEqual(
        expect.arrayContaining([
          "app/modules/product/entities/product.entity.js",
          "app/shared/config/data-source.js",
          ".env.example",
        ])
      );
    });
  });

  describe("guards", () => {
    test.each([
      ["prisma", prismaORM],
      ["sequelize", sequelizeORM],
      ["mongoose", mongooseORM],
      ["typeorm", typeormORM],
    ])("%s rejects an empty module name", async (_name, generator) => {
      await expect(generator("", "Modular")).rejects.toThrow();
    });
  });
});
