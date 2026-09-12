# Backend API gaps — admin console and supplier app

**For:** the backend developer, `tea-factory-digital-backend`
**From:** the two frontend integrations
**Verified against:** backend `901deaf`, on a live server — API on `:3000`, Postgres +
Redis in Docker, `npm run setup`, a `galaboda` tenant, a `factoryAdmin`, a clerk and a
supplier with an app account.

Every status below is **what the wire did**, not what a commit message said. Both
frontends are integrated against this API and their tests pass against it.

---

# ▸ Part 1 — what is still open

Eleven items. One is a crash, three stop a supplier completing a request, and the rest are
shape differences the apps have adapted to.

| | Gap | Realm | What it costs today |
|---|---|---|---|
| 🔴 | **G-12a** dashboard `500`s on any change request | console | **The landing page is down** once a factory has real data |
| 🔴 | **G-28** bank-details change needs codes; `/config` serves names | app | A supplier cannot correct the account their money is paid into |
| 🔴 | **G-20** `POST /manure-requests` needs a rupee `amount` | app | Priced client-side now, but the app should not be the one pricing |
| 🟠 | **G-27** two change-request bodies read different fields | app | **The address change is still accepted empty** — silent |
| 🟠 | **G-29** password minimum 4 vs 8 | app | *Fixed app-side.* Listed so the two floors get reconciled |
| 🟠 | **G-23** loan reads `repaymentMonths` | app | Renamed at the app's seam; was a silent strip |
| 🟡 | **G-21** one eligibility shape, app expected three | app | Adapted. `interest` has no source at all |
| 🟡 | **G-22** `/savings/summary` is a withdrawal view | app | Adapted |
| 🟡 | **G-24** `/tea-packets/info` sends no month count | app | Derived from a second call |
| 🟡 | **G-25** `null` served as an empty body | app | Adapted at both call sites |
| 🟡 | **G-26** `/bills/{month}` 404s where the app expects `null` | app | Adapted |

**Open but no change requested:** **G-05** (bank reveal stays minimal — right call),
**G-11** (`{ id }` acks — the console refetches anyway), **G-09** *(partly — `/admin/users`
and `/admin/banners` are still bare arrays, fine at office scale)*, **G-01**, **G-13**,
**G-18**.

**Deferred by your decision, and agreed:** **G-02** (needs a product decision),
**G-03** (console no longer calls `/me`), **G-07** (decide once for news and banners).

### The single highest-value change

**`.strict()` on `supplier-app/requests.controller.ts`.** You adopted it for the console
realm and it closed G-19. The supplier realm has not got it, and that is the only reason
**G-27**'s address change is still accepted with nothing in it — `201`, no error on either
side, and the office approves a change to nothing.

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

## 🔴 G-20 — Manure requests need a price the app was never given

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
moves, and neither side sees an error. This is the same class of failure as **G-19**'s
`closureNote` in the console, and the same one-line fix prevents it: **`.strict()` on the
schema**, so an unknown key is a `422` instead of a silent strip.

**One thing the API gets right and the app was duplicating:** it composes `currentSummary`
and `requestedSummary` itself. The app was sending its own, which is wrong — "current"
means whatever the database says when the request is filed, and an app open since
breakfast describes a value the office changed an hour ago. The app no longer sends them.

---

## 🟠 G-29 — The app let a supplier choose a password the API refuses

**Found in round 2, and it is the app's bug rather than the API's.**

The API requires **8 characters** on both password endpoints — `POST /auth/initial-password`
and `POST /profile/password` — and has since before this pull:

```ts
const initialPasswordSchema = z.object({ next: z.string().min(8).max(200) });
const changePasswordSchema  = z.object({ current: …, next: z.string().min(8).max(200) });
```

The app enforced **4**, in four places: `MIN_PASSWORD_LENGTH`, `PasswordResetScreen`,
`ChangePasswordScreen`, and the copy *"Password must be at least 4 characters"* in all three
languages.

So a supplier choosing a five-character password passed every check the app makes and was
refused by the server:

```
POST /auth/initial-password  {"next":"abcde"}
  → 422 {"code":"invalid","details":{"field":"password","minLength":8}}
```

