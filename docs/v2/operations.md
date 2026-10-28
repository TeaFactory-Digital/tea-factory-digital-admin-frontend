# Operations

Running, testing and deploying the console.

**In one paragraph:** the console is one static bundle served for every tenant. It
resolves the tenant from the subdomain and always talks to a real API: the local one in
development, the staging one with `dev:staging`, production in a production build. There
is **no in-browser mock** and no `VITE_USE_MOCK`; the MSW fixtures answer Vitest and the
Playwright fixture (`e2e/fixtures.ts`), and nothing else ([mocks.md](./mocks.md)).

---

## Commands

From the workspace root:

| Command                 | What it does                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `npm install`           | Installs everything. Node ≥ 22.11                                                          |
| `npm run dev`           | Vite dev server on **http://localhost:5273**, against the local API (`.env.development`)  |
| `npm run dev:staging`   | The same dev server against the deployed staging API (`.env.staging`)                     |
| `npm run build`         | Production bundle into `apps/admin/dist`                                                   |
| `npm run build:staging` | Production bundle built with the staging API (`--mode staging`); what Vercel deploys       |
| `npm run preview`       | Serves the built bundle                                                                    |
| `npm run typecheck`     | `tsc --build --force` across the projects                                                  |
| `npm run lint`          | ESLint, including the white-label and layering rules                                       |
| `npm run test`          | Vitest against the MSW fixtures: 588 tests in 80 files (28 October 2026)                   |
| `npm run test:watch`    | Vitest in watch mode                                                                       |
| `npm run e2e`           | Playwright against its own dev server on port 5274, API answered by `e2e/fixtures.ts`. Needs `npx playwright install chromium` once; see Testing |
| `npm run format`        | Prettier                                                                                   |
| `npm run domain:drift`  | Does the backend's copy of `@tfd/domain` match this one? Line endings ignored; defaults to the sibling `../tea-factory-digital-backend` checkout; see CI |

**First run:** start the API (`npm run setup`, then `npm run dev`, in
`tea-factory-digital-backend`), then `npm run dev` here. `.env.development` is committed,
so the console points at `http://localhost:3000/v1` with the `galaboda` tenant and needs no
setup. Sign in with the administrator the backend's `npm run db:seed:dev` prints.

### Choosing a tenant in development

There is no switcher in the screen. In a dev server, add **`?tenant=<slug>`** to the URL
(`/sign-in?tenant=hillside`): `@tfd/brand`'s `resolveTenant` honours it only when
`import.meta.env.DEV` is true, and the tenant is resolved once per page load, so keep the
parameter on any URL you open directly. Without it, `localhost` has no subdomain and
`VITE_DEFAULT_TENANT` answers. The tenant has to exist on the API you point at. A production or staging build ignores the parameter:
there the subdomain is the only answer, so a query string cannot repoint a live console at
another factory.

Only `galaboda` has a bundled brand (`packages/brand/src/clients/index.ts`). Any other
tenant starts on the neutral base brand and repaints in its own colours when `GET /config`
answers. `hillcountry` and `highland` survive only as test data in the mock
([mocks.md](./mocks.md) → Tenants).

---

## Environments

Every value is public configuration compiled into the bundle. **Nothing secret can
go in a `VITE_*` variable**, and there is no mechanism here that would keep it
secret if you tried.

| Variable                  | Default                             | Notes                                                                  |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE_URL`       | `https://api.teafactory.example/v1` | **Placeholder.** `{tenant}` is substituted with the resolved tenant id. Development: `http://localhost:3000/v1` |
| `VITE_DEFAULT_TENANT`     | `base` (`galaboda` in the committed files) | Used only when the host carries no subdomain                    |
| `VITE_SEND_TENANT_HEADER` | `1`                                 | Send `X-Tenant` alongside the subdomain                                |
| `VITE_CSRF_COOKIE`        | `tfd_csrf`                          | Double-submit cookie the API sets. Empty switches the header off (local, `COOKIE_MODE=same-site`); staging sets `tfd_csrf` |
| `VITE_CSRF_HEADER`        | `X-CSRF-Token`                      | Header the cookie's value is echoed back in, on every mutation         |
| `VITE_API_TIMEOUT_MS`     | `20000`                             | **Do not shorten for a rural network** (§20.1). Staging uses 45000 for the free instance's cold start |
| `VITE_SENTRY_DSN`         | empty                               | Error reporting (Sentry). Empty: nothing loaded, nothing sent. A public value by Sentry's design |
| `VITE_SENTRY_ENVIRONMENT` | the build mode                      | How Sentry files the events: `staging`, `production`                   |

