# Migrating from rakitin v2 to v3

v3 is a hardening + contract-completion release: every documented behavior is
now machine-verified, the legacy interactive stack is gone, and four new
capability families shipped. This guide lists every breaking change with a
concrete before/after.

Read it top to bottom if you are upgrading an existing project; skim the
headings if you are only here for one change.

---

## 1. Runtime baseline

| | v2 | v3 |
| --- | --- | --- |
| Node | `>=18` | `^22.13.0 || >=23.5.0` |
| Module format | CJS sources + a checked-in ESM `dist/` build | **CommonJS only** — `dist/` and the esbuild pipeline are gone |
| Runtime dependencies | `ejs`, `inquirer`, `yargs` **plus** `@prisma/client`, `mongoose`, `mysql2`, `prisma`, `sequelize` | exactly `ejs`, `inquirer`, `yargs` |
| `postinstall` | `prisma skills sync` | removed |
| Library entry | `index.js` exporting `{ main, run }` (an interactive menu) | `lib/index.js` exporting the real API (see §6) |

The Node floor comes from the intersection of the CLI's own dependency
engines: `inquirer@14` declares `>=23.5.0 || ^22.13.0 || ^20.17.0`, and
`yargs@18` declares `^20.19.0 || ^22.12.0 || >=23`.

**Action:** upgrade CI runners to Node 22.13+ or 23.5+; if you consumed
`rakitin`'s `dist/`, switch to the `lib/` entry (ESM consumers use CJS
interop — see §6).

---

## 2. Removed commands and flows

| Removed | Replacement |
| --- | --- |
| `rakitin router` (interactive router integration) | `rakitin integrate` (+ `--middleware <csv>`) |
| Bare `rakitin` → interactive menu | Bare `rakitin` prints a non-interactive project summary + next steps, exit 0 |
| Interactive module flow (`lib/generator/module/module.js`) | `rakitin add module <name> --arch … --orm … --yes` |
| Interactive `add util` / `add endpoint` / `add validation` / `add docs` menus | flag-complete headless commands |
| `config` interactive mode + key aliases (`arch` → `defaultArchitecture`) | `rakitin config list\|get\|set <key> <value>` against the v3 schema keys |
| `index.js`, `lib/prompt.js`, `lib/generator/router/router.js`, `lib/generator/shared/{file-validator,path-resolver,error-handler}.js` | deleted; their duties moved to `lib/naming.js`, `lib/safety.js`, `lib/generator/router/wiring.js` |

```bash
# v2
rakitin router
printf 'uuid\n' | rakitin add util
printf 'product\nreviews\ntitle:string\nY\nY\n' | rakitin add endpoint

# v3
rakitin integrate
rakitin add util uuid
rakitin add endpoint product --resource reviews --fields title:string
```

`rakitin add module` and `rakitin add middleware` keep an interactive
fallback, but only when the positional argument is missing **and** `--yes` is
not set.

---

## 3. Generated router wiring (breaking)

v2 wired the two architectures differently, and the simple variant emitted
handler references that the generated simple controller did not export — the
project crashed at boot with
`Route.post() requires a callback function`.

**v2 output**

```js
// modular
const userProfileRouter = require('../modules/user-profile/routes/user-profile.router');
router.use('/user-profile', userProfileRouter);

// simple  ← broken: paymentController.create / .update / .remove did not exist
const paymentController = require('../modules/payment/payment.controller');
router.get('/payment', paymentController.getAll);
router.post('/payment', paymentController.create);
```

**v3 output — uniform for both architectures**

```js
/* rakitin:routes:start */
// rakitin-managed region: safe to regenerate.
// Keep custom entries OUTSIDE these markers.
const userProfileRouter = require('../modules/user-profile/routes/user-profile.router.js');
const paymentRouter = require('../modules/payment/payment.router.js');

router.use('/user-profile', userProfileRouter);
router.use('/payment', paymentRouter);
/* rakitin:routes:end */
```

