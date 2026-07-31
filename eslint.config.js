// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

/**
 * The three golden rules from white-label.md, as far as a linter can carry them:
 *
 *  1. Never hardcode a colour, size or string in a component.
 *  2. Never branch on the client/tenant id — gate behaviour with feature flags.
 *  3. UI never imports axios. Screens → hooks → repositories → endpoints → apiClient.
 *
 * Rule 1 is partly enforceable (colours and arbitrary sizes in `className`);
 * rule 3 is fully enforceable by import path; rule 2 is not statically checkable
 * and is a review item. Where the linter cannot reach, docs/white-label.md says
 * so explicitly rather than pretending coverage.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/playwright-report/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],

      'no-restricted-syntax': [
        'error',
        {
          // Rule 1, colours: `bg-[#128C7E]`, `text-[rgb(...)]`.
          selector: 'JSXAttribute[name.name="className"] Literal[value=/\\[#[0-9a-fA-F]{3,8}\\]/]',
          message:
            'No hardcoded colour. Use a semantic token utility (bg-primary, text-text-secondary). Add the token to @tfd/brand first if it is missing.',
        },
        {
          // Rule 1, sizes: `p-[13px]`, `w-[7rem]`, `text-[13px]`.
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/\\[[0-9.]+(px|rem|em)\\]/]',
          message:
            'No arbitrary size. Use a spacing/radius/text token (p-lg, rounded-md, text-data-cell) so a tenant can re-scale it.',
        },
        {
          // Rule 1, strings: an inline style object with a colour literal.
          selector: 'JSXAttribute[name.name="style"] Literal[value=/^#[0-9a-fA-F]{3,8}$/]',
          message: 'No hardcoded colour in an inline style. Use a token utility or a CSS variable.',
        },
        {
          /**
           * The spacing/container collision.
           *
           * Tailwind resolves a NAMED sizing value against `--spacing-*` before
           * `--container-*`, so with `--spacing-md` defined, `max-w-md` silently
           * means 12px instead of 28rem. Nothing errors — the layout just
           * collapses, which is how it reached a screenshot once already.
           *
           * Use a semantic layout token (`max-w-card`, `max-w-dialog`,
           * `max-w-page`) or the numeric scale (`w-64`, `h-11`).
           */
          selector:
            'JSXAttribute[name.name="className"] Literal[value=/\\b(?:min-|max-)?(?:[wh]|size)-(?:3xs|2xs|xs|sm|md|lg|xl|[2-7]xl)\\b/]',
          message:
            'A t-shirt-named sizing utility resolves against --spacing-*, not --container-*: `max-w-md` is 12px here, not 28rem. Use a semantic layout token (max-w-card / max-w-dialog / max-w-dialog-wide / max-w-page) or the numeric scale (w-64, h-11).',
        },
      ],
    },
  },

  {
    // Rule 3: the transport boundary. Only the api layer knows axios exists, and
    // only repositories know endpoints exist — that seam is what absorbs a
    // backend returning something slightly different from what the UI wants.
    files: ['apps/admin/src/**/*.{ts,tsx}'],
    ignores: [
      'apps/admin/src/services/api/**',
      'apps/admin/src/services/endpoints/**',
      'apps/admin/src/services/mocks/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'axios',
              message:
                'UI never imports axios. Screens → hooks → repositories → endpoints → apiClient.',
            },
          ],
          patterns: [
            {
              group: ['@/services/endpoints/*', '**/services/endpoints/*'],
              message:
                'Only a repository may import an endpoint. Screens and hooks go through the repository.',
            },
          ],
        },
      ],
    },
  },

  {
    // The packages are framework-free by contract, and that is worth enforcing:
    // `@tfd/domain` is imported by a React Native bundle and by a Node service.
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: '@tfd/* packages must stay framework-free.' },
            { name: 'react-dom', message: '@tfd/* packages must stay framework-free.' },
            { name: 'react-native', message: '@tfd/* packages must stay framework-free.' },
            { name: 'axios', message: '@tfd/* packages must stay transport-free.' },
          ],
        },
      ],
    },
  },

  {
    /**
     * A provider and the hooks that read it belong in one file: `useFeatureFlag`
     * has no meaning apart from `RuntimeConfigProvider`, and splitting them would
     * scatter one concept across two modules to please a dev-time HMR
     * optimisation. The cost is a full reload when these files change, which is
     * acceptable for three files that rarely do.
     */
    files: [
      'apps/admin/src/config/RuntimeConfigProvider.tsx',
      'apps/admin/src/components/ui/Toast.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  {
    files: ['**/*.test.{ts,tsx}', 'apps/admin/src/test/**', 'apps/admin/e2e/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-restricted-imports': 'off',
    },
  },
);
