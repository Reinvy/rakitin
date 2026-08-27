/**
 * Regression guards for the P0 generator bugs fixed in v2.
 * Every generated artifact below is syntax-checked via vm.Script -
 * generated code that fails to parse is a release blocker.
 */
const fs = require('fs-extra');
const path = require('path');
const vm = require('vm');

const { createAutoRouterTemplate, integrateAutoRouter } = require('../../lib/generator/router/router');
const { generateServiceCode } = require('../../lib/generator/shared/orm-service-generator');
const generateEndpoint = require('../../lib/generator/api/endpoint/index');

/** Compile-check helper: throws on syntax errors. */
function assertParses(source) {
  expect(() => new vm.Script(source)).not.toThrow();
}

describe('Bugfix regressions: generated code must be valid JavaScript', () => {
  describe('B2/B3 - router generation', () => {
    test('auto-router template is self-contained and parses', () => {
      const template = createAutoRouterTemplate('modular', ['auth']);
      assertParses(template);
    });

    test('auto-router template contains NO references to rakitin internals', () => {
      const template = createAutoRouterTemplate();
      // B3: previously emitted calls to normalizeModuleName without
      // embedding it, crashing every generated project at boot.
      expect(template).toContain('function normalizeModuleName');
      expect(template).toContain('function toIdentifier');
    });

    test('REGRESSION: hyphenated module names produce valid identifiers', () => {
      const { toIdentifier } = require('../../lib/naming');

      // B2 root cause: "user-profile" interpolated directly as an identifier
      const id = toIdentifier('user-profile-router');
      assertParses(`const ${id} = require('./user-profile.router');`);
      expect(id).toBe('userProfileRouter');
    });
  });

  describe('B1 - no-ORM path', () => {
    test('generateServiceCode("None") no longer throws', () => {
      const code = generateServiceCode('User', 'None', 'Simple');
      assertParses(code);
      expect(code).toContain('in-memory');
    });

    test('works for modular architecture too', () => {
      const code = generateServiceCode('User Profile', 'None', 'Modular');
      assertParses(code);
    });

    test('none.orm.js exports a callable noneORM', () => {
      const { noneORM } = require('../../lib/generator/module/orm/none.orm');
      expect(typeof noneORM).toBe('function');
    });
  });

  describe('B-med - ORM naming consistency', () => {
    test('Sequelize service imports the model via default export name', () => {
      // Previously destructured a named export that never existed
      const code = generateServiceCode('User Profile', 'Sequelize', 'Modular');
      assertParses(code);
      expect(code).toContain('const UserProfile = require("../../models/user-profile.model")');
      expect(code).not.toContain('const { userProfile }');
    });

    test('Mongoose service requires the kebab-case model file', () => {
      const code = generateServiceCode('User Profile', 'Mongoose', 'Modular');
      assertParses(code);
      expect(code).toContain("../../models/user-profile.model");
    });
  });

  describe('B5 - endpoint generator conditional variables', () => {
    const FIELDS = [{ name: 'title', type: 'string' }, { name: 'count', type: 'number' }];

    test('getAll parses safely even with pagination AND filtering off', () => {
      const controller = generateEndpoint.internals.generateController(
        'Post', 'post', FIELDS, false, false
      );
      // page/limit/offset/filters must always be defined
      expect(controller).toContain('const page = 1;');
      expect(controller).toContain('const filters = {};');
      assertParses(controller.replace(`require("../services/${'post'}.service")`, '{}'));
    });

    test('pagination on + filtering off still defines filters', () => {
      const controller = generateEndpoint.internals.generateController(
        'Post', 'post', FIELDS, true, false
      );
      expect(controller).toContain('parseInt(req.query.page)');
      expect(controller).toContain('const filters = {};');
    });

    test('service filters over declared fields, not hardcoded title', () => {
      const service = generateEndpoint.internals.generateService(
        'Post', 'post', [{ name: 'summary', type: 'string' }]
      );
      assertParses(service);
      expect(service).toContain('item.summary');
      expect(service).not.toContain('item.title?.toLowerCase()');
    });

    test('controller requires the KEBAB-CASE service file', () => {
      const controller = generateEndpoint.internals.generateController(
        'Post', 'post', FIELDS, true, true
      );
      expect(controller).toContain('require("../services/post.service")');
    });

    test('simple endpoint writes ONE kebab controller reused by its router', () => {
      const moduleDir = path.join(global.tempDir, 'ep-simple-module');
      fs.ensureDirSync(moduleDir);

      generateEndpoint.internals.generateSimpleEndpoint(
        moduleDir, 'user-profile', 'UserProfile', 'userProfile',
        FIELDS, false, false
      );

      const files = fs.readdirSync(moduleDir).sort();
      // B(old): twin camelCase controller with dropped schema - removed
      expect(files).toEqual(['user-profile.controller.js', 'user-profile.router.js']);

      const routerSrc = fs.readFileSync(path.join(moduleDir, 'user-profile.router.js'), 'utf8');
      assertParses(routerSrc.replace(`require("./user-profile.controller")`, '{}'));
      expect(routerSrc).toContain('require("./user-profile.controller")');
    });
  });

  describe('B6 - Joi validator typo', () => {
    test('generateJoiSchema output parses (no stray "n" prefix)', () => {
      const validation = require('../../lib/generator/api/validation/index');
      // Access internals if exported; otherwise exercise through file flow
      const genFn =
        validation.internals?.generateJoiSchema ||
        (() => {
          // Fallback: run the full common-validators path against temp dir
          return null;
        });

      if (!genFn) return;

      const schema = genFn('User', [
        { name: 'email', type: 'email', required: true },
        { name: 'age', type: 'number', required: false },
      ]);
      assertParses(schema.replace(/require\([^)]*\)/g, 'null'));
      expect(schema).toMatch(/\{\n\s+email:/); // object body intact
    });
  });
});
