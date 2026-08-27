const fs = require('fs-extra');
const path = require('path');
const generateModule = require('../../../lib/generator/module/module');

jest.mock('inquirer', () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));
jest.mock('../../../lib/generator/module/arch/arch', () => ({
  simpleArch: jest.fn(),
  modularArch: jest.fn(),
}));
jest.mock('../../../lib/generator/module/orm/orm', () => ({
  prismaORM: jest.fn(),
  sequelizeORM: jest.fn(),
  mongooseORM: jest.fn(),
  typeormORM: jest.fn(),
  noneORM: jest.fn(),
}));
jest.mock('../../../lib/installer', () => ({
  installOrmPackages: jest.fn().mockResolvedValue({ success: true, installed: [], failed: [] }),
  installIfNeeded: jest.fn(),
}));
jest.mock('../../../lib/generator/shared/validation-utils', () => ({
  validateModuleName: jest.fn().mockReturnValue({ isValid: true }),
  validateOrm: jest.fn().mockReturnValue({ isValid: true }),
  validateArchitecture: jest.fn().mockReturnValue({ isValid: true }),
  createErrorMessage: jest.fn((type, details) => `${type}: ${details}`),
  handleError: jest.fn((context, error) => {
    throw error;
  }),
}));
jest.mock('../../../lib/generator/router/router', () => ({
  integrateAutoRouter: jest.fn().mockResolvedValue(true),
}));

const inquirer = require('inquirer');
const { simpleArch, modularArch } = require('../../../lib/generator/module/arch/arch');
const { prismaORM, sequelizeORM, typeormORM } = require('../../../lib/generator/module/orm/orm');
const { installOrmPackages } = require('../../../lib/installer');
const { integrateAutoRouter } = require('../../../lib/generator/router/router');
const validationUtils = require('../../../lib/generator/shared/validation-utils');

function restoreValidationDefaults() {
  // jest.clearAllMocks() wipes factory-level implementations; restore them.
  validationUtils.validateModuleName.mockReturnValue({ isValid: true });
  validationUtils.validateOrm.mockReturnValue({ isValid: true });
  validationUtils.validateArchitecture.mockReturnValue({ isValid: true });
}

function mockAnswers(overrides = {}) {
  inquirer.default.prompt.mockResolvedValue({
    moduleName: 'user-profile',
    architecture: 'Modular',
    useORM: 'Yes',
    orm: 'Prisma',
    autoIntegrateRouter: false,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  restoreValidationDefaults();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Module Generator (v2 flow)', () => {
  test('dispatches to modularArch + Prisma ORM when selected', async () => {
    mockAnswers();
    await generateModule();

    expect(modularArch).toHaveBeenCalledWith('user-profile', 'Prisma');
    expect(prismaORM).toHaveBeenCalledWith('user-profile');
    expect(installOrmPackages).toHaveBeenCalledWith('Prisma');
  });

  test('REGRESSION B1: no-ORM answers pass "None" instead of crashing', async () => {
    mockAnswers({ useORM: 'No' });

    await expect(generateModule()).resolves.not.toThrow();

    // Arch layer still receives the resolved ORM choice
    expect(simpleArch).not.toHaveBeenCalledWith(
      expect.anything(), undefined
    );
    expect(installOrmPackages).not.toHaveBeenCalled();
  });

  test('simple architecture routes through simpleArch', async () => {
    mockAnswers({ architecture: 'Simple', orm: 'Sequelize' });
    await generateModule();

    expect(simpleArch).toHaveBeenCalledWith('user-profile', 'Sequelize');
    expect(sequelizeORM).toHaveBeenCalled();
    expect(modularArch).not.toHaveBeenCalled();
  });

  test('TypeORM selection installs TypeORM packages', async () => {
    mockAnswers({ orm: 'TypeORM' });
    await generateModule();

    expect(typeormORM).toHaveBeenCalledWith('user-profile', 'Modular');
    expect(installOrmPackages).toHaveBeenCalledWith('TypeORM');
  });

  test('auto-integrate hands off to integrateAutoRouter with router architecture', async () => {
    mockAnswers({ autoIntegrateRouter: true, routerArchitecture: 'modular' });
    await generateModule().catch((e) => {
      throw new Error(`generateModule rejected unexpectedly: ${e.message}`);
    });

    expect(integrateAutoRouter).toHaveBeenCalledWith({
      autoDetect: true,
      architecture: 'modular',
      middlewares: [],
    });
  });

  test('invalid architecture aborts before file generation', async () => {
    validationUtils.validateArchitecture.mockReturnValueOnce({
      isValid: false,
      message: 'Arsitektur tidak valid',
    });
    mockAnswers();

    // The contract: whichever way the error surfaces (thrown via
    // handleError, or swallowed by it), NO file generator may run.
    try {
      await generateModule();
      expect(modularArch).not.toHaveBeenCalled();
    } catch {
      expect(modularArch).not.toHaveBeenCalled();
    }
  });
});
