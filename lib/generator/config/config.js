/**
 * lib/generator/config/config.js - Headless config generator.
 * Writes `app/shared/config/<kebab>.config.js` and merges the matching
 * `.env.example` section through the safety layer (idempotent markers).
 */

const path = require("path");
const { getPaths } = require("../../constants");
const { assertSafeName } = require("../../naming");
const {
  writeFileIfNotExistsSafe,
  mergeEnvExample,
  writeOutcome,
} = require("../../safety");
const { relativePosix } = require("../../utils");

const CONFIG_KINDS = [
  "app",
  "database",
  "jwt",
  "cors",
  "logger",
  "mailer",
  "cloud",
  "payment",
  "redis",
  "socket",
  "env",
  "custom",
];

const CONFIG_TEMPLATES = {
  app: `// Config: App
require("dotenv").config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || "development",
  name: process.env.APP_NAME || "Rakitin App",
  version: process.env.APP_VERSION || "1.0.0",
  apiPrefix: process.env.API_PREFIX || "/api",
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
    port: process.env.DB_PORT || 5432,
    dialect: process.env.DB_DIALECT || "postgres",
    logging: process.env.DB_LOGGING === "true",
  },
  test: {
    username: process.env.DB_TEST_USER || process.env.DB_USER,
    password: process.env.DB_TEST_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.DB_TEST_NAME || \`\${process.env.DB_NAME}_test\`,
    host: process.env.DB_TEST_HOST || process.env.DB_HOST,
    port: process.env.DB_TEST_PORT || process.env.DB_PORT || 5432,
    dialect: process.env.DB_TEST_DIALECT || process.env.DB_DIALECT || "postgres",
    logging: false,
  },
  production: {
    username: process.env.DB_PROD_USER,
    password: process.env.DB_PROD_PASSWORD,
    database: process.env.DB_PROD_NAME,
    host: process.env.DB_PROD_HOST,
    port: process.env.DB_PROD_PORT || 5432,
    dialect: process.env.DB_PROD_DIALECT || "postgres",
    logging: false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 0,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000,
    },
  },
};
`,
  jwt: `// Config: JWT
require("dotenv").config();

module.exports = {
  secret: process.env.JWT_SECRET || "your-secret-key-change-in-production",
  expiresIn: process.env.JWT_EXPIRES_IN || "1h",
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  algorithm: process.env.JWT_ALGORITHM || "HS256",
  issuer: process.env.JWT_ISSUER || "rakitin-app",
  audience: process.env.JWT_AUDIENCE || "rakitin-users",
};
`,
  cors: `// Config: CORS
module.exports = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : "*",
  methods: process.env.CORS_METHODS || "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: process.env.CORS_ALLOWED_HEADERS || "Content-Type,Authorization",
  credentials: process.env.CORS_CREDENTIALS === "true",
  optionsSuccessStatus: parseInt(process.env.CORS_OPTIONS_SUCCESS_STATUS, 10) || 204,
  maxAge: parseInt(process.env.CORS_MAX_AGE, 10) || 86400,
};
`,
  logger: `// Config: Logger
require("dotenv").config();

module.exports = {
  level: process.env.LOG_LEVEL || "info",
  format: process.env.LOG_FORMAT || "combined",
  file: {
    enabled: process.env.LOG_FILE_ENABLED === "true",
    filename: process.env.LOG_FILE_PATH || "logs/app.log",
    maxsize: parseInt(process.env.LOG_FILE_MAXSIZE, 10) || 5242880,
    maxFiles: parseInt(process.env.LOG_FILE_MAXFILES, 10) || 5,
  },
  console: {
    enabled: process.env.LOG_CONSOLE_ENABLED !== "false",
    colorize: process.env.LOG_CONSOLE_COLORIZE !== "false",
  },
};
`,
  mailer: `// Config: Mailer
require("dotenv").config();

module.exports = {
  service: process.env.MAIL_SERVICE || "gmail",
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT, 10) || 587,
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  from: process.env.MAIL_FROM || '"No Reply" <noreply@example.com>',
  templates: {
    path: process.env.MAIL_TEMPLATES_PATH || "./app/shared/templates/email",
    resetPassword: process.env.MAIL_TEMPLATE_RESET_PASSWORD || "reset-password",
    verification: process.env.MAIL_TEMPLATE_VERIFICATION || "email-verification",
  },
};
`,
  cloud: `// Config: Cloud Storage
require("dotenv").config();

module.exports = {
  provider: process.env.CLOUD_PROVIDER || "aws",
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || "us-east-1",
    bucket: process.env.AWS_S3_BUCKET,
    cdn: process.env.AWS_CDN_URL,
  },
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    keyFilename: process.env.GCP_KEY_FILENAME,
    bucket: process.env.GCP_STORAGE_BUCKET,
  },
  azure: {
    account: process.env.AZURE_STORAGE_ACCOUNT,
    key: process.env.AZURE_STORAGE_KEY,
    container: process.env.AZURE_STORAGE_CONTAINER,
  },
  digitalocean: {
    spaces: process.env.DO_SPACES,
    key: process.env.DO_SPACES_KEY,
    secret: process.env.DO_SPACES_SECRET,
    region: process.env.DO_SPACES_REGION || "nyc3",
    bucket: process.env.DO_SPACES_BUCKET,
  },
};
`,
  payment: `// Config: Payment Gateway
require("dotenv").config();

module.exports = {
  provider: process.env.PAYMENT_PROVIDER || "stripe",
  stripe: {
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  midtrans: {
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.MIDTRANS_CLIENT_KEY,
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
  },
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    sandbox: process.env.PAYPAL_SANDBOX !== "false",
  },
  xendit: {
    secretKey: process.env.XENDIT_SECRET_KEY,
    webhookToken: process.env.XENDIT_WEBHOOK_TOKEN,
  },
};
`,
  redis: `// Config: Redis
require("dotenv").config();

module.exports = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB, 10) || 0,
  keyPrefix: process.env.REDIS_KEY_PREFIX || "rakitin:",
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY, 10) || 100,
  enableReadyCheck: process.env.REDIS_ENABLE_READY_CHECK !== "false",
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES, 10) || 3,
};
`,
  socket: `// Config: Socket.IO
require("dotenv").config();

module.exports = {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN ? process.env.SOCKET_CORS_ORIGIN.split(",") : "*",
    methods: process.env.SOCKET_CORS_METHODS || "GET,POST",
  },
  pingTimeout: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || 60000,
  pingInterval: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 25000,
  transports: process.env.SOCKET_TRANSPORTS
    ? process.env.SOCKET_TRANSPORTS.split(",")
    : ["websocket", "polling"],
  allowUpgrades: process.env.SOCKET_ALLOW_UPGRADES !== "false",
};
`,
  env: `// Config: Environment
require("dotenv").config();

module.exports = {
  development: { isProduction: false, showStack: true, logErrors: true },
  test: { isProduction: false, showStack: true, logErrors: false },
  production: { isProduction: true, showStack: false, logErrors: true },
}[process.env.NODE_ENV || "development"];
`,
};

