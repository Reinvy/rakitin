# rakitin Coding Standards

> Scope: everything under `lib/`, `bin/`, `tests/`. Docs are English-primary.
> These standards encode the invariants reviewers actually enforce; where a
> rule exists to prevent a real historical bug, the bug is cited.

---

## 1. Naming conventions

### 1.1 Files

| Area | Rule | Examples |
| --- | --- | --- |
| **Generators only** (`lib/generator/**`) | kebab-case file names carrying an explicit role suffix describing what the file produces: `.arch.js` for architecture blueprints, `.orm.js` for ORM wiring, plus the feature noun it generates. | `simple.arch.js`, `modular.arch.js`, `prisma.orm.js`, `mongoose.orm.js`, `orm-service-generator.js` |
| **Everything else in `lib/`** (`lib/*`, `lib/commands/`, `lib/deps/`, `lib/project/`, `lib/template/`, `lib/ui/`, `lib/utils/`) | Domain-named single words or kebab-case phrases — no role suffix. The module *is* the domain concept. | `naming.js`, `safety.js`, `constants.js`, `installer.js`, `detector.js`, `manifest.js`, `shared.js`, `error-handler.js`, `path-resolver.js`, `validation-utils.js` |
| Tests | `<subject>.test.js` next to their layer folders (`tests/unit/`, `tests/lib/…`, `tests/integration/`, `tests/regression/`). Jest matches `**/tests/**/*.test.js`. | `naming.test.js`, `installer.test.js`, `p0-bugfixes.test.js` |

Do not introduce new role-suffix families. If you find yourself inventing
`.factory.js` or `.manager.js`, split by domain instead.

### 1.2 Code identifiers

- Functions/classes: camelCase / PascalCase respectively — but any identifier
  derived from user input inside generated code must come from
  `lib/naming.js`'s `toIdentifier()` (never raw template interpolation).
  Case conversion must use `toPascalCase` / `toCamelCase` / `toKebabCase` /
  `toSnakeCase` / `toConstantCase`; duplicating regexes locally is a review
  blocker because drift here breaks router integration.
- Directory/file variants of a user name: `getModuleVariants(name)` returns all
  of them at once — use that instead of calling converters ad hoc.
- Constants: CONSTANT_CASE (`DEFAULT_RETRY_CONFIG`, `ROUTES_BLOCK_START`,
  `KIND_DEPENDENCIES`). Boolean flags in command context read as adjectives:
  `dryRun`, `overwrite`.

---

## 2. Module system

- **CommonJS only**: `const x = require("x")` / `module.exports = { … }`.
  No ESM syntax in shipped code (the CLI targets Node >= 18 and is loaded as CJS).
- **Barrels stay thin**: barrel files re-export their sibling(s) and nothing else.
  - `lib/utils/index.js` → `module.exports = require("./logger.js");`
  - `lib/ui/index.js` → same pattern for progress UI.
  - `lib/template/index.js` → same pattern for the engine.
  - Aggregating barrels may spread (`lib/generator/module/arch/arch.js`
    spreads `simpleArch` + `modularArch`).
- **`__esModule` compat fields stay where they exist.** Legacy surfaces such as
  `lib/installer.js` and `lib/utils.js` end with:

  ```js
  module.exports.__esModule = true;
  module.exports.default = module.exports;
  ```

  Keep them on modules that already have them (transpiled Babel-era consumers
  interop with them); do NOT add them to brand-new modules unless such
  interoperability is actually required — prefer clean named exports.

---

## 3. JSDoc

Every public function gets a JSDoc block documenting purpose and contract:

```js
/**
 * Normalize a module name to kebab-case directory form ("UserProfile" -> "user-profile").
 * Throws on empty/non-string input because callers rely on the result
 * being a real directory name.
 * @param {string} moduleName
 * @returns {string}
 */
```

Minimum bar:

- Public/exported functions: `@param` for every argument, `@returns`, and one
  sentence stating observable behavior (especially throw conditions).
- Factory functions and objects: document returned shape when it is a plain
  object literal (`@returns {{written: boolean, skipped: "exists"|null}}`).
- Non-obvious `throw`s must be called out — callers depend on knowing whether
  errors propagate or get swallowed.
- Private helpers (`_compile`, `_set`, `_mergeConfig`) still benefit from short
  blocks; `@private` is optional, naming convention signals intent.

---

## 4. Error handling contract

Two error utilities exist with different semantics — know which you're using:

### 4.1 `validation-utils.handleError(context, error)` — ALWAYS rethrows

Located at `lib/generator/shared/validation-utils.js`. It logs
`❌ Kesalahan di <context>: <error.message>` then **throws unconditionally**
(either the original error when its message already reads like a failure, or a
new `Error("Gagal <context>: <message>")` wrapped around it).

Consequence: wrapping a body in `try/catch { handleError(...) }` preserves
failure propagation — it does not swallow. `lib/generator/module/arch/*.arch.js`
rely on this: invalid module names abort generation via this path.

### 4.2 `ErrorHandler.handleError(error, context, shouldThrow = true)`

