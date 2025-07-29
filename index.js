#!/usr/bin/env node
const { mainPrompt } = require("./lib/prompt");
const generateModule = require("./lib/generator/module/module");
const generateMiddleware = require("./lib/generator/middleware");
const generateUtil = require("./lib/generator/util");
const generateConfig = require("./lib/generator/config");
const integrateRouter = require("./lib/generator/router");
const { ensureBaseStructure } = require("./lib/utils");

async function main() {
  ensureBaseStructure();

  const { feature } = await mainPrompt();

  switch (feature) {
    case "Module":
      return generateModule();
    case "Middleware":
      return generateMiddleware();
    case "Util":
      return generateUtil();
    case "Config":
      return generateConfig();
    case "Integrasi Router Utama":
      return integrateRouter();
    default:
      console.log("Batal.");
  }
}

main().catch((err) => {
  if (err?.name === "ExitPromptError" || err?.message?.includes("SIGINT")) {
    console.log("❌ Proses dibatalkan oleh pengguna.");
    process.exit(0);
  }
  console.error("❌ Terjadi error:", err);
  process.exit(1);
});