Consequences:

- The generated controller now exports the **full verb set**
  (`getAll, getById, create, update, remove`), and the module router
  registers `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`.
- The undefined-handler boot-crash class is gone: wiring never references a
  controller member.
- Require paths carry the `.js` suffix and are relative to
  `app/routes/index.js`.
- A module whose router file is missing is reported in `skipped[]` and
  excluded — a dangling `require` is structurally impossible.

**Action:** re-run `rakitin integrate` after upgrading; it rewrites only the
marked region and keeps a `.bak`. Custom routes outside the markers are
preserved byte-for-byte.

### 3.1 `--template` verb surface

New in v3: `--template crud|readonly|graphql|realtime`. `readonly` generates
only `getAll`/`getById` in the controller **and** the router.

---

## 4. JSON envelope (breaking)

v2's `printResult` read `created` while callers passed `createdFiles`, and
several commands returned a boolean `created: true`; `ok` was hardcoded and
`message` was dropped. v3 defines one envelope, emitted by exactly one
function.

**v2 (approximate)**

```json
{ "ok": true, "createdFiles": ["app/modules/user/user.controller.js"], "nextSteps": [] }
```

**v3 — exactly one object on stdout**

```json
{
  "ok": true,
  "created": ["app/modules/user/controllers/user.controller.js"],
  "skipped": [],
  "plan": [{ "op": "create", "path": "/abs/path/user.controller.js" }],
  "nextSteps": ["Module 'user' otomatis terhubung di app/routes/index.js"],
  "message": "optional",
  "data": { "module": "user", "architecture": "modular", "orm": "None" }
}
```

Rules to code against:

- `created[]`/`skipped[]` are POSIX paths **relative to the project root** —
  never booleans, never absolute.
- `plan[]` is emitted **only** under `--dry-run`; entries are
  `{op, path}` with `op ∈ create|overwrite|mkdir|install`, absolute `path`,
  and `backup` on `overwrite`.
- Under `--dry-run`, `created[]` **mirrors the planned creates**.
- Failure ⇒ `{ok:false, error}` and exit 1.
- `--json` (or `RAKITIN_JSON=1`) means stdout carries **only** that object:
  the logger is silenced and no `lib/**` module writes to the console except
  `lib/utils/logger.js`.
- `doctor --json` returns `{ok, checks:[{name,status,detail}], summary}`;
  `info --json` returns `{ok:true, data:{summary}}`; `list --json` returns
  `{ok:true, data:{catalog}}`.

**Action:** if you parsed `createdFiles`, switch to `created`; if you relied
on interactive prompt text on stdout, use the headless flags.

---

## 5. Dry-run and safety semantics (breaking)

| | v2 | v3 |
| --- | --- | --- |
| `--dry-run` | still installed packages, wrote `.env.example`/`package.json`, and ran `npx express-generator` | **zero** filesystem mutation and **zero** install/generation child processes; `npx express-generator` is recorded as an `install` plan entry |
| `--no-install` | honored by `add module`/`add middleware` only; ORM generators shelled `execSync("npm install …")` | honored everywhere; every install goes through the manifest |
| `--pm` | partly ignored | honored by every install (npm/pnpm/yarn/bun) |
| `.bak` | `<file>.bak` was overwritten every time | `backupPathFor` picks the first free name: `.bak`, `.bak.1`, `.bak.2`, … |
| `resetPlan()` | left dry-run latched on | clears the plan **and** leaves the mode |
| `--overwrite` | parsed but unused | wired: re-writes existing files through `overwriteWithBackup` (`.bak` kept) |
| JSON files | raw `fs.writeFileSync` in several places | `safety.updateJsonFile` only (parse → mutate → `.bak`) |
| `.env.example` | ad-hoc appends in 5 places | `safety.mergeEnvExample(root, marker, content)` only, idempotent per marker |
| installs | `execSync` with shell interpolation | `spawn(command, args, {shell:false})`; retry only on network/registry errors |
| `--version` | hijacked by yargs (broke `add docs --version`) | `.version(false)`; use `--cli-version` |

