# CLI Reference — rakitin 2.0.0

Authoritative reference for every command surface shipped by the CLI
(`bin/rakitin.js`, `lib/commands/*`, `lib/safety.js`,
`lib/deps/manifest.js`). rakitin is **integration-first**: it detects your
existing Node.js/Express project (`engines.node >= 18`), never clobbers
user files without a `.bak` backup, and manages main-router wiring through
idempotent marker blocks.

## 1. Synopsis & exit-code philosophy

```
rakitin                                # bare → legacy interactive menu
rakitin init                           # detect project + write .rakitinrc.json
rakitin add <thing> [name]             # module|middleware|util|config|endpoint|validation|docs
rakitin recipe <name>                  # auth|swagger|test|docker
rakitin integrate                      # marker-based router wiring
rakitin info | doctor | list           # introspection
rakitin router                         # [legacy] interactive router integration
```

* Exit `0` on success — including dry-runs and “everything already existed”.
* Exit `1` on failure — every thrown error is caught by `fail()`, which
  prints `❌ Terjadi error:` (human) or `{ok:false,error}` (JSON).
* Unknown commands fail via yargs validation (exit `1`).

**`--json` contract** (also enabled by env `RAKITIN_JSON=1`; silences the
internal logger): result-routed commands print a single machine object —

```json
{
  "ok": true,
  "created": ["app/modules/user/user.controller.js"],
  "skipped": [],
  "plan": [{ "op": "create", "path": "/abs/path" }],
  "nextSteps": ["Wire module 'user' ke router utama: rakitin integrate"]
}
```

* Always present: `ok`, `created[]`, `skipped[]`, `nextSteps[]`.
  `plan[]` only under `--dry-run`; entries are `{op, path}` with
  `op ∈ {create, backup+overwrite}`.
* Errors: `{ok:false, error:"<message>"}` + exit `1`.
* Purely interactive subcommands (`add endpoint`, `add validation`,
  `add docs`, `add util`, legacy `router`) still emit prompt UI text, so
  stdout purity is guaranteed only for fully flag-specified headless runs;
  `info` always prints its summary JSON while `doctor`/`list` stay
  human-text.

Payload by command: `init`/`add *`/`recipe *`/`integrate` emit the
printResult object; `info` the raw unwrapped `summary`; `doctor` and
`list` none. Human mode prints `📁 File yang dibuat:` / dry-run plan
listings plus a
numbered `🧭 Next steps:` block.

## 2. Global flags

| Flag | Alias | Type | Meaning |
| --- | --- | --- | --- |
| `--cwd <dir>` | – | string | Project root; the CLI chdirs there first |
| `--yes` | `-y` | boolean | Assume defaults, skip fill-in prompts |
| `--overwrite` | `-o` | boolean | Controlled overwrite (`.bak` created) |
| `--dry-run` | – | boolean | Show plan without writing files |
| `--json` | – | boolean | Machine-readable stdout |
| `--no-install` | – | boolean | Skip automatic dependency installs |
| `--preset <p>` | – | enum | `basic\|intermediate\|advanced` |
| `--arch <a>` | – | enum | `simple\|modular` |
| `--orm <o>` | – | enum | `none\|prisma\|sequelize\|mongoose\|typeorm` |
| `--pm <m>` | – | enum | `npm\|pnpm\|yarn\|bun` |
| `--middleware <list>` | – | string | Comma-separated middlewares |

### Which command honors what

| Flag | init | add module | add mw/util/config/endp/valid/docs | recipe * | integrate |
| --- | :-: | :-: | :-: | :-: | :-: |
| `--cwd` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `--yes/-y` | – | ✅ skips prompts¹ | mw custom name only | – | – |
| `--overwrite/-o` | ✅ regenerates rc | –² | –² | –² | – |
| `--dry-run` | – (writes anyway) | ✅ | ✅ | ✅ | ✅ |
| `--json` | ✅ | ✅³ | ✅³ | ✅ | ✅ |
| `--no-install` | – | ✅ | mw only | –⁴ | – |
| `--preset` | ✅ | – | – | – | – |
| `--arch` | – | ✅ | – | `recipe auth` | – |
| `--orm` | – | ✅ | – | – | – |
| `--pm` | – | ✅ deps | – | auth/swagger/test installs | – |
| `--middleware csv` | – | – | – | – | ✅ |

