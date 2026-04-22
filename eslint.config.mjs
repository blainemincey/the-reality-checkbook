import next from 'eslint-config-next';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...next(),
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Number']",
          message: 'Do not use Number() in the money path. Use Cash/Quantity/Price from @/money.',
        },
      ],
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**'],
  },
];
