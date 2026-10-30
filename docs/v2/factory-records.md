# Factory records without the factory system

**Status (29 October 2026):** the console is built against the mock and tested; the backend
is partly built (the finished-bills import, the month reads and the publish since `12eea12`,
and opening balances since `5b58f81`; see [BACKEND-TODO.md](./BACKEND-TODO.md) #45 for what is still to build, in
order, and what the console hides until it lands).
**For:** the backend developer. This file is the contract the console was built against.

## 1. Why

The platform's product is the **supplier app**. Normally its figures (suppliers, the day's
leaf, the month's rate, bills, balances) arrive from the factory's own system by the hourly
sync (`factory-system-team.md`). Some factories' systems cannot be connected: no sync, and
for some not even an export. For them the office keeps those records **in the console**, so
the app still has something to show.

**Every factory still runs its own system.** Sync off does not mean "no factory system"; it
means we cannot read from it. Nothing in this platform ever writes to it either, so **every
request approved in the console must also be entered in the factory's own system by the
office**, in every mode. The approval dialogs say so each time
(`components/FactorySystemReminder.tsx`).

This is not a replacement for a factory's system. It is the smallest set of records the app
needs: suppliers, daily leaf, monthly rate, bills, opening balances, and counter requests.

**One source at a time.** A factory either syncs or keeps records here, never both. Two
sources writing the same weighing is how a bill comes to disagree with itself.

## 2. The switch

| | Sync **on** | Sync **off** (default) |
|---|---|---|
| Where records come from | The hourly sync | The office, in the console |
| Entry and import screens | Hidden; routes show "comes from the factory system" | Shown |
| Bills | The factory system's, shown as they arrive | Imported from the factory's own system, or calculated here (§5a), then reviewed and published |
| Hourly sync job | Runs | Does not run for this factory |
| Record writes listed in §4 | **`409 factory-sync-on`** | Allowed |

Stored in the tenant config:

```ts
// packages/domain/src/factoryRecords.ts
config.factorySync?: { enabled: boolean } | null   // absent or null = off (false)
isFactorySyncEnabled(config)                // the one reading of it
```

- **Default off (factory):** a new factory, and any `client_config` row without the field,
  is sync **off**: the office keeps its records here until the factory's own system is
  connected and someone switches the sync on deliberately. The backend stores
  `{ enabled: false }`, never `null`: `db:seed:tenant` writes it, and migration
  `20261024010000` set it on every row that was `null`.
- `PATCH /admin/config` accepts `{ factorySync: { enabled } }`, saved whole, audited as
  `config.update` like any section. `GET /config` and `GET /admin/config` return it.
- Who may change it: `flagsAndBranding: W` (factory administrator), as for every config section.
- Refused while any month has generated but unpublished bills: `409 sync-switch-blocked`
  with `details.months`.
- **Switching on again** (Phase 10): suppliers entered here are matched to the factory
  system's by the bare supplier number. Records entered here stay; the sync's records
  replace them for the same supplier, day or month. No second supplier is ever created for a
  code that exists.

## 3. Console screens (built)

Every record can be entered **one at a time** or **many at once from an Excel (.xlsx) or
CSV file**.

| Where | One at a time | From a file | Permission |
|---|---|---|---|
| Suppliers | **Add supplier** dialog | **Import → Suppliers** | `suppliers: W` |
| Supplier → Money tab | **Opening balances** card | **Import → Opening balances** (Suppliers screen) | `suppliers: W` |
| Supplier → Money tab | **Transport rate** card: the supplier's own rate, or back to the point's | **Import → Transport rates** (Suppliers screen) | `suppliers: W` |
| Factory records → **Leaf intake** (`/deliveries`) | Session grid (v1, restored) | **Import from file** | `deliveries: W` |
| Factory records → **Rates & month close** (`/rates`) | Rate card (v1, restored) | **Import → Monthly rates** | `ratesAndMonthClose: W` |
| Same screen, bills **calculated** | **Generate bills**, then **Review this month's bills**, then Publish | | `billing: W` / `ratesAndMonthClose: A` |
| Same screen, bills **calculated** | **Compare with printed slips** card: each slip's Balance against ours; **Enter printed**, **Hold**, **Release** (§5, "Comparing with the printed slips") | **Import → Printed slip balances** | `billing: W` (enter, hold) / `ratesAndMonthClose: A` (release) |
| Same screen, bills **imported** | **Review this month's bills**, then Publish | **Import → Finished bills** | `billing: W` / `ratesAndMonthClose: A` |
| Same screen | Deduction rates card: transport per kg (factory-wide **and per collection point**), stamps, instalment caps | | `ratesAndMonthClose: W` propose, `A` approve |
| Bill detail (calculated bills only) | **Other deductions → Edit** (before publishing) | **Import → Other deductions** | `billing: W` |
| Credit | **Record walk-in request** | **Import from file** | `creditRequests: W` |
| Configuration → **Factory system** | The switch | | `flagsAndBranding: W` |
| Configuration → **Bill calculation** | Where the bills come from; pay in Rs. 1 / 5 / 10 and the next bill serial (calculated bills); advance and loan interest (% a month, loan 0% by default) and how the loan interest is taken | | `flagsAndBranding: W` |

