# rakitin Architecture

> Applies to `rakitin` v2.0.0 (CommonJS, Node >= 18).
> This document describes how the CLI actually works today: module layout,
> request lifecycle, core design principles, generator anatomy, template
> strategy, and test architecture.

---

## 1. High-level picture

```
                    ┌──────────────────────────────┐
   user shell ────▶ │ bin/rakitin.js (yargs CLI)   │
                    └──────────────┬───────────────┘
                                   │ buildContext / enterProjectRoot / safety
                                   ▼
                    ┌──────────────────────────────┐
                    │ lib/commands/*               │  headless command layer:
                    │ add·init·integrate·recipe·   │  shared.js builds context,
                    │ info                         │  printResult renders output
                    └──────────────┬───────────────┘
              ┌────────────────────┼─────────────────────┐
              ▼                    ▼                     ▼
   ┌────────────────────┐ ┌────────────────┐ ┌──────────────────────┐
   │ lib/generator/**   │ │ lib/project/   │ │ lib/deps/manifest.js │
   │ codegen primitives │ │ detector.js    │ │ KIND_DEPENDENCIES →  │
   └─────────┬──────────┘ └────────────────┘ │ installer            │
             │ every write                   └──────────────────────┘
             ▼
   ┌────────────────────┐        ┌────────────────────┐
   │ lib/safety.js      │        │ lib/naming.js      │
   │ write-if-absent,   │        │ single source of   │
   │ dry-run plan, .bak │        │ truth for names    │
   └────────────────────┘        └────────────────────┘
```

Two entry points exist: `bin/rakitin.js` (the yargs command surface — `init`,
`add`, `integrate`, `recipe`, `info`, `doctor`, `list`, legacy `router`; with no
args it falls through to the interactive menu) and `index.js` (the legacy
interactive menu, exporting `{ main, run: main }` behind a
`require.main === module` guard so tests drive it without spawning a process).

---

## 2. Directory tree of `lib/**`

One-line purpose per file. Paths are relative to repository root.

