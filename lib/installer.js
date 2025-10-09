const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { createErrorMessage, handleError } = require("./generator/shared/validation-utils");

/**
 * Memeriksa apakah package sudah terinstall dalam proyek
 * @param {string} packageName - Nama package yang akan diperiksa
 * @returns {boolean} - True jika package sudah terinstall, false jika belum
 */
function isPackageInstalled(packageName) {
  try {
    // Pertama, cek di node_modules
    const nodeModulesPath = path.join(process.cwd(), "node_modules", packageName);
    if (fs.existsSync(nodeModulesPath)) {
      return true;
    }

    // Cek di package.json dependencies
    const packageJsonPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      return !!(
        (packageJson.dependencies && packageJson.dependencies[packageName]) ||
        (packageJson.devDependencies && packageJson.devDependencies[packageName])
      );
    }
    
    return false;
  } catch (error) {
    console.error(`Kesalahan saat memeriksa package ${packageName}:`, error.message);
    return false;
  }
}

/**
 * Menginstall package jika belum terinstall
 * @param {string[]} packageNames - Daftar nama package yang akan diinstall
 * @param {boolean} isDev - Apakah package akan diinstall sebagai dev dependency
 * @param {boolean} silent - Mode tanpa output console
 * @returns {Object} - { success: boolean, installed: string[], failed: string[] }
 */
function installIfNeeded(packageNames = [], isDev = false, silent = false) {
  const result = {
    success: true,
    installed: [],
    failed: []
  };

  if (!Array.isArray(packageNames) || packageNames.length === 0) {
    if (!silent) console.log("⚠️ Tidak ada package yang akan diinstall.");
    return result;
  }

  // Filter package yang belum terinstall
  const packagesToInstall = packageNames.filter(pkg => !isPackageInstalled(pkg));
  
  if (packagesToInstall.length === 0) {
    if (!silent) console.log("✅ Semua package sudah terinstall.");
    return result;
  }

  // Install package yang belum terinstall dalam satu perintah
  try {
    const packagesList = packagesToInstall.join(" ");
    const installCommand = isDev
      ? `npm install --save-dev ${packagesList}`
      : `npm install ${packagesList}`;
    
    if (!silent) {
      console.log(`📦 Menginstall ${packagesToInstall.length} package: ${packagesList}`);
    }
    
    execSync(installCommand, { stdio: silent ? "pipe" : "inherit" });
    
    result.installed = packagesToInstall;
    if (!silent) {
      console.log(`🎉 Berhasil menginstall ${packagesToInstall.length} package`);
    }
  } catch (error) {
    result.success = false;
    result.failed = packagesToInstall;
    
    const errorMessage = createErrorMessage("system", `menginstall package: ${error.message}`);
    if (!silent) {
      console.error(errorMessage);
    }
  }

  return result;
}

/**
 * Menginstall package berdasarkan tipe ORM yang dipilih
 * @param {string} orm - Jenis ORM yang dipilih
 * @param {boolean} silent - Mode tanpa output console
 * @returns {Object} - { success: boolean, installed: string[], failed: string[] }
 */
function installOrmPackages(orm, silent = false) {
  const ormPackages = {
    "Prisma": ["@prisma/client", "prisma"],
    "Sequelize": ["sequelize", "mysql2"],
    "Mongoose": ["mongoose"],
    "TypeORM": ["typeorm", "reflect-metadata"]
  };
  
  if (!orm || !ormPackages[orm]) {
    if (!silent) console.log(`⚠️ ORM "${orm}" tidak dikenal. Tidak ada package yang diinstall.`);
    return { success: true, installed: [], failed: [] };
  }
  
  return installIfNeeded(ormPackages[orm], false, silent);
}

module.exports = {
  installIfNeeded,
  isPackageInstalled,
  installOrmPackages
};
