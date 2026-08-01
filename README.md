# Tea Factory Digital — admin console

The office half of every flow the supplier app can only ask for: where the leaf is
recorded, the rate is entered, the month is closed, and every request is decided.

One React bundle serves every factory. Which factory it shows is resolved at
**runtime**, from the subdomain — so a new tenant is a DNS record and a config
row, not a build.

```bash
npm install
npm run dev          # http://localhost:5273 — runs on a mock API, no backend needed
```

Sign in with the credentials printed on the screen (`clerk@galabodatea.lk` /
`demo1234`). Which one you pick decides what you can see: the §12.1 matrix gives
**leaf entry to the weigher**, the **month close to the accountant**, and the
**publish to the manager**, so a walkthrough of M3 and M4 needs more than the
clerk. All four demo accounts are on the sign-in screen.

---

## What is here

```
packages/
  domain/     @tfd/domain — types, the RBAC matrix, credit arithmetic, Zod schemas.
              Framework-free: shared with the API and, later, the mobile app.
  brand/      @tfd/brand  — design tokens + the CSS-custom-property bridge that
              makes Tailwind's build-time classes resolve to runtime brand values.
apps/
  admin/      React 19 · Vite · Tailwind v4 · TanStack Query/Table · Radix · MSW
docs/         Architecture, the API contract, and what is deliberately unfinished
```

**Built:** M1 Dashboard · M2 Suppliers · **M3 Leaf collection** · **M4 Rates &
month close** · **M5 Bills** · **M6 Payouts** · **M8 Savings** · M9 Change
requests · M17 Audit log, on a foundation of runtime white-labelling, a separate
console auth realm with MFA, and capability-based access control. The other 8
modules from §18.1 appear in the sidebar as _Planned_ rows — see
[docs/modules.md](./docs/modules.md).

M3 and M4 are the pair §18.2 calls the ones the project succeeds or fails on: the
leaf is recorded at the weighing point in one keyboard-driven session per day, and
the month is closed on a rate that a second person publishes, with every open
exception resolved by name first.

M5, M6 and M8 are the chain those two feed, and they are one slice because they are
one fact: a bill is a read model over the leaf and the rate, a payout line pays a
bill, and a savings contribution *is* a bill's savings deduction. Nothing is derived
twice — which is what stops the office reconciling the console against itself.

**The backend does not exist yet.** The console runs against an in-browser mock
that enforces every rule the real API must, and
[docs/api-contract.md](./docs/api-contract.md) specifies each endpoint. Hand that
document to the backend developer; when the API lands, two environment variables
switch to it.

---

## Commands

| Command              |                                                                  |
| -------------------- | ---------------------------------------------------------------- |
| `npm run dev`        | Dev server, mock API on                                          |
| `npm run build`      | Production bundle                                                |
| `npm run build:demo` | Demo bundle — production build, mock API on, for preview hosting |
| `npm run typecheck`  | `tsc --build`, all three projects                                |
| `npm run lint`       | Includes the white-label and layering rules                      |
| `npm run test`       | Vitest — 131 tests                                               |
| `npm run e2e`        | Playwright — 7 specs (`npx playwright install chromium` once)    |
| `npm run e2e:demo`   | The same specs against the built demo bundle                     |

---

## The rules this codebase enforces

Three are checked by the linter; the rest are conventions the code follows
consistently. All of them come from the product spec in the mobile repo's `docs/`.

1. **Never hardcode a colour, size or string.** `bg-primary`, `p-lg`, `t('key')`.
   `bg-[#128C7E]` is a lint error — there is no legal way to write a colour into a
   component, which is what keeps every surface re-brandable.
2. **Never branch on the tenant id.** Gate on a feature flag, so a new factory is
   pure configuration.
3. **UI never imports axios.** `screen → hook → repository → endpoint → apiClient`,
   enforced by import rules. The repository is the seam that absorbs a backend
   returning something slightly different.
4. **`null` is not `0`.** A rate-derived field that is `null` means the auction
   result is not in, and renders as an em dash — never a figure the office would
   have to explain.
5. **Ceilings truncate, amounts round.** Shared arithmetic in `@tfd/domain`, not
   re-derived per consumer: a ceiling rounded up is a maximum the supplier cannot
   type.
6. **The console authorizes nothing.** Every hidden button and route guard is a
   courtesy; the server enforces per endpoint.

---

## Documentation

Start at [docs/README.md](./docs/README.md).

|                                             |                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [api-contract.md](./docs/api-contract.md)   | **For the backend developer** — every endpoint, payload and refusal, with a build checklist |
| [architecture.md](./docs/architecture.md)   | Layers, state, start-up, security posture                                                   |
| [white-label.md](./docs/white-label.md)     | Runtime branding, the Tailwind ↔ token bridge, feature flags, adding a tenant               |
| [design-system.md](./docs/design-system.md) | Tokens, components, density, accessibility                                                  |
| [rbac.md](./docs/rbac.md)                   | The permission matrix and where it is really enforced                                       |
| [modules.md](./docs/modules.md)             | What each of the 17 modules does and needs                                                  |
| [mocks.md](./docs/mocks.md)                 | The mock API and how to leave it behind                                                     |
| [operations.md](./docs/operations.md)       | Environments, deployment, testing, CI                                                       |
| [status.md](./docs/status.md)               | **Known gaps and the questions blocking specific modules**                                  |

The product specification — what the console is for and why — lives in the mobile
repository's `docs/`, and nothing here restates it. `BR-###`, `AC-##` and `§n`
references throughout point there.
