# Operations

Running, testing and deploying the console.

---

## Commands

From the workspace root:

| Command              | What it does                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `npm install`        | Installs everything. Node ≥ 22.11                                                         |
| `npm run dev`        | Vite dev server on **http://localhost:5273**, mock API on                                 |
| `npm run build`      | Production bundle into `apps/admin/dist`                                                  |
| `npm run build:demo` | Demo bundle into `apps/admin/dist` — real production build, mock API on (see Deployment)  |
| `npm run preview`    | Serves the built bundle                                                                   |
| `npm run typecheck`  | `tsc --build` across all three projects                                                   |
| `npm run lint`       | ESLint, including the white-label and layering rules                                      |
| `npm run test`       | Vitest — 252 tests                                                                        |
| `npm run e2e`        | Playwright — 28 specs against the dev server. Needs `npx playwright install chromium` once |
| `npm run e2e:demo`   | The same specs against the built demo bundle on a static server                           |
| `npm run format`     | Prettier                                                                                  |

First run needs nothing else: `.env.development` is committed, so a fresh clone
starts against the mock with the `galaboda` tenant resolved and no setup. Sign in
with the credentials printed on the screen.

---

## Environments

Every value is public configuration compiled into the bundle. **Nothing secret can
go in a `VITE_*` variable**, and there is no mechanism here that would keep it
secret if you tried.

| Variable                  | Default                             | Notes                                                                  |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `VITE_API_BASE_URL`       | `https://api.teafactory.example/v1` | **Placeholder.** `{tenant}` is substituted with the resolved tenant id |
| `VITE_USE_MOCK`           | `1` in dev, `0` in prod             | Serve from MSW instead of the network                                  |
| `VITE_DEFAULT_TENANT`     | `galaboda` (dev)                    | Used only when the host carries no subdomain                           |
| `VITE_SEND_TENANT_HEADER` | `1`                                 | Send `X-Tenant` alongside the subdomain                                |
| `VITE_API_TIMEOUT_MS`     | `20000`                             | **Do not shorten for a rural network** (§20.1)                         |

Files: `.env.development` (committed, dev defaults) · `.env.demo` (committed, demo
build) · `.env.example` (documented template) · `.env.local` (git-ignored, your
overrides).

`assertEnvUsable()` **refuses to boot** a production bundle with mocks on or still
pointed at the placeholder origin. A console that looks fine, serves fixtures, and
reports every failure as a network problem is the worst available outcome.

The **demo build is the one exception**, and it is a build mode rather than a
variable: `env.demoMode` reads `import.meta.env.MODE === 'demo'`, so no environment
variable set in a hosting dashboard can turn the real console into a fixture
server — someone has to run a different build command. What a demo build still
cannot do is hide: the permanent mock banner and the printed sign-in credentials
are both keyed off `VITE_USE_MOCK`, so every screen says what it is.

---

## Deployment

One build, served for every tenant:

```
galaboda.admin.teafactory.lk    ─┐
hillcountry.admin.teafactory.lk  ├─► same static bundle ─► GET /config per subdomain
highland.admin.teafactory.lk    ─┘
```

**A new factory is a DNS record and a `client_config` row.** No build, no deploy.
That asymmetry with mobile — where a new brand still needs a binary — is expected:
app stores demand binaries, browsers do not.

Host requirements:

1. **SPA fallback** — rewrite unknown paths to `/index.html`, or a refresh on
   `/change-requests/chg-2` is a 404.
2. **Wildcard TLS + DNS** for `*.admin.<domain>`.
3. **Cache `/assets/*` immutably** (hashed filenames), **never cache
   `index.html`**.
4. **CORS on the API**: an explicit origin allowlist with
   `Access-Control-Allow-Credentials: true` — a wildcard origin is illegal with
   credentials, and the refresh cookie needs them.
5. **`noindex`** — already in `index.html`.

### Vercel — the hosted demo

`vercel.json` at the repo root configures it, and it deploys the **demo** bundle:

```
installCommand    npm ci                 (workspace root; devDependencies needed — vite is one)
buildCommand      npm run build:demo
outputDirectory   apps/admin/dist
rewrites          /(.*) → /index.html    (requirement 1; Vercel checks the filesystem first,
                                          so /assets/* and /mockServiceWorker.js still win)
headers           /assets/* immutable, index.html and the worker no-cache (requirement 3)
```

Connect the GitHub repo once in the Vercel dashboard, then **set the root directory
to the repo root, not `apps/admin`** — Vercel offers to "helpfully" detect the app
directory, and taking the offer hides this file. The build is written for the
workspace root: `npm run build:demo` is a root script, and the Vite aliases reach
`packages/` above `apps/admin`. **No environment variables need setting**;
`.env.demo` is committed, and adding a `VITE_*` override in the dashboard cannot
promote the demo to a real deployment (see Environments).

The repo is public, which is what makes this free: Vercel's Hobby plan refuses a
**private** repo owned by a GitHub organization and asks for Pro instead.

Two things this hosting cannot give you, both by design:

- **No tenant from the hostname.** The leading label of `*.vercel.app` is a
  deployment name, not a factory, so `@tfd/brand` refuses to read it as a tenant
  (`PLATFORM_DOMAINS`) and the demo falls back to `VITE_DEFAULT_TENANT`. A real
  per-tenant deployment needs the wildcard domain in requirement 2. The switcher in
  the topbar is how the demo shows a rebrand instead.
- **No real records.** Every request is answered by MSW in the page, so the demo is
  a UI review, never a data review. Nothing survives a reload.

`npm run build:demo && npm run e2e:demo` is the check that the artefact actually
boots — it catches the demo-only failures (`assertEnvUsable()` throwing, MSW
tree-shaken out, the tenant resolving to a deployment name) that a dev-server test
run cannot see.

### Going to production

Point `VITE_API_BASE_URL` at the real origin and build with `npm run build` — the
mock is not merely off in that bundle, it is not in it. Then the five host
requirements above apply in full, plus the API's CORS allowlist.

Release cadence is the thing to design around: **the API and the console can ship
daily, the app cannot.** So the API must stay backward compatible for as long as
old binaries are in the field, and feature flags are the release valve.

---

## Testing

Layered so each layer tests what only it can.

### Vitest — 284 tests

| File                           | Covers                                                                    |
| ------------------------------ | ------------------------------------------------------------------------- |
| `brand.test.ts` (22)           | Tenant resolution, CSS-variable emission, dp→px, served-value validation  |
| `changeRequests.test.tsx` (17) | M9 and M2 end to end against the mock API, through the real transport     |
| `rbac.test.ts` (15)            | The §12.1 matrix, grant merging, four-eyes, the approval threshold        |
| `money.test.ts` (13)           | `floor2`/`round2`, the credit basis, BR-107, account masking              |
| `payouts.test.ts` (14)         | M6: every refusal money can hit — an unpublished month, four-eyes on the release, a draft that cannot be paid from, a failure with no reason — plus held lines staying counted and totals derived from lines |
| `bills.test.ts` (13)           | M5: the slip's arithmetic as identities (AC-03), BR-107 balance, the whole-rupee/coins carry, re-generation, staleness, and the publish lock |
| `monthClose.test.ts` (12)      | M4: the rate, exception resolution, and all seven publish refusals        |
| `savings.test.ts` (11)         | M8: the balance tying to the ledger, the ledger tying to published bills, the registry tying to both (AC-01) — and AC-07's endpoint half |
| `deliveries.test.ts` (9)       | M3: batch commit and its idempotent replay, per-row rejections, the void, `month-locked`, and the day totals the dashboard reads |
| `notifications.test.ts` (15)   | M13: the refusals a push has no feedback loop for, consent honoured per device, and each automatic trigger fired by doing the real thing — publishing a month, publishing an article, answering a message |
| `content.test.ts` (20)         | M11/M12 and **AC-08 end to end**: the preview resolving as `content.ts` does, gaps derived against the tenant's own languages, stale copy, and the write/publish split |
| `credit.test.tsx` (23)         | M7: the eligibility working as identities (AC-05), `stale-eligibility`, `over-ceiling` on both sides, and an approval raising the balance the next bill deducts against |
| `users.test.ts` (20)           | M15: all three lockouts — the last administrator, self-modification, and the **matrix** in which no role grants recovery — plus the mandatory reasons and a suspension taking effect on the next request |
| `configuration.test.ts` (16)   | M14 and **AC-12**: every block of the row editable, the money-bearing refusals with their figures, a save reaching the public `GET /config`, and a flag turned off here making the endpoint behind it refuse (AC-07) |
| `inquiries.test.tsx` (15)      | M10: reply and close as different acts, §21.18's status mapping, and the reply screen reading M13's trigger |
| `reports.test.ts` (12)         | M16: each report tied to the module its figures come from, `null` kept as `null`, totals only where they mean something, and a factory administrator running a month report without a `billing` grant |
| `listSorting.test.ts` (5)      | Server-side sort and pagination parameters                                |
| `languageSwitcher.test.tsx` (9) | The si/en/ta picker: every option staying in **its own script** whatever the active language is (the regression that would strand the reader the control exists for), the choice surviving a reload, `<html lang>` following it, one tab stop rather than three, and the arrow keys wrapping. Installs a working `localStorage` per test — this environment's is an empty object while `sessionStorage` is real, which the guards in `src/i18n` swallow by design |
| `viewportGate.test.tsx` (6)    | The 768×480 floor: a phone getting the notice, the office's own 1366×768 laptop **not** getting it, a landscape phone that clears the width but not the height, and the notice retiring when a dragged window comes back over the floor |
| `logo.test.tsx` (6)            | The mark's `served → bundled → initials` fallback as each source fails — and the **boot splash** with it: naming the factory, covering the app rather than gating it, and giving up on a boot that never settles |
| `spinner.test.tsx` (4)         | `Spinner`/`SpinnerMark`: announced once and not per frame, the arc drawn in the brand colour, size from the variant |
| `confirmDialog.test.tsx` (2) · `userDialogValidation.test.tsx` (2) · `configurationScreen.test.tsx` (2) · `screenSmoke.test.tsx` (1) | The confirm step standing between a click and a user action, email-format validation surfacing and clearing in the user dialog, M14 opening on its factory section and refusing an office email that is not one, and a render pass over a list screen's filters and rows |

