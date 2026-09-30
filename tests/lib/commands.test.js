/**
 * Command-layer tests for the headless `rakitin add …` surface.
 *
 * Everything runs through `buildContext()` + `addCommand()` in this suite's
 * temp dir (process.cwd()). No process is spawned: `installer.internals`
 * is stubbed by tests/setup.js and `--no-install` (context.install:false)
 * keeps the dependency layer a no-op.
 */

const fs = require("fs");
const path = require("path");
const { buildContext } = require("../../lib/commands/shared");
const { addCommand } = require("../../lib/commands/add");
const { ensureDependencies } = require("../../lib/deps/manifest");
const safety = require("../../lib/safety");
const installer = require("../../lib/installer");

const CRUD_VERBS = ["getAll", "getById", "create", "update", "remove"];

const abs = (rel) => path.join(global.tempDir, rel);
const exists = (rel) => fs.existsSync(abs(rel));
const read = (rel) => fs.readFileSync(abs(rel), "utf8");

/** A headless context; `install:false` every CLI test runs with --no-install. */
function ctx(overrides = {}) {
  return buildContext({ yes: true, install: false, ...overrides });
}

function controllerVerbs(rel) {
  return [...read(rel).matchAll(/^exports\.(\w+) =/gm)].map((m) => m[1]);
}

function expectRelativeAndOnDisk(entries) {
  expect(entries.length).toBeGreaterThan(0);
  for (const entry of entries) {
    expect(path.isAbsolute(entry)).toBe(false);
    expect(entry).not.toContain("\\");
    expect(exists(entry)).toBe(true);
  }
}

describe("buildContext", () => {
  test("normalizes architecture and ORM flags", () => {
    const context = ctx({ arch: "SIMPLE", orm: "Sequelize" });

    expect(context.arch).toBe("simple");
    expect(context.orm).toBe("sequelize");
    expect(context.install).toBe(false);
  });

  test("auto-selects the preset from the ORM flag", () => {
    expect(ctx({}).preset).toBe("basic");
    expect(ctx({ orm: "prisma" }).preset).toBe("intermediate");
  });

  test("defaults arch to modular, template to crud and install to true", () => {
    const context = buildContext({ yes: true });

    expect(context.arch).toBe("modular");
    expect(context.template).toBe("crud");
    expect(context.install).toBe(true);
    expect(context.autoIntegrateRouter).toBe(true);
    expect(context.dryRun).toBe(false);
  });
});

