# Backend to-do

Only the work still open (7 November 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

## Next

Two notes on staging, neither yours to build:

- Galaboda's bill source is still unset (`billSettings: null`); the factory sets it to
  "Imported" in the console (Configuration, "Where the bills come from"). Until then
  `billSourceOf` reads it as `calculated` on both sides, so the bills import answers
  `409 wrong-bill-source`.
- `render.yaml` has no `autoDeploy`, so a push that adds a migration goes live before it is
  migrated. Please migrate staging before such a push, or set `autoDeploy: false` and deploy
  by hand.

| # | What | Priority |
|---|------|----------|
| 45 | Factory records: the bill engine next (with #56), then the printed-slip check, hold and release | High |
| 56 | Savings interest: calculated bills only, with the bill engine | With #45's bill engine |
| 65 | A production environment: no production API exists yet | Before the first store release |
| 66 | Universal-link files on each factory's domain: waits for the Play signing SHA-256 and the host | Before the first store release |
| - | Later: factory sync (Phase 10), the push sender, the five-year job (#59), a reporting replica | Later |

## 45. Factory records without the factory system

The office keeps suppliers, daily leaf, monthly rates, bills, opening balances and counter
credit requests in the console while the sync is off. **Contract:** factory-records.md.

**Still to build, in this order:**

1. **The bill engine** (factory-records §5): `POST /admin/months/:monthKey/bills/generate`,
   calculating each bill with `computeBillAmounts` from the shared package. Galaboda imports
   its bills, so no factory needs it yet. Savings interest (#56) and payment corrections on
   the next bill (#57) are worked out inside it.
2. **The printed-slip check and hold** (§5, "Comparing with the printed slips", steps 1 to
   8): `GET /admin/months/:monthKey/slip-comparison`, `PUT /admin/bills/:id/printed`,
   `POST /admin/bills/:id/hold` and `/release`, the `printedBalances` import,
   `409 bills-mismatch` on the publish, the automatic hold of a supplier's next bill
   (`heldForMonth`), and releases in order (`409 earlier-bill-held`). The month lock is
   relaxed for a held supplier's leaf only, as agreed.

**Check:** the list in factory-records §9.

## 56. Savings interest: credit it once a year

**Scope:** only for a factory whose bills are **calculated**
here (`billSettings.source: 'calculated'`), posted by the bill engine's publish. Where the
bills are **imported**, the factory's own system pays the interest and the slip's To-date
carries it; post nothing (`savings.annualInterestRate` is then for display only).

**Decided by the factory:**

- **Simple interest.** A month earns `base × annualInterestRate ÷ 100 ÷ 12`; nothing earned in
  a year earns interest in that year.
- **On the month's lowest balance**: the lower of the balance before the month's ledger
  entries and after them, never below zero. Contributions arrive with the month's bill, after
  the month, so an ordinary month earns on its opening balance; in the month a withdrawal is
  paid, on the balance after it.
- **Credited once a year, in time for the withdrawal month.** The year is the twelve months
  ending the month **before** `savings.withdrawalMonth` (April: April to March), posted with
  that month, so it is in the balance a supplier may take out in April.

The arithmetic is in the shared package (already in your vendored copy):
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

**One link domain per factory** (galaboda:
`app.teafactory.lk`). A notification or a shared link opens the app only if that domain serves:

- `/.well-known/assetlinks.json` for Android (package name and the release signing
  certificate's SHA-256);
- `/.well-known/apple-app-site-association` for iOS (`applinks` with the team ID and bundle
  ID; served as `application/json`, no redirect).

Without them a link opens in the browser instead. Wherever the domain is hosted (with the API
or separately), the two files are part of each factory's setup.

You have the package and bundle ID (`com.teafactorydigital.mobile`) and the Apple team
(`MP32X3M4H8`, to be confirmed as the store account's team). Still missing before you build
the files:

- **The SHA-256 fingerprint:** Google Play's **app signing** key (Play Console → App
  integrity), once the app is there. Release builds are still signed with the debug key.
- **Where `app.teafactory.lk` is hosted:** the factory's decision, not made yet.

On the app side, iOS still needs the Associated Domains entitlement (`applinks:app.teafactory.lk`);
Android's verified intent filter is in.

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
- **The five-year job (#59):** to build before the first records turn five in 2031: a monthly job
  that, for a supplier whose account is **closed**, removes the personal details
  (`PERSONAL_FIELDS_REMOVED_AFTER_RETENTION`: name, NIC, telephone, address, bank account)
  from records past `isPastRetention`, and keeps the figures.
- **A reporting replica (M16):** the reports are single passes over live records. When the
  data grows, point them at a read replica or a nightly copy, so a month close does not
  compete with a report.
- **The push sender (FCM/APNs):** pick each device's language the way the inbox does, its own
  copy or the fallback (`notificationCopyFor` in `notifications.ts`).

## When you ship one, tell me

The console hides each unfinished feature in one file, `apps/admin/src/lib/serverReady.ts`,
so the office never meets a `404`. When an item above ships, tell me (or change the line in
the same PR) and the feature appears:

| Console feature | Waits for | Line in `serverReady.ts` |
|---|---|---|
| Import → Printed slip balances | `POST /admin/imports/printedBalances` | `IMPORT_KINDS_NOT_ON_SERVER` (the other imports are live) |
| Rates & month close: **Generate the bills**; Configuration offers "Calculated in this console" (shown as coming soon, not selectable, until then) | `POST /admin/months/:monthKey/bills/generate` (the bill engine) | `BILL_ENGINE_ON_SERVER = false` |
| Rates & month close: "Compare with printed slips", the checklist step, held badges | `slip-comparison`, `printed`, `hold`, `release` | `SLIP_COMPARISON_ON_SERVER = false` |
