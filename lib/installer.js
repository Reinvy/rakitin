const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function isPackageInstalled(packageName) {
  try {
    const packagePath = require.resolve(
      path.join(packageName, "package.json"),
      { paths: [process.cwd()] }
    );
    return fs.existsSync(packagePath);
  } catch {
    return false;
  }
}

function installIfNeeded(packageNames = []) {
  for (const pkg of packageNames) {
    if (isPackageInstalled(pkg)) {
      console.log(`✅ '${pkg}' sudah terinstall.`);
    } else {
      console.log(`📦 Menginstall '${pkg}'...`);
      try {
        execSync(`npm install ${pkg}`, { stdio: "inherit" });
        console.log(`🎉 Berhasil install '${pkg}'`);
      } catch (e) {
        console.error(`❌ Gagal install '${pkg}':`, e.message);
      }
    }
  }
}

module.exports = {
  installIfNeeded,
  isPackageInstalled,
};
