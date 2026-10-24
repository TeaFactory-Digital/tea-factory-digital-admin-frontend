# Backend to-do

Only the work still open (23 October 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

| # | What | Priority |
|---|------|----------|
| 49 | `factorySync` defaults to **off**, never `null` | High, now |
| 50 | Staging: `enableMonthToDate` is not served yet | Now |
| 51 | The factory administrator reads the factory's records (`vendor:pull`) | Now, small |
| 45 | Factory records: the bills import (with month reads and publish), opening balances, leaf and months, other deductions, importing again, then the bill engine | High |
| 48 | "This month so far": `GET /bills/month-to-date` | Medium |
| - | Later: factory sync (Phase 10), balance corrections | Later |

## 49. `factorySync` defaults to off

**Decided by the factory:** a factory keeps its records in the console until its own system
is connected and someone switches the sync on deliberately. So **off is the default.**

On staging, galaboda's `factorySync` is `null` on `GET /config` and `GET /admin/config`. The
console used to read that as "on", which is why the Factory records menu never appeared.

1. **Store `{ enabled: false }`, never `null`:** in `db:seed:tenant` for every new factory,
   and a migration that sets it on every existing `client_config` row where it is `null`
   (galaboda included).
2. **Read absent or `null` as off** everywhere on the server: the `409 factory-sync-on`
   guard on record writes, and the hourly sync job (it must not run for such a factory).
3. The console already reads it this way: `isFactorySyncEnabled` is now
   `factorySync?.enabled === true`, and `FactorySyncSetting` may be `null`
   (`factoryRecords.ts`, `types/admin.ts`; `vendor:pull`).

**Check:** a new tenant from `db:seed:tenant` answers `factorySync: { enabled: false }`;
galaboda on staging answers the same; a record write for it is allowed, not
`409 factory-sync-on`.

## 50. Staging: `enableMonthToDate` is not served yet

`GET /config` for galaboda on staging sends **14 flags**; `enableMonthToDate` is missing.
Is `970be6f` deployed there, and is migration `20261023010000_month_to_date_flag_and_optional_bank_codes`
applied? Nothing breaks meanwhile (the app reads a missing flag as off), but it should be
there as `false`.

## 51. The factory administrator reads the factory's records

**Decided by the factory:** `factoryAdmin` is now `deliveries: R`, `ratesAndMonthClose: R` and
`billing: R` in `DEFAULT_ROLE_MATRIX` (`packages/domain/src/rbac.ts`), like the platform
admin. The console shows them the Factory records menu read-only. After `vendor:pull`, check
that their reads answer 200 and every write on those routes (leaf, rate, imports, generate,
publish) still answers `403`.

## 45. Factory records without the factory system

The office keeps suppliers, daily leaf, monthly rates, bills, opening balances and counter
credit requests in the console while the sync is off. **Contract:** factory-records.md.

**In this order:**

1. **The bills import** (`POST /admin/imports/bills`, factory-records §5a) with the approvals
   check (§5a "What the import checks"), and with it the month reads (`GET /admin/months`,
   `GET /admin/months/:monthKey`) and `POST /admin/months/:monthKey/publish`: an imported
   month cannot be published without them. **Your round-three questions are answered in
   §5a** ("What the import checks", "Which months", "What it sets"; decision 14), and your
   ADR-038 (post differences at publish, never set a balance) is agreed and written in.
   New in the domain (`vendor:pull`): `ImportRowProblem.amount`,
   `ImportResult.leafDifferences`, `finalBalance` `decimals: 0`, the `ratePerKg` and
   `savingsToDate` checks, and the codes `earlier-month-unpublished` and `approval-missing`;
   import problem text for `approval-missing`, `month-not-ended`, `month-out-of-order`,
   `must-be-positive` in en/si/ta.
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
| Import → Opening balances, Daily leaf, Monthly rates, Other deductions, Finished bills, Printed slip balances | `POST /admin/imports/{openingBalances, deliveries, monthlyRates, billAdjustments, bills, printedBalances}` | `IMPORT_KINDS_NOT_ON_SERVER` (one entry each) |
| Opening balances card (supplier → Money) | `GET` / `PUT /admin/suppliers/:id/opening-balances` | `OPENING_BALANCES_ON_SERVER = false` |
| "Other deductions" → Edit on a bill | `PUT /admin/bills/:id/adjustment` | `OTHER_DEDUCTIONS_ON_SERVER = false` |
| Rates & month close: "Compare with printed slips", the checklist step, held badges | `slip-comparison`, `printed`, `hold`, `release` | `SLIP_COMPARISON_ON_SERVER = false` |
| Configuration → Features: "Account tab: this month so far" | `GET /bills/month-to-date` | `MONTH_TO_DATE_ON_SERVER = false` |
| Import dialog: which rows are already there, and "import them anyway" for leaf | `dryRun`, `duplicates`, `skipped` | `IMPORT_SKIP_ON_SERVER = false` |

The leaf intake grid and Rates & month close stay visible; they call the leaf and month
endpoints and start working as those land.
