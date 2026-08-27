const inquirer = require("inquirer");

const mainPrompt = () =>
  inquirer.default.prompt([
    {
      type: "select",
      name: "feature",
      message: "Apa yang ingin Anda generate?",
      choices: [
        { name: "📦 Module (Modular/Simple)", value: "Module" },
        { name: "🔌 Middleware", value: "Middleware" },
        { name: "⚙️  Util", value: "Util" },
        { name: "📝 Config", value: "Config" },
        { name: "🔗 Router Integration", value: "Router Integration" },
        new inquirer.Separator(),
        { name: "🚀 API Endpoint (CRUD)", value: "API Endpoint" },
        { name: "📚 API Documentation (Swagger)", value: "API Documentation" },
        { name: "✅ API Validation (Joi)", value: "API Validation" },
        new inquirer.Separator(),
        { name: "🚪 Exit", value: "exit" },
      ],
    },
  ]);

module.exports = { mainPrompt };
