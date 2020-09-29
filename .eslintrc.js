module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
    jest: true,
  },
  plugins: ['standard', 'jest', 'prettier'],
  extends: [
    'standard',
    'plugin:node/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'no-process-exit': 'warn',
    'jest/no-disabled-tests': 'error',
    'jest/no-focused-tests': 'warn',
    'jest/no-identical-title': 'error',
    'node/no-unsupported-features': 'off',
    'node/no-unpublished-require': 'off',
    'space-before-function-paren': 'off',
    'object-curly-spacing': 'off',
  },
  parser: 'babel-eslint',
  parserOptions: {
    ecmaFeatures: {
      impliedStrict: true,
    },
  },
  ignorePatterns: ['dist/**', 'coverage/**', '__mocks__/**'],
}
