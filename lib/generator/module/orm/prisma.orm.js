/**
 * Prisma module integration (Prisma 7 multi-file schema folder).
 *
 * Writes `prisma/schema/<kebab>.prisma`, the base datasource/generator file,
 * `prisma.config.js`, the `app/shared/config/db.js` client singleton and the
 * `DATABASE_URL` entry in `.env.example`. Never installs anything: package
 * installs are declared in `lib/deps/manifest.js` and run once by the command.
 */

const fs = require("fs");
const path = require("path");
const { getPaths } = require("../../../constants");
const {
  writeFileIfNotExistsSafe,
  mergeEnvExample,
  writeOutcome,
} = require("../../../safety");
const { getModuleVariants, toSafeFileName } = require("../../../naming");
const { moduleIdentifiers } = require("../../shared/identifiers");
const { relativePosix } = require("../../../utils");

const PRISMA_CONFIG_CANDIDATES = [
  "prisma.config.ts",
  "prisma.config.js",
  "prisma7.config.ts",
  "prisma7.config.js",
];

const BASE_SCHEMA = `// Base Prisma Configuration
// Datasource and Generator for the Prisma multi-file schema folder.
// Prisma 7 reads the connection URL from prisma.config.js - not from here.

datasource db {
  provider = "postgresql" // ganti sesuai provider Anda (mysql, postgresql, sqlite, sqlserver)
}

generator client {
  provider = "prisma-client-js"
}
`;

const PRISMA_CONFIG = `// Prisma 7 configuration
require("dotenv").config();
const { defineConfig } = require("prisma/config");

module.exports = defineConfig({
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
`;

const DB_SINGLETON = `// Prisma client singleton
// Reuse ONE client instance across the whole application.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

module.exports = { prisma };
`;

const DATABASE_URL =
  'DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"';

/** @param {string} [root] */
function prismaSchemaDir(root = process.cwd()) {
  return getPaths(root).prismaPath;
}

/** @param {string} [root] */
function prismaConfigPath(root = process.cwd()) {
  return PRISMA_CONFIG_CANDIDATES.map((name) => path.join(root, name)).find((p) =>
    fs.existsSync(p)
  );
}

/**
 * @param {string} [root]
 * @returns {boolean}
 */
function isPrismaInitialized(root = process.cwd()) {
  if (prismaConfigPath(root)) return true;
  const schemaDir = prismaSchemaDir(root);
  if (fs.existsSync(path.join(schemaDir, "base.prisma"))) return true;
  if (fs.existsSync(path.join(root, "prisma", "schema.prisma"))) return true;
  if (fs.existsSync(schemaDir)) {
    return fs.readdirSync(schemaDir).some((f) => f.endsWith(".prisma"));
  }
  return false;
}

/** @param {string} root */
function ensurePrismaBaseSchema(root = process.cwd()) {
  const schemaDir = prismaSchemaDir(root);
  const baseSchemaPath = path.join(schemaDir, "base.prisma");
  if (fs.existsSync(baseSchemaPath)) {
    return { written: false, skipped: "exists", path: baseSchemaPath };
  }
  const result = writeFileIfNotExistsSafe(baseSchemaPath, BASE_SCHEMA);
  return { ...result, path: baseSchemaPath };
}

/** @param {string} root */
function ensurePrismaConfigFile(root = process.cwd()) {
  const existing = prismaConfigPath(root);
  if (existing) return { written: false, skipped: "exists", path: existing };
  const jsConfigPath = path.join(root, "prisma.config.js");
  const result = writeFileIfNotExistsSafe(jsConfigPath, PRISMA_CONFIG);
  return { ...result, path: jsConfigPath };
}

/** @param {string} root */
function ensurePrismaDbConfig(root = process.cwd()) {
  const dbConfigPath = path.join(getPaths(root).sharedPath, "config", "db.js");
  const result = writeFileIfNotExistsSafe(dbConfigPath, DB_SINGLETON);
  return { ...result, path: dbConfigPath };
}

/** @param {string} root */
function ensureEnvDatabaseUrl(root = process.cwd()) {
  const result = mergeEnvExample(root, "PRISMA", DATABASE_URL);
  return { written: result.written, skipped: result.skipped, path: result.path };
}

/**
 * Generate the Prisma model file for a module plus its supporting config.
 * @param {string} moduleName
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
async function prismaORM(moduleName) {
  if (!moduleName) throw new Error("Nama modul harus didefinisikan");

  const root = process.cwd();
  const { kebab } = getModuleVariants(moduleName);
  const { pascalName, tableName } = moduleIdentifiers(moduleName);
  if (!/^[A-Za-z]/.test(pascalName)) {
    throw new Error(
      `Nama module "${moduleName}" tidak didukung untuk ORM Prisma: nama model Prisma harus diawali huruf.`
    );
  }
  const schemaDir = prismaSchemaDir(root);
  const bucket = { created: [], skipped: [] };
  const record = (result) => bucket[writeOutcome(result)].push(relativePosix(root, result.path));

  const modelFile = path.join(schemaDir, `${toSafeFileName(kebab)}.prisma`);
  const model = `// ${pascalName} model

model ${pascalName} {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("${tableName}")
}
`;
  record({ ...writeFileIfNotExistsSafe(modelFile, model), path: modelFile });
  record(ensurePrismaBaseSchema(root));
  record(ensurePrismaConfigFile(root));
  record(ensurePrismaDbConfig(root));
  record(ensureEnvDatabaseUrl(root));

  return bucket;
}

module.exports = {
  prismaORM,
  isPrismaInitialized,
  ensurePrismaBaseSchema,
  ensurePrismaConfigFile,
  ensurePrismaDbConfig,
  ensureEnvDatabaseUrl,
};
