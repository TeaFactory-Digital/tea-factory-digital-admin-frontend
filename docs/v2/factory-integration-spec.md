# Integration Specification

**Between the existing Factory System and the new Supplier Mobile App**

| | |
| --- | --- |
| **Status** | Draft for review |
| **Audience** | Business analyst · Platform team · Existing Factory System team |
| **What we ask the Factory System team to build** | **One read-only endpoint.** Nothing else |
| **What changes in the Factory System's business logic** | **Nothing** |

---

## 1. What this project is

**The factory is giving its suppliers a mobile app.** That is the whole of it.

The existing Factory System runs the business and **keeps running it, unchanged** —
leaf collection, monthly rates, Green Leaf Accounts, payouts, savings, advances,
loans, manure and tea packets. Every rule, every calculation and every decision stays
exactly where it is today.

What is new is **where the supplier stands**:

```
        TODAY                                AFTER

  Supplier walks to the office        Supplier opens the app
            │                                   │
            │                                   ▼
            │                         ┌──────────────────────┐
            │                         │  App Platform (new)  │
            │                         │  · shows their data  │
            │                         │  · takes requests    │
            │                         └──────────┬───────────┘
            │                                    │ the office reads it
            ▼                                    ▼
  ┌───────────────────┐               ┌───────────────────┐
  │  Factory System   │               │  Factory System   │
  │   (everything)    │               │   (everything)    │
  │                   │               │    UNCHANGED      │
  └───────────────────┘               └───────────────────┘
```

The supplier used to come to the counter. Now the request arrives on a screen. **The
office does the same work, in the same system, as before.**

### 1.1 What each side does

| | Existing Factory System | App Platform (new) |
| --- | --- | --- |
| Leaf, rates, accounts, payouts, savings | ✅ **Owns and decides** | Displays a copy |
| Advances, loans, manure, tea packets | ✅ **Owns and decides** | Receives the request, displays the outcome |
| Supplier registry, balances | ✅ **Owns** | Displays a copy |
| Mobile app accounts, passwords, devices | — | ✅ Owns |
| App content — news, banners, FAQ, terms | — | ✅ Owns |
| Push notifications | — | ✅ Owns |
| Which features the app shows | — | ✅ Owns |

> **One sentence for the BA:** the Factory System remains the single source of truth
> for everything about money. The App Platform is a window onto it, plus a letterbox
> for requests.

---

## 2. The constraint that shapes this design

> **The Factory System's business logic does not change.**

That rules out three things a textbook integration would ask for, and it is worth
naming them so nobody proposes them later:

| ✗ Not asked for | Why it would be a logic change |
| --- | --- |
| Storing an external reference against a request | A schema change and a write path |
| Calling an outside API before generating accounts | A change to the bill-run job |
| Accepting a decision made elsewhere | A change to who may approve |

**What *is* asked for is one read-only endpoint** — data going out. Reading does not
change how the business works.

Everything below is designed around that single ask.

---

## 3. How the duplicate problem is solved

This is the question that decides the design, so it comes before the endpoints.

### 3.1 The problem, if we get it wrong

> Kamal asks for an advance in the app. The office enters it into the Factory System.
> The Factory System sends it back to us in the next sync. **We do not recognise it and
> record a second advance.** Kamal appears to have borrowed twice.

### 3.2 The solution: we never create a credit record at all

**The App Platform does not create advances. It creates *messages*.**

| | What it is |
| --- | --- |
| **App Platform** | An **inbox**. "Kamal asked for Rs. 10,000 on 2 August." That is a *message*, not a facility |
| **Factory System** | The **record**. The advance itself — the balance, the instalments, the deduction on the account |

Since only one system ever creates the record, **there is nothing to duplicate.** The
matching problem does not need solving; it needs not to exist.

