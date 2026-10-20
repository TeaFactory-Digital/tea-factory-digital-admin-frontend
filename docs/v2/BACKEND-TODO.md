# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (10 October 2026)

**Done and removed from this file: #1 to #44, #46 and #47** (latest in `b470323`: the
bell's activity feed, the onboarding command, and `-` instead of the em dash in
change-request summaries).

**Still open:**

| # | What | Priority |
|---|------|----------|
| 45 | Factory records without the factory system: the rest (bill engine, imports, add supplier, opening balances, walk-ins, leaf and months) | High |


**Done on the console for your last note** (please `vendor:pull`):
- Unbuilt pieces are hidden: the import kinds `openingBalances`, `deliveries`,
  `monthlyRates`, `billAdjustments` and `bills`, the opening balances card and the "Other
  deductions" edit. All in one place, `apps/admin/src/lib/serverReady.ts`: tell me as each
  ships and I remove its line.
- `request-pending`, `supplier-suspended`, `supplier-closed`, `advance-outstanding`,
  `loan-installments-invalid` and `manure-installments-invalid` are in `ADMIN_ERROR_CODES`,
  explained in en/si/ta; the last three of the first four block the approval dialog.
- Import problem text for `unknown-bank`, `bank-not-in-catalogue`, `too-large`,
  `feature-disabled`, `supplier-suspended`, `supplier-closed`, `request-pending`, both
  instalment codes, and a new `too-short` (`IMPORT_COLUMNS.walkInCredit.note` has
  `minLength: 10`).
- The dialog shows `details.total` ("The server found N problems").
- Manure walk-ins: no amount field; the catalogue price is shown. Loans and manure both
  offer the factory's repayment periods.
- `supplierCodeSchema` accepts `5708 (URUMUTHTH...)` and letters.
- `sync-switch-blocked` names `details.months` and says to publish them first.
- The app's interest label is now "Interest (advance and loan)".
- `ACTIVITY_FLAG` in `activity.ts`; `billSettingsProblem` allows a seven-digit serial.
- Excel: a float like `79.53000000000002` is cleaned to the column's decimals on reading; a
  real extra decimal is still refused. A code typed as a number (`0708` → `708`) cannot be
  recovered from the file: please match an all-digit code ignoring leading zeros.
- Bills import: `balanceAmount` may be negative (a month the supplier owes, with `finalBalance`
  0 and `nextMonthDebt`), a `savingsWithdrawal` column, and a file replaces only the
  suppliers in it.

**Answers** ("pending" = asking the factory; build the default meanwhile):

- **A1.** The slip is the record for an imported month: set savings, loan and manure
  balances to its figures. Where ours differ, accept the slip and put both in the audit.
- **A2 (answered).** Galaboda's own system **keeps printing the bills every month, now and
  later**, and our records must equal its **final figures exactly**. So for that factory the
  imported bill is the record: when a month has both, the imported one wins, and a
  calculated bill is a preview to compare against it, never published over it.
- **A3.** Done (above).
- **A4.** Done (above).
- **A5 (answered): "Loan Balance" is the loan's** balance after this month's instalment.
  An advance is always settled within its month, so it never carries and has no line. The
  mapper's comment (`bill.mapper.ts`, "the ADVANCE balance") and our `BillCarryForward`
  comment were wrong; ours and the mock are fixed. Please fix the mapper's comment and
  anything that fills `cfLoanBalance` from the advance.
- **A6 (answered).** "Loan Interest" is **this month's charge**: the percentage applied to
  the balance, not the total unpaid.
- **A7.** Any number of files per month; each replaces only the suppliers in it.
- **A8.** Accept the slip's kilos; it is the record. Show the count that differs.
- **A9.** Yes, later: past months as published history, no balance change, no notification.
- **A10 (answered): yes.** With the sync off the office enters each supplier's leaf on the
  day it is weighed (one at a time or by file); with the sync on it arrives from the
  factory's system. An advance ceiling is this month's kilos so far × last month's settled
  rate (the `thisMonthLeaf` basis), so it is 0 until leaf is recorded.
- **A11.** Importing bills needs `billing: W` (setting the rate is part of it). Publishing
  stays `ratesAndMonthClose: A` by someone other than the importer: in a one-manager factory
  the clerk imports and the manager publishes.
- **A12.** The factory pays, from its own system; our payout run is not used.
- **B1.** Interest first, then principal, both on the advance line, under the advance cap.
- **B4.** Kept apart (answer 2). The §9 check in `factory-records.md` said otherwise and is
  fixed.
- **B5.** Advances approved on or before the month's last day.
- **B6.** Nothing goes unpaid line by line: every line is deducted and a shortfall is next
  month's debt, as the slip's "Next Month Deb".
- **C1.** One cut-over month for the whole factory.
- **C4 (answered): no new loan while one is outstanding.** Refuse with `409 loan-outstanding`
  (added to `ADMIN_ERROR_CODES`, explained in en/si/ta, and blocking in the approval
  dialog), in the app's request, a walk-in, and approval.