The form said nothing was wrong, and the error that came back did not say what was — on the
one screen a supplier cannot skip, because BR-008 holds them there until the password is
changed.

**Fixed in the app**: the floor is 8 everywhere and the copy now says so in si/en/ta. The
rule is that the app's minimum must never be *lower* than the server's — higher would be
defensible, lower is a rule the supplier only discovers by failing it.

**No backend change requested.** Noted because the two floors are written down in two
places and nothing checks that they agree; `MIN_PASSWORD_LENGTH` belongs in `@tfd/domain`
where the credential constants already live.

---

## 🟠 G-23 — Loans lost their repayment term on the wire

The app sends `installmentMonths`; `POST /loans` reads **`repaymentMonths`**. zod strips
the unknown key rather than refusing it, so the loan was accepted — `201` — **with no
repayment term at all**, and the office had to telephone the supplier to ask.

Renamed at the app's endpoint seam. But this is the third silent strip in this document
(**G-19**, **G-27**, **G-23**), and they share one cause: **no schema on this API is
`.strict()`**. See the note at the end of this section.

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

## ⚠️ Why three of these were silent — and the one change that fixes the rest

`closureNote` (**G-19**), the address change (**G-27**) and the loan's repayment term
(**G-23**) were the same failure three times: the client sent a field under a name the
server did not read, zod **stripped it silently**, and the request was **accepted** —
`200` or `201` — having lost the thing it was about. No error reached either side.

**`901deaf` adopted `.strict()` for the console realm** (`admin`, `content`, `queues`,
`profile`) and G-19 is closed as a result. It is the right fix.

**It has not reached `supplier-app/requests.controller.ts`.** That is the last silent one:
the address change is still accepted with nothing in it, because both address fields are
optional and the app's nested object is stripped on the way in.

---

# ▸ Part 2 — closed, for the record

Eleven console items closed in `901deaf`, including all four blockers. Kept as one line
each — what it was, and how it was verified closed — because a closed gap's reasoning is
what stops it reopening. Nothing here is an action.

| Gap | Was | Verified closed by |
|---|---|---|
| **G-14** refresh cookie path | Cookie scoped `/v1/auth`; the console calls `/v1/admin/auth/refresh`, so **nobody could stay signed in** | Cookie is per-realm. Chromium: sign in → reload ×3 → Dashboard every time, one `200` refresh each |
| **G-16** `/admin/config` partial | No `tenantId`, `factory` or `collectionPoints`; the Configuration screen threw on `collectionPoints.map` | All three arrive. The console's second fetch is deleted |
| **G-08** banners half-built | No `GET`/`PATCH`/`preview`/`archive` for one banner; the editor could not load | All four serve on a real record; `GET` carries `translations`; list row uses `title` and carries `staleLanguages`. The skipped editor test runs again |
| **G-06** no queue detail route | Three queues had a list and no `GET …/{id}`; the console swept the list | All three serve. `findByIdAcross` deleted |
| **G-15** reports bare array | No `months`, so the picker was empty | `{ reports, months }` |
| **G-10** roles `updatedByName` | Stored and not sent | Sent |
| **G-04** credential reset thin | No `issuedAt` / `issuedByName` / `auditId`; the dialog guessed the actor | Full `SupplierCredentialReset` |
| **G-17** setup | Four failures before the API would boot; no tenant to sign in as | `npm run setup` works from the documented commands; `db:seed:dev` prints credentials |
| **G-19** `closureNote` | API read `closureNote`, shared type said `note`; zod stripped it and **the close succeeded with the reason gone** | Back to `note` **and `.strict()`**. `{closureNote}` → `422`, `{note}` → `200` |
| `ceilingSeen` | Dropped on credit decisions, so BR-310's `stale-eligibility` was unreachable | Accepted and passed to `decide` |
| **G-12** dashboard shape | Counts not records, no `app`, `content` was two counts | `QueueCount[]`, `AppAdoption`, `ContentHealth` all correct — **except `adoptionTrend`, which is now G-12a** |

### One thing that needed a change on our side

