const fs = require('fs-extra');
const path = require('path');
const { execCommand } = require('../../lib/installer');
const installer = require('../../lib/installer');

describe('Installer', () => {
  // All execution/check paths are routed through the injectable internals
  // registry, so tests never touch the network or spawn child processes.
  let savedInternals;

  beforeEach(() => {
    savedInternals = { ...installer.internals };
  });

  afterEach(() => {
    Object.assign(installer.internals, savedInternals);
  });

  describe('isPackageInstalled', () => {
    test('returns true if package exists in node_modules', () => {
      // Real files against tempDir (process.cwd is isolated in setup.js)
      const pkgDir = path.join(global.tempDir, 'node_modules', 'test-package');
      fs.ensureDirSync(pkgDir);

      expect(installer.isPackageInstalled('test-package')).toBe(true);
    });

    test('checks package.json dependencies if not in node_modules', () => {
      fs.outputJsonSync(path.join(global.tempDir, 'package.json'), {
        dependencies: { 'dep-package': '^1.0.0' },
        devDependencies: { 'dev-package': '^2.0.0' },
      });

      expect(installer.isPackageInstalled('dep-package')).toBe(true);
      expect(installer.isPackageInstalled('dev-package')).toBe(true);
    });

    test('returns false if package not found', () => {
      expect(installer.isPackageInstalled('non-existent-package')).toBe(false);
    });
  });

  describe('installIfNeeded', () => {
    test('resolves without installing for empty package list', async () => {
      installer.internals.execCommand = jest.fn();

      const result = await installer.installIfNeeded([]);

      expect(result).toEqual({ success: true, installed: [], failed: [] });
      expect(installer.internals.execCommand).not.toHaveBeenCalled();
    });

    test('skips packages already installed', async () => {
      installer.internals.execCommand = jest.fn();
      installer.internals.isPackageInstalled = jest.fn().mockReturnValue(true);

      const result = await installer.installIfNeeded(['pkg-a', 'pkg-b']);

      expect(result).toEqual({ success: true, installed: [], failed: [] });
      expect(installer.internals.execCommand).not.toHaveBeenCalled();
    });

    test('installs only missing packages via the detected command', async () => {
      installer.internals.execCommand = jest.fn().mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
      });
      installer.internals.isPackageInstalled = jest
        .fn()
        .mockReturnValueOnce(false) // pkg-a missing
        .mockReturnValueOnce(true); // pkg-b present

      const result = await installer.installIfNeeded(['pkg-a', 'pkg-b'], {
        packageManager: 'npm',
      });

      expect(result.success).toBe(true);
      expect(result.installed).toEqual(['pkg-a']);
      expect(installer.internals.execCommand).toHaveBeenCalledWith(
        'npm install pkg-a',
        { stdio: 'inherit' }
      );
    });

    test('installs as dev dependency when requested', async () => {
      installer.internals.execCommand = jest.fn().mockResolvedValue({
        success: true,
        stdout: '',
        stderr: '',
      });
      installer.internals.isPackageInstalled = jest.fn().mockReturnValue(false);

      const result = await installer.installIfNeeded(['pkg-a'], {
        isDev: true,
        retry: false,
      });

      expect(result.success).toBe(true);
      expect(installer.internals.execCommand).toHaveBeenCalledWith(
        'npm install --save-dev pkg-a',
        { stdio: 'inherit' }
      );
    });

    test('reports failed installation result without hanging on retries', async () => {
      installer.internals.execCommand = jest
        .fn()
        .mockRejectedValue(new Error('Installation failed'));
      installer.internals.isPackageInstalled = jest.fn().mockReturnValue(false);

      const result = await installer.installIfNeeded(['pkg-a'], {
        retry: false,
      });

      expect(result.success).toBe(false);
      expect(result.failed).toEqual(['pkg-a']);
    });
  });

  describe('installOrmPackages', () => {
    test.each([
      ['Prisma', ['@prisma/client', 'prisma']],
      ['Sequelize', ['sequelize', 'mysql2']],
      ['Mongoose', ['mongoose']],
      ['TypeORM', ['typeorm', 'reflect-metadata']],
    ])('maps %s to its packages', async (orm, expectedPackages) => {
      installer.internals.installIfNeeded = jest.fn().mockResolvedValue({
        success: true,
        installed: [],
        failed: [],
      });

      await installer.installOrmPackages(orm);

      expect(installer.internals.installIfNeeded).toHaveBeenCalledWith(
        expectedPackages,
        {}
      );
    });

    test('returns empty result for unknown or null ORM', async () => {
      installer.internals.installIfNeeded = jest.fn();

      const unknown = await installer.installOrmPackages('UnknownORM');
      const nulled = await installer.installOrmPackages(null);

      expect(unknown).toEqual({ success: true, installed: [], failed: [] });
      expect(nulled).toEqual({ success: true, installed: [], failed: [] });
      expect(installer.internals.installIfNeeded).not.toHaveBeenCalled();
    });
  });

  describe('getPackageManager (lock-file based)', () => {
    test('detects pnpm', () => {
      fs.outputFileSync(path.join(global.tempDir, 'pnpm-lock.yaml'), '');
      expect(installer.getPackageManager()).toBe('pnpm');
    });

    test('detects yarn', () => {
      fs.removeSync(path.join(global.tempDir, 'pnpm-lock.yaml'));
      fs.outputFileSync(path.join(global.tempDir, 'yarn.lock'), '');
      expect(installer.getPackageManager()).toBe('yarn');
    });

    test('detects bun', () => {
      fs.removeSync(path.join(global.tempDir, 'yarn.lock'));
      fs.outputFileSync(path.join(global.tempDir, 'bun.lockb'), '');
      expect(installer.getPackageManager()).toBe('bun');
    });

    test('falls back to npm', () => {
      fs.removeSync(path.join(global.tempDir, 'bun.lockb'));
      fs.removeSync(path.join(global.tempDir, 'package-lock.json'));
      expect(installer.getPackageManager()).toBe('npm');
    });
  });

  describe('PACKAGE_MANAGERS commands', () => {
    test('builds correct npm/pnpm/yarn/bun install commands', () => {
      const pm = installer.PACKAGE_MANAGERS;

      expect(pm.npm.install(['a', 'b'])).toBe('npm install a b');
      expect(pm.npm.install(['a'], { saveDev: true })).toBe('npm install --save-dev a');
      expect(pm.pnpm.install(['a'], { saveDev: true })).toBe('pnpm add -D a');
      expect(pm.yarn.install(['a'], { saveDev: true })).toBe('yarn add --dev a');
      expect(pm.bun.install(['a'], { saveDev: true })).toBe('bun add --dev a');
    });
  });

  describe('execCommand (real implementation)', () => {
    test('runs a trivial shell command cross-platform', async () => {
      const result = await execCommand(`node -e "process.exit(0)"`, {
        stdio: 'pipe',
      });
      expect(result.code).toBe(0);
    });
  });
});