const ENV_SECTIONS = {
  app: `PORT=3000
NODE_ENV=development
APP_NAME=Rakitin App
APP_VERSION=1.0.0
API_PREFIX=/api`,
  database: `DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
DB_HOST=localhost
DB_PORT=5432
DB_DIALECT=postgres
DB_LOGGING=true
DB_TEST_USER=your_test_db_user
DB_TEST_PASSWORD=your_test_db_password
DB_TEST_NAME=your_test_db_name
DB_TEST_HOST=localhost
DB_TEST_PORT=5432
DB_TEST_DIALECT=postgres
DB_PROD_USER=your_prod_db_user
DB_PROD_PASSWORD=your_prod_db_password
DB_PROD_NAME=your_prod_db_name
DB_PROD_HOST=your_prod_db_host
DB_PROD_PORT=5432
DB_PROD_DIALECT=postgres
DB_POOL_MAX=10
DB_POOL_MIN=0
DB_POOL_ACQUIRE=30000
DB_POOL_IDLE=10000`,
  jwt: `JWT_SECRET=your-very-secret-key-change-in-production
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
JWT_ALGORITHM=HS256
JWT_ISSUER=rakitin-app
JWT_AUDIENCE=rakitin-users`,
  cors: `CORS_ORIGIN=http://localhost:3000,http://localhost:3001
CORS_METHODS=GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS
CORS_ALLOWED_HEADERS=Content-Type,Authorization
CORS_CREDENTIALS=true
CORS_OPTIONS_SUCCESS_STATUS=204
CORS_MAX_AGE=86400`,
  logger: `LOG_LEVEL=info
LOG_FORMAT=combined
LOG_FILE_ENABLED=true
LOG_FILE_PATH=logs/app.log
LOG_FILE_MAXSIZE=5242880
LOG_FILE_MAXFILES=5
LOG_CONSOLE_ENABLED=true
LOG_CONSOLE_COLORIZE=true`,
  mailer: `MAIL_SERVICE=gmail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password
MAIL_TEMPLATES_PATH=./app/shared/templates/email
MAIL_TEMPLATE_RESET_PASSWORD=reset-password
MAIL_TEMPLATE_VERIFICATION=email-verification`,
  cloud: `CLOUD_PROVIDER=aws
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_s3_bucket
AWS_CDN_URL=https://your-cdn-url.com`,
  payment: `PAYMENT_PROVIDER=stripe
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret`,
  redis: `REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0
REDIS_KEY_PREFIX=rakitin:
REDIS_RETRY_DELAY=100
REDIS_ENABLE_READY_CHECK=true
REDIS_MAX_RETRIES=3`,
  socket: `SOCKET_CORS_ORIGIN=http://localhost:3000
SOCKET_CORS_METHODS=GET,POST
SOCKET_PING_TIMEOUT=60000
SOCKET_PING_INTERVAL=25000
SOCKET_TRANSPORTS=websocket,polling
SOCKET_ALLOW_UPGRADES=true`,
  env: "NODE_ENV=development",
};

