# Tea Factory Digital — admin console documentation (v2)

**This console manages the mobile app. It does not run the factory.**

That sentence is the whole of v2, and everything in these documents follows from it.

## What changed, and why

v1 built §18.1's seventeen modules on the premise that the console would be *"the
other half of every flow the app can only ask for"* — the office where the leaf is
recorded, the rate entered, the month closed and every request decided. That was
the right scope for the premise.

The premise turned out to be wrong. **The factory already runs its own console for
its internal processes**, so six of those seventeen modules were building a second
answer to questions that already had one. Two systems recording the same weighing
is not redundancy; it is a reconciliation somebody does by hand every month, and
the one that disagrees is whichever the office trusts less.

So v2 keeps everything the **app** needs an office for, and hands the rest back.
The test for a module is one question:

> If this console did not exist, what would the supplier's phone do wrong?

| Module | Answer |
| --- | --- |
| M9 Change requests | A bank-details change would sit `pending` for ever |
| M7 Credit queues | An advance, loan or manure request would never be decided |
| **M18 Tea packets** | A tea-packet request would never be decided — **and in v1 it never was** |
| M10 Inquiries | A message would go unanswered |
| M11 News **and banners** | The feed and the announcement would be empty — **and in v1 there was no banner editor at all** |
| M12 Static content | The FAQ, terms and privacy pages would be whatever the binary bundled |
| M13 Notifications | Nothing would ever be pushed |
| M14 Configuration | The flags, the brand, the bank list and the savings rates would need a release |
| M15 Users & roles | Nobody could use this console |
| M17 Audit log | None of the above would be evidence |

## What v2 found while narrowing the scope

Cutting the scope was the smaller half of this work. Reading the app against the
console turned up three places where they had **already drifted**, each of which is
a supplier looking at something the office cannot see:

1. **The app has fourteen feature flags; the console had ten.** Six the app gates
   real screens on had no control anywhere — a factory wanting to turn off
   biometric sign-in had to ask a developer, which is precisely what AC-12 says
   must not be true. Two were console-only. See [white-label.md](./white-label.md).
2. **Tea packets did not exist here.** The app has shipped `RequestTeaPacketsScreen`
   since its first release; this console had no type, no endpoint, no queue and no
   flag. A supplier could ask the factory for its own tea and nothing on earth
   could answer. That is now M18.
3. **There was no banner editor.** `enablePromoBanner` shipped in the flag set,
   `PromoBanner` shipped in the domain package, the mobile repo's `docs/banners.md`
   specified the whole feature — and a factory that turned the switch on got
   nothing. That is now a routed surface inside M11.

The first is the one worth dwelling on: `FeatureFlagSet`'s docblock claimed the set
was *"identical to the app's"* while the type said otherwise. A comment that was
true when it was written is the most expensive kind of drift, because nothing fails.

## The screens were not deleted

Every v1 screen, handler and fixture for the internal-process modules is **still in the
tree, still building and still answering**. What went is the wiring that claimed this
console owns them — the routes, the sidebar rows, the dashboard cards and the v1 test
cases. Two arguments for keeping the rest:

- **They are the executable statement of what those flows require.** [mocks.md](./mocks.md)
  calls the MSW handlers *"the specification the server has to satisfy, not a
  stand-in for one"* — that is exactly as true of M4's five publish refusals and
  M6's payout serialiser as it is of the modules that stayed. Whoever builds the
  factory's own console against this API needs them.
- **The scope decision may be revisited.** `DashboardSummary` still carries `cycle`,
  `today` and `intakeTrend` for this reason: the month-cycle stage is *why the app
  shows a supplier blanks instead of amounts*, which is a telephone call the office
  takes whether or not it closes the month.

> **The removed wiring is in git history**, with the reason it left recorded in the commit
> that removed it. It was carried commented-out through v2's first pass and taken out once
> the boundary settled — a file that explains itself twice, once in code and once in a
> comment about code that no longer runs, drifts on the first change to either.

## Where to start

