# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (9 October 2026)

**Done and removed from this file: #1 to #44** (latest: #44 in `b93c64f`, the default text
for "Restore default text", read only and never counted as an office edit).

**Still open:**

| # | What | Priority |
|---|------|----------|
| 45 | Factory records without the factory system: the sync switch, entry and imports | High |
| 46 | The console's notification bell: a feed of supplier actions, read per user | Medium |
| 47 | Onboard a new factory with one command | Medium |

**Answers to the last note**
- **FAQ and `{{factory}}`:** right, the FAQ names no factory in any language, so our check
  was wrong; `terms/default?lang=si` is the one to check. Leave the FAQ as it is unless we
  send a new seed file.
- **`eligibility: null`:** the console already shows the request without the eligibility
  panel when it is `null`, so nothing to change on our side.

**No em dashes in what the API writes:** the console and the app no longer use the em
dash anywhere (a value that is not there is shown as `-`). The API still writes `'\u2014'`
for an empty field into change-request summaries
(`apps/api/src/modules/supplier-app/requests.controller.ts:545-550`); please write `'-'`
instead. The console still reads the old character as "empty", so rows already stored keep
working.

**Factory sync (Phase 10), for when it starts:** the request to the factory team now asks
for every line of the printed bill. `factory-system-team.md` §3 and
`factory-updates-sample.json` (bill `2026210869` is a real slip) add `greenLeafAmount`,
`extraPayment`, `totalRatePerKg`, `loanInstalmentNo`, `savingsWithdrawal`, `savings`
(This month / Previous / Todate), `billDateTime` and the bill's own `paymentMethod`, and
say `grossAmount` includes the coins brought forward. Map them onto `BillRow`
(`savingsThisMonth`, `savingsPrevious`, `savingsToDate` already exist; `loanInstalmentNo`
is new) and store them as received.

---

## 45. Factory records without the factory system

A factory whose own system cannot be reached switches the factory-system sync **off**, and
the office keeps suppliers, daily leaf, monthly rates, bills, opening balances and counter
credit requests in the console: one at a time, or from an Excel/CSV file. The console side is
built and tested against the mock.

**The full contract is in [`factory-records.md`](./factory-records.md):** the switch
(`config.factorySync`), the endpoints (the v1 leaf and month endpoints, plus six new ones),
the import format and its all-or-nothing rule, the bill calculation, the role change for the
clerk, and the three new audit actions.

**To do:** build §4 of that file, refuse every record write with `409 factory-sync-on` while
the sync is on, and `vendor:pull` (new `factoryRecords.ts`, `GreenLeafBill.otherCardsNote`,
`RuntimeConfig.factorySync`, clerk `deliveries: W` and `creditRequests: W`).

**Added after the factory's answers (§8 of that file):** transport per collection point
(`DeductionRates.transportByPoint`) and per supplier (`AdminSupplier.transportPerKg`,
`PUT /admin/suppliers/:id/transport-rate`, import kind `transportRates`), and advance
interest in Configuration (`config.advanceInterest`, used for `carryForward.loanInterest`).
`otherCards` is now labelled "Other deductions"; the field name does not change.

**And to match the factory's printed slip (§5):** `computeBillAmounts` now puts the coins
brought forward in `grossAmount` and rounds the payment to `config.billSettings.paymentUnit`
(galaboda pays in tens); the advance is taken back in full by default; bills carry
`loanInstalmentNo`; and `billSettings.nextBillSerial` gives the factory's own bill numbers
(`2026210869`). Check that the API uses the vendored function for every bill it calculates,
so a bill and the app agree to the cent.

**Check:** the list in §9 of that file.

## 46. The console's notification bell: a feed of supplier actions

The console's top bar now has a bell. Its first half is the waiting queues, from the
existing `GET /admin/dashboard`; nothing new is needed for that. Its second half is
**recent activity**: what suppliers did, with a dot on what this console user has not
seen. The console shows "not available on this server yet" while this 404s.

```
GET  /admin/activity?limit=20   → ActivityFeed  { items: ActivityItem[], unread, readUpTo }
POST /admin/activity/read       { upTo: ISO }  → { readUpTo }
```

Types and the permission per kind are in `packages/domain/src/activity.ts` (`vendor:pull`).

- **Supplier actions only**, newest first: `creditRequest.created` / `.cancelled`,
  `teaPacket.created` / `.cancelled`, `changeRequest.created`, `inquiry.created`,
  `inquiry.replied` (a supplier's message after the first), and
  `supplier.appDeletionRequested`. Only requests from the app (`channel: 'app'`); what the
  office did stays in the audit log.
- **Filtered by permission:** each kind needs read on `ACTIVITY_CAPABILITY[kind]`, the
  capability of the screen it opens. A content editor is never told about a loan request.
- **Read per user:** one `readUpTo` timestamp per console user and tenant. An item is
  `unread` when it is later than that mark, or when the user has no mark yet. `unread` counts
  every unread item, not only those in `items`. A mark never moves backwards.
- `limit` 1 to 100, default 20. An event table written in the same transaction as the
  action is the simplest source; deriving it per request from five tables also works at
  this size.
- No audit entry for reading the bell.

**Check:** a supplier sends a loan request in the app; the manager's and the clerk's bells
show it unread; the manager opens and closes the bell; the manager's is read, the clerk's
is still unread; the editor never sees it.

## 47. Onboard a new factory with one command

Adding a factory is data, not code: one API and one console serve every factory, keyed on the
slug. `seedTenant()` in `apps/api/prisma/seed/tenant.ts` already does the work (factory row,
config with every flag written, banks, collection points, the first factory administrator,
default static pages and triggers), but **only `staging.ts` calls it**: there is no way to
run it for a new factory without editing a seed file.

**To do:** a command the platform team runs once per factory, e.g.

```
npm run db:seed:tenant -- --slug hillside --name "Hillside Tea Factory" \
  --telephone 051-2223344 --reg-no "M.F. 2207" --location Hatton \
  --admin-name "S. Jayawardena" --admin-email admin@hillsidetea.lk \
  --points "HATTON:Hatton,DIKOYA:Dikoya"
```

- **Refuse to run without the real factory details.** Today `seedTenant` fills a missing
  telephone, reg. no. and location with `011-0000000`, `MF-0000` and `Sri Lanka`. Those
  print on every supplier's bill and in the app, so for a real factory they must be
  required, not defaulted. Keep the defaults for tests only.
- **Slug:** lower-case letters and digits, checked unique; it becomes the subdomain
  (`hillside.admin.<domain>`) and the `X-Tenant` value, and it never changes.
- **Admin password:** generated, printed once, and the account marked "must change at first
  sign-in", as staging does; never taken on the command line.
- **Idempotent:** running it again for the same slug updates nothing that the factory has
  since changed in the console (only fills what is missing).
- Print what is left to do by hand: the DNS record, `CORS_ORIGINS`, and the mobile build
  (`docs/v2/new-factory.md` in the console repo).

**Check:** run it for a test slug on staging; the new console subdomain signs in as the new
administrator, `GET /config` with `X-Tenant: <slug>` answers that factory, and galaboda's
data is not visible from it.

