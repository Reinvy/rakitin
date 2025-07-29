const inquirer = require("inquirer");

const mainPrompt = () =>
  inquirer.default.prompt([
    {
      type: "list",
      name: "feature",
      message: "Apa yang ingin Anda generate?",
      choices: [
        "Module",
        "Middleware",
        "Util",
        "Config",
        "Integrasi Router Utama",
      ],
    },
  ]);

module.exports = { mainPrompt };
