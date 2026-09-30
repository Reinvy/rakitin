/**
 * API-family generator tests (`add endpoint`, `add validation`, `add docs`,
 * `add util`). Every generated artifact is compiled with `vm.Script` - the
 * generated files themselves are never `require()`d.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const { generateEndpoint } = require("../../../lib/generator/api/endpoint");
const {
  generateValidation,
  extractModuleFields,
} = require("../../../lib/generator/api/validation");
const {
  generateDocumentation,
  DOCS_KINDS,
} = require("../../../lib/generator/api/documentation");
const { dumpYaml } = require("../../../lib/generator/api/documentation/yaml");
const {
  createUtil,
  UTIL_KINDS,
  getDefaultUtilContent,
} = require("../../../lib/generator/util/util");
const safety = require("../../../lib/safety");

let yaml = null;
try {
  yaml = require("yaml");
} catch {
  yaml = null;
}
const testYaml = yaml ? test : test.skip;

/** Compile check: throws on syntax errors. */
function assertParses(source) {
  expect(() => new vm.Script(source)).not.toThrow();
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

/** Fresh, isolated project root for one test. */
function freshRoot(label) {
  return fs.mkdtempSync(path.join(global.tempDir, `${label}-`));
}

/** Write a module fixture exactly like the module generators emit them. */
function createModule(root, kebab, architecture = "modular") {
  const moduleDir = path.join(root, "app", "modules", kebab);
  if (architecture === "modular") {
    writeFile(
      path.join(moduleDir, "routes", `${kebab}.router.js`),
      `// ${kebab} Routes
const express = require("express");
const router = express.Router();
const controller = require("../controllers/${kebab}.controller");

router.get("/", controller.getAll);
router.get("/:id", controller.getById);
router.post("/", controller.create);
router.put("/:id", controller.update);
router.delete("/:id", controller.remove);

// rakitin:resources:start
// rakitin:resources:end

module.exports = router;
`
    );
    writeFile(
      path.join(moduleDir, "controllers", `${kebab}.controller.js`),
      "module.exports = {};\n"
    );
    return;
  }
  writeFile(
    path.join(moduleDir, `${kebab}.router.js`),
    `// ${kebab} Router
const express = require("express");
const router = express.Router();
const controller = require("./${kebab}.controller");

router.get("/", controller.getAll);

// rakitin:resources:start
// rakitin:resources:end

module.exports = router;
`
  );
  writeFile(path.join(moduleDir, `${kebab}.controller.js`), "module.exports = {};\n");
}

afterEach(() => {
  safety.resetPlan();
});

// ---------------------------------------------------------------------------
// endpoint
// ---------------------------------------------------------------------------

describe("generateEndpoint", () => {
  test("creates a resource router+controller, mounts it, and emits parseable JS", async () => {
    const root = freshRoot("endpoint");
    createModule(root, "shop");

    const result = await generateEndpoint("shop", {
      resource: "products",
      fields: "name:string,price:number:true",
      root,
    });

    expect(result.created.sort()).toEqual([
      "app/modules/shop/resources/products.controller.js",
      "app/modules/shop/resources/products.resource.js",
    ]);
    expect(result.skipped).toEqual([]);
    expect(result.data).toMatchObject({
      module: "shop",
      architecture: "modular",
      resource: "products",
      pagination: true,
      filtering: true,
    });
    expect(result.data.mount).toMatchObject({
      file: "app/modules/shop/routes/shop.router.js",
      updated: true,
    });

    const resourceRouter = read(
      path.join(root, "app/modules/shop/resources/products.resource.js")
    );
    const controller = read(
      path.join(root, "app/modules/shop/resources/products.controller.js")
    );
    assertParses(resourceRouter);
    assertParses(controller);

    // Mounting uses the file we just wrote (no dangling require) and keeps
    // the module's own verbs untouched.
    const moduleRouter = read(path.join(root, "app/modules/shop/routes/shop.router.js"));
    assertParses(moduleRouter);
    expect(moduleRouter).toContain('require("../resources/products.resource")');
    expect(moduleRouter).toContain('router.use("/products",');
    expect(moduleRouter).toContain("router.get(\"/\", controller.getAll)");
    expect(moduleRouter).toContain("// rakitin:resources:start");

    // ?search= is wired to the sanitized field list.
    expect(controller).toContain("req.query.search");
    expect(controller).toContain('const SEARCH_FIELDS = ["name", "price"]');
  });

  test("re-running is idempotent (nothing created, router bytes unchanged)", async () => {
    const root = freshRoot("endpoint-idempotent");
    createModule(root, "shop");
    const routerPath = path.join(root, "app/modules/shop/routes/shop.router.js");

    await generateEndpoint("shop", { resource: "products", fields: "name:string", root });
    const afterFirst = read(routerPath);

    const second = await generateEndpoint("shop", {
      resource: "products",
      fields: "name:string",
      root,
    });

    expect(second.created).toEqual([]);
    expect(second.skipped.sort()).toEqual([
      "app/modules/shop/resources/products.controller.js",
      "app/modules/shop/resources/products.resource.js",
    ]);
    expect(second.data.mount).toEqual({
      file: "app/modules/shop/routes/shop.router.js",
      updated: false,
      action: "unchanged",
    });
    expect(read(routerPath)).toBe(afterFirst);
  });

  test("a second resource is added without dropping the first", async () => {
    const root = freshRoot("endpoint-multi");
    createModule(root, "shop");

    await generateEndpoint("shop", { resource: "products", fields: "name:string", root });
    await generateEndpoint("shop", { resource: "orders", fields: "total:number", root });

    const moduleRouter = read(path.join(root, "app/modules/shop/routes/shop.router.js"));
    assertParses(moduleRouter);
    expect(moduleRouter).toContain('router.use("/products",');
    expect(moduleRouter).toContain('router.use("/orders",');
  });

  test("pagination/filtering flags change the emitted source", async () => {
    const root = freshRoot("endpoint-flags");
    createModule(root, "shop");

    await generateEndpoint("shop", { resource: "plain", fields: "name:string", root });
    await generateEndpoint("shop", {
      resource: "bare",
      fields: "name:string",
      pagination: false,
      filtering: false,
      root,
    });

    const plain = read(path.join(root, "app/modules/shop/resources/plain.controller.js"));
    const bare = read(path.join(root, "app/modules/shop/resources/bare.controller.js"));

    expect(plain).toContain("req.query.page");
    expect(plain).toContain("applyFilters(");
    expect(bare).not.toContain("req.query.page");
    expect(bare).not.toContain("applyFilters(");
    // search stays available in both modes
    expect(bare).toContain("req.query.search");
    assertParses(plain);
    assertParses(bare);
  });

  test("field names are sanitized into valid identifiers", async () => {
    const root = freshRoot("endpoint-sanitize");
    createModule(root, "shop");

    const result = await generateEndpoint("shop", {
      resource: "user-profile",
      fields: "first-name:string,2price:number",
      root,
    });

    const controller = read(
      path.join(root, "app/modules/shop/resources/user-profile.controller.js")
    );
    assertParses(controller);
    expect(controller).toContain("firstname: cast(");
    expect(controller).toContain("req.body.firstname");
    // a leading digit is not a valid identifier: bracket notation is used
    expect(controller).toContain('"2price": cast(');
    expect(controller).toContain('req.body["2price"]');
    expect(controller).toContain('item["2price"] = cast(');
    expect(result.data.fields).toEqual([
      { name: "firstname", type: "string", required: false },
      { name: "2price", type: "number", required: false },
    ]);
  });

  test("rejects bad field specs and missing modules with actionable errors", async () => {
    const root = freshRoot("endpoint-errors");
    createModule(root, "shop");

    await expect(
      generateEndpoint("shop", { resource: "products", fields: ":string", root })
    ).rejects.toThrow(/Nama field tidak valid/);
    await expect(
      generateEndpoint("shop", { resource: "products", fields: "name:text", root })
    ).rejects.toThrow(/Tipe field tidak dikenal: "text"/);
    await expect(
      generateEndpoint("shop", { resource: "products", fields: "", root })
    ).rejects.toThrow(/Field endpoint wajib diisi/);
    await expect(
      generateEndpoint("shop", { fields: "name:string", root })
    ).rejects.toThrow(/Nama resource wajib diisi/);
    await expect(
      generateEndpoint("ghost", { resource: "products", fields: "name:string", root })
    ).rejects.toThrow(/Modul "ghost" tidak ditemukan/);
  });

  test("dry-run plans the writes without touching disk", async () => {
    const root = freshRoot("endpoint-dry");
    createModule(root, "shop");
    const routerPath = path.join(root, "app/modules/shop/routes/shop.router.js");
    const before = read(routerPath);

    safety.beginPlan();
    const result = await generateEndpoint("shop", {
      resource: "products",
      fields: "name:string",
      root,
    });

    expect(result.created.length).toBe(2);
    expect(fs.existsSync(path.join(root, "app/modules/shop/resources"))).toBe(false);
    expect(read(routerPath)).toBe(before);
    const ops = safety.getPlan().map((entry) => entry.op);
    expect(ops).toContain("create");
    expect(ops).toContain("overwrite");
  });
});

// ---------------------------------------------------------------------------
// validation
// ---------------------------------------------------------------------------

describe("generateValidation", () => {
  test("declared types win over name heuristics", async () => {
    const root = freshRoot("validation-types");
    const result = await generateValidation("product", {
      fields: "id:uuid,name:string,age:number",
      root,
    });

    expect(result.created).toEqual(["app/shared/validators/product.validator.js"]);
    const source = read(path.join(root, "app/shared/validators/product.validator.js"));
    assertParses(source);
    expect(source).toContain("id: Joi.string().uuid().optional()");
    expect(source).not.toContain("id: Joi.number()");
    expect(source).toContain("age: Joi.number().optional()");
    expect(source).toContain("module.exports = {");
    expect(source).toContain("schemas");
  });

  test("unknown type and empty field list are hard errors", async () => {
    const root = freshRoot("validation-errors");
    await expect(
      generateValidation("product", { fields: "name:text", root })
    ).rejects.toThrow(/Tipe field tidak dikenal: "text"/);
    await expect(generateValidation("product", { fields: " , ", root })).rejects.toThrow(
      /Tidak ada field valid pada --fields/
    );
    await expect(generateValidation("product", { root })).rejects.toThrow(
      /Field validator wajib diisi/
    );
    await expect(generateValidation(undefined, { fromModule: "ghost", root })).rejects.toThrow(
      'Tidak bisa membaca field dari modul "ghost". Gunakan --fields <a:string,b:number>.'
    );
  });

  test("from-module reads Prisma scalar fields and skips relations", async () => {
    const root = freshRoot("validation-prisma");
    writeFile(
      path.join(root, "prisma", "schema", "order.prisma"),
      `model Order {
  id        Int      @id @default(autoincrement())
  code      String   @default(uuid())
  email     String
  total     Float
  active    Boolean
  createdAt DateTime @default(now())
  payload   Json?
  tags      String[]
  customer  Customer @relation(fields: [customerId], references: [id])

  @@map("orders")
}
`
    );

    const fields = extractModuleFields(root, "order");
    expect(fields).toEqual([
      { name: "id", type: "number", required: true },
      { name: "code", type: "uuid", required: true },
      { name: "email", type: "email", required: true },
      { name: "total", type: "number", required: true },
      { name: "active", type: "boolean", required: true },
      { name: "createdAt", type: "date", required: true },
      { name: "payload", type: "string", required: false },
    ]);

    const result = await generateValidation("order", { fromModule: "order", root });
    expect(result.created).toEqual(["app/shared/validators/order.validator.js"]);
    const source = read(path.join(root, "app/shared/validators/order.validator.js"));
    assertParses(source);
    expect(source).toContain("email: Joi.string().email().required()");
    expect(source).toContain("// Sumber field: from-module:order");
    expect(source).not.toContain("customer");
  });

  test("from-module reads a Mongoose schema and defaults the validator name", async () => {
    const root = freshRoot("validation-mongoose");
    writeFile(
      path.join(root, "app", "modules", "catalog", "models", "catalog.model.js"),
      `const mongoose = require("mongoose");
const { Schema } = mongoose;

const CatalogSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    stock: { type: Number, default: 0 },
    published: { type: Boolean, default: false },
    releasedAt: { type: Date },
    rows: [String],
    nested: { type: { deep: String } },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Catalog", CatalogSchema);
`
    );

    const fields = extractModuleFields(root, "catalog", "mongoose");
    // `rows` (array) and `nested` (subdocument) have no scalar validator type
    // and are deliberately skipped instead of mis-typed.
    expect(fields.map((field) => [field.name, field.type, field.required])).toEqual([
      ["title", "string", true],
      ["stock", "number", false],
      ["published", "boolean", false],
      ["releasedAt", "date", false],
    ]);

    const result = await generateValidation(undefined, { fromModule: "catalog", root });
    expect(result.created).toEqual(["app/shared/validators/catalog.validator.js"]);
    assertParses(read(path.join(root, "app/shared/validators/catalog.validator.js")));
  });

  test("common validators keep the auth-facing schema names", async () => {
    const root = freshRoot("validation-common");
    const result = await generateValidation("common", { root });
    expect(result.created).toEqual(["app/shared/validators/common.validator.js"]);

    const source = read(path.join(root, "app/shared/validators/common.validator.js"));
    assertParses(source);
    expect(source).toContain("registerSchema");
    expect(source).toContain("loginSchema");
    expect(source).toContain("commonSchemas");
  });
});

// ---------------------------------------------------------------------------
// documentation
// ---------------------------------------------------------------------------

describe("generateDocumentation", () => {
  test("unknown kind is rejected with the catalog", async () => {
    const root = freshRoot("docs-unknown");
    await expect(generateDocumentation("bogus", { root })).rejects.toThrow(
      'Jenis dokumentasi tidak dikenal: "bogus". Pilihan: openapi-json, openapi-yaml, swagger-ui, complete.'
    );
    expect(DOCS_KINDS).toEqual(["openapi-json", "openapi-yaml", "swagger-ui", "complete"]);
  });

  test("openapi-json documents modules and endpoint mounts", async () => {
    const root = freshRoot("docs-json");
    createModule(root, "shop");
    await generateEndpoint("shop", { resource: "products", fields: "name:string", root });

    const result = await generateDocumentation("openapi-json", {
      title: "Toko API",
      apiVersion: "2.1.0",
      root,
    });

    expect(result.created).toEqual(["app/docs/openapi.json"]);
    const spec = JSON.parse(read(path.join(root, "app/docs/openapi.json")));
    expect(spec.openapi).toBe("3.0.0");
    expect(spec.info).toEqual({
      title: "Toko API",
      version: "2.1.0",
      description: "API Documentation generated by rakitin",
    });
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(["/api/shop", "/api/shop/{id}", "/api/shop/products"])
    );
    expect(spec.paths["/api/shop"].get.responses["200"]).toBeDefined();
    expect(spec.paths["/api/shop"].post.responses["201"]).toBeDefined();
    expect(spec.paths["/api/shop/{id}"].delete).toBeDefined();
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
    expect(spec.security).toEqual([{ BearerAuth: [] }]);
    expect(result.data.modules).toEqual(["shop"]);
  });

  test("auth=false removes the security sections", async () => {
    const root = freshRoot("docs-noauth");
    createModule(root, "shop");

    await generateDocumentation("openapi-json", { auth: false, root });
    const spec = JSON.parse(read(path.join(root, "app/docs/openapi.json")));
    expect(spec.components.securitySchemes).toBeUndefined();
    expect(spec.security).toBeUndefined();
  });

  testYaml("openapi-yaml is valid YAML (round-trips through the yaml parser)", async () => {
    const root = freshRoot("docs-yaml");
    createModule(root, "shop");
    await generateEndpoint("shop", { resource: "products", fields: "name:string", root });

    const result = await generateDocumentation("openapi-yaml", {
      title: "Toko: API #1",
      root,
    });
    expect(result.created).toEqual(["app/docs/openapi.yaml"]);

    const parsed = yaml.parse(read(path.join(root, "app/docs/openapi.yaml")));
    expect(parsed.openapi).toBe("3.0.0");
    expect(parsed.info.title).toBe("Toko: API #1");
    expect(parsed.servers[0].url).toBe("http://localhost:3000");
    expect(parsed.paths["/api/shop/products/{id}"].put.parameters[0].name).toBe("id");
    expect(parsed.security).toEqual([{ BearerAuth: [] }]);
  });

  test("complete writes json + yaml + swagger-ui, and files are valid", async () => {
    const root = freshRoot("docs-complete");
    createModule(root, "shop");

    const result = await generateDocumentation("complete", { root });
    expect(result.created.sort()).toEqual([
      "app/docs/openapi.json",
      "app/docs/openapi.yaml",
      "app/docs/swagger-ui.js",
    ]);

    assertParses(read(path.join(root, "app/docs/swagger-ui.js")));
    const swaggerUi = read(path.join(root, "app/docs/swagger-ui.js"));
    expect(swaggerUi).toContain('require("swagger-ui-express")');
    expect(swaggerUi).toContain("mountSwagger");
    expect(swaggerUi).toContain("openapiSpec");
    JSON.parse(read(path.join(root, "app/docs/openapi.json")));
    expect(read(path.join(root, "app/docs/openapi.yaml"))).toMatch(/^openapi: 3\.0\.0$/m);
  });

  test("dumpYaml quotes values a parser would otherwise coerce", () => {
    const source = dumpYaml({
      numericString: "30",
      boolString: "true",
      colon: "a: b",
      hash: "a #b",
      spaced: " x ",
      empty: "",
      nil: null,
      list: [{ id: 1, name: "n" }],
      nested: { deep: { ok: true } },
    });
    expect(source).toContain('numericString: "30"');
    expect(source).toContain('boolString: "true"');
    expect(source).toContain('colon: "a: b"');
    expect(source).toContain('hash: "a #b"');
    expect(source).toContain('spaced: " x "');
    expect(source).toContain('empty: ""');
    expect(source).toContain("nil: null");
    expect(source).toContain("  - id: 1\n    name: n");
    assertParses(`module.exports = ${JSON.stringify(source)};`);
  });

  test("paths are skipped for modules without a router file", async () => {
    const root = freshRoot("docs-skipped");
    writeFile(path.join(root, "app", "modules", "orphan", "readme.md"), "no router\n");

    const result = await generateDocumentation("openapi-json", { root });
    expect(result.data.modules).toEqual([]);
    expect(result.data.skippedModules).toEqual(["orphan"]);
    const spec = JSON.parse(read(path.join(root, "app/docs/openapi.json")));
    expect(spec.paths).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// util
// ---------------------------------------------------------------------------

describe("createUtil", () => {
  test("UTIL_KINDS is the documented catalog", () => {
    expect(UTIL_KINDS).toEqual([
      "custom",
      "date",
      "string",
      "number",
      "array",
      "object",
      "file",
      "crypto",
      "uuid",
      "env",
      "url",
      "color",
      "math",
      "validation",
      "regex",
      "time",
    ]);
  });

  test("unknown kinds throw instead of stubbing a file", async () => {
    const root = freshRoot("util-unknown");
    await expect(createUtil("bogus", undefined, { root })).rejects.toThrow(
      `Jenis util tidak dikenal: "bogus". Pilihan: ${UTIL_KINDS.join(", ")}.`
    );
    expect(() => getDefaultUtilContent("bogus")).toThrow(/Jenis util tidak dikenal/);
    expect(fs.existsSync(path.join(root, "app", "shared", "utils"))).toBe(false);
  });

  test("every kind emits parseable, dependency-audited JS", async () => {
    const root = freshRoot("util-kinds");

    for (const kind of UTIL_KINDS) {
      const name = kind === "custom" ? "price-format" : undefined;
      const result = await createUtil(kind, name, { root });
      const expected = kind === "custom" ? "price-format" : kind;
      expect(result.created).toEqual([`app/shared/utils/${expected}.util.js`]);
      expect(result.data.kind).toBe(kind);

      const source = read(path.join(root, "app", "shared", "utils", `${expected}.util.js`));
      assertParses(source);

      const requires = [...source.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1]);
      const allowed = {
        uuid: ["uuid"],
        date: ["dayjs"],
        env: ["dotenv"],
        file: ["node:fs"],
        crypto: ["node:crypto"],
      };
      expect(requires.sort()).toEqual((allowed[kind] || []).sort());
    }
  });

  test("custom kind requires a safe name and uses it as an identifier", async () => {
    const root = freshRoot("util-custom");
    await expect(createUtil("custom", undefined, { root })).rejects.toThrow(
      /Nama util tidak boleh kosong/
    );
    await expect(createUtil("custom", "../evil", { root })).rejects.toThrow(
      /Nama util tidak valid/
    );

    await createUtil("custom", "price format", { root });
    const source = read(path.join(root, "app", "shared", "utils", "price-format.util.js"));
    assertParses(source);
    expect(source).toContain("function priceFormat(");
    expect(source).toContain("module.exports = { priceFormat };");
  });

  test("re-running reports the existing file as skipped", async () => {
    const root = freshRoot("util-idempotent");
    await createUtil("uuid", undefined, { root });
    const second = await createUtil("uuid", undefined, { root });
    expect(second.created).toEqual([]);
    expect(second.skipped).toEqual(["app/shared/utils/uuid.util.js"]);
  });

  test("defaults to process.cwd() when no root is given", async () => {
    const result = await createUtil("time", undefined, { root: global.tempDir });
    expect(result.created).toEqual(["app/shared/utils/time.util.js"]);
    expect(fs.existsSync(path.join(global.tempDir, "app/shared/utils/time.util.js"))).toBe(true);
  });
});
