# Factory records without the factory system

**Status:** console built against the mock (October 2026); backend to build.
**For:** the backend developer. The console side is done and tested; this file is the
contract it was built against.

## 1. Why

The platform's product is the **supplier app**. Normally its figures (suppliers, the day's
leaf, the month's rate, bills, balances) arrive from the factory's own system by the hourly
sync (`factory-system-team.md`). Some factories have no system we can reach. For them the
office keeps those records **in the console**, so the app still has something to show.

This is not a replacement for a factory's system. It is the smallest set of records the app
needs: suppliers, daily leaf, monthly rate, bills, opening balances, and counter requests.

**One source at a time.** A factory either syncs or keeps records here, never both. Two
sources writing the same weighing is how a bill comes to disagree with itself.

## 2. The switch

| | Sync **on** (default) | Sync **off** |
|---|---|---|
| Where records come from | The hourly sync | The office, in the console |
| Entry and import screens | Hidden; routes show "comes from the factory system" | Shown |
| Bills | The factory system's, shown as they arrive | Calculated here, reviewed, published |
| Hourly sync job | Runs | Does not run for this factory |
| Record writes listed in §4 | **`409 factory-sync-on`** | Allowed |

Stored in the tenant config:

```ts
// packages/domain/src/factoryRecords.ts
config.factorySync?: { enabled: boolean }   // absent = enabled (true)
isFactorySyncEnabled(config)                // the one reading of it
```

- `PATCH /admin/config` accepts `{ factorySync: { enabled } }`, saved whole, audited as
  `config.update` like any section. `GET /config` and `GET /admin/config` return it.
- Who may change it: `flagsAndBranding: W` (factory administrator), as for every config section.
- **Switching on again:** suppliers entered here are matched to the factory system's by
  `supplierCode` (bare number, before any division suffix). Records entered here stay; the
  sync's records replace them for the same supplier, day or month. No second supplier is
  ever created for a code that exists.

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
| Same screen | **Generate bills** card, then **Review this month's bills**, then Publish (v1, restored) | | `billing: W` / `ratesAndMonthClose: A` |
| Same screen | Deduction rates card: transport per kg (factory-wide **and per collection point**), stamps, instalment caps (v1, restored) | | `ratesAndMonthClose: W` propose, `A` approve |
| Bill detail | **Other deductions → Edit** (before publishing) | **Import → Other deductions** | `billing: W` |
| Credit | **Record walk-in request** | **Import from file** | `creditRequests: W` |
| Configuration → **Factory system** | The switch | | `flagsAndBranding: W` |
| Configuration → **Bill calculation** | Pay in Rs. 1 / 5 / 10, next bill serial, advance interest (% a month) | | `flagsAndBranding: W` |

**Role change (shared matrix, `packages/domain/src/rbac.ts`):** the clerk is now
`deliveries: W` (was R) and `creditRequests: W` (was R). Recording a counter request is not
deciding it; `A` stays with the manager, and BR-501 refuses the recorder as approver.

## 4. API

### 4.1 Endpoints the console calls that the backend does not have yet

All of these refuse with **`409 factory-sync-on`** while the sync is on, and `403` without
the permission in the table above. The request and response shapes are the domain types
named, and the console's mock (`apps/admin/src/services/mocks/handlers.ts`) implements each
one; copy its rules.