Fixing **G-14** exposed a bug in the *console*: `App` calls `bootstrap()` from an effect,
React `StrictMode` invokes effects twice, and the refresh token is single-use — so two
rotations raced, the second was read as **reuse**, and the API revoked the family. Every
reload signed the clerk out. It could not have shown up before, because refresh never
succeeded. The console's `authStore` now shares one in-flight rotation. Nothing is needed
on the backend; recorded because the supplier realm can hit the same shape of bug.

---

## Local setup — now just the documented commands

**G-17 closed this.** The whole sequence is:

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
app's fixture layer are both gone from the runtime; their fixtures survive for the test
suites alone and answer exactly what your handlers answer — `/status` endpoints, thin
`{ id }` acknowledgements, the paged notification log, the `.strict()` refusal on inquiry
close. A green test run means the frontends agree with *this* API, not an idealised one.

---

## What was verified, and how

Against backend `901deaf` on a live server, seeded with `npm run setup` plus a supplier
and a clerk.

| Checked | Result |
|---|---|
| `npm run setup` from the documented commands | works end to end — **G-17** |
| Login → cookie `Path` | `/v1/admin/auth`, per realm — **G-14** |
| `POST /admin/auth/refresh` with browser cookie rules | `200` — was `401` |
| Chromium: sign in → reload ×3 | Dashboard every time, **one** refresh per reload, all `200` |
| 11 console screens against the live API | all render, no errors, no error boundary |
| `GET /admin/dashboard`, 3 change requests | **`500` — G-12a** |
| `GET /admin/dashboard`, 0 change requests | `200`, correct `QueueCount[]` / `app` / `content` |
| Banner `GET` / `PATCH` / `preview` / `archive` on a real record | all serve; `GET` carries `translations` |
| Queue detail ×3 | all serve |
| `close` with `{ closureNote }` / with `{ note }` | `422` / `200` — the reversal is real |
| Supplier realm, 11 gap probes | G-20 – G-28 all unchanged |
| **Mobile: all 21 read repositories, driven live** | every one returns the shape its screen expects |
| **Mobile: 6 write paths, driven live** | all reach the domain layer — `loan-history-short`, `manure-history-short`, `advance-over-limit`, `tea-packet-policy`, `change-pending`, one accepted. **No `invalid` anywhere** |
| `PATCH /profile` against its `.strict()` schema | `200` — the app sends exactly the five fields it allows |
| `GET`/`PUT`/`PATCH`/`DELETE /devices` | 200 / 200 / 200 / 204 |
| `POST /auth/refresh` (supplier, body-based) | rotates; unaffected by the console's cookie fix |
| `POST /auth/initial-password` with 5 characters | `422` — **G-29**, fixed in the app |

**Console:** typecheck clean, lint clean, **403 tests passing, none skipped** (the banner
editor test is back), production build clean.

**Mobile:** typecheck clean, **140 tests passing**, and **re-run live against `901deaf`** —
21 read repositories and 6 write paths. Nothing in the pull broke it: the supplier realm
uses body-based refresh tokens, so the cookie fix does not touch it, and the app already
sent exactly the five fields `PATCH /profile`'s `.strict()` schema allows.

Its G-20 – G-28 adapters stay, because those gaps are unchanged. One app-side fix was made:
**G-29**, the password minimum.

### What the frontends changed to match

**Console — workarounds deleted**, because the API no longer needs them: `findByIdAcross`
(the queue list sweep), the second `GET /config` behind the Configuration screen, the
`months: []` wrap on the report catalogue, the `updatedByName: null` fill, the client-side
paging of the notification log, the `closureNote` rename, the credential-reset attribution
guess, and the dashboard's two "not reported yet" placeholder cards. One thing added: a
single-flight guard on the session rotation, for the reuse race that fixing **G-14**
exposed.

**Mobile — one fix**: the password floor raised from 4 to 8 to match the API (**G-29**),
in one constant and the copy in si/en/ta. Its G-20 – G-28 adapters stay, because those
gaps are unchanged.

### Still not exercised

Anything needing bill, savings-ledger, delivery or credit history. The seed creates a
factory, a config row, collection points, an administrator and a supplier — and no money
records at all, so those endpoints answered correctly but only over empty collections.
