/**
 * Auth recipe detailed regression tests - real disk, vm.Script compilation.
 */
const fs = require("fs-extra");
const path = require("path");
const vm = require("vm");
const { recipeCommand } = require("../../lib/commands/recipe");
const installer = require("../../lib/installer");

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  fs.outputJsonSync(path.join(global.tempDir, "package.json"), {
    name: "auth-recipe-demo",
    dependencies: { express: "^4.0.0" },
  });
  // Block REAL shell installs in tests
  installer.internals.execCommand = jest.fn().mockResolvedValue({
    success: true,
    stdout: "",
    stderr: "",
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function validateSyntaxInDir(dir) {
  if (!fs.existsSync(dir)) return;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (item !== "node_modules") validateSyntaxInDir(fullPath);
    } else if (item.endsWith(".js")) {
      const src = fs.readFileSync(fullPath, "utf8");
      // Replace requires for vm.Script test
      const sanitized = src.replace(/require\([^)]*\)/g, "({})");
      expect(() => new vm.Script(sanitized)).not.toThrow();
    }
  }
}

describe("auth recipe - detailed ORM & architecture support", () => {
  test("Prisma + Modular: generates complete model, controller, service, router, validator", async () => {
    const result = await recipeCommand("auth", { arch: "modular", orm: "prisma" });
    expect(result.createdFiles.length).toBeGreaterThan(0);

    // Middleware
    const mwPath = path.join(global.tempDir, "app/shared/middlewares/auth.middleware.js");
    expect(fs.existsSync(mwPath)).toBe(true);

    // Validator
    const valPath = path.join(global.tempDir, "app/shared/validators/user.validator.js");
    expect(fs.existsSync(valPath)).toBe(true);
    const valContent = fs.readFileSync(valPath, "utf8");
    expect(valContent).toContain("registerSchema");
    expect(valContent).toContain("loginSchema");
    expect(valContent).toContain("updateProfileSchema");
    expect(valContent).toContain("changePasswordSchema");

    // Prisma model with email & password
    const modelPath = path.join(global.tempDir, "prisma/schema/user.prisma");
    expect(fs.existsSync(modelPath)).toBe(true);
    const modelContent = fs.readFileSync(modelPath, "utf8");
    expect(modelContent).toContain("email");
    expect(modelContent).toContain("password");
    expect(modelContent).toContain("@unique");

    // Modular controller
    const ctrlPath = path.join(global.tempDir, "app/modules/user/controllers/user.controller.js");
    expect(fs.existsSync(ctrlPath)).toBe(true);
    const ctrlContent = fs.readFileSync(ctrlPath, "utf8");
    expect(ctrlContent).toContain("exports.register =");
    expect(ctrlContent).toContain("exports.login =");
    expect(ctrlContent).toContain("exports.getProfile =");
    expect(ctrlContent).toContain("exports.updateProfile =");
    expect(ctrlContent).toContain("exports.changePassword =");

    // Modular service with bcrypt and jwt
    const svcPath = path.join(global.tempDir, "app/modules/user/services/user.service.js");
    expect(fs.existsSync(svcPath)).toBe(true);
    const svcContent = fs.readFileSync(svcPath, "utf8");
    expect(svcContent).toContain("bcrypt");
    expect(svcContent).toContain("jwt");
    expect(svcContent).toContain("register");
    expect(svcContent).toContain("login");
    expect(svcContent).toContain("getProfile");
    expect(svcContent).toContain("changePassword");
    expect(svcContent).toContain("sanitizeUser");

    // Modular router with protected endpoints
    const routerPath = path.join(global.tempDir, "app/modules/user/routes/user.router.js");
    expect(fs.existsSync(routerPath)).toBe(true);
    const routerContent = fs.readFileSync(routerPath, "utf8");
    expect(routerContent).toContain("/register");
    expect(routerContent).toContain("/login");
    expect(routerContent).toContain("/profile");
    expect(routerContent).toContain("/me");
    expect(routerContent).toContain("/change-password");
    expect(routerContent).toContain("authMiddleware");

    // Validate syntax of all files
    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });

  test("Sequelize + Simple: generates model with password & email in root module directory", async () => {
    const result = await recipeCommand("auth", { arch: "simple", orm: "sequelize" });
    expect(result.createdFiles.length).toBeGreaterThan(0);

    // Simple controller & service & router
    const ctrlPath = path.join(global.tempDir, "app/modules/user/user.controller.js");
    const svcPath = path.join(global.tempDir, "app/modules/user/user.service.js");
    const routerPath = path.join(global.tempDir, "app/modules/user/user.router.js");
    const modelPath = path.join(global.tempDir, "app/modules/user/user.model.js");

    expect(fs.existsSync(ctrlPath)).toBe(true);
    expect(fs.existsSync(svcPath)).toBe(true);
    expect(fs.existsSync(routerPath)).toBe(true);
    expect(fs.existsSync(modelPath)).toBe(true);

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

  test("Mongoose + Modular: generates mongoose model schema with password & email", async () => {
    const result = await recipeCommand("auth", { arch: "modular", orm: "mongoose" });
    expect(result.createdFiles.length).toBeGreaterThan(0);

    const modelPath = path.join(global.tempDir, "app/modules/user/models/user.model.js");
    expect(fs.existsSync(modelPath)).toBe(true);
    const modelContent = fs.readFileSync(modelPath, "utf8");
    expect(modelContent).toContain("email");
    expect(modelContent).toContain("password");
    expect(modelContent).toContain("mongoose.model");

    const svcPath = path.join(global.tempDir, "app/modules/user/services/user.service.js");
    const svcContent = fs.readFileSync(svcPath, "utf8");
    expect(svcContent).toContain("userModel.findOne");

    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });

  test("TypeORM + Modular: generates EntitySchema with password and email", async () => {
    const result = await recipeCommand("auth", { arch: "modular", orm: "typeorm" });
    expect(result.createdFiles.length).toBeGreaterThan(0);

    const entityPath = path.join(global.tempDir, "app/modules/user/entities/user.entity.js");
    expect(fs.existsSync(entityPath)).toBe(true);
    const entityContent = fs.readFileSync(entityPath, "utf8");
    expect(entityContent).toContain("EntitySchema");
    expect(entityContent).toContain("email");
    expect(entityContent).toContain("password");

    const dsPath = path.join(global.tempDir, "app/shared/config/data-source.js");
    expect(fs.existsSync(dsPath)).toBe(true);

    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });

  test("None (In-memory) + Modular: generates self-contained in-memory auth service", async () => {
    const result = await recipeCommand("auth", { arch: "modular", orm: "none" });
    expect(result.createdFiles.length).toBeGreaterThan(0);

    const svcPath = path.join(global.tempDir, "app/modules/user/services/user.service.js");
    expect(fs.existsSync(svcPath)).toBe(true);
    const svcContent = fs.readFileSync(svcPath, "utf8");
    expect(svcContent).toContain("USERS_STORE");
    expect(svcContent).toContain("bcrypt");
    expect(svcContent).toContain("jwt");
    expect(svcContent).toContain("register");
    expect(svcContent).toContain("login");

    validateSyntaxInDir(path.join(global.tempDir, "app"));
  });
});
