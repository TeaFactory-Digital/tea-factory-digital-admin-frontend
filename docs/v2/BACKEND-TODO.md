# Backend to-do

Only the work still open (28 October 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

| # | What | Priority |
|---|------|----------|
| 50 | Staging is not running the latest commits | Now |
| 45 | Factory records: opening balances next, then leaf and months, other deductions, importing again, the bill engine | High |
| 48 | "This month so far": `GET /bills/month-to-date` | Medium |
| 54 | Default pages: copy `static-pages.seed.json` again (Tamil green leaf word) | Small, any time |
| 55 | The clerk reads Rates & month close: `vendor:pull` and one test | Now (small) |
| - | Later: factory sync (Phase 10), balance corrections | Later |

## 50. Staging is not running the latest commits

**In progress on your side** (your note of 27 October: the deploy and the three
migrations). Checked again on 28 October 2026 (read only): `GET /config` for galaboda
still answers `factorySync: null` and **14 flags**, so staging is not yet on `068faf3` or
later (`12eea12`, `671627d`, `76b50f2`); migrations `20261023010000`, `20261024010000` and
`20261026010000` are not applied there. Once it answers `factorySync: { enabled: false }`
and 15 flags, tell me, and the bills import and publish get tried against it.

## 45. Factory records without the factory system

The office keeps suppliers, daily leaf, monthly rates, bills, opening balances and counter
credit requests in the console while the sync is off. **Contract:** factory-records.md.

**In this order:**

Step 1 (the bills import, the month reads and publish) is built, with late bills waiting
for a manager (R15, `671627d`) and a waiting one replaced by sending it again (R18,
`76b50f2`).

1. **Opening balances** (next): `GET` / `PUT /admin/suppliers/:id/opening-balances` and the
   `openingBalances` import (factory-records §4.2).
2. **Leaf and months:** the leaf and month endpoints in factory-records §4.1
   (`/admin/deliveries`, `/admin/deliveries/summary`, the rate, exceptions), and the
   `deliveries` and `monthlyRates` imports.
3. **Other deductions:** `PUT /admin/bills/:id/adjustment` and the `billAdjustments` import.
4. **The bill engine** (factory-records §5), last: galaboda imports its bills, so no factory
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

## 54. Default pages: copy the seed again

Tamil green leaf is now one word everywhere, **கொழுந்து** (the account is கொழுந்துக்
கணக்கு), decided with the factory on 28 October 2026. Our
`docs/v2/static-pages.seed.json` has it (and, since 29 October, the bare இலை is கொழுந்து
there too); your `apps/api/src/modules/tenant-defaults/static-pages.defaults.json` still says
பச்சை இலை in six Tamil bodies, and one more body (`pages[0]`, the second translation) already differed
before this change. Please replace your file with ours as it stands.

**Check:** the two files are equal as JSON, and neither `grep 'பச்சை இலை'` nor a bare
`இலை` finds anything in yours.
Pages a factory has already edited keep their own text: only the defaults change.

## 55. The clerk reads Rates & month close

`DEFAULT_ROLE_MATRIX.clerk.ratesAndMonthClose` is now **`R`** (was `-`), in
`packages/domain/src/rbac.ts` (28 October 2026). Please `npm run vendor:pull`.

**Why.** The clerk holds `billing: W` to import the finished bills (your `POST
/admin/imports/bills` gates on exactly that), but the import is on Rates & month close, and
that screen is built on `GET /admin/months`, which needs `ratesAndMonthClose: read`. With `-`
the clerk got "Your role does not allow this" and never reached the import, so in practice a
manager imported, and the two-person rule then needed a **second** manager to publish.
factory-records.md §3 always put the import on that screen with `billing: W`.

I know your note in `route-declaration.ts` (and `capability.guard.spec.ts`) says widening
the close for a month picker would grant read on the close "by accident". This is the same
grant made on purpose: the clerk reads the month list, its rate and checklist, and the
deduction rates; entering the rate (`W`), proposing deduction rates (`W`) and publishing
(`A`) stay the manager's.

**What changes on your side:**

- `test/frontend-gaps-10.spec.ts`, "the clerk, who has no rates-and-month-close access,
  cannot read them": `GET /admin/deduction-rates` as the clerk is now `200`; a proposal
  (`POST`) as the clerk is still `403`.
- The comments in `route-declaration.ts`, `capability.guard.spec.ts` and
  `bills-savings.spec.ts` that say the clerk lacks `ratesAndMonthClose`. `GET
  /admin/bill-months` on `billing` OR `payouts` stays right for the payouts reader.
- A factory that saved its own clerk row in the role matrix keeps it; only the default
  moves.

**Check:** as the clerk: `GET /admin/months` `200`; `PUT /admin/months/:m/rate` `403`;
`POST /admin/months/:m/publish` `403`; `POST /admin/imports/bills` `200` (or `422` for a
bad file).

If you would rather keep the clerk out of the close, the other way is to move the import
and the bill run onto the Bills screen (`billing`); tell me and I will change the console
back and do that instead.

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
