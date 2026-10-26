# Tea Factory Digital: admin console

The office's side of the supplier app. Every request a supplier makes in the app is a
queue here, every flag the app reads is a control here, and, for a factory whose own
system is not connected, the office keeps the factory's records here so the app has
figures to show.

One React bundle serves every factory. Which factory it shows is resolved at
**runtime**, from the subdomain, so a new factory is data and configuration, not a build
([docs/v2/new-factory.md](./docs/v2/new-factory.md)).

```bash
npm install
npm run dev          # http://localhost:5273, talking to the API on http://localhost:3000/v1
```

The console has no in-browser mock: it needs the API. Start the backend
(`tea-factory-digital-backend`: `npm run setup`, then `npm run dev`); its development
seed creates the `galaboda` factory and one administrator, `admin@galaboda.test` /
`development-only-password`. Or run against staging (below).

---

## What is here

```
packages/
  domain/     @tfd/domain - types, the RBAC matrix, credit and bill arithmetic, import
              columns and checks, Zod schemas. Framework-free: the backend vendors it.
  brand/      @tfd/brand  - design tokens + the CSS-custom-property bridge that
              makes Tailwind's build-time classes resolve to runtime brand values.
apps/
  admin/      React 19 · Vite · Tailwind v4 · TanStack Query/Table · Radix
              (MSW in the Vitest and Playwright suites only)
docs/v2/      The documentation: see "Documentation" below
```

## Two modes: the factory-system sync

**This console manages the mobile app.** The platform's product is the supplier app; the
console is the office's side of it: every `pending` in the app is a queue here, every flag
the app reads is a control here, and every figure the app shows has to come from somewhere.
Where those figures come from is the one thing that differs between factories, and it is
a switch (Configuration → **Factory system**).

| | Factory system sync **on** | Factory system sync **off** (the default) |
| --- | --- | --- |
| Where suppliers, leaf, rates and bills come from | The factory's own system, pulled every hour (backend Phase 10, not built yet) | The office, in this console |
| What the console is | App management: queues, content, notifications, configuration, users, audit, and a read-only view of the bills for support | All of that, **plus** the factory's records |
| Extra screens | None. `/deliveries` and `/rates` say the records come from the factory system | Sidebar section **Factory records**: **Leaf intake** (`/deliveries`) and **Rates & month close** (`/rates`); **Add supplier**, opening balances and transport rate per supplier; **walk-in credit requests**; other deductions on a bill; **Import from file** (Excel or CSV, all rows or none) on each of them |
| Record writes on the API | Refused, `409 factory-sync-on` | Allowed |

One source at a time: a factory either syncs or keeps its records here, never both.

**Sync on.** The factory's own system feeds suppliers, leaf, rates and bills
to the platform every hour. The console manages the app: M1 Dashboard, M2 Suppliers, M5
Bills (read-only, for support), M7 Credit queues, M18 Tea packets, M9 Change requests, M10
Inquiries, M11 News and promo banners, M12 Static content, M13 Notifications, M14
Configuration, M15 Users & roles, M16 Reports, M17 Audit log, plus the notification bell.

**Sync off** (the default; Configuration → Factory system). The office also keeps the factory's records
in the console: **Add supplier**, opening balances, transport rate per supplier, daily leaf
(**Leaf intake**), the monthly rate and month close (**Rates & month close**, with the
deduction rates and the bill run), bills, **walk-in credit requests** and other
deductions. Every record one at a time or from an Excel/CSV file (all rows or none). These
screens, and the sidebar section "Factory records", appear **only with the sync off**.

With the sync off the bills come one way per factory (Configuration → **Bill
calculation** → "Where the bills come from", `billSettings.source`):

- **Imported**: the factory's own system still prints the bills; each month the office
  imports the finished bills (Import → Finished bills, which creates the month) and the
  console stores them exactly as printed. They must equal the factory's final figures.
  Galaboda works this way.
- **Calculated**: the console works them out from the leaf, the month's rate and the
  approved deduction rates (`computeBillAmounts` in `packages/domain/src/bill.ts`),
  compares each with the factory's printed slip, and the office reviews and publishes them.