Files: `.env.development` (committed, local API) · `.env.staging` (committed, staging API)
· `.env.example` (documented template) · `.env.local` (git-ignored, your overrides).

`assertEnvUsable()` **refuses to boot** a production bundle still pointed at the
placeholder origin. A console that looks fine and reports every failure as a network
problem is the worst available outcome.

---

## Deployment

One build, served for every tenant:

```
galaboda.admin.teafactory.lk    ─┐
<factory>.admin.teafactory.lk    ├─► same static bundle ─► GET /config per subdomain
<factory>.admin.teafactory.lk   ─┘
```

**A new factory is data, not code**: the backend's onboarding command
(`npm run db:seed:tenant`), a DNS record and the console's address in the API's
`CORS_ORIGINS` ([new-factory.md](./new-factory.md)). No console build, no deploy.
That asymmetry with mobile (where a new brand still needs a binary) is expected:
app stores demand binaries, browsers do not.

Host requirements:

1. **SPA fallback**: rewrite unknown paths to `/index.html`, or a refresh on
   `/change-requests/chg-2` is a 404.
2. **Wildcard TLS + DNS** for `*.admin.<domain>`.
3. **Cache `/assets/*` immutably** (hashed filenames), **never cache
   `index.html`**.
4. **CORS on the API**: an explicit origin allowlist with
   `Access-Control-Allow-Credentials: true`; a wildcard origin is illegal with
   credentials, and the refresh cookie needs them. `Access-Control-Allow-Headers`
   must carry `X-Tenant`, `Idempotency-Key` and `X-CSRF-Token`, or the preflight
   fails and every mutation dies before it is sent.
5. **The refresh cookie stays host-only.** Set it on `api.<domain>` and do **not**
   widen `Domain` to `.<domain>`. Host-only is sent to exactly the host that issued
   it, which is all a refresh needs; widening it hands the cookie to every tenant's
   console subdomain and to anything else that ever lives on the parent, which is
   the sibling-subdomain exposure `X-CSRF-Token` then has to compensate for.

   Note what this split does *not* break: `SameSite=Lax` keys on **site**, not
   origin, and the console and the API share one registrable domain. The cookie is
   therefore sent on the cross-origin refresh `POST` as §2.2 specifies, and there is
   no reason to relax it to `SameSite=None`.
6. **`noindex`**: already in `index.html`.

### Vercel: the hosted staging console

`vercel.json` at the repo root configures it, and it deploys the **staging** bundle,
which talks to the staging API (`.env.staging`):

```
installCommand    npm ci                 (workspace root; devDependencies needed, vite is one)
buildCommand      npm run build:staging
outputDirectory   apps/admin/dist
rewrites          /(.*) → /index.html    (requirement 1; Vercel checks the filesystem first,
                                          so /assets/* still wins)
headers           /assets/* immutable, index.html no-cache (requirement 3), noindex and
                  the usual security headers on everything
```

Connect the GitHub repo once in the Vercel dashboard, then **set the root directory
to the repo root, not `apps/admin`**: Vercel offers to "helpfully" detect the app
directory, and taking the offer hides this file. The build is written for the
workspace root: `npm run build:staging` is a root script, and the Vite aliases reach
`packages/` above `apps/admin`. **No environment variables need setting**:
`.env.staging` is committed.

The repo is public, which is what makes this free: Vercel's Hobby plan refuses a
**private** repo owned by a GitHub organization and asks for Pro instead.

**No tenant from the hostname.** The leading label of `*.vercel.app` is a deployment
name, not a factory, so `@tfd/brand` refuses to read it as a tenant (`PLATFORM_DOMAINS`)
and the console falls back to `VITE_DEFAULT_TENANT` (`galaboda`). `?tenant=` is ignored
in this build. A real per-tenant deployment needs the wildcard domain in requirement 2.

### Going to production

Point `VITE_API_BASE_URL` at the real origin and build with `npm run build`. Then the
six host requirements above apply in full, plus the API's CORS allowlist
(`CORS_ORIGINS`), which needs each factory's console address
([new-factory.md](./new-factory.md) step 1).

Release cadence is the thing to design around: **the API and the console can ship
daily, the app cannot.** So the API must stay backward compatible for as long as
old binaries are in the field, and feature flags are the release valve.

---

## Testing

Layered so each layer tests what only it can.

### Vitest: 588 tests in 80 files

Every file runs against the MSW fixtures through the real transport, store and screens
(`test/setup.ts`); only the server is a stand-in. Counts drift with every change, so
re-read them from `npm test` rather than from here. The files worth knowing:

| File | Covers |
| --- | --- |
| `rbac.test.ts` | The §12.1 matrix, grant merging, four-eyes, the approval threshold |
| `money.test.ts` | `floor2`/`round2`, the credit basis, BR-107, account masking |
| `factoryRecords.test.tsx` | Records kept in the console with the sync off: the switch, the factory and platform administrators reading the records but never writing them, Add supplier, imports all rows or none, finished bills taken as printed, opening balances locking on a published bill, walk-in requests, transport per supplier, other deductions, loan and advance interest, bill numbers, and the bill **reproducing the factory's printed slip** to the cent |
| `importedMonth.test.ts`, `slipComparison.test.tsx`, `importSkip.test.tsx` | Imported bills (four-eyes against the importer, a late division file waiting for a manager); calculated bills checked against the printed slips, with hold and release in order; importing a file again (rows already there skipped, `708` matching `0708`) |
| `bills.test.ts` | M5: the slip's arithmetic as identities (AC-03), the coins carry, re-generation, staleness, and the publish lock |
| `credit.test.tsx`, `creditDecided.test.tsx`, `creditRules.test.ts` | M7: the eligibility working (AC-05), `stale-eligibility`, `over-ceiling` on both sides, the configured rule |
| `changeRequests.test.tsx` | M9 and M2 end to end through the real transport |
| `configuration.test.ts`, `configurationScreen.test.tsx` | M14 and **AC-12**: every block editable, the money-bearing refusals, a save reaching the public `GET /config`, a flag turned off making the endpoint behind it refuse (AC-07) |
| `notificationBell.test.tsx`, `dashboard*.test.ts(x)` | The bell (waiting queues and supplier activity) and the dashboard |
| `factorySync.test.ts` | The freshness states (fresh, stale, never), sized against the hourly polling window |
| `content.test.ts`, `notifications.test.ts`, `users.test.ts`, `inquiries.test.tsx`, `reports.test.ts`, `teaPackets.test.ts`, `banners.test.ts` | The other modules, each against its refusals |
| `brand.test.ts`, `languageSwitcher.test.tsx`, `viewportGate.test.tsx`, `logo.test.tsx` | Tenant resolution and the brand bridge, the si/en/ta picker, the 768×480 floor, the logo fallback and boot splash |

`rbac.test.ts` and `money.test.ts` are the highest-value files. The matrix is what
a factory will ask to change, and the ceiling arithmetic is the one place a bug produces
a dispute rather than a crash.

### Playwright: 29 tests in 7 specs

`npm run e2e` starts its own dev server on **port 5274** (never your `npm run dev` on
5273) with `VITE_API_BASE_URL` pointed at `/v1` on that origin, and `e2e/fixtures.ts`
answers every `/v1/**` call in the Node test process from the same MSW handlers Vitest
uses, from a fresh fixture state per test. The browser runs the real app; no call reaches
a real backend, and nothing mock-related is served to the page.

`short-screen.spec.ts` is the odd one out and earns its place: it renders every grid at
five viewports down to 1152×640 and asserts the first row is **inside the viewport**. It
exists because a list collapsing to zero pixels got past the rest of the suite: the rows
were in the DOM, so `toBeVisible()` passed while a human saw nothing.

The rest cover sign-in, a reload keeping the session, the brand bridge painting, a
reduced-feature tenant losing its queues, and a handful of behaviours per module
(`money`, `content`, `notifications`, `administration`, `queues`) that only exist once a
screen renders.

The specs sign in with the fixture's accounts (`clerk@galabodatea.lk` / `demo1234`) and
open `?tenant=hillcountry` and `?tenant=highland`, which exist only in the mock: that is
why the API is answered by the fixture rather than the backend's dev seed.

Viewport is **1366×768**: testing at 1920 hides every layout problem that actually
gets reported.

### Not tested, and known

- **Refresh-token rotation and reuse detection** in the unit tests: the mock is
  deliberately looser here (see [mocks.md](./mocks.md)); only the real backend has it.
- **Visual regression**: no snapshots. The brand-bridge assertion covers the case
  that would otherwise break silently.
- **Screen-reader behaviour**: semantics are built in (real tables, `aria-sort`,
  `role="alert"`, a clean accessible name on every field) but no assistive
  technology has been driven over it.

---

## CI

GitHub Actions, `.github/workflows/ci.yml`, on every push to `main` and every pull
request, on Node 22.11 (the `engines` floor). Three jobs:

