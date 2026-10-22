# Backend to-do

Backend work found while building and testing the admin console and the mobile app.
Each item says what is wrong or missing, where, and what to change.

## Status (22 October 2026)

**Done and removed from this file: #1 to #44, #46 and #47.**

**Still open:**

| # | What | Priority |
|---|------|----------|
| 45 | Factory records without the factory system: the bills import, opening balances, leaf and months, then the bill engine | High |

**Before you start:** pull the console repo and `vendor:pull`. `@tfd/domain` has changed
since your last re-vendor: `factoryRecords.ts` (bills import, `billSourceOf`, `loanRecovery`,
`LoanInterestSetting`, `too-short`, `allowNegative`), `leafCredit.ts` (`loanOutstanding`),
`activity.ts` (`ACTIVITY_FLAG`), `rbac.ts` (clerk `billing: W`), `types/admin.ts` (new error
codes, `AdminBill.source`), `schemas/index.ts` (`supplierCodeSchema`).

### Docs removed from the console repo: update your links

Three files in `tea-factory-digital-admin-frontend/docs/v2/` were removed (22 October 2026)
because they were out of date or repeated another document:

| Removed | Use instead |
|---|---|
| `integration.md` | `factory-integration-spec.md` (the same design), and `factory-records.md` for a factory whose system is not connected |
| `BACKEND-API-GAPS.md` | Every gap is closed. The shapes still agreed are in `api-contract.md`, section "Agreed shapes"; open work is in this file |
| `business-analyst.md` | `factory-integration-spec.md` §7 ("Before build: three conversations") and `factory-management.md` |

Two places in the backend repo point at them:

1. **`.claude/agents/senior-backend-engineer.md`, line 19**, lists `integration.md` among the
   admin docs to read. Remove it, and add `factory-records.md`, `BACKEND-TODO.md` and
   `new-factory.md`, which now hold the factory-records contract, the open work and the
   onboarding steps.
2. **`packages/domain/src/types/admin.ts`, line ~2033**, says "Tracked in
   `BACKEND-API-GAPS.md`". This is the vendored domain: `vendor:pull` brings the corrected
   comment (it now points to `api-contract.md`, "Agreed shapes"). Nothing to edit by hand.

(`docs/README.md` line 54 also names an `integration.md`, but that is your own planned
backend file, not ours; it is unaffected.)

---

## 45. Factory records without the factory system

A factory whose own system cannot be reached switches the factory-system sync **off**, and
the office keeps suppliers, daily leaf, monthly rates, bills, opening balances and counter
credit requests in the console: one at a time, or from an Excel/CSV file.

**The full contract is [`factory-records.md`](./factory-records.md).** This section is the
work list, what is decided, and what the console is holding back for you.

### Done on the backend

- `b470323`: `factorySync`, `advanceInterest` and `billSettings` in config (the public
  `GET /config` sends only `paymentUnit`); `409 factory-sync-on` on every record write, under
  a lock; `transportByPoint`; deduction rates gated on `ratesAndMonthClose`;
  `PUT /admin/suppliers/:id/transport-rate`.
- `ebb9793`: loan interest; `409 sync-switch-blocked`; the bell's start mark and flags;
  supplier identity (bare number); `POST /admin/suppliers`; walk-ins
  (`POST /admin/credit-requests`); the `suppliers`, `transportRates` and `walkInCredit`
  imports; approval refuses `supplier-suspended`, `supplier-closed`, `advance-outstanding`.

### To do, in this order

1. **Accept two config fields:** `billSettings.source` and `loanInterest.recovery`
   (factory-records §4.1). Refuse changing `source` while a month has generated but
   unpublished bills: `409 bill-source-blocked` with `details.months`.
2. **The bills import** (`POST /admin/imports/bills`, factory-records §5a), with the
   approvals check (§5a "What the import checks").
3. **Opening balances** (`GET` / `PUT /admin/suppliers/:id/opening-balances`, and the
   `openingBalances` import).
4. **Leaf and months:** the v1 endpoints in factory-records §4.1, and the `deliveries` and
   `monthlyRates` imports.
5. **Other deductions** (`PUT /admin/bills/:id/adjustment`, the `billAdjustments` import).
6. **The bill engine** (factory-records §5), last: galaboda imports its bills, so no factory
   needs it yet.

Alongside:

- **Open loan rule (B2):** pass `loanOutstanding` to `buildCreditEligibility` for every
  facility, and refuse a loan or an advance while a loan is owed with
  `409 loan-outstanding`: in the app's own request, a walk-in, and approval.
