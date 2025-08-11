const path = require("path");

const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");
const prismaPath = path.join(process.cwd(), "prisma", "scheme");

module.exports = { basePath, modulesPath, sharedPath, prismaPath };
