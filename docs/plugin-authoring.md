# Plugin Authoring (API v1)

rakitin can load out-of-tree plugins that contribute **generators**,
**commands**, **hooks**, and **dependency kinds**. A plugin is a plain
CommonJS module; loading is best-effort and a broken plugin never aborts the
running command.

Reference implementation: [`tests/fixtures/plugins/demo-plugin.js`](../tests/fixtures/plugins/demo-plugin.js)
exercises every surface (two generators, one command, all five hooks, a
declared dependency kind) and is dependency-free on purpose.

---

## 1. Registering a plugin

Declare it in `.rakitinrc.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/Reinvy/rakitin/main/rakitin.schema.json",
  "version": 3,
  "plugins": ["./plugins/audit.js", "rakitin-plugin-metrics"]
}
```

Or from the CLI (mutates the config through the safety layer):

```bash
rakitin plugin add ./plugins/audit.js
rakitin plugin add rakitin-plugin-metrics
```

Resolution (`lib/plugins/loader.js`):

| Entry shape | Resolved with |
| --- | --- |
| `./relative/path` or absolute | `require.resolve(path.resolve(root, entry))` — against the **project root**, not the CLI's directory |
| bare specifier (`some-plugin`, `@scope/pkg`) | `require.resolve(entry, { paths: [root] })` — the project's `node_modules` chain |

`plugin add` resolves the entry **before** mutating the config, so a typo
fails with `Plugin "<entry>" tidak bisa di-resolve dari proyek ini.` and the
config is left untouched.

The plugin list also honors `package.json#rakitin.plugins`, but a config
**file** wins in `Config` precedence — which is why `plugin remove` deletes
the `plugins` key entirely when the list becomes empty (an explicit `[]`
would shadow the package.json list).

---

## 2. The plugin module shape

```js
module.exports = {
  apiVersion: 1,                      // required; anything else is skipped
  name: "audit",                      // required, non-empty
  version: "1.0.0",                   // optional
  description: "Audit-log generator", // optional

  generators: {
    "audit-log": {
      describe: "Menulis app/audit/audit-log.js",
      generate: async (ctx, args) => ({ created: [], skipped: [] }),
    },
  },

  commands: [
    {
      name: "audit",
      describe: "Cetak ringkasan audit",
      builder: (yargsInstance) => yargsInstance,      // optional
      handler: async (argv, ctx) => ({ ok: true }),
    },
  ],

  hooks: {
    preGenerate(ctx) {},
    postGenerate(ctx, result) {},
    preInstall(ctx) {},
    postInstall(ctx, result) {},
    onError(ctx, error) {},
  },

  dependencies: {
    "plugin:audit-log": ["pino"],
  },
};
```

Validation (`lib/plugins/registry.js`) — malformed contributions are recorded
as `errors[]` entries and skipped, never thrown:

| Field | Rule |
| --- | --- |
| `apiVersion` | must be exactly `1`, else `Plugin "<entry>" memakai apiVersion <x>; rakitin hanya mendukung apiVersion 1.` |
| `name` | required, non-empty string |
| `generators[id]` | must be a plain object with a `generate` function; an id already registered by another plugin is a collision error |
| `commands[]` | must have a non-empty `name` and a `handler` function; a duplicate name across plugins is a collision error |
| `hooks[name]` | any of `preGenerate`, `postGenerate`, `preInstall`, `postInstall`, `onError`; non-functions are ignored |
| `dependencies[kind]` | must be `kind → string[]`; merged into the registry's extra kinds |

`module.exports.default` is unwrapped, so an ESM-transpiled plugin works.

---

## 3. Generators

```js
generate: async (ctx, args) => ({ created: [], skipped: [], nextSteps: [], message, data })
```

The returned object is the generator's contribution to the command envelope:
`created`/`skipped` are **project-root-relative POSIX paths** (they are
relativized again by `printResult`, so absolute paths also work), and
`nextSteps`/`message`/`data` are passed through by the `add` command.

Reach a plugin generator with:

```bash
rakitin add audit-log --yes --json
```

`lib/commands/add.js#addPluginGenerator` resolves core ids first and refuses
to shadow one:

```
Generator "<id>" bentrok dengan generator bawaan.
```

An unknown id exits 1 with `Generator tidak dikenal: "<id>". Lihat 'rakitin list'.`
Loaded plugin generators also appear in `rakitin list` (`tier: "plugin"`).

### 3.1 Writing files safely

Always go through `ctx.safety` (the same module the core uses), so
`--dry-run`, `--overwrite` and `.bak` backups work for your generator too:

```js
function generate(ctx, args) {
  const relative = "app/audit/audit-log.js";
  const result = ctx.safety.writeFileIfNotExistsSafe(
    path.join(ctx.root, relative),
    "module.exports = {};\n"
  );
  const bucket = result.skipped === "exists" ? "skipped" : "created";
  return { created: bucket === "created" ? [relative] : [], skipped: bucket === "skipped" ? [relative] : [] };
}
```

Also available on `ctx`: `naming` (use `ctx.naming.assertSafeName` /
`ctx.naming.toIdentifier` for every name and identifier you emit),
`plan` (the current dry-run plan snapshot), `logger`, and `config`.

### 3.2 Dependency kinds

Declare the packages your generator's output needs:

```js
dependencies: { "plugin:audit-log": ["pino"] }
```

`ctx.registerKind(kind, packages)` registers a kind at runtime (returns
`true` when merged). Every generator id automatically gets an empty default
kind `plugin:<id>`, so declaring packages is optional.

The host's `getExtraKinds()` is merged into the install step
(`ensureDependencies(kinds, { extraKinds })`), so plugin packages install with
the project's package manager, once, honoring `--no-install`/`--dry-run`.

