/** @type {import('prettier').Config} */
module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [
    {
      files: ['**/*.ts'],
      options: {
        singleQuote: true,
      },
    },
    {
      files: ['**/*.tsx'],
      options: {
        singleQuote: true,
        jsxSingleQuote: true,
      },
    },
  ],
};
