# Backend to-do

Only the work still open (25 November 2026; 0a41c14 built the loan plan fix and T19.1). Finished work is taken out; git history keeps it.
The rules for every item are in [`factory-records.md`](./factory-records.md) (the console)
and `packages/domain` (please `vendor:pull` after each console change).

## Next

#45 is complete, with every follow-up answered and built: T15 (1e5401b), the loan instalment
number (fb687f7) and the printed number read on an imported slip without leaf (29824a0). The
console's mock carries the number on the same way. Staging is migrated through
`20261112020000`; galaboda's bill source is "Imported".

| # | What | Priority |
|---|------|----------|
| End-to-end | Done on staging at d302207 (25 November 2026), galaboda switched to Calculated with your agreement: zero opening balances as at 2026-11 for 5708 and 5709 (cut-over 2026-11), generate (2 bills, GL/2026-11/0001 and 0002, 400 kg at 208.50, payable 80,750, all arithmetic checked), the slip comparison (missing, match, a Rs. 5 mismatch), hold, release refused while mismatched (`bill-still-mismatched`), corrected and released. The loan case, run and then put back (2% `withinInstalment`; 5708 a 15,000 loan with 3 months left and 2 paid, 5709 500,000 over 10): 5709 deducted 8,340 (20% of the gross), carried 1,660 of the 10,000 interest and printed no instalment number, all as expected; 5708 printed **instalment 3** and 300 interest, but see "Loan plan before the cut-over". Not published: the month has not ended (`month-not-ended` comes first for a calculated month), and two pending change requests of 5708 (23 November) are open exceptions. Galaboda stays on Calculated, with both bills generated and matched, until 2026-11 is published | Publish from 1 December |
| T20.3 | Built in backend 017b709 (25 November 2026): an opening loan above 0 beside a loan approved from the cut-over month on is refused (`409 loan-approved-in-month`, `details.asOfMonth`; on an import row, `loan`). The full integration suite passes locally (46 files, 619 tests), and the two new tests in frontend-gaps-17 fail against 0a41c14. T20.2 needs no change: the loan cap alone is kept. The console maps the code (en/si/ta) and its mock refuses the same way | Deploy to staging (your side) |
| 65 | A production environment | **On hold** (your note, 12 November): until there are real clients; staging is the only environment |
| 66 | Universal-link files on each factory's domain: waits for the Play signing SHA-256 and the host | Before the first store release |
| - | Later: factory sync (Phase 10), the push sender, the five-year job (#59), a reporting replica | Later |

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
