# Backend to-do

Only the work still open (29 October 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

| # | What | Priority |
|---|------|----------|
| 50 | Staging is not running the latest commits | Now |
| 45 | Factory records: leaf and months next, then other deductions, importing again, the bill engine | High |
| 48 | "This month so far": `GET /bills/month-to-date` | Medium |
| 54 | Default pages: `npm run vendor:pages` once more (the bare Tamil இலை) | Small, any time |
| 55 | The clerk reads Rates & month close: `vendor:pull` and one test | Now (small) |
| 56 | Savings interest: post the year's `interest` entry when the month before the withdrawal month is published | Medium |
| 57 | Corrections after a published bill (C5): `GET`/`POST /admin/suppliers/:id/corrections`, the bill's `corrections` lines | Medium |
| - | Later: factory sync (Phase 10) | Later |

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

Built: the bills import, the month reads and publish, with late bills waiting for a manager
(R15, `671627d`) and a waiting one replaced by sending it again (R18, `76b50f2`); and
opening balances with the one cut-over month (`5b58f81`, ADR-039). Checked on the console
side 29 October: the console's card and import are switched on, `cut-over-month` (each
`details.reason`, naming `details.asOfMonth`) and `withdrawal-pending` are explained in
en/si/ta, and the console's mock keeps the same rules.

1. **Leaf and months** (next): the leaf and month endpoints in factory-records §4.1
   (`/admin/deliveries`, `/admin/deliveries/summary`, the rate, exceptions), and the
   `deliveries` and `monthlyRates` imports.
2. **Other deductions:** `PUT /admin/bills/:id/adjustment` and the `billAdjustments` import.
3. **The bill engine** (factory-records §5), last: galaboda imports its bills, so no factory
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

## 54. Default pages: one more `vendor:pages`

Built in `41221c0`: the defaults are copied from our `docs/v2/static-pages.seed.json`, and
`vendor:drift` reports the file when it differs. Thank you. One more copy is needed: since
`db22632` the **bare இலை** ("leaf") in the six Tamil bodies is கொழுந்து too (decided with the
factory: one word for green leaf everywhere). Your copy is from before that commit. Please
`npm run vendor:pages`.

**Check:** `npm run vendor:drift` is clean, and a bare `இலை` finds nothing in your
`static-pages.defaults.json`. Pages a factory has already edited keep their own text.

## 55. The clerk reads Rates & month close

`DEFAULT_ROLE_MATRIX.clerk.ratesAndMonthClose` is now **`R`** (was `-`), in
`packages/domain/src/rbac.ts` (28 October 2026, committed in `db22632`). Please
`npm run vendor:pull`. The same pull brings `cut-over-month` and `withdrawal-pending` into
`ADMIN_ERROR_CODES` (`packages/domain/src/types/admin.ts`), the two codes you added in
`5b58f81`, so the console and the API name them from one list.

The same pull also brings the **supplier-facing types the app now reads from the package**
(29 October 2026: the app vendors `@tfd/domain` too, in place of its own copies). Nothing
here changes the wire; the types now say what your API already sends:

- `Supplier.collectionPoint?: { id, name } | null` (what `GET /profile` answers);
  `AdminSupplier` keeps its `collectionPoint` as the name string.
- `LoanRequest.installmentMonths` and `ManureRequest.installmentMonths`
  (`number | null`, optional): the app's name for the term, which the API maps
  `repaymentMonths` to.
- `Inquiry.repliedAt?` and `Inquiry.messages?: InquiryMessage[]`.
- `InquiryMessage` moved from `types/admin.ts` to `types/app.ts` (same shape, still
  exported from the root), so the app and the console read one definition.

`npm run domain:drift` in the console names the three files that differ from your copy
today: `rbac.ts`, `types/admin.ts`, `types/app.ts`.

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

## 56. Savings interest: credit it once a year