---

## 6. Library entry & package layout (breaking)

**v2:** `require("rakitin")` returned `{ main, run }` — an interactive menu
runner, not the CLI's building blocks — and the checked-in `dist/` shipped a
second, divergent CLI (stale `KIND_DEPENDENCIES`, ESM syntax resolved as CJS,
`templates/**` missing, `engines: >=14`).

**v3:** `main: lib/index.js`, `types: types/index.d.ts`, and explicit
`exports` subpaths:

```js
const { naming, safety, commands, deps, plugins, project, config, version, bareSummary } =
  require("rakitin");
```

| Subpath | Default target |
| --- | --- |
| `rakitin` | `lib/index.js` |
| `rakitin/config` | `lib/config/index.js` |
| `rakitin/naming` | `lib/naming.js` |
| `rakitin/safety` | `lib/safety.js` |
| `rakitin/utils` | `lib/utils/index.js` |
| `rakitin/utils/logger` | `lib/utils/logger.js` |
| `rakitin/ui` | `lib/ui/index.js` |
| `rakitin/ui/progress` | `lib/ui/progress.js` |
| `rakitin/template` | `lib/template/index.js` |
| `rakitin/template/engine` | `lib/template/engine.js` |

Every subpath declares `types` + `default` and **no `import` condition**, so
ESM consumers use CJS interop:

```js
import naming from "rakitin/naming";
console.log(typeof naming.toIdentifier); // "function"
```

`npm run build` no longer exists (and `npm run typecheck` is now a real gate —
`skipLibCheck` was removed). `files` ships `lib` (including
`lib/templates/**`), `bin`, `types`, `rakitin.schema.json`, `docs`,
`README.md`, `CHANGELOG.md`, `LICENSE`.

---

## 7. Configuration schema (breaking)

`rakitin.schema.json` is now `version: { const: 3 }` with
`additionalProperties: false` and exactly the keys `init` writes plus
`plugins`:

```json
{
  "$schema": "https://raw.githubusercontent.com/Reinvy/rakitin/main/rakitin.schema.json",
  "version": 3,
  "preset": "intermediate",
  "arch": "modular",
  "orm": "prisma",
  "packageManager": "npm",
  "autoIntegrateRouter": true,
  "generateValidationLayer": true,
  "generateTestFiles": false,
  "plugins": []
}
```

- Any other key is rejected by the schema (and by `config set`, which
  validates against the key allowlist).
- v2 configs carrying extra keys (e.g. `defaultArchitecture`, `defaultORM`,
  `updatedAt`, `detected`) must be cleaned up. `config set` preserves unknown
  keys rather than dropping them, so remove them explicitly if you want a
  schema-valid file.
- `preset` semantics are now behavioral: `basic` ⇒ `orm: none`, validation
  layer off, no test files; `intermediate` ⇒ ORM (default `prisma`) +
  validation; `advanced` ⇒ intermediate + test files. Auto-preset when
  `--preset` is omitted: any installed/`--orm`/configured ORM ⇒
  `intermediate`, else `basic`.
- Config loading: `RAKITIN_*` env → `package.json#rakitin` → the first
  existing of `.rakitinrc.json`, `.rakitinrc`, `rakitin.config.json`,
  `rakitin.config.js`. JSON with comments is rejected explicitly instead of
  being misparsed.

---

## 8. Prisma flow (breaking)

