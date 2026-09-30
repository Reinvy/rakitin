/**
 * Sequelize module integration: model definition + the database connection
 * singleton the generated service imports. Package installs are declared in
 * `lib/deps/manifest.js` - this generator never shells out.
 */

const path = require("path");
const { getPaths } = require("../../../constants");
const { writeFileIfNotExistsSafe, writeOutcome } = require("../../../safety");
const { getModuleVariants, toSafeFileName } = require("../../../naming");
const { moduleIdentifiers } = require("../../shared/identifiers");
const { relativePosix } = require("../../../utils");

const DATABASE_SINGLETON = `// Sequelize Database Connection
const { Sequelize } = require("sequelize");

const sequelize = new Sequelize(
  process.env.DB_NAME || "rakitin_db",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    dialect: process.env.DB_DIALECT || "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
  }
);

module.exports = sequelize;
`;

/**
 * @param {string} [root]
 * @returns {{written: boolean, skipped: "exists"|null, path: string}}
 */
function ensureSequelizeDatabaseFile(root = process.cwd()) {
  const dbConfigPath = path.join(getPaths(root).sharedPath, "config", "database.js");
  const result = writeFileIfNotExistsSafe(dbConfigPath, DATABASE_SINGLETON);
  return { ...result, path: dbConfigPath };
}

/**
 * Generate the Sequelize model for a module.
 * @param {string} moduleName
 * @param {"Simple"|"Modular"} [architecture]
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
async function sequelizeORM(moduleName, architecture = "Modular") {
  if (!moduleName) throw new Error("Nama modul harus didefinisikan");

  const root = process.cwd();
  const { kebab } = getModuleVariants(moduleName);
  const { pascalName, tableName } = moduleIdentifiers(moduleName);
  const fileName = `${toSafeFileName(kebab)}.model.js`;
  const modulePath = path.join(getPaths(root).modulesPath, kebab);
  const modelPath =
    architecture === "Simple"
      ? path.join(modulePath, fileName)
      : path.join(modulePath, "models", fileName);

  const relativeDbPath =
    architecture === "Simple"
      ? "../../shared/config/database"
      : "../../../shared/config/database";

  const model = `// ${pascalName} Model (Sequelize)
const { DataTypes } = require("sequelize");
const sequelize = require("${relativeDbPath}");

const ${pascalName} = sequelize.define(
  "${pascalName}",
  {
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
  },
  {
    tableName: "${tableName}",
    timestamps: true,
  }
);

module.exports = ${pascalName};
`;

  const bucket = { created: [], skipped: [] };
  const record = (result) => bucket[writeOutcome(result)].push(relativePosix(root, result.path));

  record({ ...writeFileIfNotExistsSafe(modelPath, model), path: modelPath });
  record(ensureSequelizeDatabaseFile(root));

  return bucket;
}

module.exports = { sequelizeORM, ensureSequelizeDatabaseFile };