/**
 * @param {string} type One of CONFIG_KINDS.
 * @param {{customName?: string, withEnvExample?: boolean, root?: string}} [options]
 * @returns {Promise<{created: string[], skipped: string[], data: object}>}
 */
async function createConfig(type, options = {}) {
  const { customName, withEnvExample = false, root = process.cwd() } = options;
  const kind = String(type || "app").toLowerCase();

  if (!CONFIG_KINDS.includes(kind)) {
    throw new Error(
      `Jenis config tidak dikenal: "${type}". Pilihan: ${CONFIG_KINDS.join(", ")}.`
    );
  }

  const name = kind === "custom" ? assertSafeName("config", customName || "custom") : kind;
  const content =
    kind === "custom"
      ? `// Config: ${name}
require("dotenv").config();

module.exports = {
  // Tambahkan konfigurasi Anda di sini
};
`
      : CONFIG_TEMPLATES[kind];

  const filePath = path.join(getPaths(root).sharedPath, "config", `${name}.config.js`);
  const result = writeFileIfNotExistsSafe(filePath, content);
  const bucket = { created: [], skipped: [] };
  bucket[writeOutcome(result)].push(relativePosix(root, filePath));

  if (withEnvExample) {
    const marker = kind === "custom" ? `CUSTOM:${name.toUpperCase()} CONFIG` : `${kind.toUpperCase()} CONFIG`;
    const section = kind === "custom" ? `# Tambahkan variabel untuk ${name} di sini` : ENV_SECTIONS[kind];
    const envResult = mergeEnvExample(root, marker, section);
    if (envResult.written || envResult.skipped === null) {
      bucket.created.push(relativePosix(root, envResult.path));
    } else {
      bucket.skipped.push(relativePosix(root, envResult.path));
    }
  }

  return { ...bucket, data: { kind, name, path: relativePosix(root, filePath) } };
}

module.exports = {
  createConfig,
  CONFIG_KINDS,
};
