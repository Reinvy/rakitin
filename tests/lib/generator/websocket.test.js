/**
 * WebSocket generator tests - real disk execution in an isolated temp root.
 *
 * The emitted transport is loaded through a stubbed `ws` package written into
 * the case's own `node_modules/`, so the envelope/heartbeat behavior is
 * exercised for real without depending on the `ws` dependency being installed.
 */
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");
const { generateWebSocket, WS_PATHS } = require("../../../lib/generator/api/websocket");
const safety = require("../../../lib/safety");

let caseIndex = 0;

/** Fresh project root per test (module/require caches stay isolated). */
function newRoot() {
  const root = path.join(global.tempDir, `ws-case-${++caseIndex}`);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), '{"name":"t","version":"1.0.0"}\n');
  return root;
}

/**
 * Write a module service stub the generated handler can actually require.
 * Mirrors the real generated services: every operation takes an express-style
 * `req` (`req.query` / `req.params.id` / `req.body`).
 */
function writeModuleService(root, kebab, { architecture = "modular", value = { ok: true } } = {}) {
  const dir =
    architecture === "modular"
      ? path.join(root, "app", "modules", kebab, "services")
      : path.join(root, "app", "modules", kebab);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${kebab}.service.js`),
    `const payload = ${JSON.stringify(value)};\n` +
      "module.exports = {\n" +
      "  getAll: (req) => ({ payload, query: req.query }),\n" +
      "  getById: (req) => ({ id: req.params.id, payload }),\n" +
      "  create: (req) => ({ created: req.body }),\n" +
      "  update: (req) => ({ id: req.params.id, updated: req.body }),\n" +
      "  remove: (req) => ({ id: req.params.id, removed: true }),\n" +
      "};\n"
  );
}

/** Stub `ws` so the emitted CommonJS transport can be loaded. */
function installWsStub(root) {
  const dir = path.join(root, "node_modules", "ws");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "package.json"),
    '{"name":"ws","version":"0.0.0-stub","main":"index.js"}\n'
  );
  fs.writeFileSync(
    path.join(dir, "index.js"),
    "class WebSocketServer {\n" +
      "  constructor(options = {}) { this.options = options; this.clients = new Set(); this._listeners = {}; }\n" +
      "  on(event, fn) { (this._listeners[event] = this._listeners[event] || []).push(fn); return this; }\n" +
      "  emit(event, ...args) { (this._listeners[event] || []).forEach((fn) => fn(...args)); }\n" +
      "}\n" +
      "module.exports = { WebSocketServer };\n"
  );
}

function makeSocket() {
  return {
    readyState: 1,
    isAlive: false,
    sent: [],
    events: {},
    on(event, fn) {
      (this.events[event] = this.events[event] || []).push(fn);
      return this;
    },
    emit(event, ...args) {
      (this.events[event] || []).forEach((fn) => fn(...args));
    },
    send(payload) {
      this.sent.push(JSON.parse(payload));
    },
    ping() {
      this.pings = (this.pings || 0) + 1;
    },
    terminate() {
      this.readyState = 3;
      this.terminated = true;
    },
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

function parseCheck(filePath) {
  expect(() => new vm.Script(fs.readFileSync(filePath, "utf8"), { filename: filePath })).not.toThrow();
}

describe("generateWebSocket", () => {
  afterEach(() => {
    safety.resetPlan();
    jest.useRealTimers();
  });

  test("creates the transport, registry and README, then reports them as skipped", async () => {
    const root = newRoot();

    const first = await generateWebSocket({ root });
    expect(first.skipped).toEqual([]);
    expect(first.created.sort()).toEqual([
      "app/ws/README.md",
      "app/ws/handlers/index.js",
      "app/ws/index.js",
    ]);
    expect(first.data).toEqual({
      module: null,
      path: "/ws",
      files: expect.any(Array),
    });
    expect(first.data.files.slice().sort()).toEqual(first.created.slice().sort());

    expect(Object.values(WS_PATHS)).toEqual(
      expect.arrayContaining(["app/ws/index.js", "app/ws/handlers/index.js", "app/ws/README.md"])
    );

    for (const rel of first.created.filter((p) => p.endsWith(".js"))) {
      parseCheck(path.join(root, rel));
    }

    const readme = fs.readFileSync(path.join(root, "app/ws/README.md"), "utf8");
    expect(readme).toContain("/ws");
    expect(readme).toContain("connected");

    // The marker region exists exactly once and the registry exports its API.
    const registrySrc = fs.readFileSync(path.join(root, "app/ws/handlers/index.js"), "utf8");
    expect(registrySrc.split(safety.WS_BLOCK_START).length - 1).toBe(1);
    expect(registrySrc.split(safety.WS_BLOCK_END).length - 1).toBe(1);

    const second = await generateWebSocket({ root });
    expect(second.created).toEqual([]);
    expect(second.skipped.sort()).toEqual([
      "app/ws/README.md",
      "app/ws/handlers/index.js",
      "app/ws/index.js",
    ]);
  });

  test("wires a modular module handler that delegates to the service", async () => {
    const root = newRoot();
    writeModuleService(root, "chat", { value: [{ id: 1 }] });

    const result = await generateWebSocket({ root, module: "chat", path: "/socket" });
    expect(result.created).toContain("app/ws/handlers/chat.handler.js");
    expect(result.created).toContain("app/ws/handlers/index.js");
    expect(result.created).toContain("app/ws/index.js");
    expect(result.skipped).toEqual([]);
    expect(result.data.module).toBe("chat");
    expect(result.data.path).toBe("/socket");

    parseCheck(path.join(root, "app/ws/handlers/chat.handler.js"));

    const registry = require(path.join(root, "app/ws/handlers/index.js"));
    expect(Object.keys(registry)).toEqual(expect.arrayContaining(["handlers", "register", "dispatch"]));
    expect(Object.keys(registry.handlers)).toEqual(["chat"]);
    expect(registry.handlers.chat.event).toBe("chat");

    // The generated handler resolves its service import and passes a req shim.
    await expect(registry.handlers.chat.onMessage(null, { action: "list" })).resolves.toEqual({
      payload: [{ id: 1 }],
      query: { action: "list" },
    });
    await expect(
      registry.handlers.chat.onMessage(null, { action: "list", query: { page: 2 } })
    ).resolves.toEqual({ payload: [{ id: 1 }], query: { page: 2 } });
    await expect(registry.handlers.chat.onMessage(null, { action: "get", id: 7 })).resolves.toEqual({
      id: 7,
      payload: [{ id: 1 }],
    });
    await expect(
      registry.handlers.chat.onMessage(null, { action: "create", body: { text: "hi" } })
    ).resolves.toEqual({ created: { text: "hi" } });
    await expect(
      registry.handlers.chat.onMessage(null, { action: "delete", params: { id: 3 } })
    ).resolves.toEqual({ id: 3, removed: true });

    // Idempotent: a second run changes nothing and never duplicates the region.
    const again = await generateWebSocket({ root, module: "chat", path: "/socket" });
    expect(again.created).toEqual([]);
    expect(again.skipped).toHaveLength(4);
    const src = fs.readFileSync(path.join(root, "app/ws/handlers/index.js"), "utf8");
    expect(src.split('register("chat", chatHandler);').length - 1).toBe(1);
  });

  test("detects a simple-architecture service file", async () => {
    const root = newRoot();
    writeModuleService(root, "plain", { architecture: "simple", value: { flat: true } });

    await generateWebSocket({ root, module: "plain" });

    const registry = require(path.join(root, "app/ws/handlers/index.js"));
    await expect(registry.handlers.plain.onMessage(null, { action: "list" })).resolves.toEqual({
      payload: { flat: true },
      query: { action: "list" },
    });
  });

  test("reports the effective path of an already-emitted transport", async () => {
    const root = newRoot();
    await generateWebSocket({ root }); // emits DEFAULT_PATH = "/ws"

    const rerun = await generateWebSocket({ root, path: "/socket" });
    expect(rerun.created).toEqual([]);
    expect(rerun.data.path).toBe("/ws"); // what attachWebSocket actually uses
    expect(fs.readFileSync(path.join(root, "app/ws/index.js"), "utf8")).toContain(
      'const DEFAULT_PATH = "/ws";'
    );

    const fresh = newRoot();
    const first = await generateWebSocket({ root: fresh, path: "/socket" });
    expect(first.data.path).toBe("/socket");
    expect(fs.readFileSync(path.join(fresh, "app/ws/index.js"), "utf8")).toContain(
      'const DEFAULT_PATH = "/socket";'
    );
  });

  test("throws before writing anything when the module does not exist", async () => {
    const root = newRoot();

    await expect(generateWebSocket({ root, module: "nope" })).rejects.toThrow(
      'Modul "nope" tidak ditemukan. Buat dulu: rakitin add module nope'
    );
    expect(fs.existsSync(path.join(root, "app", "ws"))).toBe(false);
  });

  test("rejects unsafe module names without writing", async () => {
    const root = newRoot();

    await expect(generateWebSocket({ root, module: "../evil" })).rejects.toThrow(
      /Nama module tidak valid/
    );
    await expect(generateWebSocket({ root, module: "my name!" })).rejects.toThrow(
      /Nama module tidak valid/
    );
    expect(fs.existsSync(path.join(root, "app"))).toBe(false);
  });

  test("dry-run records the plan and writes nothing", async () => {
    const root = newRoot();
    safety.beginPlan();

    const result = await generateWebSocket({ root, module: null });
    expect(result.created).toHaveLength(3);
    expect(fs.existsSync(path.join(root, "app", "ws"))).toBe(false);

    const plan = safety.getPlan();
    expect(plan.map((entry) => entry.op)).toEqual(["create", "create", "create"]);
    expect(plan.map((entry) => entry.path)).toEqual(
      expect.arrayContaining([
        path.join(root, "app/ws/index.js"),
        path.join(root, "app/ws/handlers/index.js"),
        path.join(root, "app/ws/README.md"),
      ])
    );
  });

  test("emitted transport speaks the documented envelope (connected / ack / error)", async () => {
    const root = newRoot();
    installWsStub(root);
    await generateWebSocket({ root });
    writeModuleService(root, "chat", { value: [{ id: 1 }] });
    await generateWebSocket({ root, module: "chat" });

    const transport = require(path.join(root, "app/ws/index.js"));
    expect(typeof transport.attachWebSocket).toBe("function");
    expect(typeof transport.createWebSocketServer).toBe("function");
    expect(transport.DEFAULT_PATH).toBe("/ws");
    expect(transport.HEARTBEAT_INTERVAL_MS).toBe(30000);

    // `attachWebSocket` defaults to DEFAULT_PATH.
    const attached = transport.attachWebSocket({});
    expect(typeof attached.on).toBe("function");
    expect(attached.options).toEqual({ server: {}, path: "/ws" });
    attached.emit("close");

    const wss = transport.createWebSocketServer({ server: {}, path: "/socket" });
    expect(wss.options.path).toBe("/socket");

    const sock = makeSocket();
    wss.emit("connection", sock);
    expect(sock.sent).toEqual([{ event: "connected" }]);
    expect(sock.isAlive).toBe(true);

    sock.emit("message", JSON.stringify({ event: "unknown" }));
    await tick();
    expect(sock.sent[sock.sent.length - 1]).toEqual({
      event: "error",
      data: { message: "Event tidak dikenal: unknown" },
    });

    sock.emit("message", "bukan json");
    await tick();
    expect(sock.sent[sock.sent.length - 1]).toEqual({
      event: "error",
      data: { message: "Payload tidak valid. Gunakan { event, data }." },
    });

    sock.emit("message", JSON.stringify({ event: "chat", data: { action: "list" } }));
    await tick();
    expect(sock.sent[sock.sent.length - 1]).toEqual({
      event: "chat:ack",
      data: { payload: [{ id: 1 }], query: { action: "list" } },
    });

    wss.emit("close");
  });

  test("a throwing handler is reported as an error envelope, not a crash", async () => {
    const root = newRoot();
    installWsStub(root);
    await generateWebSocket({ root });

    const registry = require(path.join(root, "app/ws/handlers/index.js"));
    const transport = require(path.join(root, "app/ws/index.js"));
    registry.register("boom", {
      event: "boom",
      onMessage: async () => {
        throw new Error("boom gagal");
      },
    });

    const wss = transport.createWebSocketServer({ server: {} });
    const sock = makeSocket();
    wss.emit("connection", sock);
    sock.emit("message", JSON.stringify({ event: "boom" }));
    await tick();

    expect(sock.sent[sock.sent.length - 1]).toEqual({
      event: "error",
      data: { message: "boom gagal" },
    });
    wss.emit("close");
  });

  test("heartbeat pings live sockets and terminates dead ones", async () => {
    const root = newRoot();
    installWsStub(root);
    await generateWebSocket({ root });

    const transport = require(path.join(root, "app/ws/index.js"));
    jest.useFakeTimers();
    const wss = transport.createWebSocketServer({ server: {} });
    const sock = makeSocket();
    wss.emit("connection", sock);
    wss.clients.add(sock);

    jest.advanceTimersByTime(30000);
    expect(sock.pings).toBe(1);
    expect(sock.isAlive).toBe(false);
    expect(sock.terminated).toBeUndefined();

    jest.advanceTimersByTime(30000);
    expect(sock.terminated).toBe(true);
    expect(sock.readyState).toBe(3);

    wss.emit("close");
    jest.advanceTimersByTime(30000);
    expect(sock.pings).toBe(1); // interval cleared on close
  });
});
