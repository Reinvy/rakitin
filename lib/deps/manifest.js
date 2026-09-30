/**
 * lib/deps/manifest.js - Single registry mapping generator kinds to the
 * dependencies their OUTPUT requires, plus a one-shot installer.
 *
 * Generators declare needs here so installs happen exactly once, with the
 * project's package manager, honoring `--no-install` and `--dry-run`.
 * A kind that is missing from the registry is a hard error (it used to be
 * a silent log line, which is how dangling imports shipped).
 */

const installer = require("../installer");
const { isDryRun } = require("../safety");

/** Generator kind -> extra npm packages required by its output. */
const KIND_DEPENDENCIES = {
  // Module layer (per ORM)
  "module:none": [],
  "module:prisma": ["@prisma/client", "prisma", "dotenv"],
  "module:sequelize": ["sequelize", "mysql2"],
  "module:mongoose": ["mongoose"],
  "module:typeorm": ["typeorm", "reflect-metadata"],

  // Middleware
  "middleware:auth": ["jsonwebtoken"],
  "middleware:custom": [],
  "middleware:logger": [],
  "middleware:error": [],
  "middleware:request-time": [],

  // Validation
  "validation:joi": ["joi"],

  // Docs
  "docs:openapi-json": [],
  "docs:openapi-yaml": [],
  "docs:swagger-ui": ["swagger-ui-express", "swagger-jsdoc"],

  // Util (per kind)
  "util:any": ["dotenv"],
  "util:custom": [],
  "util:uuid": ["uuid"],
  "util:date": ["dayjs"],
  "util:env": ["dotenv"],
  "util:file": [],
  "util:crypto": [],
  "util:string": [],
  "util:number": [],
  "util:array": [],
  "util:object": [],
  "util:url": [],
  "util:color": [],
  "util:math": [],
  "util:validation": [],
  "util:regex": [],
  "util:time": [],

  // Config (per kind)
  "config:any": ["dotenv"],
  "config:app": ["dotenv"],
  "config:database": ["dotenv"],
  "config:jwt": ["dotenv"],
  "config:cors": ["dotenv"],
  "config:logger": ["dotenv"],
  "config:mailer": ["dotenv"],
  "config:cloud": ["dotenv"],
  "config:payment": ["dotenv"],
  "config:redis": ["dotenv"],
  "config:socket": ["dotenv"],
  "config:env": ["dotenv"],
  "config:custom": ["dotenv"],

  // API families
  "graphql:core": ["graphql", "graphql-http"],
  "websocket:ws": ["ws"],
  "test:dev": ["jest@^29", "supertest"],

  // Recipes
  "recipe:auth": ["jsonwebtoken", "joi", "bcryptjs"],
};

/** Kinds whose packages belong in devDependencies. */
const DEV_KINDS = new Set(["test:dev"]);

const ORM_KINDS = {
  Prisma: "module:prisma",
  Sequelize: "module:sequelize",
  Mongoose: "module:mongoose",
  TypeORM: "module:typeorm",
  None: "module:none",
};

/**
 * Resolve generator kinds into unique package lists, split by save target.
 * @param {string[]} kinds
 * @param {object} [extraKinds] Additional `kind -> packages` entries, e.g.
 *   contributed by plugins.
 * @returns {{packages: string[], devPackages: string[], unknownKinds: string[]}}
 */
function resolvePackagesForKinds(kinds = [], extraKinds = {}) {
  const registry = { ...KIND_DEPENDENCIES, ...extraKinds };
  const unknownKinds = [];
  const packages = new Set();
  const devPackages = new Set();

  for (const kind of kinds) {
    const deps = registry[kind];
    if (!deps) {
      unknownKinds.push(kind);
      continue;
    }
    const bucket = DEV_KINDS.has(kind) ? devPackages : packages;
    deps.forEach((dep) => bucket.add(dep));
  }

  return { packages: [...packages], devPackages: [...devPackages], unknownKinds };
}

/**
 * Install every package the given kinds require - exactly once.
 * @param {string[]} kinds
 * @param {{pm?: string, install?: boolean, dev?: boolean, silent?: boolean,
 *   extraKinds?: object, root?: string}} [options]
 * @returns {Promise<{success: boolean, installed: string[], skipped: string[], failed: string[]}>}
 */
async function ensureDependencies(kinds = [], options = {}) {
  const {
    pm,
    install = true,
    dev = false,
    silent = false,
    extraKinds = {},
    root = process.cwd(),
  } = options;

  const { packages, devPackages, unknownKinds } = resolvePackagesForKinds(kinds, extraKinds);

  if (unknownKinds.length) {
    throw new Error(`Kind dependency tidak dikenal: "${unknownKinds[0]}"`);
  }

  const allPackages = [...packages, ...devPackages];
  if (!allPackages.length) {
    return { success: true, installed: [], skipped: [], failed: [] };
  }

  if (!install || isDryRun()) {
    return { success: true, installed: [], skipped: allPackages, failed: [] };
  }

  const packageManager = pm || installer.getPackageManager(root);
  const aggregate = { success: true, installed: [], skipped: [], failed: [] };

  const groups = [
    { pkgs: packages, isDev: dev },
    { pkgs: devPackages, isDev: true },
  ].filter((group) => group.pkgs.length > 0);

  for (const group of groups) {
    const result = await installer.installIfNeeded(group.pkgs, {
      isDev: group.isDev,
      silent,
      packageManager,
      root,
    });
    aggregate.success = aggregate.success && result.success;
    aggregate.installed.push(...result.installed);
    aggregate.skipped.push(...result.skipped);
    aggregate.failed.push(...result.failed);
  }

  return aggregate;
}

/**
 * Map an ORM display name / flag value to its kind.
 * @param {string} orm
 * @returns {string}
 */
function ormToKind(orm) {
  if (!orm) return "module:none";
  const key = orm.toLowerCase();
  if (key === "typeorm") return "module:typeorm";
  if (key === "none" || key === "no-orm") return "module:none";
  const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
  const kind = ORM_KINDS[capitalized];
  if (!kind) {
    throw new Error(`ORM tidak dikenal: "${orm}"`);
  }
  return kind;
}

module.exports = {
  KIND_DEPENDENCIES,
  DEV_KINDS,
  ORM_KINDS,
  resolvePackagesForKinds,
  ensureDependencies,
  ormToKind,
};
