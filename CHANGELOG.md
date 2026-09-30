# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.0.0] - 2026-09-30

### Added

- `feat(cli)`: `--cli-version` (yargs is built with `.version(false)`, so
  `--version` is free for `add docs --api-version`); bare `$0` prints a
  non-interactive project summary + next steps and exits 0.
- `feat(cli)`: `rakitin add graphql [--module <m>]` — GraphQL layer
  (`graphql` + `graphql-http`, `app/graphql/**`, `mountGraphQL(app, basePath)`,
  a `graphql({source})` execution helper, per-module SDL/resolver wiring in the
  managed `rakitin:graphql:` regions).
- `feat(cli)`: `rakitin add websocket [--module <m>] [--path </ws>]` —
  `ws` transport (`app/ws/**`), `attachWebSocket(server, { path })`, JSON
  `{event,data}` envelope, `<event>:ack` replies, an `error` envelope, a 30 s
  heartbeat, and a handler registry in the `rakitin:ws:` region.
- `feat(cli)`: `rakitin add test <module|--all>` and `add module --with-tests`
  — one shared template renders `tests/modules/<kebab>.test.js` (structure
  assertions + a `SKIP_HTTP_TESTS=1`-gated supertest smoke); `generateTestFiles`
  is finally consumed.
- `feat(cli)`: per-module templates `--template crud|readonly|graphql|realtime`
  (readonly renders only `getAll`/`getById` in controller *and* router; graphql
  and realtime additionally wire the GraphQL/WebSocket layers).
- `feat(plugin)`: plugin system — `.rakitinrc.json#plugins` (package name or
  relative path), API v1 (`apiVersion`, `name`, `generators`, `commands`,
  `hooks`, `dependencies`), `preGenerate`/`postGenerate`/`preInstall`/
  `postInstall`/`onError` hooks fired from `runWithPlugins`/
  `runWithPluginInstall`, plugin generators reachable as
  `rakitin add <generator-id>` (core ids cannot be shadowed), plugin-declared
  dependency kinds merged through `extraKinds`, and load errors surfaced as
  data by `plugin list`/`info` and as `warn` checks by `doctor`.
- `feat(cli)`: `rakitin plugin list|add|remove|info` — the config file is the
  single source of truth, mutated through `updateJsonFile`; `remove` deletes the
  key when the list empties so `package.json#rakitin.plugins` is not shadowed.
- `feat(commands)`: headless parity for `add endpoint` (`--resource`,
  `--fields`, `--no-pagination`, `--no-filtering`), `add validation`
  (`--fields`, `--from-module`, `--common`), `add docs` (`--title`,
  `--api-version`, `--no-auth`) and `add util` — every previously interactive
  flow is flag-complete.
- `feat(init)`: interactive-free `rakitin init` with Express scaffolding
  (`npx express-generator --no-view`), base ORM scaffolding, `.env.example`
  sections and a v3 `.rakitinrc.json`.
- `feat(config)`: `rakitin config list|get|set` against the v3 schema key
  allowlist (values coerced and validated; `version` must be `3`).
- `feat(recipe)`: `recipe auth` upgraded to a production-shaped bundle
  (`bcryptjs` hashing, full user model per ORM, Joi schemas, JWT env keys);
  `recipe docker` resolves a real entrypoint
  (`app/server.js → bin/www → index.js → app.js`) and fails with exit 1 when
  none exists.
- `feat(deps)`: `KIND_DEPENDENCIES` completed (`config:*`, `util:*`,
  `validation:joi`, `docs:*`, `graphql:core`, `websocket:ws`, `test:dev`,
  `recipe:auth`) so generated code never ships a dangling import; unknown kinds
  are a hard error.
- `feat(cli)`: `npm run test:real-project` runs the CLI in throwaway temp
  projects (always `--no-install`) and exits non-zero on any scenario failure.
- `feat(test)`: `tests/regression/public-api.test.js` pins the runtime export
  names of every `exports` subpath against `types/index.d.ts`.

### Changed

