# CLI Reference — rakitin v3

Authoritative reference for every surface shipped by the CLI. Grounded in
`bin/rakitin.js` (flag declarations), `lib/commands/*` (behavior),
`lib/safety.js` (write/dry-run guarantees) and `lib/deps/manifest.js`
(dependency registry).

rakitin is **integration-first**: it detects the existing project, never
clobbers user files without a `.bak` backup, and manages every generated
region through idempotent markers. Runtime baseline: Node
`^22.13.0 || >=23.5.0`, CommonJS only.

---

## 1. Synopsis

```
rakitin                                # bare → project summary + next steps (exit 0)
rakitin init                           # write .rakitinrc.json + base router/ORM scaffolding
rakitin config [list|get|set] [key] [value]
rakitin add <thing> [name]             # module|middleware|util|config|endpoint|
                                       #   validation|docs|test|graphql|websocket
rakitin recipe <auth|swagger|test|docker>
rakitin integrate                      # marker-based main-router wiring
rakitin plugin <list|add|remove|info> [spec]
rakitin info | doctor | list           # introspection
rakitin --cli-version                  # print the rakitin version, exit 0
```

Every command runs through the same wrapper (`run()` in `bin/rakitin.js`):
it builds the context from the global flags, applies `--cwd` exactly once,
opens the dry-run plan when `--dry-run` is set, runs the command, and prints
one result envelope.

### 1.1 Exit codes

| Situation | Exit |
| --- | --- |
| Command completed (including no-op and `--dry-run`) | `0` |
| Any thrown error → `{ok:false, error}` (JSON) or a `❌` log line (human) | `1` |
| `integrate` with zero valid modules | `0` — the envelope carries `ok:false` plus a guidance `message`; it is a hint, not a crash |

### 1.2 Result envelope (single source of truth)

`printResult()` in `lib/commands/shared.js` is the only writer of command
results. In JSON mode (`--json`, or the env var `RAKITIN_JSON=1`) stdout
contains **exactly one** JSON object:

```json
{
  "ok": true,
  "created": ["app/modules/user/controllers/user.controller.js"],
  "skipped": [],
  "plan": [{ "op": "create", "path": "/abs/path/user.controller.js" }],
  "nextSteps": ["Module 'user' otomatis terhubung di app/routes/index.js"],
  "message": "optional human/agent-readable sentence",
  "data": { "command-specific": "payload" }
}
```

| Key | Always present | Shape |
| --- | --- | --- |
| `ok` | yes | `true` unless the command reports a non-fatal problem |
| `created[]` | yes | POSIX paths **relative to the project root** |
| `skipped[]` | yes | POSIX paths relative to the project root (file already existed / marker already present / nothing changed) |
| `plan[]` | only under `--dry-run` | `{op, path}` entries, `path` **absolute**; see §1.4 |
| `nextSteps[]` | yes | strings, rendered as a numbered block in human mode |
| `message` | when the command has one | string |
| `data` | when the command has one | command-specific object |

Failures print `{ "ok": false, "error": "<message>" }` and exit `1`.

**stdout purity.** Under JSON mode the logger is switched to `silent`
(`enableJsonMode()`), and no module under `lib/**` writes to the console
except `lib/utils/logger.js` (enforced by an ESLint `no-console` rule scoped
to `lib/**`). Diagnostics therefore never corrupt a `jq`-parsed stdout.

### 1.3 Dry-run guarantee

`--dry-run` opens the safety-layer plan (`safety.beginPlan()`). While the
plan is active:

- **No filesystem mutation of any kind.** `writeFileIfNotExistsSafe`,
  `overwriteWithBackup`, `updateJsonFile`, `mergeEnvExample` and
  `utils.ensureDir` only record intent.
- **No install/generation child process.** `ensureDependencies` returns early
  with every package in `skipped[]`; `init --express` records
  `{op:"install", path:"npx express-generator --no-view ."}` instead of
  running `npx`.
- `created[]` **mirrors the planned creates**: it lists the same paths the
  plan would create, so a dry-run result is directly comparable with the real
  run's result.

Verified on a throwaway project: running `add module … --dry-run`,
`add middleware auth --dry-run`, `recipe auth --dry-run`,
`init --orm prisma --dry-run` and `recipe test --dry-run` leaves
`find . -type f | md5sum` unchanged and creates no `node_modules/`.

### 1.4 Plan entry shapes

| `op` | Emitted by | Extra fields |
| --- | --- | --- |
| `create` | `writeFileIfNotExistsSafe` on an absent path | — |
| `overwrite` | `overwriteWithBackup` on an existing path | `backup` — absolute path of the `.bak` that will be written |
| `mkdir` | `utils.ensureDir` for an absent directory | — |
| `install` | `init --express` (dry-run only) | `path` holds the recorded command string |

Example (`recipe test --dry-run`), showing both `create` and `overwrite`:

