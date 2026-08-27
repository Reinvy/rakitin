# rakitin

[![npm version](https://img.shields.io/npm/v/rakitin.svg)](https://www.npmjs.com/package/rakitin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![tests passing](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/Reinvy/rakitin)

> Integration-first boilerplate CLI for Node.js/Express backend projects.
>
> Selamat datang di rakitin — CLI yang menempel ke proyekmu yang sudah ada, bukan memulai dari nol. 🇮🇩

---

## Why rakitin?

Most scaffolders only know how to create **greenfield** projects: they generate a fresh folder,
a fresh `package.json`, a fresh app skeleton — and then leave you alone. If you already have an
Express app running in production with real routes, real middlewares and real business logic,
traditional scaffolders are useless (or worse, destructive).

**rakitin is built on a different philosophy:**

| Principle          | Meaning                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Detect-first**   | rakitin introspects your project first — architecture, ORM, modules, package manager — before writing anything.             |
| **Additive-only**  | It generates new code *into* your existing project. Your files are never rewritten behind your back.                        |
| **Never destructive** | Router edits happen between explicit markers, existing files get `.bak` backups when overwritten on purpose, and `--dry-run` lets you preview every write plan before a single byte touches disk. |

The result: you can run `npx rakitin` inside a two-year-old Express monolith and come out with a
new module, wired routes, validators, and env keys — with zero manual untangling afterward.

## Requirements

- Node.js **>= 18**
- An npm-like package manager if you want auto-installs (`npm`, `pnpm`, `yarn`, or `bun`)

Dependencies shipped by the CLI itself are intentionally small: `yargs` (CLI parsing),
`inquirer` (interactive prompts), `ejs` (template rendering).

## Quick Start

Run it without installing anything:

```bash
# interactive menu at the root of your existing Express project
npx rakitin
```

Or install globally:

```bash
npm install -g rakitin
```

First run: initialize config:

```bash
# writes .rakitinrc.json using an auto-detected preset
rakitin init

# or pin it explicitly
rakitin init --preset intermediate --force
```

Then add your first module — headless or interactive:

```bash
# headless: module named "user", simple architecture, no ORM
rakitin add module user --arch simple --orm none --yes

# interactive fallback happens automatically when flags are missing
rakitin add module user
```

And finally wire everything into your router:

```bash
rakitin integrate
```

That's it. Every generated route is registered inside marker comments in your router file —
nothing else in your codebase was touched.

## Commands

| Command                            | Description                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `rakitin`                          | Interactive menu: Module / Middleware / Util / Config / Router Integration / API Endpoint / API Documentation / API Validation / Exit. |
| `rakitin init`                     | Writes `.rakitinrc.json`. Preset is auto-detected or set via `--preset basic\|intermediate\|advanced`. Use `--force` to regenerate an existing file. |
| `rakitin add module <name>`        | Generates a full CRUD module headless via `--arch simple\|modular` and `--orm none\|prisma\|sequelize\|mongoose\|typeorm`. Falls back to interactive prompts when flags are missing and `--yes` is not set. |
| `rakitin add middleware <kind>`    | Adds a middleware: `custom`, `auth`, `logger`, `error`, or `request-time`.                          |
| `rakitin add util <kind>`          | Adds a utility from a rich interactive menu (helpers, formatters, wrappers, etc.).                   |
| `rakitin add config <name>`        | Adds a config module: `app`, `database`, `jwt`, `cors`, `logger`, `mailer`, `cloud`, `payment`, `redis`, `socket`, `env`, or `custom`. Also writes matching keys into `env.example`. |
| `rakitin add endpoint`             | Rich interactive flow that generates CRUD endpoints against an existing module.                      |
| `rakitin add validation`           | Rich interactive flow that generates Joi validation schemas for a module.                            |
| `rakitin add docs`                 | Rich interactive flow for the API documentation stack.                                               |
| `rakitin recipe <name>`            | Composite advanced recipes: `auth`, `swagger`, `test`, `docker`. See [Recipes](#recipes).            |
| `rakitin integrate`                | Marker-based router integration for ALL detected modules. See below.                                 |
| `rakitin doctor`                   | Health check of your project: detection results, missing pieces, potential issues.                   |
| `rakitin info`                     | JSON-ish summary of the detected project structure.                                                  |
| `rakitin list`                     | Catalog of everything rakitin can generate.                                                          |
| `rakitin router`                   | Legacy alias of `integrate` — still works, kept for backwards compatibility.                         |

### `rakitin integrate` in detail

```bash
rakitin integrate --middleware auth,logger
```

- Finds **every** module in your project and wires them into `app/routes/index.js`.
- Respects **each module's real architecture**: a simple module gets simple wiring,
  a modular module gets modular wiring — never one-size-fits-all.
- Regeneration is **idempotent**: it only rewrites content between
  `/* rakitin:routes:start */` and `/* rakitin:routes:end */`.
- Routes you added manually **outside** the markers are preserved byte-for-byte.
- Middleware declared but not present on disk is **never emitted as a dangling `require()`**.
- When updating an existing router file, a `.bak` backup is created first.

## Global Flags

Available on every command:

| Flag                    | Alias | Description                                                                    |
| ----------------------- | ----- | ------------------------------------------------------------------------------ |
| `--cwd <dir>`           |       | Run against a different working directory (great for scripting).               |
| `--yes`                 | `-y`  | Skip confirmations, use defaults everywhere.                                   |
| `--overwrite`           | `-o`  | Allow overwriting existing files (still creates `.bak` backups).               |
| `--dry-run`             |       | Show the exact write plan. **Nothing is written.**                             |
| `--json`                |       | Machine-readable stdout — designed for CI pipelines and AI agents.             |
| `--no-install`          |       | Generate code without triggering dependency installation.                      |
| `--preset <p>`          |       | `basic` \| `intermediate` \| `advanced` (for `init`).                           |
| `--arch <a>`            |       | `simple` \| `modular` (for `add module`).                                      |
| `--orm <o>`             |       | `none` \| `prisma` \| `sequelize` \| `mongoose` \| `typeorm` (for `add module`). |
| `--pm <pm>`             |       | Force package manager: `npm` \| `pnpm` \| `yarn` \| `bun`.                       |
| `--middleware <list>`   |       | Comma-separated middleware names (for `integrate`).                             |

### CI-friendly usage

```bash
# dry-run first: inspect the plan, nothing gets written
rakitin add module order --arch modular --orm prisma --dry-run

# then execute headlessly with machine-readable output
rakitin add module order --arch modular --orm prisma --yes --json > result.json
```

## Integration Tiers

rakitin scales its output to how much you're willing to adopt. Three tiers:

### :green_circle: Basic — zero extra dependencies

Pure-Express modules with `--orm none`, plus middlewares, utils, and configs.
No new runtime dependencies required beyond what you already have — genuinely
drop-in for **any** existing Express app.

```bash
rakitin add module product --arch simple --orm none --yes
rakitin add middleware logger
rakitin add util validator
rakitin add config cors
```

### :yellow_circle: Intermediate — correct ORM wiring + validation

Adds exactly what your chosen ORM requires — correctly, per ORM:

- **Prisma**: appends models into your existing `prisma/schema.prisma` and adds a shared `config/db.js` singleton client.
- **Sequelize**: default-export model that matches what the generated service imports.
- **Mongoose**: kebab-case model files, consistent with convention-first projects.
- **TypeORM**: entity-based setup with `reflect-metadata`.

Also includes Joi validators, CRUD endpoints with safe pagination/filtering
codegen, and the marker-based `integrate` command.

```bash
rakitin add module invoice --arch modular --orm prisma --yes
rakitin add validation
rakitin integrate
```

### :red_circle: Advanced — recipes + full docs stack

Everything above, plus composite recipes (`auth`, `swagger`, `test`, `docker`)
and the complete API documentation stack.

```bash
rakitin init --preset advanced
rakitin recipe auth
rakitin recipe swagger
```

## Recipes

Recipes are composite generators: one command, several coordinated outputs.

### `recipe auth`

```bash
rakitin recipe auth
```

Stacks together:
1. JWT auth middleware
2. A **modular** user module (controller/service/model/validation)
3. Joi request validator for the auth flows
4. JWT-related env keys written into `env.example`

### `recipe swagger`

```bash
rakitin recipe swagger
```

Generates an OpenAPI 3 skeleton **pre-populated from your detected modules**
(paths derived from what actually exists in `app/routes`) plus the
`mountSwagger` setup so it's serving as soon as the app boots.

### `recipe test`

```bash
rakitin recipe test
```

Generates supertest suites **per existing module** (not per template) and adds
the `npm test` script if it's missing.

### `recipe docker`

```bash
rakitin recipe docker
```

Multi-stage `Dockerfile`, `docker-compose.yml`, and `.dockerignore` tuned to
your Node version.

## Safety Guarantees

Everything rakitin writes is governed by `lib/safety.js`. In practice:

- **Marker-based edits** — router integration only ever rewrites the region
  between `/* rakitin:routes:start */` and `/* rakitin:routes:end */`.
  Anything you wrote outside stays untouched.
- **Dry-run always available** — `--dry-run` prints the full write plan and
  performs **zero** filesystem mutations.
- **Backups before overwrite** — intentional overwrite operations create a
  `.bak` of the previous content first.
- **No silent clobbering** — without `--overwrite`, existing files are never
  replaced by generated output.

Router file, before first integration:

```js
// app/routes/index.js
const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true })); // yours

module.exports = router;
```

After `rakitin integrate --middleware auth,logger`:

```js
// app/routes/index.js
const express = require('express');
const router = express.Router();

/* rakitin:routes:start */
const userRoutes = require('../modules/user/user.routes');
const authMiddleware = require('../middlewares/auth.middleware');
const loggerMiddleware = require('../middlewares/logger.middleware');

router.use('/users', authMiddleware, loggerMiddleware, userRoutes);
/* rakitin:routes:end */

router.get('/health', (req, res) => res.json({ ok: true })); // still yours, byte-for-byte

module.exports = router;
```

Re-running `integrate` later regenerates only the marked block; the health
route survives unchanged forever.

## Library API

Every public subpath also ships TypeScript types (`types/index.d.ts`), works
from both CJS `require()` and ESM `import`, and can be used programmatically
without touching the CLI.

| Import path              | What you get                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `require("rakitin")`     | Root entry — main programmatic surface.                                             |
| `require("rakitin/config")` | Shared configuration accessors.                                                  |
| `require("rakitin/naming")` | Single-source naming utilities (`toIdentifier`, file/dir naming, etc.).           |
| `require("rakitin/utils")`  | General utilities.                                                                |
| `require("rakitin/utils/logger")` | Leveled logger.                                                            |
| `require("rakitin/ui")`     | UI helpers.                                                                        |
| `require("rakitin/ui/progress")` | Spinner / progress UI.                                                       |
| `require("rakitin/template")`    | Template engine facade.                                                      |
| `require("rakitin/template/engine")` | `TemplateEngine` class — real EJS wrapper with `renderString` cache and `renderFile` supporting EJS `include()`. |

Example:

```js
const { naming, TemplateEngine } = require("rakitin");

console.log(naming.toIdentifier("user-profile"));
// "userProfile"
```

## Project Structure

Templates ship as inline generator functions (not loose `.ejs` files), which keeps
generated output testable and refactor-safe.

```text
rakitin/
├── bin/
│   └── rakitin.js          # CLI entry point
├── lib/
│   ├── commands/           # yargs command layer
│   ├── deps/               # dependency registry + ensureDependencies()
│   ├── generator/          # inline template generator functions
│   ├── project/            # detector.js — project introspection
│   ├── template/           # engine.js — real-EJS TemplateEngine wrapper
│   ├── ui/                 # progress.js — spinner/progress UI
│   ├── utils/              # leveled logger + shared utils
│   ├── constants.js        # lazy getPaths()
│   ├── installer.js        # cross-platform installer (lockfile PM detection)
│   ├── naming.js           # single-source naming + toIdentifier sanitizer
│   └── safety.js           # safety layer: writeFileIfNotExistsSafe /
│                           # overwriteWithBackup / buildRoutesContent / dry-run plans
├── tests/
│   ├── unit/               # pure-function tests
│   ├── lib/                # lib-layer tests
│   ├── integration/        # multi-command flows
│   └── regression/         # guards every past P0 bug
├── types/
├── docs/
└── examples/
```

A few internals worth knowing about:

- `lib/deps/manifest.js` maintains a registry of optional dependencies and runs
  `ensureDependencies()` through the **detected** package manager (including
  `bun.lockb` lockfiles).
- `lib/installer.js` is cross-platform with injectable internals so tests can
  run without shelling out to real package managers.
- `lib/safety.js` exposes the entire non-destructive guarantee as reusable APIs.

## Development

Clone and develop locally:

```bash
git clone https://github.com/Reinvy/rakitin.git
cd rakitin && npm install
```

Key scripts:

| Script                | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `npm test`            | Run the Jest suite (300+ tests across unit/lib/integration/regression). |
| `npm run lint`        | ESLint.                                                         |
| `npm run typecheck`   | `tsc --noEmit` over JSDoc-typed sources.                        |
| `npm run build`       | Build CJS + ESM dist bundles via esbuild.                       |

Extra variants exist (`test:watch`, `test:coverage`, `test:unit`,
`test:integration`, `typecheck:strict`, `build:cjs`, `build:esm`,
`build:clean`).

### Quality signals

- **300+ Jest tests** across unit, lib, integration, and regression suites.
- The **regression suite guards every past P0 bug**, including:
  - every generated file must parse as valid JavaScript;
  - the no-ORM path must always work end-to-end;
  - router markers remain idempotent across regeneration;
  - `.bak` backups are preserved and never silently dropped;
  - syntax checks never rely on executing generated code.

## Contributing

Issues and pull requests are welcome! Please read
[CONTRIBUTING.md](./CONTRIBUTING.md) and the guides under [docs/](./docs)
(`architecture.md`, `adding-generators.md`, `coding-standards.md`,
`router-integration.md`, `module-examples.md`) before opening a PR.

## Roadmap

Planned features and long-term release strategy live in
[`rencana-pengembangan-jangka-panjang.md`](./rencana-pengembangan-jangka-panjang.md)
and [`strategi-rilis-dan-maintenance.md`](./strategi-rilis-dan-maintenance.md)
(in Bahasa Indonesia).

## License

MIT © [Reinvy](https://github.com/Reinvy)

Contact / issues: [github.com/Reinvy/rakitin/issues](https://github.com/Reinvy/rakitin/issues)
