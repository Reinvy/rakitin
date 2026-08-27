# Router Integration

Both integration flows shipped by rakitin v2 produce the same artifact — a
marker-managed `app/routes/index.js` — through different ergonomics:

| Flow | Entry point | Mode |
| --- | --- | --- |
| New headless integration | `rakitin integrate` (`lib/commands/integrate.js`) | non-interactive, script-friendly |
| Legacy interactive flow | `rakitin router` or bare menu → “Router Integration” (`lib/generator/router/router.js#integrateRouter`) | inquirer-driven |

All router edits funnel through the universal safety layer
(`lib/safety.js`): write-if-absent creation, `.bak` backups on replace, and
idempotent marker injection. Nothing ever blind-overwrites your router.

---

## 1. Marker mechanics

Exact tokens exported from `lib/safety.js`:

```
/* rakitin:routes:start */
/* rakitin:routes:end */
```

`buildRoutesContent(existing, routeLines)` decides what happens given the
current state of `app/routes/index.js`:

| Existing file | Action | Behavior |
| --- | --- | --- |
| absent | `create` | express header + marked block + `module.exports = router;` |
| has both markers | `inject` | everything outside `[start…end]` preserved **byte-for-byte**, marked region replaced |
| no markers, ends with `module.exports` | `inject` | full marked block inserted **before** the last `module.exports`; user code above untouched |
| no markers, no anchor | `append` | trimmed existing content + trailing marked block |

A fresh router therefore looks like:

```js
const express = require('express');
const router = express.Router();

/* rakitin:routes:start */
// Routes managed by rakitin - safe to regenerate; keep custom
// routes OUTSIDE these markers to preserve them.
// …wiring…

/* rakitin:routes:end */

module.exports = router;
```

The two explanatory comment lines belong to `create`/`append` output.
When a later run takes the `inject` replacement path, the region between
the tokens is rewritten *without* those comments — so the very first
regeneration normalizes to the canonical bare-token form (see §5).

Custom routes placed outside the markers survive every regeneration,
regardless of architecture choice.

## 2. Global middlewares in the generated router

Only four kinds can be selected because only these four actually have a
generator backing them:

* Authentication (JWT) — `auth`
* Request Logging — `logger`
* Global Error Handler — `error`
* Request Time — `request-time`

(This deliberately replaced an older six-option list that advertised
`cors`, `rateLimit`, and `bodyParser` entries nothing ever generated.)

Naming rules when wiring a middleware `m`:

* file name — `normalizeModuleName(m)` ⇒ kebab-case:
  `app/shared/middlewares/<kebab>.middleware.js` (e.g.
  `request-time` → `request-time.middleware.js`, `My Cool MW` →
  `my-cool-mw.middleware.js`);
* identifier — `toIdentifier("<m>-middleware")` ⇒ safe camelCase JS
  variable (`requestTimeMiddleware`);
* emitted pair —

```js
const authMiddleware = require('../shared/middlewares/auth.middleware');
router.use(authMiddleware);
```

The headless `integrate` adds one safety rule: a middleware is wired only
if its file already exists on disk, checked once up front — dangling
requires are structurally impossible.

## 3. Flow A — `rakitin integrate` (new, headless)

### 3.1 Automatic module discovery rules

Discovery is driven by the project detector over `app/modules/*`:

1. Every directory under `app/modules` that does not start with `.` is a
   candidate.
2. Architecture is judged **per module, independently**:
   * `modular` ⇔ `app/modules/<dir>/routes/<kebab>.router.js` exists;
   * `simple` ⇔ `app/modules/<dir>/<kebab>.controller.js` exists;
   * neither ⇒ the directory is excluded silently.
3. Mixed layouts are therefore supported natively: modular modules mount
   sub-routers while simple modules get direct handler bindings in the
   same generated block.

Per-module emitted lines:

```js
// modular
const userProfileRouter = require('../modules/user-profile/routes/user-profile.router');
router.use('/user-profile', userProfileRouter);

// simple
const paymentController = require('../modules/payment/payment.controller');
router.get('/payment', paymentController.getAll);
router.post('/payment', paymentController.create);
```

(`require` paths are extension-less; simple wiring binds exactly
`getAll` + `create`.)

### 3.2 Runtime behavior summary

* No intermediate exists? `writeFileIfNotExistsSafe` creates
  `app/routes/index.js` plus parent directories.
* Result `action` ∈ `created | markers-regenerated | block-injected |
  appended` (command-layer names mapping §1 actions; `markers-regenerated`
  covers any marker replacement).
* `--dry-run` prints the plan `{op, path}` pairs instead of writing.
* Zero valid modules ⇒ exit `0` with guidance
  (“Tidak ada modul valid untuk diintegrasikan…”), not an error — assert
  via `--json` payloads when your CI needs strictness.
* Success contract: `ok:true`, `wired[]` (kebab names),
  `middlewareApplied[]`, and the mounting hint
  `app.use('/api', require('./app/routes'))`.

### 3.3 Mounting cheat-sheet

Whatever the flow, finishing touches are identical:

```js
// app.js / server.js — your code, one line
app.use('/api', require('./app/routes'));
```

