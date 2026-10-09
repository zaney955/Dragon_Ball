import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', '**/.wrangler/**'] },
  {
    files: ['workers/**/*.js'],
    languageOptions: {
      globals: { WebSocketPair: 'readonly', WebSocketRequestResponsePair: 'readonly' },
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-unreachable': 'error',
      'no-duplicate-case': 'error',
      'no-dupe-args': 'error',
      'no-dupe-keys': 'error',
      'no-unexpected-multiline': 'error',
      'valid-typeof': 'error',
      'no-constant-binary-expression': 'error',
      'no-restricted-globals': ['error', 'THREE'],
    },
  },
];
