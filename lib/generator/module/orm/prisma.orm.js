const fs = require("fs");
const path = require("path");
const { getPaths } = require("../../../constants");

/** Resolve lazily so cwd overrides are honored. */
function prismaPath() {
  return getPaths().prismaPath;
}
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} = require("../../../utils");
const { handleError } = require("../../shared/validation-utils");

/**
 * Membuat file model Prisma untuk modul yang dipilih (Prisma 7 Multi-File Schema Folder)
 * @param {string} moduleName - Nama modul yang akan dibuat model Prisma-nya
 */
async function prismaORM(moduleName) {
  try {
    if (!moduleName) {
      throw new Error("Nama modul harus didefinisikan");
    }

    const kebabName = toKebabCase(moduleName);
    const modelName = toPascalCase(moduleName); // misalnya 'user-profile' jadi 'UserProfile'
    const tableName = toSnakeCase(moduleName) + "s";
    const schemaDir = prismaPath();
    const filePath = path.join(schemaDir, `${kebabName}.prisma`);

    // Template untuk model Prisma
    const boilerplate = `// ${modelName} model

model ${modelName} {
  id        Int      @id @default(autoincrement())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("${tableName}") // Map nama tabel ke nama model
}
`;

    await checkAndInitPrisma();
    ensurePrismaBaseSchema();
    ensureDir(schemaDir);
    writeFileIfNotExists(filePath, boilerplate);
    ensurePrismaDbConfig();

    console.log(`✅ Model Prisma '${kebabName}.prisma' berhasil dibuat di '${schemaDir}'.`);
  } catch (error) {
    handleError("pembuatan model Prisma", error);
  }
}

/**
 * Memastikan file base.prisma ada di folder prisma/schema/ untuk konfigurasi datasource & generator
 */
function ensurePrismaBaseSchema() {
  const schemaDir = prismaPath();
  const baseSchemaPath = path.join(schemaDir, "base.prisma");
  const legacySchemaPath = path.join(schemaDir, "schema.prisma");

  if (fs.existsSync(baseSchemaPath) || fs.existsSync(legacySchemaPath)) {
    return;
  }

  ensureDir(schemaDir);
  const baseBoilerplate = `// Base Prisma Configuration
// Datasource and Generator for Prisma 7 Multi-File Schema

datasource db {
  provider = "postgresql" // ganti dengan provider database Anda (mysql, postgresql, sqlite, sqlserver)
}

generator client {
  provider = "prisma-client-js"
}
`;

  writeFileIfNotExists(baseSchemaPath, baseBoilerplate);
}

/**
 * Ensure app/shared/config/db.js exists - the singleton the generated
 * services import.
 */
function ensurePrismaDbConfig() {
  const sharedPath = path.join(process.cwd(), "app", "shared");
  const dbConfigPath = path.join(sharedPath, "config", "db.js");

  ensureDir(path.join(sharedPath, "config"));
  const written = writeFileIfNotExists(
    dbConfigPath,
    `// Prisma client singleton
// Reuse ONE client instance across the whole application.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
});

module.exports = { prisma };
`
  );

  if (written) {
    console.log(`✅ Prisma client singleton dibuat di ${dbConfigPath}`);
  }
}

/**
 * Memastikan file prisma.config.js ada di root project (Prisma 7 Configuration)
 */
