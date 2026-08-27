# AGENTS.md — Guide for AI coding agents working on rakitin

This document teaches automated agents (Claude Code, Cursor, Devin, etc.) how
to work safely inside this repository. Human contributors benefit too.

## Project snapshot

- **What**: `rakitin` is an integration-first boilerplate CLI for Node.js/Express
  backends (npm package, CommonJS, binary `bin/rakitin.js`).
- **Non-negotiable promise to users**: we never destroy user code. Every write
  goes through the safety layer; router edits are marker-based and idempotent.
  If your change breaks that guarantee, it breaks the product.
- Runtime: Node **>=18**. Deps: `yargs`, `inquirer`, `ejs`. No other runtime deps
  may be added without updating `lib/deps/manifest.js` documentation.

## Command cheat-sheet

```bash
npm install            # setup
npm test               # full Jest suite (~320 tests, must stay green)
npx jest tests/regression -t "<name>"   # run a single regression guard
npm run lint           # eslint (flat config)
npm run typecheck      # tsc --noEmit over types/
npm start              # run the interactive CLI locally
node bin/rakitin.js list / doctor / info --json    # smoke commands
```

## Repo map

| Path | Purpose |
|------|---------|
| `bin/rakitin.js` | yargs command surface + global flags |
| `index.js` | legacy interactive menu; exports `{ main, run }`, auto-runs only when `require.main === module` |
| `lib/naming.js` | **single source** of all naming: case converters, `normalizeModuleName`, `toIdentifier` sanitizer, `getModuleVariants` |
| `lib/constants.js` | lazy path getters + `getPaths(root)` factory (never capture cwd at require time) |
| `lib/safety.js` | safety layer: `writeFileIfNotExistsSafe`, `overwriteWithBackup` (.bak), dry-run plan API (`beginPlan/getPlan/resetPlan`), `buildRoutesContent` marker injection between `/* rakitin:routes:start */ … end */` |
| `lib/project/detector.js` | introspects existing projects (express, ORMs, pm lockfiles, module inventory per architecture, router marker state) |
| `lib/deps/manifest.js` | generator-kind → dependency registry (`KIND_DEPENDENCIES`) + `ensureDependencies()` one-shot installer |
| `lib/commands/*` | command layer: shared context/json/printResult, init, add, integrate, recipe, info/doctor/list |
| `lib/generator/**` | generators (module arch+orm, middleware, util, config, router, api endpoint/validation/documentation) with non-interactive cores where headless matters (`createMiddleware`, `createConfig`) |
| `lib/template/engine.js` | EJS-backed wrapper (`TemplateEngine`, `renderTemplate`, `defaultEngine`) — multi-line templates work; use for any NEW templating need |
| `tests/setup.js` | per-suite isolated temp dir via `mkdtempSync(os.tmpdir())`; overrides `process.cwd` with a PLAIN function |

## Hard rules (violations = rejected change)

1. **Write through the safety layer.** Generators must use
   `safety.writeFileIfNotExistsSafe`, `utils.writeFileIfNotExists` (auto-plan-aware
   delegate) or `safety.overwriteWithBackup`. Raw `fs.writeFileSync` against user
   project files is only allowed in bin fallback/legacy paths you can justify.
2. **Never interpolate raw user names into generated identifiers.** Use
   `require("./naming").toIdentifier(name)` — hyphenated/digit/reserved-word
   inputs MUST produce valid JS (guarded by tests/regression/p0-bugfixes.test.js).
3. **Router regeneration = marker region only.** Preserve bytes outside
   `/* rakitin:routes:start */ … /* rakitin:routes:end */` exactly. `buildRoutesContent`
   is the only sanctioned engine for this.
4. **No dangling imports in generated code.** Anything the output requires must be
   either emitted inline or registered under the right kind in
   `KIND_DEPENDENCIES`. Auto-install via `ensureDependencies(kinds)` using the
   detected package manager — never hand-roll `execSync("npm install …")`.
5. **No code execution as syntax checking.** Validate generated JS by compiling
   (`new vm.Script(src)`) in tests — never `require()` target files (B9 history).
6. **Lazy paths everywhere.** New modules resolve via `getPaths(root)` at call time;
   destructuring constants at module load silently breaks cwd-isolated tests.
7. **Tests are behavior-first, disk-based.** Prefer real fs inside the suite's
   temp dir + `vm.Script` compile assertions over mocking fs/cwd. Stub shell via
   `installer.internals.execCommand`; do not add network calls anywhere in the
   unit/integration surface.
8. **Commits & docs stay in sync.** Public-facing changes update
   `docs/cli-reference.md` (+relevant tier/migration doc) and
   `CHANGELOG.md` under `[Unreleased]` with Conventional-Commit style messages,
   same language conventions as git history (feat:, fix:, chore:, refactor:).

## Environment quirks agents trip on

- `jest.config.js` uses `clearMocks:true, resetMocks:false, restoreMocks:false`.
  Factory-defined mock implementations survive between tests, but call history is
  cleared; suites that mutate implementations must restore them in `beforeEach`.
- `tests/setup.js` mocks `process.cwd` AFTER module load of test files, so any
  lazily-captured constant captured at import time sees the REAL repo path —
  write nothing outside the temp dir during collection phase.
- Parallel workers previously raced on one shared folder; now each suite has its
  own mkdtemp dir exposed as `global.tempDir`.

## Suggested agent workflow

1. `git status` clean check → `npm install` if node_modules missing.
2. Reproduce on the relevant command via headless flags
   (`node bin/rakitin.js add module demo --arch modular --orm none --yes --json`).
3. Add/extend a regression guard first when fixing a bug (see
   `tests/regression/p0-bugfixes.test.js` style).
4. Implement minimal change honoring Hard Rules.
5. `npm test && node bin/rakitin.js doctor` in a throwaway dir before committing.
