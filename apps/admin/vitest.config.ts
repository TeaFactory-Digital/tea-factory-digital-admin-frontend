import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('./src'),
      '@tfd/domain': resolve('../../packages/domain/src/index.ts'),
      '@tfd/brand': resolve('../../packages/brand/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    /**
     * The logic, at 70% (Q40, decided 30 October 2026): the shared domain and brand
     * packages, the transport and repositories, and the console's own helpers. Screens are
     * covered by their own tests and the e2e suite; fixtures, string tables, types and the
     * bank list are data, not logic.
     */
    coverage: {
      provider: 'v8',
      // The packages live outside this app's root.
      allowExternal: true,
      include: [
        `${resolve('../../packages/domain/src')}/**/*.ts`,
        `${resolve('../../packages/brand/src')}/**/*.ts`,
        'src/services/**/*.ts',
        'src/lib/**/*.ts',
      ],
      exclude: [
        '**/*.test.*',
        '**/types/**',
        '**/data/**',
        'src/services/mocks/**',
        'src/i18n/**',
      ],
      reporter: ['text-summary', 'text'],
      thresholds: { statements: 70, branches: 70, functions: 70, lines: 70 },
    },
  },
});
