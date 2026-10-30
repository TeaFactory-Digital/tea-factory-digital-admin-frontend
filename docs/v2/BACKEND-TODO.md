# Backend to-do

Only the work still open (30 October 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

| # | What | Priority |
|---|------|----------|
| 50 | Staging is not running the latest commits | Now |
| 45 | Factory records: other deductions next, then the bill engine | High |
| 48 | "This month so far": `GET /bills/month-to-date` | Medium |
| 56 | Savings interest: calculated bills only, with the bill engine (R28 answered) | With #45's bill engine |
| 57 | Corrections after a published bill (C5): `GET`/`POST /admin/suppliers/:id/corrections`, the bill's `corrections` lines | Medium |
| 58 | Each day's collection point on the bill and "This month so far" (`DailySupply.points`) | Small |
| 59 | Records kept five years (Q12): nothing deleted sooner; the job after five years | Small now, the job later |
| 60 | Inquiry states `escalated` and `awaitingSupplier` (Q18) | Small |
| 61 | Who approves credit, by amount (Q6): clerk, manager, owner | Medium |
| 62 | Write off a loan or fertilizer balance, or pay it from savings (Q7) | Small, with #57 |
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
(R15, `671627d`) and a waiting one replaced by sending it again (R18, `76b50f2`); opening
balances with the one cut-over month (`5b58f81`, ADR-039); and **leaf and months** with
importing again (`e4a9f40`, ADR-040). Checked on the console side 30 October: `deliveries` and
`monthlyRates` imports and the import preview are switched on, an exception id is
URL-encoded on resolve, `rate-differs` and the wider `records-busy` have their text, the leaf
calendar offers no day after today, and the mock follows R23 to R26.

1. **Other deductions** (next): `PUT /admin/bills/:id/adjustment` and the `billAdjustments`
   import.
2. **The bill engine** (factory-records §5), last: galaboda imports its bills, so no factory
   needs it yet. With it, **the printed-slip check and hold** (§5, "Comparing with the printed
   slips", steps 1 to 8): `GET /admin/months/:monthKey/slip-comparison`,
   `PUT /admin/bills/:id/printed`, `POST /admin/bills/:id/hold` and `/release`, the
   `printedBalances` import, `409 bills-mismatch` on the publish, the automatic hold of a
   supplier's next bill (`heldForMonth`), and releases in order (`409 earlier-bill-held`).
   You have agreed to relax the month lock for a held supplier's leaf only. Savings interest
   (#56) and payment corrections on the next bill (#57) come with it.

**Your questions R23 to R28 (answered 30 October):**

- **R23 to R26:** as you built them. `missingBankDetails` for bank transfer only; a suspended
  supplier's leaf is taken and named by the month's exceptions; 0 kg, over 5,000 kg and a rate
  of 0 are refused; `rate-differs` with the slips' rate; the outlier against the month's
  average at the weighing's collection point. The console's mock and texts now match.
- **R27** (leaf entered here, then the sync switched on): already decided in factory-records
  §2: the sync's records **replace** ours for the same supplier and day. Phase 10.
- **R28** (interest in a factory that imports its bills): **interest comes from the factory's
  own slips** there; we post none, and the slip's To-date carries it. We post interest only
  for **calculated** bills, so #56 waits for the bill engine. See #56.

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

## 56. Savings interest: credit it once a year

**Scope (R28, answered 30 October 2026):** only for a factory whose bills are **calculated**
here (`billSettings.source: 'calculated'`), posted by the bill engine's publish. Where the
bills are **imported**, the factory's own system pays the interest and the slip's To-date
carries it; post nothing (`savings.annualInterestRate` is then for display only).

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

## 58. Each day's collection point (`DailySupply.points`)

The app and the console now show where a month's leaf went in, under the day grid:
"Weighed at MAKADURA (days: 16), KANDEWATTA (days: 2)." (Q13, 30 October 2026). Please
`npm run vendor:pull`: `DailySupply` (`types/app.ts`) has an optional
`points?: string[] | null`, and `collectionPointDays` in `bill.ts` turns a month's days
into that line.

**What it needs:** on every `dailySupply` you serve (a bill, `GET /bills/current`,
`/bills/:monthKey`, and "This month so far" when #48 lands), each day with leaf carries the
**names** of the collection points its non-voided deliveries were weighed at, sorted, no
duplicates: `{ day: 14, kgs: 42.5, points: ["MAKADURA"] }`. A day with no leaf keeps
`kgs: null` and needs no points. `bill_daily_supply` has no point today: either a
`points text[]` column filled when the bill is generated or imported (from the month's
deliveries), or a join on the deliveries when the bill is read. An imported slip with no
leaf rows behind it sends `null`, and the screens then say nothing about points.

**Nothing breaks without it:** the field is optional, and both screens leave the line out
when no day names a point.

## 59. Records kept five years (Q12)

**Decided 30 October 2026:** the factory keeps its records **five years** after the end of
the month they belong to: bills, payout records, deliveries, the savings and credit
ledgers, credit and tea-packet requests, change requests and inquiries. Shared rule:
`RECORD_RETENTION_YEARS`, `retainedThroughMonthKey(monthKey)` and `isPastRetention` in
`packages/domain/src/retention.ts` (please `vendor:pull`).

**Now:**
- Nothing in that list is deleted before its five years, by any path. An account-deletion
  request (`POST /profile/deletion-request`) removes the app account (sign-in, devices,
  preferences) only; the app already tells the supplier the factory keeps the records for
  five years.
- The audit log is kept at least as long as the records it describes.

**After five years** (answered the same day): a scheduled job, monthly, for records past
`isPastRetention` (Asia/Colombo). For a supplier whose account is **closed**, remove the
personal details (`PERSONAL_FIELDS_REMOVED_AFTER_RETENTION`: name, NIC, telephone,
address, bank account) and keep the figures as the factory's history; delete nothing. A
supplier still supplying keeps everything. The supplier number stays with its records and
is never given to anyone else (Q14).

## 60. Inquiry states: `escalated` and `awaitingSupplier` (Q18)

Decided 30 October 2026. `INQUIRY_STATUSES` is now `open, escalated, awaitingSupplier,
resolved, closed` (your column is TEXT with a CHECK: one row). Rules in `inquiry.ts`:
`isInquiryClosed` (resolved, closed), `inquiryStatusForApp` (the three open ones are
`pending`), `inquiryAwaitsSupplier`, `inquiryCountsTowardsSla` (open and escalated).

- `POST /admin/inquiries/:id/escalate` `{ note }` (10+ characters, `inquiries: A`):
  `escalated`, still answerable; store `escalatedAt`, `escalatedByName`, `escalationNote`
  and serve them on the inquiry; audit `inquiry.escalate`. `409 already-decided` once
  resolved or closed.
- `POST /admin/inquiries/:id/reply` takes `awaitSupplier?: boolean`: when true the status
  is `awaitingSupplier`, not `resolved` (the push still fires: the office wrote to them).
- The supplier's next message on a thread (`POST /inquiries/:id/messages`) moves an
  `awaitingSupplier` inquiry back to `open`.
- The supplier's `Inquiry` gets `awaitingReply: true` while `awaitingSupplier`; the app says
  "waiting for your reply".
- The list filter takes the two new values.

## 61. Who approves credit, by amount (Q6)

Decided 30 October 2026. Per facility in `creditRules` (`creditRules.ts`):
`clerkApprovesUpTo` and `ownerApprovesAbove`, each optional (`null` or absent: that tier is
unused, so a factory that sets neither keeps every decision with the manager).
`approvalTierFor(amount, rule)` gives `clerk | manager | owner`, and `canDecideCredit(grants,
tier)` who may decide it: the clerk tier with `creditRequests: W`, the manager tier with
`creditRequests: A`, the owner tier with `creditAboveThreshold: A`.

- `POST /admin/credit-requests/:id/approve` and `/reject`: let in on `creditRequests: R`,
  then refuse with `403 approval-above-limit` (`details.needs`, `details.amount`) when
  `canDecideCredit` is false. BR-501 (the recorder never decides) still applies.
- The role matrix (`rbac.ts`, `vendor:pull`): `creditAboveThreshold` moves from the
  **manager** to the **factory administrator** (the owner), who also gets `creditRequests:
  R` to see the request. A factory that saved its own matrix keeps it.
- `creditRuleProblems` adds `bad-approval-limits` (negative, or the clerk's above the
  owner's); the config patch already refuses on `creditRuleProblems`.

## 62. Write off, or pay from savings (Q7)

Decided 30 October 2026: the **manager** writes off a loan or fertilizer balance a supplier
will not repay, and may first pay it from the supplier's own savings. Same endpoint as #57
(`POST /admin/suppliers/:id/corrections`), with `kind`:

- `writeOff`: a `CreditTxn` of kind `writeOff` (your enum has it) for `amount` (below 0).
- `fromSavings`: a `SavingsEntry` (`adjustment`, the reason as note) and a `CreditTxn`
  `repayment`, both for `amount`, in one transaction under the ledger lock.
- Refusals from `correctionProblems`: `kind-not-allowed` (not a loan or fertilizer balance,
  or not downwards), `savings-short` (more than the savings hold).
- `SupplierCorrection.kind` is served on the list.

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
