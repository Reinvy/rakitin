const path = require("path");
const { modulesPath } = require("../../../constants");
const {
  ensureDir,
  writeFileIfNotExists,
  toKebabCase,
} = require("../../../utils");

async function modularArch(moduleName) {
  const kebabName = toKebabCase(moduleName);
  const modulePath = path.join(modulesPath, kebabName);

  const dirs = ["controllers", "services", "models", "routes"];
  dirs.forEach((dir) => ensureDir(path.join(modulePath, dir)));

  writeFileIfNotExists(
    path.join(modulePath, "controllers", `${kebabName}.controller.js`),
    `// ${moduleName} Controller
exports.example = (req, res) => {
  res.send("Hello from ${moduleName} controller");
};`
  );

  writeFileIfNotExists(
    path.join(modulePath, "services", `${kebabName}.service.js`),
    `// ${moduleName} Service
exports.getData = () => {
  return "Data from ${moduleName} service";
};`
  );

  writeFileIfNotExists(
    path.join(modulePath, "models", `${kebabName}.model.js`),
    `// ${moduleName} Model
// Schema atau ORM Model bisa ditulis di sini.`
  );

  writeFileIfNotExists(
    path.join(modulePath, "routes", `${kebabName}.routes.js`),
    `// ${moduleName} Routes
const express = require("express");
const router = express.Router();
const { example } = require("../controllers/${kebabName}.controller");

router.get("/", example);

module.exports = router;`
  );
}

module.exports = { modularArch };
