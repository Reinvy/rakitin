/**
 * Tests for lib/commands/config.js (`rakitin config`)
 */
const fs = require("fs-extra");
const path = require("path");
const { configCommand } = require("../../lib/commands/config");

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("configCommand", () => {
  beforeEach(() => {
    fs.outputJsonSync(path.join(global.tempDir, ".rakitinrc.json"), {
      preset: "basic",
      orm: "prisma",
      defaultArchitecture: "modular",
      autoIntegrateRouter: true,
      packageManager: "npm",
      version: 2,
    });
  });

  test("list returns active configuration", async () => {
    const res = await configCommand("list", null, null, { cwd: global.tempDir });
    expect(res.ok).toBe(true);
    expect(res.config.orm).toBe("prisma");
    expect(res.config.defaultArchitecture).toBe("modular");
  });

  test("get returns specific config value", async () => {
    const res = await configCommand("get", "orm", null, { cwd: global.tempDir });
    expect(res.ok).toBe(true);
    expect(res.key).toBe("orm");
    expect(res.value).toBe("prisma");
  });

  test("get handles alias keys (e.g. arch -> defaultArchitecture)", async () => {
    const res = await configCommand("get", "arch", null, { cwd: global.tempDir });
    expect(res.ok).toBe(true);
    expect(res.key).toBe("defaultArchitecture");
    expect(res.value).toBe("modular");
  });

  test("get returns error for unknown key in json mode", async () => {
    const res = await configCommand("get", "nonExistentKey", null, { cwd: global.tempDir, json: true });
    expect(res.ok).toBe(false);
    expect(res.value).toBeUndefined();
  });

  test("set updates ORM in .rakitinrc.json", async () => {
    const res = await configCommand("set", "orm", "mongoose", { cwd: global.tempDir });
    expect(res.ok).toBe(true);
    expect(res.value).toBe("mongoose");

    const cfg = fs.readJsonSync(path.join(global.tempDir, ".rakitinrc.json"));
    expect(cfg.orm).toBe("mongoose");
  });

  test("set updates defaultArchitecture in .rakitinrc.json", async () => {
    const res = await configCommand("set", "arch", "simple", { cwd: global.tempDir });
    expect(res.ok).toBe(true);
    expect(res.value).toBe("simple");

    const cfg = fs.readJsonSync(path.join(global.tempDir, ".rakitinrc.json"));
    expect(cfg.defaultArchitecture).toBe("simple");
  });

  test("set updates autoIntegrateRouter boolean value", async () => {
    const res = await configCommand("set", "autoIntegrate", "false", { cwd: global.tempDir });
    expect(res.ok).toBe(true);
    expect(res.value).toBe(false);

    const cfg = fs.readJsonSync(path.join(global.tempDir, ".rakitinrc.json"));
    expect(cfg.autoIntegrateRouter).toBe(false);
  });

  test("set updates packageManager", async () => {
    const res = await configCommand("set", "pm", "pnpm", { cwd: global.tempDir });
    expect(res.ok).toBe(true);
    expect(res.value).toBe("pnpm");

    const cfg = fs.readJsonSync(path.join(global.tempDir, ".rakitinrc.json"));
    expect(cfg.packageManager).toBe("pnpm");
  });

  test("set rejects invalid ORM", async () => {
    await expect(configCommand("set", "orm", "invalid-orm", { cwd: global.tempDir })).rejects.toThrow(
      /ORM tidak valid/
    );
  });

  test("set rejects invalid architecture", async () => {
    await expect(configCommand("set", "arch", "invalid-arch", { cwd: global.tempDir })).rejects.toThrow(
      /Arsitektur tidak valid/
    );
  });

  test("set rejects invalid package manager", async () => {
    await expect(configCommand("set", "pm", "invalid-pm", { cwd: global.tempDir })).rejects.toThrow(
      /Package manager tidak valid/
    );
  });
});
