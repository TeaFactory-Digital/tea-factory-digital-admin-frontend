# Backend to-do

Only the work still open (26 October 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

| # | What | Priority |
|---|------|----------|
| 50 | Staging is not running the latest commits | Now |
| 45 | Factory records: late bills wait for a manager (the one change to step 1), then opening balances, leaf and months, other deductions, importing again, the bill engine | High |
| 48 | "This month so far": `GET /bills/month-to-date` | Medium |
| - | Later: factory sync (Phase 10), balance corrections | Later |

## 50. Staging is not running the latest commits

Checked on 26 October 2026 (read only): `GET /config` for galaboda still answers
`factorySync: null` and **14 flags** (no `enableMonthToDate`). So staging is not on
`068faf3` (and therefore not `12eea12`): migrations `20261023010000`, `20261024010000` and
`20261026010000` are not applied there. Please deploy and migrate, so the console can be
tried against the bills import and publish.

## 45. Factory records without the factory system

The office keeps suppliers, daily leaf, monthly rates, bills, opening balances and counter
credit requests in the console while the sync is off. **Contract:** factory-records.md.

**In this order:**

1. **One change to step 1 (`12eea12`), decided by the factory (R15): a late division
   file's bills wait for a manager.** Today they are published at once by the importer. Keep
   them unpublished in the published month, count them in `MonthSummary.lateBills`, and let
   `POST /admin/months/:monthKey/publish` on a published month publish them (four-eyes
   against their importer; `already-published` only when none are left). factory-records
   §5a "A late division file". The console and the mock already do this. Your other
   round-four questions: **R14** yes, the import creates the month; **R16** yes, four-eyes
   covers the importer; **R17** opening balances cover the first slip and approvals before
   the cut-over, and withdrawals pending at cut-over are settled or cancelled before it
   (decision 15). Your T8 list is done in the console (`vendor:pull` for
   `headerRequired` / `missingImportColumns`, the exact-cent checks, `loanInstalmentNo`
   1 to 360, `records-busy`, `MonthSummary.lateBills`).
2. **Opening balances:** `GET` / `PUT /admin/suppliers/:id/opening-balances` and the
   `openingBalances` import (factory-records §4.2).
3. **Leaf and months:** the leaf and month endpoints in factory-records §4.1
   (`/admin/deliveries`, `/admin/deliveries/summary`, the rate, exceptions), and the
   `deliveries` and `monthlyRates` imports.
4. **Other deductions:** `PUT /admin/bills/:id/adjustment` and the `billAdjustments` import.
5. **The bill engine** (factory-records §5), last: galaboda imports its bills, so no factory
   needs it yet. With it, **the printed-slip check and hold** (§5, "Comparing with the printed
   slips", steps 1 to 8): `GET /admin/months/:monthKey/slip-comparison`,
   `PUT /admin/bills/:id/printed`, `POST /admin/bills/:id/hold` and `/release`, the
   `printedBalances` import, `409 bills-mismatch` on the publish, the automatic hold of a
   supplier's next bill (`heldForMonth`), and releases in order (`409 earlier-bill-held`).
   You have agreed to relax the month lock for a held supplier's leaf only.

**Alongside, any time:**

- **Importing a file again** (factory-records §4.2, "A file can be imported again"): `dryRun`
  and `duplicates` on `POST /admin/imports/:kind`, `skipped` in the answer. The `suppliers`
  import is live, so this changes it: an existing code is **skipped** (`supplier-exists`),
  no longer `supplier-code-taken` for the whole file. Leaf is matched on date, supplier,
  kilos and collection point **by count** (`leafRecordKey`, `matchRecorded`).

**Check:** the list in factory-records §9.

## 48. "This month so far" on the app's Account tab

The flag is done. Left: **`GET /bills/month-to-date`** (supplier realm, own data only).
Declare it **before** `GET /bills/:monthKey`, or `month-to-date` is read as a month. Answers
`MonthToDate` (`packages/domain/src/types/app.ts`) or `200 null`:

- `null` when the flag is off (not `403`: the app treats `null` and `404` alike).
- **Which month (your rule, agreed):** the supplier's oldest month that still has an
  unpublished or held bill; otherwise the month after the factory's newest published month.
  `monthEnded` is true once that calendar month is over (Asia/Colombo).
- `totalKgs`, `supplyDays`, `lastSupplyDate` (`YYYY-MM-DD`) and `dailySupply` (every day of the
  month, `kgs: null` on a day without leaf) from the **non-voided** deliveries of that month.
- `approved`: rupees approved in that month by facility (`advance`, `loan`, `manure`,
  `teaPackets`), 0 for none or a facility switched off. By approval date.
- `asOf`: when it was computed. **Never a rate, gross or balance**: a draft bill's figures
  must not reach the app before the publish.

**Check:** flag off: `null`. Flag on, mid-month with 11 days of leaf and an approved
Rs. 15,000 advance: `totalKgs` is the sum of that month's non-voided deliveries,
`supplyDays: 11`, `approved.advance: 15000`. After the month ends and before publishing:
still that month, `monthEnded: true`. After publishing: the next month.

## Later

- **Factory sync (Phase 10):** the request to the factory team asks for every line of the
  printed bill (`factory-system-team.md` §3, `factory-updates-sample.json`, bill
  `2026210869`): `greenLeafAmount`, `extraPayment`, `totalRatePerKg`, `loanInstalmentNo`,
  `savingsWithdrawal`, `savings` (This month / Previous / Todate), `billDateTime`, the bill's
  own `paymentMethod`, and `grossAmount` including the coins brought forward. Map them onto
  `BillRow` and store them as received. Switching a factory from records kept here back to
  the sync ("the sync's records replace ours") waits for this too.
- **A balance found wrong after the first published bill (C5):** a manager posts a correction
  entry with a note, applied on the next bill.
- **Past months (A9):** imported as published history, with no balance change and no
  notification.

## When you ship one, tell me

The console hides each unfinished feature in one file, `apps/admin/src/lib/serverReady.ts`,
so the office never meets a `404`. When an item above ships, tell me (or change the line in
the same PR) and the feature appears:

| Console feature | Waits for | Line in `serverReady.ts` |
|---|---|---|
| Import → Opening balances, Daily leaf, Monthly rates, Other deductions, Printed slip balances | `POST /admin/imports/{openingBalances, deliveries, monthlyRates, billAdjustments, printedBalances}` | `IMPORT_KINDS_NOT_ON_SERVER` (one entry each; Finished bills is live) |
| Opening balances card (supplier → Money) | `GET` / `PUT /admin/suppliers/:id/opening-balances` | `OPENING_BALANCES_ON_SERVER = false` |
| "Other deductions" → Edit on a bill | `PUT /admin/bills/:id/adjustment` | `OTHER_DEDUCTIONS_ON_SERVER = false` |
| Rates & month close: "Compare with printed slips", the checklist step, held badges | `slip-comparison`, `printed`, `hold`, `release` | `SLIP_COMPARISON_ON_SERVER = false` |
| Configuration → Features: "Account tab: this month so far" | `GET /bills/month-to-date` | `MONTH_TO_DATE_ON_SERVER = false` |
| Import dialog: which rows are already there, and "import them anyway" for leaf | `dryRun`, `duplicates`, `skipped` | `IMPORT_SKIP_ON_SERVER = false` |

The leaf intake grid and Rates & month close stay visible; they call the leaf and month
endpoints and start working as those land.
