const fs = require('fs');
const path = require('path');
const PathResolver = require('../../../lib/generator/shared/path-resolver');
const FileValidator = require('../../../lib/generator/shared/file-validator');

// Mock dependencies
jest.mock('fs');
jest.mock('../../../lib/generator/shared/path-resolver');

describe('FileValidator', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
  });

  describe('validateModularRouterFile', () => {
    test('should return valid result when file exists', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const routerPath = path.join(basePath, 'modules', 'user-module', 'routes', 'user-module.router.js');
      
      // Mock PathResolver
      PathResolver.getModularRouterPath.mockReturnValue(routerPath);
      
      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);
      
      // Mock fs.statSync to return isFile: true
      fs.statSync.mockReturnValue({ isFile: () => true });
      
      const result = FileValidator.validateModularRouterFile(moduleName, basePath);
      
      expect(result.isValid).toBe(true);
      expect(result.path).toBe(routerPath);
      expect(PathResolver.getModularRouterPath).toHaveBeenCalledWith(moduleName, basePath);
      expect(fs.existsSync).toHaveBeenCalledWith(routerPath);
      expect(fs.statSync).toHaveBeenCalledWith(routerPath);
    });

    test('should return invalid result when file does not exist', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const routerPath = path.join(basePath, 'modules', 'user-module', 'routes', 'user-module.router.js');
      
      // Mock PathResolver
      PathResolver.getModularRouterPath.mockReturnValue(routerPath);
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      const result = FileValidator.validateModularRouterFile(moduleName, basePath);
      
      expect(result.isValid).toBe(false);
      expect(result.path).toBe(routerPath);
      expect(result.error).toBe(`File router modular tidak ditemukan: ${routerPath}`);
    });

    test('should return invalid result when path is not a file', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const routerPath = path.join(basePath, 'modules', 'user-module', 'routes', 'user-module.router.js');
      
      // Mock PathResolver
      PathResolver.getModularRouterPath.mockReturnValue(routerPath);
      
      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);
      
      // Mock fs.statSync to return isFile: false
      fs.statSync.mockReturnValue({ isFile: () => false });
      
      const result = FileValidator.validateModularRouterFile(moduleName, basePath);
      
      expect(result.isValid).toBe(false);
      expect(result.path).toBe(routerPath);
      expect(result.error).toBe(`Path yang diberikan bukan file: ${routerPath}`);
    });

    test('should handle errors', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const routerPath = path.join(basePath, 'modules', 'user-module', 'routes', 'user-module.router.js');
      
      // Mock PathResolver
      PathResolver.getModularRouterPath.mockReturnValue(routerPath);
      
      // Mock fs.existsSync to throw error
      fs.existsSync.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const result = FileValidator.validateModularRouterFile(moduleName, basePath);
      
      expect(result.isValid).toBe(false);
      expect(result.path).toBe(null);
      expect(result.error).toBe('Error saat memvalidasi file router modular: Test error');
    });
  });

  describe('validateSimpleControllerFile', () => {
    test('should return valid result when file exists', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const controllerPath = path.join(basePath, 'modules', 'user-module', 'user-module.controller.js');
      
      // Mock PathResolver
      PathResolver.getSimpleControllerPath.mockReturnValue(controllerPath);
      
      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);
      
      // Mock fs.statSync to return isFile: true
      fs.statSync.mockReturnValue({ isFile: () => true });
      
      const result = FileValidator.validateSimpleControllerFile(moduleName, basePath);
      
      expect(result.isValid).toBe(true);
      expect(result.path).toBe(controllerPath);
      expect(PathResolver.getSimpleControllerPath).toHaveBeenCalledWith(moduleName, basePath);
      expect(fs.existsSync).toHaveBeenCalledWith(controllerPath);
      expect(fs.statSync).toHaveBeenCalledWith(controllerPath);
    });

    test('should return invalid result when file does not exist', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const controllerPath = path.join(basePath, 'modules', 'user-module', 'user-module.controller.js');
      
      // Mock PathResolver
      PathResolver.getSimpleControllerPath.mockReturnValue(controllerPath);
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      const result = FileValidator.validateSimpleControllerFile(moduleName, basePath);
      
      expect(result.isValid).toBe(false);
      expect(result.path).toBe(controllerPath);
      expect(result.error).toBe(`File controller simple tidak ditemukan: ${controllerPath}`);
    });
  });

  describe('validateModuleDirectory', () => {
    test('should return valid result for modular architecture when directory exists', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const modulePath = path.join(basePath, 'modules', 'user-module');
      
      // Mock PathResolver
      PathResolver.getModulePath.mockReturnValue(modulePath);
      
      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      
      const result = FileValidator.validateModuleDirectory(moduleName, basePath, 'modular');
      
      expect(result.isValid).toBe(true);
      expect(result.path).toBe(modulePath);
      expect(PathResolver.getModulePath).toHaveBeenCalledWith(moduleName, basePath);
      expect(fs.existsSync).toHaveBeenCalledWith(modulePath);
      expect(fs.statSync).toHaveBeenCalledWith(modulePath);
    });

    test('should return valid result for simple architecture when directory exists', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const modulePath = path.join(basePath, 'modules', 'user-module');
      
      // Mock PathResolver
      PathResolver.getModulePath.mockReturnValue(modulePath);
      
      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      
      const result = FileValidator.validateModuleDirectory(moduleName, basePath, 'simple');
      
      expect(result.isValid).toBe(true);
      expect(result.path).toBe(modulePath);
    });

    test('should return invalid result when directory does not exist', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const modulePath = path.join(basePath, 'modules', 'user-module');
      
      // Mock PathResolver
      PathResolver.getModulePath.mockReturnValue(modulePath);
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      const result = FileValidator.validateModuleDirectory(moduleName, basePath, 'modular');
      
      expect(result.isValid).toBe(false);
      expect(result.path).toBe(modulePath);
      expect(result.error).toBe(`Direktori modul tidak ditemukan: ${modulePath}`);
    });

    test('should return invalid result when path is not a directory', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const modulePath = path.join(basePath, 'modules', 'user-module');
      
      // Mock PathResolver
      PathResolver.getModulePath.mockReturnValue(modulePath);
      
      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);
      
      // Mock fs.statSync to return isDirectory: false
      fs.statSync.mockReturnValue({ isDirectory: () => false });
      
      const result = FileValidator.validateModuleDirectory(moduleName, basePath, 'modular');
      
      expect(result.isValid).toBe(false);
      expect(result.path).toBe(modulePath);
      expect(result.error).toBe(`Path yang diberikan bukan direktori: ${modulePath}`);
    });

    test('should return invalid result for modular architecture when required subdirectories are missing', () => {
      const moduleName = 'userModule';
      const basePath = path.join(global.tempDir, 'app');
      const modulePath = path.join(basePath, 'modules', 'user-module');
      
      // Mock PathResolver
      PathResolver.getModulePath.mockReturnValue(modulePath);
      
      // Mock fs.existsSync to return true for module path but false for subdirectories
      fs.existsSync.mockImplementation((path) => {
        if (path === modulePath) return true;
        return false;
      });
      
      // Mock fs.statSync to return isDirectory: true
      fs.statSync.mockReturnValue({ isDirectory: () => true });
      
      const result = FileValidator.validateModuleDirectory(moduleName, basePath, 'modular');
      
      expect(result.isValid).toBe(false);
      // Only 'routes' is required for modular integration (relaxed v2)
      expect(result.path).toBe(path.join(modulePath, 'routes'));
      expect(result.error).toBe(`Subdirektori yang diperlukan tidak ditemukan: ${path.join(modulePath, 'routes')}`);
    });
  });

  describe('validateJavaScriptFile', () => {
    test('should be a function', () => {
      expect(typeof FileValidator.validateJavaScriptFile).toBe('function');
    });

    test('should return invalid result when file does not exist', () => {
      const filePath = path.join(global.tempDir, 'test.js');
      
      // Mock fs.existsSync to return false
      fs.existsSync.mockReturnValue(false);
      
      const result = FileValidator.validateJavaScriptFile(filePath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(`File tidak ditemukan: ${filePath}`);
    });

    test('should return invalid result when file is not JavaScript', () => {
      const filePath = path.join(global.tempDir, 'test.txt');
      
      // Mock fs.existsSync to return true
      fs.existsSync.mockReturnValue(true);
      
      const result = FileValidator.validateJavaScriptFile(filePath);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toBe(`File harus berekstensi .js: ${filePath}`);
    });
  });

  describe('validateRouterIntegration', () => {
    test('should return valid result when all modules are valid', () => {
      const modules = ['userModule', 'productModule'];
      const basePath = path.join(global.tempDir, 'app');
      
      // Mock validateModuleDirectory to return valid result
      jest.spyOn(FileValidator, 'validateModuleDirectory').mockReturnValue({
        isValid: true,
        path: path.join(basePath, 'modules', 'user-module')
      });
      
      // Mock validateModularRouterFile to return valid result
      jest.spyOn(FileValidator, 'validateModularRouterFile').mockReturnValue({
        isValid: true,
        path: path.join(basePath, 'modules', 'user-module', 'routes', 'user-module.router.js')
      });
      
      const result = FileValidator.validateRouterIntegration(modules, basePath, 'modular');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      
      // Restore mocks
      jest.restoreAllMocks();
    });

    test('should return invalid result when modules have validation errors', () => {
      const modules = ['userModule'];
      const basePath = path.join(global.tempDir, 'app');
      
      // Mock validateModuleDirectory to return invalid result
      jest.spyOn(FileValidator, 'validateModuleDirectory').mockReturnValue({
        isValid: false,
        path: path.join(basePath, 'modules', 'user-module'),
        error: 'Directory not found'
      });
      
      const result = FileValidator.validateRouterIntegration(modules, basePath, 'modular');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(['Directory not found']);
      
      // Restore mocks
      jest.restoreAllMocks();
    });
  });
});