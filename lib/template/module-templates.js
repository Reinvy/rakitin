/**
 * lib/template/module-templates.js - EJS-rendered module-layer templates.
 *
 * Phase A of the inline->EJS migration: controllers, routers and the
 * no-ORM service render from lib/templates/module/*.ejs. Output must stay
 * BYTE-IDENTICAL to historical inline literals - guarded by
 * tests/regression/templates-phaseA.test.js golden fixtures.
 */

const path = require("path");
const { defaultEngine } = require("./engine");

const MODULE_TEMPLATES_DIR = path.join(__dirname, "..", "templates", "module");

/**
 * Render a module-layer template by file name.
 * @param {string} templateFile e.g. "controller.simple.ejs"
 * @param {object} data Variables exposed to the template.
 * @returns {string} Rendered content (no trailing newline added).
 */
function renderModuleTemplate(templateFile, data) {
  return defaultEngine.renderFile(
    path.join(MODULE_TEMPLATES_DIR, templateFile),
    data
  );
}

module.exports = { renderModuleTemplate, MODULE_TEMPLATES_DIR };