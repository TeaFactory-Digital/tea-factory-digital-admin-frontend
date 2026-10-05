# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (4 October 2026)

**Nothing open.** Items #1 to #25 are done and have been removed from this file. The last
batch (#19 to #25) is in `285b489`, `94844db` and `b683ed2`, and was checked on staging:

- #19 change request detail sends `decidedAt` and `decidedById`.
- #20 refresh accepts the console's `Origin` (no more `403 csrf`).
- #21 bank details change requests can be approved.
- #22 credit request detail opens.
- #23 inquiries send `closedByName` and `createdByName`.
- #24 `manureProducts` is a list again, and saved wholesale.
- #25 inquiries are conversations (`messages`, `POST /inquiries/:id/messages`).

New items will be added below as they are found.

---

## 27. Savings report: savings held across the factory, month by month

**Priority:** Medium. A new report the office asked for. The console's Reports screen has a
Savings tab that is already built and switches on by itself when this exists; until then it
says the report is not available yet.

**What is missing**
There is no way to see how much the factory is holding for all suppliers together. One
supplier's passbook exists (`GET /admin/savings/:supplierId/ledger`, now shown on the
supplier record), but there is no total.

**What to do**
Add a report `savingsHeld` to `REPORTS` in `apps/api/src/modules/admin/reports.service.ts`,
so it answers `GET /v1/admin/reports/savingsHeld` like `channelShift` does. Feature
`enableSavings`; capability `reports: R`.

One row per month that has any savings entry, **oldest first**:

```json
{
  "rows": [
    { "monthKey": "2026-09", "paidIn": 130000.00, "takenOut": 30000.00,
      "balanceTotal": 1000000.00, "suppliersSaving": 415 }
  ]
}
```

- `paidIn`: sum of `savings_entries.amount` where `amount > 0` in that month.
- `takenOut`: sum of `-amount` where `amount < 0` in that month (sent as a positive number).
- `balanceTotal`: for every supplier, their latest `balance_after` up to and including that
  month (by `seq`), summed. This is the figure an auditor reconciles, so compute it from
  `balance_after`, not by adding `paidIn - takenOut` across months.
- `suppliersSaving`: how many of those latest balances are above zero.
- Optional `from` / `to` (`YYYY-MM`), the same as `channelShift`.

Read only: the report changes nothing.

**Check**
Open Reports, then Savings, in the console. "Savings held" equals the sum of every supplier's
"Balance now" on their savings passbook.

---

## 28. Queues ignore `supplierId`, so "this supplier's requests" shows everyone's

**Priority:** High. The office is shown other suppliers' requests while believing they are
looking at one supplier.

**What is wrong**
The console's supplier record has quick links to that supplier's requests:
`/credit?supplierId=…`, `/tea-packets?supplierId=…`, `/inquiries?supplierId=…`. The console
sends `supplierId` to the API, but the query schemas in
`apps/api/src/modules/queues/queues.controller.ts` (`queueQuerySchema`, `creditQuerySchema`,
`inquiryQuerySchema`, and the tea packets one) have no `supplierId`, and zod drops unknown
keys. So the filter is silently ignored and every supplier's rows come back.

Checked on staging (5 October) with a supplier id that does not exist: credit requests
answered 2 rows, tea packet requests 1, inquiries 3. All should be 0.

**What to do**
1. Add `supplierId: z.string().uuid().optional()` to those schemas.
2. In each list (`CreditRequestsService.list`, the tea packets list, `InquiriesService.list`,
   and the change requests list), add `...(query.supplierId ? { supplierId: query.supplierId } : {})`
   to the `where`.
3. Consider making these schemas `.strict()`, so a filter the API does not know is refused
   (`400`) instead of silently ignored. That is how this bug stayed hidden.

**Check**
`GET /admin/credit-requests?status=rejected&supplierId=00000000-0000-0000-0000-000000000000`
answers no rows. Open a supplier in the console, press "Credit requests": only that
supplier's requests are listed.

---

## 29. Credit and tea packets report: what was given out, month by month

**Priority:** Medium. A new report the office asked for. The console's Reports screen has a
"Credit & tea packets" tab that is already built and switches on by itself when this exists.

**What to do**
Add a report `creditGiven` to `REPORTS` in `apps/api/src/modules/admin/reports.service.ts`,
answering `GET /v1/admin/reports/creditGiven` like `channelShift`. Capability `reports: R`;
no feature flag on the report itself (a facility that is off simply has zeros).

One row per month, **oldest first**, counting requests by the month they were **decided**
(`decided_at`, Asia/Colombo):

```json
{
  "rows": [
    { "monthKey": "2026-09",
      "advanceAmount": 50000.00, "advanceCount": 5,
      "loanAmount": 300000.00,   "loanCount": 2,
      "manureAmount": 0.00,      "manureCount": 0,
      "teaPacketAmount": 3000.00, "teaPackets": 6,
      "rejected": 1 }
  ]
}
```

- `advance*`, `loan*`, `manure*`: approved `credit_requests` of that facility; amount is the
  approved `amount`, count is the number of requests.
- `teaPackets`: the number of **packets** in approved `tea_packet_requests`;
  `teaPacketAmount` their `amount`.
- `rejected`: rejected requests of all four kinds in that month.
- Optional `from` / `to` (`YYYY-MM`), the same as `channelShift`.

**Check**
Approve one advance in the console, then open Reports, then Credit & tea packets: this
month's Advances goes up by that amount and by one request.
