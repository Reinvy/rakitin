/**
 * Plugin host tests (`lib/plugins/**` + `lib/commands/plugin.js`).
 *
 * process.cwd() points at the per-suite mkdtemp from tests/setup.js; every
 * test that touches config uses its own temp project root so the suite has no
 * cross-test ordering coupling.
 */

const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const host = require("../../lib/plugins");
const { pluginCommand } = require("../../lib/commands/plugin");
const safety = require("../../lib/safety");
const { runWithPlugins } = require("../../lib/commands/shared");
const fixture = require("../fixtures/plugins/demo-plugin");

const FIXTURE = path.resolve(__dirname, "../fixtures/plugins/demo-plugin.js");

/** Fresh, isolated project root. */
function freshRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-plugins-"));
}

/** Context as `buildContext` would produce it for a project. */
function contextFor(root, plugins = []) {
  return { root, json: true, dryRun: false, configValues: { plugins } };
}

function writePluginFile(root, fileName, source) {
  const filePath = path.join(root, fileName);
  fs.writeFileSync(filePath, source, "utf8");
  return filePath;
}

beforeEach(() => {
  fixture.hookLog.length = 0;
  host.resetPlugins();
});

afterEach(() => {
  safety.resetPlan();
  host.resetPlugins();
});

describe("loadPlugins", () => {
  test("loads the fixture plugin with generators, commands and hooks", () => {
    const root = freshRoot();
    const { plugins, errors } = host.loadPlugins({
      root,
      config: { plugins: [FIXTURE] },
    });

    expect(errors).toEqual([]);
    expect(plugins).toHaveLength(1);
    expect(plugins[0]).toMatchObject({
      name: "demo",
      version: "1.0.0",
      entry: FIXTURE,
      resolved: FIXTURE,
    });
    expect(plugins[0].generators).toEqual(["demo-summary", "demo-greeting"]);
    expect(plugins[0].commands).toEqual(["demo-hello"]);
    expect(plugins[0].hooks).toEqual([
      "preGenerate",
      "postGenerate",
      "preInstall",
      "postInstall",
      "onError",
    ]);
  });

  test("skips a plugin with the wrong apiVersion and reports why", () => {
    const root = freshRoot();
    writePluginFile(
      root,
      "bad-api.js",
      'module.exports = { apiVersion: 2, name: "old" };\n'
    );

    const { plugins, errors } = host.loadPlugins({
      root,
      config: { plugins: ["./bad-api.js"] },
    });

    expect(plugins).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].entry).toBe("./bad-api.js");
    expect(errors[0].message).toContain("apiVersion 2");
  });

  test("skips a malformed plugin (no name)", () => {
    const root = freshRoot();
    writePluginFile(root, "nameless.js", "module.exports = { apiVersion: 1 };\n");

    const { plugins, errors } = host.loadPlugins({
      root,
      config: { plugins: ["./nameless.js"] },
    });

    expect(plugins).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('"name"');
  });

  test("a missing entry is an error record, never a throw", () => {
    const root = freshRoot();
    const { plugins, errors } = host.loadPlugins({
      root,
      config: { plugins: ["./does-not-exist.js"] },
    });

    expect(plugins).toEqual([]);
    expect(errors).toHaveLength(1);
    expect(errors[0].entry).toBe("./does-not-exist.js");
    expect(errors[0].message).toContain('Tidak bisa memuat plugin "./does-not-exist.js"');
    expect(errors[0].message.split("\n")).toHaveLength(1);
  });

  test("a plugin that throws while requiring is reported, not rethrown", () => {
    const root = freshRoot();
    writePluginFile(root, "thrower.js", 'throw new Error("boom");\n');

    const { errors } = host.loadPlugins({ root, config: { plugins: ["./thrower.js"] } });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("boom");
  });

  test("non-string entries and esModule default exports are handled", () => {
    const root = freshRoot();
    writePluginFile(
      root,
      "esm-like.js",
      'module.exports = { __esModule: true, default: { apiVersion: 1, name: "esm-like" } };\n'
    );

    const { plugins, errors } = host.loadPlugins({
      root,
      config: { plugins: [42, "./esm-like.js"] },
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("Entri plugin tidak valid");
    expect(plugins.map((plugin) => plugin.name)).toEqual(["esm-like"]);
  });

  test("duplicate generator ids across plugins are reported", () => {
    const root = freshRoot();
    writePluginFile(
      root,
      "dup-a.js",
      'module.exports = { apiVersion: 1, name: "a", generators: { dup: { generate: async () => ({ created: [], skipped: [] }) } } };\n'
    );
    writePluginFile(
      root,
      "dup-b.js",
      'module.exports = { apiVersion: 1, name: "b", generators: { dup: { generate: async () => ({ created: [], skipped: [] }) } } };\n'
    );

    const { plugins, errors } = host.loadPlugins({
      root,
      config: { plugins: ["./dup-a.js", "./dup-b.js"] },
    });

    expect(plugins).toHaveLength(2);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('Generator "dup"');
  });
});

