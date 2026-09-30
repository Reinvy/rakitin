/**
 * lib/commands/add.js - Headless `rakitin add <thing> [name]`.
 *
 * Every branch is flag-complete: with `--yes` no prompt is ever reached, and
 * a missing required input produces an actionable error listing the flags
 * instead of hanging on stdin.
 *
 * All writes flow through the safety layer; dependencies resolve once per
 * command through the unified manifest with the detected package manager.
 */

const inquirer = require("inquirer");
const { simpleArch, modularArch } = require("../generator/module/arch/arch");
const { createMiddleware } = require("../generator/middleware/middleware");
const { createConfig } = require("../generator/config/config");
const { ensureDependencies, ormToKind } = require("../deps/manifest");
const { assertSafeName } = require("../naming");
const { runWithPluginInstall } = require("./shared");

const ORM_NAMES = { none: "None", prisma: "Prisma", sequelize: "Sequelize", mongoose: "Mongoose", typeorm: "TypeORM" };

const ARCHITECTURES = ["simple", "modular"];

/**
 * Normalize an ORM flag value to its display name.
 * @param {string} orm
 * @returns {"None"|"Prisma"|"Sequelize"|"Mongoose"|"TypeORM"}
 */
function normalizeOrmName(orm) {
  const key = String(orm || "none").toLowerCase();
  const name = ORM_NAMES[key];
  if (!name) {
    throw new Error(
      `ORM tidak dikenal: "${orm}". Pilihan: none, prisma, sequelize, mongoose, typeorm.`
    );
  }
  return name;
}

/**
 * @param {"module"|"middleware"|"util"|"config"|"endpoint"|"validation"|"docs"|"test"|"graphql"|"websocket"} thing
 * @param {string|undefined} name
 * @param {object} context result of buildContext()
 * @returns {Promise<object>} result envelope payload
 */
async function addCommand(thing, name, context = {}) {
  switch (thing) {
    case "module":
      return addModule(name, context);
    case "middleware":
      return addMiddleware(name, context);
    case "config":
      return addConfig(name, context);
    case "util":
      return addUtil(name, context);
    case "endpoint":
      return addEndpoint(name, context);
    case "validation":
      return addValidation(name, context);
    case "docs":
      return addDocs(name, context);
    case "test":
      return addTest(name, context);
    case "graphql":
      return addGraphql(context);
    case "websocket":
      return addWebsocket(context);
    default:
      return addPluginGenerator(thing, name, context);
  }
}

/** Generator ids owned by the core CLI (plugins may not shadow them). */
const CORE_GENERATORS = new Set([
  "module",
  "middleware",
  "config",
  "util",
  "endpoint",
  "validation",
  "docs",
  "test",
  "graphql",
  "websocket",
]);

/**
 * Dispatch `rakitin add <plugin-generator-id>` to a plugin-contributed
 * generator. Never shadows a built-in id.
 * @param {string} thing
 * @param {string|undefined} name
 * @param {object} context
 */
async function addPluginGenerator(thing, name, context = {}) {
  let host = null;
  try {
    host = require("../plugins");
  } catch {
    // The plugin layer is optional: fall through to the unknown-generator error.
  }

  if (host && CORE_GENERATORS.has(String(thing))) {
    throw new Error(`Generator "${thing}" bentrok dengan generator bawaan.`);
  }

  const generators = host ? host.getGenerators(context) : {};
  const generator = generators[thing];
  if (!generator) {
    throw new Error(`Generator tidak dikenal: "${thing}". Lihat 'rakitin list'.`);
  }

  const pluginArgs = { command: "add", thing, name: name ?? null };
  const pluginContext = host.buildPluginContext(context, pluginArgs);

  // Plugin-declared packages for this generator (`plugin:<generator-id>`).
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies([`plugin:${thing}`], {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root: context.root,
    })
  );

  const result = (await generator.generate(pluginContext, pluginArgs)) || {};

  return {
    ok: true,
    created: result.created || [],
    skipped: result.skipped || [],
    nextSteps: result.nextSteps || [],
    message: result.message,
    data: {
      generator: thing,
      plugin: generator.plugin || null,
      install: installResult,
      ...(result.data || {}),
    },
  };
}

/**
 * Dependency kinds contributed by loaded plugins, passed to
 * `ensureDependencies(kinds, { extraKinds })`.
 * @param {object} context
 * @returns {Record<string, string[]>}
 */