Details: [docs/v2/status.md](./docs/v2/status.md#modules) (every module) and
[docs/v2/factory-records.md](./docs/v2/factory-records.md) (the sync-off contract).
[docs/v2/status.md](./docs/v2/status.md) is also the gap list, including what the console
hides until the backend ships it (`apps/admin/src/lib/serverReady.ts`); nothing is quietly
assumed to be solved.

---

## Commands

| Command              |                                                                  |
| -------------------- | ---------------------------------------------------------------- |
| `npm run dev`        | Dev server against a **local** API on `:3000`                    |
| `npm run dev:staging`| Dev server against the **deployed staging** API                  |
| `npm run build`      | Production bundle                                                |
| `npm run build:staging` | Production bundle pointed at staging                          |
| `npm run typecheck`  | `tsc --build`, all three projects                                |
| `npm run lint`       | Includes the white-label and layering rules                      |
| `npm run test`       | Vitest against the MSW mock, 568 tests in 77 files               |
| `npm run e2e`        | Playwright, 29 tests in 7 specs, on its own dev server (port 5274) with the API answered by the MSW handlers (`apps/admin/e2e/fixtures.ts`; `npx playwright install chromium` once) |
| `npm run domain:drift` | Does the backend's copy of `@tfd/domain` match this one (sibling checkout)? |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, the unit tests, the build and the
Playwright suite on every push to `main` and every pull request (operations.md, CI).

### Running against staging

```sh
npm run dev:staging       # -> http://localhost:5273, talking to the deployed API
```

The dev server prints which API it is talking to on startup, so there is never a
question of which one is running:

```
npm run dev            ->  API target  http://localhost:3000/v1
npm run dev:staging    ->  API target  https://tfd-api-fja1.onrender.com/v1
```

Config lives in `apps/admin/.env.staging`, committed on purpose: it holds a public URL
and a tenant slug, nothing secret. The console calls staging **directly**, the way a
deployed console would, which is also the only arrangement that exercises the real
preflight and the real cross-site refresh cookie.

Sign in on tenant `galaboda`. Which account matters:

| Account | Use it for |
| --- | --- |
| `manager@galaboda.lk` | the queues: credit, change requests, tea packets, inquiries |
| `manager2@galaboda.lk` | the second pair of eyes, for four-eyes approval |
| `clerk@galaboda.lk` | the clerk's narrower view |
| `admin@galaboda.lk` | users, content and config; reads the factory records |

⚠️ **The admin account cannot open the credit queue.** That is `factoryAdmin` correctly
having no credit capability (§12.1), not a bug: it reads leaf, rates and bills (`R`) and
changes none of them. Use `manager` for anything in a queue.

**The first request after a quiet period takes about 33 seconds.** Staging is a free
Render instance and it sleeps when idle, so `.env.staging` sets a 45s timeout where local
uses 20s. If the first page load seems to hang, it is the box waking up. Accepted while
we are pre-users; it goes away on a paid instance.

What the backend still has to build is [docs/v2/BACKEND-TODO.md](./docs/v2/BACKEND-TODO.md);
every endpoint, payload and refusal is [docs/v2/api-contract.md](./docs/v2/api-contract.md).

---

## The rules this codebase enforces

Three are checked by the linter; the rest are conventions the code follows
consistently. All of them come from the product spec in the mobile repo's `docs/`.

1. **Never hardcode a colour, size or string.** `bg-primary`, `p-lg`, `t('key')`.
   `bg-[#128C7E]` is a lint error: there is no legal way to write a colour into a
   component, which is what keeps every surface re-brandable.
2. **Never branch on the tenant id.** Gate on a feature flag, so a new factory is
   pure configuration.
3. **UI never imports axios.** `screen → hook → repository → endpoint → apiClient`,
   enforced by import rules. The repository is the seam that absorbs a backend
   returning something slightly different.
4. **`null` is not `0`.** A rate-derived field that is `null` means the auction
   result is not in, and renders as a dash (`-`), never a figure the office would
   have to explain.
5. **Ceilings truncate, amounts round.** Shared arithmetic in `@tfd/domain`, not
   re-derived per consumer: a ceiling rounded up is a maximum the supplier cannot
   type.
6. **The console authorizes nothing.** Every hidden button and route guard is a
   courtesy; the server enforces per endpoint.

---

## Documentation

Everything is in `docs/v2/`. Start from the row for who you are.

| Document | Reader | What is in it |
| --- | --- | --- |
| [status.md](./docs/v2/status.md) | Anyone reviewing or planning; a front-end developer joining | **What is built, module by module, and what is open**: what the backend has, what the console hides until it ships, the module map and what each module decides (and which screens appear only with the sync off), acceptance criteria, known gaps, open business questions |
| [BACKEND-TODO.md](./docs/v2/BACKEND-TODO.md) | **The backend developer**, first | The backend's open work only, in order, what the console hides in `lib/serverReady.ts`, and the decisions behind it (what is done is in status.md) |
| [factory-records.md](./docs/v2/factory-records.md) | The backend developer, then anyone working on sync off | **Sync off**: the switch, the screens, entry and Excel/CSV import, the API, how bills are imported or calculated, credit rules while records are kept here, and what the factory decided |
| [api-contract.md](./docs/v2/api-contract.md) | The backend developer | Base URL, auth realm, every endpoint with payloads, the error envelope and refusal order, idempotency, and the agreed shapes |
| [new-factory.md](./docs/v2/new-factory.md) | The platform team, the factory administrator, **the factory's owner and management** | **Adding and running a factory**: who does what, the slug, `npm run db:seed:tenant`, DNS, the console configuration, the factory's records, the per-factory app build; the decisions only the factory can make and those it has taken; the roles in the office; the platform team's side of each mode (consuming the sync, the credit ceiling, the freshness indicator) |
| [factory-system-team.md](./docs/v2/factory-system-team.md) | **The factory's own system vendor** (sync on); whoever runs the first meetings | The one read-only endpoint, field by field, the volumes and the fallbacks; then the design behind it: what each side does, how a request is never recorded twice, who decides credit, the three conversations before build |
| [factory-updates-sample.json](./docs/v2/factory-updates-sample.json) | The factory's system vendor | A complete, valid sample response for that endpoint (bill `2026210869` is a real slip). Send it with factory-system-team.md |
| [architecture.md](./docs/v2/architecture.md) | Front-end developer | The workspace, layer boundaries, the provider stack, state, start-up, security posture |
| [white-label.md](./docs/v2/white-label.md) | Front-end developer | Runtime brand resolution, the Tailwind and token bridge, the feature flags |
| [design-system.md](./docs/v2/design-system.md) | Front-end developer | Tokens, components, density, tables, forms, accessibility |
| [rbac.md](./docs/v2/rbac.md) | Front-end and backend developers | The §12.1 permission matrix as data, four-eyes, where authorization is really enforced |
| [mocks.md](./docs/v2/mocks.md) | Front-end developer; the backend developer as a reference implementation | The mock API the Vitest and Playwright suites run against: what it enforces and its fixtures |
| [operations.md](./docs/v2/operations.md) | Whoever deploys | Commands, environments, deployment per subdomain, testing, CI |
| [bank-catalogue.md](./docs/v2/bank-catalogue.md) | Platform team | Where the bank and branch list lives and the decisions behind it |
| [sri-lanka-banks.seed.json](./docs/v2/sri-lanka-banks.seed.json) | Backend seed | The bank catalogue as JSON: 45 institutions, 3,682 branches, with clearing codes. The backend seeds `client_config.banks` from it |
| [static-pages.seed.json](./docs/v2/static-pages.seed.json) | Backend seed | The six default static pages (FAQ, terms, privacy and the rest) in en/si/ta that every factory starts with |
| [tea-factory-digital-admin-frontend.code-workspace](./docs/v2/tea-factory-digital-admin-frontend.code-workspace) | Any developer | A VS Code workspace opening the console, backend, mobile and website repositories together |

**v1 (the seventeen-module console) is in git history, not in the tree.** Recover it with
`git log -- docs/v1/` and `git show <rev>:docs/v1/<file>`. The same goes for the v2
documents since merged into the ones above (the old file names, and where each went, are
in [BACKEND-TODO.md](./docs/v2/BACKEND-TODO.md#docs-merged-in-the-console-repo-update-your-links)).

The product specification, what the console is for and why, lives in the mobile
repository's `docs/`, and nothing here restates it.

**One rule binds all of it: the supplier's app and this console are two views of the same
records.** Nothing is computed in one place and re-derived in the other, which is why
`packages/domain` exists: the bill (`bill.ts`), the credit arithmetic (`leafCredit.ts`), the
deduction rates (`deductionRates.ts`), the import columns and checks (`factoryRecords.ts`)
and the banner action resolver (`banners.ts`) are shared code. The backend vendors the
package (`vendor:pull`); the app carries ports of the rules it runs.

Conventions in these documents:

- **`BR-###`, `AC-##` and `§n`** cite the mobile repo's `docs/`. They are stable ids; an
  `AC-02` here is the same `AC-02` there.
- **A gap is written down as a gap**, in status.md, never implied by a disabled button.
- **Decisions record their reason**, because the next person's instinct will be to change
  them.
- **No em dash characters**; a "no value" is shown as `-`.