- **`verify`**, five steps in this order, each failing faster than the next:
  `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- **`e2e`**: `npx playwright install --with-deps chromium`, then `npm run e2e`. The
  Playwright config sets `forbidOnly` and one retry under `CI` and reports in GitHub
  format; on a failure the traces are uploaded (`playwright-traces`, kept 7 days).
- **`domain-drift`**: checks out the backend and runs `scripts/domain-drift.mjs` against
  it: does its `packages/domain/src` match ours, line endings ignored (a Windows checkout
  has CRLF files holding the same text). **Information, never a blocker**
  (`continue-on-error`): a change to the shared package runs ahead of the backend until it
  runs `vendor:pull`. It runs only once the repository variable `BACKEND_REPO`
  (`owner/name`) is set, with the secret `BACKEND_READ_TOKEN` (read-only) when that
  repository is private. The backend's own nightly `upstream-drift` job asks the same
  question from its side.

---

## Performance

The bundle is split by **change rate**, not size, because one bundle serves every
tenant and the console ships continuously; what matters is how much a returning
clerk re-downloads after a release.

| Chunk                        | gzip    | Loaded           |
| ---------------------------- | ------- | ---------------- |
| `index`                      | ~171 kB | Always           |
| `charts` (Recharts)          | ~105 kB | Only with M1/M16 |
| `data` (Query, Table, axios) | ~44 kB  | Always           |
| `ui` (Radix)                 | ~37 kB  | Always           |
| `react`                      | ~32 kB  | Always           |
| `forms` (RHF, Zod)           | ~29 kB  | Always           |
| `i18n` (i18next)             | ~16 kB  | Always           |
| Each module screen           | 1–9 kB  | On navigation    |
| CSS                          | ~7 kB   | Always           |

**`index` grew by half when the chrome was translated, and the `i18n` chunk did not
move.** Worth knowing which is which: the `i18n` chunk is the i18next *library*; the
string **tables** are in `index`. Building with only `en` registered puts `index` at
**116 kB** against the **171 kB** above, so Sinhala and Tamil cost **~54 kB gzip
between them**, more than two-thirds of what English costs each, because Indic
script is multi-byte UTF-8 and compresses worse than the Latin it mirrors. Two extra
languages are not two-thirds of the price; they are roughly the price again.

Every clerk therefore downloads all three languages to use one. Left that way
deliberately, and for the reason that governs the rest of this section: the console
is a desktop product on office broadband, and 54 kB once is not what office staff are
waiting for. The fix, if that stops being true, is small and already shaped: drop
si/ta from `resources` at init and `addResourceBundle` the chosen table from a dynamic
import inside `setLanguage`. Tracked as a gap in [status.md](./status.md) (#14) rather
than left as a surprise for whoever next reads this table.

Re-measure with `npx vite build`; the numbers above are its own reported gzip figures,
not `gzip -c` on the files, which disagrees by a few kB.

Module screens are lazy, so a sign-in form does not arrive with a charting library
attached. MSW is not in any bundle: nothing the application imports reaches
`services/mocks/`.

The §20.1 payload budget (a bill in one round trip, ≤30 KB) is a **mobile**
constraint and does not apply here: the console is a desktop product on office
broadband. What does apply is that the API is shared: `refetchOnWindowFocus` and
debounced search exist so the office is not competing with the phones on
publication day (§20.5).

### Error reporting

Sentry (`@sentry/react`), in `lib/monitoring.ts`, **off unless `VITE_SENTRY_DSN` is set**.
With a DSN, the SDK loads on its own chunk (`sentrySdk`, about 30 kB gzipped, only the
four functions used) after the first render has started; without one, nothing is loaded.

- **What is sent:** uncaught errors and unhandled rejections (Sentry's own handlers), a
  route that failed to render (`RouteErrorBoundary`), and a query or mutation the
  **server failed** (`5xx`), as `ApiError <code> <status>`. A refusal the screen explains
  (`4xx`) and a dropped connection are not sent. Each event carries the tenant id, the
  environment and the signed-in user's internal id.
- **What is never sent** (§20.4): a server's message (it may quote the request back), a
  query string (a search is somebody's name), cookies, headers, bodies, click
  breadcrumbs (a row's accessible name is a supplier's name), the console's log. No
  performance tracing and no session replay.
- **To switch on:** create a Sentry project (one for the console), set
  `VITE_SENTRY_DSN` and `VITE_SENTRY_ENVIRONMENT` in Vercel for each environment, and
  redeploy. `monitoring.test.ts` holds the rules above.

The app reports to Firebase Crashlytics instead, on the factory's Firebase project (the
mobile repo's operations.md §19.4).

### Not built yet

- **Analytics in the console.** The office's own usage is not instrumented; the KPIs
  that need a `channel` column are a backend concern first (§19.3). The app's analytics
  are built (Firebase, mobile repo).
