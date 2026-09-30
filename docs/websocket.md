# WebSocket

`rakitin add websocket` writes a `ws`-based WebSocket layer into your
project and can wire one existing module at a time. Generated with
`lib/generator/api/websocket/index.js` + `lib/templates/websocket/**`.

Dependency: `ws` (kind `websocket:ws`).

---

## 1. Generate

```bash
rakitin add websocket                          # transport layer only
rakitin add websocket --module user            # + app/ws/handlers/user.handler.js
rakitin add websocket --module user --path /realtime
```

`--module <name>` requires the module to exist, otherwise the command exits 1
with `Modul "<kebab>" tidak ditemukan. Buat dulu: rakitin add module <kebab>`.
`--path` defaults to `/ws`; it is normalized to a leading slash with no
trailing slash.

---

## 2. Emitted files

| File | Contents |
| --- | --- |
| `app/ws/index.js` | `attachWebSocket(server, { path })`, `createWebSocketServer({ server, path })`, `DEFAULT_PATH`, `HEARTBEAT_INTERVAL_MS`, JSON send/parse helpers, 30 s heartbeat |
| `app/ws/handlers/index.js` | registry: `handlers`, `register(name, handler)`, `dispatch(ws, payload, ctx)`, plus the managed `// rakitin:ws:start` … `// rakitin:ws:end` region |
| `app/ws/README.md` | protocol documentation |
| `app/ws/handlers/<kebab>.handler.js` | (with `--module`) a handler that delegates to the module service |

Existing files are reported in `skipped[]`; the handler registry's marker
region is regenerated in place (`.bak`-backed) and never duplicated.

---

## 3. Attaching to your server

```js
// server.js
const http = require("http");
const app = require("./app");
const { attachWebSocket } = require("./app/ws");

const server = http.createServer(app);
attachWebSocket(server, { path: "/ws" });
server.listen(3000);
```

| Export | Signature |
| --- | --- |
| `attachWebSocket(server, { path? })` | attaches a `WebSocketServer` to an existing `http.Server`; returns the `WebSocketServer` |
| `createWebSocketServer({ server, path })` | the underlying factory (connection wiring + heartbeat) |
| `DEFAULT_PATH` | `"/ws"` (or the `--path` value baked at generation time) |
| `HEARTBEAT_INTERVAL_MS` | `30000` |

---

## 4. Protocol

Every client message is a JSON object:

```json
{ "event": "<name>", "data": <payload> }
```

Server replies:

| Reply | When |
| --- | --- |
| `{ "event": "connected" }` | immediately after the socket opens |
| `{ "event": "<name>:ack", "data": <result> }` | the handler returned (or resolved) a value |
| `{ "event": "error", "data": { "message": "…" } }` | unparseable payload, missing/empty `event`, unknown event, or a handler that threw |

Details:

- A payload that is not valid JSON, or has no non-empty string `event`, is
  answered with
  `{ "event": "error", "data": { "message": "Payload tidak valid. Gunakan { event, data }." } }`.
- An unregistered event is answered with
  `{ "event": "error", "data": { "message": "Event tidak dikenal: <event>" } }`.
- `dispatch` returns `true` when a handler handled the message and `false`
  otherwise, so a custom transport can branch on it.
- When a handler's `onMessage` resolves `undefined`, the ack echoes the
  original `payload.data` back.

### Heartbeat

Every 30 s the server pings each client. A client that did not answer the
previous ping (`ws.isAlive === false`) is terminated. The interval is
`unref()`-ed so it never keeps the process alive, and it is cleared when the
server closes.

---

## 5. Handlers

A handler is:

```js
module.exports = {
  event: "user",
  async onMessage(ws, data, ctx) {
    // ctx = { wss, send, event, ... }
    return <value>;   // sent as { event: "user:ack", data: <value> }
  },
};
```

Register it:

```js
const { register } = require("./app/ws/handlers");
register("user", require("./user.handler"));
```

`register(name, handler)` throws when the handler has no `onMessage`
function; the registry keys handlers by `handler.event || name`.

### Generated module handler

`--module user` writes `app/ws/handlers/user.handler.js`, which delegates to
the module service with a small action switch:

| `data.action` | Service call |
| --- | --- |
| `list` (default) | `service.getAll(data.query)` |
| `get` | `service.getById(data.id)` |
| `create` | `service.create(data.body ?? data)` |
| `update` | `service.update(data.id, data.body ?? data)` |
| `delete` | `service.remove(data.id)` |

```jsonc
{ "event": "user", "data": { "action": "create", "body": { "name": "ada" } } }
// -> { "event": "user:ack", "data": { "id": "…", "name": "ada" } }
```

The handler is registered inside the marker region of
`app/ws/handlers/index.js`:

```js
// rakitin:ws:start
// rakitin-managed region: safe to regenerate.
// Keep custom entries OUTSIDE these markers.
const userHandler = require("./user.handler");
register("user", userHandler);
// rakitin:ws:end
```

Registration is idempotent: `readRegisteredEvents()` scans the region, so
re-running `--module user` does not duplicate the entry, and adding a second
module appends after the first. Handlers that already exist on disk are left
alone (`skipped[]`).

---

## 6. Verification

```bash
node -e '
const http = require("http");
const WebSocket = require("ws");
const { attachWebSocket } = require("./app/ws");
const server = http.createServer();
attachWebSocket(server, { path: "/ws" });
server.listen(0, () => {
  const ws = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws`);
  ws.on("message", (raw) => console.log(raw.toString()));
  ws.on("open", () => ws.send(JSON.stringify({ event: "user", data: { action: "list" } })));
});
'
# {"event":"connected"}
# {"event":"user:ack","data":{"items":[],"total":0}}
```

`rakitin doctor` adds a `dependency websocket:ws` warning when `app/ws/`
exists but `ws` is missing from `package.json`.

---

## 7. Notes & limits

- The WebSocket layer is **not** attached automatically: call
  `attachWebSocket(server)` in your bootstrap (the command's `nextSteps`
  reminds you).
- The transport speaks JSON only; there is no per-event schema validation —
  validate inside your handler and throw to produce the `error` envelope.
- The generated handler assumes the standard module service surface
  (`getAll/getById/create/update/remove`). Replace it outside the markers if
  your service differs.
- `add module --template realtime` produces the same artifacts for a new
  module in one step (module + WebSocket handler).
