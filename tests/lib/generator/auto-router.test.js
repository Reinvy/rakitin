const fs = require('fs-extra');
// IMPORTANT: lib code requires the CORE 'fs' module, not fs-extra.
// Spies must target node's fs or they silently never intercept.
const coreFs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  createAutoRouterTemplate,
  createAutoRouter,
  integrateAutoRouter,
} = require('../../../lib/generator/router/router');

describe('Auto Router Generator', () => {
  describe('createAutoRouterTemplate', () => {
    test('is a function', () => {
      expect(typeof createAutoRouterTemplate).toBe('function');
    });

    test('produces a self-contained, parseable template', () => {
      const template = createAutoRouterTemplate('modular', []);

      // Core scaffolding
      expect(template).toContain("const express = require('express')");
      expect(template).toContain('const router = express.Router()');
      expect(template).toContain('function detectModules()');
      expect(template).toContain('module.exports = router');

      // B3 fix: naming helpers MUST be embedded (self-contained)
      expect(template).toContain('function normalizeModuleName(name)');
      expect(template).toContain('function toIdentifier(name)');

      // Universal per-module runtime detection
      expect(template).toContain("'routes', normalizedModule + '.router.js'");
      expect(template).toContain("normalizedModule + '.controller.js'");
    });

    test('middleware requires point at shared/middlewares with valid ids', () => {
      const template = createAutoRouterTemplate('modular', ['auth', 'logger']);

      expect(template).toContain(
        "require('../shared/middlewares/auth.middleware')"
      );
      expect(template).toContain(
        "require('../shared/middlewares/logger.middleware')"
      );
      expect(template).toContain('router.use(authMiddleware)');
      expect(template).toContain('router.use(loggerMiddleware)');
    });

    test('parses as JavaScript for every middleware combination', () => {
      expect(() => new vm.Script(createAutoRouterTemplate('modular', []))).not.toThrow();
      expect(() => new vm.Script(createAutoRouterTemplate('simple', ['auth', 'logger', 'error', 'request-time']))).not.toThrow();
    });
  });

  describe('createAutoRouter', () => {
    let writeSpy;

    afterEach(() => {
      writeSpy.mockRestore();
      jest.restoreAllMocks();
    });

    test('writes the generated template to app/routes/index.js', async () => {
      writeSpy = jest.spyOn(coreFs, 'writeFileSync').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await createAutoRouter('modular', ['auth']);

      expect(result).toBe(true);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      const [destPath, content] = writeSpy.mock.calls[0];
      expect(destPath.endsWith(path.join('app', 'routes', 'index.js'))).toBe(true);
      expect(content).toContain('function normalizeModuleName(name)');
    });
  });

  describe('integrateAutoRouter', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    test('returns false when no modules exist', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest.spyOn(coreFs, 'existsSync').mockReturnValue(false);

      const result = await integrateAutoRouter({
        autoDetect: true,
        architecture: 'modular',
        middlewares: ['auth'],
      });

      expect(result).toBe(false);
    });

    test('creates router when modules exist (no strict pre-validation)', async () => {
      jest.spyOn(console, 'log').mockImplementation(() => {});
      jest
        .spyOn(coreFs, 'existsSync')
        .mockImplementation((p) =>
          typeof p === 'string' ? p.includes('modules') : false
        );
      jest.spyOn(coreFs, 'readdirSync').mockReturnValue(['user-profile']);
      jest.spyOn(coreFs, 'statSync').mockReturnValue({ isDirectory: () => true });
      const writeSpy = jest.spyOn(coreFs, 'writeFileSync').mockImplementation(() => {});

      const result = await integrateAutoRouter({
        autoDetect: true,
        architecture: 'modular',
        middlewares: [],
      });

      expect(result).toBe(true);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      // B2 guard: identifier must be sanitized even though dir is kebab-case
      expect(writeSpy.mock.calls[0][1]).not.toContain('user-profile-router');
    });
  });
});
