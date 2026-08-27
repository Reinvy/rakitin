const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getPaths } = require("../../../constants");

/** Resolve lazily so cwd overrides are honored. */
function modulesPath() {
  return getPaths().modulesPath;
}
const {
  ensureDir,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
} = require("../../../utils");
const { handleError } = require("../../shared/validation-utils");

/**
 * Membuat file model Mongoose untuk modul yang dipilih
 * @param {string} moduleName - Nama modul yang akan dibuat model Mongoose-nya
 * @param {string} architecture - Jenis arsitektur (Simple atau Modular)
 */
async function mongooseORM(moduleName, architecture) {
  try {
    if (!moduleName) {
      throw new Error("Nama modul harus didefinisikan");
    }

    if (!architecture) {
      throw new Error("Arsitektur harus didefinisikan");
    }

    const kebabName = toKebabCase(moduleName);
    const pascalName = toPascalCase(moduleName);
    const camelName = toCamelCase(moduleName);
    const collectionName = toSnakeCase(moduleName) + "s";

    let modelPath;
    let relativeDbPath;

    if (architecture === "Modular") {
      modelPath = path.join(modulesPath(), kebabName, "models", `${kebabName}.model.js`);
      relativeDbPath = "../../../../shared/database"; // -> app/shared/database
    } else {
      // Simple
      modelPath = path.join(modulesPath(), kebabName, `${kebabName}.model.js`);
      relativeDbPath = "../../../shared/database"; // -> app/shared/database
    }

    // Ensure directory exists
    ensureDir(path.dirname(modelPath));

    const boilerplate = `// ${pascalName} Model (Mongoose)
const mongoose = require('${relativeDbPath}');
const { Schema } = mongoose;

const ${pascalName}Schema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  // Tambahkan field lain di sini
}, {
  timestamps: true, // Otomatis membuat createdAt dan updatedAt
  collection: '${collectionName}'
});

const ${camelName}Model = mongoose.model('${pascalName}', ${pascalName}Schema);

module.exports = ${camelName}Model;
`;

    fs.writeFileSync(modelPath, boilerplate.trimStart(), "utf8");
    console.log(
      `✅ Model Mongoose '${path.basename(
        modelPath
      )}' berhasil dibuat di '${path.dirname(modelPath)}'.`
    );

    // Check if Mongoose is installed, if not install it
    await checkAndInstallMongoose();
  } catch (error) {
    handleError("pembuatan model Mongoose", error);
  }
}

/**
 * Memeriksa apakah Mongoose sudah terinstall
 * @returns {boolean} - True jika Mongoose sudah terinstall, false jika belum
 */
function isMongooseInstalled() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return !!(packageJson.dependencies && packageJson.dependencies.mongoose);
  } catch (error) {
    console.error("Kesalahan saat memeriksa instalasi Mongoose:", error.message);
    return false;
  }
}

/**
 * Memeriksa dan menginstall Mongoose jika belum terinstall
 */
async function checkAndInstallMongoose() {
  try {
    if (isMongooseInstalled()) {
      console.log("✅ Mongoose sudah terinstal.");
      return;
    }

    console.log("⚠️ Mongoose belum terinstal. Menginstal Mongoose...");

    try {
      execSync("npm install mongoose", { stdio: "inherit" });
      console.log("🎉 Mongoose berhasil diinstal!");
    } catch (error) {
      throw new Error(`Gagal menginstal Mongoose: ${error.message}`);
    }
  } catch (error) {
    handleError("instalasi Mongoose", error);
  }
}

module.exports = { mongooseORM };
