# Tea Factory Digital: admin console documentation (v2)

**This console manages the mobile app.** The platform's product is the supplier app; the
console is the office's side of it: every `pending` in the app is a queue here, every flag
the app reads is a control here, and every figure the app shows has to come from somewhere.

Where those figures come from is the one thing that differs between factories, and it is
a switch (Configuration → **Factory system**).

## Two modes

| | Factory system sync **on** | Factory system sync **off** (the default) |
| --- | --- | --- |
| Where suppliers, leaf, rates and bills come from | The factory's own system, pulled every hour | The office, in this console |
| What the console is | App management: queues, content, notifications, configuration, users, audit, and a read-only view of the bills for support | All of that, **plus** the factory's records |
| Extra screens | None. `/deliveries` and `/rates` say the records come from the factory system | Sidebar section **Factory records**: **Leaf intake** (`/deliveries`) and **Rates & month close** (`/rates`); **Add supplier**, opening balances and transport rate per supplier; **walk-in credit requests**; other deductions on a bill; **Import from file** (Excel or CSV, all rows or none) on each of them |
| Record writes on the API | Refused, `409 factory-sync-on` | Allowed |

One source at a time: a factory either syncs or keeps its records here, never both.

**With the sync off, the bills come one way per factory** (Configuration → **Bill
calculation** → "Where the bills come from", `billSettings.source`):

- **Imported**: the factory's own system still prints the bills; each month the office
  imports the finished bills (Import → Finished bills) and the console stores them exactly
  as printed. They must equal the factory's final figures. Galaboda works this way.
- **Calculated**: the console works them out from the leaf, the month's rate and the
  approved deduction rates (`computeBillAmounts` in `packages/domain/src/bill.ts`), then
  the office reviews and publishes them.

The full contract for sync off is [factory-records.md](./factory-records.md); what the
backend still has to build for it, and what the console hides until then, is
[BACKEND-TODO.md](./BACKEND-TODO.md). Setting up a new factory in either mode is
[new-factory.md](./new-factory.md).

## Where to start

| You are | Read | Then |
| --- | --- | --- |
| **Backend developer** | [BACKEND-TODO.md](./BACKEND-TODO.md): what is still open, in order | [factory-records.md](./factory-records.md) for the sync-off contract, [api-contract.md](./api-contract.md) for every endpoint, payload and refusal (including "Agreed shapes") |
| **Adding a factory** | [new-factory.md](./new-factory.md): the slug, the backend command, DNS, configuration, records, the app build | [white-label.md](./white-label.md), [bank-catalogue.md](./bank-catalogue.md) |
| **Building the bridge to the factory's system** (sync on) | [factory-integration-spec.md](./factory-integration-spec.md): the design, and which audience gets which document | [factory-system-team.md](./factory-system-team.md) with [factory-updates-sample.json](./factory-updates-sample.json), [platform-team.md](./platform-team.md) |
| **Front-end developer joining** | [architecture.md](./architecture.md), [white-label.md](./white-label.md), [design-system.md](./design-system.md) | [modules.md](./modules.md) for what is built, [status.md](./status.md) for what is not |
| **Reviewing the console** | [status.md](./status.md): what works, what is hidden until the backend ships, known gaps | [modules.md](./modules.md) |
| **Factory management** | [factory-management.md](./factory-management.md): the decisions only the factory can make | |

## The documents

| Document | What is in it |
| --- | --- |
| [modules.md](./modules.md) | The module map: every screen, what it decides, and which ones appear only with the sync off |
| [status.md](./status.md) | What is built, what the backend has, what the console hides until it ships, known gaps, open questions |
| [factory-records.md](./factory-records.md) | **Sync off**: the switch, the screens, entry and Excel/CSV import, the API, how bills are imported or calculated, credit rules while records are kept here |
| [BACKEND-TODO.md](./BACKEND-TODO.md) | The backend's open work only, in order, what the console hides in `lib/serverReady.ts`, and the decisions behind it (what is done is in [status.md](./status.md)) |
| [new-factory.md](./new-factory.md) | **Adding a new factory**, step by step: the slug, `npm run db:seed:tenant`, DNS, the console configuration, the factory's records (sync on or off), and the per-factory app build |
| [api-contract.md](./api-contract.md) | Base URL, auth realm, every endpoint with payloads, the error envelope, and the agreed shapes |
| [architecture.md](./architecture.md) | The workspace, the layer boundaries, the provider stack, state |
| [white-label.md](./white-label.md) | Runtime brand resolution, the Tailwind and token bridge, and the feature flags |
| [rbac.md](./rbac.md) | The §12.1 permission matrix as data, four-eyes, where authorization is enforced |
| [design-system.md](./design-system.md) | Tokens, components, density, tables, forms, accessibility |
| [mocks.md](./mocks.md) | The mock API the Vitest and Playwright suites run against: what it enforces and its fixtures |
| [operations.md](./operations.md) | Commands, environments, deployment per subdomain, testing, CI |
| [factory-integration-spec.md](./factory-integration-spec.md) | **Sync on: the shared core**, and the front door to the documents below. The duplicate-prevention handshake, the office workflow, who decides what |
| [factory-system-team.md](./factory-system-team.md) | **The document to hand the factory's own dev team.** The endpoint field by field, the volumes, the fallbacks |
| [factory-updates-sample.json](./factory-updates-sample.json) | A complete, valid sample response for that endpoint (bill `2026210869` is a real slip). Send it with factory-system-team.md |
| [platform-team.md](./platform-team.md) | This side's work for the sync: consuming the endpoint, the credit ceiling, the freshness indicator |
| [factory-management.md](./factory-management.md) | **Non-technical.** The decisions only the factory's owner can make |
| [bank-catalogue.md](./bank-catalogue.md) | Where the bank and branch list lives and the decisions behind it |
| [sri-lanka-banks.seed.json](./sri-lanka-banks.seed.json) | The bank catalogue as JSON: 45 institutions, 3,682 branches, with clearing codes. The backend seeds `client_config.banks` from it |
| [static-pages.seed.json](./static-pages.seed.json) | The six default static pages (FAQ, terms, privacy and the rest) in en/si/ta that every factory starts with |
| [open-questions-reply.md](./open-questions-reply.md) | The console's answers to the backend's `open-questions.md`, checked against the code |
| `tea-factory-digital-admin-frontend.code-workspace` | A VS Code workspace opening the console, backend, mobile and website repositories together |

**v1 (the seventeen-module console) is in git history, not in the tree.** Recover it with
`git log -- docs/v1/` and `git show <rev>:docs/v1/<file>`.

## One rule binds all of it

**The supplier's app and this console are two views of the same records.** Nothing is
computed in one place and re-derived in the other, which is why `packages/domain` exists:
the bill (`bill.ts`), the credit arithmetic (`leafCredit.ts`), the deduction rates
(`deductionRates.ts`), the import columns and checks (`factoryRecords.ts`) and the banner
action resolver (`banners.ts`) are shared code. The backend vendors the package
(`vendor:pull`); the app carries ports of the rules it runs.

## Conventions in these documents

- **`BR-###`, `AC-##` and `§n`** cite the mobile repo's `docs/`. They are stable ids; an
  `AC-02` here is the same `AC-02` there.
- **A gap is written down as a gap**, in [status.md](./status.md), never implied by a
  disabled button.
- **Decisions record their reason**, because the next person's instinct will be to change
  them.
- **No em dash characters**; a "no value" is shown as `-`.
