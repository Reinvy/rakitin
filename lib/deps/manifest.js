/**
 * lib/deps/manifest.js - Single registry mapping generator kinds to the
 * dependencies their OUTPUT requires, plus a one-shot installer.
 *
 * Previously each generator shelled out its own `npm install ...` (or
 * worse, shipped code whose imports were never installed). Generators
 * now declare needs here so installs happen exactly once with the
 * project's detected package manager.
 */

const logger = require("../utils/logger");
const installer = require("../installer");

/** Generator kind -> extra npm packages required by its output. */
const KIND_DEPENDENCIES = {
  // Arsitektur dasar: Express-only, no extras (Basic tier!)
  "module:none": [],
  "module:prisma": ["@prisma/client", "prisma"],
  "module:sequelize": ["sequelize", "mysql2"],
  "module:mongoose": ["mongoose"],
  "module:typeorm": ["typeorm", "reflect-metadata"],

  "middleware:auth": ["jsonwebtoken"],
  "middleware:logger": [],
  "middleware:error": [],
  "middleware:request-time": [],
  "middleware:custom": [],

  "util:any": [],

  "validation:joi": ["joi"],

  "recipe:auth": ["jsonwebtoken", "joi", "bcryptjs"],

  "docs:openapi-json": [],
  "docs:openapi-yaml": ["yaml"],
  "docs:swagger-ui": ["swagger-ui-express", "swagger-jsdoc"],
};

const ORM_KINDS = {
  Prisma: "module:prisma",
  Sequelize: "module:sequelize",
  Mongoose: "module:mongoose",
  TypeORM: "module:typeorm",
  None: "module:none",
};

/**
 * Resolve a list of generator kinds into a unique package install plan.
 * @param {string[]} kinds e.g. ['middleware:auth', 'validation:joi']
 * @returns {{packages: string[], unknownKinds: string[]}}
 */
function resolvePackagesForKinds(kinds = []) {
  const unknown = [];
  const set = new Set();
  for (const kind of kinds) {
    const deps = KIND_DEPENDENCIES[kind];
    if (!deps) {
      unknown.push(kind);
      continue;
    }
    deps.forEach((d) => set.add(d));
  }
  return { packages: [...set], unknownKinds: unknown };
}

/**
 * Install whatever declared packages are still missing, ONCE.
 * @param {string[]} kinds
 * @param {{silent?: boolean, pm?: string}} [options]
 */
async function ensureDependencies(kinds = [], options = {}) {
  const { silent = false, pm } = options;
  const { packages, unknownKinds } = resolvePackagesForKinds(kinds);

  if (unknownKinds.length && !silent) {
    logger.warn(`Unknown dependency kinds ignored: ${unknownKinds.join(", ")}`);
  }
  if (!packages.length) {
    if (!silent) logger.success("Tidak ada dependency tambahan yang dibutuhkan.");
    return { success: true, installed: [], failed: [] };
  }

  return installer.installIfNeeded(packages, {
    packageManager: pm || installer.getPackageManager(),
  });
}

/**
 * Map an ORM display name to its kind string (convenience bridge).
 */
function ormToKind(orm) {
  if (!orm) return "module:none";
  const normalized =
    orm.toLowerCase() === "typeorm"
      ? "TypeORM"
      : orm.toLowerCase() === "none"
        ? "None"
        : orm.charAt(0).toUpperCase() + orm.slice(1).toLowerCase();
  return ORM_KINDS[normalized] || ORM_KINDS[orm] || "module:none";
}

module.exports = {
  KIND_DEPENDENCIES,
  ORM_KINDS,
  resolvePackagesForKinds,
  ensureDependencies,
  ormToKind,
};
