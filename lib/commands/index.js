/**
 * lib/commands/index.js - Barrel for the command layer.
 * Usage: `const { addCommand } = require('rakitin').commands`
 */

const { initCommand } = require("./init");
const { addCommand } = require("./add");
const { integrateCommand } = require("./integrate");
const { recipeCommand } = require("./recipe");
const { configCommand } = require("./config");
const { infoCommand, bareSummary } = require("./info");
const { doctorCommand } = require("./doctor");
const { listCommand } = require("./list");
const { pluginCommand } = require("./plugin");
const { buildContext, printResult, printFailure, enableJsonMode } = require("./shared");

module.exports = {
  initCommand,
  addCommand,
  integrateCommand,
  recipeCommand,
  configCommand,
  infoCommand,
  bareSummary,
  doctorCommand,
  listCommand,
  pluginCommand,
  buildContext,
  printResult,
  printFailure,
  enableJsonMode,
};
