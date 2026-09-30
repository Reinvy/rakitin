/**
 * Architecture generator tests - real disk execution in the per-suite temp
 * dir (tests/setup.js sets process.cwd() to it). Generated JS is compiled
 * with `vm.Script`; files are never `require()`d.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { simpleArch, modularArch } = require("../../../lib/generator/module/arch/arch");
const {
  RESOURCE_BLOCK_START,
  RESOURCE_BLOCK_END,
} = require("../../../lib/safety");

const CRUD_VERBS = ["getAll", "getById", "create", "update", "remove"];

const abs = (rel) => path.join(global.tempDir, rel);
const read = (rel) => fs.readFileSync(abs(rel), "utf8");

/** Strip CommonJS requires so a fragment compiles standalone. */
function stripRequires(src) {
  return src.replace(/require\([^)]*\)/g, "({})");
}

function expectParses(rel) {
  expect(() => new vm.Script(stripRequires(read(rel)))).not.toThrow();
}

/** `exports.<verb> = …` names, in source order. */
function controllerVerbs(rel) {
  return [...read(rel).matchAll(/^exports\.(\w+) =/gm)].map((m) => m[1]);
}

/** `router.<method>("<path>", controller.<verb>)` descriptors. */
function routerRoutes(rel) {
  return [...read(rel).matchAll(/router\.(\w+)\("([^"]*)", controller\.(\w+)\)/g)].map((m) => ({
    method: m[1],
    path: m[2],
    verb: m[3],
  }));
}

const FULL_ROUTES = [
  { method: "get", path: "/" },
  { method: "get", path: "/:id" },
  { method: "post", path: "/" },
  { method: "put", path: "/:id" },
  { method: "delete", path: "/:id" },
];

describe("module architecture generators", () => {
  describe("simpleArch", () => {
    test("returns { created, skipped } with root-relative paths that exist", async () => {
      const result = await simpleArch("user-profile", "None");

      expect(Object.keys(result).sort()).toEqual(["created", "skipped"]);
      expect(result.skipped).toEqual([]);
      expect(result.created.sort()).toEqual([
        "app/modules/user-profile/user-profile.controller.js",
        "app/modules/user-profile/user-profile.router.js",
        "app/modules/user-profile/user-profile.service.js",
      ]);
      for (const rel of result.created) {
        expect(path.isAbsolute(rel)).toBe(false);
        expect(fs.existsSync(abs(rel))).toBe(true);
      }
      // The simple architecture never writes a model file.
      expect(fs.existsSync(abs("app/modules/user-profile/models"))).toBe(false);
    });

    test("emits the full CRUD verb set in controller and router", async () => {
      await simpleArch("blog", "None");

      const controller = "app/modules/blog/blog.controller.js";
      const router = "app/modules/blog/blog.router.js";

      expect(controllerVerbs(controller)).toEqual(CRUD_VERBS);
      expect(routerRoutes(router).map(({ method, path: p }) => ({ method, path: p }))).toEqual(
        FULL_ROUTES
      );
      expect(routerRoutes(router).map((r) => r.verb)).toEqual(CRUD_VERBS);

      expect(read(router)).toContain(RESOURCE_BLOCK_START);
      expect(read(router)).toContain(RESOURCE_BLOCK_END);
      expectParses(controller);
      expectParses(router);
    });

    test("renders only getAll/getById for --template readonly", async () => {
      await simpleArch("report", "None", { template: "readonly" });

      expect(controllerVerbs("app/modules/report/report.controller.js")).toEqual([
        "getAll",
        "getById",
      ]);
      expect(routerRoutes("app/modules/report/report.router.js")).toEqual([
        { method: "get", path: "/", verb: "getAll" },
        { method: "get", path: "/:id", verb: "getById" },
      ]);
    });

    test("rejects an unknown template", async () => {
      await expect(simpleArch("oops", "None", { template: "nope" })).rejects.toThrow(
        /Template tidak dikenal: "nope"\. Pilih salah satu: crud, readonly, graphql, realtime\./
      );
    });

    test("is idempotent: a rerun reports the same files as skipped", async () => {
      await simpleArch("invoice", "None");
      const second = await simpleArch("invoice", "None");

      expect(second.created).toEqual([]);
      expect(second.skipped.sort()).toEqual([
        "app/modules/invoice/invoice.controller.js",
        "app/modules/invoice/invoice.router.js",
        "app/modules/invoice/invoice.service.js",
      ]);
    });

    test("rejects unsafe module names and unknown ORMs", async () => {
      await expect(simpleArch("../evil", "None")).rejects.toThrow(/Nama module tidak valid/);
      await expect(simpleArch("ok", "MongoDB")).rejects.toThrow(/ORM tidak valid/);
    });
  });

  describe("modularArch", () => {
    test("writes controllers/services/routes and a model placeholder for ORM None", async () => {
      const result = await modularArch("order-item", "None");

      expect(result.created.sort()).toEqual([
        "app/modules/order-item/controllers/order-item.controller.js",
        "app/modules/order-item/models/order-item.model.js",
        "app/modules/order-item/routes/order-item.router.js",
        "app/modules/order-item/services/order-item.service.js",
      ]);
      for (const rel of result.created) expect(fs.existsSync(abs(rel))).toBe(true);
    });

    test("emits the full CRUD verb set and both resource markers", async () => {
      await modularArch("product", "None");

      const controller = "app/modules/product/controllers/product.controller.js";
      const router = "app/modules/product/routes/product.router.js";

      expect(controllerVerbs(controller)).toEqual(CRUD_VERBS);
      expect(routerRoutes(router).map((r) => r.verb)).toEqual(CRUD_VERBS);
      expect(read(router)).toContain(RESOURCE_BLOCK_START);
      expect(read(router)).toContain(RESOURCE_BLOCK_END);
      expectParses(controller);
      expectParses(router);
      expectParses("app/modules/product/services/product.service.js");
    });

    test("renders only getAll/getById for --template readonly", async () => {
      await modularArch("analytics", "None", { template: "readonly" });

      expect(controllerVerbs("app/modules/analytics/controllers/analytics.controller.js")).toEqual(
        ["getAll", "getById"]
      );
      expect(routerRoutes("app/modules/analytics/routes/analytics.router.js")).toEqual([
        { method: "get", path: "/", verb: "getAll" },
        { method: "get", path: "/:id", verb: "getById" },
      ]);
    });

    test("never writes the placeholder model for a real ORM (F-2 regression guard)", async () => {
      for (const orm of ["Sequelize", "Mongoose", "Prisma", "TypeORM"]) {
        const result = await modularArch(`no-placeholder-${orm.toLowerCase()}`, orm);

        const modelPath = `app/modules/no-placeholder-${orm.toLowerCase()}/models/no-placeholder-${orm.toLowerCase()}.model.js`;
        expect(result.created).not.toContain(modelPath);
        expect(result.skipped).not.toContain(modelPath);
        expect(fs.existsSync(abs(modelPath))).toBe(false);
      }
    });

    test("is idempotent: a rerun reports every file as skipped", async () => {
      await modularArch("ledger", "None");
      const second = await modularArch("ledger", "None");

      expect(second.created).toEqual([]);
      expect(second.skipped).toHaveLength(4);
    });
  });
});
