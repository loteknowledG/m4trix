const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactPlugin = require("eslint-plugin-react");
const reactHooksPlugin = require("eslint-plugin-react-hooks");
const nextPlugin = require("@next/eslint-plugin-next");
const prettierConfig = require("eslint-config-prettier");

module.exports = [
    {
        files: ["**/*.{js,jsx,ts,tsx}"],
        ignores: [
            "**/node_modules/**",
            "**/.next/**",
            "dist/**",
            "out/**",
            "build/**",
            ".vscode/**",
            ".idea/**",
            ".DS_Store",
            "coverage/**",
            "public/registry/**",
            "pnpm-lock.yaml",
        ],
        languageOptions: {
            parser: require("@typescript-eslint/parser"),
            parserOptions: {
                ecmaFeatures: { jsx: true },
                ecmaVersion: 2020,
                sourceType: "module",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            react: reactPlugin,
            "react-hooks": reactHooksPlugin,
            "@next/next": nextPlugin,
        },
        settings: {
            react: { version: "detect" },
        },
        rules: {
            "react/react-in-jsx-scope": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "off",

            "@typescript-eslint/no-unused-vars": [
                "error",
                { varsIgnorePattern: "^_", argsIgnorePattern: "^_", caughtErrorsIgnorePattern: ".*" }
            ],
            "no-console": ["warn", { allow: ["warn", "error"] }],
        },
    },
    {
        files: ["electron/**", "scripts/**"],
        rules: {
            "@typescript-eslint/no-require-imports": "off",
            "@typescript-eslint/no-var-requires": "off",
        },
    },
    prettierConfig,
];