**Role changes (shared matrix, `packages/domain/src/rbac.ts`):** the clerk is now
`deliveries: W`, `creditRequests: W` and `billing: W` (all were R): weigh in leaf, record a
counter request, and import, generate or adjust bills. The clerk also has
`ratesAndMonthClose: R` (28 October 2026; it was `-`), because the import and the bill run
are on Rates & month close and that screen needs the month list; the rate (`W`) and the
publish (`A`) stay the manager's. Deciding a request and publishing a
month stay with the manager (`A`, BR-501 refuses the recorder or importer as approver).
**Savings withdrawals need `billing: A`**: the clerk's `W` must not let them pay out a
supplier's savings. **The factory and platform admins read, never write (factory):**
`deliveries`, `ratesAndMonthClose` and `billing` are `R` for both, so the factory
administrator sees the Factory records menu and every figure in it, and the platform team
can see a factory's records for support. Every write on those routes still refuses them.

## 4. API

### 4.1 Endpoints and fields

All record writes refuse with **`409 factory-sync-on`** while the sync is on, and `403`
without the permission in §3. The shapes are the domain types named, and the console's mock
(`apps/admin/src/services/mocks/handlers.ts`) implements each one; copy its rules.
BACKEND-TODO #45 says which of these are built.

| Method and path | Body / answer | Refusals |
|---|---|---|
| `GET /admin/deliveries?date&collectionPoint&includeVoided&page&pageSize&sort&dir` | `Paged<Delivery>` | |
| `GET /admin/deliveries/summary?date&collectionPoint` | `CollectionDaySummary` | |
| `POST /admin/deliveries` | `DeliveryBatch` → `DeliveryBatchResult` (per-row refusals inside a 200) | `409 month-locked` (unless every row's supplier has a **held** bill that month, §5), `422 batch-too-large` |
| `POST /admin/deliveries/:id/void` | `{ reason }` → `Delivery` | `422 note-required`, `409 month-locked` (unless the supplier's bill is held) |
| `GET /admin/months`, `GET /admin/months/:monthKey` | `Paged<MonthSummary>`, `MonthSummary` (with `lateBills`, §5a) | `404` unknown month |
| `PUT /admin/months/:monthKey/rate` | `MonthlyRateEntry` → `MonthSummary` | `409 month-locked`, `422 invalid-rate` |
| `GET /admin/months/:monthKey/exceptions`, `POST .../exceptions/:id/resolve` | `Paged<MonthException>`, `{ note }` | `422 note-required` |
| `POST /admin/months/:monthKey/bills/generate` | `{ monthKey }` → `BillRun`. In a published month, recalculates **only the held bills** (§5) | `409 wrong-bill-source` (first), `409 rate-missing`, `409 month-locked` (published, nothing held) |
| `POST /admin/months/:monthKey/publish` | `{ monthKey, note? }` → `MonthSummary`. Held bills stay unpublished (§5). On a published month, publishes its late bills (§5a) | `already-published`, `earlier-month-unpublished` (`details.monthKey`, §5a), `rate-missing`, `exceptions-open`, `bills-missing`, `bills-stale`, `bills-mismatch` (calculated bills, §5), `approval-missing` (imported bills, §5a), `four-eyes-violation` |
| `GET /admin/months/:monthKey/slip-comparison` | `MonthSlipComparison` (`billing: R`) | `409 wrong-bill-source` (not calculated, or sync on), `404` unknown month |
| `PUT /admin/bills/:id/printed` | `{ finalBalance: number \| null }` → `SlipComparisonRow` (`billing: W`) | `409 wrong-bill-source`, `409 month-locked` (published), `422 invalid` |
| `POST /admin/bills/:id/hold` | `{ reason }` (10+ characters) → `SlipComparisonRow` (`billing: W`) | `409 wrong-bill-source`, `409 month-locked` (published), `422 invalid` |
| `POST /admin/bills/:id/release` | → `SlipComparisonRow & { published }` (`ratesAndMonthClose: A`) | `409 bill-not-held`, `409 bills-stale` (leaf moved since the bill was calculated), `409 bill-still-mismatched` |
| `POST /admin/suppliers` | `NewSupplier` → `{ id }` (201) | `409 supplier-code-taken`, `422 unknown-collection-point`, `422 bank-details-required` |
| `GET /admin/suppliers/:id/opening-balances` | `OpeningBalancesRecord` | `404` none yet |
| `PUT /admin/suppliers/:id/opening-balances` | `OpeningBalances & { note }` → `OpeningBalancesRecord` | `409 opening-balances-locked`, `422 note-required` |
| `POST /admin/credit-requests` | `WalkInCreditRequest` → `{ id }` (201) | `404` supplier, `422 invalid`, `feature-disabled`, `supplier-suspended`, `supplier-closed`, `request-pending`, `loan-outstanding`, the instalment codes |
| `PUT /admin/suppliers/:id/transport-rate` | `SupplierTransportRate` → `{ id }` | `422 negative`, `422 note-required` |
| `PUT /admin/bills/:id/adjustment` | `BillAdjustment` → `{ id }` | `409 month-locked` (published; a held bill is not), `422 negative`, `422 note-required` |
| `POST /admin/imports/:kind` | `ImportRequest` (`{ fileName, rows, dryRun?, duplicates? }`) → `ImportResult` (with `skipped`, `skippedTotal`, `dryRun`) | `422 import-invalid` with `details.problems` (at most 500) and `details.total`, `422 import-size`, `409 wrong-bill-source` (`bills`, `printedBalances`) |

Already on the backend and used as they are: `GET /admin/bill-months`, `GET /admin/bills`,
`GET /admin/bills/:id`, `GET /admin/months/:monthKey/bill-run`, the four
`/admin/deduction-rates` routes, credit approve/reject, and since `12eea12` the `bills`
import, `GET /admin/months`, `GET /admin/months/:monthKey` and the publish (imported
months; the late bills of §5a are still to come).

Config and shapes on existing routes (`GET /config`, `GET /admin/config`,
`PATCH /admin/config`; each block saved whole):

- **`config.advanceInterest?: { monthlyRatePercent }`**: absent means 0; refuse with
  `advanceInterestProblem` (0 to 10).
- **`config.loanInterest?: { monthlyRatePercent, recovery? }`** (`LoanInterestSetting`):
  absent means 0%; `recovery` is `onTop` (default) or `withinInstalment` (§5).
- **`config.billSettings?: { paymentUnit: 1 | 5 | 10, nextBillSerial?, source? }`**: absent
  means `{ paymentUnit: 1 }`, the `GL/YYYY-MM/NNNN` numbers, and `source: 'calculated'`
  (`billSourceOf`). Refuse with `billSettingsProblem`. Refuse changing `source` while a
  month has generated but unpublished bills: `409 bill-source-blocked` with
  `details.months`.
- **`DeductionRates.transportByPoint?: Record<pointId, number>`** on the four
  `/admin/deduction-rates` routes, proposed and approved with the other rates.
- **`AdminSupplier.transportPerKg?: number | null`** (and `SupplierDetail`): `null` or
  absent means the point's rate.
- **`AdminBill.source?: 'calculated' | 'imported'`**, absent on a synced bill.
- **`AdminBill` also carries `SlipCheck`**: `printedFinalBalance?`, `heldAt?`, `heldByName?`,
  `holdReason?` (§5). **`BillListItem.held?: boolean`**.
- **`GreenLeafBill.loanInstalmentNo?: number | null`** and **`otherCardsNote?`**.

### 4.2 Rules

**Add supplier.** `supplierCode` is the factory's own code and the app's sign-in id. The
**bare number is the identity**, unique across the whole factory: letters and digits only;
the `(division)` after it is shown and stored apart, so `5147` clashes with
`5147 (DENIYAYA)`. A supplier signs in with the bare number. A code is matched on the exact
bare number first; an all-digit code given without its leading zeros (`708`) then finds
`0708` only when exactly one supplier fits. When more than one fits, an import row naming
it is `ambiguous-supplier` and Add supplier refuses it as `supplier-code-taken`. `bankTransfer`
needs `bankDetails`; the account number is stored in full and masked on every read; the
account name defaults to the supplier's full name; the bank and branch are checked against
the factory's own `config.banks`. The collection point may be given by code or name, any
case. New suppliers have no app account; the office issues one with
`POST /admin/suppliers/:id/credentials/reset`. Audit `supplier.create`.

**Opening balances.** One record per supplier: `asOfMonth` (`YYYY-MM`), `advance`, `loan`,
`manure`, `teaPackets`, `savings`, `previousDebt` (all ≥ 0), optional `loanMonthsLeft` and
`loanInstalmentsPaid` for a loan already running (whole numbers), and a `note` of 10+
characters. **One cut-over month for the whole factory** (backend ADR-039, built `5b58f81`): not in
the future (`409 cut-over-month`, `details.reason: 'future'`); the factory's first month with
bills of ours, imported or calculated (`'first-bill-month'`, `details.asOfMonth`); and the
month the other suppliers' opening balances are as at (`'different'`, `details.asOfMonth`),
which changes only by saving every record again in the new month. Refused with
`409 withdrawal-pending` while a savings withdrawal asked for before the cut-over is still
pending (settle or cancel it first). They seed the ledgers the first bill reads, as
differences: the balance becomes the opening figure plus every movement since the start of
the cut-over month, so an advance approved on the 10th survives figures typed on the 20th,
and saving twice posts nothing. A supplier fed by the sync until now moves to the ledger. With
`loanMonthsLeft`, the loan is recovered at `loan / loanMonthsLeft` a month under the cap and
the first bill here is instalment `loanInstalmentsPaid + 1`; without it, under the cap
alone, numbered from 1. **Locked** (`409 opening-balances-locked`, `editable: false` on read)
once a bill **of ours** (imported or calculated) has been **published** for the supplier; a
draft does not lock them, and neither does a bill that came by the sync. The import has no
note column: the file's name is the note. Audit
`supplier.openingBalances`.

**Walk-in credit request.** Creates an `AdminCreditRequest` exactly like an app request,
with `channel: 'office'`, `status: 'pending'`, `createdById`/`createdByName` = the actor (so
BR-501 refuses them as approver), `reason` = the note (10+ characters), and the eligibility
computed as for an app request. Refused for: a facility switched off (`feature-disabled`), a
suspended or closed supplier, a pending request on the same facility (`request-pending`), a
**loan or advance while a loan is owed** (`loan-outstanding`, §5b), and a repayment period
the factory does not offer (`loan-installments-invalid`, `manure-installments-invalid`).
Manure is priced on the server from the catalogue, whatever amount is sent. **Not** refused
for being over the limit: it is recorded as asked, with the eligibility shown, and approval
refuses it (`over-ceiling`). Approval also refuses `supplier-suspended`, `supplier-closed`,
`advance-outstanding` and `loan-outstanding`. The supplier may cancel it from the app. Audit
`creditRequest.create`.

**Transport rate per supplier.** `transportPerKg` is a number ≥ 0 or `null` (back on the
point's rate), with a `note` of 10+ characters. One person; the before and after go in the
audit. Applies from the next bill generated, never to a published month. Audit
`supplier.transportRate`.

**Other deductions (`otherCards`).** The one bill line typed by hand on a **calculated**
bill, labelled "Other deductions" in the console and the app. `otherCards ≥ 0`;
`otherCardsNote` required (3+ characters) when the amount is above 0. Recalculate the bill
with `computeBillAmounts`; never patch the totals. Only before the month is published. **A
re-generation keeps each supplier's `otherCards` and note.** The bill carries the note to the
app as `GreenLeafBill.otherCardsNote`. An imported bill's line is the factory's and is not
edited here. Audit `bill.adjust`.

**Imports.** One endpoint, `POST /admin/imports/:kind`, `kind` one of `IMPORT_KINDS`.

- **All rows or none.** Check every row first; any problem refuses the whole file with
  `422 import-invalid`, `details.problems: ImportRowProblem[]` (at most 500) and
  `details.total`, saving nothing.
- Rows are objects of text, keyed by the column names in `IMPORT_COLUMNS[kind]`
  (`packages/domain/src/factoryRecords.ts`). Run `importRowProblems(kind, rows)` first (the
  console runs the same function), then the server-only checks below.
- `row` in a problem is the spreadsheet row: the first data row is **2**.
- 1 to 5,000 rows (`422 import-size`). Same permission as the one-at-a-time route.
- **Refuse, never round.** A number must be plain digits with no more decimals than its
  column allows (`too-many-decimals`; 2 by default, whole numbers where `decimals: 0`), and
  no minus sign unless the column has `allowNegative`; `0x1A` or `1e3` is `not-a-number`;
  `2026-02-31` is `not-a-date`; a text shorter than its `minLength` is `too-short`.
- Audit one `import.apply` entry per file (`{ kind, rows, skipped, fileName }`), not one
  per row. A dry run is not audited.
- **A file can be imported again without doubling anything** (`IMPORT_SKIP_KINDS`:
  `deliveries`, `suppliers`). A row already there is **skipped**, not refused: it is listed
  in `skipped` (`ImportSkippedRow`: `row`, `code`) and the rest of the file saves. Work out
  the skipped rows **first**, and drop the server problems of skipped rows, so a re-imported
  file is not refused for a row it would not save (a weighing in a month since published).
  - `deliveries`, `already-recorded`: the same date, supplier, kilos and collection point
    (the row's, or the supplier's own when empty) is recorded and not voided. The factory's
    scale file has no weighing number, so these four are the identity (`leafRecordKey`).
    Match **by count** (`matchRecorded`): importing the same file twice adds nothing, while
    two real 20 kg weighings in a file against one recorded saves the second.
    `duplicates: 'import'` skips nothing, for a file that really holds a second weighing of
    the same kilos on the same day.
  - `suppliers`, `supplier-exists`: the code (by its bare number) is already on the roll.
    The supplier is left as they are, not updated from the file. A code twice in the same
    file is still `duplicate`.
- **`dryRun: true`** checks everything and answers what **would** happen (`saved`,
  `skipped`, `problems`) without saving or auditing. The import dialog asks this first, so
  the office sees which rows are already there before pressing Import.

| Kind | Server-only checks (problem `code`) | What it saves |
|---|---|---|
| `suppliers` | `duplicate` in file, an existing code **skipped** (`supplier-exists`, not refused), `unknown-collection-point`, `bank-details-required`, `unknown-bank`, `bank-not-in-catalogue` | Suppliers, as Add supplier |
| `deliveries` | `unknown-supplier`, `month-locked`, `unknown-collection-point`; a weighing already recorded **skipped** (`already-recorded`) | Deliveries, `source: 'scaleFile'`; point defaults to the supplier's |
| `monthlyRates` | `duplicate`, `unknown-month`, `month-locked` | The month's rate, moving the stage to `rateEntered` |
| `openingBalances` | `duplicate`, `unknown-supplier`, `opening-balances-locked`, `cut-over-month` (on `asOfMonth`), `withdrawal-pending` | Opening balances |
| `walkInCredit` | `unknown-supplier`, manure without type or quantity (`required`), and the walk-in refusals above | Pending office requests |
| `billAdjustments` | `duplicate` (month + code), `unknown-supplier`, `month-locked`, `no-bill`, note missing (`required`) | Other deductions, as above |
| `transportRates` | `duplicate`, `unknown-supplier` | Each supplier's own rate; an empty `transportPerKg` sets `null` |
| `bills` | `missing-column` (row 1), `unknown-supplier` / `ambiguous-supplier`, `duplicate` (month + code), `month-not-ended`, `month-out-of-order` (also a month before the cut-over), `cut-over-month` (before any bill of ours, the file must include the cut-over month), `month-locked` (the supplier already has a bill in a published month), `rate-differs` (against the file and the month's stored rate), `bill-no-taken`, `too-large` / `must-be-positive` (`loanInstalmentNo` 1 to 360), and **the approvals check** (`approval-missing`, §5a). No `unknown-month`: the import creates the month | The month's bills **as printed** (§5a) for the suppliers in the file; `leafDifferences` in the answer |
| `printedBalances` | `duplicate` (month + code), `unknown-supplier`, `no-bill`, `month-locked` (the bill is published) | Each bill's `printedFinalBalance` (§5) |

Every problem code above, and `required`, `not-a-number`, `negative`, `too-many-decimals`,
`too-short`, `not-a-date`, `not-a-month`, `not-allowed`, `does-not-add-up`, is explained by
the console in all three languages. Any other code still shows, as "refused (code)".

## 5. Bills calculated here

For a factory whose `billSettings.source` is `calculated`: its own system runs and **still
prints its own bills**, but cannot export them. So a supplier holds two bills for the
month, the paper slip and the app's, and **they must agree to the rupee**. The office
enters every approval in that system (§1), and our calculation follows the printed slip
(below); the factory's accountant compares one month of our bills with theirs before going
live, and any difference is a defect in one of the two inputs (a leaf weighing, a rate, an
approval not entered in one of the systems). **No
factory needs this yet** (galaboda imports), so it is built last.

`computeBillAmounts` (`packages/domain/src/bill.ts`) is the calculation; do not write a
second one. **It reads exactly like the factory's printed slip** (galaboda, July 2026,
supplier 5708; the console test `reproduces the factory's printed slip` checks every
figure):

```
Coins B/F 7.41 + Green Leaf 113,109.00 + Extra 1,528.50 = Gross 114,644.91
Gross 114,644.91 - deductions 46,418.00                  = Balance Amount 68,226.91
Balance 68,226.91 + savings withdrawal 0, paid in tens   = Balance 68,220.00, Coins C/F 6.91
```

- **The coins brought forward are part of `grossAmount`**, so `balanceAmount` is the slip's
  "Balance Amount".
- **`paymentUnit`** (`config.billSettings.paymentUnit`, 1, 5 or 10): the payment is rounded
  down to it and the rest is `coinsCarriedForward`.

Its inputs, per supplier and month:

| Line | From |
|---|---|
| Kilos | Non-voided deliveries in the month |
| Gross | kilos × (rate + extra rate) + coins brought forward |
| Transport | Per weighing: `transportChargeFor(rates, kgsByPoint, supplier.transportPerKg)`: the supplier's own rate, else the weighing's collection point rate, else the factory rate |
| Stamps | Approved deduction rates (`/admin/deduction-rates`) |
| Savings | kilos × the supplier's savings per kg |
| Tea packets | Approved tea-packet requests |
| Advance | Taken back **in full** on its month's bill, even past the gross (`DEFAULT_DEDUCTION_RATES.instalmentShares.advance = 1`). An advance never carries a balance |
| Loan (`loansAdvance`, the slip's "Loans / Advance") | `loanRecovery(loan owed at the start of the month, planned instalment, config.loanInterest)`: the planned instalment, with the month's interest **on top** (`onTop`) or **inside** it (`withinInstalment`). `loanInstalmentNo` = 1 + the loan instalments on the bills just before this month |
| Manure | Instalments under the manure cap |
| Previous debts | Last bill's unpaid balance, or `previousDebt` from opening balances for the first |
| Coins brought forward | Last bill's coins carried forward |
| Other deductions | The office's typed line (§4.2) |

Carried forward:

| Slip line | Field | From |
|---|---|---|
| Next Month Deb | `carryForward.nextMonthDeb` | What the account could not cover |
| Loan Balance | `carryForward.loanBalance` | The **loan** still owed: owed at the start − principal repaid (`loanRecovery`) |
| Manure Balance | `carryForward.manureBalance` | Manure still owed |
| Loan Interest | `carryForward.loanInterest` | **This month's charge**, in rupees: the loan's interest (`loanRecovery`), plus advance interest (`advanceInterestFor`, `config.advanceInterest`) only when the account could not cover the advance. Interest is never worked on unpaid interest |

Example, 1% a month: a Rs. 50,000 loan over 10 months has Rs. 500 interest. `onTop` deducts
Rs. 5,500 and leaves `loanBalance` 45,000; `withinInstalment` deducts Rs. 5,000 and leaves
45,500.

**Bill number.** With `billSettings.nextBillSerial` set, a new bill is numbered
`factoryBillNumber(year, serial)`: the year of the **bill's month** and a running serial,
six digits growing to seven (`2026210869`). The serial **never resets**: after
`2026210869` comes `2027210870`. A re-generated month keeps each supplier's number. Without
it, `GL/YYYY-MM/NNNN`. Hand out serials in the same transaction as the bills, so two runs
cannot take the same number.

Generate → review on the bills screen → **compare with the printed slips** → publish
(four-eyes). Publishing makes the bills visible in the app and fires `billPublished`.

### Comparing with the printed slips (hold)

The factory's system prints a slip for every supplier, so before a month is published each
of our bills is compared with it (`compareWithSlip`, `packages/domain/src/factoryRecords.ts`).
Only for `source: 'calculated'` with the sync off; any other factory answers
`409 wrong-bill-source` on these routes.

1. **The office enters each printed slip's "Balance"** (the amount paid), one at a time
   (`PUT /admin/bills/:id/printed`) or from a file (`printedBalances` import: `month`,
   `supplierCode`, `finalBalance`). It is stored on the bill as `printedFinalBalance` and
   **kept through a re-generation**.
2. **Each bill is `match`** (ours equals it to the rupee), **`mismatch`**, or **`missing`**
   (no printed figure yet). `GET /admin/months/:monthKey/slip-comparison` answers
   `MonthSlipComparison`: the counts (`match`, `mismatch`, `missing`, `held`) and a row for
   every bill that is not a plain match, or is held (`SlipComparisonRow`: ours, printed,
   `difference` = ours − printed, status, held, reason).
3. **A difference is fixed at its cause**: a leaf weighing, the rate, or an approval entered
   in one system only. Correct it in the system that is wrong, re-generate, compare again.
4. **Or the bill is held** (`POST /admin/bills/:id/hold`, a reason of 10+ characters, kept
   through a re-generation). The publish refuses **`409 bills-mismatch`** while any bill is
   `mismatch` or `missing` and not held, with `details.count` and `details.suppliers`
   (`[{ supplierCode, status }]`, at most 10). Checked after `bills-stale`, before the
   four-eyes rule.
5. **The publish leaves held bills out.** They keep `publishedAt: null`; their savings are
   not posted and their withdrawals not settled; a payout run does not pay them. **The app
   must not return a held bill**; the app then says "No bill is available yet".
6. **A held bill stays open after the publish.** Its supplier's leaf for that month may be
   entered or voided, its other deductions edited, and `generate` on the published month
   recalculates **only the held bills** (every published bill stays exactly as it was).
7. **Release** (`POST /admin/bills/:id/release`, `ratesAndMonthClose: A`) needs the bill to
   match now (`409 bill-still-mismatched`), and its kilos to equal the supplier's live leaf
   (`409 bills-stale`: re-generate first). Before the publish it only clears the hold. **After
   the publish it publishes that one bill**: `publishedAt` set, its savings posted, its
   withdrawals settled, and `billPublished` sent to that supplier alone. Answers
   `published: true` then.
8. **The next month does not wait (factory).** It is generated and published for everyone.
   A supplier whose bill for an earlier month is still held gets the new bill **held
   automatically** (`heldForMonth` = the earlier month; no `holdReason`), because its coins,
   debt and loan balance come from the held bill. Release in order: an earlier held bill
   first (`409 earlier-bill-held`, `details.monthKey`), then recalculate the later month
   (a bill calculated before the earlier release is `409 bills-stale`), compare, release.

Audit `bill.printed`, `bill.hold` (`holdReason`) and `bill.release` (`published`). An
automatic hold is part of `month.bills.generate`, not a `bill.hold` of its own.

## 5a. Bills imported from the factory's own system

For a factory whose `billSettings.source` is `imported` (**galaboda**). Its own system keeps
printing every bill, now and later, and our records must equal its **final figures
exactly**.

**How.** Each month the office exports the finished bills to Excel and uses **Import →
Finished bills** (kind `bills`, columns in `IMPORT_COLUMNS.bills`; the template's example row
is the real galaboda July 2026 slip). Any number of files per month; each replaces only the
suppliers in it, so one file per division works. Every figure is stored **as printed** and
never recalculated. The month's rate is taken from the rows; a file whose rate differs from
the month's is `rate-differs`. Then review and publish as usual.

**What the import checks.**

1. **Each row adds up** (`importRowProblems`; `does-not-add-up` names the column):
   gross = green leaf + extra + coins brought forward; the nine lines = their total;
   balance = gross − total; paid + coins carried = balance + savings withdrawal. A month the
   supplier owes has a negative `balanceAmount`, `finalBalance` 0 and the shortfall as
   `nextMonthDebt`. The two rate products are held to a rupee (the factory's system may round
   per weighing); every sum to the cent. `ratePerKg` must be above 0 (`must-be-positive`) and
   `finalBalance` is whole rupees (`decimals: 0`). Every sum is exact **in whole cents**, with no
   tolerance. Paid in full (payable ≥ 0): `nextMonthDebt` is 0. Owed (payable below 0):
   `coinsCarriedForward` is 0. `loanInstalmentNo` is 1 to 360. **The headers `loanBalance`,
   `manureBalance` and `savingsToDate` must be in the file** even though a cell may be blank
   (`headerRequired`; `missingImportColumns`; the server answers `missing-column` on row 1):
   a blank is 0, so a missing column would set every balance to 0. **Savings To-date already has this month's
   withdrawal taken off (factory):** `savingsToDate = savingsPrevious + savings −
   savingsWithdrawal`, checked once any of the three is stated. **A blank cell is 0
   (factory)**, also for `loanBalance`, `manureBalance`, `savingsPrevious` and
   `savingsToDate`: the factory's system leaves a nil balance blank. One shared function, so a
   file the console accepts is one the server accepts.
2. **Everything we approved reached their slip, or the file is refused**, naming the
   supplier and the item. Requests approved in our console are typed into the factory's
   system by the office, which prints them on the slip; a slip without one means it was not
   typed. The console's approval dialogs (credit, tea packets, change requests) remind the
   approver to do this, in every mode (§1). **"For the month" means approved on or before its
   last day (factory):** something approved between the 1st and the day the slips print (about
   the 10th) is on the **next** slip, not this one. **A supplier with no slip for a month**
   (no leaf) carries that month's approvals to their **next** slip (factory): the check looks
   for them there.
   - The problem is `approval-missing`, its `column` the slip's column for the item
     (`advance`, `tea`, `savingsWithdrawal`, `loanBalance`, `manureBalance`) and `amount` the
     rupees approved. The console names them ("we approved Rs. 15,000.00 for this month and
     the slip does not have it").
   - Advances, tea packets, savings withdrawals: the slip's line is **at least** what we
     approved (more is the factory's own counter).
   - Loans and manure, through the balance:
     `loanBalance(this month) + loansAdvance(this month) ≥ loanBalance(last month) +
     approved this month`, and the same with `manureBalance` and `manure`. Last month is the
     previous imported slip, or the opening balance for the first.

**Which months.** Only a month that has **ended** (`month-not-ended` otherwise: its approvals
window is still open), and never one before the newest published month
(`month-out-of-order`): ledgers move forward only. **The import creates the month** (R14);
the month close screen offers Import even before there is any month. A month is **published in order**: publish
refuses while an earlier month still has unpublished bills (`409 earlier-month-unpublished`,
`details.monthKey`). The approvals check runs again at publish; if it now fails (something
approved since the import), publish is `409 approval-missing` with `details.problems`
(`supplierCode`, `column`, `amount`, `code`) and `details.total`; the console lists them in
the publish dialog, and the office imports the corrected file. **Imported months have no
month exceptions and no leaf step** (A13, A8): the slip is the record, and the close
checklist skips both. **Four-eyes covers the importer** (R16): publish refuses whoever entered
the rate **or imported a bill of the month**.

**A late division file after the publish (factory, R15; built `671627d`):** it adds bills
only for suppliers who have no **published** bill that month (one who has is
`month-locked`), and **those bills wait**: they are not published at once.
`MonthSummary.lateBills` counts them, the console shows "N bills from a late file are
waiting", and a manager **other than the importer** publishes them with the same
`POST /admin/months/:monthKey/publish` (which on a published month runs the approvals check
again and publishes its late bills: balances posted, withdrawals settled, each supplier
notified; `already-published` only when none are left; `four-eyes-violation` for the
importer; the audit's `after.lateBills` is how many went out).

- **While they wait:** a late bill found wrong is **replaced by sending it again** (factory,
  R18; built `76b50f2`): the new row supersedes it and the month still counts one waiting
  bill. The **next month cannot be published** (`409 earlier-month-unpublished`,
  `details.monthKey` the month with the waiting bills): its month-end balances would
  otherwise be worked out over the next month's postings, so the office publishes the late
  bills first. They also **block switching the sync or the bill source**
  (`sync-switch-blocked` / `bill-source-blocked`, the month in `details.months`).
- **Two managers at once:** a publish queued behind another manager's publish of the same
  month answers `already-published`; it never sends out a late file that manager did not
  see.

**Busy and retried.** A credit or tea-packet decision, or a savings withdrawal, that meets a
publish in progress is `409 records-busy`: nothing saved, send it again. A file whose month
was published while it waited is a top-level `409 month-locked` with
`details.reason: 'published-during-import'`: send the same file again (the console says so).

**Before the first imported month (R17).** Opening balances cover the cut-over: a supplier's
first slip is checked against their opening loan and manure balances, and approvals made
before the cut-over are in those balances. **A savings withdrawal still pending at cut-over is
settled or cancelled before it (factory)**, and the opening savings balance is entered after
that, so none is left pending from before.

**What it sets (your ADR-038).** At publish the slip's figures become the record **without
overwriting anything approved after the month**: each ledger posts the slip's repayments,
then one adjustment that brings the balance **as it stood at the first instant of the next
month** (Asia/Colombo) to the slip's figure. A loan approved on 3 November stays when October
is published on 10 November. Savings likewise: the deduction, the withdrawal, then an
adjustment to `savingsToDate`. Where ours differed, the adjustment is in the audit. The
slip's kilos are accepted; the answer's `leafDifferences` (`{ suppliers, kgs }`) says how
many suppliers' kilos differ from the leaf entered here, and the import dialog shows it. An
imported bill is
`AdminBill.source: 'imported'` (shown as "Imported") and is never edited here: a correction
is made in the factory's system and the month re-imported. The day grid comes from the leaf
entered or imported for that month. Past months may later be imported as published history,
with no balance change and no notification.

## 5b. Credit while records are kept here

- **Advance ceiling:** this month's kilos so far × last month's settled rate (the
  `thisMonthLeaf` basis), so it is 0 until leaf is recorded. The office enters each
  supplier's leaf on the day it is weighed.
- **An open loan blocks a new loan and an advance** until it is repaid (manure is not part of
  the rule): a supplier repaying a 10-month loan gets neither for those months.
  `buildCreditEligibility` takes `loanOutstanding` and answers `available: 0`,
  `reasonKey: 'credit.reason.loanOutstanding'`; the request, a walk-in and approval are
  refused with `409 loan-outstanding`.

## 6. Audit actions to add to `ACTION_REGISTRY`

`supplier.openingBalances`, `supplier.transportRate`, `bill.adjust`, `import.apply`,
`bill.printed`, `bill.hold`, `bill.release`. (`supplier.create` and `creditRequest.create`
exist.) The console labels all seven in en/si/ta.

## 7. Mobile app (done)

The `otherCards` line is labelled **"Other deductions"** (si "වෙනත් අඩුකිරීම්", ta "பிற
கழிவுகள்"), with `otherCardsNote` under it on the bill and in the PDF; the loan line carries
its instalment number ("Loan (instalment 3)", PDF "Loans / Advance 3"); the interest line is
"Interest (advance and loan)"; and the advance and loan screens explain `loan-outstanding`.
The app reads `grossAmount` and the coins as the API sends them.

## 8. Decided by the factory

From 9 to 22 October 2026:

1. **Transport** can differ by **collection point** and by **supplier**.
2. **`otherCards`** is **"Other deductions"**: small deductions the office types, with a
   reason.
3. **The bill follows the printed slip**: coins in the gross, the payment rounded to the
   factory's unit (galaboda pays in tens), "Loans / Advance 3" is the loan and its
   instalment number.
4. **Galaboda's own system keeps printing the bills**; we import them and must match them
   exactly. A factory whose system cannot export its bills has them calculated here; that
   system **still prints its own bills**, so ours must agree with them, and it holds every
   request the office enters there (§1).
5. **An advance is closed within its month**, deducted in full; any shortfall is Next Month
   Deb.
6. **"Loan Balance" is the loan's**; **"Loan Interest" is this month's charge** in rupees.
7. **Loan interest** is 0% unless set in Configuration, and the factory chooses whether it is
   taken on top of the instalment or inside it.
8. **No new loan and no advance while a loan is owed.**
9. **A supplier number is unique across the factory.**
10. **Bill numbers:** the year of the bill's month, and a serial that never resets.
11. **The office enters daily leaf** while the sync is off.
12. **A calculated bill that does not match the printed slip is held**: the rest of the
    month publishes, the held bill is fixed, compared again and released on its own. **The
    next month goes ahead**; that supplier's next bill is held too, and the two are released
    in order.
13. **Importing a file again skips what is already there.** Galaboda's scale file has no
    weighing number, so leaf is matched on date, supplier, kilos and collection point; the
    office may still import a real second weighing. A supplier already on the roll is
    skipped, not updated, and the rest of the file is added.
14. **Galaboda's slip (24 October 2026):** a month's slip carries only what was approved by
    its last day (later approvals are on the next slip); a supplier with no slip for a month
    carries its approvals to the next slip; a blank balance or savings cell is 0; Savings
    To-date already has the month's withdrawal taken off.
15. **Imported months (26 October 2026):** the import creates the month; a late division
    file's bills wait for a manager other than the importer to publish them, and a waiting
    one may be replaced by sending it again (R18); four-eyes covers the importer as well as
    the rate's enterer; savings withdrawals pending at cut-over are settled or cancelled
    before it.
16. **Savings interest (29 October 2026):** simple; on each month's lowest balance (the
    balance at its start, or after a withdrawal paid that month); credited once a year with
    the month before the withdrawal month, so it can be taken out in that month. The rate is
    `savings.annualInterestRate` (0% unless set). `savingsInterestFor` in `packages/domain`;
    the API posts it (BACKEND-TODO #56), and until then the accountant posts the figure.
17. **Corrections after a published bill (C5, built 30 October 2026):** a manager only
    (`billing: A`) posts one on the supplier's Money tab, with a reason of 10+ characters, for a
    month with a published bill. A loan, fertilizer or savings balance moves at once (an
    `adjustment` entry) and never below 0; a payment lands on the supplier's next bill as a
    "Correction (<month>)" line with the reason, added after the balance (paid too little) or
    taken off (paid too much). Never deleted: a wrong one is corrected by another. Where bills
    are imported, a payment correction is the factory system's; a balance one warns that the
    next import resets it to the slip. `corrections.ts` in `packages/domain`; BACKEND-TODO #57.
18. **Records kept five years (30 October 2026, Q12):** bills, payout records, deliveries,
    the savings and credit ledgers, requests, change requests and inquiries, five years
    after the end of their month (`retention.ts` in `packages/domain`). Nothing is deleted
    sooner; an account-deletion request removes the app account only. After five years a
    closed supplier's personal details are removed and the figures kept (BACKEND-TODO #59).
19. **Credit approvals by amount (30 October 2026, Q6):** a clerk approves up to the
    factory's limit, the manager in between, the factory administrator (the owner) above
    the owner threshold; per facility, in Configuration → Credit rules (#61).
20. **Bad debt (30 October 2026, Q7):** the manager writes off a loan or fertilizer balance,
    or pays it from the supplier's savings, as a correction (#62).
21. **Suppliers (30 October 2026, Q14):** each estate its own number; no joint accounts; on
    a death or a transfer of land the number stays with its records five years and is never
    reused. No payout files (Q17): the factory's own system pays.

## 9. Checks

- Sync on: every write in §4.1 answers `409 factory-sync-on`; the console shows no entry
  screens. Switching the sync, or the bill source, with a generated but unpublished month is
  refused and names the month.
- A file with one bad row saves nothing and lists the row; the corrected file saves all.
- **Importing again:** import a day's leaf file twice: the second saves 0 and skips every
  row (`already-recorded`). Add one row and import again: saves 1. Send it with
  `duplicates: 'import'`: saves all. A suppliers file with one existing code and one new
  saves the new one and skips the other (`supplier-exists`), leaving the existing supplier
  unchanged. `dryRun: true` answers the same counts and saves nothing.
- **Imported bills (galaboda):** import the template's example row: the bill matches the
  slip to the cent (gross 114,644.91, paid 68,220, coins 6.91). Approve a Rs. 40,000 advance
  for July, then import a July slip with Advance 0: refused, naming the supplier and the
  advance. Generating bills in this factory is `409 wrong-bill-source`. Importing the
  current month is `month-not-ended`; on the 10th of the next month it saves and answers
  `leafDifferences`. A row with a withdrawal of 1,000 and To-date unchanged is
  `does-not-add-up` on `savingsToDate`. With an earlier month unpublished, publish is
  `409 earlier-month-unpublished`. A loan approved on the 3rd of the next month is still
  owed after the month is published.
- **Calculated bills:** add a supplier, import 200 weighings, enter a rate, generate, type
  one other deduction, regenerate (it stays), publish; the app shows the bill with the note.
  The slip in §5 comes out to the cent with `paymentUnit: 10`. With `nextBillSerial: 210870`
  the first new bill is `<year>210870`; re-generating keeps it.
- **Printed slips (calculated bills):** generate a month; publish is
  `409 bills-mismatch` (every bill `missing`). Import printed balances equal to ours except one
  Rs. 10 lower: one `mismatch`, publish still refused. Hold it (a 5-character reason is
  `422`): publish succeeds, that bill stays `publishedAt: null`, the others are published.
  Release while it differs: `409 bill-still-mismatched`. Edit its other deductions (allowed;
  another supplier's published bill is `409 month-locked`), re-generate (only it changes),
  enter the matching printed figure, release: `published: true`.
- Loan interest at 1%, Rs. 50,000 over 10 months: `onTop` deducts 5,500 and leaves 45,000;
  `withinInstalment` deducts 5,000 and leaves 45,500; `loanInterest` is 500 either way.
- Opening balances lock once a bill is **published** for the supplier, not on a draft.
- A supplier with a loan owed: the app shows no advance or loan limit and explains why; a
  walk-in advance for them is `409 loan-outstanding`.
- A clerk records a walk-in advance and cannot approve it; a manager can. A clerk cannot
  create a savings withdrawal; a manager can.
- A point with its own transport rate charges it on that point's weighings; a supplier with
  their own rate pays it on every kilo; clearing it puts them back on the point's rate.
