# Module Examples — real v3 output

Everything in this document is the **actual v3 output** of the module
generator (`lib/generator/module/arch/{simple,modular}.arch.js`,
`lib/generator/module/verbs.js`, `lib/generator/module/orm/none.orm.js` and
the templates under `lib/templates/module/`). File bodies are verbatim modulo
trivial leading/trailing whitespace normalized for readability.

Scope guard: examples use the module name **`user-profile`** (modular) and
**`payment`** (simple) with **ORM = None** — the zero-dependency baseline.
For the ORM-specific files see [integration-tiers.md](./integration-tiers.md)
and [architecture.md](./architecture.md#4-command--generator-layering).

---

## 1. Generating the sample

```bash
rakitin add module user-profile --arch modular --orm none --yes
rakitin add module payment      --arch simple  --orm none --yes
```

Naming recap (single source: `lib/naming.js`):

| Input | Directory / files | Identifiers | Store constant |
| --- | --- | --- | --- |
| `user-profile` | `app/modules/user-profile/…` | `userProfile…` | `USER_PROFILE_STORE` |
| `UserProfile` | `app/modules/user-profile/…` | `userProfile…` | `USER_PROFILE_STORE` |

Names are validated by `assertSafeName("module", …)`: path separators,
`..`/leading dots and control characters are rejected with
`Nama module tidak valid: …`, and everything accepted is normalized to
kebab-case.

---

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

The detector keys on exactly these paths (`routes/<kebab>.router.js` ⇒
modular, flat `<kebab>.controller.js` ⇒ simple).

### 2.1 `controllers/user-profile.controller.js`

Exports the **full verb set**, each delegating to the service:

```javascript
// user-profile Controller
const service = require("../services/user-profile.service");

exports.getAll = async (req, res, next) => {
  try {
    const data = await service.getAll(req);
    res.status(200).json({
      message: "Berhasil mendapatkan data",
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const data = await service.getById(req);
    res.status(200).json({
      message: "Berhasil mendapatkan detail data",
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const data = await service.create(req);
    res.status(201).json({
      message: "Berhasil membuat data",
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const data = await service.update(req);
    res.status(200).json({
      message: "Berhasil memperbarui data",
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const data = await service.remove(req);
    res.status(200).json({
      message: "Berhasil menghapus data",
      data,
    });
  } catch (err) {
    next(err);
  }
};
```

`create` answers `201`; every other verb answers `200`. The message strings
come from `VERB_MESSAGES` in `lib/generator/module/verbs.js`.

With `--template readonly` only `getAll` + `getById` are emitted, and the
router registers only those two verbs.

### 2.2 `services/user-profile.service.js` (ORM None)

The no-ORM branch generates an in-memory store whose CRUD surface matches
every ORM flavor (`getAll/getById/create/update/remove`), so you can swap in a
database later without touching the controller or router:

```javascript
// user-profile Service (No ORM - in-memory store)
// Replace the in-memory operations with real database calls when ready.

const USER_PROFILE_STORE = [];

async function getAll(req) {
  const { page = 1, limit = 10 } = req.query;
  const start = (Number(page) - 1) * Number(limit);
  const items = USER_PROFILE_STORE.slice(start, start + Number(limit));
  return { items, total: USER_PROFILE_STORE.length };
}

async function getById(req) {
  const { id } = req.params;
  return USER_PROFILE_STORE.find((item) => item.id === id) || null;
}

async function create(req) {
  const item = { id: Date.now().toString(), ...req.body };
  USER_PROFILE_STORE.push(item);
  return item;
}

async function update(req) {
  const { id } = req.params;
  const index = USER_PROFILE_STORE.findIndex((item) => item.id === id);
  if (index === -1) return null;
  USER_PROFILE_STORE[index] = { ...USER_PROFILE_STORE[index], ...req.body };
  return USER_PROFILE_STORE[index];
}

async function remove(req) {
  const { id } = req.params;
  const index = USER_PROFILE_STORE.findIndex((item) => item.id === id);
  if (index === -1) return null;
  return USER_PROFILE_STORE.splice(index, 1)[0];
}

module.exports = { getAll, getById, create, update, remove };
```

The store constant is `toConstantCase(kebab) + "_STORE"` — `user-profile` →
`USER_PROFILE_STORE` (an underscore between the words, not a collapsed
`USERPROFILE`). Pagination comes from query params with safe defaults
(`page=1`, `limit=10`); `getById/update/remove` return `null` instead of
throwing so the controller keeps control of status codes.

### 2.3 `models/user-profile.model.js`

Written **only** when `orm === "None"` (for a real ORM the ORM generator owns
this path, so the placeholder can never shadow the real model):

```javascript
// UserProfile Model
// Modul ini memakai in-memory store (ORM: None).
// Tulis schema/ORM model di sini setelah beralih ke database nyata.
```

### 2.4 `routes/user-profile.router.js`

Registers all five verbs plus the managed resource region that
`rakitin add endpoint` injects into:

```javascript
// user-profile Routes
const express = require("express");
const router = express.Router();
const controller = require("../controllers/user-profile.controller");

// rakitin:resources:start
// rakitin:resources:end

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
```

---

## 3. Simple tree (`--arch simple`)

```text
app/modules/payment/
├── payment.controller.js
├── payment.service.js
└── payment.router.js
```

(No `models/` directory for the simple layout; with a real ORM the model file
is flat: `payment.model.js` / `payment.entity.js`.)

### 3.1 `payment.controller.js`

Identical body to the modular controller except for the require path
(`./payment.service` instead of `../services/payment.service`). The same full
verb set is exported.

### 3.2 `payment.service.js`

Identical body to the modular service (`generateServiceCode(…, "Simple")`
shares the ORM case text); the store constant and exports are unchanged
because the None operation set has no architecture-relative import paths.

### 3.3 `payment.router.js`

```javascript
// payment Router
const express = require("express");
const router = express.Router();
const controller = require("./payment.controller");

// rakitin:resources:start
// rakitin:resources:end

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
```

Relative sibling require (`./…`) versus the modular `../controllers/…` chain —
keep both intact if you move files between layouts.

---

## 4. Main-router wiring

`rakitin integrate` (or `add module` with `autoIntegrateRouter`) produces the
**same shape for both architectures** — `lib/generator/router/wiring.js`
emits a require plus a `router.use` mount, never a controller-member handler
reference:

```javascript
const express = require('express');
const router = express.Router();
/* rakitin:routes:start */
// rakitin-managed region: safe to regenerate.
// Keep custom entries OUTSIDE these markers.
const userProfileRouter = require('../modules/user-profile/routes/user-profile.router.js');

router.use('/user-profile', userProfileRouter);
/* rakitin:routes:end */

module.exports = router;
```

With `--middleware auth` the mount gains the middleware:

```javascript
const authMiddleware = require('../shared/middlewares/auth.middleware');
const userProfileRouter = require('../modules/user-profile/routes/user-profile.router.js');

router.use('/user-profile', userProfileRouter, authMiddleware);
```

A module whose router file is missing is reported in `skipped[]` and left out
of the block — a dangling `require` cannot be generated. Adding a module only
diffs the wiring lines inside the markers; two consecutive runs on an
unchanged inventory produce byte-identical output.

---

## 5. Require-chain sanity

Because every filename derives from `toKebabCase(name)`, the chains stay
kebab-case end to end:

| Layout | File | Its own require |
| --- | --- | --- |
| simple | `modules/payment/payment.controller.js` | `require("./payment.service")` |
| simple | `modules/payment/payment.router.js` | `require("./payment.controller")` |
| modular | `modules/payment/controllers/payment.controller.js` | `require("../services/payment.service")` |
| modular | `modules/payment/routes/payment.router.js` | `require("../controllers/payment.controller")` |
| integration | `app/routes/index.js` | `require('../modules/payment/payment.router.js')` (simple) / `require('../modules/payment/routes/payment.router.js')` (modular) |

---

## 6. Resource endpoints

`rakitin add endpoint payment --resource items --fields title:string,price:number`
adds a second, narrower CRUD surface inside the module:

```text
app/modules/payment/resources/
├── items.resource.js
└── items.controller.js
```

and mounts it inside the router's managed region:

```javascript
// rakitin:resources:start
// rakitin-managed region: safe to regenerate.
// Keep custom entries OUTSIDE these markers.
const itemsResource = require("./resources/items.resource");
router.use("/items", itemsResource);
// rakitin:resources:end
```

Re-running the same command is idempotent: `created: []` and
`mount.action: "unchanged"`. Pagination/filtering are on by default
(`--no-pagination` / `--no-filtering` to drop them).

---

## 7. Test files

`rakitin add test --all` (or `add module … --with-tests`, or `recipe test`)
renders `tests/modules/<kebab>.test.js` from
`lib/templates/test/module.test.ejs`:

- structural assertions (module dir, controller, router) that only need
  `fs`/`path` and work for both layouts;
- an HTTP smoke block against `/api/<kebab>` that is skipped when
  `SKIP_HTTP_TESTS=1` (so CI can run without `express`/`supertest`).

```bash
SKIP_HTTP_TESTS=1 npx jest tests/modules/payment.test.js
```

---

## 8. Marking and diff-checking output freshness

- Every generated header carries a short human-language banner
  (`// <module-name> Controller`, …) without embedding version strings.
- Services across ORMs share the
  `{ getAll, getById, create, update, remove }` contract; adopting an ORM
  later changes only service internals, keeping controller/router/wiring
  byte-stable — that stability is the intended upgrade path
  ([integration-tiers.md](./integration-tiers.md#4-presets)).
- Generated JS is validated by compiling it (`new vm.Script` / `node --check`),
  never by executing it.
