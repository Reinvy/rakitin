// Global setup for Jest tests
const os = require('os');
const fs = require('fs-extra');
const path = require('path');

// Each test SUITE gets its OWN temporary directory inside the OS tmpdir.
// Sharing a single directory across parallel Jest workers caused ENOENT
// races whenever one worker wiped contents while another was scanning.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rakitin-test-'));
global.tempDir = tempDir;

// Store original console for tests that need it
const originalConsole = { ...console };

beforeAll(async () => {
  // Ensure temp directory exists
  await fs.ensureDir(tempDir);

  // Store original cwd for cleanup.
  // NOTE: use a PLAIN function (not jest.fn) - jest.config resets all mocks
  // between tests (`resetMocks: true`) which would strip its implementation,
  // leaving process.cwd() returning undefined for the rest of the suite.
  const originalCwd = process.cwd;
  global.originalCwd = originalCwd;
  process.cwd = () => tempDir;
});

afterAll(async () => {
  // Restore original process.cwd
  if (global.originalCwd) {
    process.cwd = global.originalCwd;
  }

  // Clean up this suite's private temp directory
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir);
  }
});

// Cleanup after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();

  // Clean up this suite's temp contents but keep the directory
  if (fs.existsSync(tempDir)) {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      await fs.remove(path.join(tempDir, file));
    }
  }

  // Clear Logger instances
  try {
    const { Logger } = require('../lib/utils/logger');
    Logger.clearInstances();
  } catch (e) {
    // Logger module might not be loaded yet
  }

  // Clear PathCache
  try {
    const utils = require('../lib/utils');
    if (utils.clearPathCache) {
      utils.clearPathCache();
    }
  } catch (e) {
    // Utils module might not be loaded yet
  }
});

// Export original console for tests that need unmocked console
global.originalConsole = originalConsole;
