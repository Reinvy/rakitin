const prisma = require("./prisma.orm");
const sequelize = require("./sequelize.orm");

module.exports = {
  ...prisma,
  ...sequelize,
};