```json
"plan": [
  { "op": "create", "path": "/tmp/p/jest.config.js" },
  { "op": "create", "path": "/tmp/p/tests/setup.js" },
  { "op": "overwrite", "path": "/tmp/p/package.json", "backup": "/tmp/p/package.json.bak" }
]
```

---

## 2. Global flags

Declared once on the yargs instance (`bin/rakitin.js`), so every command
accepts them.

| Flag | Alias | Type | Default | Meaning |
| --- | --- | --- | --- | --- |
| `--cwd <dir>` | – | string | `process.cwd()` | Project root. Applied exactly once (`enterProjectRoot`); every lazy path helper then agrees. |
| `--yes` | `-y` | boolean | `false` | Non-interactive: use defaults, never prompt. |
| `--overwrite` | `-o` | boolean | `false` | Re-write files that already exist, always keeping the previous content in a `.bak` backup. Without it, existing files are skipped and reported in `skipped[]`. See §2.2. |
| `--dry-run` | – | boolean | `false` | Plan only; nothing is written and nothing is spawned. |
| `--json` | – | boolean | `false` | Machine-readable stdout (also via `RAKITIN_JSON=1`). |
| `--no-install` | – | boolean | installs **on** | Declared as `--install` with `default: true`; `--no-install` skips every dependency install. |
| `--auto-integrate` / `--no-auto-integrate` | – | boolean | `true` (or rc value) | Whether `add module` wires the new module into `app/routes/index.js`. |
| `--preset <p>` | – | enum | auto-detected | `basic` \| `intermediate` \| `advanced`. |
| `--arch <a>` | – | enum | `modular` (or rc value) | `simple` \| `modular`. |
| `--orm <o>` | – | enum | see §2.1 | `none` \| `prisma` \| `sequelize` \| `mongoose` \| `typeorm`. |
| `--pm <m>` | – | enum | detected from lockfile | `npm` \| `pnpm` \| `yarn` \| `bun`. |
| `--middleware <csv>` | – | string | – | Comma-separated middleware names for `integrate`. |
| `--cli-version` | – | boolean | – | Print the version and exit 0 (`--version` is deliberately unbound: `.version(false)`, so `--api-version` and `--version`-like flags stay free). |

### 2.1 Preset and ORM resolution

`buildContext()` resolves, in order:

1. `preset` = `--preset` → `.rakitinrc.json#preset` → auto-detect.
   Auto-detect: an installed ORM, or `--orm`, or a configured ORM ⇒
   `intermediate`; otherwise `basic`.
2. `orm` = `--orm` → configured `orm` → `none` when the preset is `basic`,
   else `prisma`.
3. `arch` = `--arch` → configured `arch` → `modular`.
4. `generateValidationLayer` = rc value → `preset !== "basic"`.
5. `generateTestFiles` = rc value → `preset === "advanced"`.
6. `pm` = `--pm` → configured `packageManager` → lockfile detection.

An unknown preset throws
`Preset tidak dikenal: "<p>". Pilih salah satu: basic, intermediate, advanced.`

### 2.2 `--overwrite` semantics

`--overwrite`/`-o` turns every generated write into a **controlled
re-write**: `bin/rakitin.js` calls `safety.setOverwrite(context.overwrite)`
on each run, and `writeFileIfNotExistsSafe` then routes an existing path
through `overwriteWithBackup`, so the previous content is preserved in
`.bak` (then `.bak.1`, `.bak.2`, … — never clobbered).

| Without `--overwrite` | With `--overwrite` |
| --- | --- |
| an existing file is left untouched and reported in `skipped[]` | the file is re-written and reported in `created[]`; the previous bytes live in `<file>.bak` |
| new files are created normally | new files are created normally |

It applies to every command that writes generated files. Independently of
the flag:

- managed regions (main router, module router resource blocks, GraphQL SDL,
  WebSocket registry) are **always** regenerated in place with a `.bak`;
- JSON files (`package.json`, `.rakitinrc.json`) are only ever mutated
  through `updateJsonFile` (parse → mutate → `.bak`);
- `init --force/-f` is the flag that regenerates an existing
  `.rakitinrc.json` (keeping any `plugins` array) with a `.bak`.

Under `--dry-run` an overwrite is recorded as
`{op:"overwrite", path, backup}` and nothing is written.

### 2.3 Per-command flag support

