# rakitin Architecture (v3)

> Applies to rakitin v3: CommonJS only, Node `^22.13.0 || >=23.5.0`, runtime
> dependencies exactly `ejs`, `inquirer`, `yargs`.
> This document describes how the CLI actually works: layering, the safety
> layer, the wiring engine, the dependency manifest, the plugin layer, the
> template engine, and the test architecture.

---

## 1. High-level picture

```
                    ┌──────────────────────────────────────┐
   user shell ────▶ │ bin/rakitin.js (yargs factory)       │
                    └───────────────┬──────────────────────┘
                                    │ run(): buildContext → enterProjectRoot
                                    │   → beginPlan/resetPlan → setOverwrite
                                    │   → runWithPlugins → printResult/printFailure
                                    ▼
                    ┌──────────────────────────────────────┐
                    │ lib/commands/*                       │  command layer
                    │ init add config integrate recipe     │  (headless; prompts only
                    │ info doctor list plugin              │   for `add module|middleware`)
                    └───────┬──────────────┬───────────────┘
                            │              │
        ┌───────────────────▼──┐      ┌────▼─────────────────────┐
        │ lib/generator/**     │      │ lib/deps/manifest.js     │
        │ codegen primitives   │      │ KIND_DEPENDENCIES →      │
        │ (+ lib/templates/**) │      │ lib/installer.js         │
        └───────────┬──────────┘      └──────────────────────────┘
                    │ every write
                    ▼
   ┌────────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐
   │ lib/safety.js          │  │ lib/naming.js        │  │ lib/project/      │
   │ write-if-absent,       │  │ single source of     │  │ detector.js       │
   │ .bak, plan, markers,   │  │ truth for names      │  │ detect-first      │
   │ updateJsonFile,        │  └──────────────────────┘  └───────────────────┘
   │ mergeEnvExample        │
   └────────────────────────┘
```

There is exactly one CLI entry point: `bin/rakitin.js`. There is no second,
divergent build: the ESM `dist/` tree and the esbuild pipeline were removed
in v3, and the package is CJS-only (`exports` subpaths serve ESM consumers
through CJS interop).

---

## 2. Removed legacy stack (v3)

| Removed | Why |
| --- | --- |
| `index.js` (root interactive menu) + `lib/prompt.js` | bare `rakitin` now prints a non-interactive project summary; the menu was unscriptable and untestable |
| `rakitin router` command + `lib/generator/router/router.js` (`integrateRouter`, `createAutoRouter*`, `GLOBAL_MIDDLEWARE_CHOICES`) | superseded by the headless `integrate` on top of the wiring engine (§5) |
| `lib/generator/module/module.js` (interactive module wrapper) | `add module` is flag-complete |
| `lib/generator/shared/file-validator.js`, `path-resolver.js`, `error-handler.js` | duplicate name/path logic and an `ErrorHandler` with two divergent throw/return semantics; replaced by `lib/naming.js` + `lib/safety.js` |
| `dist/`, `build.config.js`, `build*` scripts | stale second CLI, ESM syntax resolved as CJS, templates not shipped |
| `package.json#prisma.schema` write + `postinstall: prisma skills sync` | deprecated pointer and a masked-failure install hook |
| ORM libraries as runtime dependencies | `@prisma/client`, `mongoose`, `mysql2`, `prisma`, `sequelize` are now devDependencies (tests only) |
| `fs-extra` under `lib/`, `bin/` | runtime deps are exactly `ejs`, `inquirer`, `yargs` |

Legacy capability parity: everything the menu/`router` exposed is reachable
through `init`, `add …` and `integrate`. See
[migration-v2-to-v3.md](./migration-v2-to-v3.md).

---

## 3. Directory tree of `lib/**`