```
   ┌────────────────────────────────────────────────────────────┐
   │  App Platform                                              │
   │                                                            │
   │   "Kamal asked for an advance of Rs. 10,000 on 2 Aug"     │
   │    └─ a message. No balance. No instalment. No deduction. │
   │                                                            │
   └────────────────────────────────────────────────────────────┘
                              │
                       the office reads it
                              │
                              ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Factory System                                            │
   │                                                            │
   │   ADV-2026-08-0042  ·  Rs. 10,000  ·  approved            │
   │    └─ THE record. Balance, instalments, deductions.        │
   │                                                            │
   └────────────────────────────────────────────────────────────┘
                              │
                     comes back in the sync
                              ▼
   ┌────────────────────────────────────────────────────────────┐
   │  App Platform displays it                                  │
   │   "Outstanding advance: Rs. 10,000"                        │
   │    └─ read from the Factory System. Not our number.        │
   └────────────────────────────────────────────────────────────┘
```

### 3.3 What the office does

The workflow is the same one the office runs today, with the walk-in replaced by a
screen:

| Today | With the app |
| --- | --- |
| Kamal walks in and asks | The request appears in the new console |
| The clerk enters it into the Factory System | *unchanged* |
| The Factory System decides it | *unchanged* |
| The clerk tells Kamal | The clerk marks the request **Handled** in the new console, with the outcome |
| — | Kamal's app shows it, and a notification is sent |

**The one new step is the last one**, and it takes a click. It exists so the supplier
is told — which is the point of the whole project.

### 3.4 Who decides, and what each side calculates

**The factory sets its lending rules in the new console, and the office decides there.**
The App Platform holds the policy — how many settled months a supplier needs, what the
ceiling is a multiple of, and whether there is a cap — so the limit shown in the app and
the limit the office judges against are one calculation rather than two.

That leaves one obligation on this design, and it is **not optional**:

```
    available  =  ceiling(rule, leaf history)  −  outstanding
                  └─ App Platform ─────────┘     └─ Factory System ─┘
```

> ⚠️ **The App Platform must never compute the available amount from its own records
> alone.** A supplier who took an advance at the counter has a balance the platform has
> never seen; subtracting only what it knows about lets them borrow the same headroom
> twice.

**So `outstanding*` in §5.2's `suppliers` block must be the Factory System's complete
balances** — counter-raised and app-raised together. If the Factory System can report
only one of the two, say so before build starts: the app would then have to stop showing
an available figure at all, which is a product decision rather than an implementation
detail.

**The office still enters the approved request into the Factory System**, exactly as
§3.3 describes. Deciding it in the new console does not change who does the accounting —
the deduction, the instalments and the balance stay where they are today.

### 3.5 Why not match records automatically?

Three alternatives were considered and rejected under the "no logic change"
constraint:

| Approach | Why not |
| --- | --- |
| Factory System stores our reference and echoes it | A schema and logic change — ruled out by §2 |
| Match on supplier + type + amount + date | Two advances of the same amount in a week match wrongly. Silent, and about money |
| Clerk types our reference into a notes field | Workable, but a typo produces a silent wrong match |

**Not creating the record in the first place is better than any of them**, and it is
free.

> If the Factory System team can later store an external reference (§8), the
> **Handled** click can be automated away. It is an optimisation, not a prerequisite.

---

## 4. How data moves

**One direction, one endpoint.** Everything the app shows about money is a copy of the
Factory System, pulled automatically.

```
┌──────────────────────┐                        ┌──────────────────────┐
│   Factory System     │                        │    App Platform      │
│   (unchanged)        │                        │    (new)             │
└──────────────────────┘                        └──────────────────────┘
           │                                               │
           │   GET /api/updates?from=&to=&include=&limit=  │
           │◄──────────────────────────────────────────────┤  hourly, 05:30–20:00
           │                                               │  automatic
           ├──────────────────────────────────────────────►│  no human step
           │   suppliers · deliveries · months             │
           │   bills · requests · balances                 │  ~8–40 KB gzipped
           │                                               │  (§5.6)
           └───────────────────────────────────────────────┘

           ◄── requests travel back on paper, not on wire ──►
                    (the office reads the console and
                     enters them as it always has)
```

**There is no second endpoint and no callback**, because there is nothing for the
Factory System to receive: the office is the bridge, exactly as it is today.

---

## 5. The endpoint — the only thing to build

**Built by: the Factory System team.**

### 5.1 Request

```http
GET /api/updates?from=2026-08-01&to=2026-08-08
Authorization: Bearer <token issued to the App Platform>
Accept: application/json
```

