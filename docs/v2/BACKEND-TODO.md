# Backend to-do

Only the work still open (6 November 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

## Must do first

**#50, deploy staging.** Checked again on **6 November 2026** (read only): `GET /config` for
galaboda still answers `factorySync: null`, so staging has none of the work since
23 October. Nine migrations are waiting, in order: `20261023010000` (month to date flag,
optional bank codes), `20261024010000` (factory sync defaults off), `20261026010000`
(imported bills), `20261028010000` (opening balances), `20261029010000` (leaf and months),
`20261031010000` (daily supply points), `20261031020000` (inquiry states),
`20261031030000` (corrections and retention), `20261105010000` (inquiry awaiting from).
Run them in order from `apps/api`, with the `datasource` line checked first, then deploy
`main` (now `8e5597c`, which includes #64) and set galaboda's bill source to "Imported".
Until then, nothing built since 23 October (imports, opening balances, leaf and months,
corrections, credit tiers, inquiry states, "This month so far", the day's collection
points, the 30-day leaf rule, the 250 kg check) can be tried against a real server.

| # | What | Priority |
|---|------|----------|
| 50 | Staging is not running the latest commits (above) | **Must, first** |
| 45 | Factory records: other deductions next, then the bill engine | High |
| 56 | Savings interest: calculated bills only, with the bill engine (R28 answered) | With #45's bill engine |
| 65 | A production environment: no production API exists yet | Before the first store release |
| 66 | Universal-link files on each factory's domain | Before the first store release |
| - | Later: factory sync (Phase 10), the push sender, the five-year job (#59), a reporting replica | Later |

## 50. Staging is not running the latest commits

**In progress on your side** (your note of 27 October). Still not deployed on 6 November 2026:
see **Must do first** above for the nine migrations. Once `GET /config` answers
`factorySync: { enabled: false }`, tell me, and the bills import, publish, corrections and
the new inquiry states get tried against it.

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


## 65. A production environment

There is **no production API yet** (6 November 2026): only staging, a free instance that
sleeps. The app's release build carries a placeholder origin
(`https://production-api-not-set.invalid/v1`) and **refuses to start** on it, so no store
build can ship until this exists.

- A production deployment of the API with its own database, the migrations applied, and the
  factory's tenant (galaboda) seeded as staging is.
- Always on (no sleeping): the app's budget is **15 s** per request, against staging's 45 s.
- Its origin (`https://<host>/v1`) to me: it goes in the app's client config (`api.baseUrl`)
  and the console's production `VITE_API_BASE_URL` on Vercel.
- Backups and the five-year record list (#59) apply from the first day.

## 66. Universal-link files on each factory's domain

Decided 30 October 2026 (Q31): **one link domain per factory** (galaboda:
`app.teafactory.lk`). A notification or a shared link opens the app only if that domain serves:

- `/.well-known/assetlinks.json` for Android (package name and the release signing
  certificate's SHA-256);
- `/.well-known/apple-app-site-association` for iOS (`applinks` with the team ID and bundle
  ID; served as `application/json`, no redirect).

Without them a link opens in the browser instead. Wherever the domain is hosted (with the API
or separately), the two files are part of each factory's setup. I will send the package
name, bundle ID and certificate fingerprints when the store accounts exist.

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
- **The five-year job (#59):** nothing on the record list is deleted (`REVOKE DELETE`, done in
  `20261031030000`). Still to build, before the first records turn five in 2031: a monthly job
  that, for a supplier whose account is **closed**, removes the personal details
  (`PERSONAL_FIELDS_REMOVED_AFTER_RETENTION`: name, NIC, telephone, address, bank account)
  from records past `isPastRetention`, and keeps the figures.
- **A reporting replica (M16):** the reports are single passes over live records. When the
  data grows, point them at a read replica or a nightly copy, so a month close does not
  compete with a report.
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
| Import → Other deductions, Printed slip balances | `POST /admin/imports/{billAdjustments, printedBalances}` | `IMPORT_KINDS_NOT_ON_SERVER` (one entry each; the other imports are live) |
| "Other deductions" → Edit on a bill | `PUT /admin/bills/:id/adjustment` | `OTHER_DEDUCTIONS_ON_SERVER = false` |
| Rates & month close: "Compare with printed slips", the checklist step, held badges | `slip-comparison`, `printed`, `hold`, `release` | `SLIP_COMPARISON_ON_SERVER = false` |

The leaf intake grid and Rates & month close are live (`e4a9f40`); only the rows above are
still hidden.