```
lib/
├── naming.js                Single source of truth for names: case converters,
│                            normalizeModuleName(), getModuleVariants(),
│                            toIdentifier(), toSafeFileName(), RESERVED_WORDS.
├── constants.js             Lazy conventional paths: getPaths(root) snapshot +
│                            per-path getters resolved at access time.
├── safety.js                Universal file-safety layer: writeFileIfNotExistsSafe,
│                            overwriteWithBackup (.bak), dry-run plan capture,
│                            marker-based buildRoutesContent().
├── prompt.js                Interactive menu prompts for the legacy flow.
├── installer.js             Cross-PM package installation (npm/pnpm/yarn/bun)
│                            with retry/backoff, lock-file detection via
│                            getPackageManager(), injectable `internals`.
├── utils.js                 Legacy barrel: ensureDir, writeFileIfNotExists
│                            (delegates to safety), path cache; re-exports naming.
├── utils/
│   ├── index.js             Barrel re-export of ./logger.js.
│   └── logger.js            Leveled logger (debug/info/warn/error/success);
│                            instance tracking via Logger.clearInstances().
├── ui/
│   ├── index.js             Barrel re-export of ./progress.js.
│   └── progress.js          Terminal progress UI: Spinner, progress bar, steps.
├── project/
│   └── detector.js          detectProject(root): package.json + disk scan →
│                            frameworks, ORMs, module inventory + per-module
│                            architecture, router markers, middlewares.
├── deps/
│   └── manifest.js          Unified dependency registry: KIND_DEPENDENCIES,
│                            resolvePackagesForKinds(), ensureDependencies()
│                            (install exactly once with detected PM), ormToKind().
├── commands/
│   ├── shared.js            buildContext(argv), enterProjectRoot(ctx) (chdir),
│   │                        printResult(json|human), enableJsonMode(), withSpinner().
│   ├── init.js              initCommand(): detect project + write idempotent
│   │                        .rakitinrc.json with preset heuristics.
│   ├── add.js               addCommand(thing, name, ctx): headless dispatch for
│   │                        module|middleware|util|config|endpoint|validation|docs.
│   ├── integrate.js         integrateCommand(): marker-based main-router wiring,
│   │                        exists-checks before requires, per-module arch.
│   ├── recipe.js            recipeCommand(name): composite advanced recipes
│   │                        (auth/swagger/test/docker); RECIPES registry;
│   │                        mergeEnvExample() helper.
│   └── info.js              doctorCommand(), infoCommand(), listCommand() and
│                            the CATALOG that drives `rakitin list`.
├── config/
│   └── index.js             Multi-source Config class (.rakitinrc*, package.json,
│                            RAKITIN_* env). Loader exists but is NOT yet wired
│                            into the command/menu flow.
├── template/
│   ├── engine.js            EJS wrapper: TemplateEngine, renderTemplate(),
│   │                        defaultEngine; cached compiles, FIFO eviction.
│   └── index.js             Barrel re-export of ./engine.js.
└── generator/
    ├── module/
    │   ├── module.js         Interactive "generate module" wrapper.
    │   ├── arch/
    │   │   ├── arch.js        Barrel spreading simple + modular exports.
    │   │   ├── simple.arch.js simpleArch(moduleName, orm): controller/service/
    │   │   │                  router flat inside modules/<name>/.
    │   │   └── modular.arch.js modularArch(moduleName, orm): controllers/
    │   │                      services/models/routes subfolders.
    │   └── orm/              Per-ORM model/service wiring snippets
    │                        (prisma, sequelize, mongoose, typeorm, none).
    ├── middleware/
    │   └── middleware.js     createMiddleware(type, customName): auth | logger |
    │                         error | request-time | custom.
    ├── config/
    │   └── config.js         createConfig(type, { withEnvExample }) env-based
    │                         config files.
    ├── util/
    │   └── util.js           generateUtil(): utility-function generator menu.
    ├── router/
    │   └── router.js         integrateRouter() (interactive),
    │                        createAutoRouterTemplate(), createAutoRouter(),
    │                        integrateAutoRouter(); GLOBAL_MIDDLEWARE_CHOICES
    │                        whitelist (auth/logger/error/request-time).
    ├── api/
    │   ├── endpoint/index.js     CRUD endpoint generator for existing modules.
    │   ├── validation/index.js   Joi validation schema generator.
    │   └── documentation/index.js OpenAPI/Swagger scaffolding generator.
    └── shared/
        ├── error-handler.js ErrorHandler static helpers; handleError(error,
        │                   context, shouldThrow=true) rethrows by default.
        ├── file-validator.js Pre-import existence checks for router integration.
        ├── path-resolver.js Import-path computation for modular/simple layouts.
        ├── orm-service-generator.js generateServiceCode(moduleName, orm, style).
        └── validation-utils.js validateModuleName/validateOrm/validateArchitecture,
                            handleError(context, error) (ALWAYS rethrows),
                            createErrorMessage(type, details).
```

Supporting files outside `lib/`: `bin/rakitin.js` (CLI surface), `index.js`
(interactive entry, exports `main`/`run`), `tests/setup.js`, `jest.config.js`.

---

## 3. Request lifecycle of a headless command

Example: `rakitin add module user --orm none --arch modular --json`.

```
bin/rakitin.js
  │ yargs parses argv against global options (--cwd --yes --overwrite
  │   --dry-run --json --no-install --preset --arch --orm --pm)
  ▼
runAdd(argv)                              [bin/rakitin.js]
  │ 1. buildContext(argv)                 [lib/commands/shared.js]
  │      → { cwd, yes, overwrite, dryRun, json, install,
  │           preset, arch, orm, pm }
  │ 2. enterProjectRoot(ctx)              chdir to ctx.cwd when different;
  │      all helpers read process.cwd() lazily, so one chdir keeps every
  │      generator aligned without touching signatures.
  │ 3. if (ctx.json) enableJsonMode()     logger silenced to 'error';
  │      RAKITIN_JSON=1 → printResult emits pure JSON on stdout.
  │ 4. if (ctx.dryRun) safety.beginPlan() no writes hit disk; operations
  │      are recorded into the plan instead.
  ▼
addCommand(thing, name, ctx)              [lib/commands/add.js]
  │ switch on thing → feature-specific headless function
  │ missing decisions fall back to inquirer ONLY when !ctx.yes
  ▼
generator primitive (e.g. modularArch(name, orm))
  │ writes route through safety.writeFileIfNotExistsSafe /
  │ utils.writeFileIfNotExists (legacy alias, same semantics)
  ▼
ensureDependencies([...kinds], { pm })    [lib/deps/manifest.js]
  │ resolvePackagesForKinds → unique package set →
  │ installer.installIfNeeded(packages, { packageManager })
  ▼
printResult({ createdFiles?, skipped?, nextSteps?, plan? })
  │ human mode : 📁 files · ℹ️ skipped count · 🧭 numbered next steps
  │ JSON mode  : { ok:true, created, skipped, plan, nextSteps }
  ▼
safety.resetPlan(); errors → fail(err, json) prints
  { ok:false, error } and exits with code 1.
```