| Parameter | Format | Required | Meaning |
| --- | --- | --- | --- |
| `from` | `YYYY-MM-DD` | yes | Inclusive, Colombo local date |
| `to` | `YYYY-MM-DD` | yes | Inclusive |
| `include` | comma list | no | Which collections to return. Default: all five |
| `limit` | integer | no | Maximum **records per collection**. Default 500, maximum 2000 |
| `cursor` | opaque string | no | Continue a previous response. Copied verbatim from `nextCursor` |

**A date range, not "what changed yesterday".** If the platform is down for a day it
simply widens the window and catches up. A "changes since last call" endpoint cannot
recover from a missed call, and cannot express a *correction* to a day already sent.

Return everything **created or modified** within the range — filter on the row's
`updated_at`, not on its business date. A July bill corrected in August must appear in an
August window, or the correction never reaches the app.

**`from`/`to` are a filter, not a dump.** An hourly call passes a one-hour window and
receives only what moved in that hour, which is usually nothing. See
[§5.6](#56-volume-and-cadence) for what the sizes actually are at 2,000 suppliers.

#### Paging

Three of the five collections have days when they move all at once — the whole supplier
register on migration day, every bill on publication day. Those are the responses worth
bounding, and `limit` bounds them.

```http
GET /api/updates?from=2026-08-01&to=2026-08-08&limit=500
   → { ..., "nextCursor": "eyJvIjo1MDB9" }

GET /api/updates?from=2026-08-01&to=2026-08-08&limit=500&cursor=eyJvIjo1MDB9
   → { ..., "nextCursor": null }        ← last page
```

The platform keeps calling while `nextCursor` is non-`null`. `nextCursor: null` means
the window is complete.

The cursor is **opaque to us** — encode whatever suits the Factory System (an offset, a
`(updated_at, id)` pair, a keyset). The only requirements are that the same cursor with
the same `from`/`to` returns the same page, and that ordering is **stable**: sort by
`updated_at` then by the row's own id, so a row is never skipped when two share a
timestamp.

If paging is genuinely difficult to add, say so at the first meeting. It is not needed
for a normal day — it is needed for publication day and for the first-ever backfill, and
we can work around it with narrower windows.

### 5.2 Response

> **A complete, valid sample is in [`factory-updates-sample.json`](./factory-updates-sample.json)**
> — send that file with this document. Its figures are internally consistent (gross =
> kilos × rate, the nine deduction lines sum to their own total, and payable + coins
> reconciles), so it can be used as a fixture rather than only as a picture.
>
> It deliberately contains six cases that are easy to get wrong:
> a supplier with **no bank details**, a **voided** weighing, a month with **`null`**
> rates, all four request types, all three request statuses, and a bill with **coins
> carried forward**.

Abbreviated here; the sample file has the whole thing.

```json
{
  "from": "2026-08-01",
  "to": "2026-08-08",
  "generatedAt": "2026-08-08T10:00:00+05:30",

  "suppliers": [
    {
      "supplierId": "5147",
      "supplierCode": "5147 (DENIYAYA)",
      "name": "Kamal Perera",
      "nic": "883210456V",
      "phone": "0771234567",
      "collectionPoint": "DENIYAYA",
      "status": "active",
      "homeAddress": "No 12, Deniyaya Road, Akuressa",
      "estateAddress": "Lot 4, Deniyaya Estate",
      "bankName": "Bank of Ceylon",
      "bankBranch": "Akuressa",
      "accountNumber": "1234567890",
      "paymentMethod": "bankTransfer",
      "savingsPerKg": 20.00,
      "savingsBalance": 48200.00,
      "outstandingAdvance": 10000.00,
      "outstandingLoan": 0.00,
      "outstandingManure": 8500.00,
      "updatedAt": "2026-08-07T14:22:00+05:30"
    }
  ],

  "deliveries": [
    {
      "deliveryId": "DEL-2026-08-05-000412",
      "supplierId": "5147",
      "date": "2026-08-05",
      "collectionPoint": "DENIYAYA",
      "kg": 24.50,
      "voided": false,
      "updatedAt": "2026-08-05T16:10:00+05:30"
    }
  ],

  "months": [
    {
      "monthKey": "2026-07",
      "stage": "published",
      "ratePerKg": 118.75,
      "extraRatePerKg": 6.00,
      "publishedAt": "2026-08-05T09:00:00+05:30"
    }
  ],

  "bills": [
    {
      "billId": "BIL-2026-07-5147",
      "billNo": "07/5147",
      "supplierId": "5147",
      "monthKey": "2026-07",
      "billDate": "2026-08-05",
      "totalKg": 245.00,
      "ratePerKg": 118.75,
      "extraRatePerKg": 6.00,
      "grossAmount": 30581.25,
      "deductions": {
        "transportCharges": 612.50,
        "tea": 4800.00,
        "savings": 4900.00,
        "loansAdvance": 0.00,
        "advance": 2000.00,
        "manure": 1700.00,
        "otherCards": 0.00,
        "stamps": 25.00,
        "previousDebts": 0.00,
        "total": 14037.50
      },
      "balanceAmount": 16543.75,
      "coinsBroughtForward": 0.35,
      "coinsCarriedForward": 0.10,
      "finalBalance": 16544.00,
      "publishedAt": "2026-08-05T09:00:00+05:30"
    }
  ],

  "requests": [
    {
      "requestId": "ADV-2026-08-0042",
      "supplierId": "5147",
      "type": "advance",
      "amount": 10000.00,
      "status": "approved",
      "raisedAt": "2026-08-02T10:15:00+05:30",
      "decidedAt": "2026-08-03T11:00:00+05:30",
      "decidedBy": "Ruwan Jayasuriya",
      "note": "Within the ceiling for leaf already weighed."
    }
  ]
}
```

`type` ∈ `advance` · `loan` · `manure` · `teaPacket`
`status` ∈ `pending` · `approved` · `rejected`

### 5.3 Field notes — please read these

| Field | Requirement |
| --- | --- |
| **`supplierId`** | Must be **stable for ever**. Everything on the platform is keyed on it. If the supplier code can change (a supplier moves division), send an unchanging internal id here and the display code in `supplierCode` |
| **All amounts, `kg`** | JSON **numbers**, 2 decimal places. Not strings. No thousands separators, no `Rs.` |
| **Dates** | `YYYY-MM-DD`, Colombo local. Timestamps ISO-8601 **with offset** (`+05:30`) |
| **`voided`** | A withdrawn weighing is sent with `voided: true` — **never omitted**. An absent row and a cancelled row look identical otherwise, and one of them still counts towards a total |
| **`stage`** | `collecting` · `awaitingRate` · `rateEntered` · `billsGenerated` · `published`. This is how the app knows whether to show a supplier an amount or "not settled yet" |
| **`outstanding*`** | The supplier's **complete** balance — counter-raised and app-raised together. The app displays these; it never computes them |

### 5.4 `null` versus `0` — the most important rule here

```json
{ "grossAmount": 0 }      ← the supplier earned nothing this month
{ "grossAmount": null }   ← the auction rate is not in yet; the amount is unknown
```

**Two completely different facts, displayed differently in the app.** `0` tells a
supplier they earned nothing. `null` tells them the month has not settled.

Send `0` where the truth is "unknown" and suppliers will telephone the office
believing they have been paid nothing.

Any rate-derived field may be `null`: `ratePerKg`, `extraRatePerKg`, `grossAmount`,
`balanceAmount`, `finalBalance`. **Kilograms are never `null`** — the weight is known
before the rate is.

> This is why the specification asks for **JSON rather than CSV**. A CSV cell cannot
> tell an empty value from a zero from a column that was never sent.

### 5.5 Fields the Factory System does not hold

**Send what exists; omit what does not.** The platform does not require every field.

The one thing that must not happen is **inventing a value to fill a gap** — a `0`
where the truth is "we don't track that" becomes a figure somebody quotes back.

### 5.6 Volume and cadence

**The concern this section answers:** *at 2,000 suppliers this JSON will be enormous, and
calling it every hour around the clock will cost the Factory System's server dearly.*

Half right. Here is the measurement.

#### The window is a delta, so an ordinary call is tiny

Because `from`/`to` filter on `updated_at`, an hourly call returns **one hour of
changes** — not 2,000 suppliers. Sizes below are gzipped, measured on generated data with
realistic variation in names, branches and amounts:

| Call | Records | Gzipped |
| --- | --- | --- |
| Quiet hour — nothing moved | 0 | **~100 bytes** |
| Ordinary weighing hour | 500 deliveries | **8 KB** |
| Busiest weighing hour | 2,500 deliveries | **40 KB** |
| Whole day, if pulled in one call | 20,000 deliveries | 319 KB |
| **Publication day** | 2,000 bills at once | **230 KB** |
| Publication day at 5× growth | 10,000 bills | **1.1 MB** ← the one to bound |
| First-ever backfill | everything | 733 KB |
| One page with `limit=500` | 500 bills | 58 KB |

So the steady state is 8–40 KB an hour, and most calls return nothing at all. **The two
responses worth bounding are publication day and the first backfill** — which is what
`limit`/`cursor` in §5.1 are for, and why they are worth the trouble even though no
ordinary day needs them.

> **`months` is one row per calendar month for the whole factory — about 12 a year.**
> Not one per supplier per month. A supplier's month is a **bill**, and there are as many
> of those as there are suppliers. If the Factory System holds monthly rows *per
> supplier*, they belong in `bills`.

#### Don't poll through the night

**Correct — around-the-clock polling buys nothing.** The Factory System's data only moves
while the factory is open: leaf is weighed at the collection points, requests are raised
at the counter. Between eight at night and half past five in the morning every call is
answered "nothing changed".

| Colombo time | Cadence | Collections |
| --- | --- | --- |
| 05:30 | once, window widened to cover the night | all five |
| 05:30 – 20:00 | hourly | `deliveries`, `requests` |
| 20:00 – 05:30 | **no calls** | — |
| 05:30 daily | once | `suppliers`, `months` |
| On publication day | until `nextCursor` is `null` | `bills` |

That is roughly **15 calls a day instead of 24**, and the expensive collections are
fetched at their own pace rather than at the pace of the fastest one. The `include`
parameter is what makes the split possible — without it, every hourly delivery poll drags
the supplier register along behind it.

> **Built:** the console's freshness indicator now measures staleness in *polling* hours
> rather than wall-clock hours. Without that change, the first clerk in at six every
> morning would meet a red "figures may be out of date" banner over a perfectly healthy
> console — the last sync genuinely being ten hours old — and would have learned to
> ignore it by the end of the first week. A day of polls actually missed still raises it.

#### The two things that actually control the cost

Call count is not the expense; these are.

1. **Index `updated_at` on every table in the payload.** An indexed lookup that returns
   nothing costs about a millisecond. The same query as a full table scan across 2,000
   suppliers × years of deliveries is the entire problem, and it will not be visible in
   testing against a small database. **This is the one performance request in this
   document.**
2. **Enable gzip** (`Content-Encoding: gzip`). This data is repetitive JSON and
   compresses six- to twelvefold — the 1.1 MB publication-day response is 6.8 MB without
   it. One line of server configuration.

Optional, if easy: respond `304 Not Modified` to a conditional request when nothing in
the window changed. Worth little — an empty response is already ~100 bytes — so do not
spend a meeting on it.

---

## 6. What the App Platform does with it

**Built by: the platform team.** Listed so the Factory System team can see that
nothing here lands on them.

- Pull hourly, automatically. **No human upload step** — a file somebody has to
  remember does not get uploaded on a Poya day
- Upsert by id. Never insert blind
- Display balances and accounts **as received**. Never recompute a figure the Factory
  System already calculated — two implementations disagree on the first rounding
- Show the office **how fresh the data is** (§7)
- Compute the credit **ceiling** from the factory's configured rule, and subtract the
  Factory System's `outstanding*` figures to reach the available amount (§3.4). Never
  the second half from its own records

---

## 7. One thing the office must be told ✅ built

Accounts and balances in the new console are **as fresh as the last successful sync**.
A clerk reading a balance to a supplier on the telephone has no way to know that.

The console now says so, in two places and for two different reasons:

| | When | Where |
| --- | --- | --- |
| *"Read from the factory's system at 09:12, covering up to 7 August"* | Always, while the sync is healthy | Under the bills grid and the supplier's month history |
| A warning across the whole shell | The last success is more than **3 hours** old | Every screen |
| An error across the whole shell | The console has **never** synced | Every screen |

Three decisions worth knowing, because they change what the Factory System has to
report:

- **The everyday line matters more than the warning.** A signal that only appears when
  something is wrong teaches the office that *no banner means live* — so on the day the
  banner is a few minutes late, a figure gets quoted as though it were.
- **"Never synced" is separated from "stale"**, because they need different people: one
  is a deployment that was not finished, the other is a job that has stopped running.
- **`coversUpTo` is the field the office actually uses.** *"Synced 12 minutes ago"* is
  not answerable to a supplier asking about last Tuesday; *"we have everything up to the
  7th"* is.

### What this asks of the Factory System

**Nothing.** The freshness is the platform's own record of its own pulls — it knows when
it last called §5's endpoint and what date range came back. No extra field, no extra
endpoint.

---

## 8. Optional, later — not required now

If the Factory System team can do these **at some future point**, they remove the
manual step in §3.3. None is needed for the first release, and none should delay it.

| Upgrade | What it removes |
| --- | --- |
| Accept a request over an API (create only, same rules) | The office re-keying an app request |
| Store an external reference against a request | The **Handled** click; the platform could match automatically |
| Send a webhook when a request is decided | The hourly wait before the supplier is told |

**Do not design the first release around these.** Deliver §5, prove it, and revisit.

---

## 9. Rules that must hold on both sides

| Rule | Why |
| --- | --- |
| **`null` ≠ `0`** (§5.4) | "Earned nothing" and "not settled yet" are different sentences |
| **Money: numbers, 2 decimals** | A figure that arrives as a string is parsed differently on each side |
| **Truncate, never round up** | The supplier did not agree to a rounded-up rupee |
| **Dates are Colombo local** | A weighing at 8pm on the 31st belongs to that month |
| **The same range may be re-fetched safely** | Every sync can be retried. Nothing may double-apply |
| **A void is sent, not omitted** | An absent row and a withdrawn row are different facts |
| **A failed sync is loud** | Silence must never look like agreement |

---

## 10. What each team does

### Business analyst

- [ ] Confirm which of §5.2's fields the Factory System actually holds
- [ ] Agree the office workflow in §3.3 — especially the **Handled** step
- [ ] Confirm the Factory System has a **stable supplier id**, not only a code that can change
- [ ] Confirm its `outstanding*` balances include credit raised **at the counter**, not
      only what came through the app — §3.4 depends on it
- [ ] Agree who is called when a sync fails
- [ ] Obtain the Green Leaf Account layout so the app's slip matches it field for field

### Existing Factory System team

- [ ] Build **`GET /api/updates?from=&to=`** (§5). This is the only item
- [ ] **Index `updated_at`** on every table in the payload (§5.6) — the one performance ask
- [ ] **Enable gzip** on the response (§5.6) — one line of configuration
- [ ] Support `limit`/`cursor` paging, for publication day and the backfill (§5.1)
- [ ] Issue an access token for the App Platform
- [ ] Provide the Green Leaf Account schema, field by field

**Nothing else.** No schema change, no change to how accounts are generated, no change
to who approves what.

### Platform team

- [ ] Hourly pull during office hours only, 05:30–20:00 Colombo (§5.6); upsert by id
- [ ] Follow `nextCursor` to the end of every window
- [ ] Request screens **record** the factory's decision rather than making one (§3.4)
- [ ] Never compute a credit ceiling or re-derive an account figure
- [ ] Freshness indicator (§7)
- [ ] Alert on a failed sync

---

## 11. Questions for the first meeting

1. Does the Factory System have a **stable supplier id**, or only the supplier code?
2. Can it expose a read endpoint over HTTPS, with a token?
3. What is the Green Leaf Account layout, field by field?
4. Are savings and credit balances held as running totals, or must they be derived?
5. Are voided weighings retained, or deleted? (If deleted, the platform cannot learn
   that one was withdrawn — see §5.3)
6. How far back can the endpoint serve? The platform needs an initial backfill
7. Who is on call when a sync fails?
8. Is `limit`/`cursor` paging feasible? If not, the platform will narrow its windows
   instead — but publication day sends every supplier's account at once (§5.6)
9. What hours does the factory actually weigh? The 05:30–20:00 polling window is a
   guess, and the freshness banner is calibrated against it
