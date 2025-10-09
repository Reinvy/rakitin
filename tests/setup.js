// Global setup for Jest tests
const fs = require('fs-extra');
const path = require('path');

// Mock console.log to reduce noise during tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

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
});