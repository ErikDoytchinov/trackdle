import { defineConfig } from 'eslint/config';
import globals from 'globals';
import js from '@eslint/js';
import prettier from 'eslint-plugin-prettier';

export default defineConfig([
  { files: ['**/*.{js,mjs,cjs}'] },
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js, prettier },
    rules: {
      'prettier/prettier': 'error',
    },
  },
]);
