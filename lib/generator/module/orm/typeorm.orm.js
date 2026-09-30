/**
 * TypeORM module integration: entity definition + the DataSource singleton
 * the generated service imports. Package installs are declared in
 * `lib/deps/manifest.js` - this generator never shells out.
 */

const path = require("path");
const { getPaths } = require("../../../constants");
const { writeFileIfNotExistsSafe, mergeEnvExample, writeOutcome } = require("../../../safety");
const { getModuleVariants, toSafeFileName } = require("../../../naming");
const { moduleIdentifiers } = require("../../shared/identifiers");
const { relativePosix } = require("../../../utils");

const DATA_SOURCE = `// TypeORM Data Source singleton
const { DataSource } = require("typeorm");

const AppDataSource = new DataSource({
  type: process.env.DB_TYPE || "mysql",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "rakitin_db",
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.NODE_ENV === "development",
  entities: ["app/modules/**/*.entity.js"],
});

module.exports = { AppDataSource };
`;

const ENV_SECTION = `DB_TYPE=mysql
DB_NAME=rakitin_db
DB_USER=root
DB_PASSWORD=
DB_HOST=localhost
DB_PORT=3306`;

/**
 * @param {string} [root]
 * @returns {{written: boolean, skipped: "exists"|null, path: string}}
 */
function ensureDataSourceFile(root = process.cwd()) {
  const dataSourcePath = path.join(getPaths(root).sharedPath, "config", "data-source.js");
  const result = writeFileIfNotExistsSafe(dataSourcePath, DATA_SOURCE);
  return { ...result, path: dataSourcePath };
}

/**
 * @param {string} [root]
 */
function ensureTypeormEnv(root = process.cwd()) {
  const result = mergeEnvExample(root, "TYPEORM", ENV_SECTION);
  return { written: result.written, skipped: result.skipped, path: result.path };
}

/**
 * Generate the TypeORM entity for a module.
 * @param {string} moduleName
 * @param {"Simple"|"Modular"} [architecture]
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
async function typeormORM(moduleName, architecture = "Modular") {
  if (!moduleName) throw new Error("Nama modul harus didefinisikan");

  const root = process.cwd();
  const { kebab } = getModuleVariants(moduleName);
  const { pascalName, tableName } = moduleIdentifiers(moduleName);
  const fileName = `${toSafeFileName(kebab)}.entity.js`;
  const modulePath = path.join(getPaths(root).modulesPath, kebab);
  const entityPath =
    architecture === "Simple"
      ? path.join(modulePath, fileName)
      : path.join(modulePath, "entities", fileName);

  const entity = `// ${pascalName} Entity (TypeORM)
const { EntitySchema } = require("typeorm");

const ${pascalName} = new EntitySchema({
  name: "${pascalName}",
  tableName: "${tableName}",
  columns: {
    id: {
      primary: true,
      type: "int",
      generated: true,
    },
    name: {
      type: "varchar",
      length: 255,
      nullable: false,
    },
    createdAt: {
      type: "timestamp",
      createDate: true,
    },
    updatedAt: {
      type: "timestamp",
      updateDate: true,
    },
  },
});

module.exports = ${pascalName};
`;

  const bucket = { created: [], skipped: [] };
  const record = (result) => bucket[writeOutcome(result)].push(relativePosix(root, result.path));

  record({ ...writeFileIfNotExistsSafe(entityPath, entity), path: entityPath });
  record(ensureDataSourceFile(root));
  record(ensureTypeormEnv(root));

  return bucket;
}

module.exports = { typeormORM, ensureDataSourceFile, ensureTypeormEnv };
