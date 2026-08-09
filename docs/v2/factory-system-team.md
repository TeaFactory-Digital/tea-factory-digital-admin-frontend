# What the Factory System team is asked to build

**One read-only endpoint. Nothing else.**

| | |
| --- | --- |
| **Status** | Draft for review |
| **Audience** | The team that maintains the existing Factory System |
| **What we ask you to build** | **One read-only endpoint** |
| **What changes in your business logic** | **Nothing** |
| **Send with this** | [`factory-updates-sample.json`](./factory-updates-sample.json) — a complete, valid sample response |

> **Context in one paragraph.** The factory is giving its suppliers a mobile app. The
> existing Factory System keeps running the business exactly as it does today — leaf
> collection, monthly rates, Green Leaf Accounts, payouts, savings, advances, loans,
> manure and tea packets. The app is a window onto that data plus a letterbox for
> requests, and **the office remains the bridge**: it reads a request on a screen and
> enters it into the Factory System exactly as it enters a walk-in today. The whole
> design is in [factory-integration-spec.md](./factory-integration-spec.md);
> **this document is the only part of it that asks anything of you.**

---

## 0. The constraint — hold us to it

> **Your business logic does not change.**

Three things a textbook integration would ask for, and is **not** asking for here:

| ✗ Not asked for | Why it would be a logic change |
| --- | --- |
| Storing an external reference against a request | A schema change and a write path |
| Calling an outside API before generating accounts | A change to the bill-run job |
| Accepting a decision made elsewhere | A change to who may approve |

**What *is* asked for is one read-only endpoint** — data going out. Reading does not
change how the business works. If anything below reads as more than that, it is a
mistake in this document and we want to hear about it.

