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
| **Everything else in `lib/`** (`lib/*`, `lib/commands/`, `lib/deps/`, `lib/project/`, `lib/template/`, `lib/ui/`, `lib/utils/`, `lib/plugins/`) | Domain-named single words or kebab-case phrases — no role suffix. The module *is* the domain concept. | `naming.js`, `safety.js`, `constants.js`, `installer.js`, `detector.js`, `manifest.js`, `shared.js`, `validation-utils.js`, `plugin-seam.js`, `wiring.js` |
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
  No ESM syntax in shipped code — the package is CJS-only
  (`main: lib/index.js`, `exports` subpaths with `types` + `default`, no
  `import` condition) and targets Node `^22.13.0 || >=23.5.0`. ESM consumers
  use CJS interop; the `dist/` ESM build no longer exists.
- **Barrels stay thin**: barrel files re-export their sibling(s) and nothing else.
  - `lib/utils/index.js` → `module.exports = require("../utils.js");`
  - `lib/ui/index.js` → same pattern for progress UI.
  - `lib/template/index.js` → same pattern for the engine.
  - `lib/commands/index.js` re-exports the command functions + `buildContext`/
    `printResult`/`printFailure`/`enableJsonMode`.
  - Aggregating barrels may spread (`lib/generator/module/arch/arch.js`
    spreads `simpleArch` + `modularArch`).
- **No `__esModule` compat fields.** They were removed with the Babel-era
  build; the only remaining `__esModule` reference is the plugin loader
  unwrapping `mod.default` from a transpiled plugin module. Export clean
  named properties.

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

v3 has **one** error path. The v2 helpers
(`lib/generator/shared/error-handler.js`'s `ErrorHandler`, and
`validation-utils.handleError`) were deleted.

### 4.1 Throw; the command wrapper prints

- Library and generator code **throws** plain `Error`s with actionable
  messages (what was wrong + how to fix it, e.g.
  `Nama module tidak valid: "../evil". Gunakan huruf, angka, "-" atau "_" tanpa pemisah path.`).
  Never `process.exit()`, never `console.error` (the `lib/**` `no-console`
  rule is `error`), never log-and-return `undefined`.
- `bin/rakitin.js`'s `run()` wrapper catches, calls
  `printFailure(error, json)` — `{ok:false, error}` on stdout in JSON mode, a
  `❌` logger line otherwise — and sets `process.exitCode = 1`. That is the
  only place a failure becomes an exit code.
- `lib/commands/doctor.js` is the deliberate exception: a failing check sets
  `process.exitCode = 1` **and** `ok:false` without throwing, because a health
  report must list every finding.

### 4.2 `lib/generator/shared/validation-utils.js`

It exports only input validators:

```js
const {
  VALID_ORMS, VALID_ARCHITECTURES,
  validateModuleName, validateOrm, validateArchitecture,
} = require("../shared/validation-utils");
```

`validateModuleName(name)` returns `{ isValid, message }` and delegates to
`naming.assertSafeName` for the charset/path-traversal rules; it does not
throw and does not log. New ingress points should prefer
`naming.assertSafeName(kind, raw)` directly (it throws and returns the kebab
form).

### 4.3 Conventions

- Attach a `cause` when wrapping: `new Error(msg, { cause: error })`.
- Message language follows the surrounding surface: user-facing CLI errors are
  Indonesian, JSDoc and code comments are English.
- Never swallow an error in a catch block: rethrow it, or convert it into a
  reported result (`{ success:false, failed:[…] }`, a `warn` check, an
  `errors[]` entry). The plugin loader is the reference for
  "report, never abort".

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
- Do not use sync shell-outs (`execSync`) anywhere. Every install and every
  `npx`-style invocation goes through
  `installer.executeWithRetry` → `internals.execCommand` (spawn-based,
  `shell: false`), or through the manifest
  (`ensureDependencies(kinds, { pm, install })`). Sync spawns block the event
  loop and bypass `--no-install`/`--dry-run`/`--pm`.
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

(For path *computation* against a known base, pass the root explicitly to
`getPaths(root)` rather than relying on `process.cwd()`.)

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
   `utils.writeFileIfNotExists` (a plan-aware delegate with the same
   semantics). Re-writing an existing generated file is only allowed via
   `safety.overwriteWithBackup` (uniquely named `.bak`) or by passing
   `--overwrite` through the global overwrite mode. For JSON files use
   `safety.updateJsonFile`, for `.env.example` use
   `safety.mergeEnvExample`, and for managed regions use
   `safety.buildMarkedBlock`. Bare `fs.writeFileSync` against user-project
   files will not pass review — it bypasses dry-run, backups and the marker
   engine.
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
a project-local module, and never require anything from the `rakitin` package
inside generated code (it will not exist in the user's project — the generated
WebSocket/GraphQL layers require `ws`/`graphql`, which the manifest installs).
Pure content builders (`buildRoutesContent(existing, lines)`,
`buildMarkedBlock(...)`) stay pure so they remain dry-run-safe.

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
     instances (`Logger.clearInstances()`) and resets the safety plan
     (`safety.resetPlan()`);
   - Anything else you mutate globally (e.g. swapping `installer.internals`)
     is saved and restored by YOUR suite in `afterAll`, following the
     `savedInternals = { ...installer.internals }` pattern from
     `tests/lib/installer.test.js`.
   - The repo-integrity guard in `afterAll` hashes `package.json` and
     `package-lock.json`; a suite that mutates either fails the run with
     `[hermetic] test run memodifikasi <file>`.
4. **No network, ever.** `tests/setup.js` blocks `child_process`
   (`__mocks__/child_process.js` throws for `exec/execSync/spawn/spawnSync`
   unless a suite sets `global.__RAKITIN_REAL_CHILD_PROCESS__ = true`), and
   shell execution goes through `installer.internals`, so stub it instead of
   touching child processes:

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
6. Coverage is collected automatically (`collectCoverageFrom` covers `lib/**`
   and `bin/**`, excluding `lib/templates/**`); keep assertions specific
   rather than chasing the percentage.

---

## 9. Formatting

Prettier is wired (`prettier` is a devDependency; `npm run format` /
`npm run format:check` cover `lib/**/*.js`, `bin/*.js`, `tests/**/*.js`).
Match the file you are editing and resist formatting-only reflows bundled into
functional PRs; run `npm run format:check` before opening one.

Source conventions:

- **Indentation:** 2 spaces, no tabs.
- **Quotes:** double quotes in `lib/` and `bin/` (enforced by ESLint
  `quotes: ["warn", "double", { avoidEscape: true }]`).
- **Semicolons:** always (ESLint `semi: ["error", "always"]`).
- **Arrow preference:** arrows for callbacks and small lambdas;
  `function` declarations are fine for hoisted top-level helpers (the installer
  relies on declaration hoisting when populating `internals`).
- Template literals for any multi-line emitted code; escape backticks/`${}`
  carefully inside generated sources.
- Trailing newline at EOF; JSON artifacts written by generators are serialized
  with `JSON.stringify(obj, null, 2) + "\n"`.
