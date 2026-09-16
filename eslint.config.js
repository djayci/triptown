import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

// Packages that must stay renderer- and DOM-free so they run in browser, API and verifier alike.
const PURE_PACKAGES = ['packages/fairness/**', 'packages/core/**', 'packages/steps/**'];

export default tseslint.config(
  { ignores: ['**/dist/**', '**/dist-demo/**', '**/public/**', '**/.vercel/**', '**/node_modules/**', 'openspec/**', 'design/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Browser-driving dev scripts (playwright page.evaluate bodies run in the page).
    files: ['**/scripts/*-check.mjs', 'scripts/play.mjs', 'scripts/shot.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: PURE_PACKAGES,
    ignores: ['**/*.test.ts', '**/scripts/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['pixi.js', 'pixi.js/*', '@pixi/*'], message: 'fairness/core must not depend on the renderer.' },
            { group: ['howler', 'gsap', 'gsap/*'], message: 'fairness/core must not depend on client libraries.' },
            { group: ['node:*'], message: 'fairness/core must run in browsers too; no Node built-ins.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'No DOM in fairness/core.' },
        { name: 'document', message: 'No DOM in fairness/core.' },
        { name: 'navigator', message: 'No DOM in fairness/core.' },
        { name: 'localStorage', message: 'No DOM in fairness/core.' },
      ],
    },
  },
);
