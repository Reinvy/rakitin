# Module Examples — real v2 output

Everything in this document reflects **rakitin v2.0.0** templates as they
are emitted today (`lib/generator/module/arch/simple.arch.js`,
`lib/generator/module/arch/modular.arch.js`,
`lib/generator/shared/orm-service-generator.js`, case `None`). Statements
made against older blog posts / v1 documentation are flagged under each
section and link to the [migration guide](./migration-v1-to-v2.md).

Scope guard: examples use module name **`user-profile`** with **ORM =
None** only — the zero-dependency baseline guaranteed by the basic tier.
File bodies are the template outputs verbatim modulo trivial leading /
trailing whitespace normalized for doc readability.

---

## 1. Generating the sample

```bash
rakitin add module user-profile --arch modular --orm none   # modular tree
# or
rakitin add module user-profile --arch simple --orm none    # flat trio
```

Naming convention recap (single source: `lib/naming.js`):

| Input | Directory / files | Identifier | Header comments |
| --- | --- | --- | --- |
| `user-profile` | `app/modules/user-profile/…` | `userProfile…` | kept as typed |

## 2. Modular tree (`--arch modular`)

```text
app/modules/user-profile/
├── controllers/
│   └── user-profile.controller.js
├── services/
│   └── user-profile.service.js
├── models/
│   └── user-profile.model.js
└── routes/
    └── user-profile.router.js
```

Older blog versions showed flat files (`user.controller.js`) for this
layout or `routes/user.routes.js` filenames — both inaccurate for v2: the
detector keys on exactly these subfolder paths
(`controllers/` ⇒ modular, `<name>.controller.js` ⇒ simple).

### 2.1 `controllers/user-profile.controller.js`

```javascript
// user-profile Controller
const { getAll } = require("../services/user-profile.service");

exports.getAll = async (req, res, next) => {
  try {
    const data = await getAll(req);
    res.status(200).json({
      message: "Berhasil mendapatkan data",
      data,
    });
  } catch (err) {
    next(err);
  }
};
```

Note the v2 shape: CommonJS named export, plain numeric status codes,
service-first flow, error handed to `next(err)`. No class syntax, no
hardcoded fixtures — v1-era blog snippets resembling those do not match
today’s output.

### 2.2 `services/user-profile.service.js` (ORM None case)

The no-ORM branch generates an in-memory store whose CRUD surface matches
every other ORM flavor (`getAll/getById/create/update/remove`), so you can
swap in a database later without touching controller/router layers:

```javascript
// user-profile Service (No ORM - in-memory store)
// Replace the in-memory operations with real database calls when ready.

const USERPROFILE_STORE = [];

async function getAll(req) {
  const { page = 1, limit = 10 } = req.query;
  const start = (Number(page) - 1) * Number(limit);
  const items = USERPROFILE_STORE.slice(start, start + Number(limit));
  return { items, total: USERPROFILE_STORE.length };
}

async function getById(req) {
  const { id } = req.params;
  return USERPROFILE_STORE.find((item) => item.id === id) || null;
}

async function create(req) {
  const item = { id: Date.now().toString(), ...req.body };
  USERPROFILE_STORE.push(item);
  return item;
}

async function update(req) {
  const { id } = req.params;
  const index = USERPROFILE_STORE.findIndex((item) => item.id === id);
  if (index === -1) return null;
  USERPROFILE_STORE[index] = { ...USERPROFILE_STORE[index], ...req.body };
  return USERPROFILE_STORE[index];
}

async function remove(req) {
  const { id } = req.params;
  const index = USERPROFILE_STORE.findIndex((item) => item.id === id);
  if (index === -1) return null;
  return USERPROFILE_STORE.splice(index, 1)[0];
}

module.exports = { getAll, getById, create, update, remove };
```

Where does `USERPROFILE_STORE` come from? It is
`camelName.toUpperCase()` of the module name plus `_STORE`
(`user-profile` → `userProfile` → `USERPROFILE`). Pagination bounds
arrive through query params with safe defaults (`page=1`, `limit=10`);
`getById/update/remove` are null-returning instead of throwing so the
controllers keep full control of status codes.

Older write-ups claimed the None flavor left “TODO stubs” inside services;
the actual template ships working in-memory CRUD with zero dependencies.

### 2.3 `models/user-profile.model.js`

```javascript
// user-profile Model
// Schema atau ORM Model bisa ditulis di sini.
```

Intentional placeholder. For ORM=None no model classes/schemas are invented
(older blogs rendered fake Mongoose schemas here — never emitted by any v2
template; see the migration guide §1.8 for how real ORM models land).

### 2.4 `routes/user-profile.router.js`

```javascript
// user-profile Routes
const express = require("express");
const router = express.Router();
const { getAll } = require("../controllers/user-profile.controller");

router.get("/", getAll);

module.exports = router;
```

