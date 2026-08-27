# Migrating rakitin 1.x → 2.x

rakitin **2.0.0** replaces the fully interactive v1 UX with a headless-first,
integration-hardened CLI while deliberately keeping the old entry points
alive. This guide lists every breaking change, why it exists, and the exact
code/CI edits needed. Long-term support policy lives in
[`strategi-rilis-dan-maintenance.md`](../strategi-rilis-dan-maintenance.md).

---

## 1. Breaking changes

### 1.1 Command surface replaced by verb-style commands

v1 was a single menu (`Module`, `Middleware`, …). v2 exposes explicit verbs:

| v1 action | v2 command |
| --- | --- |
| menu → Module | `rakitin add module <name>` (headless-capable) |
| menu → Middleware | `rakitin add middleware <kind>` |
| menu → Util | `rakitin add util` |
| menu → Config | `rakitin add config <kind>` |
| menu → Router Integration | `rakitin integrate` (+ `rakitin router` legacy alias) |
| menu → API Endpoint | `rakitin add endpoint` |
| menu → API Documentation | `rakitin add docs` |
| menu → API Validation | `rakitin add validation` |

The legacy UX still boots when you run `rakitin` with **no arguments**, and
the interactive router flow remains reachable via `rakitin router`. Both are
frozen features — new capabilities land only in the verbs. Removal is slated
for the next major release at the earliest (see §4).

### 1.2 Global middleware choices narrowed to the generatable set

The legacy router menu advertised six options including `cors`,
`rateLimit`, and `bodyParser` stubs that *nothing ever generated*, producing
broken requires on selection. The choice list is now exactly the four
kinds the middleware generator can emit:

* Authentication (JWT) — `auth`
* Request Logging — `logger`
* Global Error Handler — `error`
* Request Time — `request-time`

Projects that hand-crafted wiring for the phantom options must switch to
real middleware (or keep their own implementations outside rakitin blocks —
custom code between markers was never supported anyway).

### 1.3 Node.js engine floor raised to >= 18

`engines.node` is now `>=18.0.0`. The CLI aborts or warns under older runtimes
depending on package-manager enforcement. Align CI images (Node 18+).

### 1.4 Real EJS template engine; new export shape of `lib/template/engine`

The hand-rolled engine (which failed to compile multi-line templates and had
no production callers) was replaced by an EJS-based one.

```js
// BEFORE (v1) — ad-hoc rendering helpers
const engine = require("rakitin/lib/template/engine");

// AFTER (v2) — named exports, one class + two shortcuts
const {
  TemplateEngine,   // class: new TemplateEngine({ enableCache, locals, ejsOptions })
  renderTemplate,   // one-shot render on a shared default instance
  defaultEngine,    // that shared instance
} = require("rakitin/lib/template/engine");

const html = renderTemplate("<h1><%= title %></h1>", { title: "hi" });
```

Templates are plain EJS (`<%= %>`, `<%- %>`, `<% if %>`,
`include('./partial', {...})`). Any code depending on the old internal
renderer’s symbol names needs updating to these three exports.

### 1.5 `lib/constants` exports lazy getters + `getPaths(root)` factory

Path constants are no longer plain strings captured at require time (which
silently broke `--cwd` and test sandboxes). They are now access-time getters
resolved against `process.cwd()`, plus an explicit snapshot factory.

```js
// BEFORE (v1)
const { appRoutesPath, modulesPath } = require("rakitin/lib/constants");

// AFTER (v2)
const { getPaths } = require("rakitin/lib/constants");
const { appRoutesPath, modulesPath } = getPaths(process.cwd());
```

Mechanical migration: destructure inside functions instead of at module top,
or wrap once yourself:

```js
let P;
function paths() {
  return (P ??= getPaths());
}
```

### 1.6 Removed dead exports

These symbols existed in v1 but were dead weight; they no longer resolve:

* `lib/generator/shared/integration-helper.js` — entire module deleted.
* `handleAutoRouterIntegration` — removed from
  `lib/generator/router/router`; current exports are
  `{ integrateRouter, createAutoRouterTemplate, createAutoRouter, integrateAutoRouter }`.
* Template-literal constants formerly exported from
  `lib/constants` (`mainRouterTemplate`, `appJsTemplate`,
  `middlewareTemplates`, siblings) — replaced by the safety layer
  (`buildRoutesContent`) and the generator templates.

Consumers should migrate to public APIs (§3, step 4).

### 1.7 Generator return shapes (summaries)

Non-interactive cores now return structured summaries for the command layer:

```js
createMiddleware(type /* , customName */); // -> { created, createdFiles[], skipped[], kind }
createConfig(type, { withEnvExample });    // -> same summary shape
```

Nothing breaks if you only ever called them fire-and-forget: the classic
entries `generateMiddleware()` / `generateConfig()` remain callable exactly
as before (interactive flows), with `.createMiddleware` / `.createConfig`
attached as named extras on the same modules.

### 1.8 Prisma models become live: schema append + client singleton

Previously Prisma model boilerplate landed silently in `prisma/models/*.prisma`
— files stock Prisma never reads, i.e. inert output. In v2:

1. models are still written to `prisma/models/<kebab>.prisma`;
2. their `model` block is **appended to `prisma/schema.prisma`** behind an
   idempotent `// rakitin:model:<Name>` marker (missing schema triggers a
   warning telling you to run `npx prisma init` first);
3. `app/shared/config/db.js` — the PrismaClient singleton generated services
   import — is created for you.

Re-run generators after a late `npx prisma init` to backfill the schema.

### 1.9 Syntax validation no longer executes your files

