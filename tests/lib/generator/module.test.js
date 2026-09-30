/**
 * Module wiring engine tests (lib/generator/router/wiring.js) plus the
 * integration regression guards for the v3 mount contract:
 *
 *   const <id>Router = require('<relative>');
 *   router.use('/<kebab>', <id>Router);
 *
 * A simple-architecture module must NEVER be wired through
 * `controller.<verb>` handler references (that crashed the generated app at
 * boot), and a real-ORM modular module must never get the placeholder model.
 */

const fs = require("fs");
const path = require("path");
const { simpleArch } = require("../../../lib/generator/module/arch/simple.arch");
const { modularArch } = require("../../../lib/generator/module/arch/modular.arch");
const {
  routerFileFor,
  requirePathFor,
  routerIdFor,
  buildWiringEntries,
  buildMiddlewareEntries,
  renderRouteLines,
} = require("../../../lib/generator/router/wiring");
const { createMiddleware } = require("../../../lib/generator/middleware/middleware");
const { integrateCommand } = require("../../../lib/commands/integrate");

const root = () => process.cwd();
const abs = (rel) => path.join(global.tempDir, rel);
const read = (rel) => fs.readFileSync(abs(rel), "utf8");

function write(rel, content) {
  const file = abs(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

describe("wiring engine", () => {
  describe("path helpers", () => {
    test("routerFileFor resolves per architecture", () => {
      expect(routerFileFor(root(), "user", "modular")).toBe(
        path.join(global.tempDir, "app", "modules", "user", "routes", "user.router.js")
      );
      expect(routerFileFor(root(), "user", "simple")).toBe(
        path.join(global.tempDir, "app", "modules", "user", "user.router.js")
      );
    });

    test("requirePathFor is relative to app/routes/index.js", () => {
      expect(requirePathFor("order-item", "modular")).toBe(
        "../modules/order-item/routes/order-item.router.js"
      );
      expect(requirePathFor("order-item", "simple")).toBe(
        "../modules/order-item/order-item.router.js"
      );
    });

    test("routerIdFor produces a valid identifier", () => {
      expect(routerIdFor("order-item")).toBe("orderItemRouter");
      const { RESERVED_WORDS } = require("../../../lib/naming");
      for (const kebab of ["new", "class", "123abc"]) {
        expect(RESERVED_WORDS.has(routerIdFor(kebab))).toBe(false);
        expect(routerIdFor(kebab)).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
      }
    });
  });

  describe("buildWiringEntries", () => {
    test("includes modules whose router file exists (both architectures)", async () => {
      await simpleArch("blog", "None");
      await modularArch("order", "None");

      const { entries, skipped } = buildWiringEntries(
        [
          { dirName: "blog", name: "blog", architecture: "simple" },
          { dirName: "order", name: "order", architecture: "modular" },
        ],
        { root: root() }
      );

      expect(skipped).toEqual([]);
      expect(entries).toEqual([
        {
          kebab: "blog",
          architecture: "simple",
          id: "blogRouter",
          mountPath: "/blog",
          routerFile: abs("app/modules/blog/blog.router.js"),
          relRequireFromRoutes: "../modules/blog/blog.router.js",
        },
        {
          kebab: "order",
          architecture: "modular",
          id: "orderRouter",
          mountPath: "/order",
          routerFile: abs("app/modules/order/routes/order.router.js"),
          relRequireFromRoutes: "../modules/order/routes/order.router.js",
        },
      ]);
    });

    test("skips a module whose router file is missing instead of emitting a dangling require", () => {
      const { entries, skipped } = buildWiringEntries(
        [{ dirName: "ghost", name: "ghost", architecture: "modular" }],
        { root: root() }
      );

      expect(entries).toEqual([]);
      expect(skipped).toHaveLength(1);
      expect(skipped[0].name).toBe("ghost");
      expect(skipped[0].reason).toBe(
        "file router tidak ditemukan: app/modules/ghost/routes/ghost.router.js"
      );
    });

    test("skips a module whose architecture could not be detected", () => {
      const { entries, skipped } = buildWiringEntries(
        [{ dirName: "mixed", name: "mixed", architecture: null }],
        { root: root() }
      );

      expect(entries).toEqual([]);
      expect(skipped).toEqual([{ name: "mixed", reason: "arsitektur modul tidak dikenali" }]);
    });
  });

  describe("renderRouteLines", () => {
    test("emits require + router.use for every entry and never controller members", async () => {
      await simpleArch("blog", "None");
      await modularArch("order", "None");
      const { entries } = buildWiringEntries(
        [
          { name: "blog", architecture: "simple" },
          { name: "order", architecture: "modular" },
        ],
        { root: root() }
      );

      const lines = renderRouteLines(entries);

      expect(lines).toContain("const blogRouter = require('../modules/blog/blog.router.js');");
      expect(lines).toContain(
        "const orderRouter = require('../modules/order/routes/order.router.js');"
      );
      expect(lines).toContain("router.use('/blog', blogRouter);");
      expect(lines).toContain("router.use('/order', orderRouter);");
      expect(lines).not.toContain("controller.");
      expect(lines).not.toMatch(/router\.(get|post|put|delete|patch)\(/);
    });

    test("appends middleware ids to each mount", async () => {
      await simpleArch("blog", "None");
      const { entries } = buildWiringEntries([{ name: "blog", architecture: "simple" }], {
        root: root(),
      });

      const lines = renderRouteLines(entries, [
        { id: "authMiddleware", relRequireFromRoutes: "../shared/middlewares/auth.middleware.js" },
      ]);

      expect(lines).toContain(
        "const authMiddleware = require('../shared/middlewares/auth.middleware.js');"
      );
      expect(lines).toContain("router.use('/blog', blogRouter, authMiddleware);");
    });

    test("returns an empty body when there is nothing to wire", () => {
      expect(renderRouteLines([], [])).toBe("");
    });
  });

  describe("buildMiddlewareEntries", () => {
    test("includes only middleware files that exist on disk", async () => {
      await createMiddleware("auth", undefined, { root: root() });

      const { entries, skipped } = buildMiddlewareEntries(["auth", "irrelevant"], {
        root: root(),
      });

      expect(entries).toEqual([
        {
          id: "authMiddleware",
          name: "auth",
          relRequireFromRoutes: "../shared/middlewares/auth.middleware.js",
        },
      ]);
      expect(skipped).toEqual([
        {
          name: "irrelevant",
          reason: "middleware tidak ditemukan: app/shared/middlewares/irrelevant.middleware.js",
        },
      ]);
    });
  });
});

describe("integrateCommand regression guards", () => {
  test("wires a simple-architecture module by mount, never by controller reference (F-3)", async () => {
    await simpleArch("payment", "None");

    const result = await integrateCommand({ root: root() });

    expect(result.ok).toBe(true);
    expect(result.created).toContain("app/routes/index.js");

    const router = read("app/routes/index.js");
    expect(router).toContain("const paymentRouter = require('../modules/payment/payment.router.js');");
    expect(router).toContain("router.use('/payment', paymentRouter);");
    expect(router).not.toContain("controller.");
    expect(router).toContain("module.exports = router;");
  });

  test("regenerating only rewrites the marker region and keeps every byte around it", async () => {
    await modularArch("order", "None");
    write(
      "app/routes/index.js",
      `const express = require('express');
const router = express.Router();

// USER CODE ABOVE
/* rakitin:routes:start */
// stale
/* rakitin:routes:end */
// USER CODE BELOW
module.exports = router;
`
    );

    const first = await integrateCommand({ root: root() });
    expect(first.data.action).toBe("markers-regenerated");

    const regenerated = read("app/routes/index.js");
    expect(regenerated).toContain("// USER CODE ABOVE");
    expect(regenerated).toContain("// USER CODE BELOW");
    expect(regenerated).toContain(
      "const orderRouter = require('../modules/order/routes/order.router.js');"
    );
    expect(regenerated).not.toContain("// stale");

    // The user's pre-rakitin bytes are preserved in a unique backup.
    expect(fs.existsSync(abs("app/routes/index.js.bak"))).toBe(true);
    expect(read("app/routes/index.js.bak")).toContain("// stale");

    const before = regenerated.slice(
      0,
      regenerated.indexOf("/* rakitin:routes:start */")
    );
    const after = regenerated.slice(
      regenerated.indexOf("/* rakitin:routes:end */") + "/* rakitin:routes:end */".length
    );
    await integrateCommand({ root: root() });
    const second = read("app/routes/index.js");

    expect(second.slice(0, second.indexOf("/* rakitin:routes:start */"))).toBe(before);
    expect(
      second.slice(second.indexOf("/* rakitin:routes:end */") + "/* rakitin:routes:end */".length)
    ).toBe(after);
  });

  test("reports a module with a missing router file in skipped[] and stays ok (F-14)", () => {
    write("app/modules/broken/index.js", "// module dir without a router\n");

    return integrateCommand({ root: root() }).then((result) => {
      expect(result.ok).toBe(false); // nothing wireable -> explicit no-op envelope
      expect(result.message).toMatch(/Tidak ada modul valid/);
      expect(result.data.skippedModules).toHaveLength(1);
    });
  });
});
