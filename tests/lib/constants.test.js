/**
 * lib/constants.js - lazy path getters + the `getPaths(root)` snapshot.
 *
 * The module must never capture cwd at require time: every getter resolves
 * against `process.cwd()` when it is READ.
 */

const path = require("path");
const constants = require("../../lib/constants");

const REMOVED_GETTERS = [
  "typeormEntitiesPath",
  "mongooseModelsPath",
  "rootRoutesPath",
  "validatorsPath",
];

describe("lib/constants", () => {
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd;
  });

  afterEach(() => {
    process.cwd = originalCwd;
  });

  describe("getPaths(root)", () => {
    test("returns exactly the seven v3 keys for an explicit root", () => {
      const root = path.join(global.tempDir, "proj");

      const paths = constants.getPaths(root);

      expect(Object.keys(paths).sort()).toEqual([
        "appRoutesPath",
        "basePath",
        "docsPath",
        "modulesPath",
        "prismaPath",
        "root",
        "sharedPath",
      ]);
      expect(paths).toEqual({
        root,
        basePath: path.join(root, "app"),
        modulesPath: path.join(root, "app", "modules"),
        sharedPath: path.join(root, "app", "shared"),
        appRoutesPath: path.join(root, "app", "routes"),
        docsPath: path.join(root, "app", "docs"),
        prismaPath: path.join(root, "prisma", "schema"),
      });
    });

    test("defaults the root to process.cwd()", () => {
      expect(constants.getPaths()).toEqual(constants.getPaths(process.cwd()));
    });

    test("the removed path getters are gone", () => {
      for (const key of REMOVED_GETTERS) {
        expect(key in constants.getPaths()).toBe(false);
        expect(constants[key]).toBeUndefined();
      }
    });
  });

  describe("lazy getters", () => {
    test("resolve against process.cwd() at access time", () => {
      const root = path.join(global.tempDir, "lazy-root");
      process.cwd = () => root;

      expect(constants.basePath).toBe(path.join(root, "app"));
      expect(constants.modulesPath).toBe(path.join(root, "app", "modules"));
      expect(constants.sharedPath).toBe(path.join(root, "app", "shared"));
      expect(constants.appRoutesPath).toBe(path.join(root, "app", "routes"));
      expect(constants.docsPath).toBe(path.join(root, "app", "docs"));
      expect(constants.prismaPath).toBe(path.join(root, "prisma", "schema"));
    });

    test("re-resolve after cwd changes (nothing is captured at require time)", () => {
      const first = path.join(global.tempDir, "first");
      const second = path.join(global.tempDir, "second");

      process.cwd = () => first;
      expect(constants.appRoutesPath).toBe(path.join(first, "app", "routes"));

      process.cwd = () => second;
      expect(constants.appRoutesPath).toBe(path.join(second, "app", "routes"));
    });
  });
});
