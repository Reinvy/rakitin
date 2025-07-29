const path = require("path");

const basePath = path.join(__dirname, "../..", "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");

module.exports = { basePath, modulesPath, sharedPath };
