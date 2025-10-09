const prisma = require("./prisma.orm");
const sequelize = require("./sequelize.orm");
const mongoose = require("./mongoose.orm");
const typeorm = require("./typeorm.orm");

module.exports = {
  ...prisma,
  ...sequelize,
  ...mongoose,
  ...typeorm,
};
