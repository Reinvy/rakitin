/**
 * Mongoose module integration: schema + model export. Package installs are
 * declared in `lib/deps/manifest.js` - this generator never shells out.
 */

const path = require("path");
const { getPaths } = require("../../../constants");
const { writeFileIfNotExistsSafe, mergeEnvExample, writeOutcome } = require("../../../safety");
const { getModuleVariants, toSafeFileName } = require("../../../naming");
const { moduleIdentifiers } = require("../../shared/identifiers");
const { relativePosix } = require("../../../utils");

const MONGODB_URI = 'MONGODB_URI="mongodb://localhost:27017/rakitin_db"';

const DB_SINGLETON = `// MongoDB / Mongoose connection singleton
const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/rakitin_db";

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    return mongoose.connection;
  } catch (error) {
    throw new Error(\`Gagal terhubung ke MongoDB: \${error.message}\`, { cause: error });
  }
}

module.exports = { connectDB, mongoose };
`;

/**
 * Ensure `app/shared/config/db.js` (the Mongoose connection singleton).
 * @param {string} [root]
 */
function ensureMongooseDbConfig(root = process.cwd()) {
  const dbPath = path.join(getPaths(root).sharedPath, "config", "db.js");
  const result = writeFileIfNotExistsSafe(dbPath, DB_SINGLETON);
  return { ...result, path: dbPath };
}

/**
 * Declare MONGODB_URI in `.env.example` (idempotent).
 * @param {string} [root]
 */
function ensureMongoEnv(root = process.cwd()) {
  const result = mergeEnvExample(root, "MONGOOSE", MONGODB_URI);
  return { written: result.written, skipped: result.skipped, path: result.path };
}

/**
 * Generate the Mongoose model for a module.
 * @param {string} moduleName
 * @param {"Simple"|"Modular"} [architecture]
 * @returns {Promise<{created: string[], skipped: string[]}>}
 */
async function mongooseORM(moduleName, architecture = "Modular") {
  if (!moduleName) throw new Error("Nama modul harus didefinisikan");

  const root = process.cwd();
  const { kebab } = getModuleVariants(moduleName);
  const { camelName, pascalName, tableName } = moduleIdentifiers(moduleName);
  const fileName = `${toSafeFileName(kebab)}.model.js`;
  const modulePath = path.join(getPaths(root).modulesPath, kebab);
  const modelPath =
    architecture === "Simple"
      ? path.join(modulePath, fileName)
      : path.join(modulePath, "models", fileName);

  const model = `// ${pascalName} Model (Mongoose)
const mongoose = require("mongoose");
const { Schema } = mongoose;

const ${pascalName}Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "${tableName}",
  }
);

const ${camelName}Model = mongoose.model("${pascalName}", ${pascalName}Schema);

module.exports = ${camelName}Model;
`;

  const bucket = { created: [], skipped: [] };
  const record = (result) => bucket[writeOutcome(result)].push(relativePosix(root, result.path));

  record({ ...writeFileIfNotExistsSafe(modelPath, model), path: modelPath });
  record(ensureMongooseDbConfig(root));
  record(ensureMongoEnv(root));

  return bucket;
}

module.exports = { mongooseORM, ensureMongoEnv, ensureMongooseDbConfig };