describe("add module", () => {
  afterEach(() => safety.resetPlan());

  test("simple architecture: writes the module and wires the main router", async () => {
    const result = await addCommand("module", "user", ctx({ arch: "simple", orm: "none" }));

    expect(result.ok).toBe(true);
    expectRelativeAndOnDisk(result.created);
    expect(result.created).toEqual(
      expect.arrayContaining([
        "app/modules/user/user.controller.js",
        "app/modules/user/user.service.js",
        "app/modules/user/user.router.js",
        "app/routes/index.js",
      ])
    );
    expect(result.data).toMatchObject({
      module: "user",
      architecture: "simple",
      orm: "None",
      template: "crud",
    });
    expect(controllerVerbs("app/modules/user/user.controller.js")).toEqual(CRUD_VERBS);

    const router = read("app/routes/index.js");
    expect(router).toContain("const userRouter = require('../modules/user/user.router.js');");
    expect(router).toContain("router.use('/user', userRouter);");
    expect(router).not.toContain("controller.");
  });

  test("modular architecture: writes the layered layout plus the None-ORM placeholder", async () => {
    const result = await addCommand("module", "order", ctx({ arch: "modular", orm: "none" }));

    expectRelativeAndOnDisk(result.created);
    expect(result.created).toEqual(
      expect.arrayContaining([
        "app/modules/order/controllers/order.controller.js",
        "app/modules/order/services/order.service.js",
        "app/modules/order/routes/order.router.js",
        "app/modules/order/models/order.model.js",
        "app/routes/index.js",
      ])
    );
    expect(read("app/routes/index.js")).toContain(
      "const orderRouter = require('../modules/order/routes/order.router.js');"
    );
  });

  test("--template readonly emits only getAll/getById in controller and router", async () => {
    const result = await addCommand(
      "module",
      "report",
      ctx({ arch: "modular", orm: "none", template: "readonly" })
    );

    expect(result.data.template).toBe("readonly");
    const controller = "app/modules/report/controllers/report.controller.js";
    const router = "app/modules/report/routes/report.router.js";

    expect(controllerVerbs(controller)).toEqual(["getAll", "getById"]);
    expect(read(controller)).not.toMatch(/exports\.(create|update|remove)\b/);
    const routes = [
      ...read(router).matchAll(/router\.(\w+)\("([^"]*)", controller\.(\w+)\)/g),
    ].map((m) => `${m[1]} ${m[2]} ${m[3]}`);
    expect(routes).toEqual(["get / getAll", "get /:id getById"]);
    expect(read(router)).not.toMatch(/controller\.(create|update|remove)\b/);
  });

  test("rejects an unknown --template", async () => {
    await expect(
      addCommand("module", "oops", ctx({ arch: "simple", orm: "none", template: "nope" }))
    ).rejects.toThrow(/Template tidak dikenal: "nope"/);
    expect(exists("app/modules/oops")).toBe(false);
  });

  test("rejects an unknown architecture and an unknown ORM", async () => {
    await expect(addCommand("module", "a", ctx({ arch: "hexagonal" }))).rejects.toThrow(
      /Arsitektur tidak dikenal: "hexagonal"/
    );
    await expect(addCommand("module", "b", ctx({ orm: "mongodb" }))).rejects.toThrow(
      /ORM tidak dikenal: "mongodb"/
    );
  });

  test("requires a module name when --yes is set", async () => {
    await expect(addCommand("module", undefined, ctx({}))).rejects.toThrow(
      /Nama modul wajib ada\. Contoh: rakitin add module user --arch modular --orm none --yes/
    );
  });

  test("rejects an unsafe module name without writing anything", async () => {
    await expect(addCommand("module", "../evil", ctx({ arch: "simple" }))).rejects.toThrow(
      /Nama module tidak valid/
    );
    expect(fs.existsSync(path.join(global.tempDir, "..", "evil"))).toBe(false);
  });

  test("--no-auto-integrate leaves the main router untouched", async () => {
    const result = await addCommand(
      "module",
      "standalone",
      ctx({ arch: "simple", orm: "none", autoIntegrate: false })
    );

    expect(result.created).not.toContain("app/routes/index.js");
    expect(exists("app/routes/index.js")).toBe(false);
    expect(result.nextSteps.join(" ")).toMatch(/rakitin integrate/);
  });

  test("a real ORM replaces the placeholder model with the generated one (F-2 guard)", async () => {
    const result = await addCommand(
      "module",
      "invoice",
      ctx({ arch: "modular", orm: "sequelize" })
    );

    const modelPath = "app/modules/invoice/models/invoice.model.js";
    expect(result.created.filter((entry) => entry === modelPath)).toHaveLength(1);
    // The arch placeholder is gone: this is the real Sequelize model.
    expect(read(modelPath)).toContain("module.exports = Invoice;");
    expect(read(modelPath)).toContain("sequelize.define(");
    expect(read(modelPath)).not.toContain("in-memory store");
    expect(result.created).toContain("app/shared/config/database.js");
    expect(result.data.orm).toBe("Sequelize");
  });

  test("is idempotent: a rerun creates nothing and reports every file as skipped", async () => {
    await addCommand("module", "ledger", ctx({ arch: "simple", orm: "none" }));
    const second = await addCommand("module", "ledger", ctx({ arch: "simple", orm: "none" }));

    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual(
      expect.arrayContaining([
        "app/modules/ledger/ledger.controller.js",
        "app/modules/ledger/ledger.service.js",
        "app/modules/ledger/ledger.router.js",
      ])
    );
  });

  test("dry-run plans every write and touches no disk", async () => {
    safety.beginPlan();

    const result = await addCommand("module", "ghost", ctx({ arch: "modular", orm: "mongoose" }));

    expect(safety.isDryRun()).toBe(true);
    expect(exists("app/modules/ghost")).toBe(false);
    expect(exists("app/routes/index.js")).toBe(false);
    expect(exists(".env.example")).toBe(false);
    expect(exists("app/shared/config/db.js")).toBe(false);

    const plan = safety.getPlan();
    const ops = plan.map((entry) => entry.op);
    expect(ops.length).toBeGreaterThan(0);
    expect(ops.every((op) => ["create", "overwrite", "mkdir", "install"].includes(op))).toBe(true);
    expect(plan.every((entry) => path.isAbsolute(entry.path))).toBe(true);
    expect(plan.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        abs("app/modules/ghost/controllers/ghost.controller.js"),
        abs("app/modules/ghost/models/ghost.model.js"),
        abs("app/shared/config/db.js"),
        abs(".env.example"),
      ])
    );
    // The module's router file is only planned, so wiring legitimately has
    // nothing on disk to mount yet; the next step says so.
    expect(plan.map((entry) => entry.path)).not.toContain(abs("app/routes/index.js"));
    expect(result.nextSteps.join(" ")).toMatch(/rakitin integrate/);
    // Dry-run output is reported as planned work, not as created files.
    expect(result.ok).toBe(true);
  });

  test("ensureDependencies is a no-op under --no-install (no child process)", async () => {
    const execSpy = installer.internals.execCommand;

    const result = await addCommand(
      "module",
      "deps-off",
      ctx({ arch: "simple", orm: "sequelize" })
    );

    expect(execSpy).not.toHaveBeenCalled();
    expect(result.data.install).toEqual({
      success: true,
      installed: [],
      skipped: ["sequelize", "mysql2"],
      failed: [],
    });
  });

  test("ensureDependencies is a no-op while a dry-run plan is active", async () => {
    const execSpy = installer.internals.execCommand;
    safety.beginPlan();

    const result = await ensureDependencies(["module:sequelize"], {
      install: true,
      root: global.tempDir,
    });

    expect(execSpy).not.toHaveBeenCalled();
    expect(result.installed).toEqual([]);
    expect(result.skipped).toEqual(["sequelize", "mysql2"]);
    expect(result.success).toBe(true);
  });
});

