/**
 * Integration: directory structure produced by generators on REAL disk.
 */
const fs = require('fs-extra');
const path = require('path');
const { getPaths } = require('../../lib/constants');
const { ensureBaseStructure } = require('../../lib/utils');
const { simpleArch, modularArch } = require('../../lib/generator/module/arch/arch');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Directory Structure (real disk)', () => {
  test('ensureBaseStructure creates the conventional app/ skeleton', () => {
    ensureBaseStructure();

    const p = getPaths();
    expect(fs.existsSync(p.modulesPath)).toBe(true);
    expect(fs.existsSync(p.sharedPath)).toBe(true);
    ['middlewares', 'config', 'utils', 'interfaces'].forEach((sub) => {
      expect(fs.existsSync(path.join(p.sharedPath, sub))).toBe(true);
    });
    expect(fs.existsSync(path.join(p.basePath, 'app.js'))).toBe(true);
    expect(fs.existsSync(path.join(p.basePath, 'server.js'))).toBe(true);
  });

  test('simpleArch produces flat module files under modules/<name>', async () => {
    await simpleArch('payment', 'None');

    const dir = path.join(getPaths().modulesPath, 'payment');
    ['payment.controller.js', 'payment.service.js', 'payment.router.js']
      .forEach((f) => expect(fs.existsSync(path.join(dir, f))).toBe(true));
  });

  test('modularArch produces the four-layer structure', async () => {
    await modularArch('shipping', 'None');

    const dir = path.join(getPaths().modulesPath, 'shipping');
    ['controllers', 'services', 'models', 'routes'].forEach((d) =>
      expect(fs.existsSync(path.join(dir, d))).toBe(true)
    );
    expect(
      fs.existsSync(path.join(dir, 'controllers', 'shipping.controller.js'))
    ).toBe(true);
  });

  test('module names normalize consistently across arch layers', async () => {
    await modularArch('StockLevel Report', 'None');

    const dir = path.join(getPaths().modulesPath, 'stock-level-report');
    expect(
      fs.existsSync(path.join(dir, 'routes', 'stock-level-report.router.js'))
    ).toBe(true);

    // A camelCase input lands on the SAME canonical path
    await simpleArch('stockLevelReport', 'None');
    expect(
      fs.existsSync(path.join(dir, 'stock-level-report.controller.js'))
    ).toBe(true);
  });

  test('Prisma model files live under prisma/models and services reference shared db config', async () => {
    const { prismaORM } = require('../../lib/generator/module/orm/prisma.orm');
    const childProc = require('child_process');
    jest.spyOn(childProc, 'execSync').mockImplementation(() => '');

    await prismaORM('audit-log');

    const p = getPaths();
    expect(fs.existsSync(path.join(p.prismaPath, 'audit-log.prisma'))).toBe(true);
    expect(fs.existsSync(path.join(p.sharedPath, 'config', 'db.js'))).toBe(true);
  });
});
