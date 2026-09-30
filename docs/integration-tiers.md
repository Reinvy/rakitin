# Integration Tiers & Dependency Matrices

rakitin's promise is **adopt at any depth, keep everything**. Every
generator declares the packages its *output* needs in one registry
(`lib/deps/manifest.js#KIND_DEPENDENCIES`), and the `rakitin list` tier
labels (`basic`, `intermediate`, `advanced`, `plugin`) describe how much a
capability asks of your project.

Two hard rules apply at every tier:

1. **rakitin never installs Express.** Your app owns its framework version;
   rakitin only detects it (`doctor` warns when it is absent, but the basic
   generators still work).
2. **An unknown kind is a hard error**
   (`Kind dependency tidak dikenal: "<kind>"`), never a silent skip — that is
   how dangling imports were eliminated.

---

## 1. The three tiers at a glance

| | **basic** | **intermediate** | **advanced** |
| --- | --- | --- | --- |
| Definition | Zero-risk module & router integration for an existing Express app | Database-backed modules, validation, API docs | Production-shaped composites (auth, tests, containers) |
| Commands | `init`, `add module --orm none`, `add middleware`, `add util`, `add config`, `integrate` | + ORM-backed `add module`, `add validation`, `add endpoint`, `add graphql`, `add websocket`, `add docs openapi-*` | + `add docs swagger-ui`/`complete`, `add test`, `recipe auth\|swagger\|test\|docker` |
| Dependency surface | empty for every default flow | exactly what your ORM / validation / transport needs | full recipe surface (incl. dev-only test packages) |
| Target | existing-Express adopter wanting reviewable scaffolding | team standardizing data layers and contracts | platform team standardizing production posture |

`add module --orm none` is the zero-dependency guarantee: it must always
succeed with **no new packages** (that is why the no-ORM service embeds an
in-memory store).

---

## 2. The dependency registry (authoritative)

Every kind below exists in `KIND_DEPENDENCIES`; the “used by” column names
the command that requests it.

| Kind | Packages | Used by |
| --- | --- | --- |
| `module:none` | — | `add module --orm none`, `recipe auth --orm none` |
| `module:prisma` | `@prisma/client`, `prisma`, `dotenv` | `add module --orm prisma`, `init --orm prisma`, `recipe auth --orm prisma` |
| `module:sequelize` | `sequelize`, `mysql2` | `add module --orm sequelize`, `recipe auth --orm sequelize` |
| `module:mongoose` | `mongoose` | `add module --orm mongoose`, `recipe auth --orm mongoose` |
| `module:typeorm` | `typeorm`, `reflect-metadata` | `add module --orm typeorm`, `recipe auth --orm typeorm` |
| `middleware:auth` | `jsonwebtoken` | `add middleware auth` |
| `middleware:custom` | — | `add middleware custom` |
| `middleware:logger` | — | `add middleware logger` |
| `middleware:error` | — | `add middleware error` |
| `middleware:request-time` | — | `add middleware request-time` |
| `validation:joi` | `joi` | `add validation` (all three modes), `recipe auth` |
| `docs:openapi-json` | — | `add docs openapi-json` |
| `docs:openapi-yaml` | — (built-in emitter) | `add docs openapi-yaml` |
| `docs:swagger-ui` | `swagger-ui-express`, `swagger-jsdoc` | `add docs swagger-ui`, `add docs complete`, `recipe swagger` |
| `util:any` | `dotenv` | registry aggregate (see note) |
| `util:uuid` | `uuid` | `add util uuid` |
| `util:date` | `dayjs` | `add util date` |
| `util:env` | `dotenv` | `add util env` |
| `util:file` · `util:crypto` · `util:string` · `util:number` · `util:array` · `util:object` · `util:url` · `util:color` · `util:math` · `util:validation` · `util:regex` · `util:time` | — | the matching `add util <kind>` |
| `config:any` | `dotenv` | registry aggregate (see note) |
| `config:app` · `config:database` · `config:jwt` · `config:cors` · `config:logger` · `config:mailer` · `config:cloud` · `config:payment` · `config:redis` · `config:socket` · `config:env` · `config:custom` | `dotenv` | the matching `add config <kind>` |
| `graphql:core` | `graphql`, `graphql-http` | `add graphql`, `add module --template graphql` |
| `websocket:ws` | `ws` | `add websocket`, `add module --template realtime` |
| `test:dev` | `jest@^29`, `supertest` | `add test`, `recipe test`, `add module --with-tests` |
| `recipe:auth` | `jsonwebtoken`, `joi`, `bcryptjs` | `recipe auth` |

Notes:

- `util:any` and `config:any` are registry-level aggregate keys. The
  `add util`/`add config` commands request the **specific** kind
  (`util:uuid`, `config:jwt`, …); the `*:any` entries exist for hosts and
  plugins that want the family default (`dotenv`).
- `test:dev` is listed in `DEV_KINDS`, so its packages install as
  **devDependencies** (with the package manager's dev flag: npm
  `--save-dev`, pnpm `-D`, yarn `--dev`, bun `-d`).
- Plugin-declared kinds are merged on top of this table through
  `extraKinds`; a plugin generator's default kind is `plugin:<generator-id>`.

---

## 3. Tier → kind mapping

