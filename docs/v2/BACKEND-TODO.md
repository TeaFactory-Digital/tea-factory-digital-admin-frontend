# Backend to-do

Only the work still open (18 November 2026). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

## Next

#45 is built and its T15 answers are in (1e5401b): held months take leaf for any past day,
month to date skips held bills, and `loanRecovery` clears a loan. Staging deploys by hand
after migrating (`autoDeploy: false`); galaboda's bill source is "Imported".

| # | What | Priority |
|---|------|----------|
| T16 | The loan instalment number (your question on 1e5401b): two small fixes (below) | **Next** |
| 65 | A production environment | **On hold** (your note, 12 November): until there are real clients; staging is the only environment |
| 66 | Universal-link files on each factory's domain: waits for the Play signing SHA-256 and the host | Before the first store release |
| - | Later: factory sync (Phase 10), the push sender, the five-year job (#59), a reporting replica | Later |

## T16. The loan instalment number (answered 18 November)

1. **A bill that repays none of the loan has no number.** A bill that only takes interest
   carried after the loan is repaid is not an instalment: `loanInstalmentNo` is `null`, so
   a 10-month plan never prints "Loans / Advance 11". Number a bill only when its
   `principalRepaid` is above 0.
2. **A bill without leaf is skipped, not a break.** A bill that only pays a withdrawal or a
   correction neither counts nor restarts the count: the next bill with an instalment
   carries on from the last number. Only a bill **with** leaf and no instalment ends the
   run (a new loan then starts at 1).

The console's mock does both now, and also passes the plan's instalment uncapped by the
balance, as yours does (an overpaid loan counts as 0). factory-records §5 has the rules.

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
