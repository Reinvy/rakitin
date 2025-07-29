const fs = require("fs");
const { modulesPath, sharedPath, basePath } = require("./constants");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeFileIfNotExists(filePath, content) {
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, content);
}

function ensureBaseStructure() {
  [modulesPath, sharedPath].forEach(ensureDir);
  ["middlewares", "config", "utils", "interfaces"].forEach((sub) =>
    ensureDir(`${sharedPath}/${sub}`)
  );
  writeFileIfNotExists(`${basePath}/app.js`, `// Express app init`);
  writeFileIfNotExists(`${basePath}/server.js`, `// App entry point`);
}

function toPascalCase(str) {
  return str
    .replace(/(^|_|-)(\w)/g, (_, __, c) => c.toUpperCase())
    .replace(/\W/g, "");
}

function toKebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

module.exports = {
  ensureDir,
  writeFileIfNotExists,
  ensureBaseStructure,
  toPascalCase,
  toKebabCase,
};