Post-run verification loop an agent can run unattended:

```bash
rakitin integrate --json | jq '{action, wired, middlewareApplied}'
node -e "require('./app/routes')"   # router module must load cleanly
jq '.mainRouter' < <(rakitin info)  # markerManaged: true afterwards
```

If the last probe still reports `markerManaged: false`, a previous
`.bak` round left stale content or the markers were edited away; compare
against `app/routes/index.js.bak` before re-running.

## 4. Flow B — `rakitin router` (legacy, interactive)

Prompt order (all steps remain valid today):

1. `integrationType` — automatic detection of all modules, or manual
   checkbox selection (`selectedModules`). Empty candidates abort early
   with a warning.
2. Target path fixed to `app/routes/index.js`; the directory is ensured
   (`ensureDir`) even if missing.
3. `architecture` — one global choice: Modular (each module owns a router)
   or Simple (everything flat).
4. Pre-validation: `FileValidator.validateRouterIntegration` checks each
   selected module against the **single chosen architecture** and the
   whole integration aborts on failure (“Validasi gagal.”). This strictness
   is the key behavioral difference versus the modern flow (§6).
5. `useGlobalMiddleware` confirm → `selectedMiddlewares` checkbox of the
   four real options above.
6. Composition: imports for every valid module (individually re-validated;
   an invalid one prints an error line and is skipped rather than crashing),
   then `router.use(...)` bindings for modular wiring or five verbs
   (`get/getById/post/put/delete`) for simple wiring.

   Note: legacy simple wiring binds all five handlers, whereas the new
   headless flow intentionally binds only `getAll`+`create`; import paths
   here include the `.js` suffix (via `PathResolver`), which the headless
   variant omits.
7. Write through the same safety layer (`created` message otherwise), then:
8. `createAppExample` — offers usage scaffolding for root `app.js`:
   * file missing ⇒ writes a minimal Express bootstrap that mounts
     `./app/routes` under `/api`;
   * file exists ⇒ `overwriteApp` confirm defaults to **No**, and a Yes
     merely *appends* the mount snippet (never replacing anything).

## 5. Idempotency proof

Marker replacement guarantees convergence. First run creates/integrates;

```bash
$ rakitin integrate --json | jq '.action'
"created"

$ cp app/routes/index.js /tmp/gen-1
$ rakitin integrate --json | jq '.action'
"markers-regenerated"
```

The second generation rewrites the block in canonical form (dropping the
creation-time comment header inside the block); from this point on the
file is stable:

```bash
$ cp app/routes/index.js /tmp/gen-2
$ rakitin integrate --json >/dev/null
$ diff /tmp/gen-2 app/routes/index.js && echo IDENTICAL
IDENTICAL

$ sha256sum /tmp/gen-{2,3}.*  # (after another capture+run)
<same digest>                 # byte-equal digests
```

So: **two consecutive runs produce identical bytes** as long as the module
inventory did not change; adding a module only diffs the wiring lines added
inside the markers. Each replacement leaves its predecessor behind as
`app/routes/index.js.bak`.

## 6. Failure handling philosophy

| Situation | Modern `integrate` | Legacy `router` flow |
| --- | --- | --- |
| Module dir lacks recognized structure | skipped silently during discovery (not listed as valid) | strict validator error listing the missing artifact; whole run aborted |
| Controller import broken mid-composition | cannot happen (structure pre-checked by detector) | module skipped with error print, rest proceeds |
| Missing `app/routes/` directory | created recursively via write helper | explicitly ensured upfront |
| Unsupported edge during write | thrown errors reach `fail()` ⇒ exit 1 | `ErrorHandler` logs and the flow returns quietly |

The removal of strict *pre*-validation in the automatic path is deliberate
(documented inline in `integrateAutoRouter`): since each module’s
architecture is detected independently and invalid ones degrade to
warnings/`try/catch` skips, a single malformed directory must not prevent
every healthy module from being wired. Invalid directories never end up
generating a dangling require.

## 7. Old vs new differences table

| Aspect | Legacy `router` (interactive) | New `integrate` (headless) |
| --- | --- | --- |
| Module selection | manual checkbox or detect-all prompt | always detect-all |
| Layout decision | single global architecture forced onto all modules | per-module independent detection (mixed OK) |
| Simple-module wiring | all five REST verbs | `getAll` + `create` only |
| Require paths | with `.js` suffix (`PathResolver`) | extension-less |
| Middleware choice | 4 real options via checkbox | any comma list via `--middleware`, existence-checked |
| Phantom middlewares (`cors`, `rateLimit`, `bodyParser`) | removed from menu | never accepted |
| Validation | strict pre-validation, aborts on mismatch | relaxed: skip/warn instead of abort |
| app.js helper question | confirm flow, may create/patch root `app.js` | none (next-step hint only) |
| Scriptability | TTY only | `--json`, `--dry-run`, CI-safe exit codes |
| Safety | markers + `.bak` | identical markers + `.bak` semantics |

Both flows converge on the same managed artifact; scripts should prefer
Flow A, interactive sessions may keep using Flow B.
