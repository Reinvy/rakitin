# Integration Tiers — the rakitin product contract

rakitin v2 sells one promise: **adopt at any depth, keep everything**. To
make that promise testable, every command/generator is assigned to one of
three *integration tiers*. A tier is a contract about three things:

1. which commands belong to it,
2. the dependency surface it may introduce into your project,
3. who the tier is for and how you graduate to the next one.

Tier labels shown by `rakitin list` are normative, not decorative.

---

## 1. The three tiers at a glance

| | **basic** | **intermediate** | **advanced** |
| --- | --- | --- | --- |
| One-line definition | Zero-risk module & router integration for an existing Express app | Database-backed modules + request validation on top of basic | Production-shaped composites (auth, API docs, testing, containerization) |
| Commands | `add module` (ORM none), `add middleware`, `add util`, `add config`, `integrate`, `init` | everything in basic + `add endpoint`, `add validation`, ORM-backed `add module` | everything below + `recipe auth\|swagger\|test\|docker`, `add docs` |
| Dependency surface | **Empty** for all default flows (`module:none`, custom/logger/error/request-time middlewares, utils, configs) | **Minimal**: exactly what your chosen ORM/validation needs, per `KIND_DEPENDENCIES` | **Full recipe surface**: `jsonwebtoken`, `joi`, `swagger-ui-express`, `swagger-jsdoc`, dev-only `jest`/`supertest` |
| Target audience | Existing-Express adopter wanting safe, reviewable scaffolding | Scaling team standardizing data layers & contracts | Platform team greenfield/standardizing production posture |

Hard rule shared by all tiers: **nothing ever installs `express`.** Your
application owns its framework version; rakitin only detects it
(`doctor` warns when express is absent but basic generators still work).

## 2. Mapping to the dependency registry

The authoritative source is `lib/deps/manifest.js` (`KIND_DEPENDENCIES`).
The tier ⇄ kind mapping:

| Tier | Manifest keys available | Packages introduced |
| --- | --- | --- |
| basic | `module:none` · `middleware:auth` · `middleware:logger` · `middleware:error` · `middleware:request-time` · `middleware:custom` · `util:any` | `[]` except `middleware:auth` → `jsonwebtoken` |
| intermediate | all basic + `module:prisma`* · `module:sequelize` · `module:typeorm` · `module:mongoose` · `validation:joi` | `sequelize`+`mysql2`, or `typeorm`+`reflect-metadata`, or `mongoose`; `module:prisma` installs through its own init flow (`prisma`, `@prisma/client`) |
| advanced | all intermediate + `docs:openapi-json` · `docs:openapi-yaml` · `docs:swagger-ui` + recipes | `yaml` (YAML only), `swagger-ui-express`+`swagger-jsdoc`; recipes add `joi`, devDependencies `jest@^29`+`supertest` |

Consumers of the surface guarantee:

* `add module --orm none` must always succeed with **zero new packages**
  (that is why the no-ORM service embeds an in-memory store).
* Middleware kinds other than `auth` stay dependency-free forever.
* Recipe installs are once-per-run and deduped — running
  `recipe auth && recipe swagger` never downloads a package twice.

## 3. Tier definitions

### 3.1 basic — “integrate into my existing app”

Everything a maintainer of an already-running Express service needs:

* `rakitin init` to snapshot conventions into `.rakitinrc.json`.
* No-ORM modules (`--orm none`): controller/service/router trio with an
  in-memory store you can swap later without touching controller/router.
* Middleware scaffolding (`auth`, `logger`, `error`, `request-time`,
  custom) into `app/shared/middlewares/`.
* Shared utils and env-driven configs.
* `rakitin integrate` to wire modules behind marker blocks safely.

Upgrade path out: generate your first ORM-backed module → you are using
intermediate features; nothing else changes.

### 3.2 intermediate — “scale with a real data layer”

Adds typed persistence and input contracts on top of basic:

* ORM-backed `add module` (`prisma | sequelize | mongoose | typeorm`),
  each emitting services against conventional model paths.
