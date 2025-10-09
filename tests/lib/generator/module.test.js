const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');
const generateModule = require('../../lib/generator/module/module');

// Mock dependencies
jest.mock('inquirer');
jest.mock('../../lib/generator/module/arch/arch');
jest.mock('../../lib/generator/module/orm/orm');
jest.mock('../../lib/installer');
jest.mock('../../lib/generator/shared/validation-utils');

const { simpleArch, modularArch } = require('../../lib/generator/module/arch/arch');
const { prismaORM, sequelizeORM, mongooseORM, typeormORM } = require('../../lib/generator/module/orm/orm');
const { installIfNeeded, installOrmPackages } = require('../../lib/installer');
const { validateModuleName, validateOrm, validateArchitecture, handleError, createErrorMessage } = require('../../lib/generator/shared/validation-utils');

describe('Module Generator', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock process.cwd
    process.cwd = jest.fn(() => global.tempDir);
    
    // Mock validation functions to return valid results by default
    validateModuleName.mockReturnValue({ isValid: true, message: 'Valid module name' });
    validateOrm.mockReturnValue({ isValid: true, message: 'Valid ORM' });
    validateArchitecture.mockReturnValue({ isValid: true, message: 'Valid architecture' });
    
    // Mock installIfNeeded to do nothing
    installIfNeeded.mockReturnValue({ success: true, installed: [], failed: [] });
    
    // Mock installOrmPackages to return success
    installOrmPackages.mockReturnValue({ success: true, installed: [], failed: [] });
  });

  test('should prompt user for module details', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Prisma'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    prismaORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify inquirer.prompt was called with correct configuration
    expect(mockPrompt).toHaveBeenCalledTimes(1);
    expect(mockPrompt).toHaveBeenCalledWith([
      {
        type: 'input',
        name: 'moduleName',
        message: 'Nama modul:',
        validate: expect.any(Function)
      },
      {
        type: 'list',
        name: 'architecture',
        message: 'Pilih arsitektur:',
        choices: ['Simple', 'Modular']
      },
      {
        type: 'list',
        name: 'useORM',
        message: 'Apakah ingin menggunakan ORM?',
        choices: ['Yes', 'No'],
        default: 'Yes'
      },
      {
        type: 'list',
        name: 'orm',
        message: 'Pilih ORM/Database:',
        choices: ['Prisma', 'Sequelize', 'Mongoose', 'TypeORM'],
        when: expect.any(Function)
      }
    ]);
  });

  test('should validate module name', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Prisma'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    prismaORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify validateModuleName was called
    expect(validateModuleName).toHaveBeenCalledWith('test-module');
  });

  test('should validate architecture', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Prisma'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    prismaORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify validateArchitecture was called
    expect(validateArchitecture).toHaveBeenCalledWith('Simple');
  });

  test('should validate ORM when using ORM', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Prisma'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    prismaORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify validateOrm was called
    expect(validateOrm).toHaveBeenCalledWith('Prisma');
  });

  test('should not validate ORM when not using ORM', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'No'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify validateOrm was not called
    expect(validateOrm).not.toHaveBeenCalled();
  });

  test('should install inquirer package', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'No'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify installIfNeeded was called with inquirer
    expect(installIfNeeded).toHaveBeenCalledWith(['inquirer'], false, true);
  });

  test('should call simpleArch when Simple architecture is selected', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'No'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Call the function
    await generateModule();
    
    // Verify simpleArch was called
    expect(simpleArch).toHaveBeenCalledWith('test-module', 'None');
    expect(modularArch).not.toHaveBeenCalled();
  });

  test('should call modularArch when Modular architecture is selected', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Modular',
      useORM: 'No'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Call the function
    await generateModule();
    
    // Verify modularArch was called
    expect(modularArch).toHaveBeenCalledWith('test-module', 'None');
    expect(simpleArch).not.toHaveBeenCalled();
  });

  test('should call Prisma ORM when Prisma is selected', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Prisma'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    prismaORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify prismaORM was called
    expect(prismaORM).toHaveBeenCalledWith('test-module');
    expect(sequelizeORM).not.toHaveBeenCalled();
    expect(mongooseORM).not.toHaveBeenCalled();
    expect(typeormORM).not.toHaveBeenCalled();
  });

  test('should call Sequelize ORM when Sequelize is selected', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Sequelize'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    sequelizeORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify sequelizeORM was called
    expect(sequelizeORM).toHaveBeenCalledWith('test-module', 'Simple');
    expect(prismaORM).not.toHaveBeenCalled();
    expect(mongooseORM).not.toHaveBeenCalled();
    expect(typeormORM).not.toHaveBeenCalled();
  });

  test('should call Mongoose ORM when Mongoose is selected', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Modular',
      useORM: 'Yes',
      orm: 'Mongoose'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    modularArch.mockResolvedValue();
    mongooseORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify mongooseORM was called
    expect(mongooseORM).toHaveBeenCalledWith('test-module', 'Modular');
    expect(prismaORM).not.toHaveBeenCalled();
    expect(sequelizeORM).not.toHaveBeenCalled();
    expect(typeormORM).not.toHaveBeenCalled();
  });

  test('should call TypeORM ORM when TypeORM is selected', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Modular',
      useORM: 'Yes',
      orm: 'TypeORM'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    modularArch.mockResolvedValue();
    typeormORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify typeormORM was called
    expect(typeormORM).toHaveBeenCalledWith('test-module', 'Modular');
    expect(prismaORM).not.toHaveBeenCalled();
    expect(sequelizeORM).not.toHaveBeenCalled();
    expect(mongooseORM).not.toHaveBeenCalled();
  });

  test('should install ORM packages when using ORM', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Prisma'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    prismaORM.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify installOrmPackages was called
    expect(installOrmPackages).toHaveBeenCalledWith('Prisma');
  });

  test('should not install ORM packages when not using ORM', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'No'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    
    // Call the function
    await generateModule();
    
    // Verify installOrmPackages was not called
    expect(installOrmPackages).not.toHaveBeenCalled();
  });

  test('should handle validation errors for module name', async () => {
    // Mock validateModuleName to return invalid
    validateModuleName.mockReturnValue({ isValid: false, message: 'Invalid module name' });
    
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'No'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Call the function and expect it to throw
    await expect(generateModule()).rejects.toThrow('Invalid module name');
  });

  test('should handle validation errors for architecture', async () => {
    // Mock validateArchitecture to return invalid
    validateArchitecture.mockReturnValue({ isValid: false, message: 'Invalid architecture' });
    
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'No'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Call the function and expect it to throw
    await expect(generateModule()).rejects.toThrow('Invalid architecture');
  });

  test('should handle validation errors for ORM', async () => {
    // Mock validateOrm to return invalid
    validateOrm.mockReturnValue({ isValid: false, message: 'Invalid ORM' });
    
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Prisma'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Call the function and expect it to throw
    await expect(generateModule()).rejects.toThrow('Invalid ORM');
  });

  test('should handle errors from architecture functions', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'No'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock simpleArch to throw an error
    simpleArch.mockRejectedValue(new Error('Architecture error'));
    
    // Mock handleError
    handleError.mockImplementation((context, error) => {
      throw error;
    });
    
    // Call the function and expect it to throw
    await expect(generateModule()).rejects.toThrow('Architecture error');
    
    // Verify handleError was called
    expect(handleError).toHaveBeenCalledWith('pembuatan modul', expect.any(Error));
  });

  test('should handle errors from ORM functions', async () => {
    // Mock inquirer prompt
    const mockPrompt = jest.fn().mockResolvedValue({
      moduleName: 'test-module',
      architecture: 'Simple',
      useORM: 'Yes',
      orm: 'Prisma'
    });
    inquirer.default.prompt = mockPrompt;
    
    // Mock architecture functions
    simpleArch.mockResolvedValue();
    
    // Mock prismaORM to throw an error
    prismaORM.mockRejectedValue(new Error('ORM error'));
    
    // Mock handleError
    handleError.mockImplementation((context, error) => {
      throw error;
    });
    
    // Call the function and expect it to throw
    await expect(generateModule()).rejects.toThrow('ORM error');
    
    // Verify handleError was called
    expect(handleError).toHaveBeenCalledWith('pembuatan modul', expect.any(Error));
  });
});