| Command | `--cwd` | `--yes` | `--dry-run` | `--json` | `--no-install` | `--pm` | `--overwrite` |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| *(bare `$0`)* | ✅ | n/a | ✅ (empty plan) | ✅ | n/a | n/a | n/a |
| `init` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (+ `--force` for the rc) |
| `config list/get/set` | ✅ | n/a (never prompts) | ✅ (`set`) | ✅ | n/a | n/a | n/a (`set` always writes with a `.bak`) |
| `add module` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `add middleware` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `add util` | ✅ | n/a (never prompts) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `add config` | ✅ | n/a (never prompts) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `add endpoint` | ✅ | ✅ | ✅ | ✅ | n/a (no deps) | n/a | ✅ |
| `add validation` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `add docs` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `add test` | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ |
| `add graphql` | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ |
| `add websocket` | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ |
| `recipe auth` | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ |
| `recipe swagger` | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ |
| `recipe test` | ✅ | n/a | ✅ | ✅ | ✅ | ✅ | ✅ |
| `recipe docker` | ✅ | n/a | ✅ | ✅ | n/a (no deps) | n/a | ✅ |
| `integrate` | ✅ | n/a | ✅ | ✅ | n/a | n/a | n/a (always regenerates the region with a `.bak`) |
| `plugin list/add/remove/info` | ✅ | n/a | ✅ (`add`/`remove`) | ✅ | n/a | n/a | n/a (config merge is idempotent) |
| `info` / `doctor` / `list` | ✅ | n/a | n/a (read-only) | ✅ | n/a | n/a | n/a |

“n/a (never prompts)” = the command is flag-complete; `--yes` changes
nothing. `add module` and `add middleware` are the only commands with an
interactive fallback, and it is only reached when the required positional
argument is missing **and** `--yes` is not set.

---

## 3. Commands

### 3.1 bare `$0` — project summary

```bash
rakitin [--cwd DIR] [--json]
```

Prints a detected-project summary (root, package name + manager, Express
version, Node engine, module counts, installed ORMs, config file + preset,
router path + marker state, available middlewares, resolved rakitin flags,
plugin load errors) followed by a numbered next-step block. Non-interactive;
never writes; exit 0.

```bash
rakitin
rakitin --json | jq '.data.summary.router'
```

### 3.2 `init`

```bash
rakitin init [--express] [--preset basic|intermediate|advanced]
             [--orm none|prisma|sequelize|mongoose|typeorm]
             [--arch simple|modular] [--pm npm|pnpm|yarn|bun]
             [--auto-integrate|--no-auto-integrate] [--force|-f]
```

| Option | Effect |
| --- | --- |
| `--express` | Scaffold a fresh Express project with `npx express-generator --no-view --force .`, then install its dependencies (skipped under `--no-install`) and wire `app.js` to mount `./app/routes` at `/api`. Ignored with a warning when Express is already detected. |
| `--preset` | Pin the preset. `basic` ⇒ `orm: none`, validation layer off, no test files. `intermediate` ⇒ ORM on (default `prisma`), validation layer on. `advanced` ⇒ intermediate + test files. |
| `--orm` / `--arch` / `--pm` | Written into `.rakitinrc.json` and used for base scaffolding. |
| `--auto-integrate` / `--no-auto-integrate` | Stored as `autoIntegrateRouter`. |
| `--force` / `-f` | Regenerate an existing `.rakitinrc.json` (`.bak`-backed). Without it, an existing config is reused and reported in `skipped[]`. |
| `--no-install` | Skip the ORM dependency install. |
| `--dry-run` | Record the plan; the express-generator invocation becomes an `install` plan entry. |

Writes `.rakitinrc.json` (with `$schema`, `version: 3`, preset/arch/orm/pm,
the three booleans, and the preserved `plugins` array), the base router
`app/routes/index.js` (marker region), and the base ORM scaffolding:

| ORM | Base artifacts |
| --- | --- |
| `prisma` | `prisma/schema/base.prisma`, `prisma.config.js`, `app/shared/config/db.js`, `.env.example` (`# PRISMA` → `DATABASE_URL=…`) |
| `sequelize` | `app/shared/config/database.js`, `.env.example` (`# SEQUELIZE` → `DB_*`) |
| `mongoose` | `app/shared/config/db.js`, `.env.example` (`# MONGOOSE` → `MONGODB_URI`) |
| `typeorm` | `app/shared/config/data-source.js`, `.env.example` (`# TYPEORM` env) |
| `none` | nothing beyond the router |

```bash
rakitin init --preset intermediate --orm prisma --pm npm
rakitin init --express --arch modular --orm none
rakitin init --orm prisma --dry-run --json | jq '.plan[].op'
rakitin init --force                       # regenerate .rakitinrc.json (+ .bak)
```

### 3.3 `config [action] [key] [value]`

```bash
rakitin config [list]                 # every resolved value
rakitin config get <key>              # one resolved value
rakitin config set <key> <value>      # mutate .rakitinrc.json
```

Actions: `list` (default), `get`, `set`. Unknown action ⇒ exit 1 with the
action list. Keys are restricted to the v3 schema
(`version, preset, arch, orm, packageManager, autoIntegrateRouter,
generateValidationLayer, generateTestFiles, plugins`); an unknown key throws
`Kunci config tidak dikenal: "<key>". Pilihan: …`.

Values are coerced to the schema type: `version` must be `3`; enum keys are
validated against their domain; booleans accept `true|1|yes|y` /
`false|0|no|n`; `plugins` accepts a JSON array (`'["a","./b.js"]'`) or a
comma list. `set` writes through `updateJsonFile` (backup + plan-aware) and
reports the file in `created[]`, or in `skipped[]` when the value was
already set. `list`/`get` never write.

