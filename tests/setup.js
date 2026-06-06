// Global setup for Jest tests
const fs = require('fs-extra');
const path = require('path');

// Store original console for tests that need it
const originalConsole = { ...console };

// Create a temporary directory for test files
const tempDir = path.join(__dirname, 'temp');
global.tempDir = tempDir;

// Setup before all tests
beforeAll(async () => {
  // Ensure temp directory exists
  await fs.ensureDir(tempDir);

  // Mock process.cwd to return temp directory for file operations
  const originalCwd = process.cwd;
  process.cwd = jest.fn(() => tempDir);

  // Store original cwd for cleanup
  global.originalCwd = originalCwd;
});

// Cleanup after all tests
afterAll(async () => {
  // Restore original process.cwd
  if (global.originalCwd) {
    process.cwd = global.originalCwd;
  }

  // Clean up temp directory
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir);
  }
});

// Cleanup after each test
afterEach(async () => {
  // Clear all mocks
  jest.clearAllMocks();

  // Clean up temp directory contents but keep the directory
  if (fs.existsSync(tempDir)) {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      await fs.remove(path.join(tempDir, file));
    }
  }

  // Clear Logger instances
  try {
    const { Logger } = require('../../lib/utils/logger');
    Logger.clearInstances();
  } catch (e) {
    // Logger module might not be loaded yet
  }

  // Clear PathCache
  try {
    const utils = require('../../lib/utils');
    if (utils.clearPathCache) {
      utils.clearPathCache();
    }
  } catch (e) {
    // Utils module might not be loaded yet
  }
});

// Export original console for tests that need unmocked console
global.originalConsole = originalConsole;