| Tier | Kinds | Packages introduced |
| --- | --- | --- |
| **basic** | `module:none`, `middleware:custom\|logger\|error\|request-time`, `util:*` (except `uuid`/`date`/`env`), `config:*` (→ `dotenv`) | `dotenv` for configs/utils that read env; `jsonwebtoken` only if you add the `auth` middleware |
| **intermediate** | all basic + `module:prisma\|sequelize\|mongoose\|typeorm`, `validation:joi`, `graphql:core`, `websocket:ws`, `docs:openapi-json`, `docs:openapi-yaml` | your ORM's packages, `joi`, and — if you generate those families — `graphql`+`graphql-http`, `ws` |
| **advanced** | all intermediate + `docs:swagger-ui`, `test:dev`, `recipe:auth` | `swagger-ui-express`+`swagger-jsdoc`; dev-only `jest`+`supertest`; `jsonwebtoken`+`joi`+`bcryptjs` |

Deduping is per run: `resolvePackagesForKinds` merges every requested kind
into unique package sets, and `ensureDependencies` installs each set once, so
`recipe auth && recipe swagger` never downloads a package twice.

---

## 4. Presets

Presets steer the defaults (`buildContext`), they do not restrict commands.

| Preset | `orm` | `generateValidationLayer` | `generateTestFiles` |
| --- | --- | --- | --- |
| `basic` | `none` | `false` | `false` |
| `intermediate` | configured/`--orm`, default `prisma` | `true` | `false` |
| `advanced` | same as intermediate | `true` | `true` |

Auto-preset when `--preset` is omitted: an installed ORM, a `--orm` flag, or
a configured ORM ⇒ `intermediate`; otherwise `basic`.

`generateValidationLayer` and `generateTestFiles` are consumed by
`add module` (the latter gates the automatic test file, the former is the
documented default intent for validation work) and are read from
`.rakitinrc.json` first, so an explicit rc value always wins over the preset.

Upgrade path: run `rakitin init --preset intermediate` (or `--force` to
regenerate the rc). Presets change the defaults of *future* generations; files
you already have are untouched. There is no downgrade state — no command
refuses to run because your rc says `basic`.

---

## 5. Worked examples

### 5.1 basic — zero-dep module in a foreign Express app

```bash
cd ./existing-express-app
rakitin init                                  # auto-preset: basic
rakitin add module user-profile --arch modular --orm none
rakitin integrate
```

```
.rakitinrc.json
app/modules/user-profile/
├── controllers/user-profile.controller.js
├── services/user-profile.service.js           # in-memory store
├── models/user-profile.model.js               # placeholder (orm none only)
└── routes/user-profile.router.js
app/routes/index.js                            # marker-managed mounting
```

One line in your app finishes the job:

```js
app.use('/api', require('./app/routes'));
```

### 5.2 intermediate — Mongoose module + Joi validator + resource endpoint

```bash
rakitin add module article --arch modular --orm mongoose    # installs mongoose once
rakitin add validation article --fields title:string:true,body:string
rakitin add endpoint article --resource comments --fields body:string
rakitin integrate
```

```
app/modules/article/{controllers,services,routes,models}/article.*
app/modules/article/resources/{comments.resource.js,comments.controller.js}
app/modules/article/routes/article.router.js        # + // rakitin:resources: region
app/shared/config/db.js                             # mongoose connection singleton
app/shared/validators/article.validator.js          # ArticleSchema/Create/Update
```

### 5.3 advanced — recipes, expected footprint

```bash
rakitin recipe auth          # jwt middleware + user module + validator + deps + env
rakitin recipe swagger       # swagger config + mount-ready app/docs entry
rakitin recipe test          # jest.config.js + tests/setup.js + per-module specs
rakitin recipe docker        # Dockerfile + .dockerignore (needs an entrypoint)
```

```
app/shared/middlewares/auth.middleware.js
app/modules/user/**
app/shared/validators/user.validator.js
app/shared/config/swagger.config.js
app/docs/index.js
jest.config.js
tests/setup.js
tests/modules/<each existing module>.test.js
Dockerfile
.dockerignore
.env.example                          (+ JWT_*, API_BASE_URL sections)
package.json                          ("test"/"test:watch" when unset)
```

Every step is independently re-runnable: existing files land in `skipped[]`
instead of being overwritten.

---

## 6. FAQ

**Can I mix architectures across modules?**
Yes. Each module's layout is detected independently
(`routes/<kebab>.router.js` ⇒ modular, `<kebab>.controller.js` ⇒ simple), and
both are wired with the same `require` + `router.use` shape. `doctor` flags
mixed layouts as `warn` (informational).

**Does `integrate` overwrite my custom routes?**
No. Only the region between `/* rakitin:routes:start */` and
`/* rakitin:routes:end */` is regenerated; marker-less routers get the block
injected before `module.exports`, surrounding bytes preserved, and the
previous content is kept as `index.js.bak`.

**What if `node_modules` is absent?**
Detection reads `package.json` manifests only — it never requires installed
packages. Install steps resolve missing packages against `node_modules/`, so
with no packages needed (basic tier) the behavior is identical offline.

**Offline installs / `--no-install`.**
Every command that installs honors `--no-install` (recipes included): the
install is skipped and the packages are reported in `data.install.skipped`.
Add them later with your own tooling.

**Do presets restrict commands?**
No. Presets document intent and steer defaults.

**Why does `doctor` warn about a dependency?**
When a generated feature exists on disk but a package from its kind is
missing from `package.json`, the generated code would throw at require time.
`doctor` derives that check from `KIND_DEPENDENCIES`, so it covers the auth
middleware, validators, YAML docs, GraphQL, WebSocket, test files and Prisma
schemas.
