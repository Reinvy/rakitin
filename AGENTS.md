# AGENTS.md — Guide for AI coding agents working on rakitin

This document teaches automated agents (Claude Code, Cursor, Devin, …) how to
work safely inside this repository. Human contributors benefit too.

## Project snapshot

- **What**: `rakitin` is an integration-first boilerplate CLI for
  Node.js/Express backends (npm package, **CommonJS only**, binary
  `bin/rakitin.js`, library entry `lib/index.js`).
- **Non-negotiable promise to users**: we never destroy user code. Every write
  goes through the safety layer; router edits are marker-based and idempotent.
  If your change breaks that guarantee, it breaks the product.
- **Runtime**: Node **`^22.13.0 || >=23.5.0`**. Runtime dependencies are exactly
  `ejs`, `inquirer`, `yargs`. ORM drivers, Express, `graphql`, `graphql-http`,
  `ws`, `yaml` and `fs-extra` are **devDependencies** (tests only) — nothing
  under `lib/`, `bin/` or `lib/index.js` may `require("fs-extra")`.
- **No build step**: there is no `dist/`, no `build.config.js`, no
  `build`/`build:cjs`/`build:esm`/`build:clean` script, and no `postinstall`.
  Never reintroduce one.
- **Templates** are `.ejs` files under `lib/templates/**`, shipped in the npm
  `files` list and rendered through `lib/template/engine.js`.

## Command cheat-sheet

```bash
npm install                # setup
npm test                   # full Jest suite (must stay green AND leave the tree clean)
npm run test:ci            # CI variant: jest --ci --coverage --watchAll=false
npm run test:unit          # tests/unit
npm run test:integration   # tests/integration
npm run test:e2e           # tests/e2e (spawns the real CLI, --no-install)
npm run test:real-project  # standalone E2E smoke: node tests/scripts/test-real-project.js
npm run lint               # eslint (flat config; includes lib/** no-console:error)
npm run lint:fix
npm run typecheck          # tsc --noEmit over types/ (no skipLibCheck)
npm run format / format:check   # prettier
npm start                  # node bin/rakitin.js

# single suite / single test
npx jest tests/lib/plugins.test.js
npx jest tests/regression -t "<name>"

# headless smoke in a throwaway project (never inside the repo)
T=$(mktemp -d); cd "$T"; echo '{"name":"t","version":"1.0.0"}' > package.json
node /path/to/rakitin/bin/rakitin.js add module demo --arch modular --orm none --yes --no-install --json
node /path/to/rakitin/bin/rakitin.js doctor --json
```

## Repo map

| Path | Purpose |
|------|---------|
| `bin/rakitin.js` | yargs factory invocation, global flags, `run()` wrapper, command declarations |
| `lib/index.js` | library entry: `{ version, bareSummary, config, naming, safety, project, commands, deps, plugins }` |
| `lib/commands/` | command layer: `shared.js` (context + envelope + plugin hooks), `init`, `add`, `config`, `integrate`, `recipe`, `info`, `doctor`, `list`, `plugin`, `plugin-seam.js`, `index.js` |
| `lib/safety.js` | plan API (`beginPlan`/`getPlan`/`resetPlan`), `setDryRun`/`isDryRun`, `setOverwrite`/`isOverwrite`, `backupPathFor`, `writeFileIfNotExistsSafe`, `overwriteWithBackup`, `updateJsonFile`, `mergeEnvExample`, `buildMarkedBlock`, `buildRoutesContent`, marker tokens |
| `lib/naming.js` | single source of naming: converters, `normalizeModuleName`, `getModuleVariants`, `toIdentifier`, `toSafeFileName`, `assertSafeName`, `sanitizeFieldName`, `toFieldIdentifier` |
| `lib/constants.js` | lazy path getters + `getPaths(root)` (never capture cwd at require time) |
| `lib/deps/manifest.js` | `KIND_DEPENDENCIES` / `DEV_KINDS` / `ormToKind` / `resolvePackagesForKinds` / `ensureDependencies` |
| `lib/installer.js` | cross-PM installs via `spawn(..., { shell:false })`; injectable `internals` (`spawn`, `execCommand`, `isPackageInstalled`, `installIfNeeded`) |
| `lib/project/detector.js` | `detectProject(root)`: express, ORMs, lockfile PM, module inventory + architecture, router markers, middlewares |
| `lib/generator/router/wiring.js` | the single wiring engine (`buildWiringEntries`, `buildMiddlewareEntries`, `renderRouteLines`) |
| `lib/generator/module/` | `verbs.js` (verb/template registry), `arch/{simple,modular}.arch.js`, `orm/*.orm.js` |
| `lib/generator/api/` | `endpoint`, `validation`, `documentation`, `graphql`, `websocket`, `testfile` |
| `lib/plugins/` | plugin host: `index.js` (cached seam), `loader.js` (resolution), `registry.js` (API v1 validation) |
| `lib/template/engine.js` | EJS wrapper (`TemplateEngine`, `renderTemplate`, `defaultEngine`) |
| `lib/utils/logger.js` | the **only** module allowed to write to the console |
| `types/index.d.ts` | declarations for the root entry and every `exports` subpath |
| `tests/setup.js` | per-suite mkdtemp cwd, repo hash guard, `child_process` block, installer stubs |
| `__mocks__/child_process.js` | manual mock that throws unless a suite opts into real spawning |