function pluginExtraKinds(context) {
  try {
    return require("../plugins").getExtraKinds(context);
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// module
// ---------------------------------------------------------------------------

async function addModule(rawName, context = {}) {
  let moduleName = rawName || context.name || null;

  if (!moduleName && !context.yes) {
    const answers = await inquirer.default.prompt([
      {
        type: "input",
        name: "moduleName",
        message: "Nama modul:",
        validate: (v) => Boolean(String(v).trim()) || "Nama modul wajib diisi",
      },
    ]);
    moduleName = answers.moduleName;
  }

  if (!moduleName) {
    throw new Error(
      "Nama modul wajib ada. Contoh: rakitin add module user --arch modular --orm none --yes"
    );
  }

  const kebab = assertSafeName("module", moduleName);
  const architecture = String(context.arch || "modular").toLowerCase();
  if (!ARCHITECTURES.includes(architecture)) {
    throw new Error(
      `Arsitektur tidak dikenal: "${context.arch}". Pilihan: ${ARCHITECTURES.join(", ")}.`
    );
  }

  const ormName = normalizeOrmName(context.orm);
  const template = String(context.template || "crud").toLowerCase();
  const root = context.root || process.cwd();

  const archFn = architecture === "simple" ? simpleArch : modularArch;
  const archResult = await archFn(kebab, ormName, { template });

  const created = [...archResult.created];
  const skipped = [...archResult.skipped];

  if (ormName !== "None") {
    const ormModule = require("../generator/module/orm/orm");
    const ormFn = {
      Prisma: ormModule.prismaORM,
      Sequelize: ormModule.sequelizeORM,
      Mongoose: ormModule.mongooseORM,
      TypeORM: ormModule.typeormORM,
    }[ormName];
    const ormResult = await ormFn(kebab, architecture === "simple" ? "Simple" : "Modular");
    created.push(...ormResult.created);
    skipped.push(...ormResult.skipped);
  }

  // Per-module template extras.
  if (template === "graphql") {
    const { generateGraphQL } = require("../generator/api/graphql");
    const gql = await generateGraphQL({ module: kebab, root });
    created.push(...gql.created);
    skipped.push(...gql.skipped);
  }
  if (template === "realtime") {
    const { generateWebSocket } = require("../generator/api/websocket");
    const ws = await generateWebSocket({ module: kebab, path: "/ws", root });
    created.push(...ws.created);
    skipped.push(...ws.skipped);
  }
  if (context.withTests || context.generateTestFiles) {
    const { generateTestFiles } = require("../generator/api/testfile");
    const tests = await generateTestFiles({ module: kebab, all: false, root });
    created.push(...tests.created);
    skipped.push(...tests.skipped);
  }

  let wired = false;
  if (context.autoIntegrateRouter) {
    const { integrateCommand } = require("./integrate");
    const result = await integrateCommand({ root });
    if (result.ok) {
      created.push(...(result.created || []));
      wired = true;
    }
  }

  const kinds = [ormToKind(ormName)];
  if (template === "graphql") kinds.push("graphql:core");
  if (template === "realtime") kinds.push("websocket:ws");
  if (context.withTests || context.generateTestFiles) kinds.push("test:dev");

  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies(kinds, {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root,
    })
  );

  return {
    ok: true,
    created,
    skipped,
    nextSteps: buildModuleNextSteps(kebab, ormName, wired, context.pm),
    data: { module: kebab, architecture, orm: ormName, template, install: installResult },
  };
}

function buildModuleNextSteps(moduleName, orm, wired, pm) {
  const steps = [];
  steps.push(
    wired
      ? `Module '${moduleName}' otomatis terhubung di app/routes/index.js`
      : `Wire module '${moduleName}' ke router utama: rakitin integrate`
  );
  steps.push(`Tambahkan resource endpoint: rakitin add endpoint ${moduleName} --resource items`);
  if (orm !== "None") {
    steps.push("Periksa kredensial database di .env lalu jalankan migration/push sesuai ORM Anda");
  }
  if (pm) steps.push(`Package manager aktif: ${pm}`);
  return steps;
}

// ---------------------------------------------------------------------------
// middleware / config / util
// ---------------------------------------------------------------------------

async function addMiddleware(kindOrName, context = {}) {
  let kind = String(kindOrName || context.kind || "").toLowerCase();

  if (!kind && !context.yes) {
    const answers = await inquirer.default.prompt([
      {
        type: "select",
        name: "kind",
        message: "Pilih jenis middleware:",
        choices: ["custom", "auth", "logger", "error", "request-time"],
      },
    ]);
    kind = answers.kind;
  }
  if (!kind) {
    throw new Error(
      "Jenis middleware wajib ada. Contoh: rakitin add middleware auth --yes"
    );
  }

  const result = await createMiddleware(kind, context.customName, { root: context.root });
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies([`middleware:${kind}`], {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root: context.root,
    })
  );

  return {
    ok: true,
    created: result.created,
    skipped: result.skipped,
    nextSteps: [
      "Regenerate router integrasi bila ingin middleware ini global: rakitin integrate --middleware " +
        result.data.name,
    ],
    data: { ...result.data, install: installResult },
  };
}

