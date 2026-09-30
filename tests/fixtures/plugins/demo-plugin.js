/**
 * tests/fixtures/plugins/demo-plugin.js - Reference plugin (API v1).
 *
 * Exercises every plugin surface:
 *   - two generators (one writes through the safety layer, one is pure)
 *   - one command
 *   - every hook (recording into a module-level log, no I/O)
 *   - plugin-declared dependency kind
 *
 * Kept dependency-free on purpose so the fixture never triggers a real
 * install.
 */

const path = require("path");

/** Hook call log - inspectable in-process by tests. */
const hookLog = [];

/** Pure generator: no filesystem access at all. */
function generateSummary(args = {}) {
  return {
    created: [],
    skipped: [],
    data: {
      demoSummary: {
        thing: args.thing ?? null,
        name: args.name ?? null,
        root: args.root ?? null,
      },
    },
    message: "demo-summary: tidak menulis file apa pun.",
  };
}

/** Generator that writes one file through the safety layer. */
function generateGreeting(ctx) {
  const relative = "app/plugins/demo-greeting.txt";
  const absolute = path.join(ctx.root, relative);
  const result = ctx.safety.writeFileIfNotExistsSafe(
    absolute,
    "// dibuat oleh plugin demo\ndemo-greeting\n"
  );
  const bucket = result.skipped === "exists" ? "skipped" : "created";
  return {
    created: bucket === "created" ? [relative] : [],
    skipped: bucket === "skipped" ? [relative] : [],
  };
}

module.exports = {
  apiVersion: 1,
  name: "demo",
  version: "1.0.0",
  description: "Plugin demo untuk test plugin host rakitin",

  generators: {
    "demo-summary": {
      describe: "Ringkasan argumen tanpa menulis file",
      generate: async (ctx, args) => generateSummary({ ...args, root: ctx.root }),
    },
    "demo-greeting": {
      describe: "Menulis app/plugins/demo-greeting.txt via safety layer",
      generate: async (ctx) => generateGreeting(ctx),
    },
  },

  commands: [
    {
      name: "demo-hello",
      describe: "Command contoh dari plugin demo",
      builder: (y) => y,
      handler: async (argv, ctx) => ({
        ok: true,
        created: [],
        skipped: [],
        message: `halo dari plugin demo (root: ${ctx.root})`,
      }),
    },
  ],

  hooks: {
    preGenerate(ctx) {
      hookLog.push(`preGenerate:${ctx.command}`);
    },
    postGenerate(ctx) {
      hookLog.push(`postGenerate:${ctx.command}`);
    },
    preInstall(ctx) {
      hookLog.push(`preInstall:${ctx.command}`);
    },
    postInstall(ctx) {
      hookLog.push(`postInstall:${ctx.command}`);
    },
    onError(ctx, error) {
      hookLog.push(`onError:${error.message}`);
    },
  },

  dependencies: {
    "plugin:demo-summary": [],
    "plugin:demo-log": [],
  },

  /** Test-only inspection hook (ignored by the plugin registry). */
  hookLog,
};