Exactly one mounted route per generated pair; extended verbs belong to the
[`add endpoint`](./cli-reference.md#46-rakitin-add-endpoint) generator.

## 3. Simple tree (`--arch simple`)

```text
app/modules/user-profile/
├── user-profile.controller.js
├── user-profile.service.js
└── user-profile.router.js
```

### 3.1 `user-profile.controller.js`

As emitted today by `simple.arch.js`:

```javascript
// user-profile Controller

const { getAll } = require("./user-profile.service");

exports.getAll = async (req, res, next) => {
  try {
      const data = await getAll(req);
      res.status(200).json({
        message: "Berhasil mendapatkan data",
        data,
      });
    } catch (err) {
      next(err);
    }
};
```

The simple controller deliberately avoids external status-code
packages: tier-basic output is guaranteed zero-dependency (plain `200`
literals, matching the modular template). Older blog screenshots
showing an `http-status-codes` import describe pre-v2 bytes and do not
describe current templates.

### 3.2 `user-profile.service.js`

Identical body to the modular version above
(`generateServiceCode(..., "Simple")` shares the ORM case text); the store
constant and exported functions are unchanged because the None operation
set has no architecture-relative import paths.

### 3.3 `user-profile.router.js`

```javascript
// user-profile Router
const express = require("express");
const router = express.Router();
const { getAll } = require("./user-profile.controller");

router.get("/", getAll);

module.exports = router;
```

Relative sibling require (`./…`) versus the modular `../controllers/…`
chain — keep both intact if you move files between layouts.

## 4. Auto-router excerpt (helpers embedded)

When integration runs with runtime auto-detection
(`createAutoRouterTemplate`), the produced `app/routes/index.js` embeds its
naming helpers directly, making the output self-contained (no imports from
the rakitin package, which will not exist in your project):

```javascript
/* …express header… */
const fs = require('fs');
const path = require('path');

// --- embedded helpers (self-contained, no external deps) ---
function normalizeModuleName(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toIdentifier(name) {
  const kebab = normalizeModuleName(name);
  let id = kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
  id = id.replace(/[^A-Za-z0-9_$]/g, '');
  if (!id) return '_';
  if (/^[0-9]/.test(id)) return '_' + id;
  return id;
}
// --- end helpers ---
```

And per-module runtime wiring inside the same file:

```javascript
availableModules.forEach((moduleName) => {
  const normalizedModule = normalizeModuleName(moduleName);

  // 1) Modular structure: modules/<name>/routes/<name>.router.js
  // 2) Simple structure: modules/<name>/<name>.controller.js
  try {
    if (fs.existsSync(modularRouterPath)) {
      const moduleRouter = require(modularRouterPath);
      router.use('/' + normalizedModule, moduleRouter);
      loadedCount += 1;
      console.log('[rakitin] Modular router loaded: ' + normalizedModule);
    } else if (fs.existsSync(simpleControllerPath)) {
      /* getAll / getById / create / update / delete bound defensively */
      console.log('[rakitin] Simple routes created: ' + normalizedModule);
    } else {
      console.warn(
        '[rakitin] Skipping "' + moduleName +
        '": no valid modular/simple structure detected.'
      );
    }
  } catch (error) {
    console.error(
      '[rakitin] Failed to load module "' + moduleName + '":', error.message
    );
  }
});

console.log('[rakitin] Auto-loaded ' + loadedCount + ' module(s).');
```

Failure isolation is built into the emission: a broken module logs a
skipping warning instead of crashing boot — this replaces the older strict
pre-validation that aborted whole integrations
(see [router-integration.md](./router-integration.md#6-failure-handling-philosophy)).

## 5. Require-chain sanity: `payment.controller` → `payment.service`

Because every filename derives from `toKebabCase(moduleName)`, chains stay
uniformly kebab-case end to end. For a module `payment`:

| Layout | File | Its own require |
| --- | --- | --- |
| simple | `modules/payment/payment.controller.js` | `const { getAll } = require("./payment.service");` |
| simple | `modules/payment/payment.router.js` | `const { getAll } = require("./payment.controller");` |
| modular | `modules/payment/controllers/payment.controller.js` | `const { getAll } = require("../services/payment.service");` |
| modular | `modules/payment/routes/payment.router.js` | `const { getAll } = require("../controllers/payment.controller");` |
| integration | `app/routes/index.js` (headless run) | `require('../modules/payment/routes/payment.router')` (modular) / `require('../modules/payment/payment.controller')` (simple) |

Divergence call-out: earlier endpoint-generation behavior could emit a
camelCase twin controller alongside the kebab-case original in simple
layouts. v2 removed that duplication — single canonical kebab-case pair
per resource ([migration §1.11](./migration-v1-to-v2.md)). Any leftover
twins from v1 projects should be deleted during your upgrade audit.

## 6. Marking and diff-checking output freshness

* Every generated header carries a short human-language banner
  (`// <module-name> Controller`, etc.) without embedding version strings —
  therefore treat tree shapes and identifier conventions above as the v2
  fingerprint when auditing old vs new generations.
* Services across ORMs share the `{ getAll, getById, create, update, remove }`
  contract; when you later adopt an ORM (tier upgrade), only service
  internals change, keeping controllers/routers/integration byte-stable —
  that stability is the intended upgrade path described in
  [integration-tiers.md](./integration-tiers.md#4-upgrade-paths-between-tiers).
