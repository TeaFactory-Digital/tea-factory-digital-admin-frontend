# Backend to-do

Only the work still open (17 November 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

## Next

#45 is built: the bill engine (221a1c0), the carried interest and repaid manure plans
(52afb75) and the printed-slip check, hold and release (e164e2f). The console has
`SLIP_COMPARISON_ON_SERVER` on and the `printedBalances` import offered. Staging deploys by
hand after migrating (`autoDeploy: false`); galaboda's bill source is "Imported".

| # | What | Priority |
|---|------|----------|
| T15 | Answers to your T15 questions: two small changes (below) | **Next** |
| 65 | A production environment | **On hold** (your note, 12 November): until there are real clients; staging is the only environment |
| 66 | Universal-link files on each factory's domain: waits for the Play signing SHA-256 and the host | Before the first store release |
| - | Later: factory sync (Phase 10), the push sender, the five-year job (#59), a reporting replica | Later |

## T15. Your questions on commit B (answered 17 November)

**Please `vendor:pull`** first: the shared package changed for two of them.

1. **A held supplier's month has no 30-day limit** (T15.8, the factory's decision). Leaf for a
   supplier whose bill for that month is held may be entered for any day of the month,
   however long ago: `leafDateProblem(date, today, { held: true })` no longer answers
   `too-old`. A day after today is still refused. Please pass `held` on `POST
   /admin/deliveries` (every row's supplier held in that month) and on the `deliveries`
   import row by row. The console's leaf screen now names the held suppliers on a
   published day and offers them the grid and Void.
2. **Month to date moves on** (T15.9, the factory's decision). A **held** bill no longer
   keeps `GET /bills/month-to-date` on its month: the month is the supplier's oldest month
   with an **unpublished** bill (held ones skipped), else the month after the factory's
   newest published month. The held month just has no bill ("No bill is available yet")
   until it is released. The `MonthToDate` comment in `types/app.ts` says so (vendor:pull).
3. **`loanRecovery` clears a loan** (T15.10 and the T14.5 follow-up, changed in the shared
   package): under `withinInstalment` the instalment is now capped at what is owed **plus
   the interest due**, so the last instalment ends the loan (Rs. 1,000 at 1% deducts 1,010
   and repays all 1,000). Interest still carried after the principal is repaid is taken on
   the next bill, within the planned instalment (`loanRecovery(0, plan, setting, carried)`
   deducts it). So keep calling it while either the loan or the carried interest is above 0.
   `onTop` is unchanged.
4. **T15.7, a held bill kept on recalculation with no leaf left:** agreed, keep it. It
   charges nothing (a month without leaf), and it stays open so the leaf can be entered.
5. **T15.11, `MonthSummary.open` false with held bills:** fine. The close screen opens a held
   row by `row.held` and shows release by `counts.held`, never by `open`.
6. **T15.2 to T15.6:** the console and its mock now match: whole rupees on the printed
   figure (`decimals: 0` on `printedBalances.finalBalance`, `whole-rupees` on the form),
   `factory-sync-on` before `wrong-bill-source` on every slip route, a stale release with
   `suppliers`/`count`/`reason: figures`, and `AdminBill.loanInterestCarried` in the type.

## 65. A production environment

**On hold** until there are real clients (your note, 12 November 2026). There is no
production API: only staging, a free instance that sleeps. The app's release build carries a placeholder origin
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
so the office never meets a `404`. Since e164e2f every line there is on and no import kind
is held back. When a new endpoint ships, tell me (or change the line in the same PR).
