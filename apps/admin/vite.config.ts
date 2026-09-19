import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const resolve = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => {
  const rawEnv = loadEnv(mode, resolve('.'), 'VITE_');

  /**
   * Proxy `/v1` to a remote API, so the browser never makes a cross-origin request.
   *
   * **This exists because of a deployment gap, not a preference.** The staging box has
   * `CORS_ORIGINS` unset (`sync: false` in `render.yaml`, set by hand in the Render
   * dashboard and not yet set), so it returns no `Access-Control-Allow-Origin` and
   * answers every preflight with a `404`. Since every console request carries
   * `Content-Type: application/json` and `X-Tenant`, none of them is a "simple" request
   * and the browser blocks all of them before they are sent.
   *
   * A dev proxy sidesteps that completely: the page talks to `localhost:5273`, which is
   * same-origin, and Vite forwards to the API from Node, where CORS does not apply.
   *
   * Set `VITE_DEV_PROXY_TARGET` to switch it on, and point `VITE_API_BASE_URL` at the
   * relative `/v1` so requests go through it. Unset, nothing changes and the console
   * calls its configured origin directly.
   *
   * `changeOrigin` rewrites the `Host` header to the target, which Render's router needs
   * to select the service. It does **not** touch the cookie: `tfd_refresh` and
   * `tfd_csrf` come back host-only with no `Domain`, so they attach to `localhost` and
   * the `Path=/v1/admin/auth` scoping still lines up. They are `Secure`, which browsers
   * accept on `localhost` because it counts as a trustworthy origin.
   */
  const proxyTarget = rawEnv.VITE_DEV_PROXY_TARGET;

  /**
   * Print which API the dev server will actually talk to.
   *
   * There are two dev commands now and they point at different backends, and the only
   * visible difference used to be the word `staging` in Vite's own banner. Running
   * `npm run dev` while expecting staging looks exactly like a broken proxy: the app
   * comes up fine and every call quietly goes to `localhost:3000`. This makes the target
   * the first thing printed, so the question is never "which one is this".
   */
  const announceTarget = {
    name: 'tfd-announce-api-target',
    apply: 'serve' as const,
    configureServer() {
      const direct = rawEnv.VITE_API_BASE_URL || '(unset)';
      const target = proxyTarget ? `${proxyTarget} (via dev proxy on ${direct})` : direct;
      // `info`, not `log`: it belongs beside Vite's own banner, not in the app's output.
      console.info(`\n  API target  ${target}\n`);
    },
  };

  return {
    plugins: [react(), tailwindcss(), announceTarget],
    resolve: {
      alias: {
        '@': resolve('./src'),
        // The workspace packages are consumed as TypeScript source, not as built
        // artefacts. One less build step, and a change to `@tfd/domain` shows up
        // in the dev server immediately, which is the point of sharing the model
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
      ...(proxyTarget
        ? {
            proxy: {
              '/v1': {
                target: proxyTarget,
                changeOrigin: true,
                secure: true,
              },
            },
          }
        : {}),
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
           * by M1's trend and, later, M16's reports, so first paint (a login form)
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
  };
});
