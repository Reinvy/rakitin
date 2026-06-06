const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const generateConfig = require('../../lib/generator/config/config');
const { integrateRouter } = require('../../lib/generator/router/router');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('inquirer');
jest.mock('../../lib/constants');
jest.mock('../../lib/utils');

const { sharedPath, basePath, modulesPath } = require('../../lib/constants');
const { ensureDir, toKebabCase } = require('../../lib/utils');

describe('Config Generator and Router Integration', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
    
    // Mock paths
    sharedPath.mockReturnValue(path.join(global.tempDir, 'app', 'shared'));
    basePath.mockReturnValue(path.join(global.tempDir, 'app'));
    modulesPath.mockReturnValue(path.join(global.tempDir, 'app', 'modules'));
    
    // Mock utility functions
    toKebabCase.mockImplementation(str => str.toLowerCase().replace(/\s+/g, '-'));
  });

  describe('generateConfig', () => {
    test('should prompt user for config type', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: true });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify inquirer.prompt was called with correct configuration
      expect(mockPrompt).toHaveBeenCalledTimes(2);
      expect(mockPrompt).toHaveBeenNthCalledWith(1, [
        {
          type: 'list',
          name: 'configType',
          message: 'Pilih jenis config yang ingin dibuat:',
          choices: [
            { name: 'Custom', value: 'custom' },
            { name: 'Aplikasi (app)', value: 'app' },
            { name: 'Database', value: 'database' },
            { name: 'JWT', value: 'jwt' },
            { name: 'CORS', value: 'cors' },
            { name: 'Logger', value: 'logger' },
            { name: 'Email/Mailer', value: 'mailer' },
            { name: 'Cloud Storage', value: 'cloud' },
            { name: 'Payment Gateway', value: 'payment' },
            { name: 'Redis Cache', value: 'redis' },
            { name: 'Socket.IO', value: 'socket' },
            { name: 'Environment', value: 'env' },
          ],
        },
      ]);
      expect(mockPrompt).toHaveBeenNthCalledWith(2, [
        {
          type: 'confirm',
          name: 'createEnvExample',
          message: 'Apakah Anda ingin membuat file .env.example?',
          default: true,
        },
      ]);
    });

    test('should create app config file', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify ensureDir was called
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'shared', 'config'));
      
      // Verify fs.writeFileSync was called with correct content
      const configPath = path.join(global.tempDir, 'app', 'shared', 'config', 'app.config.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('// Config: App')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('require("dotenv").config()')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('port: process.env.PORT || 3000')
      );
    });

    test('should create database config file', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ configType: 'database' })
        .mockResolvedValueOnce({ createEnvExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify fs.writeFileSync was called with correct content
      const configPath = path.join(global.tempDir, 'app', 'shared', 'config', 'database.config.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('// Config: Database')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('development: {')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('username: process.env.DB_USER')
      );
    });

    test('should create JWT config file', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ configType: 'jwt' })
        .mockResolvedValueOnce({ createEnvExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify fs.writeFileSync was called with correct content
      const configPath = path.join(global.tempDir, 'app', 'shared', 'config', 'jwt.config.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('// Config: JWT')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('secret: process.env.JWT_SECRET')
      );
    });

    test('should create custom config file', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ configType: 'custom' })
        .mockResolvedValueOnce({ customName: 'mailer' })
        .mockResolvedValueOnce({ createEnvExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify toKebabCase was called
      expect(toKebabCase).toHaveBeenCalledWith('mailer');
      
      // Verify fs.writeFileSync was called with correct content
      const configPath = path.join(global.tempDir, 'app', 'shared', 'config', 'mailer.config.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('// Config: mailer')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        configPath,
        expect.stringContaining('require("dotenv").config()')
      );
    });

    test('should create .env.example file when requested', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: true });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await generateConfig();
      
      // Verify fs.writeFileSync was called for .env.example
      const envExamplePath = path.join(global.tempDir, '.env.example');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        envExamplePath,
        expect.stringContaining('# APP CONFIG')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        envExamplePath,
        expect.stringContaining('PORT=3000')
      );
    });

    test('should append to existing .env.example file', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: true });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true for .env.example
      fs.existsSync.mockReturnValue(true);
      
      // Mock existing .env.example content
      const existingContent = '# Existing config\nEXISTING_VAR=value\n';
      fs.readFileSync.mockReturnValue(existingContent);
      
      // Call the function
      await generateConfig();
      
      // Verify fs.appendFileSync was called
      const envExamplePath = path.join(global.tempDir, '.env.example');
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        envExamplePath,
        expect.stringContaining('# APP CONFIG')
      );
    });

    test('should not overwrite existing config file', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ configType: 'app' })
        .mockResolvedValueOnce({ createEnvExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true for config file
      fs.existsSync.mockReturnValue(true);
      
      // Call the function
      await generateConfig();
      
      // Verify fs.writeFileSync was not called for config file
      const configPath = path.join(global.tempDir, 'app', 'shared', 'config', 'app.config.js');
      expect(fs.writeFileSync).not.toHaveBeenCalledWith(
        configPath,
        expect.any(String)
      );
    });
  });

  describe('integrateRouter', () => {
    test('should prompt user for integration type', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module', 'product-module']);
      
      // Call the function
      await integrateRouter();
      
      // Verify inquirer.prompt was called with correct configuration
      expect(mockPrompt).toHaveBeenCalledTimes(4);
      expect(mockPrompt).toHaveBeenNthCalledWith(1, [
        {
          type: 'list',
          name: 'integrationType',
          message: 'Pilih jenis integrasi router:',
          choices: [
            { name: 'Otomatis (deteksi semua modul)', value: 'automatic' },
            { name: 'Manual (pilih modul yang diinginkan)', value: 'manual' },
          ],
        },
      ]);
    });

    test('should automatically detect modules with automatic integration', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module', 'product-module']);
      
      // Mock fs.statSync to return isDirectory: true
      const originalStatSync = fs.statSync;
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify ensureDir was called
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'routes'));
      
      // Verify fs.writeFileSync was called with correct content
      const routerPath = path.join(global.tempDir, 'app', 'routes', 'index.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('const express = require(\'express\')')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('const userModuleRouter = require(\'../modules/user-module/user-module-router\')')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('router.use(\'/user-module\', userModuleRouter)')
      );
    });

    test('should manually select modules with manual integration', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'manual' })
        .mockResolvedValueOnce({ selectedModules: ['user-module'] })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module', 'product-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify fs.writeFileSync was called with correct content
      const routerPath = path.join(global.tempDir, 'app', 'routes', 'index.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('const userModuleRouter = require(\'../modules/user-module/user-module-router\')')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('router.use(\'/user-module\', userModuleRouter)')
      );
      
      // Verify product-module is not included
      expect(fs.writeFileSync).not.toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('productModuleRouter')
      );
    });

    test('should create simple architecture router', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'simple' })
        .mockResolvedValueOnce({ createAppExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify fs.writeFileSync was called with correct content
      const routerPath = path.join(global.tempDir, 'app', 'routes', 'index.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('const userController = require(\'../modules/user-module/user-module-controller\')')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('router.get(\'/user-module\', userController.getAll)')
      );
    });

    test('should create router in root location', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'root' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: false });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true and mock readdirSync
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify ensureDir was called for root routes
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'routes'));
      
      // Verify fs.writeFileSync was called with correct path
      const routerPath = path.join(global.tempDir, 'routes', 'index.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        routerPath,
        expect.any(String)
      );
    });

    test('should create app.js with example when requested', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: true });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true for modules but false for app.js
      fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      fs.readdirSync.mockReturnValue(['user-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify fs.writeFileSync was called for app.js
      const appPath = path.join(global.tempDir, 'app', 'app.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        appPath,
        expect.stringContaining('const express = require(\'express\')')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        appPath,
        expect.stringContaining('const routes = require(\'./routes\')')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        appPath,
        expect.stringContaining('app.use(\'/api\', routes)')
      );
    });

    test('should append to existing app.js when requested', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'automatic' })
        .mockResolvedValueOnce({ routerLocation: 'app' })
        .mockResolvedValueOnce({ architecture: 'modular' })
        .mockResolvedValueOnce({ createAppExample: true })
        .mockResolvedValueOnce({ overwriteApp: true });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true for both modules and app.js
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify fs.appendFileSync was called for app.js
      const appPath = path.join(global.tempDir, 'app', 'app.js');
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        appPath,
        expect.stringContaining('const routes = require(\'./routes\')')
      );
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        appPath,
        expect.stringContaining('app.use(\'/api\', routes)')
      );
    });

    test('should handle when no modules are found', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'automatic' });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return false for modules
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await integrateRouter();
      
      // Verify fs.writeFileSync was not called
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    test('should handle when no modules are selected', async () => {
      // Mock inquirer prompt
      const mockPrompt = jest.fn()
        .mockResolvedValueOnce({ integrationType: 'manual' })
        .mockResolvedValueOnce({ selectedModules: [] });
      inquirer.default.prompt = mockPrompt;
      
      // Mock fs.existsSync to return true for modules
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['user-module', 'product-module']);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockImplementation(() => ({ isDirectory: () => true }));
      
      // Call the function
      await integrateRouter();
      
      // Verify fs.writeFileSync was not called
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });
});