import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve('./src'),
      // The workspace packages are consumed as TypeScript source, not as built
      // artefacts. One less build step, and a change to `@tfd/domain` shows up
      // in the dev server immediately — which is the point of sharing the model
      // rather than publishing it.
      '@tfd/domain': resolve('../../packages/domain/src/index.ts'),
      '@tfd/brand': resolve('../../packages/brand/src/index.ts'),
    },
  },
  server: {
    port: 5273,
    // Every tenant is a subdomain in production. Allowing them locally means
    // `galaboda.admin.localhost:5273` exercises the real resolution path
    // instead of only the `?tenant=` dev override.
    allowedHosts: ['.localhost', '.admin.localhost'],
  },
  build: {
    // One bundle serves every tenant, so this is shipped once and cached hard.
    // Source maps stay on: a console bug reported by an office clerk is
    // otherwise unreadable, and the bundle is not a secret.
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Split by *change rate*, not by size.
         *
         * One bundle serves every tenant and the console ships continuously, so
         * what matters is how much a returning clerk has to re-download after a
         * release. React and Radix change monthly; the console changes daily.
         * Keeping them apart means a normal release invalidates the small chunk.
         *
         * `charts` is the exception that is about size: Recharts is reached only
         * by M1's trend and, later, M16's reports, so first paint — a login form —
         * must not carry a charting library.
         */
        manualChunks: {
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
          ui: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-label',
            '@radix-ui/react-switch',
            '@radix-ui/react-checkbox',
          ],
          data: ['@tanstack/react-query', '@tanstack/react-table', 'axios'],
          forms: ['react-hook-form', '@hookform/resolvers', 'zod'],
          i18n: ['i18next', 'react-i18next'],
        },
      },
    },
  },
});
