/**
 * lib/template/api-templates.js - EJS-rendered API-family templates.
 *
 * Covers the files emitted by `lib/generator/api/**` (endpoint resources,
 * Joi validators, API docs) and `lib/generator/util/util.js`. Templates live
 * under `lib/templates/api/**`; nothing here writes to disk.
 */

const path = require("path");
const { defaultEngine } = require("./engine");

const API_TEMPLATES_DIR = path.join(__dirname, "..", "templates", "api");

/**
 * Render an API-family template by its path relative to
 * `lib/templates/api` (e.g. "endpoint/resource.router.ejs").
 * @param {string} templateFile
 * @param {object} [data]
 * @returns {string} Rendered content (no trailing newline added).
 */
function renderApiTemplate(templateFile, data = {}) {
  return defaultEngine.renderFile(path.join(API_TEMPLATES_DIR, templateFile), data);
}

module.exports = { renderApiTemplate, API_TEMPLATES_DIR };