- `refactor(commands)`: the router wiring engine
  (`lib/generator/router/wiring.js`) emits one shape for **both**
  architectures (`const <id> = require(...)` + `router.use('/<kebab>', <id>)`),
  removing the undefined-handler boot crash class; modules whose router file is
  missing are reported in `skipped[]` instead of producing a dangling require.
- `refactor(commands)`: `printResult` is the single envelope writer —
  `created`/`skipped` are project-root-relative POSIX paths, `plan` is emitted
  only under `--dry-run` (`{op, path, backup?}`), `ok` is real, `message` is
  preserved, and failures are `{ok:false, error}` with exit 1.
- `refactor(safety)`: `updateJsonFile` is the only sanctioned JSON mutator and
  `mergeEnvExample(root, marker, content)` the only `.env.example` writer;
  backups are uniquely named (`.bak`, `.bak.1`, …) and never clobbered;
  `resetPlan()` clears the dry-run latch; `setOverwrite`/`isOverwrite` wire
  `--overwrite` (re-write with a `.bak` instead of skipping).
- `refactor(deps)`: every install goes through `ensureDependencies` with
  `spawn(command, args, { shell:false })`; retries happen only for
  network/registry failures; `--no-install`, `--pm` and `--dry-run` are honored
  by every path (the per-ORM `execSync("npm install …")` calls are gone).
- `refactor(naming)`: `assertSafeName` guards every user-name ingress (path
  traversal, `..`, leading dots, control characters) and every generated
  identifier comes from `toIdentifier`/`getModuleVariants`.
- `chore(deps)`: runtime dependencies are exactly `ejs`, `inquirer`, `yargs`;
  ORM drivers, Express, `graphql`, `graphql-http`, `ws`, `yaml` and `fs-extra`
  moved to devDependencies; `require("fs-extra")` no longer exists under `lib/`,
  `bin/` or `lib/index.js`.
- `chore(pkg)`: CJS-only package (`main: lib/index.js`, `types`, explicit
  `exports` subpaths with `types` + `default`); the ESM `dist/` build, the
  esbuild pipeline, the build scripts and the `postinstall` hook are removed;
  `files` ships `lib/**` (including `lib/templates/**`), `bin`, `types`,
  `rakitin.schema.json`, `docs`, `README.md`, `CHANGELOG.md`, `LICENSE`.
- `chore(config)`: `rakitin.schema.json` bumped to `version: { const: 3 }` with
  `additionalProperties: false` and exactly the keys `init` writes + `plugins`;
  the `Config` loader is now consumed by `buildContext`.
- `chore(test)`: hermetic harness — per-suite mkdtemp cwd, `child_process`
  blocked via `__mocks__/child_process.js`, `package.json`/
  `package-lock.json` hash-guarded, installer seams stubbed; tests that could
  not fail (mock echoes, byte-golden fixtures, real spawns, `not.toThrow` on
  async functions) were deleted or rewritten.
- `chore(ci)`: matrix Node 22.x/24.x, a `git diff --exit-code` tree-dirty gate,
  a `jq -e .` stdout-purity step, and a dry-run zero-mutation smoke job.

### Fixed

- `fix(cli)`: the CLI was dead under yargs 18 (`TypeError: yargs.scriptName is
  not a function`) — the factory is now invoked as `loadYargs(args)`.
- `fix(cli)`: bare `rakitin` never ran anything; it now prints the summary.
- `fix(safety)`: `--dry-run` installed packages, rewrote `.env.example`/
  `package.json` and ran `npx express-generator` — it now performs zero
  filesystem mutations and zero install/generation child processes.
- `fix(safety)`: `.bak` files were clobbered on every write.
- `fix(safety)`: `resetPlan()` left dry-run latched on.
- `fix(generator)`: modular + sequelize/mongoose wrote a placeholder model that
  shadowed the real one (services then called `Order.findAll` on `{}`); the
  placeholder is now written only for `orm === "None"`.