| | v2 | v3 |
| --- | --- | --- |
| `package.json#prisma.schema` | written | **removed** (deprecated pointer) |
| schema location | appended into `prisma/schema.prisma` | multi-file `prisma/schema/base.prisma` + `prisma/schema/<kebab>.prisma`, with `prisma.config.js` as the single pointer |
| `DATABASE_URL` | only on first init | merged into `.env.example` (`# PRISMA`) on every path |
| `dotenv` | required by `prisma.config.js` but not installed | part of `module:prisma` |
| `npx prisma init` | run when the schema was missing | not run |

---

## 9. New capability families

| Family | Command | Contract |
| --- | --- | --- |
| Plugin system | `rakitin plugin list\|add\|remove\|info`, `rakitin add <plugin-generator-id>` | API v1 plugins in `.rakitinrc.json#plugins`; generators, commands, `preGenerate/postGenerate/preInstall/postInstall/onError` hooks, `dependencies` kinds. See [plugin-authoring.md](./plugin-authoring.md) |
| GraphQL | `rakitin add graphql [--module <m>]` | `graphql` + `graphql-http`, `app/graphql/**`, `mountGraphQL(app)`. See [graphql.md](./graphql.md) |
| WebSocket | `rakitin add websocket [--module <m>] [--path </ws>]` | `ws`, `app/ws/**`, `{event,data}` envelope, `<event>:ack`, 30 s heartbeat. See [websocket.md](./websocket.md) |
| Test files | `rakitin add test <module\|--all>`, `add module --with-tests`, `recipe test` | one shared template → `tests/modules/<kebab>.test.js`, honoring `SKIP_HTTP_TESTS=1`; `generateTestFiles` is finally consumed |
| Module templates | `add module --template crud\|readonly\|graphql\|realtime` | verb surface + optional GraphQL/WebSocket wiring, rendered from the same templates via a `verbs` local |

---

## 10. Dead code removed

`installer.installIfNeededSync` / `isPackageInstalledAsync` /
`getAvailablePackageManagers`; `lib/utils.js`'s `PathCache` /
`getCachedModulePath` / `getPathCacheSize` / `clearPathCache` /
`ensureBaseStructure`; unused `constants.js` path getters; `RECIPES[*].deps`
(superseded by `KIND_DEPENDENCIES`); the hand-rolled template engine; the
`ErrorHandler` leftovers; the v1/v2 interactive router + menu modules.
`require("fs-extra")` no longer exists under `lib/`, `bin/` or the library
entry (it is a devDependency for tests only).

---

## 11. Testing contract (if you develop rakitin)

- `npm test` must leave the git tree clean: each suite gets its own
  `mkdtemp` cwd, `child_process` is blocked by `__mocks__/child_process.js`
  (E2E suites opt in with `global.__RAKITIN_REAL_CHILD_PROCESS__ = true` and
  always pass `--no-install`), and `package.json`/`package-lock.json` are
  hash-guarded.
- CI runs Node 22.x/24.x, a `git diff --exit-code` tree-dirty gate, and a
  `jq -e .` stdout-purity step.
- Tests that pinned broken behavior or could not fail were deleted; generated
  JS is validated by compiling it (`new vm.Script`), never by `require()`-ing
  target files.

---

## 12. Upgrade checklist

1. Bump CI to Node `^22.13.0 || >=23.5.0`.
2. Remove any dependency on `dist/`; import from the documented subpaths.
3. Clean `.rakitinrc.json` to the v3 key set (drop `defaultArchitecture`,
   `defaultORM`, `updatedAt`, `detected`, …).
4. Replace `rakitin router` with `rakitin integrate`; replace piped interactive
   recipes with the headless flags (`add util uuid`, `add endpoint … --resource`,
   …).
5. Re-run `rakitin integrate` and commit the regenerated marker region
   (uniform `router.use` wiring, full verb set).
6. Switch JSON consumers from `createdFiles` to `created`, and treat `plan`
   as dry-run-only.
7. Delete any `package.json#prisma.schema` pointer and point Prisma at
   `prisma/schema` via `prisma.config.js`.
8. Re-run `npm test` / your own suite and confirm the tree is clean.
