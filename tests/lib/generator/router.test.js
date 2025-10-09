const fs = require('fs-extra');
const path = require('path');
const { integrateRouter } = require('../../../lib/generator/router/router');
const PathResolver = require('../../../lib/generator/shared/path-resolver');
const FileValidator = require('../../../lib/generator/shared/file-validator');
const ErrorHandler = require('../../../lib/generator/shared/error-handler');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../../../lib/generator/shared/path-resolver');
jest.mock('../../../lib/generator/shared/file-validator');
jest.mock('../../../lib/generator/shared/error-handler');

describe('Router Generator', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
  });

  describe('integrateRouter', () => {
    test('should be a function', () => {
      expect(typeof integrateRouter).toBe('function');
    });

    test('should accept required parameters', () => {
      const options = {
        modules: ['userModule', 'productModule'],
        basePath: '/test/path',
        architecture: 'modular',
        orm: 'mongoose'
      };

      // Mock PathResolver methods
      PathResolver.getModularRouterPath.mockReturnValue('/test/path/modules/user-module/routes/user-module.router.js');
      PathResolver.getSimpleControllerPath.mockReturnValue('/test/path/modules/user-module/user-module.controller.js');
      PathResolver.getModulePath.mockReturnValue('/test/path/modules/user-module');

      // Mock FileValidator methods
      FileValidator.validateModuleDirectory.mockReturnValue({
        isValid: true,
        path: '/test/path/modules/user-module'
      });
      FileValidator.validateModularRouterFile.mockReturnValue({
        isValid: true,
        path: '/test/path/modules/user-module/routes/user-module.router.js'
      });
      FileValidator.validateSimpleControllerFile.mockReturnValue({
        isValid: true,
        path: '/test/path/modules/user-module/user-module.controller.js'
      });
      FileValidator.validateRouterIntegration.mockReturnValue({
        isValid: true,
        errors: []
      });

      // Mock fs.existsSync
      fs.existsSync.mockReturnValue(true);

      // Mock fs.readFileSync
      fs.readFileSync.mockReturnValue(`
        const express = require('express');
        const router = express.Router();
        
        module.exports = router;
      `);

      // Mock fs.writeFileSync
      fs.writeFileSync.mockReturnValue(true);

      // Test that integrateRouter can be called without throwing an error
      expect(() => {
        integrateRouter(options);
      }).not.toThrow();
    });

    test('should handle modular architecture', () => {
      const options = {
        modules: ['userModule', 'productModule'],
        basePath: '/test/path',
        architecture: 'modular',
        orm: 'mongoose'
      };

      // Mock PathResolver methods
      PathResolver.getModularRouterPath.mockReturnValue('/test/path/modules/user-module/routes/user-module.router.js');
      PathResolver.getModulePath.mockReturnValue('/test/path/modules/user-module');

      // Mock FileValidator methods
      FileValidator.validateModuleDirectory.mockReturnValue({
        isValid: true,
        path: '/test/path/modules/user-module'
      });
      FileValidator.validateModularRouterFile.mockReturnValue({
        isValid: true,
        path: '/test/path/modules/user-module/routes/user-module.router.js'
      });
      FileValidator.validateRouterIntegration.mockReturnValue({
        isValid: true,
        errors: []
      });

      // Mock fs.existsSync
      fs.existsSync.mockReturnValue(true);

      // Mock fs.readFileSync
      fs.readFileSync.mockReturnValue(`
        const express = require('express');
        const router = express.Router();
        
        module.exports = router;
      `);

      // Mock fs.writeFileSync
      fs.writeFileSync.mockReturnValue(true);

      // Test that integrateRouter can be called with modular architecture
      expect(() => {
        integrateRouter(options);
      }).not.toThrow();
    });

    test('should handle simple architecture', () => {
      const options = {
        modules: ['userModule', 'productModule'],
        basePath: '/test/path',
        architecture: 'simple',
        orm: 'mongoose'
      };

      // Mock PathResolver methods
      PathResolver.getSimpleControllerPath.mockReturnValue('/test/path/modules/user-module/user-module.controller.js');
      PathResolver.getModulePath.mockReturnValue('/test/path/modules/user-module');

      // Mock FileValidator methods
      FileValidator.validateModuleDirectory.mockReturnValue({
        isValid: true,
        path: '/test/path/modules/user-module'
      });
      FileValidator.validateSimpleControllerFile.mockReturnValue({
        isValid: true,
        path: '/test/path/modules/user-module/user-module.controller.js'
      });
      FileValidator.validateRouterIntegration.mockReturnValue({
        isValid: true,
        errors: []
      });

      // Mock fs.existsSync
      fs.existsSync.mockReturnValue(true);

      // Mock fs.readFileSync
      fs.readFileSync.mockReturnValue(`
        const express = require('express');
        const router = express.Router();
        
        module.exports = router;
      `);

      // Mock fs.writeFileSync
      fs.writeFileSync.mockReturnValue(true);

      // Test that integrateRouter can be called with simple architecture
      expect(() => {
        integrateRouter(options);
      }).not.toThrow();
    });

    test('should handle validation errors', () => {
      const options = {
        modules: ['userModule', 'productModule'],
        basePath: '/test/path',
        architecture: 'modular',
        orm: 'mongoose'
      };

      // Mock PathResolver methods
      PathResolver.getModularRouterPath.mockReturnValue('/test/path/modules/user-module/routes/user-module.router.js');
      PathResolver.getModulePath.mockReturnValue('/test/path/modules/user-module');

      // Mock FileValidator methods to return invalid results
      FileValidator.validateModuleDirectory.mockReturnValue({
        isValid: false,
        path: '/test/path/modules/user-module',
        error: 'Directory not found'
      });
      FileValidator.validateRouterIntegration.mockReturnValue({
        isValid: false,
        errors: ['Directory not found']
      });

      // Mock ErrorHandler.handleRouterIntegrationErrors
      ErrorHandler.handleRouterIntegrationErrors.mockReturnValue({
        type: 'ROUTER_INTEGRATION',
        message: 'Gagal mengintegrasikan 2 modul: userModule, productModule',
        details: { errors: ['Directory not found'], failedModules: ['userModule', 'productModule'] }
      });

      // Test that integrateRouter can be called without throwing an error
      expect(() => {
        integrateRouter(options);
      }).not.toThrow();
    });
  });
});