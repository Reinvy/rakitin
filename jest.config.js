module.exports = {
  testEnvironment: "node",
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  collectCoverageFrom: [
    "lib/**/*.js",
    "bin/**/*.js",
    "index.js",
    "!lib/generator/**/index.js",
    "!**/node_modules/**",
    "!coverage/**",
    "!jest.config.js"
  ],
  testMatch: [
    "**/tests/**/*.test.js",
    "**/tests/**/*.spec.js"
  ],
  testPathIgnorePatterns: [
    "/node_modules/",
    "/coverage/"
  ],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  verbose: true,
  forceExit: true,
  // clearMocks only clears CALL HISTORY between tests; it does NOT wipe
  // mock IMPLEMENTATIONS. resetMocks:false is deliberate - resetting
  // implementations globally made factory-defined behavior vanish mid-suite
  // and produced order-dependent failures. Suites restore what they need.
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
};