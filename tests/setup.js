// Global setup for Jest tests.
//
// Two guarantees this file enforces:
//   1. Each test SUITE gets its own temp dir inside the OS tmpdir and
//      process.cwd() points at it - nothing is written into the repo.
//   2. The repo itself must be byte-identical before/after a suite:
//      package.json / package-lock.json are hashed and compared.

const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const crypto = require("crypto");

// Every suite is hermetic: real child processes are blocked unless a suite
// explicitly opts in (tests/e2e spawns the CLI binary on purpose).
jest.mock("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const GUARDED_REPO_FILES = ["package.json", "package-lock.json"];

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rakitin-test-"));
global.tempDir = tempDir;

// Store original console for tests that need it
const originalConsole = { ...console };

function hashFile(filePath) {
  if (!fs.existsSync(filePath)) return "missing";
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function snapshotRepoFiles() {
  const snapshot = {};
  for (const name of GUARDED_REPO_FILES) {
    snapshot[name] = hashFile(path.join(REPO_ROOT, name));
  }
  return snapshot;
}

let repoSnapshotBefore = null;

beforeAll(async () => {
  await fs.ensureDir(tempDir);

  repoSnapshotBefore = snapshotRepoFiles();

  // Store original cwd for cleanup.
  // NOTE: use a PLAIN function (not jest.fn) - jest.config clears mock call
  // history between tests which would strip its implementation and leave
  // process.cwd() returning undefined for the rest of the suite.
  const originalCwd = process.cwd;
  global.originalCwd = originalCwd;
  process.cwd = () => tempDir;
});

afterAll(async () => {
  // Repo integrity: a suite that mutated the repository is a failure, not a
  // side effect to clean up afterwards.
  if (repoSnapshotBefore) {
    const after = snapshotRepoFiles();
    const mutated = GUARDED_REPO_FILES.filter(
      (name) => after[name] !== repoSnapshotBefore[name]
    );
    if (mutated.length) {
      throw new Error(
        `[hermetic] test run memodifikasi ${mutated.join(", ")}; ` +
          "tests must never write into the repository"
      );
    }
  }

  // Restore original process.cwd
  if (global.originalCwd) {
    process.cwd = global.originalCwd;
  }

  // Clean up this suite's private temp directory
  if (fs.existsSync(tempDir)) {
    await fs.remove(tempDir);
  }
});

beforeEach(async () => {
  try {
    const installer = require("../lib/installer");
    const stub = () =>
      jest.fn().mockResolvedValue({ success: true, stdout: "", stderr: "", code: 0 });
    installer.internals.execCommand = stub();
    installer.internals.spawn = stub();
  } catch (_) {
    // ignore: suite may load before the installer exists
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
    const { Logger } = require("../lib/utils/logger");
    Logger.clearInstances();
  } catch (e) {
    // Logger module might not be loaded yet
  }
});

// Export original console for tests that need unmocked console
global.originalConsole = originalConsole;