```
lib/
├── index.js                 Library entry: { version, bareSummary, config,
│                            naming, safety, project, commands, deps, plugins }.
├── naming.js                Single source of truth for names: case converters,
│                            normalizeModuleName, getModuleVariants, toIdentifier,
│                            toSafeFileName, assertSafeName, sanitizeFieldName,
│                            toFieldIdentifier, RESERVED_WORDS.
├── constants.js             Lazy paths: getPaths(root) snapshot + per-key getters
│                            resolved at ACCESS time.
├── safety.js                Write choke point: plan (beginPlan/getPlan/resetPlan),
│                            setDryRun/isDryRun, setOverwrite/isOverwrite,
│                            backupPathFor, writeFileIfNotExistsSafe,
│                            overwriteWithBackup, writeOutcome, updateJsonFile,
│                            mergeEnvExample, buildMarkedBlock, buildRoutesContent,
│                            marker tokens.
├── installer.js             Cross-PM installs (npm/pnpm/yarn/bun) via
│                            spawn(command, args, { shell:false }), retry only on
│                            network/registry failures; injectable `internals`.
├── utils.js                 ensureDir (plan-aware), writeFileIfNotExists,
│                            relativePosix; re-exports naming.
├── utils/logger.js          Leveled logger; the ONLY module allowed to write to
│                            the console under lib/**.
├── ui/progress.js           Spinner / ProgressBar / StepProgress.
├── project/detector.js      detectProject(root): express, ORMs, lockfile PM,
│                            per-module architecture, router markers, middlewares.
├── deps/manifest.js         KIND_DEPENDENCIES + resolvePackagesForKinds +
│                            ensureDependencies (one-shot) + ormToKind.
├── config/index.js          Config loader (env → package.json#rakitin → rc file),
│                            DEFAULT_CONFIG/CONFIG_KEYS/PRESETS.
├── template/engine.js       EJS wrapper: TemplateEngine, renderTemplate,
│                            defaultEngine (source/mtime-keyed cache).
├── plugins/                 index.js (host seam), loader.js (resolution),
│                            registry.js (API v1 validation + registry).
├── commands/                shared.js (context/envelope/hooks), init, add, config,
│                            integrate, recipe, info, doctor, list, plugin,
│                            plugin-seam.js, index.js (barrel).
└── generator/
    ├── module/
    │   ├── verbs.js         VERB_ROUTES, VERB_MESSAGES, TEMPLATE_VERBS,
    │   │                    verbsForTemplate, routesFor, moduleTemplateLocals.
    │   ├── arch/            simple.arch.js / modular.arch.js (+ arch.js barrel).
    │   └── orm/             prisma / sequelize / mongoose / typeorm / none.
    ├── router/wiring.js     The single wiring engine (§5).
    ├── middleware/middleware.js  createMiddleware + MIDDLEWARE_KINDS.
    ├── config/config.js     createConfig + CONFIG_KINDS.
    ├── util/util.js         createUtil + UTIL_KINDS.
    ├── api/endpoint/        generateEndpoint (resources + router mount).
    ├── api/validation/      generateValidation + extractModuleFields.
    ├── api/documentation/   generateDocumentation + DOCS_KINDS (+ yaml.js).
    ├── api/graphql/         generateGraphQL (+ templates/graphql).
    ├── api/websocket/       generateWebSocket (+ templates/websocket).
    ├── api/testfile/        generateTestFiles, renderModuleTest, ensureTestInfra.
    └── shared/              orm-service-generator.js, validation-utils.js.
```

Templates live in `lib/templates/<area>/**.ejs` and are rendered through
`lib/template/engine.js` (§7).

---

## 4. Command → generator layering

### 4.1 The `run()` wrapper

Every command in `bin/rakitin.js` is `run(argv, fn)`:

1. `enableJsonMode()` when `--json` (logger → `silent`, `RAKITIN_JSON=1`).
2. `buildContext(argv)` — normalizes the global flags, resolves the project
   root, preset, ORM, arch, pm, and the per-command inputs.
3. `enterProjectRoot(context)` — `process.chdir(root)` **exactly once**, so
   every lazy path helper (`getPaths()`, `modulesPath()`, …) agrees without
   changing their signatures. `config` resolves against `context.root`.
4. `beginPlan()` when `--dry-run`, else `resetPlan()`; then
   `setOverwrite(context.overwrite)`.
5. `--cli-version` short-circuits and prints the version.
6. `runWithPlugins(context, {command}, () => fn(context))` — plugin hooks.
7. On `--dry-run`, the collected plan is attached to the result if the
   command did not provide one.
8. `printResult(result, context)`; any throw → `printFailure(error, json)`
   and `process.exitCode = 1`; `finally` → `resetPlan()`.

### 4.2 The command layer

`lib/commands/*` owns flag interpretation, prompts (only `add module` and
`add middleware`, and only when the positional is missing and `--yes` is
absent), dependency-kind selection, `nextSteps`, and the envelope. It never
writes files directly — it calls generators and the safety layer.

### 4.3 The generator layer

