const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getPaths } = require("../../../constants");

/** Resolve lazily so cwd overrides are honored. */
function prismaPath() { return getPaths().prismaPath; }
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} = require("../../../utils");
const { handleError } = require("../../shared/validation-utils");

/**
 * Membuat file model Prisma untuk modul yang dipilih
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
    const filePath = path.join(prismaPath(), `${kebabName}.prisma`);

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
    ensureDir(prismaPath());
    writeFileIfNotExists(filePath, boilerplate);
    ensurePrismaDbConfig();
    appendModelToSchema(boilerplate, modelName);

    console.log(`✅ Model Prisma untuk ${modelName} berhasil dibuat di ${filePath}`);
  } catch (error) {
    handleError("pembuatan model Prisma", error);
  }
}

/**
 * Append the model to prisma/schema.prisma so it is actually picked up by
 * the Prisma CLI. Stock Prisma only reads schema.prisma - writing model
 * files elsewhere leaves them inert. Idempotent via a rakitin marker.
 */
function appendModelToSchema(boilerplate, modelName) {
  const marker = `// rakitin:model:${modelName}`;
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

  try {
    if (!fs.existsSync(schemaPath)) {
      console.warn(
        `⚠️  prisma/schema.prisma tidak ditemukan - model hanya tersimpan di prisma/models/. Jalankan 'npx prisma init' lalu jalankan generator ulang.`
      );
      return;
    }

    const existing = fs.readFileSync(schemaPath, "utf8");
    if (existing.includes(marker)) {
      return; // already appended by a previous run
    }

    fs.writeFileSync(
      schemaPath,
      `${existing.trimEnd()}\n\n${marker}\n${boilerplate}\n`,
      "utf8"
    );
    console.log(`✅ Model ${modelName} ditambahkan ke prisma/schema.prisma`);
  } catch (error) {
    console.warn(`⚠️  Gagal memperbarui prisma/schema.prisma: ${error.message}`);
  }
}

/**
 * Ensure app/shared/config/db.js exists - the singleton the generated
 * services import. Previously services referenced this file but nothing
 * ever created it.
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
 * Memeriksa apakah Prisma sudah terinisialisasi
 * @returns {boolean} - True jika Prisma sudah terinisialisasi, false jika belum
 */
function isPrismaInitialized() {
  const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");
  return fs.existsSync(schemaPath);
}

/**
 * Memperbarui package.json dengan konfigurasi Prisma schema
 */
function updatePackageJsonWithPrismaSchema() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      console.error("❌ Tidak menemukan package.json.");
      return;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    if (!packageJson.prisma) {
      packageJson.prisma = {
        schema: "./prisma/schema.prisma",
      };
    } else if (!packageJson.prisma.schema) {
      packageJson.prisma.schema = "./prisma/schema.prisma";
    }

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2),
      "utf-8"
    );

    console.log(
      "📝 Properti 'prisma.schema' berhasil ditambahkan ke package.json."
    );
  } catch (error) {
    console.error("❌ Gagal memperbarui package.json:", error.message);
  }
}

/**
 * Memeriksa dan menginisialisasi Prisma jika belum terinisialisasi
 */
async function checkAndInitPrisma() {
  try {
    if (isPrismaInitialized()) {
      console.log("✅ Prisma sudah terinisialisasi.");
      updatePackageJsonWithPrismaSchema();
      return;
    }

    console.log(
      "⚠️ Prisma belum terinisialisasi. Menjalankan 'npx prisma init'..."
    );

    try {
      execSync("npm install prisma @prisma/client", { stdio: "inherit" });
      execSync("npx prisma init", { stdio: "inherit" });
      console.log("🎉 Prisma berhasil diinisialisasi!");
      updatePackageJsonWithPrismaSchema();
    } catch (error) {
      throw new Error(`Gagal inisialisasi Prisma: ${error.message}`);
    }
  } catch (error) {
    handleError("inisialisasi Prisma", error);
  }
}

module.exports = { prismaORM };
