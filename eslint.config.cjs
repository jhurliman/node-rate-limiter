const { defineConfig } = require("eslint/config");
const typescriptEslintParser = require("@typescript-eslint/parser");
const typescriptEslintPlugin = require("@typescript-eslint/eslint-plugin");
const prettierPlugin = require("eslint-plugin-prettier");
const eslintRecommended = require("@eslint/js").configs.recommended;
const jestPlugin = require("eslint-plugin-jest");
const globals = require("globals");

module.exports = defineConfig([
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  {
    files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        warnOnUnsupportedTypeScriptVersion: false,
      },
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        performance: "readonly",
        setTimeout: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...eslintRecommended.rules,
      ...typescriptEslintPlugin.configs.recommended.rules,
      "prettier/prettier": "error",
    },
  },
  // Jest specific configuration
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "**/*.test.js", "**/*.spec.js"],
    plugins: { jest: jestPlugin }, 
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
    rules: {
      ...jestPlugin.configs.recommended.rules,
      // You can override or add specific Jest rules here if needed
      // e.g., "jest/no-disabled-tests": "warn",
    },
  },
]);