describe("getGenerators / getExtraKinds", () => {
  test("generators are keyed by id and extra kinds include plugin defaults", () => {
    const root = freshRoot();
    const context = contextFor(root, [FIXTURE]);

    const generators = host.getGenerators(context);
    expect(Object.keys(generators).sort()).toEqual(["demo-greeting", "demo-summary"]);
    expect(generators["demo-greeting"].plugin).toBe("demo");
    expect(typeof generators["demo-greeting"].generate).toBe("function");

    const kinds = host.getExtraKinds(context);
    expect(kinds["plugin:demo-greeting"]).toEqual([]);
    expect(kinds["plugin:demo-summary"]).toEqual([]);
    expect(kinds["plugin:demo-log"]).toEqual([]);
  });

  test("registerKind extends the extra-kind map consumed by ensureDependencies", () => {
    const root = freshRoot();
    const context = contextFor(root, [FIXTURE]);
    const ctx = host.buildPluginContext(context, { command: "add" });

    expect(ctx.registerKind("plugin:pino-log", ["pino"])).toBe(true);
    expect(ctx.registerKind("plugin:pino-log", ["pino", "pino-pretty"])).toBe(true);
    expect(host.getExtraKinds(context)["plugin:pino-log"]).toEqual(["pino", "pino-pretty"]);
    expect(ctx.registerKind("", [])).toBe(false);
  });
});

describe("buildPluginContext", () => {
  test("never throws on a partial context and exposes the documented shape", () => {
    const emptyRoot = freshRoot();
    const ctx = host.buildPluginContext({ root: emptyRoot }, { command: "add", thing: "x" });

    expect(ctx.root).toBe(emptyRoot);
    expect(ctx.command).toBe("add");
    expect(ctx.args).toMatchObject({ command: "add", thing: "x" });
    expect(ctx.json).toBe(false);
    expect(ctx.dryRun).toBe(false);
    expect(ctx.plan).toEqual([]);
    expect(ctx.logger).toBe(require("../../lib/utils/logger"));
    expect(ctx.safety).toBe(require("../../lib/safety"));
    expect(ctx.naming).toBe(require("../../lib/naming"));
    expect(typeof ctx.registerKind).toBe("function");

    expect(() => host.buildPluginContext()).not.toThrow();
    expect(() => host.buildPluginContext(null, null)).not.toThrow();
  });

  test("dryRun follows the safety plan state", () => {
    const root = freshRoot();
    safety.beginPlan();
    const ctx = host.buildPluginContext({ root }, {});
    expect(ctx.dryRun).toBe(true);
    safety.resetPlan();
  });
});

describe("getHooks", () => {
  test("returns empty arrays for a project with no plugins (never throws)", () => {
    const emptyRoot = freshRoot();
    for (const context of [{ root: emptyRoot }, {}, undefined]) {
      const hooks = host.getHooks(context);
      expect(Object.keys(hooks)).toEqual([
        "preGenerate",
        "postGenerate",
        "preInstall",
        "postInstall",
        "onError",
      ]);
      for (const name of Object.keys(hooks)) expect(hooks[name]).toEqual([]);
    }
  });

  test("flattens plugin hooks and fires them around a command body", async () => {
    const root = freshRoot();
    const context = contextFor(root, [FIXTURE]);

    const hooks = host.getHooks(context);
    expect(hooks.preGenerate).toHaveLength(1);
    expect(hooks.postGenerate).toHaveLength(1);
    expect(hooks.onError).toHaveLength(1);

    await expect(runWithPlugins(context, { command: "add" }, async () => "ok")).resolves.toBe("ok");
    expect(fixture.hookLog).toEqual(["preGenerate:add", "postGenerate:add"]);

    fixture.hookLog.length = 0;
    await expect(
      runWithPlugins(context, { command: "add" }, async () => {
        throw new Error("bang");
      })
    ).rejects.toThrow("bang");
    expect(fixture.hookLog).toEqual(["preGenerate:add", "onError:bang"]);
  });
});

