const path = require("path");

const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");
const prismaPath = path.join(process.cwd(), "prisma", "models");
const typeormEntitiesPath = path.join(basePath, "modules");
const mongooseModelsPath = path.join(basePath, "modules");

// Router paths
const appRoutesPath = path.join(basePath, "routes");
// Note: rootRoutesPath is kept for backward compatibility but will not be used in router generator
const rootRoutesPath = path.join(process.cwd(), "routes");

// Router templates
const modularRouterTemplate = `const express = require("express");
const router = express.Router();
const { getAll } = require("../controllers/{moduleName}.controller");

router.get("/", getAll);

module.exports = router;`;

const simpleRouterTemplate = `const express = require("express");
const router = express.Router();
const { getAll } = require("./{moduleName}.controller");

router.get("/", getAll);

module.exports = router;`;

const mainRouterTemplate = `const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { normalizeModuleName } = require('../../utils');

// Fungsi untuk mendeteksi modul secara otomatis
function detectModules() {
  const modulesDir = path.join(__dirname, '..', 'modules');
  const modules = [];
  
  if (fs.existsSync(modulesDir)) {
    const items = fs.readdirSync(modulesDir);
    for (const item of items) {
      const itemPath = path.join(modulesDir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        modules.push(item);
      }
    }
  }
  
  return modules;
}

// Fungsi untuk mendeteksi arsitektur modul
function detectModuleArchitecture(moduleName) {
  const normalizedModule = normalizeModuleName(moduleName);
  const modularRouterPath = path.join(__dirname, '..', 'modules', normalizedModule, 'routes', \`\${normalizedModule}.router.js\`);
  const simpleControllerPath = path.join(__dirname, '..', 'modules', normalizedModule, \`\${normalizedModule}.controller.js\`);
  
  if (fs.existsSync(modularRouterPath)) {
    return 'modular';
  } else if (fs.existsSync(simpleControllerPath)) {
    return 'simple';
  }
  
  return null; // Modul tidak memiliki struktur yang valid
}

// Deteksi semua modul yang tersedia
const availableModules = detectModules();

// Import router modular untuk setiap modul
const modularModules = [];
availableModules.forEach(moduleName => {
  const normalizedModule = normalizeModuleName(moduleName);
  const moduleArchitecture = detectModuleArchitecture(moduleName);
  
  if (moduleArchitecture === 'modular') {
    try {
      const moduleRouter = require(\`../modules/\${normalizedModule}/routes/\${normalizedModule}.router.js\`);
      router.use(\`/\${normalizedModule}\`, moduleRouter);
      modularModules.push(moduleName);
      console.log(\`✅ Modular router for \${moduleName} loaded automatically\`);
    } catch (error) {
      console.error(\`❌ Failed to load modular router for \${moduleName}:\`, error.message);
    }
  }
});

// Import controller simple untuk setiap modul
const simpleModules = [];
availableModules.forEach(moduleName => {
  const normalizedModule = normalizeModuleName(moduleName);
  const moduleArchitecture = detectModuleArchitecture(moduleName);
  
  if (moduleArchitecture === 'simple') {
    try {
      const moduleController = require(\`../modules/\${normalizedModule}/\${normalizedModule}.controller.js\`);
      simpleModules.push({ name: moduleName, controller: moduleController });
      console.log(\`✅ Controller for \${moduleName} loaded automatically\`);
    } catch (error) {
      console.error(\`❌ Failed to load controller for \${moduleName}:\`, error.message);
    }
  }
});

// Buat route untuk controller simple
simpleModules.forEach(({ name, controller }) => {
  const normalizedModule = normalizeModuleName(name);
  
  if (controller.getAll) {
    router.get(\`/\${normalizedModule}\`, controller.getAll);
  }
  if (controller.getById) {
    router.get(\`/\${normalizedModule}/:id\`, controller.getById);
  }
  if (controller.create) {
    router.post(\`/\${normalizedModule}\`, controller.create);
  }
  if (controller.update) {
    router.put(\`/\${normalizedModule}/:id\`, controller.update);
  }
  if (controller.delete) {
    router.delete(\`/\${normalizedModule}/:id\`, controller.delete);
  }
  
  console.log(\`✅ Routes for \${name} created automatically\`);
});

// Log hasil
if (modularModules.length > 0) {
  console.log(\`✅ Automatically loaded \${modularModules.length} modular modules\`);
}
if (simpleModules.length > 0) {
  console.log(\`✅ Automatically created routes for \${simpleModules.length} simple modules\`);
}
if (modularModules.length === 0 && simpleModules.length === 0) {
  console.log('⚠️  No modules found. New modules will be automatically loaded when added.');
}

module.exports = router;`;

const appJsTemplate = `const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Router integration
const routes = require('./app/routes');
app.use('/api', routes);

module.exports = app;`;

// Middleware templates
const authMiddlewareTemplate = `// Authentication Middleware
const authMiddleware = (req, res, next) => {
  // Implement authentication logic here
  // For example: check JWT token, session, etc.
  
  // If authentication fails
  // return res.status(401).json({ message: 'Unauthorized' });
  
  // If authentication succeeds
  next();
};

module.exports = authMiddleware;`;

const authorizationMiddlewareTemplate = `// Authorization Middleware
const authorizationMiddleware = (req, res, next) => {
  // Implement authorization logic here
  // For example: check user permissions, roles, etc.
  
  // If authorization fails
  // return res.status(403).json({ message: 'Forbidden' });
  
  // If authorization succeeds
  next();
};

module.exports = authorizationMiddleware;`;

const loggingMiddlewareTemplate = `// Logging Middleware
const loggingMiddleware = (req, res, next) => {
  const start = Date.now();
  
  console.log(\`\${new Date().toISOString()} - \${req.method} \${req.originalUrl}\`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(\`\${new Date().toISOString()} - \${req.method} \${req.originalUrl} - \${res.statusCode} [\${duration}ms]\`);
  });
  
  next();
};

module.exports = loggingMiddleware;`;

const rateLimitMiddlewareTemplate = `// Rate Limiting Middleware
const rateLimit = require('express-rate-limit');

const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later.'
  }
});

module.exports = rateLimitMiddleware;`;

const corsMiddlewareTemplate = `// CORS Middleware
const cors = require('cors');

const corsMiddleware = cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

module.exports = corsMiddleware;`;

const bodyParserMiddlewareTemplate = `// Body Parser Middleware
const bodyParser = require('body-parser');

// Parse JSON bodies
const jsonParser = bodyParser.json();

// Parse URL-encoded bodies
const urlencodedParser = bodyParser.urlencoded({ extended: true });

module.exports = {
  jsonParser,
  urlencodedParser
};`;

module.exports = {
  basePath,
  modulesPath,
  sharedPath,
  prismaPath,
  typeormEntitiesPath,
  mongooseModelsPath,
  appRoutesPath,
  rootRoutesPath,
  modularRouterTemplate,
  simpleRouterTemplate,
  mainRouterTemplate,
  appJsTemplate,
  authMiddlewareTemplate,
  authorizationMiddlewareTemplate,
  loggingMiddlewareTemplate,
  rateLimitMiddlewareTemplate,
  corsMiddlewareTemplate,
  bodyParserMiddlewareTemplate
};
