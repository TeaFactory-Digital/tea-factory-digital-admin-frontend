# The mock API

The backend has not started, so the console runs against MSW. This document is
what it does, what it deliberately does not, and how to leave it behind.

---

## Why a service worker rather than stubbed repositories

The obvious shortcut is to make `services/repositories/*` return fixtures. It was
not taken, for one reason: the console would then never exercise its own
transport. Interceptors, refresh-on-401, the idempotency header and the error
envelope would all be untested, and **§17.7's error-code flattening bug is exactly
the class of defect that hides behind a stubbed repository.**

With MSW, swapping to the live API changes what answers, not how the console asks.

Same handlers in both places:

- **Browser** — `services/mocks/browser.ts`, started in `main.tsx` before React
  mounts, gated on `import.meta.env.DEV && env.useMock`.
- **Vitest** — `services/mocks/server.ts`, via `test/setup.ts`.

A test that passed against different fixtures from the ones a developer clicks
through proves nothing about the console.

---

## It is a specification, not a demo

Every refusal the mock produces is a refusal the real API must reproduce. That is
what makes `handlers.ts` readable as an executable version of
[api-contract.md](./api-contract.md):

| Enforced | Rule |
| --- | --- |
| `403 forbidden`, from a **server-side** capability check | §12.1. The console hides what a role cannot do as a courtesy; this is the authority |
| `409 four-eyes-violation` | BR-501 — the approver created the record |
| `409 already-decided` | Two clerks working one inbox |
| `422 note-required` | AC-06, on **both** approve and reject, and on suspend, reveal, void and exception resolution |
| Masked bank details in every read payload | §20.4 |
| An audit entry for every mutation, in the same tick | AC-09 |
| A queue omitted when its feature flag is off | AC-07 |
| `409 month-locked` on a delivery, a void or a rate in a published month | BR-108 |
| An idempotent replay of a committed weighing session | §1.3 — the same `batchId` returns the original result, rejections included |
| Per-row rejections inside a `200` on a batch | §9.3 — one bad code must not send fifty-nine good rows back |
| `409 exceptions-open` on a publish with unresolved exceptions | AC-04 |

Two structural choices worth copying into the backend:

1. **Full account numbers live in a separate map from the supplier records.** A
   list handler *cannot* leak one, because the record does not contain it. Do the
   equivalent server-side: mask in the read model, join to the real value only in
   the reveal endpoint.
2. **`authorize()` returns either the user or the response to send.** A handler
   cannot forget the check and still compile into something that answers `200`.

---

## Fixtures

Deterministic — a seeded mulberry32 PRNG, not `Math.random`. A screenshot in a bug
report matches what the next developer sees, and the integration tests can assert
on real values.

### Users

| Email | Role | MFA | Purpose |
| --- | --- | --- | --- |
| `clerk@galabodatea.lk` | `clerk` | no | Works the change-request queue |
| `manager@galabodatea.lk` | `manager` | **yes** — code `123456` | Approves, publishes a month; exercises the MFA step |
| `accountant@galabodatea.lk` | `accountant` | no | Enters the rate, resolves M4 exceptions |
| `weigher@galabodatea.lk` | `weigher` | no | **The only one who can record leaf** |

Password for all four: `demo1234`, and all four are **printed on the sign-in
screen** while `VITE_USE_MOCK` is on — deliberate, because a demo credential that
has to be looked up in a source file gets pasted into a chat thread and outlives
the demo. The block cannot render in a production build.

