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
docs/v2/      Current: the module map, the API contract, the backend's to-do, status
```

## Two modes: the factory-system sync

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

With the sync off the bills come one way per factory (Configuration → Bill calculation):
**imported** from the factory's own system exactly as printed (galaboda), or
**calculated** here from the leaf, the rate and the deduction rates.

Details: [docs/v2/modules.md](./docs/v2/modules.md) and
[docs/v2/factory-records.md](./docs/v2/factory-records.md).
[docs/v2/status.md](./docs/v2/status.md) is the gap list, including what the console hides
until the backend ships it (`apps/admin/src/lib/serverReady.ts`); nothing is quietly
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
| `npm run test`       | Vitest against the MSW mock, 565 tests in 77 files               |
| `npm run e2e`        | Playwright, 29 tests in 7 specs, on its own dev server (port 5274) with the API answered by the MSW handlers (`apps/admin/e2e/fixtures.ts`; `npx playwright install chromium` once) |

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

Start at [docs/v2/README.md](./docs/v2/README.md).

|                                                |                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [BACKEND-TODO.md](./docs/v2/BACKEND-TODO.md)   | **For the backend developer**: what is still open, in order, and what the console hides until then |
| [api-contract.md](./docs/v2/api-contract.md)   | Every endpoint, payload and refusal, and the agreed shapes                                  |
| [factory-records.md](./docs/v2/factory-records.md) | Sync off: the factory's records kept in the console, imports, bills imported or calculated |
| [new-factory.md](./docs/v2/new-factory.md)     | Adding a new factory, step by step                                                          |
| [architecture.md](./docs/v2/architecture.md)   | Layers, state, start-up, security posture                                                   |
| [white-label.md](./docs/v2/white-label.md)     | Runtime branding, the Tailwind and token bridge, the feature flags                          |
| [design-system.md](./docs/v2/design-system.md) | Tokens, components, density, accessibility                                                  |
| [rbac.md](./docs/v2/rbac.md)                   | The permission matrix and where it is really enforced                                       |
| [modules.md](./docs/v2/modules.md)             | What each module decides, and which screens appear only with the sync off                   |
| [mocks.md](./docs/v2/mocks.md)                 | The mock API the Vitest and Playwright suites run against                                   |
| [operations.md](./docs/v2/operations.md)       | Environments, deployment, testing, CI                                                       |
| [status.md](./docs/v2/status.md)               | **What is built, what the backend has, known gaps, open questions**                         |

**v1 (the seventeen-module console) is in git history, not in the tree.** Recover it with
`git log -- docs/v1/` and `git show <rev>:docs/v1/<file>`.

The product specification, what the console is for and why, lives in the mobile
repository's `docs/`, and nothing here restates it. `BR-###`, `AC-##` and `§n`
references throughout point there.
