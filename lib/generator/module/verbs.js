/**
 * lib/generator/module/verbs.js - Single source of truth for the CRUD verb
 * surface a generated module exposes and for the `--template` variants.
 */

const {
  RESOURCE_BLOCK_START,
  RESOURCE_BLOCK_END,
} = require("../../safety");

/** Every verb a module controller/router can expose, with its HTTP route. */
const VERB_ROUTES = [
  { verb: "getAll", method: "get", path: "/" },
  { verb: "getById", method: "get", path: "/:id" },
  { verb: "create", method: "post", path: "/" },
  { verb: "update", method: "put", path: "/:id" },
  { verb: "remove", method: "delete", path: "/:id" },
];

/** Response message per verb (uniform `{ message, data }` envelope). */
const VERB_MESSAGES = {
  getAll: "Berhasil mendapatkan data",
  getById: "Berhasil mendapatkan detail data",
  create: "Berhasil membuat data",
  update: "Berhasil memperbarui data",
  remove: "Berhasil menghapus data",
};

/** `--template` value -> exposed verbs. */
const TEMPLATE_VERBS = {
  crud: ["getAll", "getById", "create", "update", "remove"],
  readonly: ["getAll", "getById"],
  graphql: ["getAll", "getById", "create", "update", "remove"],
  realtime: ["getAll", "getById", "create", "update", "remove"],
};

const TEMPLATES = Object.keys(TEMPLATE_VERBS);

/**
 * Assert a `--template` value and return its verb list.
 * @param {string} template
 * @returns {string[]}
 */
function verbsForTemplate(template = "crud") {
  const value = String(template || "crud").toLowerCase();
  const verbs = TEMPLATE_VERBS[value];
  if (!verbs) {
    throw new Error(
      `Template tidak dikenal: "${template}". Pilih salah satu: ${TEMPLATES.join(", ")}.`
    );
  }
  return [...verbs];
}

/**
 * Route descriptors for a verb subset (order preserved from VERB_ROUTES).
 * @param {string[]} verbs
 */
function routesFor(verbs) {
  return VERB_ROUTES.filter((route) => verbs.includes(route.verb));
}

/**
 * Locals shared by every module-layer EJS template.
 * @param {{raw: string, kebab: string, verbs: string[]}} options
 */
function moduleTemplateLocals({ raw, kebab, verbs }) {
  return {
    moduleName: raw,
    kebabName: kebab,
    verbs,
    routes: routesFor(verbs),
    messages: VERB_MESSAGES,
    resourceStart: RESOURCE_BLOCK_START,
    resourceEnd: RESOURCE_BLOCK_END,
  };
}

module.exports = {
  VERB_ROUTES,
  VERB_MESSAGES,
  TEMPLATE_VERBS,
  TEMPLATES,
  verbsForTemplate,
  routesFor,
  moduleTemplateLocals,
};