**Decided by the factory on 29 October 2026** (it was §21.9, "the rate is stored and nothing
is posted"):

- **Simple interest.** A month earns `base × annualInterestRate ÷ 100 ÷ 12`; nothing earned in
  a year earns interest in that year.
- **On the month's lowest balance**: the lower of the balance before the month's ledger
  entries and after them, never below zero. Contributions arrive with the month's bill, after
  the month, so an ordinary month earns on its opening balance; in the month a withdrawal is
  paid, on the balance after it.
- **Credited once a year, in time for the withdrawal month.** The year is the twelve months
  ending the month **before** `savings.withdrawalMonth` (April: April to March), posted with
  that month, so it is in the balance a supplier may take out in April.

The arithmetic is in the shared package, so please `npm run vendor:pull` (same pull as #55):
`interestYear(policy, creditYear)` gives the months, and `savingsInterestFor(entries, year,
rate)` gives each month's opening, closing, base, rate and interest, and the total, each month
rounded to the cent. Tests: `apps/admin/src/test/savingsInterest.test.ts` in the console repo
(20,000 all year at 6% is 1,200.00; 20,000 less a 15,000 withdrawal with 2,000 saved earns 35.00
that month).

**What it needs on your side:**

- When the month `toMonthKey` is **published** (or its imported bills are), for each supplier
  with a savings ledger, post one `SavingsEntrySource` `interest` entry with `monthKey =
  toMonthKey`, `amount = total`, and a note naming the year and rate ("Interest 2026-04 to
  2027-03"). None when the total is 0 (the default rate is 0%).
- **Once only.** A month published again (a replaced import, R18) must not post a second
  entry: key it on supplier + `toMonthKey`, and recompute in place if the month's entries
  changed. `savingsInterestFor` ignores `interest` entries inside the year, so working it out
  again gives the same figure.
- **The rate in force each month.** `annualInterestRate` is one value in `client_config`
  today. Please keep its changes with the month they apply from and pass
  `savingsInterestFor` a function; until there is a history, the rate at posting time is
  used for the whole year, which is right only while nobody changes it mid-year.
- **Imported factories.** If a factory's own system already credits interest on its slips,
  the imported ledger has it and posting ours would pay it twice. Galaboda's slips show no
  interest line today; a factory that does is configured with rate 0 here.
- Audit: an `interest` posting is the system's, under the publishing user's month close.
- The app needs nothing new: the entry is a ledger row and moves the balance it already
  shows.

**Check:** a supplier at 20,000 from March 2026 with the rate at 6%: publishing March 2027
posts one entry of 1,200.00 with `monthKey 2027-03`; publishing March 2027 again posts
nothing new; at 0% nothing is posted.

## 57. Corrections after a published bill (C5)

**Decided:** a balance or a payment found wrong after a bill was published is corrected
**forward** by a manager, with a reason; the published bill is never edited. Built in the
console and the app on 30 October 2026 (hidden in the console by `CORRECTIONS_ON_SERVER` until
you ship it). The rules are shared: please `npm run vendor:pull` (`packages/domain/src/corrections.ts`,
`bill.ts`, `types/app.ts`).

**Endpoints:**

- `GET /admin/suppliers/:id/corrections` (`suppliers: R`) answers `SupplierCorrections`:
  `items` newest first, `publishedMonthKeys` (the months with a published bill for the
  supplier, newest first), `billSource`.
- `POST /admin/suppliers/:id/corrections` (`billing: A`, the manager) with
  `NewSupplierCorrection` `{ target, amount, correctsMonthKey, reason }` answers `201
  SupplierCorrection`. `amount` is signed as the supplier sees it (`payment +` paid too little,
  `loan`/`manure +` owes more, `savings +` holds more). Refusals: `422 correction-invalid` with
  `details.problems` from `correctionProblems` (`amount-zero`, `reason-short` (under 10
  characters), `month-not-published`, `below-zero`, `payment-bills-imported`); `409
  factory-sync-on` while the sync is on. Audit `supplier.correction` with the record as `after`.

**What each target does:**

- `loan`, `manure`: a `CreditTxn` of kind `adjustment` now, with the reason as its note;
  `status: 'applied'`. Under the ledger lock, like opening balances.
- `savings`: a `SavingsEntry` with source `adjustment` in the current Colombo month, with the
  reason as its note; `status: 'applied'`.
- `payment`: your existing `BillAdjustment` table fits it (`correctsMonthKey`, signed
  `amount`, `reason`, `appliedBillId`; `appliesToMonthKey` = the supplier's next unpublished
  month). `status: 'pending'` until the bill carrying it is published, then `applied` with
  `appliedBillId` and `appliedMonthKey`. A supplier with a pending payment correction gets a
  bill in the next run even with no leaf, as for a savings withdrawal.

**On the bill:** `GreenLeafBill.corrections: BillCorrection[] | null` (`{ correctsMonthKey,
amount, reason }`), and `computeBillAmounts({ ..., correction: correctionTotal(lines) })`: it
joins **after** the balance, like `savingsWithdrawal`, so BR-107 holds for the nine lines and
`balanceAmount` stays the slip's figure. Taken back beyond what the month pays, the rest is
`nextMonthDeb`. Re-generating a draft keeps the lines (they are read again from the pending
corrections). The app shows each as "Correction (<month>)" with the reason, on screen and in
the PDF.

**Imported bills:** `payment-bills-imported` refuses a payment correction where
`billSettings.source` is `imported` (the factory's own system pays it on its next slip). A
balance correction is allowed there, and the console warns that the next import puts the
balance back to the slip's figure unless the factory's system makes the same correction.

**Check:** `apps/admin/src/test/corrections.test.tsx` in the console repo, against the mock.
A clerk gets `403`; a loan `+500` moves the balance at once and `-1,000,000,000` is
`below-zero`; a payment `+900` is on the next generated bill (`deductions.total` unchanged) and
`applied` with that bill once the month is published.

## Later

- **Factory sync (Phase 10):** the request to the factory team asks for every line of the
  printed bill (`factory-system-team.md` §3, `factory-updates-sample.json`, bill
  `2026210869`): `greenLeafAmount`, `extraPayment`, `totalRatePerKg`, `loanInstalmentNo`,
  `savingsWithdrawal`, `savings` (This month / Previous / Todate), `billDateTime`, the bill's
  own `paymentMethod`, and `grossAmount` including the coins brought forward. Map them onto
  `BillRow` and store them as received. Switching a factory from records kept here back to
  the sync ("the sync's records replace ours") waits for this too.
- **Past months (A9):** imported as published history, with no balance change and no
  notification.
- **The push sender (FCM/APNs):** a composed notification now arrives with copy in every
  language the office wrote (30 October 2026; your `translations` already store them and the
  inbox already answers by `?lang=`). The sender should pick each device's language the same
  way, its own copy or the fallback (`notificationCopyFor` in `notifications.ts`, after
  `vendor:pull`).

## When you ship one, tell me

The console hides each unfinished feature in one file, `apps/admin/src/lib/serverReady.ts`,
so the office never meets a `404`. When an item above ships, tell me (or change the line in
the same PR) and the feature appears:

| Console feature | Waits for | Line in `serverReady.ts` |
|---|---|---|
| Import → Daily leaf, Monthly rates, Other deductions, Printed slip balances | `POST /admin/imports/{deliveries, monthlyRates, billAdjustments, printedBalances}` | `IMPORT_KINDS_NOT_ON_SERVER` (one entry each; Finished bills is live) |
| "Other deductions" → Edit on a bill | `PUT /admin/bills/:id/adjustment` | `OTHER_DEDUCTIONS_ON_SERVER = false` |
| Rates & month close: "Compare with printed slips", the checklist step, held badges | `slip-comparison`, `printed`, `hold`, `release` | `SLIP_COMPARISON_ON_SERVER = false` |
| Configuration → Features: "Account tab: this month so far" | `GET /bills/month-to-date` | `MONTH_TO_DATE_ON_SERVER = false` |
| Import dialog: which rows are already there, and "import them anyway" for leaf | `dryRun`, `duplicates`, `skipped` | `IMPORT_SKIP_ON_SERVER = false` |

The leaf intake grid and Rates & month close stay visible; they call the leaf and month
endpoints and start working as those land.
