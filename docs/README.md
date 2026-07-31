# Tea Factory Digital — admin console documentation

The office half of every flow the app can only ask for. This is the console the
factory runs: where the leaf is recorded, the rate is entered, the month is
closed, and every request is decided.

The **product** specification lives in the mobile repo's `docs/` — that is the
single statement of what the product does and why, and nothing here restates it.
These documents cover how the console is built and what it needs from the
backend.

## Where to start

| You are | Read | Then |
| --- | --- | --- |
| **Backend developer** | [api-contract.md](./api-contract.md) — every endpoint, payload and refusal, with a checklist for the first PR | The mobile repo's `docs/api.md` §16 for the data model, and `business-rules.md` |
| **Front-end developer joining** | [architecture.md](./architecture.md) · [white-label.md](./white-label.md) · [design-system.md](./design-system.md) | [modules.md](./modules.md) for what is built, [status.md](./status.md) for what is not |
| **Reviewing this milestone** | [status.md](./status.md) — what works, what is deliberately missing, and which acceptance criteria are met | [modules.md](./modules.md) |
| **Running it** | [operations.md](./operations.md) · [mocks.md](./mocks.md) | The root [README](../README.md) for the commands |

---

## The documents

| Document | What is in it |
| --- | --- |
| [api-contract.md](./api-contract.md) | **The deliverable for the backend developer.** Base URL, auth realm, every endpoint with exact payloads, the error envelope, the five rules that matter most, and a build checklist |
| [architecture.md](./architecture.md) | How the console is built: the workspace, the layer boundaries, the provider stack, state, and why each seam is where it is |
| [white-label.md](./white-label.md) | One bundle, many factories: runtime brand resolution, the Tailwind ↔ token bridge, feature flags, adding a tenant |
| [design-system.md](./design-system.md) | Tokens, the component inventory, density, tables, forms, accessibility, and the decisions behind them |
| [rbac.md](./rbac.md) | The §12.1 permission matrix as data, four-eyes, and where authorization is actually enforced |
| [modules.md](./modules.md) | The §18.1 module map: what M1/M2/M9/M17 do today, and what each planned module needs |
| [mocks.md](./mocks.md) | The mock API: what it enforces, its fixtures, its one deliberate infidelity, and how to swap it for the real thing |
| [operations.md](./operations.md) | Commands, environments, deployment per subdomain, testing strategy, CI, and performance |
| [status.md](./status.md) | Known gaps, acceptance-criteria coverage, and the business questions that block specific modules |

## One rule binds all of it

**The supplier's app and the office's console are two views of the same
records.** Every `pending` in the app is a queue here, and every number the app
shows is a number the office can explain. Nothing is computed in one place and
re-derived in the other — which is why `packages/domain` exists and why the
credit arithmetic is shared code rather than two implementations.

## Conventions in these documents

- **`BR-###`, `AC-##` and `§n`** cite the mobile repo's `docs/`. They are stable
  ids; an `AC-02` here is the same `AC-02` there.
- **A gap is written down as a gap.** Anything unfinished is in
  [status.md](./status.md) with what it would take to close, never implied by a
  disabled button or left for the next developer to discover.
- **Decisions record their reason.** Where the console does something
  unobvious — a native `<select>`, an in-memory access token, oldest-first
  queue ordering — the document says why, because the next person's instinct
  will be to change it.