`config list` also reports the detected project (`data.project`), and in
human mode renders a table; under `--json` it emits only the envelope.

```bash
rakitin config list
rakitin config get orm
rakitin config set orm mongoose
rakitin config set autoIntegrateRouter false
rakitin config set plugins '["rakitin-plugin-audit","./plugins/x.js"]'
rakitin config set arch simple --dry-run --json | jq '.plan'
```

### 3.4 `add module <name>`

```bash
rakitin add module <name> [--arch simple|modular]
    [--orm none|prisma|sequelize|mongoose|typeorm]
    [--template crud|readonly|graphql|realtime]
    [--with-tests] [--pm PM] [--no-install] [--yes] [--dry-run] [--json]
```

`<name>` is required. Without it (and without `--yes`) the command prompts;
with `--yes` and no name it exits 1 with a copy-pasteable example. Names go
through `assertSafeName("module", …)`: path separators, `.`/`..`, leading
dots and control characters are rejected with
`Nama module tidak valid: "<raw>". Gunakan huruf, angka, "-" atau "_" tanpa
pemisah path.`; accepted names are normalized to kebab-case
(`UserProfile` → `user-profile`).

Artifacts:

| Architecture | Files |
| --- | --- |
| `modular` | `app/modules/<kebab>/controllers/<kebab>.controller.js`, `services/<kebab>.service.js`, `routes/<kebab>.router.js` |
| `simple` | `app/modules/<kebab>/<kebab>.controller.js`, `<kebab>.service.js`, `<kebab>.router.js` |
| + ORM | modular: `models/<kebab>.model.js` (or `entities/<kebab>.entity.js` for TypeORM) or `prisma/schema/<kebab>.prisma`; simple: `<kebab>.model.js` / `<kebab>.entity.js` |
| + `orm none`, modular | `models/<kebab>.model.js` placeholder stub |
| + `--with-tests` (or `generateTestFiles`) | `tests/modules/<kebab>.test.js` |
| + `--template graphql` | `app/graphql/**` wired for the module |
| + `--template realtime` | `app/ws/**` with `<kebab>.handler.js` |

The generated controller exports the full verb set
(`getAll, getById, create, update, remove`) and the router registers
`GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, plus the managed
`// rakitin:resources:start|end` region reserved for `add endpoint`.

`--template` selects the verb surface and the extra wiring (implemented by
rendering the same templates with a `verbs` local, so no template
duplication):

| Template | Verbs | Extra |
| --- | --- | --- |
| `crud` (default) | all five | – |
| `readonly` | `getAll`, `getById` | router registers only those two verbs |
| `graphql` | all five | + `app/graphql/**` for the module (kind `graphql:core`) |
| `realtime` | all five | + `app/ws/**` handler for the module (kind `websocket:ws`) |

Dependencies install exactly once through the manifest, with the union of
kinds (`module:<orm>`, plus `graphql:core` / `websocket:ws` / `test:dev`).
With `--no-install` or `--dry-run` nothing is spawned.

When `autoIntegrateRouter` is on, the command calls `integrate` itself and
reports the router file in `created[]`.

```bash
rakitin add module user --arch modular --orm none --yes
rakitin add module payment --arch simple --orm mongoose --yes
rakitin add module article --arch modular --orm prisma --template readonly --yes
rakitin add module chat --arch simple --orm none --template realtime --yes
rakitin add module audit --arch modular --orm none --with-tests --yes
rakitin add module invoice --arch modular --orm typeorm --dry-run --json | jq '.plan'
```

### 3.5 `add middleware [kind]`

```bash
rakitin add middleware [custom|auth|logger|error|request-time] [--custom-name <name>] [--yes]
```

Kinds are exactly `MIDDLEWARE_KINDS`; an unknown kind exits 1 with the list.
Output: `app/shared/middlewares/<kebab>.middleware.js`. Only `auth` pulls a
dependency (`jsonwebtoken`, kind `middleware:auth`). `custom` needs a name —
`--custom-name` (validated by `assertSafeName("middleware", …)`) or an
interactive prompt; with `--yes` and no name it falls back to `custom`.
Without a kind (and without `--yes`) it prompts from the kind list.

```bash
rakitin add middleware auth
rakitin add middleware custom --custom-name my-guard --yes
rakitin add middleware request-time --no-install
```

### 3.6 `add util [kind]`

```bash
rakitin add util <kind> [--custom-name <name>]
```

Kinds: `custom, date, string, number, array, object, file, crypto, uuid,
env, url, color, math, validation, regex, time`. Unknown kind ⇒ exit 1 with
the list. Output: `app/shared/utils/<kebab>.util.js`. No prompting (the
interactive menu of v1 is gone): a kind is required. `custom` uses
`--custom-name`. Dependencies per kind come from the manifest
(`util:uuid` → `uuid`, `util:date` → `dayjs`, `util:env`/`util:any` →
`dotenv`; the rest are dependency-free).

