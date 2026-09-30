/**
 * lib/index.js - library entry point.
 *
 * `require("rakitin")` exposes the same building blocks the CLI uses:
 *   const { naming, safety, commands } = require("rakitin");
 */

const { bareSummary } = require("./commands/info");

module.exports = {
  version: require("../package.json").version,
  bareSummary,
  config: require("./config"),
  naming: require("./naming"),
  safety: require("./safety"),
  project: require("./project/detector"),
  commands: require("./commands"),
  deps: require("./deps/manifest"),
  plugins: require("./plugins"),
};
