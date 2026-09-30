/**
 * Regression guards for the project detector, the safety layer
 * (plan/dry-run/backup/JSON/env contract) and the unified dependency manifest.
 */
const fs = require("fs-extra");
const path = require("path");

const { detectProject } = require("../../lib/project/detector");
const safety = require("../../lib/safety");
const manifest = require("../../lib/deps/manifest");
const { getPaths } = require("../../lib/constants");

afterEach(() => {
  safety.resetPlan();
  jest.restoreAllMocks();
});

describe("Project Detector", () => {
  test("detects empty directory safely", () => {
    const d = detectProject(global.tempDir);
    expect(d.isNpmProject).toBe(false);
    expect(d.hasExpress).toBe(false);
    expect(d.structure.modules).toEqual([]);
  });

  test("reads package.json, express, package manager & module inventory", () => {
    fs.outputJsonSync(path.join(global.tempDir, "package.json"), {
      name: "dummy-app",
      dependencies: { express: "^4.19.0", mongoose: "^8.0.0" },
    });

    // Seed one modular + one simple module
    const p = getPaths();
    const modMod = path.join(p.modulesPath, "alpha-mod");
    fs.ensureDirSync(path.join(modMod, "routes"));
    fs.outputFileSync(path.join(modMod, "routes", "alpha-mod.router.js"), "");
    const simMod = path.join(p.modulesPath, "beta-mod");
    fs.ensureDirSync(simMod);
    fs.outputFileSync(path.join(simMod, "beta-mod.controller.js"), "");

    const d = detectProject(global.tempDir);
    expect(d.isNpmProject).toBe(true);
    expect(d.packageName).toBe("dummy-app");
    expect(d.hasExpress).toBe(true);
    expect(d.ormsInstalled.Mongoose).toBe(true);
    expect(d.structure.modularCount).toBe(1);
    expect(d.structure.simpleCount).toBe(1);
    expect(d.structure.mixedArchitectures).toBe(true);
    expect(d.packageManager).toBe("npm");
  });

  test("a dangling symlink never aborts detection", () => {
    const p = getPaths();
    fs.ensureDirSync(p.modulesPath);
    fs.symlinkSync(path.join(p.modulesPath, "missing-target"), path.join(p.modulesPath, "ghost"));
    expect(() => detectProject(global.tempDir)).not.toThrow();
  });
});