```bash
rakitin add util uuid
rakitin add util date
rakitin add util custom --custom-name slugify
```

### 3.7 `add config [kind]`

```bash
rakitin add config [app|database|jwt|cors|logger|mailer|cloud|payment|redis|socket|env|custom]
    [--custom-name <name>]
```

Kinds from `CONFIG_KINDS`; unknown kind ⇒ exit 1 with the list. Output:
`app/shared/config/<kebab>.config.js` plus an idempotent `.env.example`
section merged through `mergeEnvExample` under a `# <KIND> CONFIG` marker
(`# CUSTOM:<name> CONFIG` for custom kinds). `custom` uses `--custom-name`.
Dependencies are `dotenv` for every kind (`config:*`).

```bash
rakitin add config app
rakitin add config jwt
rakitin add config custom --custom-name stripe
```

### 3.8 `add endpoint <module>`

```bash
rakitin add endpoint <module> --resource <name> --fields <a:t,b:t>
    [--no-pagination] [--no-filtering]
```

Generates a CRUD resource inside an existing module and mounts it:

- `app/modules/<module>/resources/<resource>.resource.js`
- `app/modules/<module>/resources/<resource>.controller.js`
- mounts `router.use("/<resource>", <id>)` into the module router's
  `// rakitin:resources:start|end` region (idempotent: a second run reports
  `created: []` and `mount.action: "unchanged"`, with a `.bak`).

`--fields` takes `name:type` pairs (`title:string,price:number`). Pagination
and filtering are on by default; `--no-pagination` / `--no-filtering` drop
them. Missing `--resource`/`--fields` ⇒ exit 1 with an example. Missing
module/controller/router ⇒ exit 1. `data` carries
`{module, architecture, resource, fields, pagination, filtering, mount}`.
No dependency is installed.

```bash
rakitin add endpoint user --resource items --fields title:string,price:number
rakitin add endpoint article --resource comments --fields body:text --no-filtering
```

### 3.9 `add validation <name|common>`

```bash
rakitin add validation <name> [--fields <a:t:req,b:t>] [--from-module <module>] [--common]
```

Three modes:

| Mode | Trigger | Output |
| --- | --- | --- |
| common | `--common`, or name `common` | `app/shared/validators/common.validator.js` — shared schemas (`email`, `uuid`, `date`, `url`, `number`, `string`, `boolean`) plus the auth-shaped `registerSchema`/`loginSchema`/`updateProfileSchema`/`changePasswordSchema` |
| fields | `--fields a:string:true,b:number` | `app/shared/validators/<kebab>.validator.js` exporting `<camel>Schema`, `<camel>CreateSchema`, `<camel>UpdateSchema` |
| from-module | `--from-module <module>` | same path; fields parsed from `prisma/schema/<kebab>.prisma` or the Mongoose model |

`--fields` types: `string, number, boolean, date, uuid, email`; the trailing
`:true` marks a field required. An unknown type ⇒ exit 1
(`Tipe field tidak dikenal: "<t>". Pilihan: …`). A `--from-module` target
with no parseable Prisma/Mongoose schema ⇒ exit 1
(`Tidak bisa membaca field dari modul "<m>". Gunakan --fields <a:string,b:number>.`).
Neither `--fields` nor `--from-module` nor `--common` ⇒ exit 1 with an
example. Installs `joi` (kind `validation:joi`).

```bash
rakitin add validation common
rakitin add validation product --fields name:string:true,price:number
rakitin add validation article --from-module article
```

### 3.10 `add docs [kind]`

```bash
rakitin add docs <openapi-json|openapi-yaml|swagger-ui|complete>
    [--title <t>] [--api-version <v>] [--no-auth]
```

| Kind | Output |
| --- | --- |
| `openapi-json` | `app/docs/openapi.json` |
| `openapi-yaml` | `app/docs/openapi.yaml` (dependency-free emitter) |
| `swagger-ui` | `app/docs/swagger-ui.js` — self-contained: embeds the spec, exports `{ openapiSpec, mountSwagger(app, basePath = "/docs") }` |
| `complete` | all three |

Paths are derived from the modules whose router file exists (a module
without a router is reported in `data.skippedModules`), plus every
`// rakitin:resources:` mount as `/api/<module>/<resource>`. `--no-auth`
drops `components.securitySchemes` and the global `security`.
`--title` defaults to `Rakitin API`, `--api-version` to `1.0.0`.

The kind is validated against the generator's `DOCS_KINDS` **before**
anything is written, and the dependency kinds are mapped explicitly
(`complete` and `swagger-ui` → `docs:swagger-ui`, otherwise `docs:<kind>`),
so an unknown kind exits 1
(`Jenis dokumentasi tidak dikenal: "<kind>". Pilihan: openapi-json,
openapi-yaml, swagger-ui, complete.`) without leaving a half-written
`app/docs`. `openapi-yaml` is dependency-free (the YAML emitter is
built in), so it installs nothing.

