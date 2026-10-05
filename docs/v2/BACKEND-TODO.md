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
