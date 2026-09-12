# Backend API gaps — admin console and supplier app

**For:** the backend developer, `tea-factory-digital-backend`
**From:** the two frontend integrations
**Verified against:** backend `901deaf`, on a live server — API on `:3000`, Postgres +
Redis in Docker, `npm run setup`, a `galaboda` tenant, a `factoryAdmin`, a clerk and a
supplier with an app account.

**This file lists only what is still open.** Every status is what the wire actually did,
not what a commit message said. Both frontends are integrated against this API and their
suites pass against it — with one caveat about the console suite's flakiness, recorded at
the end.

> **Removed rather than marked closed:** the eleven console gaps `901deaf` fixed — G-04,
> G-06, G-08, G-10, G-12, G-14, G-15, G-16, G-17, G-19 and the `ceilingSeen` defect — are
> gone from this file. So is G-29, an app-side bug found while re-testing (a password floor
> of 4 against the API's 8) and fixed in the app. All of it is in this file's git history
> if the reasoning is ever needed.

---

## What is still open

| | Gap | Realm | What it costs today |
|---|---|---|---|
| 🔴 | **G-12a** dashboard `500`s on any change request | console | **The landing page is down** once a factory has real data |
| 🔴 | **G-28** bank-details change needs codes; `/config` serves names | app | A supplier cannot correct the account their money is paid into |
| 🟠 | **G-27** two change-request bodies read different fields | app | **The address change is accepted empty** — silent, no error either side |
| 🟠 | **G-20** `POST /manure-requests` needs a rupee `amount` | app | Priced client-side now, but the app should not be the one pricing |
| 🟠 | **G-23** loan reads `repaymentMonths`, app says `installmentMonths` | app | Renamed at the app's seam; was a silent strip |
| 🟡 | **G-21** one eligibility shape, app expected three | app | Adapted. `interest` has no source at all |
| 🟡 | **G-22** `/savings/summary` is a withdrawal view | app | Adapted |
| 🟡 | **G-24** `/tea-packets/info` sends no month count | app | Derived from a second call |
| 🟡 | **G-25** `null` served as an empty body | app | Adapted at both call sites |
| 🟡 | **G-26** `/bills/{month}` 404s where the app expects `null` | app | Adapted |

Only the first two need work before the apps are usable. The rest are shape disagreements
the frontends have absorbed — listed so the wire and the shared types can be reconciled,
not because anything is broken.

### The single highest-value change

**`.strict()` on `supplier-app/requests.controller.ts`.** You adopted it for the console
realm and it closed the silent inquiry-close bug. The supplier realm has not got it, and
that is the only reason **G-27**'s address change is still accepted with nothing in it —
`201`, no error on either side, and the office approves a change to nothing.

### Open, and no change requested

Recorded so the shared types can be reconciled one day, not as work:

- **G-05** — bank reveal answers `{ accountNumber, auditId }` and stays minimal. The right
  call for the one endpoint that hands over an account number; the console passes bank and
  branch in from the record it already has.
- **G-11** — mutations acknowledge with `{ id }`. The console invalidates and refetches
  anyway, and its types now say so.
- **G-09** *(partly)* — the notification log is paged; `/admin/users` and `/admin/banners`
  are still bare arrays. Fine at office scale, where both lists are small by construction.
- **G-01** — no `POST /admin/suppliers`. The register is replicated from the factory's own
  system and no v2 screen creates one.
- **G-13** — deliveries, months, rates and payouts unimplemented. Cut from this console
  deliberately; the factory's own system runs them.
- **G-18** — `GET /config` sends `slug` and `factoryId` where `RuntimeConfig` says
  `tenantId`. The console resolves the tenant from the subdomain, so nothing breaks.

### Deferred by your decision, and agreed

- **G-02** — `POST /admin/users` requires a password `ConsoleUserDraft` has no field for.
  *"Needs a product decision, not code."* The console mints one and prints it once.
- **G-03** — `GET /admin/auth/me` returns a thin identity. The console bootstraps from
  refresh and no longer calls it, so there is no reader to serve.
- **G-07** — news and banner create read a flat body where the shared drafts carry
  `translations`. *"Should be decided once for both resources."*

---

## 🔴 G-12a — the dashboard `500`s once a factory has any change request

**New in `901deaf`, and the most urgent item in this document.** The dashboard rebuild is
otherwise very good — `queues` carries the age of the oldest item, `app` reports the
adoption figures that had no source at all, `content` is the four silent failures. The
console's placeholder cards are gone because of it.

But `adoptionTrend` selects a `count(*)`:

```sql
SELECT to_char(...) AS month_key,
       count(*)     AS total,          -- ← Postgres bigint
       ...
  FROM change_requests
```

and Prisma returns that as a JavaScript `BigInt`, which `JSON.stringify` refuses:

```
TypeError: Do not know how to serialize a BigInt
    at JSON.stringify (<anonymous>)
    at ServerResponse.json (express/lib/response.js:245)
```

**Reproduced, and it is data-dependent:**

```
change_requests = 3  →  GET /v1/admin/dashboard  →  500 internal
delete from change_requests
change_requests = 0  →  GET /v1/admin/dashboard  →  200
```

That is what makes it dangerous. A freshly seeded machine and CI both have an empty table,
so it passes everywhere, and it fires the first time a supplier files a change request —
on the console's landing page, which is the first screen of every morning.

`config-admin.service.ts` already carries the warning, about its own `version` column:

> *`version` is a `BigInt`, and **`JSON.stringify` throws on one** … Express then answers a
> bare `500` with no domain code at all, which is the failure mode rule #1 exists to
> prevent, arriving from the serializer rather than from a handler.*

**Suggested fix.** `total` is not read by anything — the console plots `appShare` and
ignores it — so the cheapest fix is to drop it from the projection, or cast it:
`count(*)::int AS total`. A `BigInt` JSON replacer at the adapter would stop the whole
class of it.

**Two smaller things in the same payload**, neither breaking:

- `adoptionTrend` and `intakeTrend` are raw SQL rows — `month_key`, `app_share`, `kgs` —
  where the rest of the API is camel-cased. The console maps them.
- `cycle` and `today` are absent from `DashboardSummary`. v2's dashboard does not render
  them, so this is only worth reconciling in the shared type.

The console cannot work around a response it never receives, so there is no adapter for
this one: the dashboard simply fails until the cast lands.

---

## 🔴 G-28 — A supplier cannot change their bank details

`POST /change-requests` with `type: 'bankDetails'` requires:

```
{ bankCode, branchCode, accountNumber, accountName }
```

The app can supply exactly one of them.

- **`bankCode` / `branchCode`** — `GET /config` serves the bank catalogue as
  `{ name, branches: string[] }`. **Names, no codes.** There is nothing to resolve a code
  from, and the app renders that same catalogue in the picker the supplier chose from.
- **`accountName`** — the app's `BankDetails` has no account-holder name at all, and no
  screen collects one.

So this is the one gap in this document that **cannot be worked around client-side**.
Sending the bank's *name* in `bankCode` would be inventing a value the factory's payout
file then pays against — the single place in this app where a guess moves money to the
wrong account.

`PayoutScreen` is a real, reachable screen. It now refuses before the request leaves, with
a localized *"ask at the office"* rather than a raw `422`.

**Either would fix it:** put `code` on each bank and branch in the served catalogue, or
accept `bankName` / `branchName` on the request body. The second is less work and matches
what the app already holds.

---

## 🟠 G-27 — Two change-request bodies read fields the app does not send

`POST /change-requests` is a discriminated union, and two of its four arms disagree with
the app. Observed on a live server:

| Type | App sent | API reads | Result |
|---|---|---|---|
| `savingsRate` | `savingsPerKg` | `savingsPerKg` | ✅ correct |
| `paymentMethod` | `method` | **`paymentMethod`** | `422 invalid` — loud |
| `address` | `address: { homeAddress }` | **`homeAddress`** (top level) | **`201` — silent** |
| `bankDetails` | *(names)* | *(codes)* | `422` — see **G-28** |

**The `address` row is the serious one.** Both address fields are *optional* in the
schema, so the nested object was stripped and the request was **accepted** with nothing in
it. The row the office received:

```json
{ "type": "address", "status": "pending",
  "currentSummary":   "Home: No 12, Temple Road · Estate: Lot 4, Upper Division",
  "requestedSummary": "Home: No 12, Temple Road · Estate: Lot 4, Upper Division" }
```

Identical summaries. A clerk approves a change to nothing, the supplier's address never
moves, and neither side sees an error. It is the same class of failure as the console's
inquiry-close bug — which `901deaf` fixed — and the same one-line change prevents it:
**`.strict()` on the schema**, so an unknown key is a `422` instead of a silent strip.

**One thing the API gets right and the app was duplicating:** it composes `currentSummary`
and `requestedSummary` itself. The app was sending its own, which is wrong — "current"
means whatever the database says when the request is filed, and an app open since
breakfast describes a value the office changed an hour ago. The app no longer sends them.

---

## 🟠 G-20 — Manure requests need a price the app was never given

`POST /manure-requests` requires `amount` — the **value in rupees**, not the weight. The
app asks for a product and a quantity in kilos, so the call was refused outright:

```
{"code":"invalid","details":{"issues":[{"path":"amount","message":"expected number, received undefined"}]}}
```

Manure requests did not work at all.

**Two things made this hard to see.** The app's own `ManureProduct` was `{ name }` — the
served payload carries `packKg` and `pricePerPack`, and the app's type dropped both, with
a docblock explaining that pricing was the factory's job. That was right about *who sets*
the price and wrong about who has to *send* it.

**Worked around:** the app's type now reads all three fields and prices the request
`ceil(quantityKg / packKg) × pricePerPack` — rounded up to the bag, because a store hands
over sacks.

**Worth reconsidering, though.** Tea packets do this the other way: `unitPrice` is `NULL`
while pending and stamped at approval, *"never re-read from the config afterwards, or a
catalogue edit would silently re-price an answered request."* That argument applies to
manure exactly as well, and pricing it server-side would also close the window where the
app's catalogue is a few hours stale.

---

## 🟠 G-23 — Loans lost their repayment term on the wire

The app sends `installmentMonths`; `POST /loans` reads **`repaymentMonths`**. zod strips
the unknown key rather than refusing it, so the loan was accepted — `201` — **with no
repayment term at all**, and the office had to telephone the supplier to ask.

Renamed at the app's endpoint seam, so nothing is broken today. It is listed because it is
the same silent-strip shape as **G-27** and as the console's inquiry-close bug, and they
share one cause: **`.strict()` has not reached the supplier realm's schemas.** A client
sending a field under a name the server does not read gets a `201` and loses the thing the
request was about.

---

## 🟡 G-21 — Eligibility is one shape, and the app expected three

`GET /advances|loans|manure/eligibility` all answer the same `CreditEligibility`. The app
declared a different flat shape per facility (`maxRequestable`, `availableCredit`,
`hasRequiredHistory`, …).

**The API is right here** and the app has been adapted rather than the reverse: AC-05
requires the figure the supplier sees to be byte-for-byte the figure the office sees in
the approval queue, and one server-side function feeding both is the only way to guarantee
it. Three app-shaped payloads would be three chances to disagree by a cent.

One field has no source: **`interest`**. The API reports `outstanding` as a single figure
and does not split interest out of it, so the advance screen shows the balance whole. That
is better than a fabricated split — a supplier who adds two numbers and gets a third
telephones the office — but if the factory does charge interest on an advance, the app
currently cannot show it.

Two fields are on the wire but **not in the shared `CreditEligibility` type**:
`installmentOptions` and `pendingRequestId`. Both are useful and both are used; worth
adding to the type so the console can rely on them too.

---

## 🟡 G-22 — `/savings/summary` is a withdrawal view, not a running total

| App expected | API sends |
|---|---|
| `{ thisMonth, previousBalance, toDate }` | `{ balance, pendingTotal, available, windowOpen, withdrawalMonth, currentMonth }` |

No overlap at all. **The API's shape is the more useful one** — `windowOpen` is computed
from the factory's Colombo clock, which is the right authority: a handset in another
timezone must not decide the §21.9 withdrawal window is shut while the office says it is
open.

The savings card now shows the server's `balance` as its headline and derives this month's
contribution and the previous balance from the ledger it already loads. Nothing is
invented and no extra request is made.

---

## 🟡 G-24 — `/tea-packets/info` sends the policy but not the count

Sends `{ policy, customised, defaults }`; the screen needs the policy **plus how many
packets the supplier has already asked for this month**, which the payload does not carry.

Derived in the app from `GET /tea-packets`, so the screen costs two calls instead of one.
Two notes for whoever closes this:

- `policy: null` is handled correctly and is a **good** design — the app says *"the factory
  has not set a price"* rather than quoting `defaults`, which is a real price and not this
  factory's.
- The derived count uses the **device's** month, because nothing on either endpoint says
  which Colombo month is current. A handset in another timezone can miscount the allowance
  for a few hours around midnight on the 1st. Harmless — the server enforces the real limit
  — but it is why the count belongs on the payload.

---

## 🟡 G-25 — `null` is served as an empty body

`GET /bills/current` and `GET /banners/active` are both documented as answering `null`
rather than `404`, which is the right decision. But Nest serialises a `null` return as an
**empty body**:

```
HTTP/1.1 200 OK
Content-Length: 0
```

No `Content-Type`, no `null` literal. axios hands an empty body over as `''`, so a caller
comparing `bill === null` gets an empty string instead — and the declared type
`GreenLeafBill | null` is a lie about what arrives.

Worked around with `|| null` at both call sites. A one-line fix on the server
(`return row ? … : null` → an explicit `res.json(null)`, or a small interceptor) would let
the type mean what it says.

---

## 🟡 G-26 — `GET /bills/{monthKey}` 404s where the app expects `null`

`GET /bills/current` answers `null` for "no account yet"; `GET /bills/{monthKey}` throws
`404 not-found` for the same situation one month over. The app's contract is
`GreenLeafBill | null` for both, and a month a supplier simply did not supply into is an
ordinary state — the picker offers every month of the year.

The app translates `not-found` to `null` and lets every other refusal through, so a `403`
still surfaces rather than showing an empty screen. Worth making the two endpoints agree.

---

## Local setup

```bash
# backend
npm install                 # prisma generate runs on postinstall
cp .env.example .env
npm run setup               # db:up + db:migrate + db:seed:dev
npm run dev                 # -> http://localhost:3000/v1

# console
npm run dev                 # -> http://localhost:5273
```

`db:seed:dev` creates the `galaboda` tenant and prints the administrator's credentials.
Verified from these commands only, on a clean database.

**Both frontends talk only to the real API.** The console's in-browser mock and the mobile
app's fixture layer are gone from the runtime; their fixtures survive for the test suites
alone and answer exactly what your handlers answer. A green test run means the frontends
agree with *this* API, not an idealised one.

---

## How each open item was reproduced

| Checked | Result |
|---|---|
| `GET /admin/dashboard`, 3 change requests | **`500` — G-12a** |
| `GET /admin/dashboard`, 0 change requests | `200` — the crash is data-dependent |
| `POST /change-requests` `{type:'address', address:{…}}` | **`201`, summaries identical — G-27** |
| `POST /change-requests` `{type:'paymentMethod', method:…}` | `422 invalid` — G-27 |
| `POST /change-requests` `{type:'bankDetails', …names}` | `422 invalid` — G-28 |
| `POST /manure-requests` without `amount` | `422 invalid` — G-20 |
| `GET /bills/current`, `GET /banners/active` | `200` with `Content-Length: 0` — G-25 |
| `GET /bills/2026-07` with no bill | `404 not-found` — G-26 |
| `/savings/summary` · `/tea-packets/info` · `/advances/eligibility` | shapes recorded in G-22, G-24, G-21 |

**State of both frontends against this API.** Console: typecheck clean, lint clean,
production build clean, and all 11 screens walked in Chromium with no failed API calls.
Mobile: typecheck clean, 140 tests passing, and all 21 read repositories plus 6 write paths
driven live — every write reaches the domain layer, none returns `invalid`.

> **One caveat on the console suite.** All 403 tests pass, but not on every run: it is
> flaky, producing anywhere from 0 to 19 failures on *identical* code. Every failure is a
> **timeout** — either at a `signInAs(…)` line or `[vitest-worker]: Timeout calling
> "fetch"` while a worker resolves `react-router-dom` — never a failed assertion. It is a
> vite-node module-resolution problem, not a disagreement with this API, and it predates
> the integration. Zeroing the mock's artificial latency under Vitest cut the worst case
> from 19 failures to about 4; the rest needs separate work on the test setup. Flagged so
> nobody reads a red run as a contract break.

**Not exercised:** anything needing bill, savings-ledger, delivery or credit history. The
seed creates a factory, a config row, collection points, an administrator and a supplier —
and no money records, so those endpoints answered correctly but only over empty
collections.