```bash
rakitin add docs openapi-json
rakitin add docs openapi-yaml --title "Catalog API" --api-version 2.1.0
rakitin add docs swagger-ui --no-auth
rakitin add docs complete
```

### 3.11 `add test <module|--all>`

```bash
rakitin add test <module> | --all
```

Renders `tests/modules/<kebab>.test.js` from the shared template
(`lib/templates/test/module.test.ejs`), the same template `recipe test`
uses. `<module>` must already exist under `app/modules/`; `--all` covers
every detected module. Each file contains structural assertions
(module dir, controller, router) that only need `fs`/`path`, plus an HTTP
smoke block gated by `SKIP_HTTP_TESTS=1`. Installs `jest@^29` + `supertest`
as **devDependencies** (kind `test:dev`). This command writes only the
per-module test files; `recipe test` additionally writes
`jest.config.js` + `tests/setup.js` and injects the `test` script.

```bash
rakitin add test user
rakitin add test --all
SKIP_HTTP_TESTS=1 npx jest tests/modules/user.test.js
```

### 3.12 `add graphql`

```bash
rakitin add graphql [--module <name>]
```

Writes the GraphQL layer (see [graphql.md](./graphql.md)):

- `app/graphql/index.js` — `buildSchema` + `mountGraphQL(app, basePath = "/graphql")` + a `graphql({source})` helper
- `app/graphql/schema.graphql` — root `Query`/`Mutation` plus the managed `# rakitin:graphql:start|end` region
- `app/graphql/resolvers.js` — `rootValue` map plus the managed `// rakitin:graphql:start|end` region
- `app/graphql/README.md`

`--module <name>` appends `type <Pascal>` + `Query.<camel>List|Query.<camel>`
+ `Mutation.create<Pascal>|update<Pascal>|delete<Pascal>` into the SDL region
and the matching resolvers into the JS region, keyed by the per-module
sentinel `# rakitin:module:<kebab>` / `// rakitin:module:<kebab>` — so it is
idempotent and never duplicates. The module must already exist, otherwise
the command exits 1 (`Modul "<m>" tidak ditemukan. Buat dulu: rakitin add
module <m>`). Installs `graphql` + `graphql-http` (kind `graphql:core`).

```bash
rakitin add graphql
rakitin add graphql --module user
```

### 3.13 `add websocket`

```bash
rakitin add websocket [--module <name>] [--path </ws>]
```

Writes the WebSocket layer (see [websocket.md](./websocket.md)):

- `app/ws/index.js` — `attachWebSocket(server, { path })` /
  `createWebSocketServer({ server, path })`, 30 s heartbeat
- `app/ws/handlers/index.js` — registry with `register`/`dispatch` and the
  managed `// rakitin:ws:start|end` region
- `app/ws/README.md`
- with `--module <m>`: `app/ws/handlers/<kebab>.handler.js`, registered in
  the marker region (idempotent; re-running does not duplicate the entry)

`--path` defaults to `/ws` and is normalized to a leading slash without a
trailing slash. `--module` requires an existing module (else exit 1).
Installs `ws` (kind `websocket:ws`).

```bash
rakitin add websocket
rakitin add websocket --module user --path /realtime
```

### 3.14 `recipe <auth|swagger|test|docker>`

An unknown recipe exits 1 with the list. Every recipe routes writes through
the safety layer, honors `--dry-run`/`--no-install`/`--pm`, and reports
created/skipped paths relative to the project root.

#### `recipe auth`

```bash
rakitin recipe auth [--arch simple|modular] [--orm prisma|sequelize|mongoose|typeorm|none]
```

Composes: the JWT `auth` middleware; a `user` module (controller, service,
router) for the chosen architecture; `app/shared/validators/user.validator.js`;
the ORM-owned user model (`prisma/schema/user.prisma`, `models/user.model.js`,
`entities/user.entity.js`, or nothing for `none`) plus the ORM connection
singleton; `.env.example` (`# AUTH RECIPE` → `JWT_SECRET`,
`JWT_EXPIRES_IN`). Installs `jsonwebtoken`, `joi`, `bcryptjs`
(kind `recipe:auth`) plus the ORM kind. With `orm none` the service is an
in-memory store.

#### `recipe swagger`

Writes `app/shared/config/swagger.config.js` (swagger-jsdoc spec +
`mountSwagger(app, basePath = "/api-docs")`), `app/docs/index.js`
(mount-ready re-export), and `.env.example` (`# API DOCS` →
`API_BASE_URL=/api`). Installs `swagger-ui-express` + `swagger-jsdoc`
(kind `docs:swagger-ui`).

#### `recipe test`

Writes `jest.config.js` + `tests/setup.js` (via the test-file generator),
`tests/modules/<kebab>.test.js` for every detected module, and injects the
`test`/`test:watch` scripts into `package.json` when unset (through
`updateJsonFile`, `.bak`-backed). Installs `jest@^29` + `supertest` as
devDependencies.