¹ Without a positional name, `--yes` is rejected (“Nama modul wajib ada”).
² File generation primitives are write-if-absent; existing files surface in
`skipped[]` instead of being replaced (router replacement goes through
markers + `.bak`, not this flag). ³ Interactive flows still print prompt UI.
⁴ Recipes run their own install steps regardless of `--no-install`.

---

## 3. Command reference

### 3.1 `rakitin init`

Detects the project and writes `.rakitinrc.json`; idempotent without
`--overwrite`.

```bash
# Synopsis
rakitin init [--preset basic|intermediate|advanced] [--orm prisma|sequelize|mongoose|typeorm|none] [--overwrite] [--cwd DIR]
```

| Option | Effect |
| --- | --- |
| `--preset` | Force preset; unknown values abort. Omitted ⇒ auto-preset: any ORM installed ⇒ `intermediate`, else `basic`. |
| `--orm` | Set project-wide default ORM (persisted in `.rakitinrc.json`). Choices: `prisma` (default), `sequelize`, `mongoose`, `typeorm`, `none`. |
| `--overwrite/-o` | Regenerate config even if present (acts as `force`). |
| `--json` | Standard object. Dry-run not honored here. |

Written shape: `$schema`, `preset`, `orm`, `defaultArchitecture`, `version: 2`,
`detected {expressVersion, packageManager, modules, mixedArchitectures}`,
`generatedAt`. Detection trusts per-module structure, so mixed layouts are
reported honestly (see [tiers](./integration-tiers.md#1-the-three-tiers-at-a-glance)).

```bash
rakitin init                                   # auto-preset baseline (defaults to Prisma)
rakitin init --orm sequelize                   # configure Sequelize as the project default ORM
rakitin init --preset advanced --overwrite     # explicit, regenerating
CI=true rakitin init --preset basic --json | jq -e '.ok == true'   # CI check
PLAN=$(rakitin init --preset intermediate --json); echo "$PLAN" | jq -r '.nextSteps[]'   # agent
```

### 3.2 `rakitin add module <name>`

Full feature module; headless-first, remaining decisions prompted unless
`--yes`.

```bash
rakitin add module <name> [--arch simple|modular] \
    [--orm none|prisma|sequelize|mongoose|typeorm] \
    [--pm npm|pnpm|yarn|bun] [--no-install] [--yes] [--dry-run] [--json]
```

Options: `<name>` normalized to kebab-case directories (`User Profile` →
`user-profile`) and required even under `--yes`; `--arch` default
`modular`; `--orm` defaults to configured project ORM or `prisma`; missing flags trigger the fill-in
prompts keyed `moduleName` → `architecture` (Simple|Modular) → `useORM`
(confirm, default true) → `ormChoice` (Prisma|Sequelize|Mongoose|TypeORM|None).

Behavior:

* Writes flow through the safety layer — existing files land in
  `skipped[]`, never overwritten.
* Manifest-driven installs: `--orm mongoose` installs exactly `mongoose`;
  `--orm none` installs nothing; Express is never installed by rakitin.
* ORM services target conventional paths (`../../models/<kebab>.model`,
  `../../config/db`, …); the no-ORM service embeds an in-memory store
  (see [module-examples](./module-examples.md)).

```bash
rakitin add module user-profile --arch modular --orm none      # zero-dep baseline
rakitin add module payment --arch simple --orm mongoose --yes  # unattended
rakitin add module invoice --arch modular --orm typeorm --dry-run   # preview plan
OUT=$(rakitin add module invoice --arch simple --orm sequelize --json)
echo "$OUT" | jq -r '.created[], .nextSteps[0]'    # CI/agent consumption
```

### 3.3 `rakitin add middleware <kind>`

Express middleware into `app/shared/middlewares/<kebab>.middleware.js`.

```bash
rakitin add middleware [custom|auth|logger|error|request-time] [--yes] [--no-install] [--json]
```

* `kind` defaults to `custom`; with `custom --yes` the name question is
  skipped and it falls back to `custom.middleware.js`.
* Newly created `auth` triggers manifest key `middleware:auth` →
  installs `jsonwebtoken` exactly once (skipped otherwise).
* Existing files are skipped (`skipped[]`); next-step nudge points at
  making it global via `rakitin integrate`.

```bash
rakitin add middleware auth                       # JWT guard (+jsonwebtoken)
rakitin add middleware custom --yes               # non-interactive fallback name
rakitin add middleware request-time --no-install  # offline-friendly
R=$(rakitin add middleware logger --json)
jq -e '.created[0] | endswith("shared/middlewares/logger.middleware.js")' <<<"$R"
```

### 3.4 `rakitin add util`

Dedicated **interactive** flow; positional args ignored.

Prompts (stdin scripting order): `utilType`
(`custom,date,string,number,array,object,file,crypto,uuid,url,color,math,validation,regex,time`)
→ `name` (only when `utilType=custom`; becomes the kebab filename).
Output lands in `app/shared/utils/<name>.js`. No dependency is ever
installed (`util:any` ⇒ empty registry entry); other generate-time flags
have no effect.

```bash
printf 'uuid\n' | rakitin add util              # scripted pick
printf 'custom\nslugify\n' | rakitin add util   # type then name
```

### 3.5 `rakitin add config <kind>`

Env-driven config modules → `app/shared/config/<kebab>.config.js`.
Kinds: `app database jwt cors logger mailer cloud payment redis socket env
custom` (default `app`; unknown kinds write a placeholder stub).

Uses the non-interactive core directly — no questions asked even without
`--yes`; always merges `.env.example` under a stable `# <KIND> CONFIG`
marker block appended only when absent (custom kinds get per-name markers
so two customs never dedupe each other). Existing configs surface in
`skipped[]`.

```bash
rakitin add config app            # bootstrap (PORT/NODE_ENV/APP_NAME/…)
rakitin add config jwt            # JWT_* env example entries included
C=$(rakitin add config redis --json); grep -c '^REDIS_' .env.example
```

### 3.6 `rakitin add endpoint`

CRUD endpoints for an **existing** module; strictly interactive.

Prompt map: `targetModule` (detected dirs under `app/modules`) →
`resourceName` → `fieldsInput` (`name:type,…`) → `includePagination`
(default true) → `includeFiltering` (default true).

* Per-module architecture detection: a `controllers/` folder ⇒ modular
  variant writes `controllers/<resource>.controller.js` +
  `services/<resource>.service.js` + `routes/<resource>.router.js`;
  simple layouts reuse ONE kebab-case controller pair
  (`<resource>.controller.js` + `<resource>.router.js`) — the old
  camelCase twin-controller drift was removed (migration §1.11).
* Controllers always emit pagination/filter parsing so generated code can
  never hit a `ReferenceError`; services are swappable in-memory stores.

```bash
printf 'product\nreviews\ntitle:string,rating:number\nY\nY\n' | rakitin add endpoint
test -f app/modules/product/routes/reviews.router.js && echo wired
```

### 3.7 `rakitin add validation [name]`

Joi schemas → `app/shared/validators/`; strictly interactive.

Prompt map: `validatorType` (`from-module|new|common`) →
[`targetModule` + `fieldsInput`] or [`validatorName` + `fieldsInput`]
(field format `name:type:required`).

* From-module/new produce `<kebab>.validator.js` exporting
  `<Name>Schema`, `<Name>CreateSchema` (required fields), and
  `<Name>UpdateSchema` (all optional, `.min(1)`); field-name heuristics map
  emails/passwords/counters onto apt Joi chains.
* `common` writes `common.validator.js`, `email.validator.js`,
  `pagination.validator.js`.
* Installing `joi` is NOT part of this command — it belongs to consumers /
  composite recipes (`recipe auth` ensures `validation:joi`).

```bash
printf 'new\nArticle\ntitle:string:true,body:string:true\n' | rakitin add validation
printf 'common\n' | rakitin add validation
```

### 3.8 `rakitin add docs <kind>`

OpenAPI/Swagger scaffolding under `app/docs/`; strictly interactive menu:
`openapi-json` · `openapi-yaml` · `swagger-ui` · `complete` (spec + UI),
followed by `apiTitle` (default `My Express API`), `apiVersion`
(default `1.0.0`), `includeAuth` (adds a `BearerAuth` security scheme,
default true). Specs are pre-populated with GET/POST(+detail) paths per
detected module; YAML output uses the built-in dump writer. Prefer
[`recipe swagger`](#310-rakitin-recipe-swagger) for a headless mount-ready alternative.

```bash
printf 'complete\nPayments API\n2.1.0\nY\n' | rakitin add docs
printf 'openapi-json\nCatalog API\n1.0.0\nN\n' | rakitin add docs
```

### 3.9 `rakitin recipe auth`

Composite advanced-tier recipe: JWT middleware + user module + Joi
validators + dependency wiring + env merge.

```bash
rakitin recipe auth [--arch simple|modular] [--pm npm|pnpm|yarn|bun] [--json]
```

Steps executed: ① `createMiddleware("auth")` →
`app/shared/middlewares/auth.middleware.js`; ② user module generated
(architecture follows `--arch`, default modular, ORM None) unless present;
③ `app/shared/validators/user.validator.js` with `registerSchema`
(email, password 8–72, optional name) and `loginSchema`; ④ installs
`jsonwebtoken` + `joi` (keys `middleware:auth`, `validation:joi`);
⑤ merges `JWT_SECRET=change-me-please` / `JWT_EXPIRES_IN=7d` into
`.env.example` (missing keys only). Recipes own their installs;
`--no-install` is not consulted.

```bash
rakitin recipe auth --arch simple                    # flat user module
J=$(rakitin recipe auth --json)
grep -F 'JWT_EXPIRES_IN=7d' .env.example && jq -e '.ok' <<<"$J"
jq -e 'any(.created[]; contains("validators/user.validator.js"))' <<<"$J"   # CI assertion
```

### 3.10 `rakitin recipe swagger`

OpenAPI 3 skeleton pre-populated from detected modules + drop-in Swagger UI
mount helper.

Creates `app/docs/openapi.json` (one GET/POST pair per detected module),
`app/docs/swagger.setup.js` exposing `mountSwagger(app)` (basePath
`/api-docs`), and `app/docs/README.md`; installs via key
`docs:swagger-ui` → `swagger-ui-express` + `swagger-jsdoc`; merges
`API_BASE_URL=/api` into `.env.example`. All writes use write-if-absent
safety; delete-then-regenerate is the sanctioned refresh path.

```bash
rakitin recipe swagger                                       # scaffold
node -e "require('./app/docs/swagger.setup').mountSwagger" && echo exported
S=$(rakitin recipe swagger --json); jq -e '.created | length >= 2' <<<"$S"
sed -n 's/.*basePath = "\([^"]*\)".*/\1/p' app/docs/swagger.setup.js   # /api-docs
```

### 3.11 `rakitin recipe test`

Jest + Supertest scaffold covering every existing module.

Creates `tests/setup.js` (probes the `app/app.js` export, warns + skips
HTTP assertions when absent) and `tests/modules/<module>.test.js` per
detected module (structure assertion + skippable smoke test against
`/api/<module>` honoring `SKIP_HTTP_TESTS`); adds `"test": "jest"` to
`package.json` scripts only when unset; installs dev deps
`jest@^29` + `supertest`, skipping packages already in `node_modules`;
install failures downgrade to warnings instead of failing the recipe.

```bash
rakitin recipe test                          # full scaffold
SKIP_HTTP_TESTS=1 CI=true rakitin recipe test --pm npm --json | jq -e '.ok'
rakitin recipe test --json | jq -e '.skipped | length > 0'   # idempotent re-run
```

### 3.12 `rakitin recipe docker`

Multi-stage Dockerfile + compose + dockerignore; zero dependencies.

Writes `Dockerfile` (multi-stage `node:20-alpine`, production runner,
`CMD ["node", "app/server.js"]`), `docker-compose.yml` (port 3000,
restart policy), `.dockerignore` (`node_modules`, `.env`, logs), and merges
`NODE_ENV=production` into `.env.example`. Nothing installed, no daemon
contacted.

```bash
rakitin recipe docker && docker build -t my-api .
D=$(rakitin recipe docker --json); cat .dockerignore   # verify ignored set
```

### 3.13 `rakitin integrate`

The new headless marker-based router integration; full mechanics in
[router-integration.md](./router-integration.md).

```bash
rakitin integrate [--middleware auth,logger,...] [--auto] [--dry-run] [--json]
```

| Option | Effect |
| --- | --- |
| `--middleware` | Comma list; a middleware is wired only when `app/shared/middlewares/<kebab>.middleware.js` already exists — dangling requires impossible. |
| `--auto` | Accepted; auto-detection is inherent (no manual subset picker here). |
| `--dry-run` | Full plan, nothing written. |

Behavior notes:

* Discovery via project detector; each `app/modules/<dir>` gets an
  independent verdict (`modular` ⇔ `routes/<name>.router.js`, `simple` ⇔
  `<name>.controller.js`); unrecognized dirs excluded silently; mixed
  layouts supported.
* Result actions surfaced as `created`, `markers-regenerated`,
  `block-injected`, `appended` (marker semantics §Annex).
* Modular modules mount `router.use('/<kebab>', <id>Router)`; simple ones
  bind `getAll` + `create` handlers only.
* Zero valid modules ⇒ exit `0` with guidance message; assert payloads in
  CI when strictness matters.

```bash
rakitin integrate                                  # wire everything found
rakitin integrate --middleware auth,request-time   # bind existing globals
rakitin integrate --dry-run | cat                  # preview before review
I=$(rakitin integrate --middleware auth --json)
echo "$I" | jq -e '.action | IN("created","markers-regenerated","block-injected","appended")'
echo "$I" | jq -r '"wired=" + (.wired|join(",")) , "mw=" + (.middlewareApplied|join(","))'
```

### 3.14 `rakitin info`

Compact overview; **always prints one JSON object**:

```json
{
  "root": "/abs/path",
  "npmProject": true,
  "express": "^5.1.0",
  "packageManager": "npm",
  "preset": null,
  "modules": { "modular": 2, "simple": 1, "mixed": true },
  "mainRouter": { "exists": true, "markerManaged": false },
  "middlewares": ["auth", "logger"]
}
```

`preset` mirrors candidates `.rakitinrc.json` / `.rakitinrc` /
`rakitin.config.json` when readable.

```bash
rakitin info
rakitin info --cwd ../services/billing
rakitin info | jq '.modules.modular == 2'
```

### 3.15 `rakitin doctor`

Health check; human-text one line per finding + trailing summary count.

| Check | Statuses | Detail logic |
| --- | --- | --- |
| `package.json` | ok/fail | fail when cwd lacks package.json |
| `Express` | ok/warn | warn when absent (“generator basic tetap bisa dipakai”) |
| `Struktur app/` | ok/info | info when `app/` will be created during generation |
| `Modul` | ok/warn/info | warn on mixed architectures; counts modular vs simple |
| `Router utama` | ok/warn/info | ok when markers found; warn “ada tapi tanpa marker” → injection + `.bak`; info when absent |
| `Dependency middleware` *(conditional)* | warn | fires when an `auth.middleware.js` exists but `jsonwebtoken` isn’t installed |

Icons: ✅ ok · ⚠️ warn · ❌ fail · ℹ️ info.

```bash
rakitin doctor                        # baseline triage
rakitin --cwd ./legacy-app doctor     # foreign repo adoption scan
```

### 3.16 `rakitin list`

Prints the generator catalog (verbatim from `CATALOG`) with tier labels —
useful for agents deciding what to call next.

| Command | Tiers | Kind values | Description |
| --- | --- | --- | --- |
| `add module <name>` | basic, intermediate, advanced | – | Controller/service/router (+ORM wiring di tier atas) |
| `add middleware <kind>` | basic | custom, auth, logger, error, request-time | Middleware Express siap pakai |
| `add util <kind>` | basic | custom, date, string, number, array, object, file, crypto, uuid, env, url, color, math, validation, regex, time | Utility fungsi umum |
| `add config <kind>` | basic | app, database, jwt, cors, logger, mailer, cloud, payment, redis, socket, env, custom | Config file berbasis env |
| `add endpoint <resource>` | intermediate | pagination, filtering, joi | CRUD endpoint untuk modul existing |
| `add validation [name]` | intermediate | module, new, common | Skema validasi Joi |
| `add docs <kind>` | advanced | openapi-json, openapi-yaml, swagger-ui, complete | OpenAPI/Swagger scaffolding |
| `recipe auth` | advanced | – | JWT auth lengkap (middleware + user module + joi) |
| `recipe swagger` | advanced | – | OpenAPI 3 + swagger-ui terhubung modul |
| `recipe test` | advanced | – | Scaffold jest + supertest per modul |
| `recipe docker` | advanced | – | Dockerfile multi-stage + compose |
| `integrate` | basic | – | Sambungkan router utama (marker-based, idempotent) |

### 3.17 `rakitin router` (legacy)

Runs the historical interactive `integrateRouter()` flow unchanged —
module selection prompt, single global architecture choice, strict
pre-validation, five-verb simple wiring, optional root `app.js` example.
All differences versus `integrate` are tabulated in
[router-integration.md](./router-integration.md#7-old-vs-new-differences-table).
It consumes none of the result plumbing; thrown errors exit `1` via
`fail()`.

```bash
rakitin router                 # guided flow
CI=true printf '' | rakitin    # prefer verbs in CI instead of the menu
```

### 3.18 Bare menu (legacy)

Invoking `rakitin` with zero arguments prints the rocket banner and boots
the original inquirer menu dispatching nine classic capabilities (Module,
Middleware, Util, Config, Router Integration, API Endpoint, API
Documentation, API Validation, exit). Kept alive for v1 muscle memory;
automation should migrate to verbs — see
[migration guide](./migration-v1-to-v2.md).

```bash
rakitin               # banner + menu (TTY)
node bin/rakitin.js   # identical UX when run from an install-less checkout
```

---

## 4. Behavior annex

### 4.1 Marker block literals

Tokens exported from `lib/safety.js`:
`/* rakitin:routes:start */` and `/* rakitin:routes:end */`.
A freshly **created** `app/routes/index.js` has exactly:

```javascript
const express = require('express');
const router = express.Router();

/* rakitin:routes:start */
// Routes managed by rakitin - safe to regenerate; keep custom
// routes OUTSIDE these markers to preserve them.
// …generated wiring…

/* rakitin:routes:end */

module.exports = router;
```

### 4.2 What create / inject / append mean

`buildRoutesContent(existing, routeLines)`:

| Action | Precondition | Result |
| --- | --- | --- |
| `create` | file absent | header + marked block + export |
| `inject` | both markers present | only `[start…end]` region swapped; bytes outside untouched |
| `append` | no markers, no `module.exports` anchor | trimmed content + marked block at EOF |
| `inject` (2nd form) | no markers, anchor found | block inserted **before** last `module.exports`; preceding bytes identical |

The `integrate` command renames outcomes for humans/agents: `created`,
`block-injected`, `appended`, plus `markers-regenerated` for idempotent
marker replacement. When replacing, the region between tokens is rewritten
without the two creation-time comment lines — the first regeneration
normalizes to canonical bare tokens (proof in
[router-integration.md](./router-integration.md#5-idempotency-proof)).

### 4.3 Where `.bak` appears

`overwriteWithBackup(path, content)` copies the previous file to
`<path>.bak` immediately before replacing it. Practically that means only
the main router gets a sibling `.bak` (`app/routes/index.js.bak`), because
every other primitive is write-if-absent. Under dry-run the intent is
recorded as `{op:"backup+overwrite", path}` and nothing touches disk.

### 4.4 Prompt sequencing maps (script-driven stdin testers)

Answer objects are keyed by Inquirer prompt names; honor conditionals.

* **Bare-menu Module:** `moduleName` → `architecture` (Simple|Modular) →
  `useORM` (Yes|No list, default Yes) → `orm` (Prisma|Sequelize|Mongoose|
  TypeORM, when Yes) → `autoIntegrateRouter` (confirm, default No) →
  `routerArchitecture` (modular|simple, when integrating). Key spelling
  differs from the headless fill-ins below (`orm` vs `ormChoice`).
* **Headless `add module` fill-ins:** `moduleName` → `architecture` →
  `useORM` (boolean confirm) → `ormChoice` (Prisma|Sequelize|Mongoose|
  TypeORM|None).
* **Middleware:** `middlewareType` list belongs to the legacy flow; the
  headless path asks only `customName` for `custom` without `--yes`.
* **Config (legacy core):** `configType` → `customName` (when custom) →
  `createEnvExample` (confirm, default true). Headless `add config <kind>`
  skips all three and always enables the env example.
* **Util:** `utilType` → `name` (custom only).
* **Endpoint:** `targetModule` → `resourceName` → `fieldsInput` →
  `includePagination` → `includeFiltering`.
* **Validation:** `validatorType` → branch-specific pairs above.
* **Docs:** `docType` → `apiTitle` → `apiVersion` → `includeAuth`.
* **Legacy router:** `integrationType` → `selectedModules` (checkbox,
  manual only) → `architecture` → `useGlobalMiddleware` (confirm) →
  `selectedMiddlewares` (checkbox: JWT / Logging / Error Handler /
  Request Time) → `createAppExample` (confirm) → `overwriteApp`
  (confirm, only when root `app.js` exists).

### 4.5 Dependency auto-install matrix

Single registry mapping generator *kinds* to packages required by their
output; resolution dedupes and installs once via the detected package
manager. Never installs `express` — your app owns that choice.

| Generator kind | Packages installed |
| --- | --- |
| `module:none` | — (zero-dep guarantee) |
| `module:prisma` | — via registry; the Prisma flow itself installs `prisma`/`@prisma/client` + runs `npx prisma init` when `schema.prisma` is missing |
| `module:sequelize` | `sequelize`, `mysql2` |
| `module:typeorm` | `typeorm`, `reflect-metadata` |
| `module:mongoose` | `mongoose` |
| `middleware:auth` | `jsonwebtoken` |
| `middleware:logger/:error/:request-time/:custom` | — |
| `util:any` | — |
| `validation:joi` | `joi` |
| `docs:openapi-json` / `docs:openapi-yaml` | — / `yaml` |
| `docs:swagger-ui` | `swagger-ui-express`, `swagger-jsdoc` |

Recipe composition over the same registry:

| Recipe | Ensured keys | Effective packages |
| --- | --- | --- |
| `recipe auth` | `middleware:auth`, `validation:joi` | `jsonwebtoken`, `joi` |
| `recipe swagger` | `docs:swagger-ui` | `swagger-ui-express`, `swagger-jsdoc` |
| `recipe test` | dev-only installer | `jest@^29`, `supertest` |
| `recipe docker` | – | — |

Guarantees: already-present packages are never reinstalled; install
failures degrade to warnings; `--no-install` disables the automatic step
for `add module` and `add middleware` while recipes own their lifecycle.
