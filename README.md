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
docs/v2/      Current: architecture, the API contract, what is deliberately unfinished
docs/v1/      The seventeen-module console, kept unchanged as the reference build
```

## v2 — this console manages the mobile app

**It does not run the factory.** The factory already has its own console for its
internal processes, so v2 hands back the four modules that were building a second
answer to questions that already had one — leaf collection, rates & month close,
payouts and savings. Two systems recording the same weighing is not redundancy; it is
a reconciliation somebody does by hand every month.

**Built:** M1 Dashboard (app adoption and content health) · M2 Suppliers (the app
account) · M5 Bills (read-only, for support) · M7 Credit queues · **M18 Tea packets** ·
M9 Change requests · M10 Inquiries · M11 News **and promo banners** · M12 Static
content · M13 Notifications · M14 Configuration · M15 Users & roles · M16 Reports
(app adoption) · M17 Audit log.

Narrowing the scope is the smaller half of what v2 did. Reading the app against the
console turned up three drifts, each one a supplier looking at something the office
could not see:

- **The app has fourteen feature flags; the console had ten.** Six the app gates real
  screens on had no control anywhere, which made AC-12 false on the very screen that
  *is* AC-12. Two were console-only.
- **Tea packets did not exist here.** The app has shipped `RequestTeaPacketsScreen`
  since its first release; this console had no type, no endpoint, no queue and no flag.
  A supplier could ask, and nothing could answer. That is now M18.
- **There was no banner editor**, though the flag, the type and the full specification
  all shipped. A factory that turned the switch on got nothing.

**Nothing was deleted.** Every handed-back screen, handler, fixture and spec is still
in the tree, commented out with the reason at the point of the change — because the
mock handlers are the only written statement of what those flows require, and the
factory's own console has to satisfy every one of them.

[docs/v2/status.md](./docs/v2/status.md) is the gap list; nothing is quietly assumed to
be solved.

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
[docs/v2/api-contract.md](./docs/v2/api-contract.md) specifies each endpoint. Hand that
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

Start at [docs/v2/README.md](./docs/v2/README.md).

|                                                |                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [api-contract.md](./docs/v2/api-contract.md)   | **For the backend developer** — every endpoint, payload and refusal, with a build checklist |
| [architecture.md](./docs/v2/architecture.md)   | Layers, state, start-up, security posture                                                   |
| [white-label.md](./docs/v2/white-label.md)     | Runtime branding, the Tailwind ↔ token bridge, **the fourteen flags**, adding a tenant      |
| [design-system.md](./docs/v2/design-system.md) | Tokens, components, density, accessibility                                                  |
| [rbac.md](./docs/v2/rbac.md)                   | The permission matrix and where it is really enforced                                       |
| [modules.md](./docs/v2/modules.md)             | What each module decides, and what moved to the factory's own console                       |
| [mocks.md](./docs/v2/mocks.md)                 | The mock API and how to leave it behind                                                     |
| [operations.md](./docs/v2/operations.md)       | Environments, deployment, testing, CI                                                       |
| [status.md](./docs/v2/status.md)               | **Known gaps and the questions blocking specific modules**                                  |

**[docs/v1/](./docs/v1/) is kept unchanged** — the seventeen-module console as it was
designed and documented. It is the specification the factory's own build should be read
against, and where the handed-back modules' open questions still live.

The product specification — what the console is for and why — lives in the mobile
repository's `docs/`, and nothing here restates it. `BR-###`, `AC-##` and `§n`
references throughout point there.