#### `recipe docker`

Resolves the application entrypoint from
`app/server.js → bin/www → index.js → app.js` (first existing) and writes a
multi-stage `Dockerfile` (`FROM node:22-alpine`, `CMD ["node", "<entrypoint>"]`)
plus `.dockerignore`. No dependencies, no daemon contact. **Without a
detectable entrypoint the recipe exits 1**:
`Tidak menemukan entrypoint aplikasi (app/server.js, bin/www, index.js,
app.js).`

```bash
rakitin recipe auth --arch modular --orm prisma
rakitin recipe swagger
rakitin recipe test
rakitin recipe docker            # needs app/server.js|bin/www|index.js|app.js
rakitin recipe docker --dry-run --json | jq '.plan'
```

### 3.15 `integrate`

```bash
rakitin integrate [--middleware auth,logger]
```

Rebuilds the managed region of `app/routes/index.js` from the detected
module inventory:

```js
/* rakitin:routes:start */
const userRouter = require('../modules/user/routes/user.router.js');
router.use('/user', userRouter);
/* rakitin:routes:end */
```

- Modules are detected per-module (`routes/<kebab>.router.js` ⇒ modular,
  `<kebab>.controller.js` ⇒ simple); **both** architectures emit the same
  wiring shape (`const <id> = require(...)` + `router.use('/<kebab>', <id>)`).
  A module whose router file is missing is listed in `skipped[]` with a
  reason and is **never** emitted as a dangling require.
- `--middleware` takes a comma list; a middleware is wired only when
  `app/shared/middlewares/<kebab>.middleware.js` exists, and is attached to
  every module mount (`router.use('/<kebab>', <id>Router, <mw>)`).
- Bytes outside the marker region are preserved exactly; regeneration is
  byte-stable. Each replacement leaves a `.bak` (then `.bak.1`, `.bak.2`, …).
- `data.action` ∈ `created | markers-regenerated | block-injected | appended`.
- Zero valid modules ⇒ `ok:false` with a guidance message and exit 0.

```bash
rakitin integrate
rakitin integrate --middleware auth,request-time
rakitin integrate --dry-run --json | jq '.plan[0]'
```

### 3.16 `plugin <list|add|remove|info> [spec]`

See [plugin-authoring.md](./plugin-authoring.md) for the API. Actions:
`list` (loaded plugins + load errors), `add <entry>` (resolves the entry
from the project root, then appends it to `.rakitinrc.json#plugins` through
`updateJsonFile`), `remove <name>` (drops it; deletes the key entirely when
the list becomes empty so `package.json#rakitin.plugins` is not shadowed),
`info <name>` (detail for one plugin). An unknown action exits 1; a
`add`/`remove`/`info` without a spec exits 1 with an example.

Load errors are **data, not failures**: `list`/`info` report them in
`data.errors` and stay `ok:true`, so one broken plugin never bricks the CLI.
`doctor` surfaces the same errors as `warn` checks.

```bash
rakitin plugin list --json
rakitin plugin add ./plugins/audit.js
rakitin plugin add rakitin-plugin-audit
rakitin plugin info audit
rakitin plugin remove audit
```

### 3.17 `info`

```bash
rakitin info [--json]
```

Detected-project summary (`data.summary`): root, package name/manager,
Express version, Node engine, module counts + names, installed ORMs, config
file + preset/arch/orm, router path + marker state, middlewares, the
resolved rakitin flags, and plugin load errors. Read-only, never prompts.

```bash
rakitin info
rakitin info --cwd ../services/billing
rakitin info --json | jq '.data.summary.modules'
```

### 3.18 `doctor`

```bash
rakitin doctor [--json]
```

Health-check with actionable detail. Checks:

| Check | Statuses | Logic |
| --- | --- | --- |
| `package.json` | ok/fail | fail when the cwd has no `package.json` |
| `Express` | ok/warn | warn when Express is absent |
| `Struktur app/` | ok/warn | warn when `app/` does not exist yet |
| `Router utama` | ok/warn/fail | fail when `app/routes/index.js` cannot be read or does not parse (`vm.Script`); warn without markers; ok with markers |
| `Modul` | ok/warn | warn when there are no modules or mixed architectures |
| `require "<pkg>"` | warn | one check per dangling require found in `app/**/*.js` (non-relative, non-builtin, not declared in `package.json`) |
| `plugins` | ok/warn | one warn per plugin load error, or `N plugin dimuat tanpa error` |
| `dependency <kind>` | warn | fired when a generated feature exists on disk but a package from its `KIND_DEPENDENCIES` kind is missing (auth middleware, validators, YAML docs, GraphQL, WebSocket, test files, Prisma schema) |

`data` = `{checks: [{name, status, detail}], summary: {ok, warn, fail}}`;
a failing check (`fail > 0`) sets `ok:false` and exit code 1. `--json`
suppresses the human lines.

