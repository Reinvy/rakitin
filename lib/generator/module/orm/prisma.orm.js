const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { prismaPath } = require("../../../constants");
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
} = require("../../../utils");
const { handleError } = require("../../../shared/validation-utils");

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
    const filePath = path.join(prismaPath, `${kebabName}.prisma`);

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
    ensureDir(prismaPath);
    writeFileIfNotExists(filePath, boilerplate);
    
    console.log(`✅ Model Prisma untuk ${modelName} berhasil dibuat di ${filePath}`);
  } catch (error) {
    handleError("pembuatan model Prisma", error);
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