describe("pluginCommand", () => {
  test("list on a project without plugins reports zero plugins and zero errors", async () => {
    const result = await pluginCommand("list", undefined, contextFor(freshRoot()));

    expect(result).toMatchObject({ ok: true, created: [], skipped: [] });
    expect(result.data.plugins).toEqual([]);
    expect(result.data.errors).toEqual([]);
  });

  test("add writes .rakitinrc.json once and then reports it as skipped", async () => {
    const root = freshRoot();

    const first = await pluginCommand("add", FIXTURE, contextFor(root));
    expect(first.ok).toBe(true);
    expect(first.created).toEqual([".rakitinrc.json"]);
    expect(first.skipped).toEqual([]);
    expect(fs.readJsonSync(path.join(root, ".rakitinrc.json"))).toEqual({ plugins: [FIXTURE] });

    const second = await pluginCommand("add", FIXTURE, contextFor(root));
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual([".rakitinrc.json"]);
  });

  test("add refuses an unresolvable entry without touching the config", async () => {
    const root = freshRoot();

    await expect(
      pluginCommand("add", "./nope.js", contextFor(root))
    ).rejects.toThrow('Plugin "./nope.js" tidak bisa di-resolve dari proyek ini.');
    expect(fs.existsSync(path.join(root, ".rakitinrc.json"))).toBe(false);
  });

  test("add does not register the same plugin through a second spec string", async () => {
    const root = freshRoot();
    fs.mkdirpSync(path.join(root, "plugins"));
    fs.copyFileSync(FIXTURE, path.join(root, "plugins/demo-plugin.js"));

    const first = await pluginCommand("add", "./plugins/demo-plugin.js", contextFor(root));
    expect(first.created).toEqual([".rakitinrc.json"]);

    const second = await pluginCommand("add", "./plugins/../plugins/demo-plugin.js", contextFor(root));
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual([".rakitinrc.json"]);
    expect(second.message).toContain("sudah terdaftar sebagai");
    expect(fs.readJsonSync(path.join(root, ".rakitinrc.json")).plugins).toEqual([
      "./plugins/demo-plugin.js",
    ]);
  });

  test("human-readable messages accompany list and info envelopes", async () => {
    const root = freshRoot();
    await pluginCommand("add", FIXTURE, contextFor(root));

    const list = await pluginCommand("list", undefined, contextFor(root));
    expect(list.message).toContain("1 plugin dimuat: demo@1.0.0");

    const info = await pluginCommand("info", "demo", contextFor(root));
    expect(info.message).toContain("demo@1.0.0");
    expect(info.message).toContain("demo-greeting");
  });

  test("list surfaces plugins declared in .rakitinrc.json and their load errors", async () => {
    const root = freshRoot();
    fs.writeJsonSync(path.join(root, ".rakitinrc.json"), {
      plugins: [FIXTURE, "./broken.js"],
    });

    const result = await pluginCommand("list", undefined, contextFor(root));

    expect(result.ok).toBe(true);
    expect(result.data.plugins).toHaveLength(1);
    expect(result.data.plugins[0]).toMatchObject({
      name: "demo",
      version: "1.0.0",
      generators: ["demo-summary", "demo-greeting"],
      commands: ["demo-hello"],
    });
    expect(result.data.errors).toHaveLength(1);
    expect(result.data.errors[0].entry).toBe("./broken.js");
  });

  test("list reads plugins declared in package.json#rakitin.plugins", async () => {
    const root = freshRoot();
    fs.writeJsonSync(path.join(root, "package.json"), {
      name: "t",
      version: "1.0.0",
      rakitin: { plugins: ["./does-not-exist.js"] },
    });

    const result = await pluginCommand("list", undefined, { root });

    expect(result.data.errors).toHaveLength(1);
    expect(result.data.errors[0].entry).toBe("./does-not-exist.js");
  });

  test("an unreadable .rakitinrc.json is reported as a load error, not a crash", async () => {
    const root = freshRoot();
    fs.writeFileSync(path.join(root, ".rakitinrc.json"), "{invalid json", "utf8");

    const result = await pluginCommand("list", undefined, { root });

    expect(result.ok).toBe(true);
    expect(result.data.plugins).toEqual([]);
    expect(result.data.errors).toHaveLength(1);
    expect(result.data.errors[0].entry).toBe(".rakitinrc.json");
    expect(result.data.errors[0].message).toContain("bukan JSON yang valid");
  });

  test("info describes one plugin and throws for unknown names", async () => {
    const root = freshRoot();
    await pluginCommand("add", FIXTURE, contextFor(root));

    const info = await pluginCommand("info", "demo", contextFor(root));
    expect(info.ok).toBe(true);
    expect(info.data.plugin).toMatchObject({
      name: "demo",
      description: "Plugin demo untuk test plugin host rakitin",
      generators: ["demo-summary", "demo-greeting"],
      commands: ["demo-hello"],
      hooks: ["preGenerate", "postGenerate", "preInstall", "postInstall", "onError"],
    });

    await expect(pluginCommand("info", "nope", contextFor(root))).rejects.toThrow(
      'Plugin "nope" tidak ditemukan.'
    );
  });

  test("remove by plugin name drops the config entry; unknown names are a no-op", async () => {
    const root = freshRoot();
    await pluginCommand("add", FIXTURE, contextFor(root));

    const removed = await pluginCommand("remove", "demo", contextFor(root));
    expect(removed.ok).toBe(true);
    expect(removed.created).toEqual([".rakitinrc.json"]);
    expect(fs.readJsonSync(path.join(root, ".rakitinrc.json")).plugins).toBeUndefined();

    const listed = await pluginCommand("list", undefined, contextFor(root));
    expect(listed.data.plugins).toEqual([]);

    const noop = await pluginCommand("remove", "demo", contextFor(root));
    expect(noop.ok).toBe(true);
    expect(noop.created).toEqual([]);
    expect(noop.skipped).toEqual([".rakitinrc.json"]);
  });

  test("remove points at package.json when the plugin is declared there", async () => {
    const root = freshRoot();
    fs.writeJsonSync(path.join(root, "package.json"), {
      name: "t",
      version: "1.0.0",
      rakitin: { plugins: [FIXTURE] },
    });

    const result = await pluginCommand("remove", "demo", { root });

    expect(result.ok).toBe(true);
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual([".rakitinrc.json"]);
    expect(result.message).toContain("package.json#rakitin.plugins");
    expect(fs.existsSync(path.join(root, ".rakitinrc.json"))).toBe(false);
  });

  test("dry-run plans the config edit without writing it", async () => {
    const root = freshRoot();
    safety.beginPlan();

    const result = await pluginCommand("add", FIXTURE, contextFor(root));

    expect(result.created).toEqual([".rakitinrc.json"]);
    expect(result.plan.length).toBeGreaterThan(0);
    expect(result.plan.some((entry) => entry.op === "create")).toBe(true);
    expect(fs.existsSync(path.join(root, ".rakitinrc.json"))).toBe(false);
  });

  test("rejects unknown actions and missing specs", async () => {
    const root = freshRoot();

    await expect(pluginCommand("bogus", undefined, contextFor(root))).rejects.toThrow(
      'Aksi plugin tidak dikenal: "bogus". Pilihan: list, add, remove, info.'
    );
    await expect(pluginCommand("add", undefined, contextFor(root))).rejects.toThrow(
      "Argumen plugin wajib ada."
    );
    await expect(pluginCommand("remove", "  ", contextFor(root))).rejects.toThrow(
      "Argumen plugin wajib ada."
    );
  });
});