- `fix(generator)`: simple-architecture wiring referenced `controller.create`
  (undefined) and crashed at boot with
  `Route.post() requires a callback function`.
- `fix(generator)`: generated controllers now export the full verb set and the
  module router registers all five verbs.
- `fix(commands)`: `created`/`skipped` returned booleans or `createdFiles`
  (dropped by `printResult`) — every generator now returns root-relative path
  arrays.
- `fix(security)`: path traversal through `add middleware custom ../../evil` and
  `add endpoint --module ../../escaped` wrote outside `app/` — every ingress is
  validated.
- `fix(security)`: raw user names were interpolated into generated identifiers
  (`req.body.<name>`, `filters.<name>`, `const <pascal>Controller`), producing
  unparseable output.
- `fix(doctor)`: one hardcoded dependency check; it now detects dangling
  requires, derives missing dependencies from `KIND_DEPENDENCIES`, reports
  plugin load errors and parses the router with `vm.Script`.
- `fix(prisma)`: the deprecated `package.json#prisma.schema` pointer write is
  gone; `DATABASE_URL` is merged into `.env.example` on every path and
  `prisma.config.js` requires an installed `dotenv`.
- `fix(docs)`: an unknown `add docs` kind returned success with an empty
  `created[]`, and `complete` failed after writing files because
  `docs:complete` was unregistered; the kind is now validated before any write
  and `complete`/`swagger-ui` map to `docs:swagger-ui`.
- `fix(installer)`: `getPackageManager()` ignored its `root` argument, shell
  interpolation was used for package specs, and deterministic failures were
  retried; all three are fixed.
- `fix(recipe)`: `recipe docker` targeted a file no generator writes; the
  entrypoint is resolved from the real candidates.
- `fix(types)`: `types/index.d.ts` declared ~13 non-existent re-exports and
  redeclarations, and `npm run typecheck` was a no-op (`skipLibCheck`); the
  declarations now match the runtime surface and the gate is real.

### Removed

- `chore!`: the `router` command, the legacy interactive menu (`index.js`,
  `lib/prompt.js`), the interactive module/router flows
  (`lib/generator/module/module.js`, `lib/generator/router/router.js`) and
  `lib/generator/shared/{file-validator,path-resolver,error-handler}.js`.
- `chore!`: `dist/`, `build.config.js` and the build scripts; the `dist/`
  tarball shipped a stale second CLI (ESM syntax resolved as CJS, missing
  `templates/**`).
- `chore!`: the `postinstall: prisma skills sync` hook and ORM libraries as
  runtime dependencies.
- `chore`: dead exports (`installer.installIfNeededSync`/
  `isPackageInstalledAsync`/`getAvailablePackageManagers`, `PathCache`/
  `getCachedModulePath`/`clearPathCache`, unused `constants.js` getters,
  `RECIPES[*].deps`).

### Breaking changes

- Node baseline is `^22.13.0 || >=23.5.0` (was `>=18`); the package is
  CJS-only and ESM consumers use CJS interop.
- `rakitin router` and the bare interactive menu are gone (use `integrate`).
- Generated router wiring shape changed for both architectures; controllers now
  export the full verb set.
- `--json` gained `plan` and the exact envelope contract
  (`created`/`skipped`/`plan?`/`nextSteps`/`message?`/`data?`).
- `rakitin.schema.json` v3 rejects every key outside the documented set.
- The `package.json#prisma.schema` write was removed (multi-file
  `prisma/schema/*.prisma` + `prisma.config.js` is the pointer).

Migration guide: [`docs/migration-v2-to-v3.md`](./docs/migration-v2-to-v3.md).

### Previously unreleased v2-era work now folded into v3

- `feat(init)`: interactive-guided `init` wizard (Express scaffolding,
  architecture/ORM/package-manager selection, router auto-integration) — the
  non-interactive flags remain the supported surface.
- `feat(config)`: `rakitin config` command for managing `.rakitinrc.json`.
- `feat(recipe)`: production-ready `recipe auth` (bcryptjs, full user models
  across Prisma/Sequelize/Mongoose/TypeORM/None, Joi schemas, complete
  endpoints).