## Hard rules (violations = rejected change)

1. **Write through the safety layer.** Generators use
   `safety.writeFileIfNotExistsSafe` / `utils.writeFileIfNotExists` (plan-aware
   delegate) / `safety.overwriteWithBackup`, JSON files use
   `safety.updateJsonFile`, `.env.example` uses `safety.mergeEnvExample`, and
   managed regions use `safety.buildMarkedBlock`. Raw `fs.writeFileSync`
   against user-project files is a review blocker — it bypasses dry-run,
   backups and the marker engine.
2. **Never interpolate raw user names into generated identifiers.** Use
   `naming.toIdentifier()` / `getModuleVariants().identifier`, and validate
   every ingress with `naming.assertSafeName(kind, raw)` (rejects path
   separators, `..`, leading dots and control characters).
3. **Router regeneration = marker region only.** Preserve bytes outside
   `/* rakitin:routes:start */ … /* rakitin:routes:end */` exactly. Use
   `lib/generator/router/wiring.js` + `safety.buildRoutesContent`; never emit a
   `.get/.post(controllerMember)` reference.
4. **No dangling imports in generated code.** Anything the output requires is
   either emitted inline or registered under the right kind in
   `KIND_DEPENDENCIES` (+ `DEV_KINDS` when dev). Install through
   `ensureDependencies(kinds, { pm, install, extraKinds })` — never hand-roll
   `execSync("npm install …")`.
5. **`--dry-run` is sacred.** While the plan is active there is **no**
   filesystem mutation and **no** install/generation child process
   (`ensureDependencies` bails out; `init --express` records an `install` plan
   entry). `--no-install` and `--pm` must be honored by every install path.
6. **JSON envelope + stdout purity.** `printResult` in `lib/commands/shared.js`
   emits exactly one object (`{ok, created, skipped, plan?, nextSteps,
   message?, data?}`) with root-relative POSIX `created`/`skipped`. Under
   `--json`/`RAKITIN_JSON=1` stdout carries only that object: `lib/**` must
   contain zero `console.log|warn|error` except `lib/utils/logger.js`
   (enforced by an ESLint `no-console: error` rule scoped to `lib/**` with a
   logger override).
7. **No code execution as syntax checking.** Validate generated JS by compiling
   it (`new vm.Script(src)` / `node --check`) — never `require()` target files.
8. **Lazy paths everywhere.** Resolve via `getPaths(root)` at call time;
   destructuring constants at module load silently breaks cwd-isolated tests
   and `--cwd`.
9. **Tests are hermetic and behavior-first.** Real fs inside the suite's
   `global.tempDir`; never write into the repository; never hit the network.
   `npm test` must leave `git status --porcelain` empty and the
   `package.json`/`package-lock.json` hashes unchanged (the guard in
   `tests/setup.js` fails the run otherwise).
10. **Plugins are optional and never fatal.** The plugin layer must stay
    lazy (`lib/commands/plugin-seam.js`), loading errors are data
    (`errors[]`), and a malformed plugin must never abort a command. New
    dependency kinds contributed by plugins flow through `extraKinds`.
11. **Commits & docs stay in sync.** Public-facing changes update
    `docs/cli-reference.md` (+ the relevant tier/migration/feature doc) and
    `CHANGELOG.md` under `[Unreleased]`, with Conventional-Commit style
    messages (`feat(cli):`, `fix(safety):`, `refactor(commands):`,
    `feat(plugin):`, `chore!:`, `BREAKING CHANGE:`).

## Environment quirks agents trip on

- `jest.config.js` uses `clearMocks: true, resetMocks: false,
  restoreMocks: false`. Factory-defined mock implementations survive between
  tests, but call history is cleared; suites that mutate implementations must
  restore them in `beforeEach`/`afterAll`.
- `tests/setup.js` overrides `process.cwd` with a **plain function** (never
  `jest.fn`) and mocks `child_process` for every suite. Real spawning requires
  `global.__RAKITIN_REAL_CHILD_PROCESS__ = true` **before** requiring anything
  (see `tests/e2e/real-project.test.js`).
- `tests/setup.js` stubs `installer.internals.execCommand`/`spawn` in
  `beforeEach`; stub those seams instead of mocking node modules.
- The `afterAll` repo-integrity guard hashes `package.json` and
  `package-lock.json`; a suite that mutates either fails with
  `[hermetic] test run memodifikasi <file>`.
- `yargs@18` exports its factory as `module.exports`, so `bin/rakitin.js`
  invokes it (`loadYargs(args)`) instead of chaining off the required module.
  `.version(false)` keeps `--version` free for `add docs --api-version`;
  `--cli-version` prints the version.
- Generated project files are never required by tests — compile-only.

## Suggested agent workflow

1. `git status` clean check → `npm install` if `node_modules` is missing.
2. Reproduce the behavior headlessly in a throwaway temp project
   (`node bin/rakitin.js add module demo --arch modular --orm none --yes --no-install --json`),
   never inside the repo.
3. For a bug fix, add/extend a regression guard first (see
   `tests/regression/p0-bugfixes.test.js` style) — permanent tests must catch a
   plausible consumer-visible bug, not pin wording or incidental defaults.
4. Implement the minimal change honoring the Hard Rules.
5. Verify: `npm run lint && npm run typecheck && npm test`, then
   `git status --porcelain` must be empty. Run the specific smoke command that
   exercises the changed path before yielding.
