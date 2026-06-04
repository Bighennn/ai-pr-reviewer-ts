import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts", "evals/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: false },
      globals: { process: "readonly", console: "readonly", Buffer: "readonly" },
    },
    plugins: { "@typescript-eslint": tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  { ignores: ["dist/**", "node_modules/**"] },
];
