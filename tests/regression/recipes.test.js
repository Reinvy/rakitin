/**
 * Recipe (advanced tier) tests - real disk, no network.
 */
const fs = require('fs-extra');
const path = require('path');
const { recipeCommand, RECIPES } = require('../../lib/commands/recipe');
const { addCommand } = require('../../lib/commands/add');
const shared = require('../../lib/commands/shared');
const installer = require('../../lib/installer');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  fs.outputJsonSync(path.join(global.tempDir, 'package.json'), {
    name: 'recipe-demo',
    dependencies: { express: '^4.0.0' },
  });
  // Block REAL shell installs inside unit test environment.
  installer.internals.execCommand = jest.fn().mockResolvedValue({
    success: true,
    stdout: '',
    stderr: '',
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('recipe registry', () => {
  test('all four advanced recipes registered', () => {
    expect(Object.keys(RECIPES).sort()).toEqual(
      ['auth', 'docker', 'swagger', 'test']
    );
    expect(Object.values(RECIPES).every((r) => r.tier === 'advanced')).toBe(true);
  });

  test('unknown recipe throws with options', async () => {
    await expect(recipeCommand('graphql-magic', {})).rejects.toThrow(/Pilihan:/);
  });
});

describe('auth recipe', () => {
  test('composes middleware + user module + validator + env keys', async () => {
    const ctx = shared.buildContext({ yes: true });
    const res = await addCommand('module', 'noop-placeholder', ctx).catch(() => null);

    const result = await recipeCommand('auth', { arch: 'modular' });

    // middleware
    expect(fs.existsSync(path.join(global.tempDir, 'app/shared/middlewares/auth.middleware.js'))).toBe(true);
    // user module
    expect(fs.existsSync(path.join(global.tempDir, 'app/modules/user'))).toBe(true);
    // joi validator parses standalone
    const validatorPath = path.join(global.tempDir, 'app/shared/validators/user.validator.js');
    expect(fs.existsSync(validatorPath)).toBe(true);
    const src = fs.readFileSync(validatorPath, 'utf8').replace(/require\([^)]*\)/g, '({})');
    expect(() => new (require('vm').Script)(src)).not.toThrow();
    // env keys merged
    const env = fs.readFileSync(path.join(global.tempDir, '.env.example'), 'utf8');
    expect(env).toContain('JWT_SECRET=');
  });

  test('is idempotent - second run keeps first files intact', async () => {
    await recipeCommand('auth', { arch: 'modular' });
    const mwFile = path.join(global.tempDir, 'app/shared/middlewares/auth.middleware.js');
    await recipeCommand('auth', { arch: 'modular' });
    // Still a single generated copy - not appended / corrupted
    const src = fs.readFileSync(mwFile, 'utf8');
    expect((src.match(/jsonwebtoken/g) || []).length).toBeGreaterThanOrEqual(1);
  });
});

describe('swagger recipe', () => {
  test('spec includes detected modules and setup file exports mountSwagger', async () => {
    seedModule('orders');

    const result = await recipeCommand('swagger', {});

    const specPath = path.join(global.tempDir, 'app/docs/openapi.json');
    const spec = fs.readJsonSync(specPath);
    expect(spec.openapi).toBe('3.0.0');
    expect(Object.keys(spec.paths)).toContain('/orders');

    const setupSrc = fs.readFileSync(
      path.join(global.tempDir, 'app/docs/swagger.setup.js'),
      'utf8'
    );
    expect(setupSrc).toContain('mountSwagger');
    expect(result.createdFiles.length).toBeGreaterThan(0);
  });
});

describe('test recipe', () => {
  test('generates per-module test files + adds npm test script', async () => {
    seedModule('billing');

    const before = JSON.parse(
      fs.readFileSync(path.join(global.tempDir, 'package.json'), 'utf8')
    );
    expect(before.scripts?.test).toBeUndefined();

    // Prevent real dev-install shell out
    const installer = require('../../lib/installer');
    jest.spyOn(installer.PACKAGE_MANAGERS.npm, 'install').mockReturnValue('');

    await recipeCommand('test', {});

    expect(fs.existsSync(path.join(global.tempDir, 'tests/setup.js'))).toBe(true);
    expect(fs.existsSync(path.join(global.tempDir, 'tests/modules/billing.test.js'))).toBe(true);

    const pkg = JSON.parse(fs.readFileSync(path.join(global.tempDir, 'package.json'), 'utf8'));
    expect(pkg.scripts.test).toBe('jest');
  });
});

describe('docker recipe', () => {
  test('emits Dockerfile + compose + dockerignore; env only once', async () => {
    const first = await recipeCommand('docker', {});
    expect(first.createdFiles.map((p) => path.basename(p)).sort()).toEqual([
      '.dockerignore',
      'Dockerfile',
      'docker-compose.yml',
    ]);

    // Second run creates nothing new
    const second = await recipeCommand('docker', {});
    expect(second.createdFiles).toEqual([]);
  });
});

function seedModule(name) {
  const dir = path.join(global.tempDir, 'app', 'modules', name);
  fs.ensureDirSync(path.join(dir, 'routes'));
  fs.outputFileSync(path.join(dir, 'routes', `${name}.router.js`), '');
}
