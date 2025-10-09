const fs = require('fs-extra');
const path = require('path');
const { simpleArch } = require('../../lib/generator/module/arch/simple.arch');
const { modularArch } = require('../../lib/generator/module/arch/modular.arch');
const { prismaORM } = require('../../lib/generator/module/orm/prisma.orm');
const { sequelizeORM } = require('../../lib/generator/module/orm/sequelize.orm');
const generateConfig = require('../../lib/generator/config/config');
const { integrateRouter } = require('../../lib/generator/router/router');

// Mock dependencies
jest.mock('inquirer');
jest.mock('../../lib/constants');
jest.mock('../../lib/utils');
jest.mock('../../lib/generator/shared/orm-service-generator');
jest.mock('../../lib/installer');

const inquirer = require('inquirer');
const { modulesPath, sharedPath, basePath } = require('../../lib/constants');
const { ensureDir, writeFileIfNotExists, toKebabCase, toPascalCase, toSnakeCase } = require('../../lib/utils');
const { generateServiceCode } = require('../../lib/generator/shared/orm-service-generator');
const { installIfNeeded, installOrmPackages } = require('../../lib/installer');

describe('File Validation Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
    
    // Mock paths
    modulesPath.mockReturnValue(path.join(global.tempDir, 'app', 'modules'));
    sharedPath.mockReturnValue(path.join(global.tempDir, 'app', 'shared'));
    basePath.mockReturnValue(path.join(global.tempDir, 'app'));
    
    // Mock utility functions
    ensureDir.mockImplementation(dir => {
      // Simulate directory creation
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    writeFileIfNotExists.mockImplementation((filePath, content) => {
      // Simulate file writing
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, 'utf8');
      }
    });
    
    toKebabCase.mockImplementation(str => str.toLowerCase().replace(/\s+/g, '-'));
    toPascalCase.mockImplementation(str => str.replace(/\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).replace(/\s+/g, ''));
    toSnakeCase.mockImplementation(str => str.toLowerCase().replace(/\s+/g, '_'));
    
    // Mock generateServiceCode to return a simple service code
    generateServiceCode.mockReturnValue(`// Test Service Code
module.exports = {
  getAll: async () => { return []; },
  getById: async (id) => { return { id }; },
  create: async (data) => { return { id: 1, ...data }; },
  update: async (id, data) => { return { id, ...data }; },
  remove: async (id) => { return { id }; }
};`);
    
    // Mock inquirer
    inquirer.default.prompt = jest.fn();
    
    // Mock installer functions
    installIfNeeded.mockReturnValue({ success: true, installed: [], failed: [] });
    installOrmPackages.mockReturnValue({ success: true, installed: [], failed: [] });
  });

  afterEach(async () => {
    // Clean up temp directory after each test
    if (fs.existsSync(global.tempDir)) {
      await fs.remove(global.tempDir);
    }
  });

  describe('Simple Architecture File Validation', () => {
    test('should create valid controller file for simple architecture', async () => {
      const moduleName = 'User';
      const orm = 'Prisma';
      
      // Call the function
      await simpleArch(moduleName, orm);
      
      // Verify files were created
      const modulePath = path.join(global.tempDir, 'app', 'modules', 'user');
      const controllerPath = path.join(modulePath, 'user.controller.js');
      const servicePath = path.join(modulePath, 'user.service.js');
      const routerPath = path.join(modulePath, 'user.routes.js');
      
      expect(fs.existsSync(modulePath)).toBe(true);
      expect(fs.existsSync(controllerPath)).toBe(true);
      expect(fs.existsSync(servicePath)).toBe(true);
      expect(fs.existsSync(routerPath)).toBe(true);
      
      // Verify controller file content
      const controllerContent = fs.readFileSync(controllerPath, 'utf8');
      expect(controllerContent).toContain('// User Controller');
      expect(controllerContent).toContain('const { getAll } = require("./user.service");');
      expect(controllerContent).toContain('exports.getAll = async (req, res, next) => {');
      expect(controllerContent).toContain('res.status(StatusCodes.OK).json({');
      expect(controllerContent).toContain('message: "Berhasil mendapatkan data",');
      
      // Verify service file content
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      expect(serviceContent).toBe(generateServiceCode(moduleName, orm, 'Simple'));
      
      // Verify router file content
      const routerContent = fs.readFileSync(routerPath, 'utf8');
      expect(routerContent).toContain('// User Router');
      expect(routerContent).toContain('const express = require("express");');
      expect(routerContent).toContain('const { getAll } = require("./user.controller");');
      expect(routerContent).toContain('router.get("/", getAll);');
    });

    test('should create valid service file with ORM integration', async () => {
      const moduleName = 'Product';
      const orm = 'Sequelize';
      
      // Call the function
      await simpleArch(moduleName, orm);
      
      // Verify files were created
      const servicePath = path.join(global.tempDir, 'app', 'modules', 'product', 'product.service.js');
      
      expect(fs.existsSync(servicePath)).toBe(true);
      
      // Verify service file content
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      expect(serviceContent).toContain('// Product Service');
      expect(serviceContent).toContain('module.exports = {');
      expect(serviceContent).toContain('getAll,');
      expect(serviceContent).toContain('getById,');
      expect(serviceContent).toContain('create,');
      expect(serviceContent).toContain('update,');
      expect(serviceContent).toContain('remove');
    });
  });

  describe('Modular Architecture File Validation', () => {
    test('should create valid controller file for modular architecture', async () => {
      const moduleName = 'Customer';
      const orm = 'Mongoose';
      
      // Call the function
      await modularArch(moduleName, orm);
      
      // Verify directories were created
      const modulePath = path.join(global.tempDir, 'app', 'modules', 'customer');
      const controllersPath = path.join(modulePath, 'controllers');
      const servicesPath = path.join(modulePath, 'services');
      const modelsPath = path.join(modulePath, 'models');
      const routesPath = path.join(modulePath, 'routes');
      
      expect(fs.existsSync(modulePath)).toBe(true);
      expect(fs.existsSync(controllersPath)).toBe(true);
      expect(fs.existsSync(servicesPath)).toBe(true);
      expect(fs.existsSync(modelsPath)).toBe(true);
      expect(fs.existsSync(routesPath)).toBe(true);
      
      // Verify files were created
      const controllerPath = path.join(controllersPath, 'customer.controller.js');
      const servicePath = path.join(servicesPath, 'customer.service.js');
      const modelPath = path.join(modelsPath, 'customer.model.js');
      const routerPath = path.join(routesPath, 'customer.routes.js');
      
      expect(fs.existsSync(controllerPath)).toBe(true);
      expect(fs.existsSync(servicePath)).toBe(true);
      expect(fs.existsSync(modelPath)).toBe(true);
      expect(fs.existsSync(routerPath)).toBe(true);
      
      // Verify controller file content
      const controllerContent = fs.readFileSync(controllerPath, 'utf8');
      expect(controllerContent).toContain('// Customer Controller');
      expect(controllerContent).toContain('const { getAll } = require("../services/customer.service");');
      expect(controllerContent).toContain('exports.getAll = async (req, res, next) => {');
      expect(controllerContent).toContain('res.status(200).json({');
      
      // Verify service file content
      const serviceContent = fs.readFileSync(servicePath, 'utf8');
      expect(serviceContent).toBe(generateServiceCode(moduleName, orm, 'Modular'));
      
      // Verify model file content
      const modelContent = fs.readFileSync(modelPath, 'utf8');
      expect(modelContent).toContain('// Customer Model');
      expect(modelContent).toContain('// Schema atau ORM Model bisa ditulis di sini.');
      
      // Verify router file content
      const routerContent = fs.readFileSync(routerPath, 'utf8');
      expect(routerContent).toContain('// Customer Routes');
      expect(routerContent).toContain('const express = require("express");');
      expect(routerContent).toContain('const { getAll } = require("../controllers/customer.controller");');
    });
  });

  describe('Prisma ORM File Validation', () => {
    test('should create valid Prisma model file', async () => {
      const moduleName = 'Order';
      
      // Mock fs.existsSync to return false (Prisma not initialized)
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await prismaORM(moduleName);
      
      // Verify directory was created
      const prismaDir = path.join(global.tempDir, 'prisma', 'models');
      expect(fs.existsSync(prismaDir)).toBe(true);
      
      // Verify file was created
      const modelPath = path.join(prismaDir, 'order.prisma');
      expect(fs.existsSync(modelPath)).toBe(true);
      
      // Verify file content
      const modelContent = fs.readFileSync(modelPath, 'utf8');
      expect(modelContent).toContain('// Order model');
      expect(modelContent).toContain('model Order {');
      expect(modelContent).toContain('id        Int      @id @default(autoincrement())');
      expect(modelContent).toContain('name      String');
      expect(modelContent).toContain('createdAt DateTime @default(now())');
      expect(modelContent).toContain('updatedAt DateTime @updatedAt');
      expect(modelContent).toContain('@@map("orders")');
    });
  });

  describe('Sequelize ORM File Validation', () => {
    test('should create valid Sequelize model file for simple architecture', async () => {
      const moduleName = 'Category';
      const architecture = 'Simple';
      
      // Mock fs.existsSync to return false (Sequelize not installed)
      fs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      // Mock package.json content
      const packageJson = { name: 'test-app', dependencies: {} };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      // Call the function
      await sequelizeORM(moduleName, architecture);
      
      // Verify directory was created
      const modulePath = path.join(global.tempDir, 'app', 'modules', 'category');
      expect(fs.existsSync(modulePath)).toBe(true);
      
      // Verify file was created
      const modelPath = path.join(modulePath, 'category.model.js');
      expect(fs.existsSync(modelPath)).toBe(true);
      
      // Verify file content
      const modelContent = fs.readFileSync(modelPath, 'utf8');
      expect(modelContent).toContain('// Category Model (Sequelize)');
      expect(modelContent).toContain('const { DataTypes } = require(\'sequelize\');');
      expect(modelContent).toContain('const sequelize = require(\'../../../shared/database\');');
      expect(modelContent).toContain('const Category = sequelize.define(\'Category\', {');
      expect(modelContent).toContain('id: {');
      expect(modelContent).toContain('type: DataTypes.INTEGER,');
      expect(modelContent).toContain('primaryKey: true,');
      expect(modelContent).toContain('autoIncrement: true,');
      expect(modelContent).toContain('allowNull: false,');
      expect(modelContent).toContain('name: {');
      expect(modelContent).toContain('type: DataTypes.STRING,');
      expect(modelContent).toContain('allowNull: false,');
      expect(modelContent).toContain('tableName: \'categories\',');
      expect(modelContent).toContain('timestamps: true,');
      expect(modelContent).toContain('module.exports = Category;');
    });

    test('should create valid Sequelize model file for modular architecture', async () => {
      const moduleName = 'Supplier';
      const architecture = 'Modular';
      
      // Mock fs.existsSync to return false (Sequelize not installed)
      fs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      // Mock package.json content
      const packageJson = { name: 'test-app', dependencies: {} };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      // Call the function
      await sequelizeORM(moduleName, architecture);
      
      // Verify directories were created
      const modulePath = path.join(global.tempDir, 'app', 'modules', 'supplier');
      const modelsPath = path.join(modulePath, 'models');
      expect(fs.existsSync(modulePath)).toBe(true);
      expect(fs.existsSync(modelsPath)).toBe(true);
      
      // Verify file was created
      const modelPath = path.join(modelsPath, 'supplier.model.js');
      expect(fs.existsSync(modelPath)).toBe(true);
      
      // Verify file content
      const modelContent = fs.readFileSync(modelPath, 'utf8');
      expect(modelContent).toContain('// Supplier Model (Sequelize)');
      expect(modelContent).toContain('const { DataTypes } = require(\'sequelize\');');
      expect(modelContent).toContain('const sequelize = require(\'../../../../shared/database\');');
      expect(modelContent).toContain('const Supplier = sequelize.define(\'Supplier\', {');
      expect(modelContent).toContain('tableName: \'suppliers\',');
    });
  });

  describe('Config File Validation', () => {
    test('should create valid app config file', async () => {
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: false });
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify directory was created
      const configDir = path.join(global.tempDir, 'app', 'shared', 'config');
      expect(fs.existsSync(configDir)).toBe(true);
      
      // Verify file was created
      const configPath = path.join(configDir, 'app.config.js');
      expect(fs.existsSync(configPath)).toBe(true);
      
      // Verify file content
      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain('// Config: App');
      expect(configContent).toContain('require("dotenv").config();');
      expect(configContent).toContain('module.exports = {');
      expect(configContent).toContain('port: process.env.PORT || 3000,');
      expect(configContent).toContain('env: process.env.NODE_ENV || "development",');
      expect(configContent).toContain('name: process.env.APP_NAME || "Rakitin App",');
      expect(configContent).toContain('version: process.env.APP_VERSION || "1.0.0",');
      expect(configContent).toContain('apiPrefix: process.env.API_PREFIX || "/api",');
    });

    test('should create valid database config file', async () => {
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ configType: 'database' })
        .mockResolvedValueOnce({ createEnvExample: false });
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify file was created
      const configPath = path.join(global.tempDir, 'app', 'shared', 'config', 'database.config.js');
      expect(fs.existsSync(configPath)).toBe(true);
      
      // Verify file content
      const configContent = fs.readFileSync(configPath, 'utf8');
      expect(configContent).toContain('// Config: Database');
      expect(configContent).toContain('require("dotenv").config();');
      expect(configContent).toContain('module.exports = {');
      expect(configContent).toContain('development: {');
      expect(configContent).toContain('username: process.env.DB_USER,');
      expect(configContent).toContain('password: process.env.DB_PASSWORD,');
      expect(configContent).toContain('database: process.env.DB_NAME,');
      expect(configContent).toContain('host: process.env.DB_HOST,');
      expect(configContent).toContain('port: process.env.DB_PORT || 5432,');
      expect(configContent).toContain('dialect: process.env.DB_DIALECT || "postgres",');
      expect(configContent).toContain('logging: process.env.DB_LOGGING === "true" ? console.log : false,');
      expect(configContent).toContain('test: {');
      expect(configContent).toContain('production: {');
    });

    test('should create valid .env.example file with app config', async () => {
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: true });
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify file was created
      const envExamplePath = path.join(global.tempDir, '.env.example');
      expect(fs.existsSync(envExamplePath)).toBe(true);
      
      // Verify file content
      const envContent = fs.readFileSync(envExamplePath, 'utf8');
      expect(envContent).toContain('# APP CONFIG');
      expect(envContent).toContain('PORT=3000');
      expect(envContent).toContain('NODE_ENV=development');
      expect(envContent).toContain('APP_NAME=Rakitin App');
      expect(envContent).toContain('APP_VERSION=1.0.0');
      expect(envContent).toContain('API_PREFIX=/api');
    });
  });

  describe('Router Integration File Validation', () => {
    test('should create valid router file with modular architecture', async () => {
      // Create mock modules
      const userModulePath = path.join(global.tempDir, 'app', 'modules', 'user-module');
      const productModulePath = path.join(global.tempDir, 'app', 'modules', 'product-module');
      fs.mkdirSync(userModulePath, { recursive: true });
      fs.mkdirSync(productModulePath, { recursive: true });
      
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: false });
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module', 'product-module']);
      
      // Mock fs.statSync to return isDirectory: true
      const originalStatSync = fs.statSync;
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify directory was created
      const routesDir = path.join(global.tempDir, 'app', 'routes');
      expect(fs.existsSync(routesDir)).toBe(true);
      
      // Verify file was created
      const routerPath = path.join(routesDir, 'index.js');
      expect(fs.existsSync(routerPath)).toBe(true);
      
      // Verify file content
      const routerContent = fs.readFileSync(routerPath, 'utf8');
      expect(routerContent).toContain('const express = require(\'express\');');
      expect(routerContent).toContain('const router = express.Router();');
      expect(routerContent).toContain('const userModuleRouter = require(\'../modules/user-module/user-module-router\');');
      expect(routerContent).toContain('const productModuleRouter = require(\'../modules/product-module/product-module-router\');');
      expect(routerContent).toContain('router.use(\'/user-module\', userModuleRouter);');
      expect(routerContent).toContain('router.use(\'/product-module\', productModuleRouter);');
      expect(routerContent).toContain('module.exports = router;');
    });

    test('should create valid router file with simple architecture', async () => {
      // Create mock modules
      const userModulePath = path.join(global.tempDir, 'app', 'modules', 'user-module');
      fs.mkdirSync(userModulePath, { recursive: true });
      
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'simple' })
        .mockResolvedValueOnce({ createAppExample: false });
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify directory was created
      const routesDir = path.join(global.tempDir, 'app', 'routes');
      expect(fs.existsSync(routesDir)).toBe(true);
      
      // Verify file was created
      const routerPath = path.join(routesDir, 'index.js');
      expect(fs.existsSync(routerPath)).toBe(true);
      
      // Verify file content
      const routerContent = fs.readFileSync(routerPath, 'utf8');
      expect(routerContent).toContain('const express = require(\'express\');');
      expect(routerContent).toContain('const router = express.Router();');
      expect(routerContent).toContain('// Routes for user-module');
      expect(routerContent).toContain('const userController = require(\'../modules/user-module/user-module-controller\');');
      expect(routerContent).toContain('// user-module routes');
      expect(routerContent).toContain('router.get(\'/user-module\', userController.getAll);');
      expect(routerContent).toContain('router.get(\'/user-module/:id\', userController.getById);');
      expect(routerContent).toContain('router.post(\'/user-module\', userController.create);');
      expect(routerContent).toContain('router.put(\'/user-module/:id\', userController.update);');
      expect(routerContent).toContain('router.delete(\'/user-module/:id\', userController.delete);');
      expect(routerContent).toContain('module.exports = router;');
    });

    test('should create valid app.js file with router integration', async () => {
      // Create mock modules
      const userModulePath = path.join(global.tempDir, 'app', 'modules', 'user-module');
      fs.mkdirSync(userModulePath, { recursive: true });
      
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: true })
        .mockResolvedValueOnce({ overwriteApp: true });
      
      // Mock fs.existsSync to return true for modules but false for app.js
      fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      fs.readdirSync.mockReturnValue(['user-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify file was created
      const appPath = path.join(global.tempDir, 'app', 'app.js');
      expect(fs.existsSync(appPath)).toBe(true);
      
      // Verify file content
      const appContent = fs.readFileSync(appPath, 'utf8');
      expect(appContent).toContain('const express = require(\'express\');');
      expect(appContent).toContain('const app = express();');
      expect(appContent).toContain('// Middleware');
      expect(appContent).toContain('app.use(express.json());');
      expect(appContent).toContain('// Contoh penggunaan router');
      expect(appContent).toContain('const routes = require(\'./routes\');');
      expect(appContent).toContain('app.use(\'/api\', routes);');
      expect(appContent).toContain('module.exports = app;');
    });
  });
});