> ⚠️ **Two things must be true for this to be buildable as written**: every table in the
> payload carries a modified timestamp, and the system can serve HTTPS. Neither is safe
> to assume. **[§7](#7-if-either-assumption-is-false) gives the fallback for each** — both
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

Return everything **created or modified** within the range — filter on the row's
`updated_at`, not on its business date. A July bill corrected in August must appear in an
August window, or the correction never reaches the app.

**`from`/`to` are a filter, not a dump.** An hourly call passes a one-hour window and
receives only what moved in that hour, which is usually nothing. See
[§6](#6-volume-and-cadence) for what the sizes actually are at 2,000 suppliers.

### Paging

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

The cursor is **opaque to us** — encode whatever suits you (an offset, an
`(updated_at, id)` pair, a keyset). The only requirements are that the same cursor with
the same `from`/`to` returns the same page, and that ordering is **stable**: sort by
`updated_at` then by the row's own id, so a row is never skipped when two share a
timestamp.

If paging is genuinely difficult to add, say so at the first meeting. It is not needed
for a normal day — it is needed for publication day and for the first-ever backfill, and
we can work around it with narrower windows.

---

## 2. Response

> **A complete, valid sample is in [`factory-updates-sample.json`](./factory-updates-sample.json)**
> — it ships with this document. Its figures are internally consistent (gross =
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
      "outstandingManure": 8500.00,
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
      "ratePerKg": 118.75,
      "extraRatePerKg": 6.00,
      "publishedAt": "2026-08-05T09:00:00+05:30"
    }
  ],

  "bills": [
    {
      "billId": "BIL-2026-07-SUP-000412",
      "billNo": "07/5147",
      "supplierId": "SUP-000412",
      "monthKey": "2026-07",
      "billDate": "2026-08-05",
      "totalKg": 245.00,
      "ratePerKg": 118.75,
      "extraRatePerKg": 6.00,
      "grossAmount": 30563.75,
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
      "balanceAmount": 16526.25,
      "coinsBroughtForward": 0.35,
      "coinsCarriedForward": 0.60,
      "finalBalance": 16526.00,
      "publishedAt": "2026-08-05T09:00:00+05:30"
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

## 3. Field notes — please read these

| Field | Requirement |
| --- | --- |
| **`supplierId`** | Must be **stable for ever**. Everything on the platform is keyed on it. If the supplier code can change (a supplier moves division), send an unchanging internal id here and the display code in `supplierCode` |
| **All amounts, `kg`** | JSON **numbers**, 2 decimal places. Not strings. No thousands separators, no `Rs.` |
| **Dates** | `YYYY-MM-DD`, Colombo local. Timestamps ISO-8601 **with offset** (`+05:30`) |
| **`voided`** | A withdrawn weighing is sent with `voided: true` — **never omitted**. An absent row and a cancelled row look identical otherwise, and one of them still counts towards a total |
| **`stage`** | `collecting` · `awaitingRate` · `rateEntered` · `billsGenerated` · `published`. This is how the app knows whether to show a supplier an amount or "not settled yet" |
| **`outstanding*`** | The supplier's **complete** balance — counter-raised and app-raised together. The app displays these; it never computes them |

> **`outstanding*` is the field we most need to be right about.** The app shows a
> supplier what they may borrow, and it works that out by subtracting these figures. If
> they cover only credit raised through the app and not credit raised at your counter,
> a supplier can be shown headroom they have already used. **If the Factory System can
> report only one of the two, tell us before build starts** — the app then shows no
> figure at all, which is a product decision rather than an implementation detail.

---

## 4. `null` versus `0` — the most important rule here

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

---

## 5. Fields the Factory System does not hold

**Send what exists; omit what does not.** The platform does not require every field.

The one thing that must not happen is **inventing a value to fill a gap** — a `0`
where the truth is "we don't track that" becomes a figure somebody quotes back.

---

## 6. Volume and cadence

**The concern this section answers:** *at 2,000 suppliers this JSON will be enormous, and
calling it every hour around the clock will cost the Factory System's server dearly.*

Half right. Here is the measurement.

### The window is a delta, so an ordinary call is tiny

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
`limit`/`cursor` in [§1](#1-request) are for, and why they are worth the trouble even
though no ordinary day needs them.

> **`months` is one row per calendar month for the whole factory — about 12 a year.**
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
| 20:00 – 05:30 | **no calls** | — |
| 05:30 daily | once | `suppliers`, `months` |
| On publication day | until `nextCursor` is `null` | `bills` |

That is roughly **15 calls a day instead of 24**, and the expensive collections are
fetched at their own pace rather than at the pace of the fastest one. The `include`
parameter is what makes the split possible — without it, every hourly delivery poll drags
the supplier register along behind it.

> **These hours are a guess.** If the factory actually weighs outside 05:30–20:00, tell
> us — the schedule is ours to change and costs nothing to change.

### The two things that actually control the cost

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

## 7. If either assumption is false

Everything above assumes two things that a system of this age may not have. **Both have
a workable fallback**, and both change the shape of the work — so the answers are wanted
before the first build meeting, not discovered during it.

### Assumption 1 — every table in the payload has a modified timestamp

[§1](#1-request) filters on `updated_at`. If those columns do not exist, adding them is a
schema change with a trigger behind it, which [§0](#0-the-constraint--hold-us-to-it)
rules out. **The delta model is then unavailable and each collection falls back
separately:**

| Collection | Fallback with no modified timestamp |
| --- | --- |
| `suppliers` | 2,000 rows. **Send the whole table daily** — 733 KB gzipped ([§6](#6-volume-and-cadence)) — and let the platform diff. No timestamp needed, and nothing is lost |
| `months` | About 12 rows a year. Send them all, every call. Trivial |
| `bills` | **Send every bill for a named month** when that month publishes, and again whole if any bill in it is corrected. The platform replaces the month outright |
| `deliveries` | **The hard one.** The business `date` works for new rows but *cannot express a correction* — a weighing voided last week never reaches the app. Re-send a **rolling window wholesale**: the current month plus the previous one, until the previous month is published |
| `requests` | Same rolling window as `deliveries`, same reason |

> ⚠️ **Every one of these is a wholesale replace, not a merge**, and the platform must
> know which it is receiving. *"Here is everything for August"* and *"here is what changed
> in August"* need opposite handling: the first must delete rows it no longer sees, the
> second must never do that. Get it backwards and either voided weighings live for ever
> or a supplier's history disappears.

**Agree the mode per collection once, and write it into this document.** It does not need
to be a field on the response — it never changes after build — but it must be written
down somewhere both teams read.

### Assumption 2 — the Factory System can serve HTTPS

If the Factory System is a desktop application over a LAN database, **there is no server
to host this endpoint on** and it cannot be built as described. Three ways out, best
first:

| Option | What you do | What it costs |
| --- | --- | --- |
| **Read-only database user** | Grant `SELECT` on the payload's tables plus a network route. **No code change at all** — genuinely less work than building an endpoint | The platform team builds and hosts the endpoint itself. It then depends on your schema, so a column rename breaks the sync |
| **Read-only replica** | The same, pointed at a replica rather than the live database | A replica to stand up. In exchange, no load whatever on the live system |
| **Scheduled export** | A timed job writing [§2](#2-response)'s JSON to SFTP or a shared folder | Acceptable **only if a machine runs it**. The objection is to a *person* remembering to upload, not to a file |

> ⚠️ **Database access is a larger trust ask than an endpoint, not a smaller one.** An
> endpoint exposes a chosen shape; a login exposes everything the account can read. Expect
> — and ask for — a named user, a named set of tables, and a named source address.

---

## 8. Rules that must hold on both sides

| Rule | Why |
| --- | --- |
| **`null` ≠ `0`** ([§4](#4-null-versus-0--the-most-important-rule-here)) | "Earned nothing" and "not settled yet" are different sentences |
| **Money: numbers, 2 decimals** | A figure that arrives as a string is parsed differently on each side |
| **Truncate, never round up** | The supplier did not agree to a rounded-up rupee |
| **Dates are Colombo local** | A weighing at 8pm on the 31st belongs to that month |
| **The same range may be re-fetched safely** | Every sync can be retried. Nothing may double-apply |
| **A void is sent, not omitted** | An absent row and a withdrawn row are different facts |

---

## 9. Your checklist

- [ ] **Answer [§10](#10-questions-for-the-first-meeting)'s first two questions before
      anything else** — does every table in the payload carry a modified timestamp, and
      can the system serve HTTPS? Both change what the rest of this list means
- [ ] Build **`GET /api/updates?from=&to=`** ([§1](#1-request)–[§5](#5-fields-the-factory-system-does-not-hold)). This is the only item
- [ ] **Index `updated_at`** on every table in the payload ([§6](#6-volume-and-cadence)) —
      the one performance ask. If the column does not exist, agree a
      [§7](#7-if-either-assumption-is-false) fallback per collection instead
- [ ] **Enable gzip** on the response ([§6](#6-volume-and-cadence)) — one line of configuration
- [ ] Support `limit`/`cursor` paging, for publication day and the backfill ([§1](#1-request))
- [ ] Issue an access token for the App Platform
- [ ] Provide the Green Leaf Account schema, field by field

**Nothing else.** No schema change, no change to how accounts are generated, no change
to who approves what.

---

## 10. Questions for the first meeting

**The first two decide the shape of everything else. We will ask them first.**

1. **Does every table in the payload carry a modified timestamp** — `updated_at`,
   `modified_on`, whatever it is called locally? **Which tables do not?** The whole
   date-range design in [§1](#1-request) rests on this;
   [§7](#7-if-either-assumption-is-false) has the fallback for each collection that
   lacks one
2. **Can the Factory System serve HTTPS with a token?** If it cannot — a desktop
   application over a LAN database, say — **would a read-only database user be possible
   instead**, with the platform team building and hosting the endpoint?
   ([§7](#7-if-either-assumption-is-false))
3. Does the Factory System have a **stable supplier id**, or only the supplier code?
4. What is the Green Leaf Account layout, field by field?
5. Are savings and credit balances held as running totals, or must they be derived?
6. Are voided weighings retained, or deleted? (If deleted, the platform cannot learn
   that one was withdrawn — see [§3](#3-field-notes--please-read-these))
7. How far back can the endpoint serve? The platform needs an initial backfill
8. Who is on call when a sync fails?
9. Is `limit`/`cursor` paging feasible? If not, the platform will narrow its windows
   instead — but publication day sends every supplier's account at once
   ([§6](#6-volume-and-cadence))
10. What hours does the factory actually weigh? The 05:30–20:00 polling window is a
    guess