function ensurePrismaConfigFile() {
  const root = process.cwd();
  const tsConfigPath = path.join(root, "prisma.config.ts");
  const jsConfigPath = path.join(root, "prisma.config.js");
  const ts7ConfigPath = path.join(root, "prisma7.config.ts");
  const js7ConfigPath = path.join(root, "prisma7.config.js");

  if (
    fs.existsSync(tsConfigPath) ||
    fs.existsSync(jsConfigPath) ||
    fs.existsSync(ts7ConfigPath) ||
    fs.existsSync(js7ConfigPath)
  ) {
    return;
  }

  const configContent = `// Prisma 7 Configuration
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

  writeFileIfNotExists(jsConfigPath, configContent);
  console.log("✅ File prisma.config.js berhasil dibuat di root project.");
}

/**
 * Memeriksa apakah Prisma sudah terinisialisasi
 * @returns {boolean} - True jika Prisma sudah terinisialisasi, false jika belum
 */
function isPrismaInitialized() {
  const root = process.cwd();
  const schemaDir = prismaPath();
  const baseSchemaPath = path.join(schemaDir, "base.prisma");
  const schemaPath = path.join(schemaDir, "schema.prisma");
  const rootSchemaPath = path.join(root, "prisma", "schema.prisma");
  const hasConfigFile =
    fs.existsSync(path.join(root, "prisma.config.js")) ||
    fs.existsSync(path.join(root, "prisma.config.ts")) ||
    fs.existsSync(path.join(root, "prisma7.config.ts")) ||
    fs.existsSync(path.join(root, "prisma7.config.js"));

  return (
    hasConfigFile ||
    fs.existsSync(baseSchemaPath) ||
    fs.existsSync(schemaPath) ||
    fs.existsSync(rootSchemaPath) ||
    (fs.existsSync(schemaDir) && fs.readdirSync(schemaDir).some((f) => f.endsWith(".prisma")))
  );
}

/**
 * Memperbarui package.json dengan konfigurasi Prisma schema folder
 */
function updatePackageJsonWithPrismaSchema() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    if (!packageJson.prisma) {
      packageJson.prisma = {
        schema: "./prisma/schema",
      };
    } else {
      packageJson.prisma.schema = "./prisma/schema";
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf-8");

    console.log("📝 Properti 'prisma.schema' berhasil disesuaikan ke './prisma/schema' di package.json.");
  } catch (error) {
    console.error("❌ Gagal memperbarui package.json:", error.message);
  }
}

/**
 * Memeriksa apakah Prisma sudah terpasang di dependencies
 */
function isPrismaInstalled() {
  try {
    const { isPackageInstalled } = require("../../../installer");
    return isPackageInstalled("@prisma/client") && isPackageInstalled("prisma");
  } catch {
    return false;
  }
}

/**
 * Memastikan DATABASE_URL ada di file .env.example
 */
function ensureEnvDatabaseUrl() {
  try {
    const envExamplePath = path.join(process.cwd(), ".env.example");
    const defaultUrl = 'DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"';

    if (fs.existsSync(envExamplePath)) {
      const content = fs.readFileSync(envExamplePath, "utf8");
      if (!content.includes("DATABASE_URL")) {
        fs.writeFileSync(
          envExamplePath,
          `${content.trimEnd()}\n\n# Prisma Database URL\n${defaultUrl}\n`,
          "utf8"
        );
      }
    } else {
      fs.writeFileSync(envExamplePath, `# Prisma Database URL\n${defaultUrl}\n`, "utf8");
    }
  } catch {
    // Non-fatal
  }
}

/**
 * Memeriksa dan menginisialisasi Prisma jika belum terinisialisasi
 */
async function checkAndInitPrisma() {
  try {
    const initialized = isPrismaInitialized();

    if (!initialized) {
      console.log("⚠️  Prisma belum terinisialisasi. Menjalankan inisialisasi Prisma 7...");
      ensurePrismaBaseSchema();
      ensurePrismaConfigFile();
      ensureEnvDatabaseUrl();
      updatePackageJsonWithPrismaSchema();
      console.log("🎉 Prisma 7 berhasil diinisialisasi!");
    } else {
      ensurePrismaBaseSchema();
      ensurePrismaConfigFile();
      updatePackageJsonWithPrismaSchema();
    }

    if (!isPrismaInstalled()) {
      const { ensureDependencies } = require("../../../deps/manifest");
      await ensureDependencies(["module:prisma"], {
        silent: !process.stdout.isTTY,
      });
    }
  } catch (error) {
    handleError("inisialisasi Prisma", error);
  }
}

module.exports = {
  prismaORM,
  ensurePrismaBaseSchema,
  ensurePrismaDbConfig,
  ensurePrismaConfigFile,
  ensureEnvDatabaseUrl,
  updatePackageJsonWithPrismaSchema,
  isPrismaInitialized,
  isPrismaInstalled,
  checkAndInitPrisma,
};
