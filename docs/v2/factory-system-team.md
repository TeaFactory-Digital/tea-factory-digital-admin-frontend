# What the Factory System team is asked to build

**One read-only endpoint. Nothing else.**

| | |
| --- | --- |
| **Status** | Draft for review |
| **Audience** | The team that maintains the existing Factory System |
| **What we ask you to build** | **One read-only endpoint** |
| **What changes in your business logic** | **Nothing** |
| **Send with this** | [`factory-updates-sample.json`](./factory-updates-sample.json): a complete, valid sample response |
| **The rest of the project** (not sent to you) | [new-factory.md](./new-factory.md): the factory's own decisions, including who instructs you, and the platform team's side of the sync. [factory-records.md](./factory-records.md): the records the factory keeps in the new console until your system is connected |

> **Context in one paragraph.** The factory is giving its suppliers a mobile app. The
> existing Factory System keeps running the business exactly as it does today: leaf
> collection, monthly rates, Green Leaf Accounts, payouts, savings, advances, loans,
> manure and tea packets. The app is a window onto that data plus a letterbox for
> requests, and **the office remains the bridge**: it reads a request on a screen and
> enters it into the Factory System exactly as it enters a walk-in today.
> **Sections 0 to 10 are the only part of this document that asks anything of you.**
> Sections [A](#a-why-the-design-is-this-shape) to
> [F](#f-before-build-three-conversations), after them, are the design behind that ask
> (what each side does, how a request is never recorded twice, who decides credit, the
> three conversations before build), so you can check the reasoning rather than take it
> on trust. They ask nothing more of you.

---

## 0. The constraint: hold us to it

> **Your business logic does not change.**

Three things a textbook integration would ask for, and is **not** asking for here:

| ✗ Not asked for | Why it would be a logic change |
| --- | --- |
| Storing an external reference against a request | A schema change and a write path |
| Calling an outside API before generating accounts | A change to the bill-run job |
| Accepting a decision made elsewhere | A change to who may approve |

**What *is* asked for is one read-only endpoint**: data going out. Reading does not
change how the business works. If anything below reads as more than that, it is a
mistake in this document and we want to hear about it.

> ⚠️ **Two things must be true for this to be buildable as written**: every table in the
> payload carries a modified timestamp, and the system can serve HTTPS. Neither is safe
> to assume. **[§7](#7-if-either-assumption-is-false) gives the fallback for each**. Both
> are workable, and both change the shape of the work, so we would rather have the
> answers *before* the first build meeting than during it.

---

## 1. Request

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

Return everything **created or modified** within the range. Filter on the row's
`updated_at`, not on its business date. A July bill corrected in August must appear in an
August window, or the correction never reaches the app.

**`from`/`to` are a filter, not a dump.** An hourly call passes a one-hour window and
receives only what moved in that hour, which is usually nothing. See
[§6](#6-volume-and-cadence) for what the sizes actually are at 2,000 suppliers.

### Paging

Three of the five collections have days when they move all at once: the whole supplier
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

The cursor is **opaque to us**. Encode whatever suits you (an offset, an
`(updated_at, id)` pair, a keyset). The only requirements are that the same cursor with
the same `from`/`to` returns the same page, and that ordering is **stable**: sort by
`updated_at` then by the row's own id, so a row is never skipped when two share a
timestamp.

If paging is genuinely difficult to add, say so at the first meeting. It is not needed
for a normal day; it is needed for publication day and for the first-ever backfill, and
we can work around it with narrower windows.

---

## 2. Response

> **A complete, valid sample is in [`factory-updates-sample.json`](./factory-updates-sample.json)**
>, which ships with this document. Its figures are internally consistent and laid out like
> the factory's own printed Green Leaf Account (gross = kilos × (rate + extra rate) +
> coins brought forward; the nine deduction lines sum to their own total; balance =
> gross − deductions; paid + coins carried forward = balance), so it can be used as a
> fixture rather than only as a picture.
>
> **Bill `2026210869` in the sample is a real July 2026 Galaboda slip**, figure for figure,
> with the supplier's name and code changed. If the endpoint sends that slip back exactly
> like this, every bill will be right.
>
> It also contains six cases that are easy to get wrong:
> a supplier with **no bank details**, a **voided** weighing, a month with **`null`**
> rates, all four request types, all three request statuses, and bills with **coins
> carried forward**.

Abbreviated here; the sample file has the whole thing.

```json
{
  "from": "2026-08-01",
  "to": "2026-08-08",
  "generatedAt": "2026-08-08T10:00:00+05:30",

  "suppliers": [
    {
      "supplierId": "SUP-000412",
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
      "outstandingManure": 15300.00,
      "updatedAt": "2026-08-07T14:22:00+05:30"
    }
  ],

  "deliveries": [
    {
      "deliveryId": "DEL-2026-08-05-000412",
      "supplierId": "SUP-000412",
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
      "ratePerKg": 222.00,
      "extraRatePerKg": 3.00,
      "publishedAt": "2026-08-10T09:00:00+05:30"
    }
  ],

  "bills": [
    {
      "billId": "BIL-2026-07-SUP-000633",
      "billNo": "2026210869",
      "supplierId": "SUP-000633",
      "monthKey": "2026-07",
      "billDateTime": "2026-08-10T10:58:22+05:30",
      "auctionResultAvailable": true,
      "totalKg": 509.50,
      "ratePerKg": 222.00,
      "extraRatePerKg": 3.00,
      "totalRatePerKg": 225.00,
      "greenLeafAmount": 113109.00,
      "extraPayment": 1528.50,
      "coinsBroughtForward": 7.41,
      "grossAmount": 114644.91,
      "deductions": {
        "transportCharges": 0.00,
        "tea": 1298.00,
        "savings": 5095.00,
        "loansAdvance": 0.00,
        "advance": 40000.00,
        "manure": 0.00,
        "otherCards": 0.00,
        "stamps": 25.00,
        "previousDebts": 0.00,
        "total": 46418.00
      },
      "loanInstalmentNo": null,
      "balanceAmount": 68226.91,
      "savingsWithdrawal": 0.00,
      "coinsCarriedForward": 6.91,
      "finalBalance": 68220.00,
      "carryForward": {
        "nextMonthDeb": 0.00,
        "loanBalance": 0.00,
        "manureBalance": 0.00,
        "loanInterest": 0.00
      },
      "savings": { "thisMonth": 5095.00, "previous": 21970.00, "toDate": 27065.00 },
      "paymentMethod": "cash",
      "publishedAt": "2026-08-10T09:00:00+05:30"
    }
  ],

  "requests": [
    {
      "requestId": "ADV-2026-08-0042",
      "supplierId": "SUP-000412",
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

---

## 3. Field notes: please read these

| Field | Requirement |
| --- | --- |
| **`supplierId`** | Must be **stable for ever**. Everything on the platform is keyed on it. If the supplier code can change (a supplier moves division), send an unchanging internal id here and the display code in `supplierCode` |
| **`supplierCode`** | As the factory writes it (`5147 (DENIYAYA)`). The **bare number** (`5147`) is the supplier's identity on the platform and their app sign-in id, so it must be unique across the whole factory. Keep any leading zeros (`0708`): a code that arrives without them (`708`) is matched only when exactly one supplier fits |
| **All amounts, `kg`** | JSON **numbers**, 2 decimal places. Not strings. No thousands separators, no `Rs.` |
| **Dates** | `YYYY-MM-DD`, Colombo local. Timestamps ISO-8601 **with offset** (`+05:30`) |
| **`voided`** | A withdrawn weighing is sent with `voided: true`, **never omitted**. An absent row and a cancelled row look identical otherwise, and one of them still counts towards a total |
| **`stage`** | `collecting` · `awaitingRate` · `rateEntered` · `billsGenerated` · `published`. This is how the app knows whether to show a supplier an amount or "not settled yet" |
| **`outstanding*`** | The supplier's **complete** balance: counter-raised and app-raised together. The app displays these; it never computes them |
| **A bill: every figure as printed** | Send each line **exactly as the printed Green Leaf Account shows it**. The app displays them and never recalculates, so a figure that is not sent is a blank line in the app |
| **`grossAmount`** | As the slip prints it: green leaf + extra payment **+ coins brought forward** (113,109.00 + 1,528.50 + 7.41 = 114,644.91) |
| **`balanceAmount`, `finalBalance`, `coinsCarriedForward`** | Balance Amount (gross − deductions), the Balance actually paid **after the factory's rounding** (68,220.00 when it pays in tens), and the rest carried forward (6.91) |
| **`greenLeafAmount`, `extraPayment`, `totalRatePerKg`** | The three lines above the gross. Send them; do not leave the platform to multiply |
| **`loanInstalmentNo`** | The number printed after "Loans / Advance" (the **3** in "Loans / Advance 3"): which instalment of the loan this is. `null` when no loan was deducted |
| **`carryForward.loanBalance`** | The slip's "Loan Balance": the **loan** still owed after this month's instalment. **Not the advance.** An advance is taken back in full on its own month's bill and never carries a balance; what the account could not cover goes to `nextMonthDeb` |
| **`carryForward.loanInterest`** | The slip's "Loan Interest": **this month's interest charge, in rupees**. Not a rate, and not the interest owed to date |
| **`carryForward.nextMonthDeb`**, **`manureBalance`** | "Next Month Deb" (what this bill could not cover, deducted as Previous Debts next month) and the manure still owed |
| **`deductions.otherCards`** | Small deductions the office types by hand. The app shows the line as "Other deductions" |
| **`savings`** | The slip's savings block: This month, Previous, Todate |
| **`savingsWithdrawal`** | Savings paid back to the supplier on this bill, if the factory does that. `0` when none; omit the field if the system never does |
| **`billNo`, `billDateTime`** | The number and the date **and time** printed on the slip (`2026210869`, 2026/08/10 10:58:22) |
| **`paymentMethod`** | As printed on the bill ("CASH PAYMENT" → `cash`), not today's choice: a supplier who changed to bank transfer in September was still paid in cash for July |

> **`outstanding*` is the field we most need to be right about.** The app shows a
> supplier what they may borrow, and it works that out by subtracting these figures. If
> they cover only credit raised through the app and not credit raised at your counter,
> a supplier can be shown headroom they have already used. **If the Factory System can
> report only one of the two, tell us before build starts**. The app then shows no
> figure at all, which is a product decision rather than an implementation detail.

---

## 4. `null` versus `0`: the most important rule here

```json
{ "grossAmount": 0 }      ← the supplier earned nothing this month
{ "grossAmount": null }   ← the auction rate is not in yet; the amount is unknown
```

**Two completely different facts, displayed differently in the app.** `0` tells a
supplier they earned nothing. `null` tells them the month has not settled.

Send `0` where the truth is "unknown" and suppliers will telephone the office
believing they have been paid nothing.

Any rate-derived field may be `null`: `ratePerKg`, `extraRatePerKg`, `grossAmount`,
`balanceAmount`, `finalBalance`. **Kilograms are never `null`**: the weight is known
before the rate is.

> This is why the specification asks for **JSON rather than CSV**. A CSV cell cannot
> tell an empty value from a zero from a column that was never sent.

---

## 5. Fields the Factory System does not hold

**Send what exists; omit what does not.** The platform does not require every field.

The one thing that must not happen is **inventing a value to fill a gap**. A `0`
where the truth is "we don't track that" becomes a figure somebody quotes back.

---

## 6. Volume and cadence

**The concern this section answers:** *at 2,000 suppliers this JSON will be enormous, and
calling it every hour around the clock will cost the Factory System's server dearly.*

Half right. Here is the measurement.

### The window is a delta, so an ordinary call is tiny

Because `from`/`to` filter on `updated_at`, an hourly call returns **one hour of
changes**, not 2,000 suppliers. Sizes below are gzipped, measured on generated data with
realistic variation in names, branches and amounts:

| Call | Records | Gzipped |
| --- | --- | --- |
| Quiet hour, nothing moved | 0 | **~100 bytes** |
| Ordinary weighing hour | 500 deliveries | **8 KB** |
| Busiest weighing hour | 2,500 deliveries | **40 KB** |
| Whole day, if pulled in one call | 20,000 deliveries | 319 KB |
| **Publication day** | 2,000 bills at once | **230 KB** |
| Publication day at 5× growth | 10,000 bills | **1.1 MB** ← the one to bound |
| First-ever backfill | everything | 733 KB |
| One page with `limit=500` | 500 bills | 58 KB |

So the steady state is 8–40 KB an hour, and most calls return nothing at all. **The two
responses worth bounding are publication day and the first backfill**, which is what
`limit`/`cursor` in [§1](#1-request) are for, and why they are worth the trouble even
though no ordinary day needs them.

> **`months` is one row per calendar month for the whole factory: about 12 a year.**
> Not one per supplier per month. A supplier's month is a **bill**, and there are as many
> of those as there are suppliers. If the Factory System holds monthly rows *per
> supplier*, they belong in `bills`.

### The platform will not poll through the night

**Around-the-clock polling buys nothing.** Your data only moves while the factory is
open: leaf is weighed at the collection points, requests are raised at the counter.
Between eight at night and half past five in the morning every call would be answered
"nothing changed".

| Colombo time | Cadence | Collections |
| --- | --- | --- |
| 05:30 | once, window widened to cover the night | all five |
| 05:30 – 20:00 | hourly | `deliveries`, `requests` |
| 20:00 – 05:30 | **no calls** | none |
| 05:30 daily | once | `suppliers`, `months` |
| On publication day | until `nextCursor` is `null` | `bills` |

That is roughly **15 calls a day instead of 24**, and the expensive collections are
fetched at their own pace rather than at the pace of the fastest one. The `include`
parameter is what makes the split possible. Without it, every hourly delivery poll drags
the supplier register along behind it.

> **These hours are a guess.** If the factory actually weighs outside 05:30–20:00, tell
> us. The schedule is ours to change and costs nothing to change.

### The two things that actually control the cost

Call count is not the expense; these are.

1. **Index `updated_at` on every table in the payload.** An indexed lookup that returns
   nothing costs about a millisecond. The same query as a full table scan across 2,000
   suppliers × years of deliveries is the entire problem, and it will not be visible in
   testing against a small database. **This is the one performance request in this
   document.**
2. **Enable gzip** (`Content-Encoding: gzip`). This data is repetitive JSON and
   compresses six- to twelvefold: the 1.1 MB publication-day response is 6.8 MB without
   it. One line of server configuration.

Optional, if easy: respond `304 Not Modified` to a conditional request when nothing in
the window changed. Worth little (an empty response is already ~100 bytes), so do not
spend a meeting on it.

---

## 7. If either assumption is false

Everything above assumes two things that a system of this age may not have. **Both have
a workable fallback**, and both change the shape of the work, so the answers are wanted
before the first build meeting, not discovered during it.

### Assumption 1: every table in the payload has a modified timestamp

[§1](#1-request) filters on `updated_at`. If those columns do not exist, adding them is a
schema change with a trigger behind it, which [§0](#0-the-constraint-hold-us-to-it)
rules out. **The delta model is then unavailable and each collection falls back
separately:**

| Collection | Fallback with no modified timestamp |
| --- | --- |
| `suppliers` | 2,000 rows. **Send the whole table daily** (733 KB gzipped, [§6](#6-volume-and-cadence)) and let the platform diff. No timestamp needed, and nothing is lost |
| `months` | About 12 rows a year. Send them all, every call. Trivial |
| `bills` | **Send every bill for a named month** when that month publishes, and again whole if any bill in it is corrected. The platform replaces the month outright |
| `deliveries` | **The hard one.** The business `date` works for new rows but *cannot express a correction*: a weighing voided last week never reaches the app. Re-send a **rolling window wholesale**: the current month plus the previous one, until the previous month is published |
| `requests` | Same rolling window as `deliveries`, same reason |

> ⚠️ **Every one of these is a wholesale replace, not a merge**, and the platform must
> know which it is receiving. *"Here is everything for August"* and *"here is what changed
> in August"* need opposite handling: the first must delete rows it no longer sees, the
> second must never do that. Get it backwards and either voided weighings live for ever
> or a supplier's history disappears.

**Agree the mode per collection once, and write it into this document.** It does not need
to be a field on the response (it never changes after build), but it must be written
down somewhere both teams read.

### Assumption 2: the Factory System can serve HTTPS

If the Factory System is a desktop application over a LAN database, **there is no server
to host this endpoint on** and it cannot be built as described. Three ways out, best
first:

| Option | What you do | What it costs |
| --- | --- | --- |
| **Read-only database user** | Grant `SELECT` on the payload's tables plus a network route. **No code change at all**, genuinely less work than building an endpoint | The platform team builds and hosts the endpoint itself. It then depends on your schema, so a column rename breaks the sync |
| **Read-only replica** | The same, pointed at a replica rather than the live database | A replica to stand up. In exchange, no load whatever on the live system |
| **Scheduled export** | A timed job writing [§2](#2-response)'s JSON to SFTP or a shared folder | Acceptable **only if a machine runs it**. The objection is to a *person* remembering to upload, not to a file |

> ⚠️ **Database access is a larger trust ask than an endpoint, not a smaller one.** An
> endpoint exposes a chosen shape; a login exposes everything the account can read. Expect
> (and ask for) a named user, a named set of tables, and a named source address.

---

## 8. Rules that must hold on both sides

| Rule | Why |
| --- | --- |
| **`null` ≠ `0`** ([§4](#4-null-versus-0-the-most-important-rule-here)) | "Earned nothing" and "not settled yet" are different sentences |
| **Money: numbers, 2 decimals** | A figure that arrives as a string is parsed differently on each side |
| **Truncate, never round up** | The supplier did not agree to a rounded-up rupee |
| **Dates are Colombo local** | A weighing at 8pm on the 31st belongs to that month |
| **The same range may be re-fetched safely** | Every sync can be retried. Nothing may double-apply |
| **A void is sent, not omitted** | An absent row and a withdrawn row are different facts |
| **A failed sync is loud** | Silence must never look like agreement |

---

## 9. Your checklist

- [ ] **Answer [§10](#10-questions-for-the-first-meeting)'s first two questions before
      anything else**: does every table in the payload carry a modified timestamp, and
      can the system serve HTTPS? Both change what the rest of this list means
- [ ] Build **`GET /api/updates?from=&to=`** ([§1](#1-request)–[§5](#5-fields-the-factory-system-does-not-hold)). This is the only item
- [ ] **Index `updated_at`** on every table in the payload ([§6](#6-volume-and-cadence)):
      the one performance ask. If the column does not exist, agree a
      [§7](#7-if-either-assumption-is-false) fallback per collection instead
- [ ] **Enable gzip** on the response ([§6](#6-volume-and-cadence)): one line of configuration
- [ ] Support `limit`/`cursor` paging, for publication day and the backfill ([§1](#1-request))
- [ ] Issue an access token for the App Platform
- [ ] Check the bill fields against your Green Leaf Account ([§3](#3-field-notes-please-read-these)): sample bill `2026210869` is a real slip, and every field on it is wanted

**Nothing else.** No schema change, no change to how accounts are generated, no change
to who approves what.

---

## 10. Questions for the first meeting

**The first two decide the shape of everything else. We will ask them first.**

1. **Does every table in the payload carry a modified timestamp** (`updated_at`,
   `modified_on`, whatever it is called locally)? **Which tables do not?** The whole
   date-range design in [§1](#1-request) rests on this;
   [§7](#7-if-either-assumption-is-false) has the fallback for each collection that
   lacks one
2. **Can the Factory System serve HTTPS with a token?** If it cannot (a desktop
   application over a LAN database, say), **would a read-only database user be possible
   instead**, with the platform team building and hosting the endpoint?
   ([§7](#7-if-either-assumption-is-false))
3. Does the Factory System have a **stable supplier id**, or only the supplier code?
4. We have a printed Green Leaf Account (July 2026, in the sample). **Which of its fields
   does the database hold, and which are only worked out when the slip is printed?** In
   particular the savings block (Previous, Todate), the loan instalment number, and the
   time on the slip
5. Are savings and credit balances held as running totals, or must they be derived?
6. Are voided weighings retained, or deleted? (If deleted, the platform cannot learn
   that one was withdrawn; see [§3](#3-field-notes-please-read-these))
7. How far back can the endpoint serve? The platform needs an initial backfill
8. Who is on call when a sync fails?
9. Is `limit`/`cursor` paging feasible? If not, the platform will narrow its windows
   instead, but publication day sends every supplier's account at once
   ([§6](#6-volume-and-cadence))
10. What hours does the factory actually weigh? The 05:30–20:00 polling window is a
    guess

---

## A. Why the design is this shape

**Nothing from here on asks anything of you.** It is the reasoning behind sections 0 to
10, written down so the split of work is not re-argued at every meeting.

### A.1 What this project is

**The factory is giving its suppliers a mobile app.** That is the whole of it.

The existing Factory System runs the business and **keeps running it, unchanged**:
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

### A.2 What each side does

| | Existing Factory System | App Platform (new) |
| --- | --- | --- |
| Leaf, rates, accounts, payouts, savings | ✅ **Owns and decides** | Displays a copy |
| Advances, loans, manure, tea packets | ✅ **Owns and decides** | Receives the request, displays the outcome |
| Supplier registry, balances | ✅ **Owns** | Displays a copy |
| Mobile app accounts, passwords, devices | None | ✅ Owns |
| App content: news, banners, FAQ, terms | None | ✅ Owns |
| Push notifications | None | ✅ Owns |
| Which features the app shows | None | ✅ Owns |
| The lending **rule** configuration | None | ✅ Owns ([C](#c-who-decides-credit-and-what-each-side-calculates)) |

> **In one sentence:** the Factory System remains the single source of truth
> for everything about money. The App Platform is a window onto it, plus a letterbox
> for requests.

### A.3 Until your system is connected

Everything in this document assumes the platform can read the Factory System (**"Factory
system sync: on"**). That is not the default: **the sync starts off** (stored as
`{ enabled: false }`; absent or `null` also reads as off), and a factory keeps its records
in the new console until its own system is connected and the factory administrator
switches the sync on deliberately (Configuration → Factory system). No factory's system is
connected yet. While it is off, the office keeps, in the new console, the smallest set of
records the app needs: suppliers, opening balances, daily leaf, the monthly rate, bills,
walk-in credit requests and other deductions, one at a time or from an Excel/CSV file. A
factory uses one source at a time, never both. The contract is
[factory-records.md](./factory-records.md).

With the sync off the console also decides credit requests (four-eyes: the person who
records a request cannot approve it), and the office types each approval into the
factory's own system, so the office is still the bridge.

**Bills, with the sync off, come one way per factory** (Configuration → Bill
calculation → "Where the bills come from"):

- **Imported.** The factory's own system keeps printing every bill. Each month the office
  exports the finished bills to Excel and imports them; the import creates the month, the
  bills are stored exactly as printed, and the import refuses a file that lacks something
  approved in the console. Whoever imported a month's bills cannot publish it (four-eyes),
  and a division file that arrives after the publish waits for a manager to publish its
  bills. **Galaboda works this way**
  ([factory-records.md §5a](./factory-records.md#5a-bills-imported-from-the-factorys-own-system)).
- **Calculated** in the console from the leaf, the rate and the deduction rates, for a
  factory whose own system still prints its bills but cannot export them
  (factory-records.md §5). Each calculated bill is compared with the factory's printed
  slip before the month is published; one that differs is held, and released later in
  order. No factory needs this yet, so it is built last.

Nothing in this document is asked of a factory that keeps its records in the console.

### A.4 The constraint that is not technical

Your business logic does not change ([§0](#0-the-constraint-hold-us-to-it)), and that is
the constraint every section above is designed around. The other one is commercial: the
endpoint is work for your team, and a specification cannot create an obligation. Who at the
factory instructs you, and on what terms, is the factory's decision
([new-factory.md §7.1](./new-factory.md#71-who-instructs-the-existing-vendor)), and nothing
in this document starts without it.

---

## B. How a request is never recorded twice

This is the question that decides the design, so it was settled before the endpoint was.

### B.1 The problem, if we get it wrong

> Kamal asks for an advance in the app. The office enters it into the Factory System.
> The Factory System sends it back to us in the next sync. **We do not recognise it and
> record a second advance.** Kamal appears to have borrowed twice.

### B.2 The solution: the platform never creates a credit record

**The App Platform does not create advances. It creates *messages*.**

| | What it is |
| --- | --- |
| **App Platform** | An **inbox**. "Kamal asked for Rs. 10,000 on 2 August." That is a *message*, not a facility |
| **Factory System** | The **record**. The advance itself: the balance, the instalments, the deduction on the account |

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

### B.3 What the office does

The workflow is the same one the office runs today, with the walk-in replaced by a
screen:

| Today | With the app |
| --- | --- |
| Kamal walks in and asks | The request appears in the new console |
| The clerk enters it into the Factory System | *unchanged* |
| The Factory System decides it | *unchanged* |
| The clerk tells Kamal | The clerk marks the request **Handled** in the new console, with the outcome |
| (nothing) | Kamal's app shows it, and a notification is sent |

**The one new step is the last one**, and it takes a click. It exists so the supplier
is told, which is the point of the whole project.

### B.4 Why not match records automatically?

Three alternatives were considered and rejected under the "no logic change"
constraint:

| Approach | Why not |
| --- | --- |
| Factory System stores our reference and echoes it | A schema and logic change, ruled out by [§0](#0-the-constraint-hold-us-to-it) |
| Match on supplier + type + amount + date | Two advances of the same amount in a week match wrongly. Silent, and about money |
| Clerk types our reference into a notes field | Workable, but a typo produces a silent wrong match |

**Not creating the record in the first place is better than any of them**, and it is
free.

> If the Factory System team can later store an external reference
> ([E](#e-optional-later-not-required-now)), the **Handled** click can be automated away.
> It is an optimisation, not a prerequisite.

---

## C. Who decides credit, and what each side calculates

**The Factory System decides. Every time.**

The office enters the request into the Factory System exactly as it does today, the
Factory System applies the factory's lending rules, and the clerk then records the
outcome in the new console ([B.3](#b3-what-the-office-does)'s **Handled** step). The
console is where a decision is *written down*, never where it is *made*. Deciding
elsewhere would change who may approve, which [§0](#0-the-constraint-hold-us-to-it) rules
out.

That leaves one question: what does the app show a supplier **before** they ask?

### The ceiling the app shows is this platform's, and the factory admin owns it

**The lending rule is configuration in the new console, not a formula in anybody's
build.** The factory administrator sets it under *Configuration → Credit rules*: a basis, a
multiplier, how many months to average, how many settled months are required, and an
optional cap, per facility
([status.md, M14 Configuration](./status.md#credit-rules-how-much-a-supplier-may-borrow)).

There is exactly **one implementation** of the arithmetic, `creditCeilingFromRule`
(`packages/domain/src/leafCredit.ts`), shared between this platform and the mobile app.
The supplier reads the factory's own configured policy, computed once, not a second
formula that agrees with the console's until the first policy change.

**Under the sync, the console's request queue does not check against it.** It *records*
the factory's decision and nothing more: no `over-ceiling`, no `stale-eligibility`, and
the button says the factory approved it. The ceiling's job here is to tell the supplier
**what to ask for**, never to gate **what the office may approve**.

> **Not built yet.** The sync starts with Phase 10 (BACKEND-TODO.md, "Later"). Today's
> queue serves the factories that keep their records in the console
> ([A.3](#a3-until-your-system-is-connected)), where the console is the place the decision
> is made: it approves and refuses itself (`over-ceiling`, `stale-eligibility`,
> `loan-outstanding`, four-eyes). The record-only queue described here is still to be
> built, before the first factory switches its sync on.

```
    available  =  ceiling(configured rule, leaf history)  −  outstanding
                  └─ App Platform ────────────────────┘     └─ Factory System ─┘
                     one rule · one implementation            the only unknown
```

**This is why the ceiling is not a copy of anything.** The Factory System holds no
lending rule for it to drift from. The factory's policy lives in the console, where the
administrator maintains it, and both screens read it from there.

> ⚠️ **But the App Platform must never compute the right-hand term from its own
> records.** A supplier who took an advance at the counter has a balance the platform has
> never seen; subtracting only what it knows about shows headroom that is not there, and
> a supplier shown Rs. 15,000 and refused it at the counter trusts the app less
> afterwards, not more.

**So the `outstanding*` fields must be the Factory System's complete balances**:
counter-raised and app-raised together ([§3](#3-field-notes-please-read-these)).
Configuring the rule in the console solves the left-hand term completely; **it does
nothing for the right-hand one.** If the Factory System can report only app-raised credit,
say so before build starts: the app would then have to stop showing a figure at all,
which is a product decision rather than an implementation detail.

### The one obligation this leaves on the factory

The console computes the ceiling. **The office still decides the request.** So the
configured rule must match what the office actually approves. If *Credit rules* says
3× the last settled month and the counter refuses anything above Rs. 30,000, the app is
promising money the factory will not lend.

That is not a drift between two systems; it is a drift between a **configured policy and
an actual practice**, and it has one owner: **the factory administrator who maintains the
screen**. Naming that owner is
[a management decision](./new-factory.md#73-who-owns-the-lending-rule), not a build item.

---

## D. How data moves

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
           │                                               │
           └───────────────────────────────────────────────┘

           ◄── requests travel back on paper, not on wire ──►
                    (the office reads the console and
                     enters them as it always has)
```

**There is no second endpoint and no callback**, because there is nothing for the
Factory System to receive: the office is the bridge, exactly as it is today. The endpoint
itself is sections [1](#1-request) to [7](#7-if-either-assumption-is-false) above.

---

## E. Optional, later: not required now

If the Factory System team can do these **at some future point**, they remove the
manual step in [B.3](#b3-what-the-office-does). None is needed for the first release, and
none should delay it.

| Upgrade | What it removes |
| --- | --- |
| Accept a request over an API (create only, same rules) | The office re-keying an app request |
| Store an external reference against a request | The **Handled** click; the platform could match automatically |
| Send a webhook when a request is decided | The hourly wait before the supplier is told |

**Do not design the first release around these.** Deliver the endpoint, prove it, and
revisit.

---

## F. Before build: three conversations

The design is narrow on purpose (one read-only endpoint, no change to the Factory System's
business logic, the office as the bridge), and it works only if some assumptions about the
factory are true. **Nobody on either development team can check them.** They are three
conversations with three different parties, run by whoever runs the first meetings (the
business analyst, if there is one), and each must end with an answer **in writing**.

| With | About | Must produce, in writing |
| --- | --- | --- |
| **Factory management** | Who instructs the existing vendor, and on what terms | A named person at the factory; whether the work is inside the maintenance contract or a quoted change (price, approver, delivery date); a named engineer at the vendor. Or the decision to run with the sync off ([A.3](#a3-until-your-system-is-connected)). See [new-factory.md §7.1](./new-factory.md#71-who-instructs-the-existing-vendor) |
| **The Factory System team** | What their data actually holds | Answers to [§10](#10-questions-for-the-first-meeting): a modified timestamp on every table and HTTPS (both decide the shape of everything; [§7](#7-if-either-assumption-is-false) has the fallbacks); a stable supplier id; whether `outstanding*` includes credit raised at the counter; whether voided weighings are kept; whether balances are stored or derived; and **the Green Leaf Account layout, field by field**, so the app's slip matches the paper one |
| **The factory office** | The one new step in their day ([B.3](#b3-what-the-office-does)) | The **Handled** step agreed, and whose named job it is; the hours the factory actually weighs (the 05:30 to 20:00 polling window is a guess); who is called when a sync fails, at the factory and at the vendor; and the factory administrator who owns the *Credit rules* screen, with confirmation that the rule matches what the counter approves ([C](#c-who-decides-credit-and-what-each-side-calculates)) |

> ⚠️ **The management conversation blocks the other two and is the easiest to postpone.**
> A perfect specification obliges nobody to build it.

**The one that loses money if it is wrong:** whether the Factory System's `outstanding*`
balances are complete (counter-raised and app-raised together). If they are not, say so
**before build starts**: the app then shows no available figure at all, which is a
product decision rather than an implementation detail.
