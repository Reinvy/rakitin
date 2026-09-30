/**
 * lib/installer.js - behavior tests.
 *
 * No real child process ever runs here: `child_process` is globally mocked
 * (tests/setup.js) and every execution path is routed through the
 * injectable seams `internals.spawn` / `internals.execCommand`.
 */

const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");
const installer = require("../../lib/installer");

const { PACKAGE_MANAGERS, internals } = installer;

/** Resolved value every stubbed execution returns. */
const OK = { success: true, stdout: "", stderr: "", code: 0 };

function execError(stderr) {
  const error = new Error("Command failed with exit code 1");
  error.stderr = stderr;
  error.code = 1;
  return error;
}

/** A child_process-like object that emits `close` on the next tick. */
function fakeChild(code = 0) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => child.emit("close", code));
  return child;
}

describe("installer", () => {
  beforeAll(() => {
    // Install failures are asserted through the returned envelope, not logs.
    require("../../lib/utils/logger").setLevel("silent");
  });

  afterAll(() => {
    require("../../lib/utils/logger").setLevel("info");
  });

  beforeEach(() => {
    internals.execCommand = jest.fn().mockResolvedValue(OK);
    internals.isPackageInstalled = jest.fn().mockReturnValue(false);
  });

  describe("PACKAGE_MANAGERS", () => {
    test("exposes exactly npm, pnpm, yarn and bun", () => {
      expect(Object.keys(PACKAGE_MANAGERS).sort()).toEqual([
        "bun",
        "npm",
        "pnpm",
        "yarn",
      ]);
    });

    test.each([
      ["npm", { saveDev: false, silent: false }, { command: "npm", args: ["install", "--save", "lodash"] }],
      ["npm", { saveDev: true, silent: true }, { command: "npm", args: ["install", "--save-dev", "--silent", "lodash"] }],
      ["pnpm", { saveDev: false, silent: false }, { command: "pnpm", args: ["add", "lodash"] }],
      ["pnpm", { saveDev: true, silent: true }, { command: "pnpm", args: ["add", "-D", "--silent", "lodash"] }],
      ["yarn", { saveDev: false, silent: false }, { command: "yarn", args: ["add", "lodash"] }],
      ["yarn", { saveDev: true, silent: true }, { command: "yarn", args: ["add", "--dev", "--silent", "lodash"] }],
      ["bun", { saveDev: false, silent: false }, { command: "bun", args: ["add", "lodash"] }],
      ["bun", { saveDev: true, silent: true }, { command: "bun", args: ["add", "-d", "--silent", "lodash"] }],
    ])("%s install() builds { command, args } (saveDev=%o)", (pm, options, expected) => {
      const spec = PACKAGE_MANAGERS[pm].install(["lodash"], options);
      expect(spec).toEqual(expected);
      // Never a shell string: the package spec stays a discrete argv entry.
      expect(typeof spec.command).toBe("string");
      expect(Array.isArray(spec.args)).toBe(true);
      expect(spec.args.join(" ")).not.toContain("&&");
    });
  });

  describe("isPackageInstalled", () => {
    test("detects a package present in <root>/node_modules", () => {
      const root = path.join(global.tempDir, "with-nm");
      fs.mkdirSync(path.join(root, "node_modules", "@prisma", "client"), {
        recursive: true,
      });
      // Version specs and scoped names are reduced to the bare package name.
      expect(installer.isPackageInstalled("@prisma/client@^7", root)).toBe(true);
      expect(installer.isPackageInstalled("missing-pkg", root)).toBe(false);
    });

    test("detects a package declared in <root>/package.json", () => {
      const root = path.join(global.tempDir, "with-pkgjson");
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify({ name: "t", devDependencies: { jest: "^29" } }),
        "utf8"
      );
      expect(installer.isPackageInstalled("jest@^29", root)).toBe(true);
      expect(installer.isPackageInstalled("supertest", root)).toBe(false);
    });
  });

  describe("getPackageManager", () => {
    test("honors an explicit root instead of process.cwd()", () => {
      const root = path.join(global.tempDir, "pnpm-project");
      fs.mkdirSync(root, { recursive: true });
      fs.writeFileSync(path.join(root, "pnpm-lock.yaml"), "", "utf8");

      expect(installer.getPackageManager(root)).toBe("pnpm");
      // process.cwd() has no lockfile -> the default is npm, proving the
      // explicit root (not cwd) was consulted.
      expect(installer.getPackageManager()).toBe("npm");
    });

    test("detects yarn, bun and npm lockfiles", () => {
      const cases = [
        ["yarn.lock", "yarn"],
        ["bun.lockb", "bun"],
        ["package-lock.json", "npm"],
      ];
      for (const [lockfile, expected] of cases) {
        const root = path.join(global.tempDir, `pm-${expected}`);
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(path.join(root, lockfile), "", "utf8");
        expect(installer.getPackageManager(root)).toBe(expected);
      }
    });
  });

  describe("execCommand", () => {
    test("spawns with { command, args } and shell:false", async () => {
      internals.spawn = jest.fn(() => fakeChild(0));

      const result = await installer.execCommand({
        command: "npm",
        args: ["install", "--save", "lodash"],
      });

      expect(internals.spawn).toHaveBeenCalledTimes(1);
      const [command, args, options] = internals.spawn.mock.calls[0];
      expect(command).toBe("npm");
      expect(args).toEqual(["install", "--save", "lodash"]);
      expect(options).toMatchObject({ shell: false });
      expect(result.code).toBe(0);
    });

    test("rejects a command string containing shell metacharacters", () => {
      expect(() => installer.execCommand("npm install foo && rm -rf /")).toThrow(
        'Perintah mengandung karakter shell yang tidak diizinkan: "npm install foo && rm -rf /". Gunakan bentuk { command, args }.'
      );
      expect(() => installer.execCommand("npm install $HOME/*")).toThrow(
        /karakter shell yang tidak diizinkan/
      );
    });

    test("rejects a non-string, non-object spec", () => {
      expect(() => installer.execCommand(42)).toThrow(/Perintah tidak valid/);
    });
  });

  describe("isRetriableError", () => {
    test.each([
      "npm ERR! code EAI_AGAIN",
      "ETIMEDOUT",
      "ECONNRESET",
      "getaddrinfo ENOTFOUND registry.npmjs.org",
      "HTTP 429 Too Many Requests",
      "503 Service Unavailable",
    ])("retries transport/registry failure: %s", (stderr) => {
      expect(installer.isRetriableError(execError(stderr))).toBe(true);
    });

    test.each(["EACCES: permission denied", "ENOENT: no such file", "EUSAGE"])(
      "never retries deterministic failure: %s",
      (stderr) => {
        expect(installer.isRetriableError(execError(stderr))).toBe(false);
      }
    );

    test("does not retry a plain non-zero exit", () => {
      expect(installer.isRetriableError(execError(""))).toBe(false);
    });
  });

  describe("executeWithRetry", () => {
    test("retries a transport failure then succeeds", async () => {
      const execCommand = jest
        .fn()
        .mockRejectedValueOnce(execError("ECONNRESET"))
        .mockRejectedValueOnce(execError("EAI_AGAIN"))
        .mockResolvedValue(OK);
      internals.execCommand = execCommand;

      const result = await installer.executeWithRetry(
        { command: "npm", args: ["install", "lodash"] },
        { maxRetries: 3, baseDelay: 1, maxDelay: 2, backoffMultiplier: 2 }
      );

      expect(result.success).toBe(true);
      expect(execCommand).toHaveBeenCalledTimes(3);
    });

    test("gives up immediately on a deterministic failure", async () => {
      const execCommand = jest.fn().mockRejectedValue(execError("EACCES: permission denied"));
      internals.execCommand = execCommand;

      const result = await installer.executeWithRetry(
        { command: "npm", args: ["install", "lodash"] },
        { maxRetries: 3, baseDelay: 1, maxDelay: 2 }
      );

      expect(result.success).toBe(false);
      expect(result.stderr).toMatch(/EACCES/);
      expect(execCommand).toHaveBeenCalledTimes(1);
    });

    test("stops after maxRetries for repeated transport failures", async () => {
      const execCommand = jest.fn().mockRejectedValue(execError("ETIMEDOUT"));
      internals.execCommand = execCommand;

      const result = await installer.executeWithRetry(
        { command: "npm", args: ["install", "lodash"] },
        { maxRetries: 2, baseDelay: 1, maxDelay: 2, backoffMultiplier: 1 }
      );

      expect(result.success).toBe(false);
      expect(execCommand).toHaveBeenCalledTimes(3); // 1 attempt + 2 retries
    });
  });

  describe("installIfNeeded", () => {
    test("no-ops on an empty package list", async () => {
      const result = await installer.installIfNeeded([]);

      expect(result).toEqual({ success: true, installed: [], skipped: [], failed: [] });
      expect(internals.execCommand).not.toHaveBeenCalled();
    });

    test("splits already-installed packages into skipped", async () => {
      internals.isPackageInstalled = jest.fn((pkg) => pkg === "express");
      internals.execCommand = jest.fn().mockResolvedValue(OK);

      const result = await installer.installIfNeeded(["express", "lodash"], {
        silent: true,
        packageManager: "npm",
        root: global.tempDir,
      });

      expect(result).toEqual({
        success: true,
        installed: ["lodash"],
        skipped: ["express"],
        failed: [],
      });
      const [spec, options] = internals.execCommand.mock.calls[0];
      expect(spec).toEqual({
        command: "npm",
        args: ["install", "--save", "--silent", "lodash"],
      });
      expect(options.cwd).toBe(global.tempDir);
    });

    test("installs as a dev dependency when requested", async () => {
      internals.execCommand = jest.fn().mockResolvedValue(OK);

      await installer.installIfNeeded(["jest@^29", "supertest"], {
        isDev: true,
        silent: true,
        packageManager: "pnpm",
        root: global.tempDir,
      });

      expect(internals.execCommand.mock.calls[0][0]).toEqual({
        command: "pnpm",
        args: ["add", "-D", "--silent", "jest@^29", "supertest"],
      });
    });

    test("skips installation entirely when every package is present", async () => {
      internals.isPackageInstalled = jest.fn().mockReturnValue(true);

      const result = await installer.installIfNeeded(["sequelize"], { silent: true });

      expect(result.installed).toEqual([]);
      expect(result.skipped).toEqual(["sequelize"]);
      expect(internals.execCommand).not.toHaveBeenCalled();
    });

    test("fails fast without retrying for an unknown package manager", async () => {
      internals.execCommand = jest.fn().mockResolvedValue(OK);

      const result = await installer.installIfNeeded(["lodash"], {
        packageManager: "poetry",
        silent: true,
      });

      expect(result.success).toBe(false);
      expect(result.failed).toEqual(["lodash"]);
      expect(result.installed).toEqual([]);
      expect(internals.execCommand).not.toHaveBeenCalled();
    });

    test("reports failure once for a deterministic install error", async () => {
      internals.execCommand = jest.fn().mockRejectedValue(execError("EACCES: permission denied"));

      const result = await installer.installIfNeeded(["lodash"], {
        silent: true,
        packageManager: "npm",
        root: global.tempDir,
      });

      expect(result.success).toBe(false);
      expect(result.failed).toEqual(["lodash"]);
      expect(result.installed).toEqual([]);
      expect(internals.execCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe("installProjectDependencies", () => {
    test("fails fast for an unknown package manager", async () => {
      internals.execCommand = jest.fn().mockResolvedValue(OK);

      const result = await installer.installProjectDependencies({
        packageManager: "poetry",
      });

      expect(result.success).toBe(false);
      expect(internals.execCommand).not.toHaveBeenCalled();
    });

    test("runs <pm> install without shell interpolation", async () => {
      internals.execCommand = jest.fn().mockResolvedValue(OK);

      const result = await installer.installProjectDependencies({
        packageManager: "npm",
        silent: true,
        root: global.tempDir,
      });

      expect(result.success).toBe(true);
      expect(internals.execCommand.mock.calls[0][0]).toEqual({
        command: "npm",
        args: ["install", "--silent"],
      });
    });
  });
});
