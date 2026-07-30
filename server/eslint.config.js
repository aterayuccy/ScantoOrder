const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");
const globals = require("globals");

module.exports = [
  {
    ignores: ["node_modules/**", "coverage/**", "uploads/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.node,
      },
      sourceType: "commonjs",
    },
    rules: {
      "no-console": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
  prettier,
];