The same skeleton drives `init`, `recipe`, and `integrate` handlers in
`bin/rakitin.js`; only the middle "command" call differs.

---

## 4. Core principles

### 4.1 Single source of truth: `lib/naming.js`

Every directory name, identifier, or require line generated by rakitin must be
derived from `lib/naming.js`:

- Case converters: `toPascalCase`, `toCamelCase`, `toKebabCase`, `toSnakeCase`,
  `toTitleCase`, `toConstantCase`.
- `normalizeModuleName(name)` → kebab-case directory form (cached, throws on empty).
- `getModuleVariants(name)` → `{ raw, kebab, pascal, camel, snake, constant,
  identifier }` computed in one call.
- `toIdentifier(str, { casing })` → the ONLY sanctioned way to embed user input
  into JavaScript identifiers (see §5).
- `toSafeFileName(str)` → sanitized kebab file names (no separators/control chars).

Hand-rolling case conversion inside generators is forbidden; duplicated logic is
how "mixed" architectures drift out of sync.

### 4.2 Lazy path resolution: `getPaths(root)` vs captured constants

Older versions exported plain string constants (e.g. `modulesPath`) resolved
once at `require()` time. That was a defect: tests override cwd after modules
are loaded, and `--cwd` would silently target stale paths. Current contract:

```js
const { getPaths } = require("../constants");

// GOOD - evaluated at use time against the current root
const p = getPaths(root ?? process.cwd());
fs.existsSync(p.modulesPath);

// BAD - destructured once at module load, frozen forever
const { modulesPath } = require("../constants"); // never do this
```

`lib/constants.js` exposes `getPaths(root)` plus per-key getters (`basePath`,
`modulesPath`, `sharedPath`, `prismaPath`, `typeormEntitiesPath`,
`mongooseModelsPath`, `appRoutesPath`, `rootRoutesPath`, `validatorsPath`,
`docsPath`) that delegate to `getPaths()` at access time. Destructure-at-load
is deprecated; new code must go through getters or an explicit snapshot.

### 4.3 Detect-first integration

`lib/project/detector.js`'s `detectProject(root)` builds a structural summary
that every integrating command consumes *before* writing anything:

- npm presence, express version, installed ORMs, dependency map.
- `app/modules/**` inventory with each module's real architecture (`modular`
  when `<name>.router.js` exists under `routes/`, `simple` when a flat
  `<name>.controller.js` exists) — mixed layouts are expected.
- Main-router state: existing? contains the `rakitin:routes:start/end` markers?
- Global middleware files (`*.middleware.js`) found in `app/shared/middlewares/`.

Consumers: `initCommand`, `integrateCommand`, `doctorCommand`, `infoCommand`,
recipes. The rule: integrate what exists, skip what doesn't, never emit dangling
requires (`integrate.js` checks middleware file existence ONCE before wiring).

### 4.4 Marker-based managed region for the router

`lib/safety.js` defines:

- `ROUTES_BLOCK_START` = `/* rakitin:routes:start */`
- `ROUTES_BLOCK_END` = `/* rakitin:routes:end */`

`buildRoutesContent(existing, routeLines)` is a PURE function returning
`{ content, action }` where `action ∈ {"create"|"inject"|"append"}`:

| state of `app/routes/index.js` | behavior |
| --- | --- |
| absent (`existing == null`) | full header + marked block + export (`create`) |
| present WITH markers | replace ONLY the marked region; bytes outside markers preserved (`inject`) |
| present WITHOUT markers | append marked block (before `module.exports` when found) keeping user code above intact |

Writers then choose `writeFileIfNotExistsSafe(path, content)` for fresh creates
or `overwriteWithBackup(path, content)` which snapshots the previous version to
`<path>.bak`. Custom routes kept *outside* the markers survive regeneration by
construction.

### 4.5 Unified dependency manifest

Generators no longer shell their own installs. `lib/deps/manifest.js` maps
generator kinds → packages their OUTPUT needs:

```js
KIND_DEPENDENCIES = {
  "module:none": [],       // Express-only, basic tier
  "module:prisma": [],     // handled by prisma init flow itself
  "module:sequelize": ["sequelize", "mysql2"],
  "middleware:auth": ["jsonwebtoken"],
  ...
};
```

`resolvePackagesForKinds(kinds)` dedupes across kinds (reports unknown ones);
`ensureDependencies(kinds, { silent, pm })` calls
`installer.installIfNeeded(packages, { packageManager })` exactly once,
skipping already-installed packages and detecting the package manager from
lock files via `installer.getPackageManager()`. New generators register new
kind keys here instead of installing inline (see docs/adding-generators.md §3).

### 4.6 Dry-run first-class

Dry-run is not a special flag handled per-command; it lives in the safety layer:

- Global mode toggled by `safety.setDryRun(true)` / entered via
  `bin/rakitin.js` calling `safety.beginPlan()`.
- `writeFileIfNotExistsSafe(filePath, content, { dryRun })` and
  `overwriteWithBackup(...)` accept per-call overrides so library callers can
  opt in without touching global state.
- In plan mode nothing touches disk; intents are appended to `runtime.plan`
  as `{ op: "create" | "backup+overwrite", path }`.
- Commands finish with `plan: ctx.dryRun ? safety.getPlan() : undefined`
  handed to `printResult`, then `safety.resetPlan()` (also called on failure)
  so state never leaks between runs. Tests may assert on plans directly using
  `beginPlan()`/`getPlan()`/`resetPlan()`.

Because content builders like `buildRoutesContent` are pure, router injection
composes safely with dry-run.

---

## 5. Generator anatomy

Every generator follows the same pipeline:

```
prompts OR flags
      │  (headless: context from buildContext; interactive fallback
      │   only when !context.yes — e.g. addModule's inquirer block)
      ▼
feature function  e.g. simpleArch(moduleName, orm) / createMiddleware(type)
      │  1. validate inputs (validation-utils.validateModuleName etc.)
      │  2. derive ALL names via naming.js (kebab dir, identifier, variants)
      │  3. ensureDir(...) for conventional folders under getPaths().*
      │  4. writes through writeFileIfNotExistsSafe / utils.writeFileIfNotExists
      ▼
manifest dependency registration
      │  caller (command layer) does ensureDependencies([`${family}:${kind}`], { pm })
      ▼
nextSteps strings attached to result
      │  e.g. "Wire module 'user' ke router utama: rakitin integrate"
      ▼
printResult renders human table or JSON object
```

### Why every generated identifier must come from `toIdentifier()`

Generated source embeds user input as JavaScript identifiers:

```js
const ${toIdentifier(m + "-router")} = require('../modules/${kebab}/routes/${kebab}.router');
```

Raw interpolation breaks compilation the moment a user types something hostile:

- `"user-profile"` → must become `userProfileRouter`, not `user-profileRouter`.
- `"2fa"` → identifiers can't start with a digit; `toIdentifier` prefixes `_`.
- `"class"`, `"await"`, `"function"` → reserved words; `toIdentifier` appends
  `_` (using its internal `RESERVED_WORDS` set).
- Spaces/punctuation → stripped entirely (`/[^A-Za-z0-9_$]/g`), never crashing
  downstream require statements.