- `fix(deps)`: Prisma package auto-installation registered under
  `module:prisma` so `init`/`add module --orm prisma`/`recipe auth` install
  `@prisma/client` and `prisma` when missing.
- `feat(cli)`: zero-prompt, config-driven module generation (only the module
  name is asked when flags are missing and `--yes` is absent) and configurable
  `autoIntegrateRouter`.

## [2.0.0] - 2026-08-27

Integration-first rewrite ("detect-first, never destructive") with a new
command surface, hardened generators, and a full documentation pass.
See `docs/migration-v1-to-v2.md` for the breaking-change guide.

### Added
- **Command surface (yargs)**: `init`, `add <thing> [name]`, `recipe <name>`,
  `integrate`, `doctor`, `info`, `list` with global flags
  `--cwd --yes --overwrite --dry-run --json --no-install --preset --arch
  --orm --pm --middleware`. Legacy interactive menu remains default when run
  bare; `router` kept as a legacy alias.
- **Headless mode**: every primary generator runs flag-complete without any
  prompt; `--json` emits machine-readable summaries designed for CI and AI
  agents; next-steps block after each action in human mode.
- **Safety layer** (`lib/safety.js`): write-if-absent contract,
  `.bak` backups on controlled overwrite, first-class **dry-run plan API**
  (`beginPlan/getPlan/resetPlan`) that records writes without touching disk,
  and idempotent marker-based router injection between
  `/* rakitin:routes:start */ … /* rakitin:routes:end */`.
- **Project detector** (`lib/project/detector.js`): express presence, installed
  ORMs, lockfile-based package-manager detection (npm/pnpm/yarn/bun incl.
  `bun.lockb`), per-module architecture inventory, router marker state,
  `.rakitinrc` discovery — powers `init`, `integrate`, `info`, `doctor`.
- **Unified dependency manifest** (`lib/deps/manifest.js`): generator-kind →
  packages registry plus one-shot `ensureDependencies()` using the detected
  package manager; removes scattered per-generator installs.
- **Advanced recipes** (`recipe auth|swagger|test|docker`): JWT composite
  (middleware + user module + Joi validator + env keys), OpenAPI 3 skeleton
  pre-populated from detected modules + mountSwagger setup, supertest scaffold
  for all existing modules (+ npm `test` script injection), Docker multi-stage
  stack. All recipes are safety-layer routed and idempotent.
- **Naming core** (`lib/naming.js`): single source of case converters +
  `toIdentifier` sanitizer guaranteeing valid JS identifiers from arbitrary
  input (hyphen/digit/reserved-word safe) + `getModuleVariants`.
- **Lazy path resolution** (`lib/constants.js`): `getPaths(root)` factory;
  destructure-at-load removed across ALL generators so cwd overrides are honored
  at call time.
- **Template engine replaced by real EJS** wrapper (`lib/template/engine.js`):
  multi-line templates now work (the hand-rolled engine failed on any
  multi-line source), include() support via filename-bound compilation,
  LRU-ish cache, locals fallbacks; public API `{TemplateEngine, renderTemplate,
  defaultEngine}`.
- Library subpath exports: `./naming`, repaired `./utils` / `./ui` /
  `./template` barrels; LICENSE (MIT text), CODE_OF_CONDUCT, AGENTS.md for AI
  contributors; docs: cli-reference, integration-tiers, migration-v1-to-v2,
  rewritten architecture/coding-standards/adding-generators/router-integration/
  module-examples.
- Tooling: ESLint v9 flat config (0-error gate), Prettier (.prettierrc +
  format scripts), modernized CI workflow (Node 18/20/22 × 3 OS matrix,
  non-no-op lint/typecheck/build jobs, end-to-end headless smoke job with a
  dry-run leak detector).

### Fixed
- No-ORM module generation crashed outright (empty `none.orm.js`; service
  switch threw "ORM None tidak didukung") → functional zero-dependency
  in-memory CRUD service.