| Method and path | Body / answer | Refusals |
|---|---|---|
| `GET /admin/deliveries?date&collectionPoint&includeVoided&page&pageSize&sort&dir` | `Paged<Delivery>` | |
| `GET /admin/deliveries/summary?date&collectionPoint` | `CollectionDaySummary` | |
| `POST /admin/deliveries` | `DeliveryBatch` → `DeliveryBatchResult` (per-row refusals inside a 200) | `409 month-locked`, `422 batch-too-large` |
| `POST /admin/deliveries/:id/void` | `{ reason }` → `Delivery` | `422 note-required`, `409 month-locked` |
| `GET /admin/months`, `GET /admin/months/:monthKey` | `Paged<MonthSummary>`, `MonthSummary` | `404` unknown month |
| `PUT /admin/months/:monthKey/rate` | `MonthlyRateEntry` → `MonthSummary` | `409 month-locked`, `422 invalid-rate` |
| `GET /admin/months/:monthKey/exceptions`, `POST .../exceptions/:id/resolve` | `Paged<MonthException>`, `{ note }` | `422 note-required` |
| `POST /admin/months/:monthKey/bills/generate` | `{ monthKey }` → `BillRun` | `409 rate-missing`, `409 month-locked` |
| `POST /admin/months/:monthKey/publish` | `{ monthKey, note? }` → `MonthSummary` | `rate-missing`, `exceptions-open`, `bills-stale`, `already-published`, `four-eyes-violation` |
| **`POST /admin/suppliers`** | `NewSupplier` → `{ id }` (201) | `409 supplier-code-taken`, `422 unknown-collection-point`, `422 bank-details-required` |
| **`GET /admin/suppliers/:id/opening-balances`** | `OpeningBalancesRecord` | `404` none yet |
| **`PUT /admin/suppliers/:id/opening-balances`** | `OpeningBalances & { note }` → `OpeningBalancesRecord` | `409 opening-balances-locked`, `422 note-required` |
| **`POST /admin/credit-requests`** | `WalkInCreditRequest` → `{ id }` (201) | `404` supplier, `422 invalid` |
| **`PUT /admin/suppliers/:id/transport-rate`** | `SupplierTransportRate` → `{ id }` | `422 negative`, `422 note-required` |
| **`PUT /admin/bills/:id/adjustment`** | `BillAdjustment` → `{ id }` | `409 month-locked`, `422 negative`, `422 note-required` |
| **`POST /admin/imports/:kind`** | `{ fileName, rows }` → `ImportResult` | `422 import-invalid` with `details.problems`, `422 import-size` |

Already on the backend and used as they are: `GET /admin/bill-months`, `GET /admin/bills`,
`GET /admin/bills/:id`, `GET /admin/months/:monthKey/bill-run`, the four
`/admin/deduction-rates` routes, credit approve/reject.

Changed shapes on existing routes:

- **`DeductionRates.transportByPoint?: Record<pointId, number>`** on the four
  `/admin/deduction-rates` routes. Proposed and approved with the other rates (four-eyes as
  today); `deductionRateProblems` refuses a negative one; `deductionRateDiff` lists each
  point's change as `transportByPoint.<pointId>`.
- **`AdminSupplier.transportPerKg?: number | null`** (and so `SupplierDetail`) on
  `GET /admin/suppliers/:id`. `null` or absent: the supplier is on their point's rate.
- **`config.advanceInterest?: { monthlyRatePercent }`** on `GET /config`,
  `GET /admin/config` and `PATCH /admin/config`. Absent means 0. Refuse with
  `advanceInterestProblem` (0 to 10).
- **`config.billSettings?: { paymentUnit: 1 | 5 | 10, nextBillSerial? }`**, same routes.
  Absent means `{ paymentUnit: 1 }` and the `GL/YYYY-MM/NNNN` numbers. Refuse with
  `billSettingsProblem`.
- **`GreenLeafBill.loanInstalmentNo?: number | null`**: which loan instalment
  `deductions.loansAdvance` is.

### 4.2 Rules for the new endpoints

**Add supplier.** `supplierCode` is the factory's own code (it is the app's sign-in id,
Q16): unique per factory, compared on the bare number, so `5147` clashes with
`5147 (DENIYAYA)`. `paymentMethod: bankTransfer` needs `bankDetails`; the account number is
stored in full and masked on every read, as today. New suppliers have no app account; the
office issues one with the existing `POST /admin/suppliers/:id/credentials/reset`.
Audit `supplier.create`.

**Opening balances.** One record per supplier: `asOfMonth` (`YYYY-MM`), `advance`, `loan`,
`manure`, `teaPackets`, `savings`, `previousDebt` (all ≥ 0), and a `note` of 10+ characters.
They seed the ledgers the first bill reads: credit balances, savings balance, and the debt
brought forward. **Locked** (`409 opening-balances-locked`, and `editable: false` on read)
as soon as any bill exists for the supplier. Audit `supplier.openingBalances`.

**Walk-in credit request.** Creates an `AdminCreditRequest` exactly like an app request,
with `channel: 'office'`, `status: 'pending'`, `createdById`/`createdByName` = the actor (so
BR-501 refuses them as approver), `reason` = the note, and the eligibility computed as for
an app request. Approval is the existing route. Audit `creditRequest.create`.

