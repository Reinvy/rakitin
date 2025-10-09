const fs = require('fs-extra');
const path = require('path');
const { ensureBaseStructure } = require('../../lib/utils');
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
const { modulesPath, sharedPath, basePath, prismaPath } = require('../../lib/constants');
const { ensureDir, writeFileIfNotExists, toKebabCase, toPascalCase, toSnakeCase } = require('../../lib/utils');
const { generateServiceCode } = require('../../lib/generator/shared/orm-service-generator');
const { installIfNeeded, installOrmPackages } = require('../../lib/installer');

describe('Directory Structure Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
    
    // Mock paths
    modulesPath.mockReturnValue(path.join(global.tempDir, 'app', 'modules'));
    sharedPath.mockReturnValue(path.join(global.tempDir, 'app', 'shared'));
    basePath.mockReturnValue(path.join(global.tempDir, 'app'));
    prismaPath.mockReturnValue(path.join(global.tempDir, 'prisma', 'models'));
    
    // Mock utility functions to actually create directories and files
    ensureDir.mockImplementation(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
    
    writeFileIfNotExists.mockImplementation((filePath, content) => {
      if (!fs.existsSync(filePath)) {
        // Ensure directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
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

  describe('Base Structure', () => {
    test('should create correct base directory structure', () => {
      // Call the function
      ensureBaseStructure();
      
      // Verify directories were created
      const appPath = path.join(global.tempDir, 'app');
      const modulesPath = path.join(appPath, 'modules');
      const sharedPath = path.join(appPath, 'shared');
      const middlewaresPath = path.join(sharedPath, 'middlewares');
      const configPath = path.join(sharedPath, 'config');
      const utilsPath = path.join(sharedPath, 'utils');
      const interfacesPath = path.join(sharedPath, 'interfaces');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(modulesPath)).toBe(true);
      expect(fs.existsSync(sharedPath)).toBe(true);
      expect(fs.existsSync(middlewaresPath)).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);
      expect(fs.existsSync(utilsPath)).toBe(true);
      expect(fs.existsSync(interfacesPath)).toBe(true);
      
      // Verify files were created
      const appJsPath = path.join(appPath, 'app.js');
      const serverJsPath = path.join(appPath, 'server.js');
      
      expect(fs.existsSync(appJsPath)).toBe(true);
      expect(fs.existsSync(serverJsPath)).toBe(true);
      
      // Verify file contents
      const appJsContent = fs.readFileSync(appJsPath, 'utf8');
      const serverJsContent = fs.readFileSync(serverJsPath, 'utf8');
      
      expect(appJsContent).toBe('// Express app init');
      expect(serverJsContent).toBe('// App entry point');
    });
  });

  describe('Simple Architecture Directory Structure', () => {
    test('should create correct simple architecture directory structure', async () => {
      const moduleName = 'User';
      const orm = 'Prisma';
      
      // Call the function
      await simpleArch(moduleName, orm);
      
      // Verify directories were created
      const appPath = path.join(global.tempDir, 'app');
      const modulesPath = path.join(appPath, 'modules');
      const userModulePath = path.join(modulesPath, 'user');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(modulesPath)).toBe(true);
      expect(fs.existsSync(userModulePath)).toBe(true);
      
      // Verify files were created
      const controllerPath = path.join(userModulePath, 'user.controller.js');
      const servicePath = path.join(userModulePath, 'user.service.js');
      const routerPath = path.join(userModulePath, 'user.routes.js');
      
      expect(fs.existsSync(controllerPath)).toBe(true);
      expect(fs.existsSync(servicePath)).toBe(true);
      expect(fs.existsSync(routerPath)).toBe(true);
      
      // Verify no additional directories were created
      const dirs = fs.readdirSync(userModulePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      expect(dirs).toEqual([]);
    });
  });

  describe('Modular Architecture Directory Structure', () => {
    test('should create correct modular architecture directory structure', async () => {
      const moduleName = 'Product';
      const orm = 'Sequelize';
      
      // Call the function
      await modularArch(moduleName, orm);
      
      // Verify directories were created
      const appPath = path.join(global.tempDir, 'app');
      const modulesPath = path.join(appPath, 'modules');
      const productModulePath = path.join(modulesPath, 'product');
      const controllersPath = path.join(productModulePath, 'controllers');
      const servicesPath = path.join(productModulePath, 'services');
      const modelsPath = path.join(productModulePath, 'models');
      const routesPath = path.join(productModulePath, 'routes');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(modulesPath)).toBe(true);
      expect(fs.existsSync(productModulePath)).toBe(true);
      expect(fs.existsSync(controllersPath)).toBe(true);
      expect(fs.existsSync(servicesPath)).toBe(true);
      expect(fs.existsSync(modelsPath)).toBe(true);
      expect(fs.existsSync(routesPath)).toBe(true);
      
      // Verify files were created
      const controllerPath = path.join(controllersPath, 'product.controller.js');
      const servicePath = path.join(servicesPath, 'product.service.js');
      const modelPath = path.join(modelsPath, 'product.model.js');
      const routerPath = path.join(routesPath, 'product.routes.js');
      
      expect(fs.existsSync(controllerPath)).toBe(true);
      expect(fs.existsSync(servicePath)).toBe(true);
      expect(fs.existsSync(modelPath)).toBe(true);
      expect(fs.existsSync(routerPath)).toBe(true);
    });
  });

  describe('Prisma ORM Directory Structure', () => {
    test('should create correct Prisma directory structure', async () => {
      const moduleName = 'Order';
      
      // Mock fs.existsSync to return false (Prisma not initialized)
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await prismaORM(moduleName);
      
      // Verify directories were created
      const prismaPath = path.join(global.tempDir, 'prisma');
      const modelsPath = path.join(prismaPath, 'models');
      
      expect(fs.existsSync(prismaPath)).toBe(true);
      expect(fs.existsSync(modelsPath)).toBe(true);
      
      // Verify files were created
      const modelPath = path.join(modelsPath, 'order.prisma');
      const schemaPath = path.join(prismaPath, 'schema.prisma');
      
      expect(fs.existsSync(modelPath)).toBe(true);
      expect(fs.existsSync(schemaPath)).toBe(true);
      
      // Verify package.json was updated
      const packageJsonPath = path.join(global.tempDir, 'package.json');
      expect(fs.existsSync(packageJsonPath)).toBe(true);
      
      const packageJsonContent = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      expect(packageJsonContent).toHaveProperty('prisma');
      expect(packageJsonContent.prisma).toHaveProperty('schema', './prisma/schema.prisma');
    });
  });

  describe('Sequelize ORM Directory Structure', () => {
    test('should create correct Sequelize directory structure for simple architecture', async () => {
      const moduleName = 'Customer';
      const architecture = 'Simple';
      
      // Mock fs.existsSync to return false (Sequelize not installed)
      fs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      // Mock package.json content
      const packageJson = { name: 'test-app', dependencies: {} };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      // Call the function
      await sequelizeORM(moduleName, architecture);
      
      // Verify directories were created
      const appPath = path.join(global.tempDir, 'app');
      const modulesPath = path.join(appPath, 'modules');
      const customerModulePath = path.join(modulesPath, 'customer');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(modulesPath)).toBe(true);
      expect(fs.existsSync(customerModulePath)).toBe(true);
      
      // Verify files were created
      const modelPath = path.join(customerModulePath, 'customer.model.js');
      
      expect(fs.existsSync(modelPath)).toBe(true);
      
      // Verify no additional directories were created
      const dirs = fs.readdirSync(customerModulePath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      expect(dirs).toEqual([]);
    });

    test('should create correct Sequelize directory structure for modular architecture', async () => {
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
      const appPath = path.join(global.tempDir, 'app');
      const modulesPath = path.join(appPath, 'modules');
      const supplierModulePath = path.join(modulesPath, 'supplier');
      const modelsPath = path.join(supplierModulePath, 'models');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(modulesPath)).toBe(true);
      expect(fs.existsSync(supplierModulePath)).toBe(true);
      expect(fs.existsSync(modelsPath)).toBe(true);
      
      // Verify files were created
      const modelPath = path.join(modelsPath, 'supplier.model.js');
      
      expect(fs.existsSync(modelPath)).toBe(true);
    });
  });

  describe('Config Directory Structure', () => {
    test('should create correct config directory structure', async () => {
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: false });
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify directories were created
      const appPath = path.join(global.tempDir, 'app');
      const sharedPath = path.join(appPath, 'shared');
      const configPath = path.join(sharedPath, 'config');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(sharedPath)).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);
      
      // Verify files were created
      const configFile = path.join(configPath, 'app.config.js');
      
      expect(fs.existsSync(configFile)).toBe(true);
    });
  });

  describe('Router Integration Directory Structure', () => {
    test('should create correct router directory structure with app location', async () => {
      // Create mock modules
      const userModulePath = path.join(global.tempDir, 'app', 'modules', 'user-module');
      fs.mkdirSync(userModulePath, { recursive: true });
      
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: false });
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify directories were created
      const appPath = path.join(global.tempDir, 'app');
      const routesPath = path.join(appPath, 'routes');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(routesPath)).toBe(true);
      
      // Verify files were created
      const routerFile = path.join(routesPath, 'index.js');
      
      expect(fs.existsSync(routerFile)).toBe(true);
    });

    test('should create correct router directory structure with root location', async () => {
      // Create mock modules
      const userModulePath = path.join(global.tempDir, 'app', 'modules', 'user-module');
      fs.mkdirSync(userModulePath, { recursive: true });
      
      // Mock inquirer prompt
      inquirer.default.prompt
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'root' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: false });
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify directories were created
      const routesPath = path.join(global.tempDir, 'routes');
      
      expect(fs.existsSync(routesPath)).toBe(true);
      
      // Verify files were created
      const routerFile = path.join(routesPath, 'index.js');
      
      expect(fs.existsSync(routerFile)).toBe(true);
    });

    test('should create correct app.js with router integration', async () => {
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
      
      // Verify directories were created
      const appPath = path.join(global.tempDir, 'app');
      const routesPath = path.join(appPath, 'routes');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(routesPath)).toBe(true);
      
      // Verify files were created
      const appFile = path.join(appPath, 'app.js');
      const routerFile = path.join(routesPath, 'index.js');
      
      expect(fs.existsSync(appFile)).toBe(true);
      expect(fs.existsSync(routerFile)).toBe(true);
    });
  });

  describe('Complete Project Structure', () => {
    test('should create complete project structure with all components', async () => {
      // Create base structure
      ensureBaseStructure();
      
      // Create modules with different architectures and ORMs
      await simpleArch('User', 'Prisma');
      await modularArch('Product', 'Sequelize');
      
      // Create configs
      inquirer.default.prompt
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: false });
      
      await generateConfig();
      
      // Create router integration
      inquirer.default.prompt
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: true })
        .mockResolvedValueOnce({ overwriteApp: true });
      
      // Mock fs.readdirSync to return modules
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user', 'product']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      await integrateRouter();
      
      // Verify complete structure
      const appPath = path.join(global.tempDir, 'app');
      const modulesPath = path.join(appPath, 'modules');
      const sharedPath = path.join(appPath, 'shared');
      const routesPath = path.join(appPath, 'routes');
      const configPath = path.join(sharedPath, 'config');
      const userModulePath = path.join(modulesPath, 'user');
      const productModulePath = path.join(modulesPath, 'product');
      const productControllersPath = path.join(productModulePath, 'controllers');
      const productServicesPath = path.join(productModulePath, 'services');
      const productModelsPath = path.join(productModulePath, 'models');
      const productRoutesPath = path.join(productModulePath, 'routes');
      
      expect(fs.existsSync(appPath)).toBe(true);
      expect(fs.existsSync(modulesPath)).toBe(true);
      expect(fs.existsSync(sharedPath)).toBe(true);
      expect(fs.existsSync(routesPath)).toBe(true);
      expect(fs.existsSync(configPath)).toBe(true);
      expect(fs.existsSync(userModulePath)).toBe(true);
      expect(fs.existsSync(productModulePath)).toBe(true);
      expect(fs.existsSync(productControllersPath)).toBe(true);
      expect(fs.existsSync(productServicesPath)).toBe(true);
      expect(fs.existsSync(productModelsPath)).toBe(true);
      expect(fs.existsSync(productRoutesPath)).toBe(true);
      
      // Verify files exist
      expect(fs.existsSync(path.join(appPath, 'app.js'))).toBe(true);
      expect(fs.existsSync(path.join(appPath, 'server.js'))).toBe(true);
      expect(fs.existsSync(path.join(routesPath, 'index.js'))).toBe(true);
      expect(fs.existsSync(path.join(configPath, 'app.config.js'))).toBe(true);
      expect(fs.existsSync(path.join(userModulePath, 'user.controller.js'))).toBe(true);
      expect(fs.existsSync(path.join(userModulePath, 'user.service.js'))).toBe(true);
      expect(fs.existsSync(path.join(userModulePath, 'user.routes.js'))).toBe(true);
      expect(fs.existsSync(path.join(productControllersPath, 'product.controller.js'))).toBe(true);
      expect(fs.existsSync(path.join(productServicesPath, 'product.service.js'))).toBe(true);
      expect(fs.existsSync(path.join(productModelsPath, 'product.model.js'))).toBe(true);
      expect(fs.existsSync(path.join(productRoutesPath, 'product.routes.js'))).toBe(true);
    });
  });
});