describe("add middleware / config", () => {
  afterEach(() => safety.resetPlan());

  test("writes the requested middleware file", async () => {
    const result = await addCommand("middleware", "auth", ctx());

    expect(result.ok).toBe(true);
    expectRelativeAndOnDisk(result.created);
    expect(result.created).toEqual(["app/shared/middlewares/auth.middleware.js"]);
    expect(result.data.name).toBe("auth");
  });

  test("rejects an unknown middleware kind", async () => {
    await expect(addCommand("middleware", "nope", ctx())).rejects.toThrow(
      /Jenis middleware tidak dikenal: "nope"\. Pilihan: custom, auth, logger, error, request-time\./
    );
  });

  test("requires a middleware kind when --yes is set", async () => {
    await expect(addCommand("middleware", undefined, ctx())).rejects.toThrow(
      /Jenis middleware wajib ada\. Contoh: rakitin add middleware auth --yes/
    );
  });

  test("adds config jwt and merges .env.example exactly once", async () => {
    const first = await addCommand("config", "jwt", ctx());

    expect(first.created).toEqual(
      expect.arrayContaining(["app/shared/config/jwt.config.js", ".env.example"])
    );
    const env = read(".env.example");
    expect(env).toContain("# JWT CONFIG");
    expect(env).toContain("JWT_SECRET=");
    expect(read("app/shared/config/jwt.config.js")).toContain("// Config: JWT");

    const second = await addCommand("config", "jwt", ctx());

    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual(
      expect.arrayContaining(["app/shared/config/jwt.config.js", ".env.example"])
    );
    expect(read(".env.example")).toBe(env);
  });

  test("rejects an unknown config kind", async () => {
    await expect(addCommand("config", "nope", ctx())).rejects.toThrow(
      /Jenis config tidak dikenal: "nope"/
    );
  });

  test("dry-run creates neither the config file nor .env.example", async () => {
    safety.beginPlan();

    const result = await addCommand("config", "redis", ctx());

    expect(result.ok).toBe(true);
    expect(exists("app/shared/config/redis.config.js")).toBe(false);
    expect(exists(".env.example")).toBe(false);
    expect(safety.getPlan().map((e) => e.op)).toEqual(["create", "create"]);
    expect(safety.getPlan().map((e) => e.path)).toEqual(
      expect.arrayContaining([
        abs("app/shared/config/redis.config.js"),
        abs(".env.example"),
      ])
    );
  });
});
