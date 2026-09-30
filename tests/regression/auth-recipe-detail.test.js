/**
 * Auth recipe detailed regression tests - real disk, vm.Script compilation.
 *
 * The auth recipe composes the JWT middleware, a `user` module and a Joi
 * validator on top of the selected ORM + architecture. Everything must land
 * inside the project root and parse as valid JavaScript.
 */
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");
const { recipeCommand } = require("../../lib/commands/recipe");

beforeEach(() => {
  fs.outputJsonSync(path.join(global.tempDir, "package.json"), {
    name: "auth-recipe-demo",
    dependencies: { express: "^4.0.0" },
  });
});

function authCtx(arch, orm) {
  return { root: global.tempDir, arch, orm, install: false };
}

function validateSyntaxInDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== "node_modules") validateSyntaxInDir(fullPath);
    } else if (item.endsWith(".js")) {
      const src = fs.readFileSync(fullPath, "utf8");
      expect(() => new vm.Script(src)).not.toThrow();
    }
  }
}

describe("auth recipe - detailed ORM & architecture support", () => {
  test("Prisma + Modular: complete model, controller, service, router, validator", async () => {
    const result = await recipeCommand("auth", authCtx("modular", "prisma"));
    expect(result.ok).toBe(true);
    expect(result.created.length).toBeGreaterThan(0);

    const mwPath = path.join(global.tempDir, "app/shared/middlewares/auth.middleware.js");
    expect(fs.existsSync(mwPath)).toBe(true);

    const valPath = path.join(global.tempDir, "app/shared/validators/user.validator.js");
    expect(fs.existsSync(valPath)).toBe(true);
    const valContent = fs.readFileSync(valPath, "utf8");
    for (const schema of [
      "registerSchema",
      "loginSchema",
      "updateProfileSchema",
      "changePasswordSchema",
    ]) {
      expect(valContent).toContain(schema);
    }

    const modelPath = path.join(global.tempDir, "prisma/schema/user.prisma");
    expect(fs.existsSync(modelPath)).toBe(true);
    const modelContent = fs.readFileSync(modelPath, "utf8");
    expect(modelContent).toContain("email");
    expect(modelContent).toContain("password");
    expect(modelContent).toContain("@unique");

    const ctrlPath = path.join(
      global.tempDir,
      "app/modules/user/controllers/user.controller.js"
    );
    const ctrlContent = fs.readFileSync(ctrlPath, "utf8");
    for (const handler of ["register", "login", "getProfile", "updateProfile", "changePassword"]) {
      expect(ctrlContent).toContain(`exports.${handler} =`);
    }

    const svcPath = path.join(global.tempDir, "app/modules/user/services/user.service.js");
    const svcContent = fs.readFileSync(svcPath, "utf8");
    expect(svcContent).toContain("bcrypt");
    expect(svcContent).toContain("jwt");
    expect(svcContent).toContain("sanitizeUser");

    const routerPath = path.join(global.tempDir, "app/modules/user/routes/user.router.js");
    const routerContent = fs.readFileSync(routerPath, "utf8");
    for (const endpoint of ["/register", "/login", "/profile", "/me", "/change-password"]) {
      expect(routerContent).toContain(endpoint);
    }
    expect(routerContent).toContain("authMiddleware");

    expect(fs.existsSync(path.join(global.tempDir, "app/shared/config/db.js"))).toBe(true);
    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });

  test("Sequelize + Simple: flat module with a DataTypes model", async () => {
    const result = await recipeCommand("auth", authCtx("simple", "sequelize"));
    expect(result.created.length).toBeGreaterThan(0);

    const ctrlPath = path.join(global.tempDir, "app/modules/user/user.controller.js");
    const svcPath = path.join(global.tempDir, "app/modules/user/user.service.js");
    const routerPath = path.join(global.tempDir, "app/modules/user/user.router.js");
    const modelPath = path.join(global.tempDir, "app/modules/user/user.model.js");

    for (const file of [ctrlPath, svcPath, routerPath, modelPath]) {
      expect(fs.existsSync(file)).toBe(true);
    }

    const modelContent = fs.readFileSync(modelPath, "utf8");
    expect(modelContent).toContain("email");
    expect(modelContent).toContain("password");
    expect(modelContent).toContain("DataTypes");

    const svcContent = fs.readFileSync(svcPath, "utf8");
    expect(svcContent).toContain("bcrypt");
    expect(svcContent).toContain("jwt");
    expect(svcContent).toContain("sanitizeUser");

    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });

  test("Mongoose + Modular: mongoose schema + userModel service calls", async () => {
    const result = await recipeCommand("auth", authCtx("modular", "mongoose"));
    expect(result.created.length).toBeGreaterThan(0);

    const modelPath = path.join(global.tempDir, "app/modules/user/models/user.model.js");
    expect(fs.existsSync(modelPath)).toBe(true);
    const modelContent = fs.readFileSync(modelPath, "utf8");
    expect(modelContent).toContain("mongoose.model");
    expect(modelContent).toContain("email");
    expect(modelContent).toContain("password");

    const svcPath = path.join(global.tempDir, "app/modules/user/services/user.service.js");
    expect(fs.readFileSync(svcPath, "utf8")).toContain("userModel.findOne");

    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });

  test("TypeORM + Modular: EntitySchema with password and email", async () => {
    const result = await recipeCommand("auth", authCtx("modular", "typeorm"));
    expect(result.created.length).toBeGreaterThan(0);

    const entityPath = path.join(global.tempDir, "app/modules/user/entities/user.entity.js");
    expect(fs.existsSync(entityPath)).toBe(true);
    const entityContent = fs.readFileSync(entityPath, "utf8");
    expect(entityContent).toContain("EntitySchema");
    expect(entityContent).toContain("email");
    expect(entityContent).toContain("password");

    expect(fs.existsSync(path.join(global.tempDir, "app/shared/config/data-source.js"))).toBe(
      true
    );

    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });

  test("None (In-memory) + Modular: self-contained auth service", async () => {
    const result = await recipeCommand("auth", authCtx("modular", "none"));
    expect(result.created.length).toBeGreaterThan(0);

    const svcPath = path.join(global.tempDir, "app/modules/user/services/user.service.js");
    const svcContent = fs.readFileSync(svcPath, "utf8");
    expect(svcContent).toContain("USERS_STORE");
    expect(svcContent).toContain("bcrypt");
    expect(svcContent).toContain("jwt");
    expect(svcContent).toContain("register");
    expect(svcContent).toContain("login");

    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });
});