`toIdentifier` also normalizes case (`camel` default, `pascal` option), and
`naming.getModuleVariants()` exposes it alongside directory/file variants so a
generator cannot accidentally mix an unsanitized variant into codegen. This is
enforced twice: by review convention, and by regression suites that compile
generated artifacts with `new vm.Script(source)` (§8).

---

## 6. Template strategy: the EJS wrapper

Templates currently ship mostly as inline literals inside generators (plus the
self-contained auto-router template). The sanctioned rendering API is the EJS
wrapper in `lib/template/engine.js`:

```js
const { TemplateEngine, renderTemplate, defaultEngine } = require("rakitin/template");
// or directly: require(".../lib/template/engine")

renderTemplate("<%= name %> = <%= value %>;", { name: "port", value: 3000 });

const engine = new TemplateEngine({
  enableCache: true,          // compiled fns cached (default true)
  locals: { pkg: "rakitin" }, // fallback merged into every render's data
  ejsOptions: {},             // forwarded verbatim to ejs.compile
});
const out = engine.renderFile("/abs/path/foo.ejs", { moduleName: "user" });
```

Capabilities:

- **Interpolation** — `<%= value %>` escaped, `<%- value %>` raw.
- **Control flow** — full JS via `<% if (...) { %> … <% } %>`, loops, ternaries.
- **Includes** — `<%- include('./partial', { x: 1 }) %>`; for `renderFile` the
  absolute `filename` is baked into the compiled function so include paths
  resolve relative to the template regardless of process cwd (`render(string)`
  has no filename context — prefer `renderFile` when using includes).
- **Cache** — compiled fns cached by template *source* for `render`, and by
  `${filePath}:${stat.mtimeMs}` for `renderFile` (mtime-stamped so edits
  invalidate naturally). Sync execution only (`async: false`).
- **Locals precedence** — render-time data spreads over constructor locals:
  `{ ...this.locals, ...data }`.
- **Eviction** — FIFO at `maxCacheSize = 200` (`_set` drops the oldest key);
  `clearCache()` and the `cacheSize` getter exist for diagnostics/tests.

### Migration guidance (inline literals → `.ejs`)

New templating work should move toward files under `lib/templates/<area>/…ejs`
rendered with `defaultEngine.renderFile`, rather than growing more backtick
literals. Rules for migration:

1. Keep *all* dynamic values flowing through explicit locals — no reading
   `process.env` or filesystem inside templates.
2. Any identifier interpolated into generated JS still must originate from
   `toIdentifier()` in the generator, passed as a ready-to-use local.
3. Convert one generator at a time; each conversion lands together with a
   `vm.Script` compile assertion covering rendered output for representative
   inputs (see the `vm.Script` rule in §7).
4. Template filenames follow kebab-case (`orm-service.ejs`, `controller.ejs`);
   partials live beside their consumers and are included relatively.
5. Do not grow a second rendering mechanism — hand-rolled string engines were
   removed precisely because they could not compile multi-line output. Until a
   given literal migrates, it stays subject to the same `vm.Script` policy; the
   wrapper simply becomes the standard tool going forward.

---

## 7. Testing architecture

### Suite isolation: per-suite mkdtemp in `os.tmpdir`

`tests/setup.js` (registered via jest.config's
`setupFilesAfterEnv: ['<rootDir>/tests/setup.js']`) runs **once per test
suite** (i.e. once per test file) and provisions a private sandbox:

```js
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-test-"));
global.tempDir = tempDir;
process.cwd = () => tempDir;   // plain function, restored in afterAll
```

Rationale (from setup.js comments): sharing one directory across parallel Jest
workers caused ENOENT races whenever one worker wiped contents while another
scanned. `afterAll` removes the private tree; `afterEach` empties it between
tests, clears mock call history (`jest.clearAllMocks()`), resets Logger
instances (`Logger.clearInstances()`) and the util PathCache.

### Why the cwd override is a plain function (not `jest.fn`)

`jest.config.js` deliberately sets:

```js
clearMocks: true,     // wipes CALL HISTORY between tests…
resetMocks: false,    // …but implementations are NOT reset globally
restoreMocks: false,
```

