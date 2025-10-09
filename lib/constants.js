const path = require("path");

const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");
const prismaPath = path.join(process.cwd(), "prisma", "models");
const typeormEntitiesPath = path.join(basePath, "modules");
const mongooseModelsPath = path.join(basePath, "modules");

module.exports = {
  basePath,
  modulesPath,
  sharedPath,
  prismaPath,
  typeormEntitiesPath,
  mongooseModelsPath
};
