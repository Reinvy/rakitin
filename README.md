# rakitin

[![npm version](https://img.shields.io/npm/v/rakitin.svg)](https://www.npmjs.com/package/rakitin)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![tests passing](https://img.shields.io/badge/tests-passing-brightgreen)](https://github.com/Reinvy/rakitin)

> Integration-first boilerplate CLI for Node.js/Express backend projects.
>
> Selamat datang di rakitin — CLI yang menempel ke proyekmu yang sudah ada,
> bukan memulai dari nol. 🇮🇩

---

## Why rakitin?

Most scaffolders only know how to create **greenfield** projects: a fresh
folder, a fresh `package.json`, a fresh skeleton — then they leave you alone.
If you already run an Express app in production with real routes, real
middlewares and real business logic, that model is useless (or destructive).

**rakitin is built on a different philosophy:**

| Principle | Meaning |
| --- | --- |
| **Detect-first** | rakitin introspects your project first — architecture, ORM, modules, package manager — before writing anything. |
| **Additive-only** | It generates new code *into* your existing project. Your files are never rewritten behind your back. |
| **Never destructive** | Router edits happen between explicit markers, re-writes keep a `.bak` backup, and `--dry-run` previews every write with **zero** filesystem mutation. |
| **Scriptable** | Every command is flag-complete and emits one JSON object under `--json` — built for CI pipelines and AI agents. |

You can run `npx rakitin` inside a two-year-old Express monolith and come out
with a new module, wired routes, validators, GraphQL/WebSocket wiring and env
keys — with no manual untangling afterwards.

## Requirements

- Node.js **`^22.13.0 || >=23.5.0`**
- An npm-like package manager if you want auto-installs (`npm`, `pnpm`, `yarn`
  or `bun`)

rakitin is **CommonJS only** (no ESM build) and its own runtime dependencies are
exactly `yargs` (CLI parsing), `inquirer` (the two remaining prompts) and `ejs`
(template rendering). ORM drivers, Express, GraphQL and `ws` are *not* shipped
by the CLI — they are installed into **your** project on demand, per ORM.

## Quick Start

Run it without installing anything:

```bash
npx rakitin
```

Or install it globally:

```bash
npm install -g rakitin
```

First run — initialize the project conventions:

```bash
rakitin init                      # auto-detected preset
rakitin init --preset intermediate --orm prisma --pm npm
```

Then add a module — headless or interactive:

```bash
# headless: module "user", modular architecture, no ORM (zero new packages)
rakitin add module user --arch modular --orm none --yes

# interactive fallback happens automatically when the positional is missing
rakitin add module user
```

And wire everything into your router:

```bash
rakitin integrate
```

Every generated route is registered inside marker comments in your router
file — nothing else in your codebase is touched.

## Commands

| Command | Description |
| --- | --- |
| `rakitin` | Project summary (package manager, Express version, module counts, preset, ORM, router marker state, plugin errors) + numbered next steps. Non-interactive, exit 0. |
| `rakitin init` | Write `.rakitinrc.json` (v3 schema) plus base router/ORM scaffolding. `--express` scaffolds a new Express app, `--force` regenerates the config with a `.bak`. |
| `rakitin config list\|get\|set` | Inspect or mutate `.rakitinrc.json`; keys are validated against the schema. |
| `rakitin add module <name>` | Full module (`--arch simple\|modular`, `--orm none\|prisma\|sequelize\|mongoose\|typeorm`, `--template crud\|readonly\|graphql\|realtime`, `--with-tests`). |
| `rakitin add middleware <kind>` | `custom`, `auth`, `logger`, `error`, `request-time` (`--custom-name` for custom). |
| `rakitin add util <kind>` | `custom, date, string, number, array, object, file, crypto, uuid, env, url, color, math, validation, regex, time`. |
| `rakitin add config <kind>` | `app, database, jwt, cors, logger, mailer, cloud, payment, redis, socket, env, custom` + an idempotent `.env.example` section. |
| `rakitin add endpoint <module>` | CRUD resource inside an existing module (`--resource`, `--fields`, `--no-pagination`, `--no-filtering`), mounted into the module router. |
| `rakitin add validation <name\|common>` | Joi schemas (`--fields`, `--from-module`, `--common`). |
| `rakitin add docs <kind>` | `openapi-json`, `openapi-yaml`, `swagger-ui`, `complete` (`--title`, `--api-version`, `--no-auth`). |
| `rakitin add test <module\|--all>` | Jest + supertest spec per module. |
| `rakitin add graphql [--module <m>]` | GraphQL layer (`graphql` + `graphql-http`) with per-module schema/resolver wiring. |
| `rakitin add websocket [--module <m>] [--path /ws]` | WebSocket layer (`ws`) with a handler registry. |
| `rakitin recipe auth\|swagger\|test\|docker` | Composite, production-shaped bundles. |
| `rakitin integrate` | Marker-based router integration for **all** detected modules. |
| `rakitin plugin list\|add\|remove\|info` | Manage plugins declared in `.rakitinrc.json`. |
| `rakitin doctor` | Health check: dangling requires, missing dependencies, router marker state, plugin errors. |
| `rakitin info` | Detected-project summary. |
| `rakitin list` | Catalog of everything rakitin can generate (derived from the live registries). |

Full flag reference, the JSON envelope and the per-command support matrix:
[`docs/cli-reference.md`](./docs/cli-reference.md).

### `rakitin integrate` in detail

```bash
rakitin integrate --middleware auth,logger
```

- Finds **every** module under `app/modules` and wires it into
  `app/routes/index.js`.
- Emits the **same shape for both architectures**:
  `const userRouter = require('../modules/user/routes/user.router.js')` +
  `router.use('/user', userRouter)`. It never references a controller member,
  so the old undefined-handler boot crash cannot happen.
- Regeneration only rewrites the region between
  `/* rakitin:routes:start */` and `/* rakitin:routes:end */`; routes you added
  outside the markers are preserved byte-for-byte.
- A middleware is wired only when its file exists on disk, and a module whose
  router file is missing is reported in `skipped[]` — **dangling `require()` is
  impossible**.
- The previous router content is kept as `index.js.bak` (then `.bak.1`, …).

## Global flags

Available on every command:

| Flag | Alias | Description |
| --- | --- | --- |
| `--cwd <dir>` | | Run against another project root. |
| `--yes` | `-y` | Non-interactive: use defaults, never prompt. |
| `--overwrite` | `-o` | Re-write files that already exist, keeping the previous content in a `.bak`. |
| `--dry-run` | | Print the exact write plan. **Nothing is written, nothing is spawned.** |
| `--json` | | Machine-readable stdout (also via `RAKITIN_JSON=1`). |
| `--no-install` | | Generate code without installing dependencies. |
| `--preset <p>` | | `basic` \| `intermediate` \| `advanced`. |
| `--arch <a>` | | `simple` \| `modular`. |
| `--orm <o>` | | `none` \| `prisma` \| `sequelize` \| `mongoose` \| `typeorm`. |
| `--pm <m>` | | `npm` \| `pnpm` \| `yarn` \| `bun`. |
| `--middleware <csv>` | | Middleware names to mount (for `integrate`). |
| `--cli-version` | | Print the rakitin version and exit. |

### CI-friendly usage

```bash
# 1. plan first: inspect every write, nothing happens
rakitin add module order --arch modular --orm prisma --dry-run --json | jq '.plan'

# 2. execute headlessly, machine-readable, offline
rakitin add module order --arch modular --orm prisma --yes --no-install --json \
  | jq -e '(.ok == true) and (.created | length > 0)'

# 3. wire + verify
rakitin integrate --json | jq -e '.data.wired | index("order")'
rakitin doctor --json | jq -e '.ok == true'
```

`--json` prints **exactly one** object on stdout:

```json
{
  "ok": true,
  "created": ["app/modules/order/controllers/order.controller.js"],
  "skipped": [],
  "nextSteps": ["Module 'order' otomatis terhubung di app/routes/index.js"],
  "data": { "module": "order", "architecture": "modular", "orm": "Prisma" }
}
```

`plan` appears only under `--dry-run` (`{op, path, backup?}`, ops
`create|overwrite|mkdir|install`), `created`/`skipped` are project-root-relative
POSIX paths, and a failure is `{ok:false, error}` with exit code 1.

## Integration tiers

rakitin scales its output to how much you are willing to adopt. `rakitin list`
labels every capability with its tier; the dependency matrices live in
[`docs/integration-tiers.md`](./docs/integration-tiers.md).

### :green_circle: Basic — zero extra dependencies

Pure-Express modules (`--orm none`), middlewares, utils and configs. Drop-in
for **any** existing Express app.

```bash
rakitin init
rakitin add module product --arch simple --orm none --yes
rakitin add middleware logger
rakitin add util uuid
rakitin add config cors
rakitin integrate
```

### :yellow_circle: Intermediate — ORM wiring, validation, API docs

Adds exactly what your ORM needs, plus Joi validators, resource endpoints,
GraphQL/WebSocket and OpenAPI specs.

```bash
rakitin add module invoice --arch modular --orm prisma --yes
rakitin add validation invoice --fields number:string:true,total:number
rakitin add endpoint invoice --resource items --fields label:string,amount:number
rakitin add graphql --module invoice
rakitin add websocket --module invoice
rakitin add docs openapi-yaml
```

### :red_circle: Advanced — recipes + the full production stack

```bash
rakitin init --preset advanced
rakitin recipe auth          # JWT middleware + user module + Joi validators + env keys
rakitin recipe swagger       # swagger-jsdoc spec + mount-ready app/docs entry
rakitin recipe test          # jest.config.js + tests/setup.js + specs per module
rakitin recipe docker        # multi-stage Dockerfile + .dockerignore
```

## Plugins

Extend rakitin from your own project — generators, commands, hooks and
dependency kinds:

```json
{
  "version": 3,
  "plugins": ["./plugins/audit.js", "rakitin-plugin-metrics"]
}
```

```bash
rakitin plugin list --json        # loaded plugins + load errors
rakitin add audit-log --yes       # invoke a plugin generator
```

See [`docs/plugin-authoring.md`](./docs/plugin-authoring.md) for the API v1
shape (`apiVersion`, `generators`, `commands`, `hooks`, `dependencies`) and the
`ctx` contract.

## Safety guarantees

Everything rakitin writes is governed by `lib/safety.js`:

- **Marker-based edits** — managed regions (main router, module resource
  blocks, GraphQL SDL, WebSocket registry) are regenerated in place; anything
  you wrote outside them stays untouched.
- **Dry-run always available** — `--dry-run` prints the full plan and performs
  **zero** filesystem mutations and **zero** install/generation child
  processes (`npx express-generator` is recorded as an `install` plan entry).
- **Backups before overwrite** — `--overwrite` and every managed-region
  rewrite keep the previous bytes in `<file>.bak` (then `.bak.1`, `.bak.2`, …
  — an existing backup is never clobbered).
- **No silent clobbering** — without `--overwrite`, an existing file is skipped
  and reported in `skipped[]`.
- **JSON files via one helper** — `package.json`/`.rakitinrc.json` are only
  mutated through `safety.updateJsonFile` (parse → mutate → `.bak`), and
  `.env.example` only through `safety.mergeEnvExample` (idempotent per marker).

Router file before the first integration:

```js
// app/routes/index.js
const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true })); // yours

module.exports = router;
```

After `rakitin integrate --middleware auth`:

```js
// app/routes/index.js
const express = require('express');
const router = express.Router();
/* rakitin:routes:start */
// rakitin-managed region: safe to regenerate.
// Keep custom entries OUTSIDE these markers.
const authMiddleware = require('../shared/middlewares/auth.middleware');
const userRouter = require('../modules/user/routes/user.router.js');

router.use('/user', userRouter, authMiddleware);
/* rakitin:routes:end */

router.get('/health', (req, res) => res.json({ ok: true })); // still yours, byte-for-byte

module.exports = router;
```

## Library API

`require("rakitin")` exposes the same building blocks the CLI uses, and every
subpath ships TypeScript types. Both CJS `require()` and ESM `import` work
(ESM consumers use CJS interop).

| Import path | What you get |
| --- | --- |
| `require("rakitin")` | `{ version, bareSummary, config, naming, safety, project, commands, deps, plugins }` |
| `require("rakitin/config")` | `Config`, `DEFAULT_CONFIG`, `CONFIG_KEYS`, `PRESETS` |
| `require("rakitin/naming")` | `toIdentifier`, `assertSafeName`, `getModuleVariants`, case converters |
| `require("rakitin/safety")` | write helpers, plan API, marker engine, `updateJsonFile`, `mergeEnvExample` |
| `require("rakitin/utils")` | `ensureDir`, `writeFileIfNotExists`, `relativePosix` (+ naming re-exports) |
| `require("rakitin/utils/logger")` | leveled logger |
| `require("rakitin/ui")` | `Spinner`, `ProgressBar`, `StepProgress` |
| `require("rakitin/ui/progress")` | the progress primitives |
| `require("rakitin/template")` | `TemplateEngine`, `renderTemplate`, `defaultEngine` |
| `require("rakitin/template/engine")` | the EJS wrapper itself |

```js
// CommonJS
const { naming, safety } = require("rakitin");
console.log(naming.toIdentifier("user-profile")); // "userProfile"

// ESM
import naming from "rakitin/naming";
console.log(typeof naming.assertSafeName); // "function"
```

## What changed in v3

- **CJS-only, Node `^22.13.0 || >=23.5.0`** — the ESM `dist/` build and the
  esbuild pipeline are gone; runtime deps are exactly `ejs`, `inquirer`,
  `yargs` (ORM drivers/Express/GraphQL/`ws` moved to devDependencies).
- **Legacy stack removed** — the bare interactive menu, `rakitin router`, the
  interactive module/router flows, and the `file-validator`/`path-resolver`/
  `error-handler` modules.
- **Uniform router wiring** — both architectures emit
  `const <id> = require(...)` + `router.use('/<kebab>', <id>)`, and generated
  controllers export the full verb set.
- **Verified contracts** — the JSON envelope (`created`/`skipped`/`plan`/
  `nextSteps`/`data`), the dry-run zero-mutation guarantee, `--no-install`/
  `--pm`, uniquely named `.bak` backups, and `updateJsonFile`/`mergeEnvExample`
  as the only JSON/env mutators.
- **New families** — plugin system, GraphQL, WebSocket, test-file generator,
  and per-module templates (`--template crud|readonly|graphql|realtime`).
- **Config schema v3** — `rakitin.schema.json` rejects every key outside the
  documented set (`additionalProperties: false`, `version: 3`).

Upgrading: [`docs/migration-v2-to-v3.md`](./docs/migration-v2-to-v3.md).

## Project structure

Templates are real `.ejs` files under `lib/templates/**`, rendered through the
EJS wrapper in `lib/template/engine.js` — no inline string generators.

```text
rakitin/
├── bin/rakitin.js          # CLI entry (yargs factory)
├── lib/
│   ├── index.js            # library entry
│   ├── commands/           # command layer (shared envelope, init, add, …)
│   ├── generator/          # codegen primitives (module/arch, module/orm, api/*, router/wiring)
│   ├── templates/          # EJS templates shipped with the package
│   ├── deps/manifest.js    # KIND_DEPENDENCIES + ensureDependencies
│   ├── plugins/            # plugin host (loader + registry)
│   ├── project/detector.js # detect-first project introspection
│   ├── template/engine.js  # EJS wrapper
│   ├── ui/ utils/          # spinner/progress + logger/utils
│   ├── constants.js        # lazy getPaths(root)
│   ├── installer.js        # cross-PM installer (spawn, shell:false)
│   ├── naming.js           # single-source naming + assertSafeName/toIdentifier
│   └── safety.js           # plan/.bak/markers/updateJsonFile/mergeEnvExample
├── types/index.d.ts        # declarations for every exports subpath
├── tests/                  # hermetic Jest suites (see tests/README.md)
├── docs/
└── examples/
```

## Development

```bash
git clone https://github.com/Reinvy/rakitin.git
cd rakitin && npm install
```

| Script | Purpose |
| --- | --- |
| `npm test` | Jest suite; must leave the git tree clean. |
| `npm run test:ci` | CI variant (`--ci --coverage --watchAll=false`). |
| `npm run test:unit` / `test:integration` / `test:e2e` | Focused suites. |
| `npm run test:real-project` | Standalone E2E smoke: spawns the real CLI in throwaway temp projects (always `--no-install`). |
| `npm run lint` / `lint:fix` | ESLint flat config (includes the `lib/**` `no-console` rule). |
| `npm run typecheck` | `tsc --noEmit` over `types/` (a real gate — no `skipLibCheck`). |
| `npm run format` / `format:check` | Prettier. |
| `npm start` | Run the CLI locally (`node bin/rakitin.js`). |

### Quality signals

- Hermetic tests: each suite gets its own `mkdtemp` cwd, `child_process` is
  blocked, and `package.json`/`package-lock.json` are hash-guarded.
- CI runs Node 22.x/24.x with a `git diff --exit-code` tree-dirty gate and a
  `jq -e .` stdout-purity step.
- Generated JS is validated by compiling it (`new vm.Script` / `node --check`),
  never by executing it.

## Contributing

Issues and pull requests are welcome! Please read
[CONTRIBUTING.md](./CONTRIBUTING.md) and the guides under [docs/](./docs)
(`architecture.md`, `adding-generators.md`, `plugin-authoring.md`,
`coding-standards.md`, `module-examples.md`) before opening a PR.

## Roadmap

Planned features and the long-term release strategy live in
[`rencana-pengembangan-jangka-panjang.md`](./rencana-pengembangan-jangka-panjang.md)
and [`strategi-rilis-dan-maintenance.md`](./strategi-rilis-dan-maintenance.md)
(in Bahasa Indonesia).

## License

MIT © [Reinvy](https://github.com/Reinvy)

Contact / issues: [github.com/Reinvy/rakitin/issues](https://github.com/Reinvy/rakitin/issues)
