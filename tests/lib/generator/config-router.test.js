/**
 * Config generator + Router integration tests - REAL disk execution,
 * inquirer is the only mocked boundary.
 */
const fs = require('fs-extra');
const path = require('path');
const vm = require('vm');

jest.mock('inquirer', () => ({
  __esModule: true,
  default: { prompt: jest.fn() },
}));

const inquirer = require('inquirer');
const generateConfig = require('../../../lib/generator/config/config');
const { getPaths } = require('../../../lib/constants');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('generateConfig', () => {
  function sharedConfigFile(name) {
    return path.join(getPaths().sharedPath, 'config', name);
  }

  test('creates a database config file in app/shared/config', async () => {
    inquirer.default.prompt.mockResolvedValue({
      configType: 'database',
      createEnvExample: false,
    });

    await generateConfig();

    const file = sharedConfigFile('database.config.js');
    expect(fs.existsSync(file)).toBe(true);
    const src = fs.readFileSync(file, 'utf8');
    expect(() => new vm.Script(src.replace(/require\([^)]*\)/g, '({})'))).not.toThrow();
  });

  test('writes env.example keys when requested', async () => {
    inquirer.default.prompt.mockResolvedValue({
      configType: 'jwt',
      createEnvExample: true,
    });

    await generateConfig();

    const envExample = path.join(global.tempDir, '.env.example');
    expect(fs.existsSync(envExample)).toBe(true);
    const content = fs.readFileSync(envExample, 'utf8');
    expect(content).toContain('JWT_');
  });

  test('does not overwrite an existing config file', async () => {
    const file = sharedConfigFile('app.config.js');
    fs.ensureDirSync(path.dirname(file));
    fs.writeFileSync(file, '// MY OWN CONFIG', 'utf8');

    inquirer.default.prompt.mockResolvedValue({
      configType: 'app',
      createEnvExample: false,
    });
    await generateConfig();

    expect(fs.readFileSync(file, 'utf8')).toBe('// MY OWN CONFIG');
  });
});

describe('integrateRouter (manual flow)', () => {
  const { integrateRouter } = require('../../../lib/generator/router/router');

  test('generates a valid main router from detected modular modules', async () => {
    // Seed one modular module on real disk
    const modulesDir = getPaths().modulesPath;
    const modDir = path.join(modulesDir, 'product');
    fs.ensureDirSync(path.join(modDir, 'routes'));
    fs.writeFileSync(
      path.join(modDir, 'routes', 'product.router.js'),
      `const express = require("express");
const router = express.Router();
router.get("/", (req, res) => res.json({ ok: true }));
module.exports = router;`,
      'utf8'
    );

    // Mock the interactive answer sequence
    let call = 0;
    const answers = [
      { integrationType: 'automatic' },          // 1st prompt
      { architecture: 'modular' },               // 2nd
      { useGlobalMiddleware: false },            // 3rd
      { createAppExample: false },               // 4th
    ];
    inquirer.default.prompt.mockImplementation(() =>
      Promise.resolve(answers[call++] || {})
    );

    await integrateRouter();

    const routerFile = path.join(getPaths().basePath, 'routes', 'index.js');
    expect(fs.existsSync(routerFile)).toBe(true);

    const src = fs.readFileSync(routerFile, 'utf8');
    // B2 fix: sanitized identifier, kebab-safe URL segment
    expect(src).toContain('productRouter');
    expect(src).toContain("'/product'");
    expect(() => new vm.Script(src)).not.toThrow(); // fully parseable
  });
});