Class-based helper at `lib/generator/shared/error-handler.js`. Semantics of the
third parameter:

- `shouldThrow === true` (default): logs, writes to `logs/rakitin-errors.log`,
  then **rethrows** the original error. Use for fatal paths.
- `shouldThrow === false`: logs + records formatted info via `formatError`,
  then **returns** `{ type, message, context, stack, details, timestamp }`.
  All the `handleFileNotFoundError` / `handleModuleValidationError` /
  `handleRouterIntegrationErrors` convenience statics use `shouldThrow=false`
  so interactive flows can report multiple problems before bailing out.

Rules:

- Library code never `process.exit()`s; only `bin/rakitin.js`'s `fail()` does,
  after printing JSON (`{ ok:false, error }`) or human output.
- Create typed errors with `ErrorHandler.createError(type, message, details)`
  so `error.type` is set from `ERROR_TYPES`.
- Never log-and-return `undefined` silently from catch blocks; either route
  through one of the two handlers above or attach recovery behavior explicitly.

---

## 5. Async rules

- **Always `await` installer-family promises.** This is non-negotiable because
  of a historic fire-and-forget bug: dependency installs were kicked off without
  being awaited (the promise was dropped), so generators reported success and
  exited while `npm install` was still running or had failed invisibly —
  generated imports dangled against packages that were never installed.
  Correct usage everywhere install happens:

  ```js
  const installResult = await ensureDependencies(["middleware:auth"], {
    silent: !!context.json,
    pm: context.pm,
  });
  if (!installResult.success) { /* surface to caller */ }
  ```

  Same applies to raw installer calls: `await installer.installIfNeeded(...)`,
  `await installer.executeWithRetry(...)`, `await internals.execCommand(...)`.

- Async functions return Promises for data (`{ success, installed, failed }`),
  never mutate shared result objects across awaits.
- Do not mix sync shell-outs (`execSync`) into new async paths except in the
  legacy recipes scaffolding already reviewed; sync spawns block the event loop
  and break the retry/spinner UX. New commands go through
  `installer.executeWithRetry` → `internals.execCommand` (spawn-based).
- Long-running generator work invoked from the command layer is wrapped with
  `withSpinner(label, fn)` (`lib/commands/shared.js`) which no-ops cleanly in
  non-TTY/JSON/Jest environments.

---

## 6. Path resolution MUST be lazy

### The rule

All conventional paths come from `getPaths(root)` snapshots or the getter-style
exports in `lib/constants.js` — **evaluated at access time**. Destructuring at
module load is forbidden:

```js
// ✅ correct
function build() {
  const p = getPaths();             // resolved NOW against current root
  fs.writeFileSync(path.join(p.modulesPath, name, `${name}.service.js`), src);
}

// ❌ forbidden — frozen at require() time
const { modulesPath } = require("../constants");
const modulePath = path.join(modulesPath, name);   // captured-at-load constant
```

(For path *computation* against a known base, `utils.getCachedModulePath(name,
basePath, type)` is fine — its cache key includes basePath.)

### WHY — the test-cwd scenario

The entire test harness points generation at a sandbox: `tests/setup.js`
replaces `process.cwd` with a plain function returning a per-suite mkdtemp dir
under `os.tmpdir()`. Sequence of events if paths were captured at load:

1. Jest loads the test file; requiring the module under test evaluates
   `process.cwd()` once and stores e.g. `/repo/tests/unit/...`-rooted constants.
2. Suite's tempDir override activates (or tests call something equivalent via
   `--cwd`, which chdirs through `enterProjectRoot`).
3. Generator resolves directories against the stale constant and writes into the
   repository checkout instead of the sandbox — polluting the repo and leaving
   tests green-or-flaky depending on write permissions.
4. Parallel workers multiply the damage (races are precisely why each suite has
   its own mkdtemp dir).

With lazy getters every lookup happens *after* the cwd switch lands, so
generators agree on one root without signature changes — this is also why
`enterProjectRoot(ctx)` simply `process.chdir(ctx.cwd)`s instead of threading a
`root` parameter through dozens of functions.

Historical note: older versions of `lib/constants.js` exported exactly those
destructure-at-load constants; they were removed. Any reappearance in a diff is
a regression, not modernization.

---

## 7. Generator code rules

Four hard gates apply to anything that emits project files:

1. **All writes go through the safety layer.** Use
   `safety.writeFileIfNotExistsSafe(filePath, content)` directly, or
   `utils.writeFileIfNotExists` (the legacy alias delegating to
   `safety.legacyWriteIfAbsent`) so existing code keeps dry-run/plan semantics.
   Overwriting is only allowed via `safety.overwriteWithBackup` (creates
   `<file>.bak`). Bare `fs.writeFileSync` on user-project files will not pass
   review — the exceptions that exist (recipe `package.json` script merge,
   `.env.example` appending in `mergeEnvExample`) are deliberate, append-only
   operations.
