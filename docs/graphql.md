# GraphQL

`rakitin add graphql` writes a GraphQL-over-HTTP layer into your Express
project and can wire one existing module at a time. Generated with
`lib/generator/api/graphql/index.js` + `lib/templates/graphql/**`.

Dependencies: `graphql` + `graphql-http` (kind `graphql:core`).

---

## 1. Generate

```bash
rakitin add graphql                     # bootstrap only
rakitin add graphql --module user       # bootstrap + wire module "user"
```

`--module <name>` requires the module to exist, otherwise the command exits 1
with `Modul "<m>" tidak ditemukan. Buat dulu: rakitin add module <m>`.

The module's service is located modular-first
(`app/modules/<kebab>/services/<kebab>.service.js`) and then simple
(`app/modules/<kebab>/<kebab>.service.js`); the generated resolver requires
the real file, so an unresolved module is impossible.

---

## 2. Emitted files

| File | Contents |
| --- | --- |
| `app/graphql/index.js` | `buildSchema` from `schema.graphql`, `mountGraphQL(app, basePath = "/graphql")`, and a `graphql({source, variableValues})` execution helper |
| `app/graphql/schema.graphql` | root `Query`/`Mutation` + the managed `# rakitin:graphql:start` … `# rakitin:graphql:end` region |
| `app/graphql/resolvers.js` | `rootValue` map + the managed `// rakitin:graphql:start` … `// rakitin:graphql:end` region |
| `app/graphql/README.md` | protocol/usage notes |

Existing files are never clobbered: a fresh run reports them in `created[]`,
a re-run in `skipped[]`, and a `--module` run that changes the region writes
through `overwriteWithBackup` (`.bak`).

---

## 3. Mounting

```js
// app.js / server.js
const express = require("express");
const app = express();
const { mountGraphQL } = require("./app/graphql");

mountGraphQL(app);                    // POST/GET /graphql
// mountGraphQL(app, "/api/graphql"); // custom base path
```

`mountGraphQL` returns the app, so it composes:

```js
mountGraphQL(app).listen(3000);
```

The module exports:

| Export | Purpose |
| --- | --- |
| `schema` | the built `GraphQLSchema` |
| `rootValue` | the resolver map |
| `mountGraphQL(app, basePath = "/graphql")` | mounts `createHandler({ schema, rootValue })` from `graphql-http/lib/use/express` |
| `graphql({ schema?, source, rootValue?, variableValues? })` | executes a document against the generated schema — a convenience for scripts and tests |

```js
const { graphql } = require("./app/graphql");

const result = await graphql({ source: "{ _health userList { total items { id name } } }" });
// { data: { _health: "ok", userList: { total: 0, items: [] } } }
```

The root schema always exposes a health probe:

```graphql
type Query {
  _health: String      # -> "ok"
}

type Mutation {
  _noop: Boolean       # -> true
}
```

---

## 4. Per-module wiring

`rakitin add graphql --module <name>` appends a block into **both** managed
regions, keyed by a per-module sentinel so the operation is idempotent:

| Region | Sentinel |
| --- | --- |
| SDL | `# rakitin:module:<kebab>` |
| Resolvers | `// rakitin:module:<kebab>` |

For `--module user` the SDL gains:

```graphql
# rakitin:module:user
type User {
  id: ID!
  name: String
}

extend type Query {
  userList(page: Int, limit: Int): UserList!
  user(id: ID!): User
}

extend type Mutation {
  createUser(name: String): User
  updateUser(id: ID!, name: String): User
  deleteUser(id: ID!): User
}

type UserList {
  items: [User!]!
  total: Int!
}
```

and the resolvers gain:

```js
  // rakitin:module:user
  userList: (args) =>
    callService(require("../modules/user/services/user.service").getAll, args).then(toList),
  user: (args) =>
    callService(require("../modules/user/services/user.service").getById, args),
  createUser: (args) =>
    callService(require("../modules/user/services/user.service").create, args),
  updateUser: (args) =>
    callService(require("../modules/user/services/user.service").update, args),
  deleteUser: (args) =>
    callService(require("../modules/user/services/user.service").remove, args),
```

Re-running `--module user` detects the sentinel and reports the files in
`skipped[]` — the region is never duplicated. Adding a *different* module
appends its block after the existing ones, preserving them (the region inner
text is re-extracted and re-emitted verbatim).

---

## 5. The service contract

Two helpers bridge GraphQL field arguments to the module service, which
expects a web-style request object:

```js
const callService = (fn, args) => fn({ query: args, params: args, body: args });

const toList = (value) => {
  if (Array.isArray(value)) return { items: value, total: value.length };
  if (value && Array.isArray(value.items)) return value;
  if (value === null || value === undefined) return { items: [], total: 0 };
  return { items: [value], total: 1 };
};
```

So a generated module service works out of the box:

| Resolver | Service call | Expected return |
| --- | --- | --- |
| `<camel>List` | `getAll(req)` | `{ items, total }` or an array (normalized by `toList`) |
| `<camel>` | `getById(req)` | the item, or `null` |
| `create<Pascal>` | `create(req)` | the created item |
| `update<Pascal>` | `update(req)` | the updated item |
| `delete<Pascal>` | `remove(req)` | the removed item |

Because `args` is exposed as `query`, `params` and `body` simultaneously, an
in-memory service reads `args.id` from `req.params.id` and `args.name` from
`req.body.name` without any glue code.

Customize the schema by editing **outside** the markers; extend the
resolvers by adding keys outside the region (or write a real resolver layer
and pass it as `rootValue`).

---

## 6. Verification

```bash
# schema parses + resolvers execute
node -e 'const {graphql}=require("./app/graphql");graphql({source:"{_health}"}).then(r=>console.log(JSON.stringify(r)))'
# { "data": { "_health": "ok" } }

# module wiring is present
grep -c 'rakitin:module:user' app/graphql/schema.graphql app/graphql/resolvers.js
```

`rakitin doctor` adds a `dependency graphql:core` warning when
`app/graphql/` exists but `graphql`/`graphql-http` are missing from
`package.json`.

---

## 7. Notes & limits

- `app/graphql/**` is **not** mounted automatically: call `mountGraphQL(app)`
  in your bootstrap (the command's `nextSteps` reminds you).
- The generated `User`-style type is a minimal `{ id, name }` shape. It is a
  starting point, not a projection of your ORM schema — extend it outside the
  markers.
- `add module --template graphql` produces the same artifacts for the new
  module in one step (module + GraphQL wiring).
- The GraphQL layer has no dependency on the WebSocket layer; both can coexist.
