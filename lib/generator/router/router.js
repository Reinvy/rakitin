async function integrateRouter() {
  const modules = fs
    .readdirSync(basePath)
    .filter((f) => fs.statSync(path.join(basePath, f)).isDirectory());

  const appRouterPath = path.join(__dirname, "routes", "index.js");
  let content = `const express = require('express');\nconst router = express.Router();\n`;

  modules.forEach((m) => {
    content += `const ${m}Router = require('../app/module/${m}/${m}-router');\n`;
  });
  modules.forEach((m) => {
    content += `router.use('/${m}', ${m}Router);\n`;
  });
  content += `\nmodule.exports = router;\n`;

  fs.writeFileSync(appRouterPath, content, "utf8");
  console.log("✅ Semua module router berhasil diintegrasikan ulang!");
}

module.exports = { integrateRouter };