**Transport rate per supplier.** `transportPerKg` is a number ≥ 0 or `null` (back on the
point's rate), with a `note` of 10+ characters. One person, like the supplier's other
records; the before and after go in the audit. Applies from the next bill generated, never
to a published month. Audit `supplier.transportRate`.

**Other deductions (`otherCards`).** The one bill line typed by hand, labelled "Other
deductions" in the console and the app. `otherCards ≥ 0`;
`otherCardsNote` required (3+ characters) when the amount is above 0. Recalculate the bill
with `computeBillAmounts` (total, balance, coins, final balance, next-month debt); never
patch the totals. Only before the month is published. **A re-generation keeps each
supplier's `otherCards` and note.** The bill carries the note to the app as
`GreenLeafBill.otherCardsNote` (new, optional). Audit `bill.adjust`.

**Imports.** One endpoint, `POST /admin/imports/:kind`, `kind` one of `IMPORT_KINDS`.

- **All rows or none.** Check every row first; any problem refuses the whole file with
  `422 import-invalid` and `details.problems: ImportRowProblem[]`, saving nothing.
- Rows are objects of text, keyed by the column names in `IMPORT_COLUMNS[kind]`
  (`packages/domain/src/factoryRecords.ts`). Run `importRowProblems(kind, rows)` first (the
  console runs the same function), then the server-only checks below.
- `row` in a problem is the spreadsheet row: the first data row is **2**.
- 1 to 5,000 rows (`422 import-size`). Same permission as the one-at-a-time route.
- Audit one `import.apply` entry per file (`{ kind, rows, fileName }`), not one per row.

| Kind | Server-only checks (problem `code`) | What it saves |
|---|---|---|
| `suppliers` | `duplicate` in file, `supplier-code-taken`, `unknown-collection-point`, `bank-details-required` | Suppliers, as Add supplier |
| `deliveries` | `unknown-supplier`, `month-locked`, `unknown-collection-point` | Deliveries, `source: 'scaleFile'`; point defaults to the supplier's |
| `monthlyRates` | `duplicate`, `unknown-month`, `month-locked` | The month's rate, moving the stage to `rateEntered` |
| `openingBalances` | `duplicate`, `unknown-supplier`, `opening-balances-locked` | Opening balances |
| `walkInCredit` | `unknown-supplier`, manure without type or quantity (`required`) | Pending office requests |
| `billAdjustments` | `duplicate` (month + code), `unknown-supplier`, `month-locked`, `no-bill`, note missing (`required`) | Other deductions, as above |
| `transportRates` | `duplicate`, `unknown-supplier` | Each supplier's own rate; an empty `transportPerKg` sets `null` |

Problem codes the console already explains in all three languages: `required`,
`not-a-number`, `negative`, `not-a-date`, `not-a-month`, `not-allowed`, and every code in
the table. Any other code still shows, as "refused (code)".

## 5. Bills calculated here

`computeBillAmounts` (`packages/domain/src/bill.ts`) is the calculation; do not write a
second one. **It now reads exactly like the factory's printed slip** (galaboda, July 2026,
supplier 5708; the console test `reproduces the factory's printed slip` checks every
figure):

```
Coins B/F 7.41 + Green Leaf 113,109.00 + Extra 1,528.50 = Gross 114,644.91
Gross 114,644.91 - deductions 46,418.00                  = Balance Amount 68,226.91
Balance 68,226.91 + savings withdrawal 0, paid in tens   = Balance 68,220.00, Coins C/F 6.91
```

Two changes from the earlier shared function, and the backend picks both up by vendoring:

- **The coins brought forward are part of `grossAmount`**, so `balanceAmount` is the
  slip's "Balance Amount". Before, both left the coins out and added them afterwards.
- **`paymentUnit`** (`config.billSettings.paymentUnit`, 1, 5 or 10): the payment is
  rounded down to it and the rest is `coinsCarriedForward`. Absent means 1.

Its inputs, per supplier and month:

