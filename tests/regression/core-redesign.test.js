/**
 * Fase 2 regression guards: project detector, safety layer (dry-run,
 * backups, marker injection), unified dependency manifest.
 */
const fs = require('fs-extra');
const path = require('path');

const { detectProject } = require('../../lib/project/detector');
const safety = require('../../lib/safety');
const manifest = require('../../lib/deps/manifest');
const { getPaths } = require('../../lib/constants');

afterEach(() => {
  safety.resetPlan();
  jest.restoreAllMocks();
});

describe('Project Detector', () => {
  test('detects empty directory safely', () => {
    const d = detectProject(global.tempDir);
    expect(d.isNpmProject).toBe(false);
    expect(d.hasExpress).toBe(false);
    expect(d.structure.modules).toEqual([]);
  });

  test('reads package.json, express, package manager & module inventory', () => {
    fs.outputJsonSync(path.join(global.tempDir, 'package.json'), {
      name: 'dummy-app',
      dependencies: { express: '^4.19.0', mongoose: '^8.0.0' },
    });

    // Seed one modular + one simple module
    const p = getPaths();
    const modMod = path.join(p.modulesPath, 'alpha-mod');
    fs.ensureDirSync(path.join(modMod, 'routes'));
    fs.outputFileSync(path.join(modMod, 'routes', 'alpha-mod.router.js'), '');
    const simMod = path.join(p.modulesPath, 'beta-mod');
    fs.ensureDirSync(simMod);
    fs.outputFileSync(path.join(simMod, 'beta-mod.controller.js'), '');

    const d = detectProject(global.tempDir);
    expect(d.isNpmProject).toBe(true);
    expect(d.packageName).toBe('dummy-app');
    expect(d.hasExpress).toBe(true);
    expect(d.ormsInstalled.Mongoose).toBe(true);
    expect(d.structure.modularCount).toBe(1);
    expect(d.structure.simpleCount).toBe(1);
    expect(d.structure.mixedArchitectures).toBe(true);
    expect(d.packageManager).toBe('npm');
  });
});

describe('Safety Layer', () => {
  describe('dry-run plan mode', () => {
    test('records creates without touching disk', () => {
      safety.beginPlan();

      const target = path.join(global.tempDir, 'plan-test', 'new-file.js');
      const res = safety.writeFileIfNotExistsSafe(target, 'x');

      expect(res.written).toBe(false);
      expect(safety.getPlan()).toEqual([
        { op: 'create', path: target },
      ]);
      expect(fs.existsSync(target)).toBe(false);

      safety.resetPlan();
    });

    test('writes only after leaving dry-run', () => {
      safety.beginPlan();
      const target = path.join(global.tempDir, 'later-write.js');

      safety.writeFileIfNotExistsSafe(target, 'a'); // planned
      expect(fs.existsSync(target)).toBe(false);

      safety.setDryRun(false); // leave plan mode
      const res = safety.writeFileIfNotExistsSafe(target, 'b');
      expect(res.written).toBe(true);
      expect(fs.readFileSync(target, 'utf8')).toBe('b');
    });
  });

  test('overwriteWithBackup preserves previous version as .bak', () => {
    const target = path.join(global.tempDir, 'with-backup.js');
    fs.outputFileSync(target, 'v1');

    const res = safety.overwriteWithBackup(target, 'v2');
    expect(res.backedUp).toBe(true);
    expect(fs.readFileSync(`${target}.bak`, 'utf8')).toBe('v1');
    expect(fs.readFileSync(target, 'utf8')).toBe('v2');
  });
});

describe('buildRoutesContent (marker injection)', () => {
  const ROUTE_LINES = "router.use('/user-profile', userProfileRouter);";

  test('creates a fresh marker-managed file when none exists', () => {
    const { content, action } = safety.buildRoutesContent(null, ROUTE_LINES);

    expect(action).toBe('create');
    expect(content.startsWith(safety.MAIN_ROUTER_HEADER)).toBe(true);
    expect(content).toContain(ROUTE_LINES);
    expect(content.trimEnd().endsWith('module.exports = router;')).toBe(true);
  });

  test('REGRESSION B10: user code above markers stays byte-identical', () => {
    const userCode = [
      '// MY PRECIOUS CUSTOM ROUTES',
      "router.get('/health', healthHandler);",
      '',
    ].join('\n');

    const first = safety.buildRoutesContent(null, ROUTE_LINES).content;
    // Simulate a user editing INSIDE nothing special, adding their own
    // routes BEFORE the marked block:
    const editedByUser = first.replace(
      safety.ROUTES_BLOCK_START,
      `${userCode}\n${safety.ROUTES_BLOCK_START}`
    );

    const secondPass =
      safety.buildRoutesContent(
        editedByUser,
        "router.use('/new-module', newModuleRouter);"
      );

    expect(secondPass.action).toBe('inject');
    // User routes preserved exactly once
    expect(secondPass.content.match(/MY PRECIOUS CUSTOM ROUTES/g)).toHaveLength(1);
    expect(secondPass.content).toContain("router.get('/health'");
    // Managed block replaced
    expect(secondPass.content).toContain('/new-module');
    expect(secondPass.content).not.toContain('/user-profile", userProfileRouter');
  });

  test('marker-less legacy routers get appended without loss', () => {
    const legacy = "const express = require('express');\nconst r = 1;\nmodule.exports = r;\n";
    const { content, action } = safety.buildRoutesContent(legacy, ROUTE_LINES);

    expect(action).toBe('inject');
    expect(content).toContain('const r = 1;');
    expect(content).toContain(ROUTE_LINES);
    expect(content.indexOf(ROUTE_LINES)).toBeLessThan(content.lastIndexOf('module.exports'));
  });

  test('injection is IDEMPOTENT - repeated passes do not duplicate wiring', () => {
    let content = safety.buildRoutesContent(null, ROUTE_LINES).content;
    content = safety.buildRoutesContent(content, ROUTE_LINES).content;
    content = safety.buildRoutesContent(content, ROUTE_LINES).content;

    expect(content.match(/userProfileRouter/g)).toHaveLength(1);
    expect(content.match(/rakitin:routes:start/g)).toHaveLength(1);
    expect(content.match(/rakitin:routes:end/g)).toHaveLength(1);
  });
});

describe('Dependency Manifest', () => {
  test('resolves unique packages across kinds', () => {
    const { packages, unknownKinds } = manifest.resolvePackagesForKinds([
      'middleware:auth',
      'middleware:auth',
      'validation:joi',
    ]);

    expect(packages.sort()).toEqual(['joi', 'jsonwebtoken']);
    expect(unknownKinds).toEqual([]);
  });

  test('reports unknown kinds instead of crashing', () => {
    const { packages, unknownKinds } = manifest.resolvePackagesForKinds([
      'made-up-kind',
    ]);
    expect(packages).toEqual([]);
    expect(unknownKinds).toEqual(['made-up-kind']);
  });

  test('ormToKind bridges ORM display names', () => {
    expect(manifest.ormToKind('Mongoose')).toBe('module:mongoose');
    expect(manifest.ormToKind('Unknown')).toBe('module:none');
  });
});