---

## 4. Commands

```js
commands: [{ name: "audit", describe: "…", builder: (y) => y, handler: async (argv, ctx) => ({…}) }]
```

The host exposes them through `getPluginCommands(context)` (normalized to
`{name, describe, builder?, handler, plugin}`), which is the seam for
embedders and future CLI registration. **The CLI itself does not yet register
plugin commands as yargs commands** — reach a plugin capability today through
`rakitin add <generator-id>` or by calling the host API
(`require("rakitin").plugins.getPluginCommands()`).

`handler(argv, ctx)` receives the parsed argv and the same `ctx` shape as a
generator.

---

## 5. The plugin context (`ctx`)

`buildPluginContext(context, pluginArgs)` returns:

| Key | Meaning |
| --- | --- |
| `root` | absolute project root |
| `command` | command name (`pluginArgs.command`, the CLI command, or `process.argv[2]`) |
| `args` | `{...cliContext, ...pluginArgs}` — the full normalized CLI context plus command extras (e.g. `{command: "add", thing, name}`) |
| `json` | whether JSON mode is active |
| `dryRun` | the resolved dry-run state |
| `config` | the resolved config object (`.rakitinrc.json` + env + `package.json#rakitin`) |
| `logger` | the shared logger (`lib/utils/logger.js`) |
| `safety` | `lib/safety.js` (write helpers, plan API, marker engine) |
| `naming` | `lib/naming.js` |
| `plan` | a snapshot of the current plan (`safety.getPlan()`) |
| `registerKind(kind, packages)` | register an extra dependency kind |

The context is tolerant: a partial or empty input never throws, and a
consumer that passes only `{ root }` still gets a config discovered from disk.

---

## 6. Hooks

| Hook | Fires | Signature |
| --- | --- | --- |
| `preGenerate` | before a command body | `(ctx)` |
| `postGenerate` | after a command body resolves | `(ctx, result)` |
| `preInstall` | before an install step | `(ctx)` |
| `postInstall` | after an install step resolves | `(ctx, result)` |
| `onError` | when the command body throws (the error is rethrown after) | `(ctx, error)` |

Hooks fire from exactly two places in the core
(`lib/commands/shared.js`):

- `runWithPlugins(context, pluginArgs, fn)` wraps every command:
  `preGenerate` → `fn` → `postGenerate`, with `onError` on throw.
- `runWithPluginInstall(context, fn)` wraps `ensureDependencies` calls:
  `preInstall` → install → `postInstall`.

Hooks from every loaded plugin run in plugin load order. Keep them fast and
side-effect-light: they run inside the user's command, and an exception from
`preGenerate`/`preInstall` aborts the command (with `onError` fired).

---

## 7. Error surfacing

Loading never aborts the CLI. Errors are data:

| Surface | Where errors appear |
| --- | --- |
| `rakitin plugin list --json` | `data.errors[]` = `{entry, message}` |
| `rakitin plugin info <name>` | `data.errors[]` |
| `rakitin info --json` | `data.summary.plugins.errors[]` |
| `rakitin doctor` | one `warn` check per error (`<entry>: <message>`), or `N plugin dimuat tanpa error` |
| `rakitin list` | when the plugin layer is unavailable, a `plugin / plugins` catalog entry says so |

Example error messages:

```
Tidak bisa memuat plugin "./plugins/x.js": Cannot find module '…'
Plugin "./plugins/y.js" memakai apiVersion 2; rakitin hanya mendukung apiVersion 1.
Generator "demo-summary" dari plugin "demo" bentrok dengan generator plugin lain.
Command "audit" dari plugin "audit" bentrok dengan command plugin lain.
Dependency kind "audit" dari plugin "audit" tidak valid (butuh array paket).
```

The host caches the registry per `root + declared plugin list`;
`plugin add`/`plugin remove` call `resetPlugins()` so the next command sees
the change, and tests call it too.

---

## 8. Testing a plugin

`tests/lib/plugins.test.js` drives the reference fixture. A plugin test
should cover:

1. **Load**: `loadPlugins({root, config: {plugins: ["./fixture.js"]}})` →
   `plugins[0].name`, `generators`, `commands`, `hooks`, `dependencies`.
2. **Generator reachability**: `rakitin add <generator-id> --yes --json`
   reports `created[]` and `data.generator`/`data.plugin`.
3. **Hooks**: assert the hook log recorded `preGenerate`/`postGenerate`
   (and `preInstall`/`postInstall` around an install).
4. **Kind install**: the plugin kind reaches `ensureDependencies` through
   `extraKinds` (stub `installer.internals.execCommand` — the suite harness
   blocks child processes).
5. **Malformed plugin**: a bad `apiVersion` is skipped with an `errors[]`
   entry and the command still succeeds.

```js
const { loadPlugins } = require("../../lib/plugins");

const { plugins, errors } = loadPlugins({
  root: global.tempDir,
  config: { plugins: ["<abs path to tests/fixtures/plugins/demo-plugin.js>"] },
});
expect(errors).toEqual([]);
expect(plugins[0].generators).toContain("demo-summary");
```

---

## 9. Checklist

- [ ] `apiVersion: 1`, non-empty `name`.
- [ ] Generators return `{ created, skipped }` with project-root-relative paths.
- [ ] Every write through `ctx.safety`; every name/identifier through `ctx.naming`.
- [ ] Output packages declared under `dependencies` (kind `plugin:<id>` by default) or registered with `ctx.registerKind`.
- [ ] Hooks are fast and do not throw on the happy path.
- [ ] Loading a malformed plugin leaves the CLI working and reports through `plugin list` / `doctor`.
- [ ] A test covers load + generator + hooks + error surfacing.
