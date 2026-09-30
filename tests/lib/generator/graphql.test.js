/**
 * GraphQL generator tests - real disk execution in the per-suite temp cwd
 * (see tests/setup.js). The emitted `app/graphql/index.js` is additionally
 * executed against the real `graphql`/`graphql-http` packages (devDeps) with
 * the module layer generated for real, so the resolver wiring is proven
 * end-to-end instead of asserted as text.
 */
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");
const { generateGraphQL, GRAPHQL_PATHS } = require("../../../lib/generator/api/graphql");
const { modularArch } = require("../../../lib/generator/module/arch/modular.arch");
const { simpleArch } = require("../../../lib/generator/module/arch/simple.arch");
const safety = require("../../../lib/safety");

const repoNodeModules = path.resolve(__dirname, "..", "..", "..", "node_modules");

let runtimeAvailable = true;
try {
  require.resolve("graphql");
  require.resolve("graphql-http/lib/use/express");
} catch (_) {
  runtimeAvailable = false;
}
const itRuntime = runtimeAvailable ? test : test.skip;

function abs(rel) {
  return path.join(process.cwd(), rel);
}

function read(rel) {
  return fs.readFileSync(abs(rel), "utf8");
}

function sha(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/** Make repo devDependencies resolvable from the generated project. */
function linkRepoNodeModules() {
  const target = path.join(process.cwd(), "node_modules");
  if (!fs.existsSync(target)) fs.ensureSymlinkSync(repoNodeModules, target, "dir");
}

/** Purge every generated module from the require cache (temp dir is reused). */
function purgeGeneratedModules() {
  const root = `${process.cwd()}${path.sep}`;
  for (const key of Object.keys(require.cache)) {
    if (key.startsWith(root)) delete require.cache[key];
  }
}

/** Fresh require of a generated file. */
function freshRequire(filePath) {
  purgeGeneratedModules();
  return require(filePath);
}

describe("generateGraphQL (bootstrap)", () => {
  test("creates the four graphql artifacts with root-relative POSIX paths", async () => {
    const result = await generateGraphQL({ root: process.cwd() });

    expect(result.created.sort()).toEqual([
      "app/graphql/README.md",
      "app/graphql/index.js",
      "app/graphql/resolvers.js",
      "app/graphql/schema.graphql",
    ]);
    expect(result.skipped).toEqual([]);
    expect(result.data.module).toBeNull();
    expect(result.data.schemaPath).toBe("app/graphql/schema.graphql");
    expect(result.data.resolverPath).toBe("app/graphql/resolvers.js");
    expect(result.data.files).toHaveLength(4);

    for (const rel of result.created) {
      expect(rel.startsWith("app/graphql/")).toBe(true);
      expect(fs.existsSync(abs(rel))).toBe(true);
    }
  });

  test("index.js mounts the graphql-http express handler and exposes the hooks", async () => {
    await generateGraphQL({ root: process.cwd() });
    const code = read("app/graphql/index.js");

    expect(code).toContain('require("graphql-http/lib/use/express")');
    expect(code).toContain("createHandler({ schema, rootValue })");
    expect(code).toContain('function mountGraphQL(app, basePath = "/graphql")');
    expect(code).toContain("app.use(basePath, createHandler({ schema, rootValue }))");
    expect(code).toContain("const schema = buildSchema(");
    expect(code).toContain(
      "module.exports = { schema, rootValue, mountGraphQL, graphql }"
    );
    expect(code).not.toMatch(/console\./);
  });

  test("schema.graphql and resolvers.js carry the managed marker regions", async () => {
    await generateGraphQL({ root: process.cwd() });
    const schema = read("app/graphql/schema.graphql");
    const resolvers = read("app/graphql/resolvers.js");

    expect(schema).toContain(safety.GRAPHQL_BLOCK_START);
    expect(schema).toContain(safety.GRAPHQL_BLOCK_END);
    expect(schema).toContain("type Query {");
    expect(schema).toContain("type Mutation {");

    expect(resolvers).toContain("// rakitin:graphql:start");
    expect(resolvers).toContain("// rakitin:graphql:end");
    expect(resolvers).toContain("const callService = (fn, args) =>");
    expect(resolvers).toContain("module.exports = { rootValue, callService, toList }");
    expect(resolvers).not.toMatch(/console\./);
  });

  test("GRAPHQL_PATHS pins the generated layout", () => {
    expect(GRAPHQL_PATHS).toEqual({
      dir: "app/graphql",
      index: "app/graphql/index.js",
      schema: "app/graphql/schema.graphql",
      resolvers: "app/graphql/resolvers.js",
      readme: "app/graphql/README.md",
    });
  });
});

describe("generateGraphQL (idempotency)", () => {
  test("re-running is a pure no-op and never rewrites bytes", async () => {
    await generateGraphQL({ root: process.cwd() });
    const before = {
      schema: sha(read("app/graphql/schema.graphql")),
      resolvers: sha(read("app/graphql/resolvers.js")),
      index: sha(read("app/graphql/index.js")),
    };

    const second = await generateGraphQL({ root: process.cwd() });

    expect(second.created).toEqual([]);
    expect(second.skipped).toHaveLength(4);
    expect(sha(read("app/graphql/schema.graphql"))).toBe(before.schema);
    expect(sha(read("app/graphql/resolvers.js"))).toBe(before.resolvers);
    expect(sha(read("app/graphql/index.js"))).toBe(before.index);
    expect(fs.existsSync(abs("app/graphql/schema.graphql.bak"))).toBe(false);
  });

  test("an existing user schema without markers is left untouched when no module is asked for", async () => {
    fs.outputFileSync(
      abs("app/graphql/schema.graphql"),
      "type Query { hello: String }\n"
    );

    const result = await generateGraphQL({ root: process.cwd() });

    expect(read("app/graphql/schema.graphql")).toBe("type Query { hello: String }\n");
    expect(result.created).not.toContain("app/graphql/schema.graphql");
    expect(result.skipped).toContain("app/graphql/schema.graphql");
  });
});

describe("generateGraphQL (module wiring)", () => {
  test("appends a modular module's type, queries and mutations into both regions", async () => {
    await modularArch("product", "None");
    const result = await generateGraphQL({ module: "product", root: process.cwd() });

    expect(result.created.sort()).toEqual([
      "app/graphql/README.md",
      "app/graphql/index.js",
      "app/graphql/resolvers.js",
      "app/graphql/schema.graphql",
    ]);
    expect(result.data.module).toBe("product");

    const schema = read("app/graphql/schema.graphql");
    expect(schema).toContain("# rakitin:module:product");
    expect(schema).toContain("type Product {\n  id: ID!\n  name: String\n}");
    expect(schema).toContain("productList(page: Int, limit: Int): ProductList!");
    expect(schema).toContain("product(id: ID!): Product");
    expect(schema).toContain("createProduct(name: String): Product");
    expect(schema).toContain("updateProduct(id: ID!, name: String): Product");
    expect(schema).toContain("deleteProduct(id: ID!): Product");

    const resolvers = read("app/graphql/resolvers.js");
    expect(resolvers).toContain("// rakitin:module:product");
    expect(resolvers).toContain('require("../modules/product/services/product.service")');
    expect(resolvers).toContain(
      'callService(require("../modules/product/services/product.service").getAll, args)'
    );
    expect(resolvers).toContain("createProduct: (args) =>");
    expect(resolvers).toContain("deleteProduct: (args) =>");
  });

  test("module wiring after a bare bootstrap rewrites only the two region files", async () => {
    await generateGraphQL({ root: process.cwd() });
    await modularArch("product", "None");

    const result = await generateGraphQL({ module: "product", root: process.cwd() });

    expect(result.created.sort()).toEqual([
      "app/graphql/resolvers.js",
      "app/graphql/schema.graphql",
    ]);
    expect(result.skipped.sort()).toEqual([
      "app/graphql/README.md",
      "app/graphql/index.js",
    ]);
    // marker merge is a backup-before-overwrite edit
    expect(fs.existsSync(abs("app/graphql/schema.graphql.bak"))).toBe(true);
  });

  test("resolves the flat (simple architecture) service path", async () => {
    await simpleArch("order-item", "None");
    await generateGraphQL({ module: "order-item", root: process.cwd() });

    const resolvers = read("app/graphql/resolvers.js");
    expect(resolvers).toContain('require("../modules/order-item/order-item.service")');
    expect(read("app/graphql/schema.graphql")).toContain("type OrderItem {");
    expect(read("app/graphql/schema.graphql")).toContain(
      "createOrderItem(name: String): OrderItem"
    );
  });

  test("re-adding the same module writes nothing (per-module sentinel)", async () => {
    await modularArch("product", "None");
    await generateGraphQL({ module: "product", root: process.cwd() });
    const before = sha(read("app/graphql/schema.graphql"));
    const beforeResolvers = sha(read("app/graphql/resolvers.js"));

    const again = await generateGraphQL({ module: "product", root: process.cwd() });

    expect(again.created).toEqual([]);
    expect(again.skipped).toContain("app/graphql/schema.graphql");
    expect(again.skipped).toContain("app/graphql/resolvers.js");
    expect(sha(read("app/graphql/schema.graphql"))).toBe(before);
    expect(sha(read("app/graphql/resolvers.js"))).toBe(beforeResolvers);
  });

  test("adding a second module preserves the first block and user code outside markers", async () => {
    await modularArch("product", "None");
    await modularArch("invoice", "None");
    await generateGraphQL({ module: "product", root: process.cwd() });

    // user-owned code outside the managed region
    const userSdl = "\ntype Query { customField: String }\n";
    const schemaBefore = read("app/graphql/schema.graphql");
    fs.writeFileSync(
      abs("app/graphql/schema.graphql"),
      `${schemaBefore}${userSdl}`,
      "utf8"
    );

    await generateGraphQL({ module: "invoice", root: process.cwd() });
    const schema = read("app/graphql/schema.graphql");

    expect(schema).toContain("# rakitin:module:product");
    expect(schema).toContain("# rakitin:module:invoice");
    expect(schema).toContain("customField: String");
    // marker region stays last-managed: no duplicated region tokens
    expect(schema.split(safety.GRAPHQL_BLOCK_START)).toHaveLength(2);
  });

  test("throws an actionable error when the module does not exist", async () => {
    await generateGraphQL({ root: process.cwd() });
    const before = sha(read("app/graphql/schema.graphql"));

    await expect(
      generateGraphQL({ module: "nope", root: process.cwd() })
    ).rejects.toThrow('Modul "nope" tidak ditemukan. Buat dulu: rakitin add module nope');
    expect(sha(read("app/graphql/schema.graphql"))).toBe(before);
  });

  test("rejects unsafe module names before writing anything", async () => {
    await expect(
      generateGraphQL({ module: "../evil", root: process.cwd() })
    ).rejects.toThrow(/Nama module tidak valid/);
    expect(fs.existsSync(abs("app"))).toBe(false);
  });
});

describe("generateGraphQL (dry-run)", () => {
  test("plans writes without touching the disk", async () => {
    safety.beginPlan();
    try {
      const result = await generateGraphQL({ module: null, root: process.cwd() });

      expect(result.created).toHaveLength(4);
      expect(safety.getPlan().map((entry) => entry.op)).toEqual([
        "create",
        "create",
        "create",
        "create",
      ]);
      expect(fs.existsSync(abs("app/graphql/schema.graphql"))).toBe(false);
      expect(fs.existsSync(abs("app"))).toBe(false);
    } finally {
      safety.resetPlan();
    }
  });
});

describe("generateGraphQL (runtime)", () => {
  itRuntime("executes real queries/mutations through the generated schema", async () => {
    await modularArch("product", "None");
    await generateGraphQL({ module: "product", root: process.cwd() });
    linkRepoNodeModules();

    const gql = freshRequire(abs("app/graphql/index.js"));

    const list = await gql.graphql({
      source: "{ productList(page: 1, limit: 10) { items { id name } total } }",
    });
    expect(list.errors).toBeUndefined();
    expect(list.data.productList).toEqual({ items: [], total: 0 });

    const created = await gql.graphql({
      source: 'mutation { createProduct(name: "Kopi") { id name } }',
    });
    expect(created.errors).toBeUndefined();
    expect(created.data.createProduct.name).toBe("Kopi");

    const after = await gql.graphql({ source: "{ productList { items { id } total } }" });
    expect(after.data.productList.total).toBe(1);
    expect(after.data.productList.items[0].id).toBe(created.data.createProduct.id);

    const unknown = await gql.graphql({ source: "{ nope }" });
    expect(unknown.errors.length).toBeGreaterThan(0);
  });

  itRuntime("serves the HTTP endpoint through graphql-http + express", async () => {
    await generateGraphQL({ root: process.cwd() });
    linkRepoNodeModules();

    const express = require("express");
    const { mountGraphQL } = freshRequire(abs("app/graphql/index.js"));

    const app = express();
    app.use(express.json());
    mountGraphQL(app);

    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    try {
      const port = server.address().port;
      const response = await fetch(`http://127.0.0.1:${port}/graphql`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: "{ _health }" }),
      });
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.errors).toBeUndefined();
      expect(body.data).toEqual({ _health: "ok" });
    } finally {
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