| You are | Read | Then |
| --- | --- | --- |
| **Backend developer** | [api-contract.md](./api-contract.md) — every endpoint, payload and refusal | The mobile repo's `docs/api.md` §16 for the data model |
| **Building the bridge to the factory's system** | [factory-integration-spec.md](./factory-integration-spec.md) — the design, and the map of which audience gets which document | [platform-team.md](./platform-team.md) for this side's work, [integration.md](./integration.md) for its reasoning |
| **Front-end developer joining** | [architecture.md](./architecture.md) · [white-label.md](./white-label.md) · [design-system.md](./design-system.md) | [modules.md](./modules.md) for what is built, [status.md](./status.md) for what is not |
| **Reviewing this milestone** | [status.md](./status.md) — what works, what is deliberately absent, and the v2 acceptance criteria | [modules.md](./modules.md) |
| **Looking for a module that has gone** | [modules.md](./modules.md) → *What moved to the factory's own console* | `git show <rev>:docs/v1/modules.md` for the module as it was documented |

## The documents

| Document | What is in it |
| --- | --- |
| [modules.md](./modules.md) | The v2 module map, what each decides, and what moved out |
| [white-label.md](./white-label.md) | Runtime brand resolution, the Tailwind ↔ token bridge, and **the fourteen flags** |
| [api-contract.md](./api-contract.md) | Base URL, auth realm, every endpoint with payloads, the error envelope |
| [factory-integration-spec.md](./factory-integration-spec.md) | **The shared core, and the front door to the four below.** The duplicate-prevention handshake, the office workflow, who decides what, and the rules both sides keep |
| [factory-system-team.md](./factory-system-team.md) | **The document to hand the factory's own dev team.** The endpoint field by field, the volumes, and the fallbacks if they have no modified timestamps or no HTTPS |
| [business-analyst.md](./business-analyst.md) | The BA's three conversations — with the Factory System team, the office, and management — and what each must produce in writing |
| [platform-team.md](./platform-team.md) | This side's work: consuming the endpoint, the credit ceiling, the freshness indicator |
| [factory-management.md](./factory-management.md) | **Non-technical.** The decisions only the factory's owner can make — above all **who instructs the existing vendor, and on what commercial terms** |
| [factory-updates-sample.json](./factory-updates-sample.json) | A complete, valid, arithmetically-consistent sample response for that endpoint. Send it with [factory-system-team.md](./factory-system-team.md) |
| [bank-catalogue.md](./bank-catalogue.md) | Where the bank and branch list lives, the three decisions behind it (names not ids, no rename, inside `client_config`), and what comes out of the frontend once the backend holds it |
| [sri-lanka-banks.seed.json](./sri-lanka-banks.seed.json) | The catalogue as portable JSON — 45 institutions, 3,682 branches, with clearing codes. What the backend seeds `client_config.banks` from |
| [integration.md](./integration.md) | The same subject from *this* repository's side — what the console assumes, and why replication rather than import |
| [architecture.md](./architecture.md) | The workspace, the layer boundaries, the provider stack, state |
| [rbac.md](./rbac.md) | The §12.1 permission matrix as data, four-eyes, where authorization is enforced |
| [design-system.md](./design-system.md) | Tokens, components, density, tables, forms, accessibility |
| [mocks.md](./mocks.md) | The mock API: what it enforces, its fixtures, how to swap it for the real thing |
| [operations.md](./operations.md) | Commands, environments, deployment per subdomain, testing, CI |
| [status.md](./status.md) | Known gaps, v2 acceptance-criteria coverage, open business questions |

**v1 — the seventeen-module console — is in git history, not in the tree.** It was the
reference for the factory's own build. Recover it with `git log -- docs/v1/` and
`git show <rev>:docs/v1/<file>`.

## One rule binds all of it

**The supplier's app and this console are two views of the same records.** Every
`pending` in the app is a queue here, and every flag the app reads is a control
here. Nothing is computed in one place and re-derived in the other — which is why
`packages/domain` exists, why the credit arithmetic is shared code, and why v2's
banner editor runs the **app's own** `bannerTarget()` rather than a second copy of
the allowlist.

## Conventions in these documents

- **`BR-###`, `AC-##` and `§n`** cite the mobile repo's `docs/`. They are stable
  ids; an `AC-02` here is the same `AC-02` there. Where v2 changes what a criterion
  means, [status.md](./status.md) says so rather than quietly reinterpreting it.
- **A gap is written down as a gap**, in [status.md](./status.md), never implied by
  a disabled button.
- **Decisions record their reason**, because the next person's instinct will be to
  change them.
