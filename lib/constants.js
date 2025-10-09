const path = require("path");

const basePath = path.join(process.cwd(), "app");
const modulesPath = path.join(basePath, "modules");
const sharedPath = path.join(basePath, "shared");
const prismaPath = path.join(process.cwd(), "prisma", "models");
const typeormEntitiesPath = path.join(basePath, "modules");
const mongooseModelsPath = path.join(basePath, "modules");

// Router paths
const appRoutesPath = path.join(basePath, "routes");
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

// Module imports will be added here

// Module routes will be added here

module.exports = router;`;

const appJsTemplate = `const express = require('express');
const app = express();

// Middleware
app.use(express.json());

// Router integration
const routes = require('./routes');
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
