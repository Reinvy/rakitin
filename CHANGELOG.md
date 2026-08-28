# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Interactive Wizard in `rakitin init`**: `rakitin init` now features an interactive guided setup for new Express generator project scaffolding (`npx express-generator --no-view`), default architecture selection (`modular`/`simple`), default ORM selection (`prisma`/`sequelize`/`mongoose`/`typeorm`/`none`), package manager selection (`npm`/`pnpm`/`yarn`/`bun`), and router auto-integration.
- **Express Generator Scaffolding**: Option to scaffold a fresh Express project directly via `npx express-generator --no-view` with automatic routing integration into `app.js` (`app.use('/api', rakitinRouter)`).
- **`rakitin config` CLI Command**: New `rakitin config` command (`list`, `get <key>`, `set <key> <value>`, and interactive) allowing easy management and modification of `.rakitinrc.json`.
- **Zero-Prompt Config-Driven Module Generation**: Module generation (`rakitin add module` and interactive menu) strictly respects `.rakitinrc.json` configuration, asking only for the module name without redundant intermediate prompts.
- **Automatic Router Integration**: Configurable `autoIntegrateRouter` automatically wires newly created modules into `app/routes/index.js`.
- **Production-Ready & Feature-Complete Auth Recipe (`recipe auth`)**: Upgraded `rakitin recipe auth` to generate a ready-to-use authentication setup with `bcryptjs` password hashing, JWT signing & verification (`auth.middleware.js`), full User models with `email` (`@unique`), `password`, `name`, `role`, and timestamps across all ORMs (Prisma 7, Sequelize, Mongoose, TypeORM, None), comprehensive Joi schemas (`registerSchema`, `loginSchema`, `updateProfileSchema`, `changePasswordSchema`), and complete endpoints (`register`, `login`, `getProfile`/`me`, `updateProfile`, `changePassword`, and sanitized user queries).

### Fixed
- **Prisma Package Auto-Installation**: Registered `@prisma/client` and `prisma` packages under `module:prisma` in `lib/deps/manifest.js` and updated installer checks, ensuring that whenever Prisma is selected (`init`, `add module --orm prisma`, `recipe auth`), `@prisma/client` and `prisma` are automatically installed if not already present in `package.json`.

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

[Unreleased]: https://github.com/Reinvy/rakitin/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Reinvy/rakitin/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/Reinvy/rakitin/compare/v1.0.0...v1.1.0
