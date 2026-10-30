import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'public/**',
      'tools/**',
      'graphify-out/**',
      '.system_generated/**',
      'worker-configuration.d.ts',
    ],
  },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_|e|err|error',
          varsIgnorePattern: '^_|e|err|error',
          caughtErrorsIgnorePattern: '^_|e|err|error',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-var': 'off',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['**/*.astro', '**/*.astro/*.js', '**/*.astro/*.ts'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'prefer-const': 'off',
    },
  },
];
