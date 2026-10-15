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


**Answers to the last note** (numbers follow your questions; "pending" means we are asking
the factory, with the default to build against until then):

1. **Bill export: both ways, decided by the user.** A factory with the sync off fills each
   month either by calculating it here or by importing the finished bills its own system
   printed (`factory-records.md` §5a: import kind `bills`, stored as printed, checked only
   for adding up, `AdminBill.source`). Console, domain and mock are done; please
   `vendor:pull`. **Build the bill import before the bill engine**: it is the smaller job and
   gives galaboda real bills soonest.
2. **Interest compounding: not intended.** Simple interest: each month's interest is worked
   on the advance principal still owed, never on unpaid interest. Carry the interest as its
   own balance (the slip's "Loan Interest") and recover it with the advance; do not fold it
   into the principal. **Loans: confirmed, 0% by default, set in Configuration** as
   `config.loanInterest: { monthlyRatePercent }` (same shape and checks as
   `advanceInterest`; console and mock done). The slip has one "Loan Interest" line: it is
   the advance's interest plus the loan's, each on its principal still owed after the
   month's instalment.
3. **Opening balances lock on the first published bill**, not on a draft. Done in the mock
   and in `factoryRecords.ts`.
4. **Switching back on:** yes, leave "the sync's records replace ours" for Phase 10.
5. **Four-eyes: confirmed by the user.** One person, with a reason and the before and
   after in the audit, for opening balances, a supplier's transport rate and the sync switch.
   Opening balances are editable only until the first published bill; the switch is behind
   a confirmation and blocked mid-month (13).
6. **Supplier codes:** the bare number is the identity and is unique per factory; the
   suffix is the division name, for display only (the real slip prints `5708 (URUMUTHTH...)`).
   A supplier signs in with the bare number. So `5147 (DENIYAYA)` and `5147 (MAKADURA)` are
   the same code and the second is refused `supplier-code-taken`. **Confirmed: a number is
   unique across the whole factory.**
7. **Collection points in imports and Add supplier:** accept the code or the name,
   case-insensitive, and store the point's id. Unknown: `unknown-collection-point`.
8. **Bank details on Add supplier:** the account name defaults to the supplier's full name
   (the form does not ask for it). Validate the bank and branch against the factory's own
   `config.banks`, which includes banks the factory added, not against the platform catalogue.
9. **Walk-in refusals:** refuse a facility switched off (`feature-disabled`), a suspended or
   closed supplier, and a pending request on the same facility (`request-pending`); price
   manure on the server from the catalogue. **Do not refuse** over the limit or with an
   advance outstanding when *recording*: the request is recorded as the supplier made it,
   with the eligibility shown, and approval refuses as it does today (`over-ceiling`).
   **Yes, the supplier may cancel an office request from the app:** it is their request.
10. **An opening loan's plan:** `OpeningBalances` now has optional `loanMonthsLeft` and
    `loanInstalmentsPaid` (form, import columns and mock done). With both, recover
    `loan / loanMonthsLeft` a month under the cap and number the first bill here
    `loanInstalmentsPaid + 1`. Without them, the cap alone, numbered from 1.
11. **The bill serial (being confirmed).** The year at the front changes with the year
    (`2026…` then `2027…`); we are confirming whether the six-digit part also starts again
    each January. Until then: it does not, and past 999999 it gets a seventh digit.
12. **Coins in the gross:** confirmed; the gross a ceiling averages rises by at most one
    payment unit a month. **Past bills are not restated:** synced bills are stored as
    received, and only bills calculated here use the new function.
13. **Import checks: refuse, never round.** `importRowProblems` now refuses a number with more
    decimals than the column allows (`too-many-decimals`; 2 by default, whole numbers for
    months and instalments), anything that is not plain digits (`0x1A`, `1e3`), and a date
    that is not on the calendar (`2026-02-31`). Please `vendor:pull`.
14. **Changing the sync mid-month:** yes, refuse while any month has generated but
    unpublished bills: `409 sync-switch-blocked` (in `ADMIN_ERROR_CODES`, with a message).
15. **The bell for new users:** start the read mark at the user's creation time, and hide
    kinds whose feature flag is off.
16. **Shared error codes:** added to `ADMIN_ERROR_CODES`: `factory-sync-on`,
    `sync-switch-blocked`, `negative`, `unknown-collection-point`, `bank-details-required`,
    `opening-balances-locked`, `unknown-supplier`, `no-bill`, `import-invalid`, `import-size`.
    The console now explains each in en/si/ta.

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

**Next:** imports (the `bills` kind first, answer 1), add supplier, opening balances (3 and
10), walk-ins (9), then leaf and months, then the bill engine.
