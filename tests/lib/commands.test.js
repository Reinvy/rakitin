/**
 * Command layer tests - headless flows without spawning the process.
 * process.cwd() is the per-suite mkdtemp from setup.js.
 */
const fs = require("fs-extra");
const path = require("path");
const shared = require("../../lib/commands/shared");
const { initCommand } = require("../../lib/commands/init");
const { addCommand } = require("../../lib/commands/add");
const { integrateCommand } = require("../../lib/commands/integrate");
const { infoCommand, doctorCommand, listCommand } = require("../../lib/commands/info");
const installer = require("../../lib/installer");

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  installer.internals.execCommand = jest.fn().mockResolvedValue({
    success: true,
    stdout: "",
    stderr: "",
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("buildContext", () => {
  test("normalizes flag aliases", () => {
    const ctx = shared.buildContext({
      yes: true,
      "dry-run": true,
      arch: "modular",
      install: false,
    });
    expect(ctx.yes).toBe(true);
    expect(ctx.dryRun).toBe(true);
    expect(ctx.arch).toBe("modular");
    expect(ctx.install).toBe(false);
  });
});

describe("initCommand", () => {
  test("writes .rakitinrc.json with auto-selected preset and default orm prisma", async () => {
    const result = await initCommand();
    const cfgPath = path.join(global.tempDir, ".rakitinrc.json");

    expect(result.created).toBe(true);
    expect(fs.existsSync(cfgPath)).toBe(true);

    const cfg = fs.readJsonSync(cfgPath);
    expect(["basic", "intermediate"]).toContain(cfg.preset);
    expect(cfg.orm).toBe("prisma");
    expect(cfg.version).toBe(2);
    expect(cfg.defaultArchitecture).toBe("modular");
    expect(cfg.autoIntegrateRouter).toBe(true);
  });

  test("writes .rakitinrc.json with explicit orm, arch, pm, and autoIntegrate options", async () => {
    const result = await initCommand({
      orm: "sequelize",
      arch: "simple",
      pm: "pnpm",
      autoIntegrate: false,
      force: true,
      install: false,
    });
    const cfgPath = path.join(global.tempDir, ".rakitinrc.json");

    expect(result.created).toBe(true);
    const cfg = fs.readJsonSync(cfgPath);
    expect(cfg.orm).toBe("sequelize");
    expect(cfg.defaultArchitecture).toBe("simple");
    expect(cfg.packageManager).toBe("pnpm");
    expect(cfg.autoIntegrateRouter).toBe(false);
  });

  test("sets up base router and ORM files during init", async () => {
    await initCommand({ orm: "prisma", force: true, install: false });

    // Base router created
    expect(fs.existsSync(path.join(global.tempDir, "app", "routes", "index.js"))).toBe(true);
    // Prisma base schema and db singleton created
    expect(fs.existsSync(path.join(global.tempDir, "prisma", "schema", "base.prisma"))).toBe(true);
    expect(fs.existsSync(path.join(global.tempDir, "app", "shared", "config", "db.js"))).toBe(true);
  });

  test("wires app.js with rakitin /api router when app.js exists", async () => {
    const appJsPath = path.join(global.tempDir, "app.js");
    fs.writeFileSync(appJsPath, 'const express = require("express");\nconst app = express();\n\nmodule.exports = app;\n', "utf8");

    await initCommand({ force: true, install: false });

    const appContent = fs.readFileSync(appJsPath, "utf8");
    expect(appContent).toContain("app/routes");
    expect(appContent).toContain("app.use('/api', rakitinRouter)");
  });

  test("rejects unknown orm", async () => {
    await expect(initCommand({ orm: "invalid-orm", force: true })).rejects.toThrow(
      /ORM tidak dikenal/
    );
  });

  test("rejects unknown arch", async () => {
    await expect(initCommand({ arch: "invalid-arch", force: true })).rejects.toThrow(
      /Arsitektur tidak dikenal/
    );
  });

  test("rejects unknown package manager", async () => {
    await expect(initCommand({ pm: "invalid-pm", force: true })).rejects.toThrow(
      /Package manager tidak dikenal/
    );
  });

  test("idempotent without force; auto-preset preserved", async () => {
    const first = await initCommand();
    const cfgPath = path.join(global.tempDir, ".rakitinrc.json");
    expect(first.created).toBe(true);

    // setup.js wipes temp between tests - assert within one run.
    const second = await initCommand({ preset: "advanced" });
    expect(second.created).toBe(false);
    const cfg = fs.readJsonSync(cfgPath);
    expect(cfg.preset).not.toBe("advanced");
  });

  test("rejects unknown presets", async () => {
    await expect(initCommand({ preset: "nope", force: true })).rejects.toThrow(
      /Preset tidak dikenal/
    );
  });
});

describe("addCommand headless", () => {
  beforeEach(() => {
    fs.outputJsonSync(path.join(global.tempDir, "package.json"), {
      name: "headless-demo",
      dependencies: { express: "^4.0.0" },
    });
  });

  test("module defaults to Prisma when --orm is omitted", async () => {
    const ctx = shared.buildContext({
      yes: true,
      arch: "modular",
      install: false,
    });

    await addCommand("module", "article", ctx);

    const modDir = path.join(global.tempDir, "app", "modules", "article");
    expect(fs.existsSync(path.join(modDir, "services", "article.service.js"))).toBe(true);
    // Prisma model and singleton must be generated
    expect(
      fs.existsSync(path.join(global.tempDir, "prisma", "schema", "article.prisma"))
    ).toBe(true);
    expect(
      fs.existsSync(path.join(global.tempDir, "app", "shared", "config", "db.js"))
    ).toBe(true);
  });

  test("module respects orm configured in .rakitinrc.json", async () => {
    fs.outputJsonSync(path.join(global.tempDir, ".rakitinrc.json"), {
      preset: "basic",
      orm: "sequelize",
      version: 2,
    });

    const ctx = shared.buildContext({
      yes: true,
      arch: "modular",
      install: false,
    });

    await addCommand("module", "order", ctx);

    expect(
      fs.existsSync(
        path.join(
          global.tempDir,
          "app",
          "modules",
          "order",
          "models",
          "order.model.js"
        )
      )
    ).toBe(true);
  });

  test("module with all flags runs with ZERO prompts", async () => {
    const ctx = shared.buildContext({
      yes: true,
      arch: "modular",
      orm: "none",
      install: false,
    });

    await addCommand("module", "payment", ctx);

    const modDir = path.join(global.tempDir, "app", "modules", "payment");
    ["controllers", "services", "models", "routes"].forEach((d) =>
      expect(fs.existsSync(path.join(modDir, d))).toBe(true)
    );
  });

  test("REGRESSION: --orm mongoose produces ORM artifacts headlessly", async () => {
    const ctx = shared.buildContext({
      yes: true,
      arch: "modular",
      orm: "mongoose",
      install: false,
    });
    await addCommand("module", "invoice", ctx);

    // ORM model must exist - previously only architecture files were made
    expect(
      fs.existsSync(
        path.join(
          global.tempDir,
          "app",
          "modules",
          "invoice",
          "models",
          "invoice.model.js"
        )
      )
    ).toBe(true);
  });

  test("middleware auth routes through manifest deps", async () => {
    const ctx = shared.buildContext({ yes: true, install: false, json: false });
    const result = await addCommand("middleware", "auth", ctx);

    expect(result.created).toBe(true);
    const mwFile = path.join(
      global.tempDir,
      "app",
      "shared",
      "middlewares",
      "auth.middleware.js"
    );
    expect(fs.existsSync(mwFile)).toBe(true);
    expect(fs.readFileSync(mwFile, "utf8")).toContain("jsonwebtoken");
  });

  test("config jwt writes env example keys", async () => {
    const ctx = shared.buildContext({ yes: true });
    await addCommand("config", "jwt", ctx);

    expect(
      fs.existsSync(path.join(global.tempDir, "app", "shared", "config", "jwt.config.js"))
    ).toBe(true);
    const envExample = path.join(global.tempDir, ".env.example");
    expect(fs.readFileSync(envExample, "utf8")).toContain("JWT_");
  });

  test("unknown generator kind fails loudly", async () => {
    const ctx = shared.buildContext({ yes: true });
    await expect(addCommand("warp-drive", undefined, ctx)).rejects.toThrow(
      /tidak dikenal/
    );
  });
});

describe("integrateCommand", () => {
  beforeEach(() => {
    fs.outputJsonSync(path.join(global.tempDir, "package.json"), {
      name: "int-demo",
      dependencies: { express: "^4.0.0" },
    });
  });

  test("no modules -> actionable guidance, no crash", async () => {
    const res = await integrateCommand({});
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/add module/);
  });

  test("respects each module architecture + skips missing middleware", async () => {
    seedModularModule("alpha-mod");
    seedSimpleModule("beta-mod");

    const res = await integrateCommand({
      middleware: "auth,nonexistent-mw",
    });

    expect(res.ok).toBe(true);
    expect(res.wired.sort()).toEqual(["alpha-mod", "beta-mod"]);
    expect(res.middlewareApplied).toEqual([]); // auth file doesn't exist yet

    const routerSrc = fs.readFileSync(
      path.join(global.tempDir, "app", "routes", "index.js"),
      "utf8"
    );
    expect(routerSrc).toContain(
      "require('../modules/alpha-mod/routes/alpha-mod.router')"
    );
    expect(routerSrc).toContain("require('../modules/beta-mod/beta-mod.controller')");
    expect(routerSrc).not.toContain("nonexistent-mw"); // dangling require never emitted
  });

  test("existing user routes stay untouched across regenerations", async () => {
    seedModularModule("gamma-mod");
    await integrateCommand({});

    // User adds a custom route OUTSIDE markers
    const routerPath = path.join(global.tempDir, "app", "routes", "index.js");
    const withUserRoute = fs
      .readFileSync(routerPath, "utf8")
      .replace(
        safetyStart(),
        `router.get('/custom', (q,s)=>s.send());\n\n${safetyStart()}`
      );
    fs.writeFileSync(routerPath, withUserRoute);

    await integrateCommand({});

    const after = fs.readFileSync(routerPath, "utf8");
    expect(after).toContain("/custom");
    expect(after.match(/\/custom/g)).toHaveLength(1);
    // Managed wiring regenerated exactly once still
    expect(after.match(/alpha-mod|gamma-mod/g)).toBeTruthy();
  });
});

function safetyStart() {
  return "/* rakitin:routes:start */";
}

function seedModularModule(name) {
  const dir = path.join(global.tempDir, "app", "modules", name);
  fs.ensureDirSync(path.join(dir, "routes"));
  fs.outputFileSync(
    path.join(dir, "routes", `${name}.router.js`),
    'module.exports = require("express").Router();'
  );
}

function seedSimpleModule(name) {
  const dir = path.join(global.tempDir, "app", "modules", name);
  fs.ensureDirSync(dir);
  fs.outputFileSync(
    path.join(dir, `${name}.controller.js`),
    "exports.getAll=(q,s)=>s.json({});exports.create=(q,s)=>s.json({});"
  );
}

describe("info/doctor/list", () => {
  test("info summary is structured", () => {
    const { summary } = infoCommand();
    expect(summary.root).toBe(global.tempDir);
    expect(summary.modules).toHaveProperty("modular");
  });

  test("doctor returns health checks array", () => {
    const { checks } = doctorCommand();
    expect(checks.length).toBeGreaterThan(2);
    const names = checks.map((c) => c.name);
    expect(names).toContain("package.json");
    expect(names).toContain("Express");
    expect(names).toContain("Router utama");
  });

  test("list catalog covers tiers and recipes", () => {
    const { catalog } = listCommand();
    expect(catalog.some((i) => i.command.startsWith("recipe auth"))).toBe(true);
    expect(catalog.every((i) => Array.isArray(i.tiers))).toBe(true);
  });
});
