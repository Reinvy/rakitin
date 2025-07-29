const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { sharedPath } = require("../../constants");
const { toKebabCase } = require("../../utils");

async function generateMiddleware() {
  const { middlewareType } = await inquirer.default.prompt([
    {
      type: "list",
      name: "middlewareType",
      message: "Pilih jenis middleware:",
      choices: [
        { name: "Custom", value: "custom" },
        { name: "auth", value: "auth" },
        { name: "logger", value: "logger" },
        { name: "error", value: "error" },
        { name: "request-time", value: "request-time" },
      ],
    },
  ]);

  let rawName = middlewareType;
  let content = "";

  if (middlewareType === "custom") {
    const { customName } = await inquirer.default.prompt([
      {
        type: "input",
        name: "customName",
        message: "Nama middleware custom:",
      },
    ]);
    rawName = customName;
    content = `// Middleware: ${customName}
module.exports = (req, res, next) => {
  // Tambahkan logika middleware di sini
  next();
};`;
  } else {
    content = getDefaultMiddlewareContent(middlewareType);
  }

  const kebabName = toKebabCase(rawName);
  const fileName = `${kebabName}.middleware.js`;
  const middlewareDir = path.join(sharedPath, "middlewares");

  if (!fs.existsSync(middlewareDir)) {
    fs.mkdirSync(middlewareDir, { recursive: true });
    console.log("📁 Folder 'middlewares' berhasil dibuat.");
  }

  const filePath = path.join(middlewareDir, fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content.trimStart(), "utf8");
    console.log(`✅ Middleware '${fileName}' berhasil dibuat!`);
  } else {
    console.log("⚠️  File sudah ada. Tidak ada yang ditimpa.");
  }
}

function getDefaultMiddlewareContent(type) {
  const map = {
    auth: `// Middleware: auth
const jwt = require("jsonwebtoken");

const { JWT_SECRET } = process.env;

module.exports = (req, res, next) => {
  const rawToken = req.headers.authorization;
  const token = rawToken && rawToken.split(" ")[1];
  if (!token) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: err.message,
      });
    }

    req.credentials = decoded;
    next();
  });
};`,

    logger: `// Middleware: logger
module.exports = (req, res, next) => {
  console.log(\`\${req.method} \${req.url}\`);
  next();
};`,

    error: `// Middleware: error
module.exports = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};`,

    "request-time": `// Middleware: request-time
module.exports = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const elapsed = Date.now() - start;
    console.log(\`\${req.method} \${req.url} - \${elapsed}ms\`);
  });
  next();
};`,
  };

  return map[type] || `// Middleware '${type}' belum tersedia.`;
}

module.exports = generateMiddleware;