`FileValidator.validateJavaScriptFile` used to load/execute the target file
as part of “validation” — a side-effect and security hazard (env access,
connections, monkey-patching during a mere check). It now performs
compile-only validation via `new vm.Script(source)`; runtime errors surface
normally when Express loads the router.

If you relied on validation doubling as smoke-testing, add a real import in
your CI pipeline instead.

### 1.10 Relaxed modular path validation

Modular integration required `controllers/`, `services/`, and `models/`
subfolders to exist even though only `routes/` participates in wiring.
Validation now demands just the `routes/` directory for modular modules, so
routes-only minimal modules verify correctly.

### 1.11 Endpoint generation drops camelCase twin controllers

In simple-layout projects, generating an endpoint used to write a second
camelCase controller that silently dropped the user’s field schema next to
the kebab-case one. Now both architectures consistently produce kebab-case
files reusing ONE controller pair (see `docs/module-examples.md`), and the
simple-service search logic derives from declared text fields rather than a
hard-coded property.

## 2. What migrates automatically on first run

Running any v2 integration touches existing main routers through the safety
layer:

1. Router already managed by markers → managed region regenerated
   (action `markers-regenerated`); everything outside stays byte-identical.
2. Marker-less router → block appended/injected with **backup first**:
   the original file becomes `<path>.bak` (typically
   `app/routes/index.js.bak`).
3. Missing router → fresh create.

Exact landed result of an append onto a marker-less file whose tail was:

```js
module.exports = router;
```

Afterwards the tail reads (markers anchored **before** your
`module.exports`, leaving its position meaningful):

```js
const express = require('express');
const router = express.Router();

// …your own routes above stay byte-identical…

/* rakitin:routes:start */
// Routes managed by rakitin - safe to regenerate; keep custom
// routes OUTSIDE these markers to preserve them.
const userPaymentController = require('../modules/payment/payment.controller');
router.get('/payment', userPaymentController.getAll);
router.post('/payment', userPaymentController.create);

/* rakitin:routes:end */
module.exports = router;
```

(The identical copy of your pre-run file sits alongside as
`app/routes/index.js.bak` — commit it once so reviewers see the pristine
before-state.)

**Audit step:** after upgrading, diff each `app/routes/index.js.bak`
against its successor and confirm nothing outside the marked region moved.

## 3. Migration steps

### Step 1 — Audit existing routers

For every project adopting v2: run `rakitin doctor` (check “Router utama”
should read marker-managed) and inspect/rename the produced `.bak` files.
Markers guarantee subsequent runs are idempotent and reviewable.

### Step 2 — Update CI away from menu-driven expectations

Any pipeline that drove the interactive menu (piped answers into
`rakitin`) should assert on machine output instead:

```bash
# human-scan era (v1): script the menu…  fragile.
# v2: deterministic exit codes + JSON contract
CI=true rakitin add module invoice --arch modular --orm none --yes --json | jq -e '.ok'
rakitin integrate --json | jq -e '.action == "markers-regenerated" or .action == "block-injected"'
rakitin init --preset basic --json >/dev/null || echo "init failed"
```

Recall the contract: success ⇒ single `{ok,created[],skipped[],plan?,nextSteps[]}`
object; failure ⇒ `{ok:false,error}` with exit code `1`.

### Step 3 — Replace direct `constants` requires with `getPaths`

See §1.5 for the before/after require lines. Grep targets:
`require("rakitin/lib/constants")`, local forks of
`lib/constants.js`, plus anything destructuring template-name exports.

### Step 4 — Swap custom integrations onto public command APIs

Replace imports of deleted internals (§1.6) with the documented interfaces:

```js
// BEFORE — dies under v2
const { handleAutoRouterIntegration } = require("rakitin/lib/generator/router/router");
const { magicHelper } = require("rakitin/lib/generator/shared/integration-helper");
await handleAutoRouterIntegration({ autoDetect: true });

// AFTER — stable v2 layer
const { integrateCommand } = require("rakitin/lib/commands/integrate");
const { recipeCommand, RECIPES } = require("rakitin/lib/commands/recipe");
const { addCommand } = require("rakitin/lib/commands/add");
const safety = require("rakitin/lib/safety"); // buildRoutesContent / markers

await integrateCommand({ middleware: ["auth", "logger"] });
```

Library callers wanting programmatic plans can drive
`safety.beginPlan()` / `safety.getPlan()` around any command call, then
`safety.resetPlan()`.

### Step 5 — Re-generate where behavior changed

* Prisma users: ensure `npx prisma init` has run, then re-run affected
  module generators so model blocks append into `schema.prisma`.
* Teams keeping phantom middlewares (`cors`, `rateLimit`, `bodyParser`
  from the old list): either generate the four real kinds and mount yours
  manually, or vendor them locally — rakitin will not emit them.
* Endpoints regenerated post-upgrade lose the stale camelCase twins;
  delete leftover twins manually if v1 left them behind.

## 4. Deprecation timeline

| Phase | Surface state | Guidance |
| --- | --- | --- |
| v1.x (historical) | Full interactive menu only | Freeze new work; plan migration |
| **2.0.0 (current)** | Verb-style primary · bare menu + `rakitin router` retained untouched | All new scripts/targets should use verbs + `--json` |
| All 2.x minors | Legacy entries continue working; bug-fix level support only | Start removing menu scripting internally |
| Earliest 3.0.0 | Legacy menu and `router` alias candidates for deletion | Nothing scripted against verbs should notice |

Concrete scheduling follows SemVer discipline and the maintenance policy in
[`strategi-rilis-dan-maintenance.md`](../strategi-rilis-dan-maintenance.md).