- **C5.** Later: a manager posts a correction entry with a note, audited, applied on the next
  bill.
- **D4.** Not needed: the factory pays from its own system. Keep the name; a code is optional.
- **G1 (answered).** The year of the **bill's month**: December 2026's bills made in January
  are `2026…`. **The serial does not reset:** after `2026210869` the next bill is
  `2027210870` (the year changes, the serial runs on). That is what `factoryBillNumber` and
  `billSettings.nextBillSerial` already do; nothing to change.
- **G3, H3, I1.** Done (above).

**Factory sync (Phase 10), for when it starts:** the request to the factory team now asks
for every line of the printed bill. `factory-system-team.md` §3 and
`factory-updates-sample.json` (bill `2026210869` is a real slip) add `greenLeafAmount`,
`extraPayment`, `totalRatePerKg`, `loanInstalmentNo`, `savingsWithdrawal`, `savings`
(This month / Previous / Todate), `billDateTime` and the bill's own `paymentMethod`, and
say `grossAmount` includes the coins brought forward. Map them onto `BillRow`
(`savingsThisMonth`, `savingsPrevious`, `savingsToDate` already exist; `loanInstalmentNo`
is new) and store them as received.

---

## 45. Factory records without the factory system

A factory whose own system cannot be reached switches the factory-system sync **off**, and
the office keeps suppliers, daily leaf, monthly rates, bills, opening balances and counter
credit requests in the console: one at a time, or from an Excel/CSV file. The console side is
built and tested against the mock.

**The full contract is in [`factory-records.md`](./factory-records.md):** the switch
(`config.factorySync`), the endpoints (the v1 leaf and month endpoints, plus six new ones),
the import format and its all-or-nothing rule, the bill calculation, the role change for the
clerk, and the three new audit actions.

**To do:** build §4 of that file, refuse every record write with `409 factory-sync-on` while
the sync is on, and `vendor:pull` (new `factoryRecords.ts`, `GreenLeafBill.otherCardsNote`,
`RuntimeConfig.factorySync`, clerk `deliveries: W` and `creditRequests: W`).

**Added after the factory's answers (§8 of that file):** transport per collection point
(`DeductionRates.transportByPoint`) and per supplier (`AdminSupplier.transportPerKg`,
`PUT /admin/suppliers/:id/transport-rate`, import kind `transportRates`), and advance
interest in Configuration (`config.advanceInterest`, used for `carryForward.loanInterest`).
`otherCards` is now labelled "Other deductions"; the field name does not change.

**And to match the factory's printed slip (§5):** `computeBillAmounts` now puts the coins
brought forward in `grossAmount` and rounds the payment to `config.billSettings.paymentUnit`
(galaboda pays in tens); the advance is taken back in full by default; bills carry
`loanInstalmentNo`; and `billSettings.nextBillSerial` gives the factory's own bill numbers
(`2026210869`). Check that the API uses the vendored function for every bill it calculates,
so a bill and the app agree to the cent.

**Check:** the list in §9 of that file.

**Done so far (`b470323`):** re-vendored; `factorySync`, `advanceInterest` and
`billSettings` in config (the public `GET /config` sends only `paymentUnit`); `409
factory-sync-on` on every record write under a lock; `transportByPoint` kept and validated;
deduction rates gated on `ratesAndMonthClose`; `PUT /admin/suppliers/:id/transport-rate`.

**Done since (`ebb9793`):** loan interest, `sync-switch-blocked`, the bell's start and flags,
supplier identity, `POST /admin/suppliers`, walk-ins, and the `suppliers`, `transportRates`
and `walkInCredit` imports.

**Next:** the `bills` import (A1 to A12), opening balances, leaf and months, then the bill
engine.

**Hidden in the console until you build them.** Each answers `404` today, so the console
hides it (`apps/admin/src/lib/serverReady.ts`). When one ships, **tell me and I remove its
line**, or remove it yourself in the same PR:

| Console feature | Endpoint | Line in `serverReady.ts` |
|---|---|---|
| Import → Opening balances | `POST /admin/imports/openingBalances` | `IMPORT_KINDS_NOT_ON_SERVER`: `'openingBalances'` |
| Import → Daily leaf | `POST /admin/imports/deliveries` | `'deliveries'` |
| Import → Monthly rates | `POST /admin/imports/monthlyRates` | `'monthlyRates'` |
| Import → Other deductions | `POST /admin/imports/billAdjustments` | `'billAdjustments'` |
| Import → Finished bills | `POST /admin/imports/bills` | `'bills'` |
| Opening balances card (supplier → Money) | `GET` / `PUT /admin/suppliers/:id/opening-balances` | `OPENING_BALANCES_ON_SERVER = false` |
| "Other deductions" → Edit on a bill | `PUT /admin/bills/:id/adjustment` | `OTHER_DEDUCTIONS_ON_SERVER = false` |

The leaf intake grid and Rates & month close also call the v1 leaf and month endpoints
(§4.1 of `factory-records.md`); they stay visible because the rest of the screen works, and
they start working as those land.