describe("plugin generators", () => {
  test("a plugin generator writes through the safety layer and reports buckets", async () => {
    const root = freshRoot();
    const context = contextFor(root, [FIXTURE]);
    const generator = host.getGenerators(context)["demo-greeting"];

    const first = await generator.generate(
      host.buildPluginContext(context, { command: "add", thing: "demo-greeting" }),
      { command: "add", thing: "demo-greeting" }
    );
    expect(first).toEqual({ created: ["app/plugins/demo-greeting.txt"], skipped: [] });
    expect(fs.existsSync(path.join(root, "app/plugins/demo-greeting.txt"))).toBe(true);

    const second = await generator.generate(host.buildPluginContext(context, {}), {});
    expect(second).toEqual({ created: [], skipped: ["app/plugins/demo-greeting.txt"] });
  });

  test("in dry-run a plugin generator writes nothing but reports the create", async () => {
    const root = freshRoot();
    const context = contextFor(root, [FIXTURE]);
    const generator = host.getGenerators(context)["demo-greeting"];
    safety.beginPlan();

    const result = await generator.generate(host.buildPluginContext(context, {}), {});

    expect(result.created).toEqual(["app/plugins/demo-greeting.txt"]);
    expect(fs.existsSync(path.join(root, "app/plugins/demo-greeting.txt"))).toBe(false);
  });
});
