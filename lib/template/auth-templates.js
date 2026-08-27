/**
 * lib/template/auth-templates.js - EJS-rendered auth-layer templates.
 */

const path = require("path");
const { defaultEngine } = require("./engine");

const AUTH_TEMPLATES_DIR = path.join(__dirname, "..", "templates", "auth");

/**
 * Render an auth-layer template by file name.
 * @param {string} templateFile e.g. "controller.modular.ejs"
 * @param {object} [data={}] Variables exposed to the template.
 * @returns {string} Rendered content.
 */
function renderAuthTemplate(templateFile, data = {}) {
  return defaultEngine.renderFile(
    path.join(AUTH_TEMPLATES_DIR, templateFile),
    data
  );
}

module.exports = { renderAuthTemplate, AUTH_TEMPLATES_DIR };
