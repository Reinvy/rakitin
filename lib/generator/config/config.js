const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { sharedPath } = require("../../constants");
const { toKebabCase } = require("../../utils");

async function generateConfig() {
  const { configType } = await inquirer.default.prompt([
    {
      type: "list",
      name: "configType",
      message: "Pilih jenis config yang ingin dibuat:",
      choices: [
        { name: "Custom", value: "custom" },
        { name: "Aplikasi (app)", value: "app" },
        { name: "Database", value: "database" },
        { name: "JWT", value: "jwt" },
        { name: "CORS", value: "cors" },
        { name: "Logger", value: "logger" },
      ],
    },
  ]);

  let rawName = configType;
  let content = "";

  if (configType === "custom") {
    const { customName } = await inquirer.default.prompt([
      {
        type: "input",
        name: "customName",
        message: "Nama config custom (contoh: mailer):",
      },
    ]);
    rawName = customName;
    content = `// Config: ${customName}
require("dotenv").config();

module.exports = {
  // Tambahkan konfigurasi Anda di sini
  // Contoh:
  // service: process.env.MAIL_SERVICE,
  // user: process.env.MAIL_USER,
  // pass: process.env.MAIL_PASS,
};`;
  } else {
    content = getDefaultConfigContent(configType);
  }

  const kebabName = toKebabCase(rawName);
  const fileName = `${kebabName}.config.js`;
  const configDir = path.join(sharedPath, "config");

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log("📁 Folder 'config' berhasil dibuat.");
  }

  const filePath = path.join(configDir, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content.trimStart(), "utf8");
    console.log(`✅ Config '${fileName}' berhasil dibuat!`);
  } else {
    console.log(`⚠️  File '${fileName}' sudah ada. Tidak ada yang ditimpa.`);
  }
}

function getDefaultConfigContent(type) {
  const map = {
    app: `// Config: App
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || "development",
};
`,

    database: `// Config: Database
require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    dialect: "postgres", // atau mysql, sqlite, mssql
  },
  test: {
    // Tambahkan konfigurasi untuk testing
  },
  production: {
    // Tambahkan konfigurasi untuk production
  },
};
`,

    jwt: `// Config: JWT
require("dotenv").config();

module.exports = {
  secret: process.env.JWT_SECRET || "your-secret-key",
  expiresIn: process.env.JWT_EXPIRES_IN || "1h",
};
`,

    cors: `// Config: CORS
module.exports = {
  origin: process.env.CORS_ORIGIN || "*", // Sebaiknya lebih spesifik di production
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};
`,

    logger: `// Config: Logger
module.exports = {
  level: process.env.LOG_LEVEL || "info", // 'error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly'
  format: "combined", // 'combined', 'common', 'dev', 'short', 'tiny'
};
`,
  };

  return map[type] || `// Config '${type}' belum tersedia.\n`;
}

module.exports = generateConfig;