`rbac.test.ts` and `money.test.ts` are the highest-value files. The matrix is what
a factory will ask to change, and status.md §10 item 10 records that **no tests
cover the credit rules** in the mobile app — the ceiling arithmetic is the one
place a bug produces a dispute rather than a crash.

`changeRequests.test.tsx` goes through the real transport, store and screens; only
the server is a stand-in. A test that stubbed the repository would pass while the
interceptor flattened every error code.

### Playwright — 28 specs

`short-screen.spec.ts` is the odd one out and earns its place: it renders every grid at
five viewports down to 1152×640 and asserts the first row is **inside the viewport**. It
exists because a list collapsing to zero pixels got past the rest of the suite — the rows
were in the DOM, so `toBeVisible()` passed while a human saw nothing.

Narrow on purpose: only what jsdom cannot prove — plus, in four module specs
(`money`, `content`, `notifications`, `administration`), the handful of behaviours that
only exist once a screen renders. `administration.spec.ts` earned its keep immediately: it
found that M16's month picker was fed from a `billing`-gated endpoint, so the factory
administrator — who holds `reports: R` and no `billing` — could not run a single month
report. Every unit test passed, because they called the repository and never rendered the
picker.

1. **Sign-in → dashboard** — proves the service worker registers and the whole
   session flow works in a browser.
2. **Survives a page reload** — the access token is in memory by design, so a
   fresh document must recover the session from the refresh cookie. Covers
   reload, a cold deep link, and that signing out then reloading stays signed
   out. Regression test: this failed once, and a console that logs you out on
   every refresh is unusable.
3. **The brand bridge paints** — asserts `--brand-color-primary` computes to
   Galaboda's green, then that `?tenant=hillcountry` repaints without a rebuild.
   The entire white-label mechanism in one assertion.
4. **A reduced-feature tenant loses its queues** — `highland` must have no loan or
   manure rows at all.

Viewport is **1366×768**: testing at 1920 hides every layout problem that actually
gets reported.

### Not tested, and known

- **Refresh-token rotation and reuse detection** — the mock is deliberately looser
  here (see [mocks.md](./mocks.md)); this needs the real backend.
- **Visual regression** — no snapshots. The brand-bridge assertion covers the case
  that would otherwise break silently.
- **Screen-reader behaviour** — semantics are built in (real tables, `aria-sort`,
  `role="alert"`, a clean accessible name on every field) but no assistive
  technology has been driven over it.

---

## CI

Five steps, in this order — each fails faster than the next:

```yaml
- npm ci
- npm run typecheck
- npm run lint
- npm run test
- npm run build
```

Add `npm run e2e` behind `npx playwright install --with-deps chromium`. The
Playwright config already sets `forbidOnly` and one retry under `CI`, and reports
in GitHub format.

---

## Performance

The bundle is split by **change rate**, not size, because one bundle serves every
tenant and the console ships continuously — what matters is how much a returning
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
between them** — more than two-thirds of what English costs each, because Indic
script is multi-byte UTF-8 and compresses worse than the Latin it mirrors. Two extra
languages are not two-thirds of the price; they are roughly the price again.

Every clerk therefore downloads all three languages to use one. Left that way
deliberately, and for the reason that governs the rest of this section: the console
is a desktop product on office broadband, and 54 kB once is not what office staff are
waiting for. The fix, if that stops being true, is small and already shaped — drop
si/ta from `resources` at init and `addResourceBundle` the chosen table from a dynamic
import inside `setLanguage`. Tracked as a gap in [status.md](./status.md) (#14) rather
than left as a surprise for whoever next reads this table.

Re-measure with `npx vite build`; the numbers above are its own reported gzip figures,
not `gzip -c` on the files, which disagrees by a few kB.

Module screens are lazy, so a sign-in form does not arrive with a charting library
attached. MSW is **eliminated** from production, not merely unloaded — the guard is
`import.meta.env.DEV && env.useMock`, so Vite drops the branch.

The §20.1 payload budget (a bill in one round trip, ≤30 KB) is a **mobile**
constraint and does not apply here — the console is a desktop product on office
broadband. What does apply is that the API is shared: `refetchOnWindowFocus` and
debounced search exist so the office is not competing with the phones on
publication day (§20.5).

### Not built yet

- **Error reporting.** `sentryDsn` is a placeholder in the mobile config and there
  is no SDK behind it on either side. A console error currently reaches
  `console.error` and nowhere else.
- **Analytics.** §19.4 is greenfield. The console's own instrumentation is not
  started; the KPIs that need a `channel` column are a backend concern first
  (§19.3).
