const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const installer = require('../../lib/installer');

// Mock fs, execSync, and console
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../lib/generator/shared/validation-utils', () => ({
  createErrorMessage: jest.fn((type, details) => `Error ${type}: ${details}`),
  handleError: jest.fn((context, error) => {
    console.error(`Error in ${context}: ${error.message}`);
    throw error;
  })
}));

describe('Installer', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
  });

  describe('isPackageInstalled', () => {
    test('should return true if package exists in node_modules', () => {
      const packageName = 'test-package';
      const nodeModulesPath = path.join(global.tempDir, 'node_modules', packageName);
      
      fs.existsSync.mockReturnValue(true);
      
      const result = installer.isPackageInstalled(packageName);
      
      expect(fs.existsSync).toHaveBeenCalledWith(nodeModulesPath);
      expect(result).toBe(true);
    });

    test('should check package.json dependencies if not in node_modules', () => {
      const packageName = 'test-package';
      const packageJsonPath = path.join(global.tempDir, 'package.json');
      const packageJson = {
        dependencies: {
          [packageName]: '1.0.0'
        }
      };
      
      // First call to existsSync (node_modules) returns false
      // Second call to existsSync (package.json) returns true
      fs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      const result = installer.isPackageInstalled(packageName);
      
      expect(fs.existsSync).toHaveBeenCalledTimes(2);
      expect(fs.readFileSync).toHaveBeenCalledWith(packageJsonPath, 'utf8');
      expect(result).toBe(true);
    });

    test('should return false if package not found', () => {
      const packageName = 'non-existent-package';
      
      fs.existsSync.mockReturnValue(false);
      
      const result = installer.isPackageInstalled(packageName);
      
      expect(result).toBe(false);
    });

    test('should handle errors gracefully', () => {
      const packageName = 'test-package';
      
      fs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });
      
      const result = installer.isPackageInstalled(packageName);
      
      expect(result).toBe(false);
    });
  });

  describe('installIfNeeded', () => {
    test('should not install if packageNames is empty', () => {
      const result = installer.installIfNeeded([], false, true);
      
      expect(result).toEqual({
        success: true,
        installed: [],
        failed: []
      });
    });

    test('should not install if all packages are already installed', () => {
      const packageNames = ['package1', 'package2'];
      
      // Mock isPackageInstalled to return true for all packages
      jest.spyOn(installer, 'isPackageInstalled').mockReturnValue(true);
      
      const result = installer.installIfNeeded(packageNames, false, true);
      
      expect(installer.isPackageInstalled).toHaveBeenCalledTimes(2);
      expect(execSync).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        installed: [],
        failed: []
      });
    });

    test('should install packages that are not already installed', () => {
      const packageNames = ['package1', 'package2'];
      
      // Mock isPackageInstalled to return false for package1 and true for package2
      jest.spyOn(installer, 'isPackageInstalled')
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true);
      
      execSync.mockImplementation(() => {});
      
      const result = installer.installIfNeeded(packageNames, false, true);
      
      expect(installer.isPackageInstalled).toHaveBeenCalledTimes(2);
      expect(execSync).toHaveBeenCalledWith('npm install package1', { stdio: 'pipe' });
      expect(result).toEqual({
        success: true,
        installed: ['package1'],
        failed: []
      });
    });

    test('should install as dev dependency when isDev is true', () => {
      const packageNames = ['package1'];
      
      // Mock isPackageInstalled to return false
      jest.spyOn(installer, 'isPackageInstalled').mockReturnValue(false);
      
      execSync.mockImplementation(() => {});
      
      const result = installer.installIfNeeded(packageNames, true, true);
      
      expect(execSync).toHaveBeenCalledWith('npm install --save-dev package1', { stdio: 'pipe' });
      expect(result).toEqual({
        success: true,
        installed: ['package1'],
        failed: []
      });
    });

    test('should handle installation errors', () => {
      const packageNames = ['package1'];
      
      // Mock isPackageInstalled to return false
      jest.spyOn(installer, 'isPackageInstalled').mockReturnValue(false);
      
      execSync.mockImplementation(() => {
        throw new Error('Installation failed');
      });
      
      const result = installer.installIfNeeded(packageNames, false, true);
      
      expect(result).toEqual({
        success: false,
        installed: [],
        failed: ['package1']
      });
    });
  });

  describe('installOrmPackages', () => {
    test('should install Prisma packages', () => {
      jest.spyOn(installer, 'installIfNeeded').mockReturnValue({
        success: true,
        installed: ['@prisma/client', 'prisma'],
        failed: []
      });
      
      const result = installer.installOrmPackages('Prisma', true);
      
      expect(installer.installIfNeeded).toHaveBeenCalledWith(['@prisma/client', 'prisma'], false, true);
      expect(result).toEqual({
        success: true,
        installed: ['@prisma/client', 'prisma'],
        failed: []
      });
    });

    test('should install Sequelize packages', () => {
      jest.spyOn(installer, 'installIfNeeded').mockReturnValue({
        success: true,
        installed: ['sequelize', 'mysql2'],
        failed: []
      });
      
      const result = installer.installOrmPackages('Sequelize', true);
      
      expect(installer.installIfNeeded).toHaveBeenCalledWith(['sequelize', 'mysql2'], false, true);
      expect(result).toEqual({
        success: true,
        installed: ['sequelize', 'mysql2'],
        failed: []
      });
    });

    test('should install Mongoose packages', () => {
      jest.spyOn(installer, 'installIfNeeded').mockReturnValue({
        success: true,
        installed: ['mongoose'],
        failed: []
      });
      
      const result = installer.installOrmPackages('Mongoose', true);
      
      expect(installer.installIfNeeded).toHaveBeenCalledWith(['mongoose'], false, true);
      expect(result).toEqual({
        success: true,
        installed: ['mongoose'],
        failed: []
      });
    });

    test('should install TypeORM packages', () => {
      jest.spyOn(installer, 'installIfNeeded').mockReturnValue({
        success: true,
        installed: ['typeorm', 'reflect-metadata'],
        failed: []
      });
      
      const result = installer.installOrmPackages('TypeORM', true);
      
      expect(installer.installIfNeeded).toHaveBeenCalledWith(['typeorm', 'reflect-metadata'], false, true);
      expect(result).toEqual({
        success: true,
        installed: ['typeorm', 'reflect-metadata'],
        failed: []
      });
    });

    test('should return empty result for unknown ORM', () => {
      const result = installer.installOrmPackages('UnknownORM', true);
      
      expect(installer.installIfNeeded).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        installed: [],
        failed: []
      });
    });

    test('should handle null or undefined ORM', () => {
      const result1 = installer.installOrmPackages(null, true);
      const result2 = installer.installOrmPackages(undefined, true);
      
      expect(installer.installIfNeeded).not.toHaveBeenCalled();
      expect(result1).toEqual({
        success: true,
        installed: [],
        failed: []
      });
      expect(result2).toEqual({
        success: true,
        installed: [],
        failed: []
      });
    });
  });
});