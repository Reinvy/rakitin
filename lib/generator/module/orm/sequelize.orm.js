const fs = require("fs");
const path = require("path");
const { modulesPath } = require("../../../constants");
const { toKebabCase, toPascalCase, toSnakeCase } = require("../../../utils");

async function sequelizeORM(moduleName, architecture) {
  const kebabName = toKebabCase(moduleName);
  const pascalName = toPascalCase(moduleName);
  const tableName = toSnakeCase(moduleName) + "s";
  const modulePath = path.join(modulesPath, kebabName);

  let modelPath;
  let relativeDbPath;

  if (architecture === "Modular") {
    modelPath = path.join(modulePath, "models", `${kebabName}.model.js`);
    relativeDbPath = "../../../../shared/database"; // -> app/shared/database
  } else {
    // Simple
    modelPath = path.join(modulePath, `${kebabName}.model.js`);
    relativeDbPath = "../../../shared/database"; // -> app/shared/database
  }

  const boilerplate = `// ${pascalName} Model (Sequelize)
const { DataTypes } = require('sequelize');
const sequelize = require('${relativeDbPath}'); // Sesuaikan path jika perlu, contoh: require('../../../shared/config/database')

const ${pascalName} = sequelize.define('${pascalName}', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Tambahkan atribut lain di sini
}, {
  tableName: '${tableName}',
  timestamps: true, // Otomatis membuat createdAt dan updatedAt
});

module.exports = ${pascalName};
`;

  fs.writeFileSync(modelPath, boilerplate.trimStart(), "utf8");
  console.log(
    `✅ Model Sequelize '${path.basename(
      modelPath
    )}' berhasil dibuat di '${path.dirname(modelPath)}'.`
  );
}

module.exports = { sequelizeORM };