Generators are **headless**: they take plain data, resolve paths lazily, and
return `{ created: string[], skipped: string[], data? }` with paths
**relative to the project root** (POSIX). They never prompt and never
install; the command layer decides the kinds and calls
`ensureDependencies` once with the union.

`add module` composition:

```
archFn(kebab, ormName, { template })        → controller/service/router (+ verbs)
  ├─ ormFn(kebab, "Simple"|"Modular")       → model/entity/schema + connection
  ├─ generateGraphQL({ module })            when template === "graphql"
  ├─ generateWebSocket({ module })          when template === "realtime"
  ├─ generateTestFiles({ module })          when --with-tests | generateTestFiles
  └─ integrateCommand({ root })             when autoIntegrateRouter
ensureDependencies(union(kinds), { pm, install, extraKinds })
```

### 4.4 Detect-first

`detectProject(root)` reads `package.json` and the disk **before** anything
is written: Express presence/version, installed ORMs, lockfile-based package
manager, `app/modules/**` inventory with each module's architecture
(`routes/<kebab>.router.js` ⇒ modular, `<kebab>.controller.js` ⇒ simple),
main-router state + marker presence, and available middlewares. Consumers:
`init`, `integrate`, `doctor`, `info`, `list`, the recipes, and
`buildContext`'s preset auto-detection.

---

## 5. The wiring engine (`lib/generator/router/wiring.js`)

One engine produces main-router wiring for **both** architectures, which
removes the old undefined-handler boot-crash class (v2's simple wiring
referenced `controller.create`, which the simple controller did not export).

```js
buildWiringEntries(modules, { root })
// modules: detector inventory [{dirName, name, architecture}]
// -> { entries: [{kebab, architecture, id, mountPath, routerFile,
//                 relRequireFromRoutes}],
//      skipped: [{name, reason}] }

renderRouteLines(entries, middlewareEntries)
// -> "const <id> = require('<relative>');\n…\nrouter.use('/<kebab>', <id>, <mw>…);"
```

Rules:

- `relRequireFromRoutes` is `../modules/<kebab>/routes/<kebab>.router.js`
  (modular) or `../modules/<kebab>/<kebab>.router.js` (simple) — always
  relative to `app/routes/index.js`.
- `id` = `toIdentifier("<kebab>-router")` — never a raw user string.
- A module whose router file is **missing on disk** lands in `skipped[]`
  with a reason and is excluded from the emitted block: a dangling `require`
  is structurally impossible.
- `buildMiddlewareEntries(names, { root })` applies the same existence rule
  to `app/shared/middlewares/<kebab>.middleware.js`.
- `renderRouteLines` returns `""` for an empty entry list, so `integrate`
  can report "no valid modules" without emitting an empty region.

`lib/commands/integrate.js` composes the engine with
`safety.buildRoutesContent(existing, routeLines)` and writes the result
through the safety layer (`writeFileIfNotExistsSafe` on a fresh file,
`overwriteWithBackup` otherwise), reporting
`data.action ∈ created | markers-regenerated | block-injected | appended`.

`init`'s `ensureBaseRouter` uses the same pair
(`buildRoutesContent(null, "")`), so a freshly created router and a
regenerated one have identical structure.

---

## 6. The safety layer (`lib/safety.js`)

Every write in the codebase funnels through this module. It owns four
guarantees.

### 6.1 Modes

| Mode | API | Effect |
| --- | --- | --- |
| dry-run / plan | `beginPlan()`, `resetPlan()`, `isDryRun()`, `getPlan()` | writes are recorded as `{op, path, backup?}` instead of hitting disk; `resetPlan()` clears the plan **and** leaves the mode (the v2 latched-dry-run bug) |
| overwrite | `setOverwrite(bool)`, `isOverwrite()` | `writeFileIfNotExistsSafe` re-writes an existing file through `overwriteWithBackup` (`.bak` kept) instead of skipping it |

### 6.2 Write helpers

```js
writeFileIfNotExistsSafe(filePath, content, {dryRun?, overwrite?})
// -> { written, skipped: "exists"|null }     (delegates to overwriteWithBackup in overwrite mode)
overwriteWithBackup(filePath, content, {dryRun?})
// -> { written, backedUp, backupPath|null }
backupPathFor(filePath)   // <file>.bak, then .bak.1, .bak.2, … (never clobbers)
writeOutcome(verdict)     // -> "created" | "skipped"
```

