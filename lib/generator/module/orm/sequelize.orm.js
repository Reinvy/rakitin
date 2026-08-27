const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getPaths } = require("../../../constants");

/** Resolve lazily so cwd overrides are honored. */
function modulesPath() { return getPaths().modulesPath; }
const {
  ensureDir,
  toKebabCase,
  toPascalCase,
  toSnakeCase
} = require("../../../utils");
const { handleError } = require("../../shared/validation-utils");

/**
 * Membuat file model Sequelize untuk modul yang dipilih
 * @param {string} moduleName - Nama modul yang akan dibuat model Sequelize-nya
 * @param {string} architecture - Jenis arsitektur (Simple atau Modular)
 */
async function sequelizeORM(moduleName, architecture) {
  try {
    if (!moduleName) {
      throw new Error("Nama modul harus didefinisikan");
    }
    
    if (!architecture) {
      throw new Error("Arsitektur harus didefinisikan");
    }

    const kebabName = toKebabCase(moduleName);
    const pascalName = toPascalCase(moduleName);
    const tableName = toSnakeCase(moduleName) + "s";
    const modulePath = path.join(modulesPath(), kebabName);

    let modelPath;
    let relativeDbPath;

    if (architecture === "Modular") {
      modelPath = path.join(modulePath, "models", `${kebabName}.model.js`);
      relativeDbPath = "../../../../shared/database"; // -> app/shared/database
      ensureDir(path.dirname(modelPath));
    } else {
      // Simple
      modelPath = path.join(modulePath, `${kebabName}.model.js`);
      relativeDbPath = "../../../shared/database"; // -> app/shared/database
      ensureDir(path.dirname(modelPath));
    }

    const boilerplate = `// ${pascalName} Model (Sequelize)
const { DataTypes } = require('sequelize');
const sequelize = require('${relativeDbPath}'); // Sesuaikan path jika perlu, contoh: require('../../../shared/config/database')

const ${pascalName} = sequelize.define('${pascalName}', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Tambahkan atribut lain di sini
}, {
  tableName: '${tableName}',
  timestamps: true, // Otomatis membuat createdAt dan updatedAt
});

module.exports = ${pascalName};
`;

    fs.writeFileSync(modelPath, boilerplate.trimStart(), "utf8");
    console.log(
      `✅ Model Sequelize '${path.basename(
        modelPath
      )}' berhasil dibuat di '${path.dirname(modelPath)}'.`
    );

    // Check if Sequelize is installed, if not install it
    await checkAndInstallSequelize();
  } catch (error) {
    handleError("pembuatan model Sequelize", error);
  }
}

/**
 * Memeriksa apakah Sequelize sudah terinstall
 * @returns {boolean} - True jika Sequelize sudah terinstall, false jika belum
 */
function isSequelizeInstalled() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    
    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return !!(packageJson.dependencies && packageJson.dependencies.sequelize);
  } catch (error) {
    console.error("Kesalahan saat memeriksa instalasi Sequelize:", error.message);
    return false;
  }
}

/**
 * Memeriksa dan menginstall Sequelize jika belum terinstall
 */
async function checkAndInstallSequelize() {
  try {
    if (isSequelizeInstalled()) {
      console.log("✅ Sequelize sudah terinstal.");
      return;
    }

    console.log("⚠️ Sequelize belum terinstal. Menginstal Sequelize...");

    try {
      execSync("npm install sequelize", { stdio: "inherit" });
      
      // Install database driver based on user's database
      // For now, we'll install mysql2 as a default
      execSync("npm install mysql2", { stdio: "inherit" });
      
      console.log("🎉 Sequelize berhasil diinstal!");
    } catch (error) {
      throw new Error(`Gagal menginstal Sequelize: ${error.message}`);
    }
  } catch (error) {
    handleError("instalasi Sequelize", error);
  }
}

module.exports = { sequelizeORM };
