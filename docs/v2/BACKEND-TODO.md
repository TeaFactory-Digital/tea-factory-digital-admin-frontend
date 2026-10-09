# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (9 October 2026)

**Done and removed from this file: #1 to #44** (latest: #44 in `b93c64f`, the default text
for "Restore default text", read only and never counted as an office edit).

**Still open:**

| # | What | Priority |
|---|------|----------|
| 45 | Factory records without the factory system: the sync switch, entry and imports | High |

**Answers to the last note**
- **FAQ and `{{factory}}`:** right, the FAQ names no factory in any language, so our check
  was wrong; `terms/default?lang=si` is the one to check. Leave the FAQ as it is unless we
  send a new seed file.
- **`eligibility: null`:** the console already shows the request without the eligibility
  panel when it is `null`, so nothing to change on our side.

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
