const { execSync } = require("child_process");

function installIfNeeded(packageNames) {
  for (const pkg of packageNames) {
    try {
      require.resolve(pkg);
    } catch {
      console.log(`📦 Menginstall '${pkg}'...`);
      try {
        execSync(`npm install ${pkg}`, { stdio: "inherit" });
      } catch (e) {
        console.error(`❌ Gagal install '${pkg}':`, e.message);
      }
    }
  }
}

module.exports = {
  installIfNeeded,
};