- Router integration produced invalid JS for hyphenated module names
  (`const user-profileRouter`) → identifier sanitization everywhere.
- Auto-router output crashed at boot (`normalizeModuleName is not defined`)
  → generated file is fully self-contained with embedded helpers.
- Installer was Windows-only (`spawn('cmd', …)`) → cross-platform shell spawn;
  bun support added; legacy-arity call mishandling fixed; ORM install promise
  is awaited (was fire-and-forget crashing its own success handler).
- Endpoint generator emitted guaranteed `ReferenceError` when pagination or
  filtering was disabled (query variables conditionally declared but always
  used) → query-parsing block always emitted with safe defaults; schema-driven
  filtering replaces hardcoded `item.title/status`.
- Endpoint simple-mode wrote contradictory twin controllers (camelCase copy
  silently dropping the field schema) → single kebab-case controller reused by
  its resource router; kebab require paths aligned with written filenames.
- Joi validator shipped syntax errors twice over: stray `n` prefix line AND
  missing commas between properties (both caught by new regression suite).
- Prisma flow created inert model files nothing consumed → models are appended
  into `prisma/schema.prisma` idempotently + `app/shared/config/db.js`
  singleton emitted; Mongoose service import matched to kebab filenames;
  Sequelize model export/import pair made consistent (default export).
- Security: `FileValidator.validateJavaScriptFile` executed target files via
  `require()` as a "syntax check" → compile-only `vm.Script`.
- Blind overwrite of an existing `app/routes/index.js` destroyed user edits →
  marker-region replacement only, byte-preserving outside markers, `.bak` on
  update.
- Test infrastructure races (shared `tests/temp` between parallel workers +
  `resetMocks:true` wiping implementations including the cwd mock mid-suite)
  → per-suite `mkdtempSync(os.tmpdir())` isolation and plain-function cwd
  override; full suite green from previously 49 failing tests.

### Changed
- Interactive global-middleware choices narrowed to what the middleware
  generator actually produces (`auth/logger/error/request-time`) — removed
  options whose generated requires could never resolve; new `integrate`
  command wires only middleware files that exist on disk (never emits dangling
  imports).
- Modular router validation relaxed to require only the relevant `routes/`
  directory (controllers/services/models no longer enforced).
- Node engines raised to `>=18` (inquirer v12 baseline); CI matrix modernized
  accordingly (Node 18/20/22).

### Removed
- Dead code: `generator/shared/integration-helper.js` (~477 lines),
  `handleAutoRouterIntegration` (~256 lines), unused constants templates
  (`mainRouterTemplate`, `appJsTemplate`, six `*MiddlewareTemplate` exports),
  triple-duplicated naming helpers, unreachable template-engine transforms.
- Hand-rolled template engine superseded by EJS wrapper (breaking import
  change documented in migration guide).

## [1.1.0] - 2025-XX-XX

> Backfilled from git history — exact date unavailable for this tag.

### Added
- API generation suite: endpoints (CRUD w/ pagination/filtering prompts),
  documentation (OpenAPI JSON/YAML/Swagger UI flows), validation (Joi schemas:
  from-module/new/common) exposed in the interactive menu.
- Main-router integration feature entering the interactive menu.
- Multi-ORM module scaffolding (Prisma/Sequelize/Mongoose/TypeORM) with
  advanced config generation variants and auto-installer groundwork.
- Middleware & utility generator families; shared error-handler,
  file-validator and path-resolver foundations; TypeScript declarations under
  `types/`.

### Fixed
- Removed unused Prisma dependencies leftovers; version metadata refresh
  (author attribution to Reinvy).

[Unreleased]: https://github.com/Reinvy/rakitin/compare/v3.0.0...HEAD
[3.0.0]: https://github.com/Reinvy/rakitin/compare/v2.0.0...v3.0.0
[2.0.0]: https://github.com/Reinvy/rakitin/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/Reinvy/rakitin/compare/v1.0.0...v1.1.0