2. **Generated identifiers via `toIdentifier()`.** Every place a user-supplied
   string becomes a JS identifier in emitted source
   (`const ${id} = require(...)` etc.) uses
   `toIdentifier(name, { casing })`. It strips illegal characters, prefixes
   `_` on digit-leading results, and appends `_` to reserved words
   (`RESERVED_WORDS`). Kebab `require` paths meanwhile use
   `normalizeModuleName`/`getModuleVariants().kebab`.
3. **Generated dependencies via `KIND_DEPENDENCIES`.** If your generated output
   requires npm packages, register a kind key in `lib/deps/manifest.js` and let
   the command layer call `ensureDependencies([kind], { pm })`. No inline
   `npm install` strings, no shell-outs from generator bodies.
4. **`vm.Script` self-check for new codegen.** Every new generator ships with a
   compile gate proving its output parses:
   ```js
   const vm = require("node:vm");
   expect(() => new vm.Script(generatedSource)).not.toThrow();
   ```
   placed in `tests/regression/` (policy suite) or a dedicated suite under
   `tests/lib/generator/`. Fragments referencing unresolved user-project
   modules may strip/substitute `require(...)` calls first (pattern used in
   `arch.test.js` / `config-router.test.js`) but syntax checking itself is not
   optional.

Also: keep generated templates self-contained unless they legitimately require
a project-local module. The auto-router embeds its own mini
`normalizeModuleName`/`toIdentifier` helpers precisely so generated code works
inside the *user's* project, not just inside rakitin. Pure content builders
(`buildRoutesContent(existing, lines)`) should stay pure to remain dry-run-safe.

---

## 8. Test rules

1. **Real fs against `global.tempDir`; no fs mocks.** Suites generate into the
   per-suite mkdtemp directory created by `tests/setup.js` and assert against
   actual disk state (`fs.existsSync`, reading files back, snapshotting bytes).
   Mocking the filesystem makes lazy-path bugs (§6) untestable and hides
   mkdir/write mode errors. In particular: **never `jest.mock('fs-extra')` in
   new suites** — the shared setup itself depends on real fs-extra semantics,
   and mocked fs leaks across a suite's lifecycle faster than it can be undone.
2. **No process-level `jest.fn` for `process.cwd`.** The cwd override installed
   by setup.js is a plain closure (`process.cwd = () => tempDir`) restored in
   `afterAll`. Reason: jest.config deliberately uses `clearMocks: true` +
   `resetMocks: false` — global resets that stripped implementations caused
   order-dependent failures elsewhere; a mocked `cwd` could end up returning
   `undefined` mid-suite. Tests that need another root should create nested dirs
   inside `tempDir` or pass explicit roots to APIs accepting them.
3. **Per-suite cleanup expectations.** Relying on the shared hooks is required:
   - `beforeAll`/`afterAll` own directory creation/removal (don't delete
     `tempDir` itself mid-suite);
   - `afterEach` empties contents, runs `jest.clearAllMocks()`, resets Logger
     instances (`Logger.clearInstances()`) and clears `utils.clearPathCache()`;
   - Anything else you mutate globally (e.g. swapping `installer.internals`)
     is saved and restored by YOUR suite in `afterAll`, following the
     `savedInternals = { ...installer.internals }` pattern from
     `tests/lib/installer.test.js`.
4. **No network, ever.** Shell/package-manager execution goes through
   `installer.internals`, so stub it instead of touching child processes:

   ```js
   installer.internals.execCommand = jest.fn().mockResolvedValue({
     stdout: "", stderr: "", code: 0,
   });
   installer.internals.isPackageInstalled = jest.fn()
     .mockReturnValue(true); // or false to simulate missing packages
   ```

   `installIfNeeded` filters through `internals.isPackageInstalled` and executes
   through `internals.execCommand`, so these two lines cover every codepath
   deterministically (see `tests/lib/installer.test.js`).
5. **Prompt-driven flows are tested headlessly** — exercise the non-interactive
   core function or drive `addCommand(thing, name, ctx)` with fully-populated
   context (`yes: true`) rather than scripting stdin/inquirer mocks.
6. Coverage is collected automatically (`collectCoverageFrom` covers `lib/**`,
   `bin/**`, `index.js`); keep assertions specific rather than chasing the
   percentage.

---

## 9. Formatting

Current source conventions (enforced by review until tooling lands):

- **Indentation:** 2 spaces, no tabs.
- **Quotes:** double quotes in `lib/` (+ `"use"` of double quotes inside
  generated output too); some generator/shared files retain single quotes from
  legacy — do not churn unrelated lines, but new code uses doubles.
- **Semicolons:** always, including on multi-line expressions.
- **Arrow preference:** arrows for callbacks and small lambdas;
  `function` declarations are fine for hoisted top-level helpers (the installer
  relies on declaration hoisting when populating `internals`).
- Template literals for any multi-line emitted code; escape backticks/`${}`
  carefully inside generated sources.
- Trailing newline at EOF; JSON artifacts written by generators are serialized
  with `JSON.stringify(obj, null, 2) + "\n"`.

Prettier integration is scheduled for **Phase 6**; when it lands it will codify
print width and quote/arrow settings mechanically — until then, match the file
you are editing and resist formatting-only reflows bundled into functional PRs.
