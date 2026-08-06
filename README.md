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
**leaf entry to the weigher**, the **month close to the accountant**, the **publish
to the manager**, and **content to the editor and the factory admin** — so a
walkthrough needs more than the clerk. All six demo accounts are on the sign-in
screen.

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

**Built: all 17 modules.** M1 Dashboard · M2 Suppliers · M3 Leaf collection ·
M4 Rates & month close · M5 Bills · M6 Payouts · M7 Credit queues · M8 Savings ·
M9 Change requests · M10 Inquiries · M11 News · M12 Static content ·
M13 Notifications · **M14 Configuration** · **M15 Users & roles** · **M16 Reports** ·
M17 Audit log — on a foundation of runtime white-labelling, a separate console auth
realm with MFA, and capability-based access control.

Every module has a route, so what is unfinished is no longer module-shaped: it is a
short list of named absences *inside* built modules — the payout file, savings
withdrawals, a deduction editor, CSV export — each blocked on a decision only the
factory can make, and each stated on the screen where somebody would look for the
control. [docs/status.md](./docs/status.md) is the list; nothing is quietly assumed
to be solved.

M3 and M4 are the pair §18.2 calls the ones the project succeeds or fails on: the
leaf is recorded at the weighing point in one keyboard-driven session per day, and
the month is closed on a rate that a second person publishes, with every open
exception resolved by name first.

M5, M6 and M8 are the chain those two feed, and they are one slice because they are
one fact: a bill is a read model over the leaf and the rate, a payout line pays a
bill, and a savings contribution *is* a bill's savings deduction. Nothing is derived
twice — which is what stops the office reconciling the console against itself.

M7 and M10 finish the Queues section, so **every `pending` in the supplier's app is a
queue here** — the promise the whole product rests on. M11 and M12 are the Content
section, and they close AC-08: editorial copy falls back to English when a translation
is missing, and the console makes that gap visible on the tab for the language that has
it, in a "live with a gap" working list, and in the audit entry for the publish.

M13 was built while §21.24 — automatic sends or composed ones, and who may send free text —
was still open, so it is answered as **configuration**: which categories fire is a
per-tenant switch defaulted from the platform's own `push.defaultCategories`, and every
send is preceded by a reach figure that counts who opted out. A push is the only act here
with no undo and no delivery report, so every safeguard is a pre-check.

M14, M15 and M16 are the Administration section, and together they are what makes the
console **handed over** rather than demonstrated. M14 closes AC-12 — a new factory is a
DNS record and a `client_config` row, and every field of that row now has a control, so
nothing about onboarding a factory needs a developer. M15 makes §12.1 editable, which is
what its own specification always claimed it was; its refusals all guard one failure, a
factory locking itself out of a console with no recovery path outside itself. M16 is
deliberately the smallest: four reports, each built from records the console already keeps
and each carrying the citation that justifies it, because the rest need a reporting
warehouse that lives in another repository — and a report nobody asked for is a query
somebody maintains and nobody reads.

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
| `npm run test`       | Vitest — 351 tests                                               |
| `npm run e2e`        | Playwright — 29 specs (`npx playwright install chromium` once)    |
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
| [modules.md](./docs/modules.md)             | What each of the 17 modules decides, and what a real deployment still needs                  |
| [mocks.md](./docs/mocks.md)                 | The mock API and how to leave it behind                                                     |
| [operations.md](./docs/operations.md)       | Environments, deployment, testing, CI                                                       |
| [status.md](./docs/status.md)               | **Known gaps and the questions blocking specific modules**                                  |

The product specification — what the console is for and why — lives in the mobile
repository's `docs/`, and nothing here restates it. `BR-###`, `AC-##` and `§n`
references throughout point there.