async function addConfig(kindOrName, context = {}) {
  const kind = String(kindOrName || context.kind || "app").toLowerCase();
  const result = await createConfig(kind, {
    customName: context.customName,
    withEnvExample: true,
    root: context.root,
  });
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies([`config:${kind}`], {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root: context.root,
    })
  );

  return {
    ok: true,
    created: result.created,
    skipped: result.skipped,
    nextSteps: ["Impor config ini dari app/shared/config/<name>.config.js pada kode Anda"],
    data: { ...result.data, install: installResult },
  };
}

async function addUtil(kindOrName, context = {}) {
  const { createUtil, UTIL_KINDS } = require("../generator/util/util");
  const kind = context.kind || kindOrName;
  const name = context.customName || context.name || null;
  const result = await createUtil(kind, name, {
    root: context.root,
  });
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies([`util:${result.data.kind}`], {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root: context.root,
    })
  );
  return {
    ok: true,
    created: result.created,
    skipped: result.skipped,
    nextSteps: [`Gunakan util: require('./app/shared/utils/${result.data.name}.util')`],
    data: { ...result.data, available: UTIL_KINDS, install: installResult },
  };
}

// ---------------------------------------------------------------------------
// endpoint / validation / docs / test
// ---------------------------------------------------------------------------

async function addEndpoint(moduleName, context = {}) {
  const target = moduleName || context.module;
  if (!target) {
    throw new Error("Nama modul wajib ada. Contoh: rakitin add endpoint user --resource items");
  }
  const { generateEndpoint } = require("../generator/api/endpoint");
  const result = await generateEndpoint(target, {
    resource: context.resource,
    fields: context.fields,
    pagination: context.pagination,
    filtering: context.filtering,
    root: context.root,
  });
  return { ok: true, ...result };
}

async function addValidation(name, context = {}) {
  const target = name || context.name;
  const { generateValidation } = require("../generator/api/validation");
  const result = await generateValidation(target, {
    fields: context.fields,
    fromModule: context.fromModule,
    common: context.common,
    root: context.root,
  });
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies(["validation:joi"], {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root: context.root,
    })
  );
  return { ok: true, ...result, data: { ...result.data, install: installResult } };
}

async function addDocs(kind, context = {}) {
  const documentation = require("../generator/api/documentation");
  const docsKind = String(kind || context.kind || "").toLowerCase();

  // Resolve the dependency kinds BEFORE writing: an unknown kind must fail
  // without leaving a half-written app/docs behind.
  if (Array.isArray(documentation.DOCS_KINDS) && !documentation.DOCS_KINDS.includes(docsKind)) {
    throw new Error(
      `Jenis dokumentasi tidak dikenal: "${docsKind}". Pilihan: ${documentation.DOCS_KINDS.join(", ")}.`
    );
  }
  const depKinds =
    docsKind === "complete" || docsKind === "swagger-ui"
      ? ["docs:swagger-ui"]
      : [`docs:${docsKind}`];

  const result = await documentation.generateDocumentation(docsKind, {
    title: context.title,
    apiVersion: context.apiVersion,
    auth: context.auth,
    root: context.root,
  });
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies(depKinds, {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root: context.root,
    })
  );
  return { ok: true, ...result, data: { ...result.data, install: installResult } };
}

async function addTest(moduleName, context = {}) {
  const { generateTestFiles } = require("../generator/api/testfile");
  const result = await generateTestFiles({
    module: moduleName || context.module,
    all: context.all,
    root: context.root,
  });
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies(["test:dev"], {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      dev: true,
      silent: true,
      root: context.root,
    })
  );
  return { ok: true, ...result, data: { ...result.data, install: installResult } };
}

// ---------------------------------------------------------------------------
// graphql / websocket
// ---------------------------------------------------------------------------

async function addGraphql(context = {}) {
  const { generateGraphQL } = require("../generator/api/graphql");
  const result = await generateGraphQL({ module: context.module, root: context.root });
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies(["graphql:core"], {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root: context.root,
    })
  );
  return {
    ok: true,
    ...result,
    nextSteps: [
      "Pasang di app: const { mountGraphQL } = require('./app/graphql'); mountGraphQL(app);",
    ],
    data: { ...result.data, install: installResult },
  };
}

async function addWebsocket(context = {}) {
  const { generateWebSocket } = require("../generator/api/websocket");
  const result = await generateWebSocket({
    module: context.module,
    path: context.wsPath,
    root: context.root,
  });
  const installResult = await runWithPluginInstall(context, () =>
    ensureDependencies(["websocket:ws"], {
      pm: context.pm,
      install: context.install,
      extraKinds: pluginExtraKinds(context),
      silent: true,
      root: context.root,
    })
  );
  return {
    ok: true,
    ...result,
    nextSteps: [
      "Pasang di server: const { attachWebSocket } = require('./app/ws'); attachWebSocket(server);",
    ],
    data: { ...result.data, install: installResult },
  };
}

module.exports = { addCommand, normalizeOrmName, ARCHITECTURES };
