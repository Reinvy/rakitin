/**
 * Architecture generator tests - REAL disk execution in an isolated cwd
 * (per-suite mkdtemp from setup.js). Generated files are syntax-checked.
 */
const fs = require('fs-extra');
const path = require('path');
const vm = require('vm');
const { simpleArch } = require('../../../lib/generator/module/arch/simple.arch');
const { modularArch } = require('../../../lib/generator/module/arch/modular.arch');

function modulesPathFor(name) {
  const { getPaths } = require('../../../lib/constants');
  return path.join(getPaths().modulesPath, name);
}

/** Strip CommonJS requires so vm.Script can compile fragments standalone. */
function stripRequires(src) {
  return src.replace(/require\([^)]*\)/g, '({})');
}

describe('simpleArch', () => {
  afterEach(() => jest.restoreAllMocks());

  test('creates controller, service, router for a hyphenated module', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});

    await simpleArch('user-profile', 'None');

    const dir = modulesPathFor('user-profile');
    expect(fs.existsSync(path.join(dir, 'user-profile.controller.js'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'user-profile.service.js'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'user-profile.router.js'))).toBe(true);

    // Generated service uses the no-ORM in-memory store (B1)
    const service = fs.readFileSync(path.join(dir, 'user-profile.service.js'), 'utf8');
    expect(service).toContain('USERPROFILE_STORE');
  });

  test('is idempotent - existing files are not overwritten', async () => {
    await simpleArch('blog', 'None');

    const dir = modulesPathFor('blog');
    const markerFile = path.join(dir, 'blog.controller.js');
    fs.writeFileSync(markerFile, '// CUSTOM USER CODE', 'utf8');

    await simpleArch('blog', 'None');
    expect(fs.readFileSync(markerFile, 'utf8')).toBe('// CUSTOM USER CODE');
  });

  test('throws on invalid module name', async () => {
    await expect(simpleArch('', 'None')).rejects.toThrow();
  });
});

describe('modularArch', () => {
  afterEach(() => jest.restoreAllMocks());

  test('creates controllers/services/models/routes subdirectories', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});

    await modularArch('order-item', 'Mongoose');

    const dir = modulesPathFor('order-item');
    ['controllers', 'services', 'models', 'routes'].forEach((sub) => {
      expect(fs.existsSync(path.join(dir, sub))).toBe(true);
    });

    const controllerSrc = fs.readFileSync(
      path.join(dir, 'controllers', 'order-item.controller.js'),
      'utf8'
    );
    const routerSrc = fs.readFileSync(
      path.join(dir, 'routes', 'order-item.router.js'),
      'utf8'
    );
    // Parse-check both fragments
    expect(() => new vm.Script(stripRequires(controllerSrc))).not.toThrow();
    expect(() => new vm.Script(stripRequires(routerSrc))).not.toThrow();

    // Mongoose naming consistency: kebab-case model file + import
    const serviceSrc = fs.readFileSync(
      path.join(dir, 'services', 'order-item.service.js'),
      'utf8'
    );
    expect(serviceSrc).toContain('../../models/order-item.model');
  });

  test('is idempotent across repeated generation', async () => {
    await modularArch('invoice', 'None');
    const modelFile = path.join(modulesPathFor('invoice'), 'models', 'invoice.model.js');
    fs.writeFileSync(modelFile, '// TUNED BY USER', 'utf8');

    await modularArch('invoice', 'None');
    expect(fs.readFileSync(modelFile, 'utf8')).toBe('// TUNED BY USER');
  });
});