| Line | From |
|---|---|
| Kilos | Non-voided deliveries in the month |
| Gross | kilos × (rate + extra rate) + coins brought forward |
| Transport | Per weighing: `transportChargeFor(rates, kgsByPoint, supplier.transportPerKg)`. The supplier's own rate, else the weighing's collection point rate, else the factory rate (`transportRateFor`) |
| Stamps | Approved deduction rates (`/admin/deduction-rates`) |
| Savings | kilos × the supplier's savings per kg |
| Tea packets | Approved tea-packet requests |
| Advance | Taken back **in full** on the month's bill: an advance is cash given during the month. The default cap is now 100% of the gross (`DEFAULT_DEDUCTION_RATES.instalmentShares.advance = 1`); more than the account earned becomes next month's debt |
| Loan (`loansAdvance`, the slip's "Loans / Advance") | The supplier's chosen instalments, under the loan cap. `loanInstalmentNo` = 1 + the loan instalments on the bills just before this month (counting back until a bill without one) |
| Manure | Instalments under the manure cap |
| Previous debts | Last bill's unpaid balance, or `previousDebt` from opening balances for the first |
| Coins brought forward | Last bill's coins carried forward |
| Other deductions | The office's typed line (§4.2) |
| Advance interest (`carryForward.loanInterest`) | `advanceInterestFor(advance still owed after this month's instalment, config.advanceInterest)`: simple interest, per month. On publish, add it to the supplier's advance balance so the next bill recovers it |

**Bill number.** With `billSettings.nextBillSerial` set, a new bill is numbered
`factoryBillNumber(year, serial)` = the year and a six-digit running serial
(`2026210869`), and the serial moves on by one; the office sets it to the number after the
factory's last paper bill. A re-generated month keeps each supplier's number. Without it,
`GL/YYYY-MM/NNNN` as today. Hand out serials inside the same transaction as the bills, so
two runs cannot take the same number.

Generate → review on the bills screen → publish (four-eyes as today). Publishing makes the
bills visible in the app and fires `billPublished`.

## 6. Audit actions to add to `ACTION_REGISTRY`

`supplier.openingBalances`, `supplier.transportRate`, `bill.adjust`, `import.apply`.
(`supplier.create` and `creditRequest.create` exist.) The console already labels all four in
en/si/ta.

## 7. Mobile app

Done in the app: the `otherCards` line is labelled **"Other deductions"** (si "වෙනත්
අඩුකිරීම්", ta "பிற கழிவுகள்"), `otherCardsNote` shows under it on the bill and in the
PDF, and the loan line carries its instalment number ("Loan (instalment 3)", PDF
"Loans / Advance 3"). The app reads `grossAmount` and the coins as the API sends them.

## 8. Decided by the factory (9 October 2026)

1. **Transport** can differ by **collection point** and by **supplier**: a rate per point,
   and a supplier's own rate over it (§4.2, §5).
2. **`otherCards`** is **"Other deductions"**: small deductions the office types, with a
   reason.
3. **Advance interest** is set in **Configuration**, as a percent a month (§5). The
   factory's accountant should still check one month's bills calculated here against their
   own before going live.
4. **The bill follows the factory's printed slip** (§5): coins in the gross, the payment
   rounded to the factory's unit (galaboda pays in tens), the advance taken back in full,
   "Loans / Advance 3" is the loan and its instalment number, and the factory's own bill
   numbers.

## 9. Checks

- Sync on: every write in §4.1 answers `409 factory-sync-on`; the console shows no entry
  screens.
- Sync off: add a supplier, import 200 weighings, enter a rate, generate, type one other
  charge, regenerate (the charge stays), publish; the app shows the bill with the note.
- A file with one bad row saves nothing and lists the row; the corrected file saves all.
- Opening balances lock once a bill exists for the supplier.
- A clerk records a walk-in advance; the clerk cannot approve it; a manager can.
- A point with its own transport rate charges it on that point's weighings; a supplier with
  their own rate pays it on every kilo; clearing it puts them back on the point's rate.
- The slip in §5 comes out to the cent with `paymentUnit: 10`.
- With `nextBillSerial: 210870`, the first new bill is `<year>210870`; re-generating keeps it.
- Advance interest at 2% a month: a bill with Rs. 10,000 of advance still owed shows
  Rs. 200 `loanInterest`, and the next bill's advance balance includes it.