- **Savings withdrawals:** creating or cancelling one needs `billing: A` (the manager), not
  `W`, on `POST /admin/savings/withdrawals` and `.../:id/cancel`.
- **Loan balance:** the slip's "Loan Balance" is the **loan's**. Fix the comment in
  `bill.mapper.ts` ("the ADVANCE balance") and anything that fills `cfLoanBalance` from the
  advance.
- **Leading zeros:** match an all-digit code ignoring leading zeros (`708` finds `0708`)
  only when exactly one supplier fits; otherwise refuse as ambiguous. Sign-in stays exact.

### Hidden in the console until you build them

Each answers `404` (or `422`) today, so the console hides it in one place,
`apps/admin/src/lib/serverReady.ts`. When one ships, **tell me and I remove its line**, or
remove it in the same PR:

| Console feature | Endpoint | Line in `serverReady.ts` |
|---|---|---|
| Import → Opening balances | `POST /admin/imports/openingBalances` | `IMPORT_KINDS_NOT_ON_SERVER`: `'openingBalances'` |
| Import → Daily leaf | `POST /admin/imports/deliveries` | `'deliveries'` |
| Import → Monthly rates | `POST /admin/imports/monthlyRates` | `'monthlyRates'` |
| Import → Other deductions | `POST /admin/imports/billAdjustments` | `'billAdjustments'` |
| Import → Finished bills | `POST /admin/imports/bills` | `'bills'` |
| Opening balances card (supplier → Money) | `GET` / `PUT /admin/suppliers/:id/opening-balances` | `OPENING_BALANCES_ON_SERVER = false` |
| "Other deductions" → Edit on a bill | `PUT /admin/bills/:id/adjustment` | `OTHER_DEDUCTIONS_ON_SERVER = false` |
| Bill calculation: "Where the bills come from" and "How the loan interest is taken" | `PATCH /admin/config` accepting `billSettings.source` and `loanInterest.recovery` | `BILL_SOURCE_AND_RECOVERY_ON_SERVER = false` |

The leaf intake grid and Rates & month close also call the v1 leaf and month endpoints; they
stay visible because the rest of those screens works, and start working as those land.

### Decided (your questions, answered)

Confirmed by the factory where marked; the rest decided on the console side.

**Bills: where they come from**

- **One way per factory** (`BillSettings.source`, `billSourceOf`; absent = `calculated`):
  `imported` from the factory's own system, or `calculated` here. Galaboda is `imported`.
  The wrong one is `409 wrong-bill-source`.
- **Galaboda's own system keeps printing every bill, now and later (factory)**, and our
  records must equal its final figures exactly. For an importing factory the imported bill
  is the record; a calculated bill is never published over it.
- **The slip is the record (A1):** an imported month sets the supplier's savings, loan and
  manure balances to the slip's figures. Where ours differ, accept the slip and keep both in
  the audit.
- **Kilos (A8):** accept the slip's; show how many differ from the leaf entered here.
- **Files (A7):** any number per month; each replaces only the suppliers in it. A second file
  with a different rate for the month is `rate-differs`.
- **Past months (A9):** later, as published history with no balance change and no
  notification.
- **Who (A11):** the clerk holds `billing: W` to import, generate and type other deductions;
  publishing stays `ratesAndMonthClose: A` with someone other than the importer
  (four-eyes).
- **Payment (A12, D4):** the factory pays from its own system; our payout run is not used,
  so a bank code for a factory-added bank is optional.

**Bills: what the import checks** (details in factory-records §5a)