`utils.ensureDir(dir)` is plan-aware too: in plan mode a missing directory is
recorded as `{op:"mkdir", path}`.

### 6.3 JSON mutation

`updateJsonFile(filePath, mutator, {dryRun?})` is the **only** sanctioned way
to mutate a user's JSON. It parses (rejecting non-objects and invalid JSON
with an actionable error), applies `mutator(obj)`, treats `false`/`null`/
`undefined` as "nothing changed" (no write, no backup), and otherwise
re-serializes with `JSON.stringify(obj, null, 2) + "\n"` through
`overwriteWithBackup`. Used by: `config set`, `recipe test` script
injection, `plugin add/remove`.

### 6.4 Env example merge

`mergeEnvExample(root, marker, content, {dryRun?})` appends a
`# <MARKER>` section to `<root>/.env.example` **at most once**: if a line
equal to `# <MARKER>` already exists, it reports
`{written:false, skipped:"marker-exists"}`. Markers are one per config kind
(`# APP CONFIG`, `# JWT CONFIG`, `# CUSTOM:<NAME> CONFIG`, …), plus
`# AUTH RECIPE`, `# API DOCS`, `# PRISMA`, `# SEQUELIZE`, `# MONGOOSE`,
`# TYPEORM`. It replaced every raw `.env`/`.env.example` writer from v2.

### 6.5 Marker engine

`buildMarkedBlock({existing, startToken, endToken, inner, header,
eofFallback, commentPrefix})` is a pure function returning
`{content, action}`:

| State | Action |
| --- | --- |
| `existing == null` | `create` — `header` + region + `eofFallback` |
| contains both tokens | `inject` — replace only the `[start…end]` slice |
| no tokens, has `module.exports` | `inject` — insert the region before the last `module.exports` |
| no tokens, no anchor | `append` — trimmed content + region at EOF |

Tokens (exported constants):

| Constant | Value |
| --- | --- |
| `ROUTES_BLOCK_START/END` | `/* rakitin:routes:start */` … `/* rakitin:routes:end */` |
| `RESOURCE_BLOCK_START/END` | `// rakitin:resources:start` … `// rakitin:resources:end` |
| `GRAPHQL_BLOCK_START/END` | `# rakitin:graphql:start` … `# rakitin:graphql:end` |
| `WS_BLOCK_START/END` | `// rakitin:ws:start` … `// rakitin:ws:end` |

`buildRoutesContent(existing, routeLines)` is `buildMarkedBlock` with the
routes tokens, the express header, and `\nmodule.exports = router;\n` as the
EOF fallback.

### 6.6 The JSON envelope

