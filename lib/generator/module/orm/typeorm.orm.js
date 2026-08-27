const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getPaths } = require("../../../constants");

/** Resolve lazily so cwd overrides are honored. */
function modulesPath() {
  return getPaths().modulesPath;
}
const {
  ensureDir,
  toKebabCase,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
} = require("../../../utils");
const { handleError } = require("../../shared/validation-utils");

/**
 * Membuat file entity TypeORM untuk modul yang dipilih
 * @param {string} moduleName - Nama modul yang akan dibuat entity TypeORM-nya
 * @param {string} architecture - Jenis arsitektur (Simple atau Modular)
 */
async function typeormORM(moduleName, architecture) {
  try {
    if (!moduleName) {
      throw new Error("Nama modul harus didefinisikan");
    }

    if (!architecture) {
      throw new Error("Arsitektur harus didefinisikan");
    }

    const kebabName = toKebabCase(moduleName);
    const pascalName = toPascalCase(moduleName);
    const tableName = toSnakeCase(moduleName) + "s";

    let entityPath;
    let relativeDataSourcePath;

    if (architecture === "Modular") {
      entityPath = path.join(
        modulesPath(),
        kebabName,
        "entities",
        `${kebabName}.entity.js`
      );
      relativeDataSourcePath = "../../../../shared/config/data-source"; // -> app/shared/config/data-source
    } else {
      // Simple
      entityPath = path.join(modulesPath(), kebabName, `${kebabName}.entity.js`);
      relativeDataSourcePath = "../../../shared/config/data-source"; // -> app/shared/config/data-source
    }

    // Ensure directory exists
    ensureDir(path.dirname(entityPath));

    const boilerplate = `// ${pascalName} Entity (TypeORM)
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

    fs.writeFileSync(entityPath, boilerplate.trimStart(), "utf8");
    console.log(
      `✅ Entity TypeORM '${path.basename(
        entityPath
      )}' berhasil dibuat di '${path.dirname(entityPath)}'.`
    );

    // Check if TypeORM is installed, if not install it
    await checkAndInstallTypeORM();

    // Create or update data source file if needed
    await ensureDataSourceFile();
  } catch (error) {
    handleError("pembuatan entity TypeORM", error);
  }
}

/**
 * Memeriksa apakah TypeORM sudah terinstall
 * @returns {boolean} - True jika TypeORM sudah terinstall, false jika belum
 */
function isTypeORMInstalled() {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      return false;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    return !!(
      packageJson.dependencies &&
      (packageJson.dependencies.typeorm || packageJson.dependencies["@nestjs/typeorm"])
    );
  } catch (error) {
    console.error("Kesalahan saat memeriksa instalasi TypeORM:", error.message);
    return false;
  }
}

/**
 * Memeriksa dan menginstall TypeORM jika belum terinstall
 */
async function checkAndInstallTypeORM() {
  try {
    if (isTypeORMInstalled()) {
      console.log("✅ TypeORM sudah terinstal.");
      return;
    }

    console.log("⚠️ TypeORM belum terinstal. Menginstal TypeORM...");

    try {
      execSync("npm install typeorm reflect-metadata", { stdio: "inherit" });
      console.log("🎉 TypeORM berhasil diinstal!");
    } catch (error) {
      throw new Error(`Gagal menginstal TypeORM: ${error.message}`);
    }
  } catch (error) {
    handleError("instalasi TypeORM", error);
  }
}

/**
 * Memastikan file data-source.js ada dan membuatnya jika belum ada
 */
async function ensureDataSourceFile() {
  try {
    const dataSourcePath = path.join(
      process.cwd(),
      "app",
      "shared",
      "config",
      "data-source.js"
    );

    if (fs.existsSync(dataSourcePath)) {
      console.log("✅ File data-source.js sudah ada.");
      return;
    }

    ensureDir(path.dirname(dataSourcePath));

    const dataSourceBoilerplate = `// TypeORM Data Source
const { DataSource } = require("typeorm");

const AppDataSource = new DataSource({
  type: "mysql", // Ganti dengan database yang digunakan (mysql, postgres, sqlite, dll)
  host: "localhost",
  port: 3306,
  username: "root",
  password: "",
  database: "test_db",
  synchronize: true,
  logging: false,
  entities: [
    "app/modules/**/*.entity.js" // Path ke entity files
  ],
  migrations: [],
  subscribers: [],
});

module.exports = { AppDataSource };
`;

    fs.writeFileSync(dataSourcePath, dataSourceBoilerplate.trimStart(), "utf8");
    console.log(
      `✅ File data-source.js berhasil dibuat di '${path.dirname(dataSourcePath)}'.`
    );
  } catch (error) {
    handleError("pembuatan file data-source", error);
  }
}

module.exports = { typeormORM };
