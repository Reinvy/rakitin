/**
 * Integration: end-to-end flow through bin + interactive dispatch.
 * Simulates the CLI pipeline without spawning the process: index.js
 * handlers are invoked with mocked prompts; generated artifacts on disk
 * are validated for real.
 */
const fs = require('fs-extra');
const path = require('path');
const vm = require('vm');

jest.mock('inquirer', () => {
  class Separator {
    constructor() {
      this.type = 'separator';
    }
  }
  const create = () => ({ prompt: jest.fn(), Separator });
  return { __esModule: true, ...create(), default: create() };
});

const inquirer = require('inquirer');
const { getPaths } = require('../../lib/constants');
const { simpleArch } = require('../../lib/generator/module/arch/simple.arch');

function stripRequires(src) {
  return src.replace(/require\([^)]*\)/g, '({})');
}

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  inquirer.default.prompt.mockReset();
});

describe('CLI dispatch (index.js main loop)', () => {
  const { run } = require('../../index.js');

  test('selecting Module -> generates files, then Loop/exit terminates', async () => {
    inquirer.default.prompt
      .mockResolvedValueOnce({ feature: 'Module' })
      .mockResolvedValueOnce({
        moduleName: 'search-index',
        architecture: 'Simple',
        useORM: 'No',
        autoIntegrateRouter: false,
      })
      .mockResolvedValueOnce({ feature: 'exit' });

    await expect(run()).resolves.not.toThrow();

    const dir = path.join(getPaths().modulesPath, 'search-index');
    expect(fs.existsSync(path.join(dir, 'search-index.controller.js'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'search-index.router.js'))).toBe(true);

    // B1 E2E proof: no-ORM service exists and parses standalone
    const serviceSrc = fs.readFileSync(
      path.join(dir, 'search-index.service.js'),
      'utf8'
    );
    expect(() => new vm.Script(serviceSrc)).not.toThrow();
  });
});