`printResult()` (in `lib/commands/shared.js`) is the single source of truth
for output: JSON mode prints exactly one object
(`{ok, created, skipped, plan?, nextSteps, message?, data?}`) with
`created`/`skipped` relativized against `context.root`; human mode prints
`📁 File yang dibuat`, `ℹ️  N file dilewati`, the dry-run plan, and a
numbered `🧭 Next steps` block. Full contract in
[cli-reference.md](./cli-reference.md#12-result-envelope-single-source-of-truth).

---

## 7. The template engine

`lib/template/engine.js` is a thin wrapper over EJS (the hand-rolled engine
was removed because it could not compile multi-line templates):

```js
const { TemplateEngine, renderTemplate, defaultEngine } = require("rakitin/template");
defaultEngine.renderFile(absPath, locals);   // generator path
renderTemplate("<%= name %>", { name: "x" }); // one-shot string render
```

- `render(string, data)` compiles by **source** and caches the compiled fn.
- `renderFile(path, data)` compiles by `${path}:${mtimeMs}` (edits invalidate
  naturally) and bakes the absolute `filename` in so `include()` resolves
  relative to the template regardless of cwd.
- Locals: `{ ...engine.locals, ...data }` — render-time data wins.
- Sync only (`async: false`); FIFO cache eviction at `maxCacheSize = 200`;
  `clearCache()` and `cacheSize` for diagnostics.
- Rendering failures are wrapped with the template path
  (`Gagal merender template "<path>": <message>`).

Templates under `lib/templates/**` never read `process.env` or the
filesystem; every dynamic value arrives as a local, and every identifier
interpolated into generated JS is produced by `toIdentifier()` in the
generator (see §8).

---

## 8. Naming and identifier safety

`lib/naming.js` is the only place case conversion and name validation happen.

| Function | Purpose |
| --- | --- |
| `toPascalCase` / `toCamelCase` / `toKebabCase` / `toSnakeCase` / `toTitleCase` / `toConstantCase` | case converters |
| `normalizeModuleName(name)` | cached kebab-case directory form; throws on empty |
| `getModuleVariants(name)` | `{raw, kebab, pascal, camel, snake, constant, identifier}` in one call |
| `toIdentifier(str, {casing})` | the ONLY sanctioned way to embed user input into generated JS: strips `[^A-Za-z0-9_$]`, prefixes `_` for a leading digit, appends `_` for reserved words |
| `toSafeFileName(str)` | sanitized kebab file name |
| `assertSafeName(kind, raw)` | ingress guard for every user name: rejects path separators, `\0-\x1f`, `.`/`..`/leading dots, and anything that does not reduce to `^[a-z0-9]+(?:-[a-z0-9]+)*$`; returns the kebab form |
| `sanitizeFieldName` / `toFieldIdentifier` | JS-safe field identifiers for validators and query/body keys |

`assertSafeName` is called at every ingress: `add module`,
`add middleware` (+ `--custom-name`), `add config --custom-name`,
`add util` custom name, `add endpoint` module + `--resource`,
`add validation` name, `add graphql|websocket|test --module`, and
`plugin add`.

**Lazy paths.** `lib/constants.js` exposes `getPaths(root)` plus getters
(`basePath`, `modulesPath`, `sharedPath`, `appRoutesPath`, `docsPath`,
`prismaPath`) that resolve at **access** time. Destructuring a path at
`require()` time is forbidden: tests override `process.cwd` after module
load, and `--cwd` would otherwise target a stale root.

```js
const { getPaths } = require("../constants");
const p = getPaths(root ?? process.cwd());   // GOOD — resolved at use time
const { modulesPath } = require("../constants"); // BAD — frozen at load
```

---

## 9. Dependency manifest & installer

`lib/deps/manifest.js` maps a generator **kind** to the packages its output
requires:

```js
KIND_DEPENDENCIES = {
  "module:none": [], "module:prisma": ["@prisma/client", "prisma", "dotenv"],
  "module:sequelize": ["sequelize", "mysql2"], "module:mongoose": ["mongoose"],
  "module:typeorm": ["typeorm", "reflect-metadata"],
  "middleware:auth": ["jsonwebtoken"], /* … */
  "graphql:core": ["graphql", "graphql-http"], "websocket:ws": ["ws"],
  "test:dev": ["jest@^29", "supertest"],  // DEV_KINDS -> devDependencies
  "recipe:auth": ["jsonwebtoken", "joi", "bcryptjs"],
};
```

- `resolvePackagesForKinds(kinds, extraKinds)` merges the registry with
  plugin-contributed kinds, dedupes into `packages`/`devPackages`, and
  reports `unknownKinds`.
- `ensureDependencies(kinds, {pm, install, dev, silent, extraKinds, root})`
  throws `Kind dependency tidak dikenal: "<kind>"` for an unknown kind,
  returns early with everything in `skipped[]` when `install === false` or
  the plan is active, and otherwise installs once per save-target group.
- `ormToKind(orm)` maps `Prisma|prisma|…` → `module:*`; an unknown ORM
  throws.

`lib/installer.js` builds `{command, args}` per package manager and executes
with `spawn(command, args, {shell: false, cwd, env, stdio})` — package specs
are never interpolated into a shell string. Retries happen only for
network/registry failures (`EAI_AGAIN|ETIMEDOUT|ECONNRESET|ENOTFOUND|429|5xx`);
deterministic failures (`EACCES|ENOENT|EUSAGE|EPERM`) fail fast.
`internals` exposes `spawn`, `execCommand`, `isPackageInstalled`,
`installIfNeeded` as the single injectable seam for tests and for
`init --express`. `getPackageManager(root)` detects from lock files
(`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb|bun.lock`, `package-lock.json`).

---

## 10. Plugin layer

`lib/plugins/` is optional and lazy: `lib/commands/plugin-seam.js` resolves
it defensively, and `info`/`doctor`/`list` degrade to a clean
"belum tersedia" status when it is missing.

```
config (.rakitinrc.json#plugins)  →  loader.js  →  registry.js  →  plugins/index.js
                                     resolve +      validate API v1   cached host:
                                     require        + collect         getHooks,
                                                                     getGenerators,
                                                                     getExtraKinds,
                                                                     buildPluginContext
```

- `loader.js#loadPlugins({root, config})` resolves each entry
  (`require.resolve(entry, { paths: [root] })` for bare specifiers; relative
  entries against the project root) and never throws: a broken entry becomes
  an `errors[]` record.
- `registry.js` validates the API v1 shape (`apiVersion === 1`, non-empty
  `name`, generator `generate` functions, command `name` + `handler`,
  hook functions, `dependencies` kind → package array), recording malformed
  contributions as `errors[]` and skipping them. Generator ids default to a
  `plugin:<id>` dependency kind.
- `plugins/index.js` caches the registry per `root + declared plugin list`
  and exposes `getHooks`, `getGenerators`, `getExtraKinds`,
  `getPluginCommands`, `buildPluginContext`, `resetPlugins`.
- Hooks fire from one place: `runWithPlugins` (`preGenerate` → command →
  `postGenerate`, with `onError` on throw) and `runWithPluginInstall`
  (`preInstall`/`postInstall` around `ensureDependencies`).
- Plugin generators are reachable as `rakitin add <generator-id>`; a plugin
  may not shadow a core id (`Generator "<id>" bentrok dengan generator
  bawaan`). Plugin-declared kinds are merged into the install step through
  `extraKinds`.

Full authoring guide: [plugin-authoring.md](./plugin-authoring.md).

---

## 11. Test architecture

Hermetic by construction (`jest.config.js` + `tests/setup.js`):

- **Per-suite temp dir.** `tests/setup.js` creates
  `fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-test-"))`, exposes it as
  `global.tempDir`, and overrides `process.cwd` with a **plain function**
  (not `jest.fn`) returning it — `clearMocks: true` would otherwise strip a
  mock's implementation and leave `cwd()` returning `undefined`.
- **Repo integrity guard.** `package.json` and `package-lock.json` are
  sha256-hashed in `beforeAll` and re-hashed in `afterAll`; a mismatch throws
  `[hermetic] test run memodifikasi <file>`. `npm test` therefore leaves the
  git tree clean.
- **Child processes blocked.** `tests/setup.js` calls `jest.mock("child_process")`,
  backed by `__mocks__/child_process.js`, which throws for
  `exec/execSync/spawn/spawnSync`. E2E suites opt back in with
  `global.__RAKITIN_REAL_CHILD_PROCESS__ = true` and always pass
  `--no-install`. `installer.internals.execCommand`/`spawn` are stubbed in
  `beforeEach` as the in-process seam.
- **Disk-based behavior tests.** Generators run against the real fs inside
  `global.tempDir`; generated JS is validated by compiling it
  (`new vm.Script(src)`), never by `require()`-ing user-project files.

CI (`.github/workflows/ci.yml`) runs the Jest matrix on Node 22.x and 24.x,
then a `git diff --exit-code` tree-dirty gate, plus lint, typecheck, and a
smoke job that asserts `--json` stdout purity with `jq -e .` and the
dry-run zero-mutation guarantee (`md5sum` of the file list before/after,
no `node_modules`).

---

## 12. Extension map

| Want to… | Go to |
| --- | --- |
| Add a core generator | [adding-generators.md](./adding-generators.md) |
| Make its output install packages | `KIND_DEPENDENCIES` in `lib/deps/manifest.js`; install via `ensureDependencies` — never inline |
| Expose it on the CLI | `bin/rakitin.js` (declare the flags) + `lib/commands/add.js#addCommand` |
| Ship a plugin instead | [plugin-authoring.md](./plugin-authoring.md) |
| Wire output into the main router | `lib/generator/router/wiring.js` + `safety.buildRoutesContent` (§5) |
| Add a new managed region | add tokens to `lib/safety.js` and use `buildMarkedBlock` |
| Touch `package.json` / `.rakitinrc.json` | `safety.updateJsonFile` only (§6.3) |
| Add env keys | `safety.mergeEnvExample` only (§6.4) |
| Reuse path conventions | `getPaths(root)` at call time (§8) |
| See it in `rakitin list` | the catalog is derived from the live registries — register the kind/architecture/template and it appears |

Related docs: [cli-reference.md](./cli-reference.md),
[integration-tiers.md](./integration-tiers.md),
[coding-standards.md](./coding-standards.md),
[module-examples.md](./module-examples.md).