* `add validation` Joi schemas (+ common validator bundle).
* `add endpoint` CRUD endpoints with pagination/filtering toggles.

Dependency discipline: installing exactly the declared registry entries,
once, via the detected package manager; `--no-install` is honored by
these commands.

### 3.3 advanced — “production-shaped composition”

Recipes and documentation that chain primitives deterministically:

* `recipe auth`: JWT middleware + user module + Joi validators +
  `JWT_*` env examples.
* `recipe swagger`: OpenAPI 3 skeleton pre-populated from detected
  modules + `mountSwagger(app)` helper.
* `recipe test`: jest/supertest scaffold per existing module.
* `recipe docker`: multi-stage Dockerfile/compose, zero deps.
* `add docs` interactive OpenAPI/Swagger generator.

## 4. Upgrade paths between tiers

Graduation is additive by design — moving up changes semantics of future
generations, not files you already have.

* **basic → intermediate**: run `rakitin init --preset intermediate`
  (or just add an ORM-backed module). What changes: new modules may pull
  their manifest packages. What stays: existing modules untouched;
  `.rakitinrc.json` preset value updated (use `--overwrite` to rewrite);
  markers, `.bak` policy, and no-ORM modules behave identically.
* **intermediate → advanced**: start composing recipes. Recipes reuse the
  same generator kinds (`createMiddleware("auth")`, `simpleArch/modularArch`),
  so file shapes remain consistent with earlier generations.
* **Downgrade**: not a real state. Presets only steer defaults; no command
  refuses to run because your rc says `basic`.

Auto-preset heuristic at `init` time still applies when `--preset` is
omitted: ORM present ⇒ `intermediate`, otherwise `basic`.

## 5. Do / don’t per tier

| Tier | Do | Don’t |
| --- | --- | --- |
| basic | Start with `init`; iterate modules; run `integrate` after each module batch | Expect ORM wiring from no-ORM modules; piped stdin into `add util` in CI expecting JSON purity |
| intermediate | Keep ORM choice consistent per project; validate write paths with `add validation`; use `--yes --json` headless flags | Assume `recipe` availability below advanced posture; assume Prisma schema sync happens automatically (`npx prisma init` must exist first) |
| advanced | Compose recipes to stand up production baseline; assert outcomes with `--json` in CI | Treat generated auth as final security review; rely on `--no-install` for recipes (they own installs) |

## 6. Worked examples

### 6.1 basic — zero-dep module then integrate into a foreign Express app

```bash
cd ./existing-express-app        # has package.json + express but no app/
rakitin init                     # auto-preset: basic
rakitin add module user-profile --arch modular --orm none
rakitin integrate
```

Resulting inventory:

```
.rakitinrc.json
app/modules/user-profile/
├── controllers/user-profile.controller.js
├── services/user-profile.service.js      # in-memory USERPROFILE_STORE
├── models/user-profile.model.js          # placeholder stub
└── routes/user-profile.router.js
app/routes/index.js                        # marker-managed mounting
```

Wiring into a foreign app requires exactly one line the command suggests:

```js
// server.js (your code)
app.use('/api', require('./app/routes'));
```

Requests land at `GET /api/user-profile` routed through the modular
router. `.bak` backups appear only if `app/routes/index.js` already
existed before the integration.

### 6.2 intermediate — mongoose module + joi validator + endpoint

```bash
rakitin add module article --arch modular --orm mongoose   # installs mongoose once
printf 'article\narticles\ntitle:string,body:text\nY\nY\n' | rakitin add endpoint
printf 'new\nArticle\ntitle:string:true,body:string:true\n' | rakitin add validation
```

What you get:

* `app/modules/article/services/article.service.js` delegating CRUD to the
  `<kebab>.model` placeholder you fill with a real Mongoose model.
* `app/modules/article/{controllers,services,routes}/articles.*` —
  pagination/filter-aware endpoint pair.
* `app/shared/validators/article.validator.js` exporting
  `ArticleSchema`, `ArticleCreateSchema` (required fields), and
  `ArticleUpdateSchema` (all-optional, `.min(1)`).

