/**
 * ESLint flat config - pragmatic gates for rakitin.
 * Strict about correctness; style minutiae owned by Prettier.
 */

const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "coverage/**", "examples/**/*.js", "tests/temp/**"],
  },

  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "error",
      "no-unused-vars": [
        "warn",
        { args: "none", caughtErrors: "none", varsIgnorePattern: "^_" },
      ],
      "no-unreachable": "warn",
      eqeqeq: ["error", "smart"],
      curly: ["warn", "multi-line"],
      "prefer-const": "warn",
      "no-var": "error",
      semi: ["error", "always"],
      quotes: ["warn", "double", { avoidEscape: true }],
    },
  },

  // Library surface - rules tied to historical footguns fixed in v2/v3
  {
    files: ["lib/**/*.js", "bin/**/*.js"],
    rules: {
      "no-template-curly-in-string": "warn",
      "no-new-wrappers": "error",
      // stdout purity: --json output must be the ONLY thing on stdout.
      "no-console": "error",
    },
  },

  // The logger is the single sanctioned console writer.
  {
    files: ["lib/utils/logger.js"],
    rules: { "no-console": "off" },
  },

  // Tests are intentionally pragmatic
  {
    files: ["tests/**/*.js"],
    rules: {
      "no-unused-vars": "off",
      eqeqeq: "off",
    },
  },
];