describe("Safety Layer", () => {
  describe("dry-run plan mode", () => {
    test("records creates without touching disk", () => {
      safety.beginPlan();

      const target = path.join(global.tempDir, "plan-test", "new-file.js");
      const res = safety.writeFileIfNotExistsSafe(target, "x");

      expect(res.written).toBe(false);
      expect(safety.getPlan()).toEqual([{ op: "create", path: target }]);
      expect(fs.existsSync(target)).toBe(false);

      safety.resetPlan();
    });

    test("writes only after leaving dry-run", () => {
      safety.beginPlan();
      const target = path.join(global.tempDir, "later-write.js");

      safety.writeFileIfNotExistsSafe(target, "a"); // planned
      expect(fs.existsSync(target)).toBe(false);

      safety.setDryRun(false); // leave plan mode
      const res = safety.writeFileIfNotExistsSafe(target, "b");
      expect(res.written).toBe(true);
      expect(fs.readFileSync(target, "utf8")).toBe("b");
    });

    test("REGRESSION: resetPlan clears the latched dry-run flag", () => {
      safety.beginPlan();
      expect(safety.isDryRun()).toBe(true);

      safety.resetPlan();
      expect(safety.isDryRun()).toBe(false);

      const target = path.join(global.tempDir, "after-reset.js");
      const res = safety.writeFileIfNotExistsSafe(target, "real");
      expect(res.written).toBe(true);
      expect(fs.existsSync(target)).toBe(true);
    });

    test("REGRESSION: ensureDir does NOT leak folders during dry-run", () => {
      const utils = require("../../lib/utils");
      safety.beginPlan();

      const dir = path.join(global.tempDir, "leak-guard", "nested");
      utils.ensureDir(dir);

      // Planned, never created
      expect(fs.existsSync(dir)).toBe(false);
      expect(safety.getPlan()).toContainEqual({ op: "mkdir", path: dir });

      // Leaving dry-run makes it real again
      safety.setDryRun(false);
      utils.ensureDir(dir);
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  test("overwriteWithBackup preserves previous version and never clobbers .bak", () => {
    const target = path.join(global.tempDir, "with-backup.js");
    fs.outputFileSync(target, "v1");

    const first = safety.overwriteWithBackup(target, "v2");
    expect(first.backedUp).toBe(true);
    expect(fs.readFileSync(`${target}.bak`, "utf8")).toBe("v1");
    expect(fs.readFileSync(target, "utf8")).toBe("v2");

    const second = safety.overwriteWithBackup(target, "v3");
    expect(fs.readFileSync(`${target}.bak`, "utf8")).toBe("v1"); // untouched
    expect(fs.readFileSync(`${target}.bak.1`, "utf8")).toBe("v2");
    expect(fs.readFileSync(target, "utf8")).toBe("v3");
    expect(second.backupPath).toBe(`${target}.bak.1`);
  });

  test("updateJsonFile mutates through the safety layer with a backup", () => {
    const target = path.join(global.tempDir, "package.json");
    fs.outputJsonSync(target, { name: "demo", scripts: {} });

    const res = safety.updateJsonFile(target, (pkg) => ({
      ...pkg,
      scripts: { ...pkg.scripts, test: "jest" },
    }));

    expect(res.written).toBe(true);
    expect(JSON.parse(fs.readFileSync(target, "utf8")).scripts.test).toBe("jest");
    expect(JSON.parse(fs.readFileSync(`${target}.bak`, "utf8")).scripts).toEqual({});
  });

  test("updateJsonFile plans (no write) under dry-run", () => {
    const target = path.join(global.tempDir, "dry-package.json");
    fs.outputJsonSync(target, { name: "dry" });
    safety.beginPlan();

    safety.updateJsonFile(target, (pkg) => ({ ...pkg, extra: true }));

    expect(JSON.parse(fs.readFileSync(target, "utf8")).extra).toBeUndefined();
    expect(safety.getPlan().some((entry) => entry.op === "overwrite")).toBe(true);
  });

  test("mergeEnvExample appends a marked section exactly once", () => {
    const first = safety.mergeEnvExample(global.tempDir, "JWT CONFIG", "JWT_SECRET=x");
    expect(first.written).toBe(true);

    const second = safety.mergeEnvExample(global.tempDir, "JWT CONFIG", "JWT_SECRET=x");
    expect(second.written).toBe(false);
    expect(second.skipped).toBe("marker-exists");

    const env = fs.readFileSync(path.join(global.tempDir, ".env.example"), "utf8");
    expect(env.match(/# JWT CONFIG/g)).toHaveLength(1);
    expect(env).toContain("JWT_SECRET=x");
  });
});

describe("buildRoutesContent (marker injection)", () => {
  const ROUTE_LINES = "router.use('/user-profile', userProfileRouter);";

  test("creates a fresh marker-managed file when none exists", () => {
    const { content, action } = safety.buildRoutesContent(null, ROUTE_LINES);

    expect(action).toBe("create");
    expect(content.startsWith(safety.MAIN_ROUTER_HEADER)).toBe(true);
    expect(content).toContain(ROUTE_LINES);
    expect(content.trimEnd().endsWith("module.exports = router;")).toBe(true);
  });

  test("REGRESSION B10: user code above markers stays byte-identical", () => {
    const userCode = [
      "// MY PRECIOUS CUSTOM ROUTES",
      "router.get('/health', healthHandler);",
      "",
    ].join("\n");

    const first = safety.buildRoutesContent(null, ROUTE_LINES).content;
    // Simulate a user editing BEFORE the marked block:
    const editedByUser = first.replace(
      safety.ROUTES_BLOCK_START,
      `${userCode}\n${safety.ROUTES_BLOCK_START}`
    );

    const secondPass = safety.buildRoutesContent(
      editedByUser,
      "router.use('/new-module', newModuleRouter);"
    );

    expect(secondPass.action).toBe("inject");
    expect(secondPass.content.match(/MY PRECIOUS CUSTOM ROUTES/g)).toHaveLength(1);
    expect(secondPass.content).toContain("router.get('/health'");
    expect(secondPass.content).toContain("/new-module");
    expect(secondPass.content).not.toContain("'/user-profile', userProfileRouter");
  });

  test("marker-less legacy routers get injected without loss", () => {
    const legacy =
      "const express = require('express');\nconst r = 1;\nmodule.exports = r;\n";
    const { content, action } = safety.buildRoutesContent(legacy, ROUTE_LINES);

    expect(action).toBe("inject");
    expect(content).toContain("const r = 1;");
    expect(content).toContain(ROUTE_LINES);
    expect(content.indexOf(ROUTE_LINES)).toBeLessThan(
      content.lastIndexOf("module.exports")
    );
  });

  test("injection is IDEMPOTENT - repeated passes do not duplicate wiring", () => {
    let content = safety.buildRoutesContent(null, ROUTE_LINES).content;
    content = safety.buildRoutesContent(content, ROUTE_LINES).content;
    content = safety.buildRoutesContent(content, ROUTE_LINES).content;

    expect(content.match(/userProfileRouter/g)).toHaveLength(1);
    expect(content.match(/rakitin:routes:start/g)).toHaveLength(1);
    expect(content.match(/rakitin:routes:end/g)).toHaveLength(1);
  });
});

describe("Dependency Manifest", () => {
  test("resolves unique packages across kinds", () => {
    const { packages, devPackages, unknownKinds } = manifest.resolvePackagesForKinds([
      "middleware:auth",
      "middleware:auth",
      "validation:joi",
    ]);

    expect(packages.sort()).toEqual(["joi", "jsonwebtoken"]);
    expect(devPackages).toEqual([]);
    expect(unknownKinds).toEqual([]);
  });

  test("dev kinds land in devPackages", () => {
    expect(manifest.DEV_KINDS.has("test:dev")).toBe(true);
    const { packages, devPackages } = manifest.resolvePackagesForKinds(["test:dev"]);
    expect(packages).toEqual([]);
    expect(devPackages.sort()).toEqual(["jest@^29", "supertest"]);
  });

  test("reports unknown kinds instead of crashing", () => {
    const { packages, unknownKinds } = manifest.resolvePackagesForKinds(["made-up-kind"]);
    expect(packages).toEqual([]);
    expect(unknownKinds).toEqual(["made-up-kind"]);
  });

  test("ormToKind bridges ORM names and rejects unknown ones", () => {
    expect(manifest.ormToKind("Prisma")).toBe("module:prisma");
    expect(manifest.ormToKind("Mongoose")).toBe("module:mongoose");
    expect(manifest.ormToKind("none")).toBe("module:none");
    expect(() => manifest.ormToKind("Unknown")).toThrow(/ORM tidak dikenal/);
  });

  test("ensureDependencies is a no-op when install is false", async () => {
    const result = await manifest.ensureDependencies(["module:mongoose"], {
      install: false,
    });
    expect(result).toEqual({ success: true, installed: [], skipped: ["mongoose"], failed: [] });
  });

  test("ensureDependencies throws on an unknown kind", async () => {
    await expect(
      manifest.ensureDependencies(["made-up-kind"], { install: false })
    ).rejects.toThrow(/Kind dependency tidak dikenal/);
  });

  test("resolves prisma packages for module:prisma kind", () => {
    const { packages } = manifest.resolvePackagesForKinds(["module:prisma"]);
    expect(packages).toContain("@prisma/client");
    expect(packages).toContain("prisma");
    expect(packages).toContain("dotenv");
  });
});