**One identity per rule that needs two people.** AC-10 ("no console user can
approve a record they created") cannot be demonstrated with one, and neither can
BR-501 on the month close, where the accountant enters the rate and the manager
publishes it. The weigher exists because §12.1 gives `deliveries: W` to nobody
else in this fixture — signed in as the clerk, M3 is read-only, and that is the
matrix working rather than a broken screen.

### Suppliers — 84

Enough to exercise server-side paging at the 50-row default, small enough to read
through while debugging. Systematically varied so the edge cases are always
present:

- 1 in 9 has **no bank details** → the M4 exceptions the dashboard alert counts
- 1 in 17 is **suspended**, 1 in 41 **closed**
- 1 in 13 is **dormant** (no delivery for 95+ days)
- savings rates cycle through `0, 0, 5, 10, 15, 20, 25` — so opted-out suppliers
  are always in view

### Change requests — 14

The ids are fixed, because the integration tests name them:

| Id | Type | Notes |
| --- | --- | --- |
| `chg-1` | bankDetails | app-raised |
| `chg-2` | savingsRate | app-raised — the approve test |
| `chg-3` | paymentMethod | app-raised — the reject and detail-screen tests |
| `chg-4` | bankDetails | app-raised — the note-required tests |
| `chg-5` | savingsRate | app-raised — the already-decided test |
| `chg-6` | paymentMethod | **office-raised by the clerk** — the four-eyes test |
| `chg-7`…`chg-12` | mixed | ages 2 h to 5 d, so SLA colouring has something to show |
| `chg-13` | approved | so the non-pending filters are not empty |
| `chg-14` | rejected | with a real rejection note |

### Deliveries — 14 days

Generated per day per supplier rather than as a flat list, so the shape of a real
fortnight is present: **Sundays are empty** (the factory does not weigh), about
three suppliers in five deliver on any given day, and one in seven of those brings
a second load in the afternoon — which is why `supplierCount` and `deliveryCount`
are different figures everywhere they appear.

Three properties are load-bearing rather than decorative:

- **Only non-dormant active suppliers have rows.** Derived from the registry, not
  invented beside it: a supplier the grid calls dormant (no delivery for 95+ days)
  with deliveries last Tuesday is a fixture contradicting itself, and the
  dormant-suppliers report would be built on the contradiction.
- **`lastDeliveryAt` on the supplier record is set *from* these rows**, for the
  same reason.
- **One row is voided**, so the state is visible without anyone creating it and
  `includeVoided` has something to return.

The dashboard's "today's leaf" and 14-day trend are computed from these rows, so
committing a session in M3 moves the dashboard — which is what
`deliveries.test.ts` asserts, and what the real API must reproduce.

### Months — 4, and exceptions derived from the data

The current month is `awaitingRate` with no rate; the three before it are
`published` with a rate and a publisher, so **`month-locked` has a date it can
actually happen on**. Rates drift month to month rather than repeating one figure,
because a bill screen showing the same LKR 122.50 for every month reads as a
hardcoded placeholder — which is what it would be.

The stage is **stored per month, never recomputed from the calendar**. That is the
one thing worth copying verbatim into the backend: a derived stage would revert a
publish on the next request, and M3 would go on accepting leaf into a closed
month.

Exceptions are **queries, not fixtures** — leaf with no bank details, leaf against
an inactive supplier, a pending change request that would change the bill, and a
weighing outside the day's spread. A hand-written exception list would say "12
suppliers have no bank details" while the registry said something else, and the
accountant would be reconciling the console against itself.

### Tenants — 3

`galaboda` (full), `hillcountry` (full, different palette and radius), and
**`highland` — the reduced-feature reference**: no loans, no manure, no push, no
reports, mirroring mobile's `clientB`.

Switching to `highland` in the dev tenant switcher should visibly empty those rows
out of the sidebar. It is the fastest check that no surface is hardcoded, and a
Playwright spec asserts it.

---

## Two honest caveats

**1. Writes do not survive a reload.** State lives in module scope — the same
property the mobile app's `mockDb` has (status.md §10 item 6). A feature for a demo
(the fixture is always the same) and a trap in a manual test. Stated here rather
than discovered.

`resetMockState()` exists for Vitest, where module state persists across files and
a decided request leaking into the next case would make failures order-dependent.

**2. `POST /admin/auth/refresh` has no rotation or reuse detection.** The real
implementation reads a *rotating* httpOnly cookie; the mock stands in with a
`sessionStorage` entry holding a mock user id.

That stand-in matters more than it sounds. The console holds its access token in
memory by design, so a fresh document has none and must recover the session from
the refresh cookie. Without something that survives a reload, **every browser
refresh and every deep link bounced the developer back to sign-in** — the console
behaving correctly against a mock that could not answer. `sessionStorage` is the
closest honest analogue: scoped to the tab, cleared on close, cleared on sign-out,
and holding no credential. A Playwright spec covers reload, deep-link and
sign-out-then-reload.

What still cannot be tested here is **token rotation and reuse detection**
([api-contract.md](./api-contract.md) §2.3). Those need the real backend.

---

## Leaving the mock behind

```bash
VITE_USE_MOCK=0
VITE_API_BASE_URL=https://api.your-real-host.lk/v1
```

That is the whole change. `assertEnvUsable()` refuses a production build with mocks
on, and the MSW chunk is eliminated from production entirely — the guard is
`import.meta.env.DEV && env.useMock`, so Vite drops the branch rather than shipping
a ~300 kB chunk nobody loads.

**When a real shape differs from the contract**, the seam that absorbs it is
`services/repositories/`. Map it there and tell the backend developer; do not
reshape `@tfd/domain`'s types to match a temporary backend quirk, because those
types are also the app's and the API's.

The mock is worth keeping after the API lands — as the test fixture, and as the way
to develop offline or against a broken staging environment. `services/mocks/` is
excluded from nothing except the production bundle.
