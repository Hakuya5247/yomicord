const js = require('@eslint/js');
const globals = require('globals');
const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const prettier = require('eslint-config-prettier');

module.exports = [
  // 旧 .eslintignore / ignorePatterns をここに集約
  {
    ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/node_modules/**'],
  },

  // eslint:recommended 相当
  js.configs.recommended,

  // JS/TS 共通の最低限設定
  {
    files: ['**/*.{ts,tsx,js,cjs,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.es2022,
        ...globals.node,
      },
    },
  },

  // TypeScript の推奨ルール（型情報不要）
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // prettier と競合する整形系ルールを無効化（最後に置く）
  prettier,
];