Config comments explain: resetting implementations globally made factory-defined
behavior vanish mid-suite and produced order-dependent failures. The inverse
hazard applies to `process.cwd`: were it a Jest mock, any mock lifecycle that
strips implementations would leave `cwd` returning `undefined` for the rest of
the suite, breaking every lazy `getPaths()` lookup. Hence setup.js swaps in a
*plain arrow function* — immune to mock bookkeeping — saving/restoring the
original in `beforeAll`/`afterAll`.

### Test layers

| Layer | Location | Style |
| --- | --- | --- |
| Pure unit | `tests/unit/` (`naming.test.js`, `template.test.js`, `utils.test.js`, `config.test.js`, `logger.test.js`) | No fs needed (or tempDir only); verifies converters, cache eviction, EJS behavior. |
| Library w/ internals stub | `tests/lib/installer.test.js` | Saves `installer.internals`, replaces `execCommand` / `isPackageInstalled` with local `jest.fn`s, restores in `afterAll`. No child processes, no network. |
| Command & structure | `tests/lib/commands.test.js`, `constants.test.js`, `prompt.test.js`, `utils.test.js` | Real fs against `global.tempDir`; commands exercised through exported functions. |
| Generator (disk-based, real fs) | `tests/lib/generator/*.test.js` (e.g. `arch.test.js`, `auto-router.test.js`, `config-router.test.js`) | Run generator → read produced files from tempDir → `vm.Script` them. |
| Integration / end-to-end | `tests/integration/end-to-end.test.js` (+ `directory-structure`, `file-validation`) | Drives exported `main`/`run` from `index.js` (possible because of its `require.main` guard) or command APIs end-to-end inside tempDir. |
| Regression policy gates | `tests/regression/p0-bugfixes.test.js`, `core-redesign.test.js`, `recipes.test.js` | Historical bug classes encoded as permanent assertions — every generated artifact below these tests is syntax-checked via `vm.Script`; structural promises (markers present, backups written, plans collected) verified. |

### The `vm.Script` rule

> Every artifact rakitin generates must parse standalone:
> `expect(() => new vm.Script(source)).not.toThrow();`

Where unparseable fragments occur on purpose (e.g. controllers whose top-level
`require(...)` targets user-project files), suites strip requires first
(`stripRequires` helper in `arch.test.js`) or substitute them
(`src.replace(/require\([^)]*\)/g, "({})")` in `config-router.test.js`) so the
*syntax* is still gated. Any new codegen path adds this check either inside
`tests/regression/` or in a dedicated suite before merge. Run everything with
`npx jest` (coverage collected by default per `jest.config.js`; `forceExit` is
enabled because interactive prompt libs keep handles alive in some suites).

---

## 8. Extension guide mini-map

Adding a capability touches a predictable set of seams:

| Want to… | Go to | Notes |
| --- | --- | --- |
| Add a new headless generator | `docs/adding-generators.md` (full tutorial) | Non-interactive core fn + optional prompt wrapper. |
| Make its output install packages | `lib/deps/manifest.js` `KIND_DEPENDENCIES` | Register e.g. `"service:prisma": [...]`; install via `ensureDependencies` — never inline installs. |
| Expose it on the CLI | `bin/rakitin.js` dispatcher + `lib/commands/add.js` `addCommand` switch | Reuse `buildContext`/`enterProjectRoot`/`printResult`; do not bypass the safety layer. |
| Wire new output into the router | `lib/safety.js` markers + `buildRoutesContent` | Only inject inside the managed region; identifiers via `toIdentifier`. |
| Show it in `rakitin list` | `CATALOG` array in `lib/commands/info.js` | Tiers: basic / intermediate / advanced. |
| Load user configuration | `lib/config/index.js` (`Config` class) | Exists and tested, but intentionally NOT yet consumed by the menu/command flow — wire deliberately if adoption is desired. |
| Reuse path conventions | `getPaths(root)` from `lib/constants.js` | Never destructure at load time (§4.2). |

Related docs: `docs/coding-standards.md` (style + invariants enforced during
review) and `docs/router-integration.md` (marker deep-dive).
