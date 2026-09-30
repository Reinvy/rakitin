/**
 * Manual mock for the `child_process` core module.
 *
 * `tests/setup.js` calls `jest.mock("child_process")` for every suite so a
 * test can never silently shell out (real `npm install`, `npx
 * express-generator`, …). Shell execution is only legal through the
 * injectable seams in `lib/installer.js` (`internals.execCommand`,
 * `internals.spawn`), which suites stub explicitly.
 *
 * Suites that genuinely need the real module (the E2E suite spawns the CLI
 * binary on purpose) opt in with a single global before requiring anything:
 *
 *   global.__RAKITIN_REAL_CHILD_PROCESS__ = true;
 *
 * The flag is read lazily at call time, so ordering does not matter.
 */

const actual = jest.requireActual("child_process");

function guard(name) {
  return function guarded(...args) {
    if (global.__RAKITIN_REAL_CHILD_PROCESS__) {
      return actual[name](...args);
    }
    throw new Error(
      `[hermetic] child_process.${name} diblokir di test; ` +
        "stub installer.internals.execCommand/spawn atau set " +
        "global.__RAKITIN_REAL_CHILD_PROCESS__ = true"
    );
  };
}

module.exports = {
  ...actual,
  exec: guard("exec"),
  execSync: guard("execSync"),
  spawn: guard("spawn"),
  spawnSync: guard("spawnSync"),
};
