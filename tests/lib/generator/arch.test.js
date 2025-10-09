const fs = require('fs-extra');
const path = require('path');
const { simpleArch } = require('../../lib/generator/module/arch/simple.arch');
const { modularArch } = require('../../lib/generator/module/arch/modular.arch');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('../../lib/constants');
jest.mock('../../lib/utils');
jest.mock('../../lib/generator/shared/orm-service-generator');
jest.mock('../../lib/generator/shared/validation-utils');

const { modulesPath } = require('../../lib/constants');
const { ensureDir, writeFileIfNotExists, toKebabCase } = require('../../lib/utils');
const { generateServiceCode } = require('../../lib/generator/shared/orm-service-generator');
const { validateModuleName, validateOrm, handleError } = require('../../lib/generator/shared/validation-utils');

describe('Architecture Generators', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
    
    // Mock modulesPath
    modulesPath.mockReturnValue(path.join(global.tempDir, 'app', 'modules'));
    
    // Mock validation functions to return valid results by default
    validateModuleName.mockReturnValue({ isValid: true, message: 'Valid module name' });
    validateOrm.mockReturnValue({ isValid: true, message: 'Valid ORM' });
    
    // Mock toKebabCase to return a simple transformation
    toKebabCase.mockImplementation(str => str.toLowerCase().replace(/\s+/g, '-'));
    
    // Mock handleError
    handleError.mockImplementation((context, error) => {
      throw error;
    });
  });

  describe('simpleArch', () => {
    test('should create simple architecture with correct directory structure', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await simpleArch(moduleName, orm);
      
      // Verify validation functions were called
      expect(validateModuleName).toHaveBeenCalledWith(moduleName);
      expect(validateOrm).toHaveBeenCalledWith(orm);
      
      // Verify toKebabCase was called
      expect(toKebabCase).toHaveBeenCalledWith(moduleName);
      
      // Verify ensureDir was called
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'modules', 'test-module'));
      
      // Verify writeFileIfNotExists was called for each file
      expect(writeFileIfNotExists).toHaveBeenCalledTimes(3);
      
      // Verify generateServiceCode was called
      expect(generateServiceCode).toHaveBeenCalledWith(moduleName, orm, 'Simple');
    });

    test('should create correct controller file', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await simpleArch(moduleName, orm);
      
      // Verify writeFileIfNotExists was called with correct controller content
      const controllerPath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'test-module.controller.js');
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        controllerPath,
        expect.stringContaining('// Test Module Controller')
      );
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        controllerPath,
        expect.stringContaining('const { getAll } = require("./test-module.service");')
      );
    });

    test('should create correct service file', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await simpleArch(moduleName, orm);
      
      // Verify writeFileIfNotExists was called with correct service content
      const servicePath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'test-module.service.js');
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        servicePath,
        '// Test Service Code'
      );
    });

    test('should create correct router file', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await simpleArch(moduleName, orm);
      
      // Verify writeFileIfNotExists was called with correct router content
      const routerPath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'test-module.routes.js');
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('// Test Module Router')
      );
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('const { getAll } = require("./test-module.controller");')
      );
    });

    test('should handle validation errors for module name', async () => {
      const moduleName = 'Invalid Module';
      const orm = 'Prisma';
      
      // Mock validateModuleName to return invalid
      validateModuleName.mockReturnValue({ isValid: false, message: 'Invalid module name' });
      
      // Call the function and expect it to throw
      await expect(simpleArch(moduleName, orm)).rejects.toThrow('Invalid module name');
    });

    test('should handle validation errors for ORM', async () => {
      const moduleName = 'Test Module';
      const orm = 'Invalid ORM';
      
      // Mock validateOrm to return invalid
      validateOrm.mockReturnValue({ isValid: false, message: 'Invalid ORM' });
      
      // Call the function and expect it to throw
      await expect(simpleArch(moduleName, orm)).rejects.toThrow('Invalid ORM');
    });

    test('should handle errors from file operations', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Mock ensureDir to throw an error
      ensureDir.mockImplementation(() => {
        throw new Error('Directory creation error');
      });
      
      // Call the function and expect it to throw
      await expect(simpleArch(moduleName, orm)).rejects.toThrow('Directory creation error');
      
      // Verify handleError was called
      expect(handleError).toHaveBeenCalledWith('pembuatan modul sederhana', expect.any(Error));
    });
  });

  describe('modularArch', () => {
    test('should create modular architecture with correct directory structure', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await modularArch(moduleName, orm);
      
      // Verify validation functions were called
      expect(validateModuleName).toHaveBeenCalledWith(moduleName);
      expect(validateOrm).toHaveBeenCalledWith(orm);
      
      // Verify toKebabCase was called
      expect(toKebabCase).toHaveBeenCalledWith(moduleName);
      
      // Verify ensureDir was called for each directory
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'modules', 'test-module'));
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'modules', 'test-module', 'controllers'));
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'modules', 'test-module', 'services'));
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'modules', 'test-module', 'models'));
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'modules', 'test-module', 'routes'));
      
      // Verify writeFileIfNotExists was called for each file
      expect(writeFileIfNotExists).toHaveBeenCalledTimes(4);
      
      // Verify generateServiceCode was called
      expect(generateServiceCode).toHaveBeenCalledWith(moduleName, orm, 'Modular');
    });

    test('should create correct controller file', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await modularArch(moduleName, orm);
      
      // Verify writeFileIfNotExists was called with correct controller content
      const controllerPath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'controllers', 'test-module.controller.js');
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        controllerPath,
        expect.stringContaining('// Test Module Controller')
      );
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        controllerPath,
        expect.stringContaining('const { getAll } = require("../services/test-module.service");')
      );
    });

    test('should create correct service file', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await modularArch(moduleName, orm);
      
      // Verify writeFileIfNotExists was called with correct service content
      const servicePath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'services', 'test-module.service.js');
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        servicePath,
        '// Test Service Code'
      );
    });

    test('should create correct model file', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await modularArch(moduleName, orm);
      
      // Verify writeFileIfNotExists was called with correct model content
      const modelPath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'models', 'test-module.model.js');
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        modelPath,
        expect.stringContaining('// Test Module Model')
      );
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        modelPath,
        expect.stringContaining('// Schema atau ORM Model bisa ditulis di sini.')
      );
    });

    test('should create correct router file', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Call the function
      await modularArch(moduleName, orm);
      
      // Verify writeFileIfNotExists was called with correct router content
      const routerPath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'routes', 'test-module.routes.js');
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('// Test Module Routes')
      );
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        routerPath,
        expect.stringContaining('const { getAll } = require("../controllers/test-module.controller");')
      );
    });

    test('should handle validation errors for module name', async () => {
      const moduleName = 'Invalid Module';
      const orm = 'Prisma';
      
      // Mock validateModuleName to return invalid
      validateModuleName.mockReturnValue({ isValid: false, message: 'Invalid module name' });
      
      // Call the function and expect it to throw
      await expect(modularArch(moduleName, orm)).rejects.toThrow('Invalid module name');
    });

    test('should handle validation errors for ORM', async () => {
      const moduleName = 'Test Module';
      const orm = 'Invalid ORM';
      
      // Mock validateOrm to return invalid
      validateOrm.mockReturnValue({ isValid: false, message: 'Invalid ORM' });
      
      // Call the function and expect it to throw
      await expect(modularArch(moduleName, orm)).rejects.toThrow('Invalid ORM');
    });

    test('should handle errors from file operations', async () => {
      const moduleName = 'Test Module';
      const orm = 'Prisma';
      
      // Mock generateServiceCode to return a simple service code
      generateServiceCode.mockReturnValue('// Test Service Code');
      
      // Mock ensureDir to throw an error
      ensureDir.mockImplementation(() => {
        throw new Error('Directory creation error');
      });
      
      // Call the function and expect it to throw
      await expect(modularArch(moduleName, orm)).rejects.toThrow('Directory creation error');
      
      // Verify handleError was called
      expect(handleError).toHaveBeenCalledWith('pembuatan modul modular', expect.any(Error));
    });
  });
});