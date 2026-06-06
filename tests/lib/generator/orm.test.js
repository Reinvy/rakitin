const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { prismaORM } = require('../../lib/generator/module/orm/prisma.orm');
const { sequelizeORM } = require('../../lib/generator/module/orm/sequelize.orm');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../lib/constants');
jest.mock('../../lib/utils');
jest.mock('../../lib/generator/shared/validation-utils');

const { prismaPath } = require('../../lib/constants');
const { ensureDir, writeFileIfNotExists, toKebabCase, toPascalCase, toSnakeCase } = require('../../lib/utils');
const { handleError } = require('../../lib/generator/shared/validation-utils');

describe('ORM Generators', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
    
    // Mock prismaPath
    prismaPath.mockReturnValue(path.join(global.tempDir, 'prisma', 'models'));
    
    // Mock utility functions
    toKebabCase.mockImplementation(str => str.toLowerCase().replace(/\s+/g, '-'));
    toPascalCase.mockImplementation(str => str.replace(/\w+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).replace(/\s+/g, ''));
    toSnakeCase.mockImplementation(str => str.toLowerCase().replace(/\s+/g, '_'));
    
    // Mock handleError
    handleError.mockImplementation((context, error) => {
      throw error;
    });
  });

  describe('prismaORM', () => {
    test('should create Prisma model file with correct content', async () => {
      const moduleName = 'Test Module';
      
      // Mock fs.existsSync to return false (Prisma not initialized)
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await prismaORM(moduleName);
      
      // Verify utility functions were called
      expect(toKebabCase).toHaveBeenCalledWith(moduleName);
      expect(toPascalCase).toHaveBeenCalledWith(moduleName);
      expect(toSnakeCase).toHaveBeenCalledWith(moduleName);
      
      // Verify ensureDir was called
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'prisma', 'models'));
      
      // Verify writeFileIfNotExists was called with correct content
      const filePath = path.join(global.tempDir, 'prisma', 'models', 'test-module.prisma');
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        filePath,
        expect.stringContaining('// TestModule model')
      );
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        filePath,
        expect.stringContaining('model TestModule {')
      );
      expect(writeFileIfNotExists).toHaveBeenCalledWith(
        filePath,
        expect.stringContaining('@@map("test_modules")')
      );
    });

    test('should check and initialize Prisma if not initialized', async () => {
      const moduleName = 'Test Module';
      
      // Mock fs.existsSync to return false (Prisma not initialized)
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await prismaORM(moduleName);
      
      // Verify execSync was called to initialize Prisma
      expect(execSync).toHaveBeenCalledWith('npm install prisma @prisma/client', { stdio: 'inherit' });
      expect(execSync).toHaveBeenCalledWith('npx prisma init', { stdio: 'inherit' });
    });

    test('should not initialize Prisma if already initialized', async () => {
      const moduleName = 'Test Module';
      
      // Mock fs.existsSync to return true (Prisma already initialized)
      fs.existsSync.mockReturnValue(true);
      
      // Call the function
      await prismaORM(moduleName);
      
      // Verify execSync was not called to initialize Prisma
      expect(execSync).not.toHaveBeenCalledWith('npm install prisma @prisma/client', { stdio: 'inherit' });
      expect(execSync).not.toHaveBeenCalledWith('npx prisma init', { stdio: 'inherit' });
    });

    test('should update package.json with Prisma schema configuration', async () => {
      const moduleName = 'Test Module';
      
      // Mock fs.existsSync to return false (Prisma not initialized)
      fs.existsSync.mockReturnValue(false);
      
      // Mock package.json content
      const packageJson = { name: 'test-app' };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      // Call the function
      await prismaORM(moduleName);
      
      // Verify fs.writeFileSync was called to update package.json
      const packageJsonPath = path.join(global.tempDir, 'package.json');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        packageJsonPath,
        expect.stringContaining('"prisma": {')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        packageJsonPath,
        expect.stringContaining('"schema": "./prisma/schema.prisma"')
      );
    });

    test('should handle errors when module name is not provided', async () => {
      const moduleName = '';
      
      // Call the function and expect it to throw
      await expect(prismaORM(moduleName)).rejects.toThrow('Nama modul harus didefinisikan');
    });

    test('should handle errors when initializing Prisma', async () => {
      const moduleName = 'Test Module';
      
      // Mock fs.existsSync to return false (Prisma not initialized)
      fs.existsSync.mockReturnValue(false);
      
      // Mock execSync to throw an error
      execSync.mockImplementation(() => {
        throw new Error('Prisma initialization error');
      });
      
      // Call the function and expect it to throw
      await expect(prismaORM(moduleName)).rejects.toThrow('Gagal inisialisasi Prisma: Prisma initialization error');
      
      // Verify handleError was called
      expect(handleError).toHaveBeenCalledWith('inisialisasi Prisma', expect.any(Error));
    });
  });

  describe('sequelizeORM', () => {
    test('should create Sequelize model file with correct content for Simple architecture', async () => {
      const moduleName = 'Test Module';
      const architecture = 'Simple';
      
      // Mock fs.existsSync to return false (Sequelize not installed)
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await sequelizeORM(moduleName, architecture);
      
      // Verify utility functions were called
      expect(toKebabCase).toHaveBeenCalledWith(moduleName);
      expect(toPascalCase).toHaveBeenCalledWith(moduleName);
      expect(toSnakeCase).toHaveBeenCalledWith(moduleName);
      
      // Verify ensureDir was called
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'modules', 'test-module'));
      
      // Verify fs.writeFileSync was called with correct content
      const modelPath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'test-module.model.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        modelPath,
        expect.stringContaining('// TestModule Model (Sequelize)')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        modelPath,
        expect.stringContaining('const TestModule = sequelize.define(\'TestModule\'')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        modelPath,
        expect.stringContaining('tableName: \'test_modules\'')
      );
    });

    test('should create Sequelize model file with correct content for Modular architecture', async () => {
      const moduleName = 'Test Module';
      const architecture = 'Modular';
      
      // Mock fs.existsSync to return false (Sequelize not installed)
      fs.existsSync.mockReturnValue(false);
      
      // Call the function
      await sequelizeORM(moduleName, architecture);
      
      // Verify ensureDir was called for models directory
      expect(ensureDir).toHaveBeenCalledWith(path.join(global.tempDir, 'app', 'modules', 'test-module', 'models'));
      
      // Verify fs.writeFileSync was called with correct content
      const modelPath = path.join(global.tempDir, 'app', 'modules', 'test-module', 'models', 'test-module.model.js');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        modelPath,
        expect.stringContaining('// TestModule Model (Sequelize)')
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        modelPath,
        expect.stringContaining('const sequelize = require(\'../../../../shared/database\')')
      );
    });

    test('should check and install Sequelize if not installed', async () => {
      const moduleName = 'Test Module';
      const architecture = 'Simple';
      
      // Mock fs.existsSync to return false (package.json exists)
      fs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      // Mock package.json content
      const packageJson = { name: 'test-app', dependencies: {} };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      // Call the function
      await sequelizeORM(moduleName, architecture);
      
      // Verify execSync was called to install Sequelize
      expect(execSync).toHaveBeenCalledWith('npm install sequelize', { stdio: 'inherit' });
      expect(execSync).toHaveBeenCalledWith('npm install mysql2', { stdio: 'inherit' });
    });

    test('should not install Sequelize if already installed', async () => {
      const moduleName = 'Test Module';
      const architecture = 'Simple';
      
      // Mock package.json content with Sequelize already installed
      const packageJson = { name: 'test-app', dependencies: { sequelize: '^6.0.0' } };
      fs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      // Call the function
      await sequelizeORM(moduleName, architecture);
      
      // Verify execSync was not called to install Sequelize
      expect(execSync).not.toHaveBeenCalledWith('npm install sequelize', { stdio: 'inherit' });
    });

    test('should handle errors when module name is not provided', async () => {
      const moduleName = '';
      const architecture = 'Simple';
      
      // Call the function and expect it to throw
      await expect(sequelizeORM(moduleName, architecture)).rejects.toThrow('Nama modul harus didefinisikan');
    });

    test('should handle errors when architecture is not provided', async () => {
      const moduleName = 'Test Module';
      const architecture = '';
      
      // Call the function and expect it to throw
      await expect(sequelizeORM(moduleName, architecture)).rejects.toThrow('Arsitektur harus didefinisikan');
    });

    test('should handle errors when installing Sequelize', async () => {
      const moduleName = 'Test Module';
      const architecture = 'Simple';
      
      // Mock fs.existsSync to return false (package.json exists)
      fs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
      
      // Mock package.json content
      const packageJson = { name: 'test-app', dependencies: {} };
      fs.readFileSync.mockReturnValue(JSON.stringify(packageJson));
      
      // Mock execSync to throw an error
      execSync.mockImplementation(() => {
        throw new Error('Sequelize installation error');
      });
      
      // Call the function and expect it to throw
      await expect(sequelizeORM(moduleName, architecture)).rejects.toThrow('Gagal menginstal Sequelize: Sequelize installation error');
      
      // Verify handleError was called
      expect(handleError).toHaveBeenCalledWith('instalasi Sequelize', expect.any(Error));
    });
  });
});