- Each row adds up (`importRowProblems`, in the domain).
- **Everything we approved reaches their slip, or the file is refused**, naming the supplier
  and the item. The office types each approval made in our console into the factory's system
  (the office is the bridge), so a slip that lacks one means it was not typed.
  - Advances, tea packets, savings withdrawals: the slip's line is at least what we approved
    for the month. More is fine (the factory's own counter).
  - Loans and manure: through the balance,
    `loanBalance(this month) + loansAdvance(this month) ≥ loanBalance(last month) + approved
    this month`, and the same with `manureBalance` and `manure`.
  - "For the month" (B5): approved on or before the month's last day.

**Advances, loans and interest (factory)**

- **An advance is closed within its month:** always deducted in full, even past the gross.
  What the account cannot cover becomes that month's "Next Month Deb"; there is never an
  advance balance. The factory does not cap it, so "at least what we approved" will not
  refuse a correct file.
- **An open loan blocks a new loan and an advance (B2, C4; factory, confirmed twice):** a
  supplier repaying a 10-month loan gets no advance and no new loan for those 10 months.
  Manure is not part of the rule.
- **"Loan Balance" is the loan's** balance after this month's instalment (A5).
- **"Loan Interest" is this month's charge**, a rupee amount (A6).
- **Loan interest** is `config.loanInterest.monthlyRatePercent` (0% by default), worked on
  the loan **owed at the start of the month**, and taken **on top of the instalment or
  inside it** as `config.loanInterest.recovery` says (`onTop` by default, or
  `withinInstalment`), a Configuration choice the factory makes (B3). Use `loanRecovery`:
  Rs. 50,000 over 10 months at 1% deducts Rs. 5,500 and repays Rs. 5,000 (`onTop`), or
  deducts Rs. 5,000 and repays Rs. 4,500 (`withinInstalment`). Never interest on interest
  (B4: interest is carried apart from the principal).
- **Advance interest** arises only when an account could not cover its advance.
- **Shortfall (B6):** every line is deducted; what the account cannot cover is next month's
  debt.
- **An opening loan** carries optional `loanMonthsLeft` and `loanInstalmentsPaid`.

**Bill numbers (factory)**

- The year is the **bill's month**: December 2026's bills, made in January, are `2026…`.
- The serial **does not reset**: after `2026210869` comes `2027210870`. A seventh digit after
  999999 is allowed. `factoryBillNumber` and `billSettings.nextBillSerial` already do this.

**Suppliers**

- Identity is the bare number, unique across the factory (factory); the `(division)` is
  shown and stored apart. `/` and `-` are not part of the number: `supplierCodeSchema`
  accepts letters and digits only before the optional `(division)`.
- Collection point by code or name, any case; a tie is `unknown-collection-point`.
- One cut-over month for the whole factory (C1): refuse an opening-balances month
  different from the one already used.
- A balance found wrong after the first published bill (C5): later, a manager posts a
  correction entry with a note, applied on the next bill.

### Done on the console (please `vendor:pull`)

- Error codes in `ADMIN_ERROR_CODES`, each explained in en/si/ta: `factory-sync-on`,
  `sync-switch-blocked`, `bill-source-blocked`, `wrong-bill-source`, `negative`,
  `unknown-collection-point`, `bank-details-required`, `opening-balances-locked`,
  `unknown-supplier`, `no-bill`, `import-invalid`, `import-size`, `request-pending`,
  `supplier-suspended`, `supplier-closed`, `advance-outstanding`, `loan-outstanding`,
  `loan-installments-invalid`, `manure-installments-invalid`. The credit refusals block the
  approval dialog. `sync-switch-blocked` and `bill-source-blocked` name `details.months`.
- Import problem text, en/si/ta, for every code above and `unknown-bank`,
  `bank-not-in-catalogue`, `too-large`, `feature-disabled`, `too-short`, `too-many-decimals`,
  `does-not-add-up`, `rate-differs`. The dialog shows `details.total` ("The server found N
  problems").
- Imports: `IMPORT_COLUMNS.walkInCredit.note` has `minLength: 10`; Excel float noise
  (`79.53000000000002`) is cleaned to the column's decimals on reading, while a real extra
  decimal is still refused; bills allow a negative `balanceAmount` and a
  `savingsWithdrawal` column.
- Walk-ins: manure shows the catalogue price instead of an amount field; loans and manure
  both offer the factory's repayment periods.
- The app: "Interest (advance and loan)", and `loan-outstanding` explained on the advance and
  loan screens.
- `ACTIVITY_FLAG` in `activity.ts`.

### Factory sync (Phase 10), for when it starts

The request to the factory team now asks for every line of the printed bill.
`factory-system-team.md` §3 and `factory-updates-sample.json` (bill `2026210869` is a real
slip) add `greenLeafAmount`, `extraPayment`, `totalRatePerKg`, `loanInstalmentNo`,
`savingsWithdrawal`, `savings` (This month / Previous / Todate), `billDateTime` and the
bill's own `paymentMethod`, and say `grossAmount` includes the coins brought forward. Map
them onto `BillRow` (`savingsThisMonth`, `savingsPrevious`, `savingsToDate` already exist;
`loanInstalmentNo` is new) and store them as received. Switching a factory from records kept
here back to the sync ("the sync's records replace ours") also waits for Phase 10.

**Check:** the list in §9 of `factory-records.md`.
