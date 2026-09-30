/**
 * lib/generator/middleware/middleware.js - Headless middleware generator.
 * Writes `app/shared/middlewares/<kebab>.middleware.js` through the safety
 * layer and reports project-root-relative paths.
 */

const path = require("path");
const { getPaths } = require("../../constants");
const { assertSafeName } = require("../../naming");
const { writeFileIfNotExistsSafe, writeOutcome } = require("../../safety");
const { relativePosix } = require("../../utils");

const MIDDLEWARE_KINDS = ["custom", "auth", "logger", "error", "request-time"];

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
};
`,

    logger: `// Middleware: logger
module.exports = (req, res, next) => {
  console.log(\`\${req.method} \${req.url}\`);
  next();
};
`,

    error: `// Middleware: error
module.exports = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};
`,

    "request-time": `// Middleware: request-time
module.exports = (req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const elapsed = Date.now() - start;
    console.log(\`\${req.method} \${req.url} - \${elapsed}ms\`);
  });
  next();
};
`,
  };

  return map[type] || null;
}

function customMiddlewareContent(name) {
  return `// Middleware: ${name}
module.exports = (req, res, next) => {
  // Tambahkan logika middleware di sini
  next();
};
`;
}

/**
 * @param {string} type One of MIDDLEWARE_KINDS.
 * @param {string} [customName] Required for `custom`.
 * @param {{root?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[], data: object}>}
 */
async function createMiddleware(type, customName, options = {}) {
  const kind = String(type || "custom").toLowerCase();
  const root = options.root || process.cwd();

  if (!MIDDLEWARE_KINDS.includes(kind)) {
    throw new Error(
      `Jenis middleware tidak dikenal: "${type}". Pilihan: ${MIDDLEWARE_KINDS.join(", ")}.`
    );
  }

  const name = kind === "custom" ? assertSafeName("middleware", customName || "custom") : kind;
  const content = kind === "custom" ? customMiddlewareContent(name) : getDefaultMiddlewareContent(kind);
  const filePath = path.join(
    getPaths(root).sharedPath,
    "middlewares",
    `${name}.middleware.js`
  );

  const result = writeFileIfNotExistsSafe(filePath, content);
  const bucket = { created: [], skipped: [] };
  bucket[writeOutcome(result)].push(relativePosix(root, filePath));

  return { ...bucket, data: { kind, name, path: relativePosix(root, filePath) } };
}

module.exports = {
  createMiddleware,
  getDefaultMiddlewareContent,
  MIDDLEWARE_KINDS,
};