Re-run `rakitin integrate` afterwards so the new endpoint routes join the
managed block.

### 6.3 advanced — compose recipes sequence with expected file inventory

```bash
rakitin recipe auth          # jwt middleware + user module + validators + deps
rakitin recipe swagger       # openapi.json + mountSwagger helper + README
rakitin recipe test          # tests/setup.js + tests/modules/*.test.js
rakitin recipe docker        # Dockerfile + compose + .dockerignore
```

Expected creation footprint (fresh project):

```
app/shared/middlewares/auth.middleware.js
app/modules/user/**                         (modular, ORM none)
app/shared/validators/user.validator.js
app/docs/openapi.json
app/docs/swagger.setup.js
app/docs/README.md
tests/setup.js
tests/modules/<each-existing-module>.test.js
Dockerfile
docker-compose.yml
.dockerignore
.env.example                                (+ JWT_*, API_BASE_URL, NODE_ENV)
package.json                                ("test": "jest" when unset)
node_modules: jsonwebtoken joi swagger-ui-express swagger-jsdoc
devDeps: jest supertest
```

Every step above is independently re-runnable: existing files are skipped
with a message rather than overwritten.

## 7. Feature parity matrix

✅ = available at this tier · ➖ = needs a higher tier

| Feature | basic | intermediate | advanced |
| --- | :-: | :-: | :-: |
| Modules without ORM | ✅ | ✅ | ✅ |
| Modules with ORM wiring | ➖ | ✅ | ✅ |
| Custom/config/util scaffolds | ✅ | ✅ | ✅ |
| Marker-based router integration | ✅ | ✅ | ✅ |
| Joi validators (`add validation`) | ➖ | ✅ | ✅ |
| Endpoints w/ pagination & filtering | ➖ | ✅ | ✅ |
| api-docs (`recipe swagger`, `add docs`) | ➖ | ➖ | ✅ |
| Auth bundle (JWT guard; full flow via `recipe auth`) | ⚠️ guard only¹ | ⚠️ guard only¹ | ✅ |
| Testing scaffold (`recipe test`) | ➖ | ➖ | ✅ |
| Containerization (`recipe docker`) | ➖ | ➖ | ✅ |

¹ The single `auth` middleware file itself belongs to the basic catalog
(`add middleware auth`), but the complete signup/login flow — user
module, validators, env keys, dependency wiring — is an advanced-tier
recipe.

## 8. FAQ

**Can I mix architectures across modules?**
Yes, explicitly supported. Each module’s layout is detected
independently (`routes/<name>.router.js` ⇒ modular, `<name>.controller.js`
⇒ simple). `doctor` marks mixed layouts as `warn` (informational), while
`info` reports `"modules": {"mixed": true}`. Auto-integration keeps working.

**Does `integrate` overwrite my custom routes?**
No. Only the region between the `/* rakitin:routes:start */ …
/* rakitin:routes:end */` markers is regenerated. Marker-less routers get
the block appended/injected while surrounding bytes are preserved, and the
pre-replacement copy is stored as `index.js.bak`.

**What if node_modules is absent?**
Detection never depends on installed packages — it reads `package.json`
manifests. Install steps resolve missing packages against
`node_modules/`; with no packages needed (basic tier), behavior is
identical offline. Manifest installs will attempt download only when a
declared package is actually missing.

**Offline installs / `--no-install`.**
For `add module`/`add middleware`, pass `--no-install` to skip network
access entirely; add the listed dependencies later with your own tooling.
Recipes do not honor `--no-install` today (they manage their own
install steps), although failure downgrades to warnings where wrapping
allows it.

**Why does `doctor` warn about jsonwebtoken?**
If `app/shared/middlewares/auth.middleware.js` exists but the package is
missing, generated code would throw at require-time — the check exists to
catch manually-deleted or never-installed dependencies early.

**Do presets restrict commands?**
No. Presets document intent and steer defaults; all three tiers’ commands
are runnable regardless of your `.rakitinrc.json` value.