```bash
rakitin doctor
rakitin doctor --json | jq '.data.summary'
```

### 3.19 `list`

```bash
rakitin list [--json]
```

The generator catalog, **derived from the live registries** (dependency
manifest, middleware/config/util kind lists, module architectures +
`--template` variants, recipes, plugin generators) so it cannot drift from
what the CLI generates. `data.catalog[]` entries are
`{command, kind?, name?, describe, tier}` with tier ∈
`basic | intermediate | advanced | plugin`.

```bash
rakitin list
rakitin list --json | jq -r '.data.catalog[] | "\(.command) \(.name // .kind // "")"'
```

### 3.20 `--cli-version`

```bash
rakitin --cli-version           # prints e.g. 3.0.0
rakitin --cli-version --json    # { ok:true, created:[], skipped:[], nextSteps:[], message:"3.0.0", data:{version:"3.0.0"} }
```

Prints `package.json#version` and exits 0. Because yargs is built with
`.version(false)`, `--version` is not intercepted (it stays usable as
`add docs --api-version`).

---

## 4. Marker regions

All generated regions use exported tokens from `lib/safety.js`. Bytes
outside a region are preserved exactly; regeneration is idempotent.

| Region | File | Tokens |
| --- | --- | --- |
| Main router | `app/routes/index.js` | `/* rakitin:routes:start */` … `/* rakitin:routes:end */` |
| Module resources | module router | `// rakitin:resources:start` … `// rakitin:resources:end` |
| GraphQL SDL | `app/graphql/schema.graphql` | `# rakitin:graphql:start` … `# rakitin:graphql:end` |
| GraphQL resolvers | `app/graphql/resolvers.js` | `// rakitin:graphql:start` … `// rakitin:graphql:end` |
| WebSocket registry | `app/ws/handlers/index.js` | `// rakitin:ws:start` … `// rakitin:ws:end` |

`buildMarkedBlock()` decides what happens:

| State of the file | Action | Behavior |
| --- | --- | --- |
| absent | `create` | `header` + marked block + `eofFallback` |
| contains both tokens | `inject` | only the `[start…end]` region is replaced |
| no tokens, has `module.exports` | `inject` | the block is inserted before the last `module.exports` |
| no tokens, no anchor | `append` | trimmed content + the block at EOF |

Backups are uniquely named: `backupPathFor()` returns `<file>.bak`, then
`.bak.1`, `.bak.2`, … — an existing backup is never clobbered.

---

## 5. Dependency matrix

Per-command installs come from the single registry in
`lib/deps/manifest.js`. Full kind → package table and tier mapping live in
[integration-tiers.md](./integration-tiers.md). Highlights:

| Command | Kinds | Packages |
| --- | --- | --- |
| `add module --orm none` | `module:none` | — (zero-dep guarantee) |
| `add module --orm prisma` | `module:prisma` | `@prisma/client`, `prisma`, `dotenv` |
| `add module --orm sequelize` | `module:sequelize` | `sequelize`, `mysql2` |
| `add module --orm mongoose` | `module:mongoose` | `mongoose` |
| `add module --orm typeorm` | `module:typeorm` | `typeorm`, `reflect-metadata` |
| `add middleware auth` | `middleware:auth` | `jsonwebtoken` |
| `add validation` | `validation:joi` | `joi` |
| `add docs openapi-yaml` | `docs:openapi-yaml` | — (built-in emitter) |
| `add docs swagger-ui` | `docs:swagger-ui` | `swagger-ui-express`, `swagger-jsdoc` |
| `add graphql` | `graphql:core` | `graphql`, `graphql-http` |
| `add websocket` | `websocket:ws` | `ws` |
| `add test` | `test:dev` (dev) | `jest@^29`, `supertest` |
| `recipe auth` | `recipe:auth` (+ ORM kind) | `jsonwebtoken`, `joi`, `bcryptjs` |

Unknown kinds are a hard error
(`Kind dependency tidak dikenal: "<kind>"`), never a silent skip. Installs
run through `spawn(command, args, { shell: false })` with the detected or
explicit package manager, retry only on network/registry failures, and
no-op when `--no-install` or `--dry-run` is active.

---

## 6. Scripting recipes

```bash
# 1. plan first, nothing is written
rakitin add module order --arch modular --orm prisma --dry-run --json | jq '.plan'

# 2. execute headlessly, machine-readable
rakitin add module order --arch modular --orm prisma --yes --no-install --json \
  | jq -e '(.ok == true) and (.created | length > 0)'

# 3. wire + verify
rakitin integrate --json | jq -e '.data.wired | index("order")'
rakitin doctor --json | jq -e '.ok == true'
```

See also: [architecture.md](./architecture.md) (internals),
[integration-tiers.md](./integration-tiers.md) (dependency tiers),
[plugin-authoring.md](./plugin-authoring.md), [graphql.md](./graphql.md),
[websocket.md](./websocket.md), [migration-v2-to-v3.md](./migration-v2-to-v3.md).
