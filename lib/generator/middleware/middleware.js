const fs = require("fs");
const path = require("path");
const inquirer = require("inquirer");
const { getPaths } = require("../../constants");

/** Resolve paths lazily at call time so cwd overrides are honored. */
function sharedPath() {
  return getPaths().sharedPath;
}
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

  let customName;
  if (middlewareType === "custom") {
    ({ customName } = await inquirer.default.prompt([
      {
        type: "input",
        name: "customName",
        message: "Nama middleware custom:",
      },
    ]));
  }

  return createMiddleware(middlewareType, customName);
}

/**
 * Non-interactive core used by both prompts and headless `rakitin add
 * middleware <kind>`. Returns a summary for the command layer.
 */
async function createMiddleware(type, customName) {
  let rawName = type;
  let content = "";

  if (type === "custom") {
    rawName = customName || type;
    content = `// Middleware: ${rawName}
module.exports = (req, res, next) => {
  // Tambahkan logika middleware di sini
  next();
};`;
  } else {
    content = getDefaultMiddlewareContent(type);
  }

  const kebabName = toKebabCase(rawName);
  const fileName = `${kebabName}.middleware.js`;
  const middlewareDir = path.join(sharedPath(), "middlewares");

  fs.mkdirSync(middlewareDir, { recursive: true });

  const filePath = path.join(middlewareDir, fileName);
  if (fs.existsSync(filePath)) {
    console.log("⚠️  File sudah ada. Tidak ada yang ditimpa.");
    return { created: false, skipped: [filePath] };
  }

  fs.writeFileSync(filePath, content.trimStart(), "utf8");
  console.log(`✅ Middleware '${fileName}' berhasil dibuat!`);
  return { created: true, createdFiles: [filePath], kind: type };
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
module.exports.createMiddleware = createMiddleware;
module.exports.getDefaultMiddlewareContent = getDefaultMiddlewareContent;
