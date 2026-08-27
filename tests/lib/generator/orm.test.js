/**
 * ORM generator tests - REAL disk execution; network/shell is stubbed via
 * child_process mock (ORM files hardcode execSync npm installs).
 */
const fs = require('fs-extra');
const path = require('path');

jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  execSync: jest.fn(),
}));

const { prismaORM } = require('../../../lib/generator/module/orm/prisma.orm');
const { sequelizeORM } = require('../../../lib/generator/module/orm/sequelize.orm');
const { mongooseORM } = require('../../../lib/generator/module/orm/mongoose.orm');
const { typeormORM } = require('../../../lib/generator/module/orm/typeorm.orm');
const { getPaths } = require('../../../lib/constants');
const { execSync } = require('child_process');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('prismaORM', () => {
  test('writes the model and creates the db.js singleton', async () => {
    await prismaORM('user-profile');

    const p = getPaths();
    const modelFile = path.join(p.prismaPath, 'user-profile.prisma');
    expect(fs.existsSync(modelFile)).toBe(true);
    expect(fs.readFileSync(modelFile, 'utf8')).toContain('model UserProfile');

    // Previously services referenced app/shared/config/db.js which was
    // never generated - now it must exist.
    const dbConfig = path.join(p.sharedPath, 'config', 'db.js');
    expect(fs.existsSync(dbConfig)).toBe(true);
    expect(fs.readFileSync(dbConfig, 'utf8')).toContain('new PrismaClient');
  });

  test('throws on missing module name', async () => {
    await expect(prismaORM('')).rejects.toThrow();
  });
});

describe('sequelizeORM', () => {
  test.each(['Modular', 'Simple'])(
    'writes a default-export model (%s)',
    async (architecture) => {
      await sequelizeORM('order-item', architecture);

      const modulesDir = getPaths().modulesPath;
      const rel =
        architecture === 'Modular'
          ? path.join(modulesDir, 'order-item', 'models')
          : path.join(modulesDir, 'order-item');
      const modelFile = path.join(rel, 'order-item.model.js');

      expect(fs.existsSync(modelFile)).toBe(true);
      const src = fs.readFileSync(modelFile, 'utf8');
      // B-med fix: single default export matching the service import
      expect(src).toContain('module.exports = OrderItem;');
    }
  );

  test('shells out to install sequelize + mysql2 when missing', async () => {
    await sequelizeORM('blog', 'Simple');
    const calls = execSync.mock.calls.map((c) => c[0]);
    expect(calls.some((c) => c.includes('npm install sequelize'))).toBe(true);
    expect(calls.some((c) => c.includes('npm install mysql2'))).toBe(true);
  });
});

describe('mongooseORM', () => {
  test('writes kebab-case model file for hyphenated names', async () => {
    await mongooseORM('user-profile', 'Modular');

    const modelFile = path.join(
      getPaths().modulesPath,
      'user-profile',
      'models',
      'user-profile.model.js'
    );
    expect(fs.existsSync(modelFile)).toBe(true);
    const src = fs.readFileSync(modelFile, 'utf8');
    expect(src).toMatch(/mongoose\.Schema|model\(/i);
  });
});

describe('typeormORM', () => {
  test('creates entity file and shared data-source config', async () => {
    await typeormORM('invoice', 'Modular');

    const moduleDir = path.join(getPaths().modulesPath, 'invoice');
    expect(
      fs.existsSync(path.join(moduleDir, 'entities', 'invoice.entity.js'))
    ).toBe(true);

    const dataSource = path.join(getPaths().sharedPath, 'config', 'data-source.js');
    expect(fs.existsSync(dataSource)).toBe(true);
    expect(execSync).toHaveBeenCalled(); // typeorm + reflect-metadata
  });
});
