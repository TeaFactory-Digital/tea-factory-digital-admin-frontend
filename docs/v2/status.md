# Status

**As of 26 October 2026.** What is built, module by module, what the backend has, what the
console hides until the backend ships, and what is still open. Read this before planning
the next slice.

**Anything marked a gap is exactly that.** Nothing here is quietly assumed to be solved.

---

## Where things stand

| | |
| --- | --- |
| **Console** | Every module in [Modules](#modules) is built and routed, in both modes: factory-system sync **on** (the console manages the app) and **off** (the office also keeps the factory's records: Leaf intake, Rates & month close, Add supplier, opening balances, transport rate, walk-in credit requests, other deductions, bills imported or calculated, and an Excel/CSV import for each) |
| **Backend** | `tea-factory-digital-backend`, shipped up to `5b58f81`; staging is not yet running `068faf3` or later (BACKEND-TODO #50, being deployed). BACKEND-TODO **#1 to #44, #46, #47, #49 and #51 to #53 are done**, and **#54** is built with one more copy to make; **#45** (factory records without the factory system) is partly done (the bills import with the month reads and publish, late bills included, and opening balances, `5b58f81`, are live; leaf and months are next); **#48**, **#50**, **#55**, **#56** (savings interest) and **#57** (corrections) are open. See [BACKEND-TODO.md](./BACKEND-TODO.md) |
| **How the console runs** | Against the real API at `VITE_API_BASE_URL` (local on `:3000`, or staging). There is no in-browser mock any more |
| **How the console is tested** | Vitest against the MSW mock in `services/mocks/handlers.ts`, which implements every endpoint the console calls, including the ones the backend has not built: **588 tests in 80 files**. Playwright: **29 tests in 7 specs**, the real console on its own dev server (port 5274) with every `/v1/**` call answered in Node by the same handlers (`e2e/fixtures.ts`). Typecheck and lint clean |

### Built against the mock and tested

Everything in [factory-records.md](./factory-records.md) §3 and §4 is built in the console
and implemented by the mock with the same rules the API must keep:

- The **Factory system** switch, with `409 sync-switch-blocked` naming the months.
- **Add supplier** and the `suppliers` import; supplier identity is the bare number,
  unique per factory.
- **Opening balances** (one cut-over month, locked once a bill of ours is published; live
  on the backend since `5b58f81`, with `cut-over-month` and `withdrawal-pending`) and their
  import.
- **Transport rate** per supplier and per collection point.
- **Leaf intake** (session grid, void with a reason) and the `deliveries` import.
- **Rates & month close**: the rate card, exceptions, deduction rates (four-eyes), the
  publish with its ordered refusals, and the `monthlyRates` import. With no months yet it
  shows an empty state with the Import menu (the bills import creates the month).
- **Bills, one way per factory**: `imported` (Import → Finished bills, stored as printed,
  each row checked to add up to the cent, `leafDifferences` shown in the import dialog; the
  close checklist skips the leaf and exceptions steps, warns an importer they cannot publish,
  lists `approval-missing` problems in the publish dialog, and offers **Publish the late
  bills** when a late division file's bills wait) or `calculated` (`computeBillAmounts`, the
  galaboda July 2026 slip reproduced to the cent, payment rounded to `paymentUnit`, bill
  numbers from `nextBillSerial`, the printed-slip comparison with hold and release, the
  next month's bill held automatically and released in order).
- **Importing a file again** (`dryRun`, `duplicates`, `skipped`): leaf matched on date,
  supplier, kilos and point by count; an existing supplier code skipped. Supplier codes
  match the exact bare number, then the digits without leading zeros only when exactly one
  supplier fits (`ambiguous-supplier` otherwise).
- **Other deductions** on a calculated bill, with a reason, kept across a re-generation.
- **Walk-in credit requests** and their import; four-eyes on the decision.
- **Loan interest** (`onTop` or `withinInstalment`) and **advance interest**.
- The credit rules: an advance is deducted in full in its month (default advance cap
  **100%**); an open loan blocks a new loan and an advance (`loan-outstanding`).
- The **notification bell** with the supplier activity feed, read per user.
- The **factory-system reminder** in every approval dialog (credit, tea packets, change
  requests): the office must also enter the record in the factory's own system.
- The app flag **`enableMonthToDate`** (fifteen flags in all) in Configuration → Features,
  for the app's "This month so far", which reads `GET /bills/month-to-date` (BACKEND-TODO
  #48; the flag stays hidden until then).
- Every new error code and import problem explained in en/si/ta.

### Done on the backend

Shipped by the backend up to `5b58f81` (BACKEND-TODO.md now lists only what is open): opening
balances with the one cut-over month (`5b58f81`, ADR-039: `cut-over-month`,
`withdrawal-pending`, the ledgers moved by differences, the bills import holding the first
bills to the cut-over month); the default pages copied from `static-pages.seed.json` with a
drift check and `npm run vendor:pages` (`41221c0`); `factorySync`,
`advanceInterest` and `billSettings` (including `source`) in config, and `loanInterest`
with its `recovery`; `factorySync` stored as `{ enabled: false }` by default, absent or
`null` read as off (`068faf3`, migration `20261024010000`); the factory administrator's
`R` on `deliveries`, `ratesAndMonthClose` and `billing` (`068faf3`); the finished-bills
import with `GET /admin/months`, `GET /admin/months/:monthKey` and
`POST /admin/months/:monthKey/publish` (`12eea12`); a late division file's bills waiting
for a manager (`671627d`) and a waiting one replaced by sending it again (R18, `76b50f2`,
which also moved the backend's doc links to the merged docs and re-vendored
`@tfd/domain`); `409 factory-sync-on` on every record
write; `transportByPoint`; deduction rates gated on `ratesAndMonthClose`;
`PUT /admin/suppliers/:id/transport-rate`; loan interest; `409 sync-switch-blocked`; the
bell's activity feed, its read mark and flags; supplier identity by the bare number;
`POST /admin/suppliers`; walk-ins (`POST /admin/credit-requests`); the `suppliers`,
`transportRates` and `walkInCredit` imports; approval refusing `supplier-suspended`,
`supplier-closed` and `advance-outstanding`. Earlier items (#1 to #44) include the whole
app-management surface: queues, content, notifications, configuration, users, audit and
reports.

### Hidden in the console until the backend ships it

`apps/admin/src/lib/serverReady.ts`, one line each; remove a line the day its endpoint
ships:

| Console feature | Waits for |
| --- | --- |
| Import → Daily leaf, Monthly rates, Other deductions, Printed slip balances | `POST /admin/imports/{deliveries, monthlyRates, billAdjustments, printedBalances}` (`IMPORT_KINDS_NOT_ON_SERVER`; Finished bills is live since `12eea12`) |
| Other deductions → Edit on a bill | `PUT /admin/bills/:id/adjustment` (`OTHER_DEDUCTIONS_ON_SERVER`) |
| Rates & month close: "Compare with printed slips", the checklist step, held badges | `GET .../slip-comparison`, `PUT /admin/bills/:id/printed`, `POST /admin/bills/:id/hold`, `/release` (`SLIP_COMPARISON_ON_SERVER`) |
| Configuration → Features: "Account tab: this month so far" | `GET /bills/month-to-date` (`MONTH_TO_DATE_ON_SERVER`) |
| Import dialog: the preview of rows already there, "import them anyway" for leaf | `dryRun`, `duplicates`, `skipped` on `POST /admin/imports/:kind` (`IMPORT_SKIP_ON_SERVER`) |

The Leaf intake grid and Rates & month close stay visible. On Rates & month close the
month list, the finished-bills import, the checklist and the publish work against the API
for imported months (`12eea12`); entering a rate, the exceptions queue (not shown for an
imported month, which has none) and the leaf calls start working as those endpoints land. Still to come on the backend, in order: leaf
and months (next), other deductions, then the bill
engine with the printed-slip check (no factory needs it yet: galaboda imports its bills).
"Where the bills come from" and "How the loan interest is taken" shipped in `970be6f`, so
the console shows and sends both.

---

## Modules

The module map as built: what this console contains, what each module decides, and which
screens exist only while the office keeps the factory's records here. Scope and rationale
for the original seventeen are in the mobile repo's `docs/domain-logic.md` §18.1; the v1 state
against them is in git history under `docs/v1/`.

`NAVIGATION` in `apps/admin/src/layout/navigation.ts` is the machine-readable version of
this table; it carries each row's capability, feature flag, queue badge and whether it is a
**factory record** (shown only with the sync off), and the sidebar and the search menu are
generated from it. `routes/router.tsx` applies the same gates to the URL.

### The module map

| # | Module | Shown | Route |
| --- | --- | --- | --- |
| M1 | **Dashboard** | Always | `/` |
| M2 | **Suppliers** (Add supplier, opening balances and transport rate with the sync off) | Always | `/suppliers`, `/suppliers/:id` |
| M3 | **Leaf intake** | **Sync off** | `/deliveries` |
| M4 | **Rates & month close** (deduction rates, bill run) | **Sync off** | `/rates` |
| M5 | **Bills** | Always | `/bills`, `/bills/:id` |
| M7 | **Credit queues** (walk-in requests with the sync off) | Any of `enableAdvances`, `enableLoans`, `enableManure` | `/credit`, `/credit/:id` |
| M9 | **Change requests** | Always | `/change-requests`, `/change-requests/:id` |
| M10 | **Inquiries** | `enableInquiry` | `/inquiries`, `/inquiries/:id` |
| M11 | **News** | `enableNews` | `/news`, `/news/:id` |
| M11 | **Promo banners** | `enablePromoBanner` | `/banners`, `/banners/:id` |
| M12 | **Static content** | Always | `/content` |
| M13 | **Notifications** | `enablePushNotifications` | `/notifications` |
| M14 | **Configuration**, eleven sections | Always | `/configuration` |
| M15 | **Users & roles** | Always | `/users` |
| M16 | **Reports**: app use, credit and tea packets, savings | Always | `/reports` |
| M17 | **Audit log** | Always | `/audit` |
| M18 | **Tea packets** | `enableTeaPackets` | `/tea-packets` |

"Always" still means the user's role must allow it (`RequireCapability`). Outside the
sidebar: the **notification bell** and the **search menu** (Ctrl+K) in the top bar, the
**sync status chip** and `/data-status` (where the figures come from), and `/profile` (the
reader's own account, appearance and text size).

The sidebar sections are Overview (M1, M2), Queues (M9, M7, M18, M10), Support (M5),
**Factory records** (M3, M4; sync off only), Content (M11, banners, M12, M13) and
Administration (M16, M17, M14, M15).

### Two modes: the factory-system sync

**Sync on.** Suppliers, leaf, rates, bills and balances arrive from the
factory's own system by the hourly sync. The console manages the app: queues, content,
notifications, configuration, users and audit, plus a read-only view of the bills so a
clerk can see the account a supplier is telephoning about. The Factory records section is
not in the sidebar, `/deliveries` and `/rates` say the records come from the factory
system, and the API refuses every record write with `409 factory-sync-on`.

**Sync off (the default).** For a factory whose system cannot be connected (it still runs, and every approval is also entered there by the office), the office keeps the records the
app needs **here**: suppliers, opening balances, transport rate per supplier, daily leaf,
the monthly rate and month close, bills, walk-in credit requests and other deductions.
Every record can be entered one at a time or imported from an Excel (`.xlsx`) or CSV file
(`ImportMenu` and `ImportDialog`: check every row first, then the server saves **all rows
or none**). The full contract is [factory-records.md](./factory-records.md).

The switch is Configuration → **Factory system** (`config.factorySync.enabled`, read only
through `isFactorySyncEnabled`; in the console `useKeepsFactoryRecords()`). Absent or
`null` is off, and the backend stores `{ enabled: false }` for every factory. One source at a
time: switching is refused while a month has generated but unpublished bills
(`409 sync-switch-blocked`).

**Bills with the sync off, one way per factory** (Configuration → **Bill calculation** →
"Where the bills come from", `billSettings.source`, read through `billSourceOf`):

| `source` | The bills | On Rates & month close |
| --- | --- | --- |
| `imported` | The factory's own system prints them; the office imports the finished bills and the console stores them **exactly as printed**. They must equal the factory's final figures (galaboda) | Import → Finished bills, then review and publish |
| `calculated` (default) | Worked out here from the leaf, the month's rate and the approved deduction rates by `computeBillAmounts` (`packages/domain/src/bill.ts`) | Generate bills (`BillRunCard`), review, type other deductions, publish |

**Features the backend has not built yet are hidden in one place**,
`apps/admin/src/lib/serverReady.ts`, and listed
[above](#hidden-in-the-console-until-the-backend-ships-it) and in
[BACKEND-TODO.md](./BACKEND-TODO.md).

### M1 Dashboard

*The app at a glance.* One request: `GET /admin/dashboard`. It greets the user by their full
name.

| Area | What it shows |
| --- | --- |
| **Headline tiles** | Waiting, on the app, requests from the app, devices |
| **Queue cards** | Pending count per queue, the age of the **oldest** item, and a count past the §14.4 target. A queue of three sitting four days is worse than twenty from this morning |
| **App adoption** | Suppliers signed in against the total, devices registered, and this month's app-request share. §19.3 calls app adoption and channel shift *"the two KPIs that justify the project"* |
| **Content** | Banners live now, plus what is quietly wrong: published articles falling back, banners whose window has closed, fixed pages nobody has written |
| **Alerts** | Server-composed, as an i18n key + params |
| **Adoption trend** | Twelve months of app-request share, oldest first |

**Every figure on the content card is a silent failure.** A supplier reading a Sinhala
article in English, an FAQ page that is still the default, a banner whose window closed on
Tuesday; none of them produce an error anywhere, and only a screen that goes looking will
find them.

**The trend is monthly, not daily.** Adoption moves when the office hands out passwords at
the counter. A month with no requests carries `null` and **breaks the line** rather than
dropping it to zero (BR-102, as a chart).

The **shell** owns this query, not the screen, because the sidebar's queue badges and the
bell need the same numbers. A queue whose feature flag is off is **absent**, not zero.

`cycle`, `today` and `intakeTrend` are still on the payload; no card reads them now.
`cycle.awaitingRate` is *why the app is showing a supplier blanks instead of amounts*.

### The top bar: notification bell, search, sync status

- **Notification bell** (`layout/NotificationBell.tsx`). Two halves. **Waiting for you**:
  the queues from the dashboard summary, oldest-overdue first, each a link. **Recent
  activity**: what suppliers just did (a credit or tea-packet request sent or cancelled, an
  inquiry reply, an account-deletion request; `packages/domain/src/activity.ts`), from
  `GET /admin/activity`, newest first, with a dot on what this user has not read. Closing
  the bell marks it read **for this user only** (`POST /admin/activity/read`). Kinds whose
  feature flag is off are not shown (`ACTIVITY_FLAG`). Supplier actions only: what the
  office did is the audit log's. The badge counts unread activity; while the server has no
  feed it counts what is waiting instead.
- **Search menu** (`layout/CommandMenu.tsx`, Ctrl+K or ⌘K): a supplier by code or name, or
  a page by its name, filtered the way the sidebar is.
- **Sync status chip** (`layout/SyncStatusChip.tsx`): shown only while the figures are not
  current (behind, never synced, or "Sync status unknown" when the status call itself
  fails), linking to `/data-status`. Not shown with the sync off: there is nothing to be
  behind.

### M2 Suppliers

*The app account, and everything support needs to answer a telephone call.*

- **`hasApp` is the first column.** Three states, not two: signed in with a device
  registered, signed in with none (a supplier who will never see a `billPublished` push),
  and never installed. **`?hasApp=false` is the working filter**, and the dashboard's
  adoption card links straight into it.
- **Every value shown is the active one** (AC-01); a pending change appears as pending,
  never as applied.
- **The audited bank reveal**: a reason is required, the clerk is told it is recorded
  before they ask, the audit id is shown back, and the revealed number is never cached.
- **Resetting the app password**: §21.15/§21.16 as the factory answered them. The password
  is one-time (`owesPasswordChange`, and the app forces the change at first sign-in), how
  identity was checked is recorded, and existing sessions end. See
  `packages/domain/src/supplierCredentials.ts`.
- **CSV export** of the grid as filtered.

The detail page has six tabs: Overview, Money, Requests, Income, Notifications and
Activity.

#### With the sync off: Add supplier, opening balances, transport rate

| Where | What | Permission |
| --- | --- | --- |
| Suppliers → **Add supplier** (`AddSupplierDialog`) | The factory's own supplier code (letters and digits, optional `(division)`; the bare number is the identity, unique per factory), name, collection point, payment method, bank details. A new supplier has no app account until the office issues a password | `suppliers: W` |
| Suppliers → **Import** | Suppliers, opening balances, transport rates, from a file. Importing suppliers again skips a code already on the roll once `IMPORT_SKIP_ON_SERVER` is on | `suppliers: W` |
| Supplier → Money → **Opening balances** (`OpeningBalancesCard`) | Advance, loan, manure, tea packets, savings and previous debt as of one cut-over month for the whole factory (not in the future, the factory's first month with bills of ours); locked once a bill of ours is published for the supplier. Live since backend `5b58f81` | `suppliers: W` |
| Supplier → Money → **Transport rate** (`TransportRateCard`) | The supplier's own rate per kg, or back to their collection point's, with a note | `suppliers: W` |

With the sync on, suppliers arrive from the factory's system and none of these are shown.

#### Month history: graph, list and deductions

**The screen a clerk needs while the supplier is talking.** `supplierId` is on `BillQuery`,
and `GET /admin/suppliers/{id}/income` serves the series. **The three views are the app's
three views, in the app's order**:

| View | What it answers |
| --- | --- |
| **Graph** | A bar per month, switchable between earnings and kilos, which is what makes *"I delivered more and got less"* visible rather than arguable |
| **List** | The months, newest first, each opening the slip the supplier is holding |
| **Deductions** | A donut of one month's nine lines: the gross was fine and something came off it |

- **`null` is not `0`** (BR-102). The graph omits an unsettled month in earnings mode, and
  the list shows a pending badge.
- **The deduction labels are M5's**, not a second set, so the donut and the slip name a line
  identically.

#### Notifications: why a push does or does not reach *this* supplier

One line per category, and when it does not reach, which reason it is:

| Reason | What the office does |
| --- | --- |
| No device at all | Help them install it |
| The factory does not send this category | M14. Not the supplier's doing |
| Every device opted out | Their setting, on their phone |
| Reachable, and nothing was sent | The send log below it |

**No push token anywhere on the payload.** It is a credential, and nothing in the office can
act on one.

#### Every queue this supplier can be in

The Requests tab links into all four queues filtered to the supplier, unconditionally:
*"nothing outstanding"* is an answer a clerk needs. Each is gated on the same flag as its
sidebar row.

### M3 Leaf intake (sync off)

*One day at one collection point.* Sidebar: Factory records → **Leaf intake**.

- The date and the point are the primary controls and live in the URL, so "look at Makadura
  yesterday" is a link.
- **Open** month: the session grid is offered for entry (`EntrySession`). **Locked**
  (published) month: no grid at all (BR-108). **Read-only user**: the day and its rows, no
  grid.
- A weighing can be voided with a reason (`VoidDeliveryDialog`); the row stays, marked.
- **Import from file**: a day's or a month's weighings at once (kind `deliveries`). Hidden
  until the backend ships the import. Importing again skips a weighing already recorded
  (same date, supplier, kilos and point, matched by count), with "import them anyway" for a
  real second weighing (`IMPORT_SKIP_ON_SERVER`).
- Permission `deliveries: W`, which the clerk now holds.

### M4 Rates & month close (sync off)

*The month's rate, what stops the close, and the bills.* Sidebar: Factory records →
**Rates & month close**. The month lives in the URL.

| Card | What it does | Permission |
| --- | --- | --- |
| **Rate card** | Enter the month's rate per kg (and extra rate) | `ratesAndMonthClose: W` |
| **Close checklist** | What still blocks the close, and **Publish** (four-eyes: not the person who entered the rate or imported a bill; that person is warned instead of offered the button). For imported bills the leaf and exceptions steps are skipped. A refused publish's `approval-missing` problems are listed in the dialog. On a published month with late bills: "N bills from a late file are waiting" and **Publish the late bills** | `ratesAndMonthClose: A` |
| **Exceptions queue** | The month's exceptions, each resolved with a note | `ratesAndMonthClose: W` |
| **Deduction rates** | Transport per kg (factory-wide **and per collection point**), stamps, instalment caps. Proposed by one person, approved by another, because a change re-prices every account | `ratesAndMonthClose: W` propose, `A` approve |
| **Bill run** (`BillRunCard`, calculated bills only) | Generate the month's bills, then **Review this month's bills** on M5 | `billing: W` |
| **Compare with printed slips** (`SlipComparisonCard`, calculated bills only) | Each bill's Balance against the printed slip; **Enter printed**, **Hold** (a reason), **Release**. A held bill stays out of the publish; the supplier's next month's bill is held automatically and released after it. **Hidden until the backend ships it** (`SLIP_COMPARISON_ON_SERVER`) | `billing: W` (enter, hold) / `ratesAndMonthClose: A` (release) |
| **Import** | Monthly rates; Finished bills (imported) or Other deductions and Printed slip balances (calculated) | `ratesAndMonthClose: W` / `billing: W` |

With **no months yet** (a new importing factory) the screen shows an empty state with the
Import menu: the import creates the month. The publish refuses, in order,
`already-published`, `earlier-month-unpublished`, `rate-missing`, `exceptions-open`,
`bills-missing`, `bills-stale`, `bills-mismatch`, `approval-missing` and
`four-eyes-violation` (api-contract §10.5). Publishing makes the bills visible in the app
and fires `billPublished`. Generating in an importing factory is `409 wrong-bill-source`.

### M5 Bills

*The account the supplier is looking at on their phone.*

What a supplier can ask about: the nine deduction lines including the zeros, the coins
brought and carried forward, `nextMonthDeb` on an account that owes more than it earned,
and three lenses (*nothing payable*, *payable with no bank details*, *lines that do not add
up*). The arithmetic is `packages/domain/src/bill.ts`, shared: AC-03 requires this screen,
the printed slip and the app to agree field for field. The slip reads like the factory's
printed one: coins brought forward are part of the gross, the payment is rounded down to
the factory's unit (`billSettings.paymentUnit`, 1, 5 or 10) and the rest is Coins C/F; the
`otherCards` line is **"Other deductions"** with its reason; the loan line carries its
instalment number; "Loan Balance" is the loan still owed and "Loan Interest" is this
month's charge.

- **Sync on**: read-only. Generating and publishing are the factory system's.
- **Sync off**: this is where the office reviews the month's bills before publishing them
  on M4. An imported bill is badged **Imported** and never edited here (a correction is made
  in the factory's system and the month re-imported). A calculated, unpublished bill has
  **Other deductions → Edit** (`OtherChargesDialog`): an amount and a reason, kept across a
  re-generation. **Hidden until the backend ships it** (`OTHER_DEDUCTIONS_ON_SERVER`).

### M7 Credit queues

*Advances, loans and manure on credit.* These requests originate in the app (or at the
counter), the eligibility figures must match what the supplier was shown byte for byte
(AC-05), and the arithmetic behind them is `packages/domain/src/leafCredit.ts`, shared code
the app, this console and the API all read.

One queue, filtered, not three screens. The detail page prints the working in the order the
rule reads it, `ceilingSeen` makes BR-310 enforceable, `over-ceiling` is refused on both
sides, and BR-501 is checked **before** the figures because who may decide does not depend
on what the ceiling says.

**Who does what.** The clerk holds `creditRequests: W`: they see the queue and record a
counter request. Deciding is `A`, the manager's, and nobody decides a request they recorded
(BR-501, four-eyes). The decision dialog reminds the approver to enter the approval in the
factory's own system too (`FactorySystemReminder`, also in the tea-packet and
change-request dialogs), because nothing here writes to it.

**The rules the queue enforces**:

- **An open loan blocks both a new loan and an advance** until it is repaid (manure is not
  affected): `buildCreditEligibility({ loanOutstanding })` answers `available: 0` with
  `reasonKey: 'credit.reason.loanOutstanding'`, and the API refuses with
  `409 loan-outstanding`. This extends BR-303 (no advance while an advance is outstanding).
- **An advance is closed within its month**: deducted in full on that month's bill, even
  past the gross (advance instalment share 100%); any shortfall is Next Month Deb.
- With the sync off, the advance ceiling is this month's kilos so far × last month's
  settled rate.
- Approval also refuses `supplier-suspended`, `supplier-closed`, `advance-outstanding` and
  `loan-outstanding`; each is explained in en/si/ta and blocks the approval dialog.

**Walk-in requests (sync off).** **Record walk-in request** (`WalkInCreditDialog`) or
**Import from file** (kind `walkInCredit`): a request made at the counter, created exactly
like an app request with `channel: 'office'`, `status: 'pending'` and the recorder as
creator, so someone else decides it. Manure is priced from the factory's catalogue; loans
and manure offer the factory's repayment periods. Refused for a facility switched off, a
suspended or closed supplier, a pending request on the same facility (`request-pending`)
and `loan-outstanding`; **not** refused for being over the limit (it is recorded as asked,
and approval refuses it).

### M18 Tea packets

*The factory's own tea, issued to the supplier who grew the leaf.*

**A separate queue from M7, not a fourth facility**:

| M7 | M18 |
| --- | --- |
| Priced off the supplier's leaf | Priced off a catalogue of one |
| `CreditEligibility` on every row, AC-05 byte-for-byte | No eligibility at all |
| `ceilingSeen` + `stale-eligibility` (BR-310) | Nothing to go stale |
| A detail page, because the working has to be printed | One screen, because every column fits in the grid |

**What the approver needs is the store's question**: how many packets, **what it weighs**,
how it travels, and what it will cost on the account. The delivery filter is a working
view: requests going back on the collection vehicle have to be packed before it leaves.

**The price is stamped at the decision and never re-read.** **The cap is stock, not
credit**: an over-cap request is refused on **approval only**, so the rejection stays
available. **Approved and not yet recovered is money the factory is owed**, so
`enableTeaPackets` is refused while any exists.

Rules shared with M9 and M7: AC-06's note on both verbs, BR-501 on `createdById`,
`already-decided` as a first-class case. CSV export of the grid.

### M9 Change requests

*Payout, savings-rate and address approvals.* Oldest first within a status,
current-vs-requested in the grid as well as on the detail page, and the three rules
implemented rather than assumed: AC-06 in three layers, BR-501/AC-10 by withholding the
buttons *and* refusing server-side, AC-02's asymmetry in the invalidation set.

`already-decided` keeps the dialog open with an explanation and refetches, rather than
discarding the note the clerk just wrote.

#### `address`: the fourth type

The **estate address is where the leaf comes from** and the **home address is where every
printed Green Leaf Account is posted**, so an address change is asked for, not written
straight to the record. The grid, the detail page and the decision dialog render it
unchanged, because they were built against `currentSummary` and `requestedSummary`.

- **Apply per key, not per block.** `requestedAddress` carries only what moved; a handler
  spreading the whole object would blank the field the supplier never touched.
- **The write path is closed.** The app's `EditablePersonal` no longer includes either
  address, and the API refuses an address on `PATCH /profile`
  ([api-contract.md](./api-contract.md) §6.4).

### M10 Inquiries

*Messages from suppliers.* The only queue whose rows are prose, so the subject gets the
width and the first line sits under it. Reply suggestions from the factory's common notes
(Configuration → Common notes). CSV export of the grid.

**Reply and close are different acts**: replying writes something the supplier reads,
closing files a message that needed no answer. *How many suppliers we actually answered* is
the number §19.3's channel-shift KPI wants.

§12.1 is unusual and stays: `A` for the **clerk**, `R` for the manager. Answering a supplier
is counter work; a manager reading the queue is oversight.

### M11 News

*The feed suppliers read in the app.*

AC-08 has two halves (copy falls back to English, *and* the gap is visible to the editor)
and both are true because `resolveTranslation` is **shared** and the preview is fetched
from the server.

Copy is saved one language at a time. Three states, not two: **stale** is copy written
before the English it was translated from was corrected. Publishing with a gap is allowed
and loud; the one hard refusal is a record with no fallback copy at all. An article can be
**published now or scheduled** for a time (picked in Colombo time), and can carry a cover
image.

### M11 Promo banners

*The full-width announcement on the way into the app.* Its **own sidebar row**, gated on
`enablePromoBanner`, **not** `enableNews`: a factory that runs no feed may still want to say
the store is closed on Friday.

#### The window is the column, not the status

| State | What every badge says | What suppliers see |
| --- | --- | --- |
| Published, starts next week | Published | Nothing |
| Published, ended on Tuesday | Published | Nothing |
| Draft | Draft | Nothing |
| Published, inside the window | Published | The banner |

So the list defaults to the **live** lens, and the editor leads with a window notice.
`window` is computed **server-side**, so the console and the phone agree on the day a banner
starts.

#### The action runs the app's own resolver

`packages/domain/src/banners.ts` is a **verbatim port of the app's `src/services/banners`**,
and the console runs `bannerTarget()` on every keystroke, at save, at patch and at publish.
An action the app cannot resolve renders artwork with no button and reports nothing, so
from the office a dead button looks exactly like a working one.

| Refusal | Why it is named separately |
| --- | --- |
| `banners.action.appSchemeRefused` | `teafactory://manure` is the mistake an editor makes **on purpose**; the answer is "use an in-app screen" |
| `banners.action.badPath` | A path with a query string is one the linking config cannot match |
| `banners.action.badUrl` | `https`, `tel`, `mailto` only, parsed with `new URL` |

The field also prints, in words, **what the app will do** with what is typed.

- **A missing translation may be published over; a refused action may not.**
- **"Written" means headline + button label, not headline + body** (`isBannerWritten`,
  `staleBannerTranslations`).
- **Taking a banner down is distinct from editing `endsAt`**, and the record says it was
  withdrawn.
- **Artwork can be uploaded** (up to 5 MB). With no artwork the app draws a branded panel
  carrying the same message.

### M12 Static content

*The app's fixed pages.* A closed set: no create, no delete, and the list returns all six
**including the ones nobody has written**, because the app is then rendering its default and
an office that cannot see the page assumes it filled it in. Every factory starts with the
defaults in `static-pages.seed.json`. A body is a list of points (an FAQ question, a terms
section) the office can add, change or remove, and a page can be put back to the default
text.

An edit to a live page is live when saved; the audit entry records the previous wording and
the new one.

### M13 Notifications

*What suppliers are told, and what they are told automatically.*

§21.24 is answered as **configuration rather than code**: every automatic trigger is a
per-tenant row, defaulted from `push.defaultCategories`. A push is the only act in this
console with no undo and no delivery report, so every safeguard is a *pre*-check:
`unknown-category`, per-device consent, `no-recipients` on a composed send only,
`push-not-configured`.

The reach panel is the module: three numbers rather than one, because *reaches 3, 11 opted
out* is a circular that belongs on the noticeboard.

**Where the events come from.** `billPublished` fires off a month's publish. With the sync
off that publish is on M4 in this console; with the sync on, the bills arrive from the
factory's system, so the trigger depends on the sync. Either way the trigger rows and the
API contract are the same.

### M14 Configuration

*Everything about a factory that is data rather than code.* This module is AC-12: a new
factory is a DNS record and configuration, with a control here for every field the app and
the console read.

**Eleven sections**, each drafted locally and saved as one `PATCH`:

| Section | What it holds |
| --- | --- |
| The factory | Name, telephone, registration number, location, support email and office hours. These print on every bill |
| Features | The feature flags (fifteen; fourteen shown, because `enableProfileTab` is hidden: the app has no Profile tab since 29 October 2026). Some remove a console module **and** an app screen (`enableManure` → M7), the rest only an app screen. `enableMonthToDate` is neither shown nor sent until `GET /bills/month-to-date` ships (`MONTH_TO_DATE_ON_SERVER`) |
| **Factory system** | The sync switch (on / off), with what appears or disappears before Save and a second confirmation |
| Collection & savings | Collection points, savings rates per kg, the fertilizer (manure) catalogue with bag size and price |
| Banks & branches | The factory's bank and branch list ([bank-catalogue.md](./bank-catalogue.md)) |
| Languages & branding | Content languages, fallback language, brand colours and logo |
| Notifications | The push block: categories and topic |
| Tea packets | Pack size, price, the per-request cap |
| Credit rules | The ceiling rule per facility and the repayment periods offered |
| **Bill calculation** | Where the bills come from (`imported` / `calculated`); pay in Rs. 1 / 5 / 10 and the next bill serial (calculated bills); advance interest; loan interest (% a month, 0% by default) and how it is taken (`onTop` or `withinInstalment`) |
| Common notes | The note suggestions shown as chips under the note boxes (decision dialogs, inquiry replies) |

#### Bill calculation

- **Payment unit** (`billSettings.paymentUnit`): the payment is rounded down to it and the
  rest is Coins C/F (galaboda pays in tens).
- **Next bill serial** (`billSettings.nextBillSerial`): new bills are numbered
  `factoryBillNumber(year, serial)`, the year of the bill's month and a serial that never
  resets (`2026210869`, then `2027210870`). Without it, `GL/YYYY-MM/NNNN`.
- **Loan interest** (`config.loanInterest`): worked on the loan owed at the start of the
  month, simple interest, never on interest. `onTop`: Rs. 50,000 over 10 months at 1%
  deducts 5,500 and the loan falls 5,000; `withinInstalment`: deducts 5,000 and the loan
  falls 4,500.
- **Advance interest** (`config.advanceInterest`): only when an account could not cover its
  advance.
- "Where the bills come from" and "How the loan interest is taken": changing the source is
  refused while a month has generated but unpublished bills (`409 bill-source-blocked`). A
  save sends both; the API keeps what is stored for a field left out.

#### Credit rules: how much a supplier may borrow

**The three ceilings are configuration**, not formulas in the build. Five fields per
facility, because every ceiling the product has used is one sentence: *take a basis,
average it if that is what the basis is, multiply it, cap it, and require some history
first*:

| Field | What it is |
| --- | --- |
| **Basis** | `thisMonthLeaf` · `lastSettledMonth` · `averageIncome` |
| **Multiplier** | `1` means the basis itself |
| **Months to average** | Only asked for when the basis is an average |
| **Settled months required** | `0` offers it from the supplier's first month |
| **Cap** | Empty means none. Applied after the multiplier |

- **The defaults reproduce the former hard-coded formulas exactly**, asserted by a test.
- **Every value blocks rather than warns.** Turning the facility off under *Features* is
  what "nobody may borrow" is for.
- **The screen prints what the five numbers mean**, in a sentence, under each facility.
- **The same rule runs in the app**: `creditCeilingFromRule` is ported to the mobile repo,
  and the app's "working" lines come from the server's figures (multiplier, basis, cap).

#### What an edit costs

Computed from the same `configImpact` the API refuses with:

| Impact | Severity | Why |
| --- | --- | --- |
| `savingsHeld`, `creditOutstanding`, `teaPacketsOutstanding` | **Blocks** | Turning off a flag whose module holds money would hide what the factory owes, or is owed |
| `pointInUse` | **Blocks** | A delivery names its collection point and nothing else |
| `fallbackLanguageRequired` | **Blocks** | Every article, page and banner falls back to English |
| `teaPacketPolicy.*` | **Blocks** | A zero pack size or negative price prices every request wrong |
| `surfaceRemoved` | Warns | A flag that only shows something is a choice the factory is entitled to make |
| `bankInUse`, `languageDroppedWithCopy` | Warns | The data survives; only what is offered changes |

`tenantId` is shown and not editable (`tenant-immutable`). `payoutFile` is not edited here;
`payoutExport.ts` stays in `@tfd/domain`.

### M15 Users & roles

*Who may use the console.* Five roles: `clerk`, `manager`, `editor`, `factoryAdmin`,
`platformAdmin` ([rbac.md](./rbac.md)). The office sets a new user's first password, shown
once (`IssuedPasswordField`), and the user must change it at first sign-in. Deleting a user
waits three days and can be undone until then.

Every refusal guards one failure, a factory locking itself out: `last-admin`,
`self-modification`, and a matrix that strips `usersAndRoles` from every role
(`matrixKeepsRecovery`).

**The role matrix shows fourteen of the fifteen capabilities.** Only `payouts`
(`FACTORY_CONSOLE_CAPABILITIES`) is not rendered, and its stored levels are preserved on
save. The default matrix (`DEFAULT_ROLE_MATRIX` in `packages/domain/src/rbac.ts`) gives the
clerk `deliveries: W`, `creditRequests: W` and `billing: W` for the sync-off counter work
(and `ratesAndMonthClose: R`, so the clerk can open Rates & month close to import or generate
the bills),
the manager `ratesAndMonthClose: A` to publish a month, and both administrators `R` on
`deliveries`, `ratesAndMonthClose` and `billing`, so the factory administrator sees the
Factory records menu read-only. Savings withdrawals need `billing: A` (the manager).

### M16 Reports

Three tabs, each read only, each a report the API serves (`channelShift`, `creditGiven`,
`savingsHeld`):

| Tab | What it answers |
| --- | --- |
| **App use** (`channelShift`) | Are suppliers moving from the counter to the app? Four figures for the chosen period, the trend month by month, and the table behind it (downloadable) |
| **Credit & tea packets** | Advances, loans and manure approved, tea packets issued and requests refused, month by month, by the month they were decided |
| **Savings** | How much the factory holds for suppliers, for how many, and what came in and went out each month. Absent when the factory runs no savings scheme (`enableSavings` off: no tab, and the API leaves the report out of its list) |

A report is asked for and answered, never stored. `null` is never `0` (BR-102). No flag.

### M17 Audit log

Filterable by entity and by actor, read only, newest first, with **CSV export**.
Before/after render as JSON, deliberately: an audit entry is evidence.

#### `actorType`: what the supplier did themselves

| `actorType` | Who |
| --- | --- |
| `consoleUser` | The office. **The default**; an entry with no `actorType` is one of these |
| `supplier` | The supplier, in the app: their own profile edits, their first-sign-in password change |
| `system` | An automatic send firing off an event |

The supplier's actions sit on the same timeline as the office's, on the same record. Office
entries carry no badge, so the exception stays visible. An `ip` of `null` on a supplier
entry is deliberate.

Entries worth knowing about:

- **A banner publish records the languages that will fall back.**
- **A tea-packet decision records the unit price.**
- **Factory records** add `supplier.openingBalances`, `supplier.transportRate`,
  `bill.adjust`, `import.apply` (one entry per file, not per row), `bill.printed`,
  `bill.hold` and `bill.release`, labelled in en/si/ta.

---

## Acceptance criteria

Against the mobile repo's `docs/domain-logic.md` §18.3.

| # | Criterion | State |
| --- | --- | --- |
| AC-01 | App and M2 show the same active bank details, savings rate, payment method | ✅ Met: active values only; a pending change renders as pending |
| AC-02 | Approving changes the app's displayed value; rejecting leaves it and shows the note | ✅ Met, with an integration test on both halves |
| AC-03 | A bill matches the app's Home screen and the PDF field for field | ✅ **Console and app met**: the slip follows the factory's printed one line for line from the shared `bill.ts`, and the app shows the same lines (Other deductions with its reason, the loan instalment number). With the sync off the bill is produced here (imported exactly as printed, or calculated); with the sync on it comes from the factory's system, which must send every line (`factory-system-team.md` §3) |
| AC-04 | The month cannot be published with an unresolved exception | ✅ **Met with the sync off**: `exceptions-open` is in the publish's ordered refusals (api-contract §10.5), against the mock for calculated bills. The backend's month reads and publish are live since `12eea12` for imported months, which have no exceptions (A13). With the sync on, the month is closed in the factory's system |
| AC-05 | Credit eligibility matches the app's, byte for byte, including the working | ✅ Every intermediate figure is rendered and the derivation is shared (`leafCredit.ts`); the app's working lines come from the server's figures |
| AC-06 | Rejecting without a note is impossible | ✅ Met at three layers on every queue, including M18 |
| AC-07 | A flag off removes the surface **and** the endpoint refuses | ✅ The console hides the surface; the mock and the backend refuse with `403 feature-disabled` |
| AC-08 | Content falls back to English, and the gap is visible to the editor | ✅ Met, for articles and banners |
| AC-09 | Every decision appears in M17 within a second, with actor and before/after | ✅ Met |
| AC-10 | No console user can approve a record they created | ✅ Buttons withheld, server refuses `four-eyes-violation`, including walk-in requests and imported bills |
| AC-11 | The FAQ is driven by M12 content | ✅ Met |
| AC-12 | A new factory goes live without a code deploy | ✅ Met for the API and the console: a factory is data (`npm run db:seed:tenant`, then Configuration; see [new-factory.md](./new-factory.md)). The supplier app is one build per factory, by design |

---

## Known gaps

Worst first: correctness, then plumbing, then polish.

1. **The factory-system sync does not exist yet** (backend Phase 10). A factory with the
   sync **on** has no pull from its system, so its suppliers, leaf, bills and balances are
   whatever reached the API some other way. Galaboda keeps its records with the sync
   **off** and imports its bills. When the sync lands, the credit ceiling also needs the Factory System's **complete**
   outstanding balances, counter-raised credit included, or a supplier can draw the same
   headroom twice ([factory-system-team.md §C](./factory-system-team.md#c-who-decides-credit-and-what-each-side-calculates)).
   Switching a factory from records kept here back to the sync also waits for Phase 10.

2. **BACKEND-TODO #45 is not finished.** A sync-off factory can add suppliers, set
   transport rates, record walk-ins, and import and publish its finished bills against the
   real API (a late division file's bills wait for a manager, R15, and a waiting one is
   replaced by sending it again, R18), and enter opening balances (one at a time or from a file, `5b58f81`), but it cannot yet enter leaf, enter a rate by hand, generate
   bills and compare them with the printed slips, type other deductions, run the remaining
   imports or import a file again (skipping what is already there). The table under
   [Hidden in the console](#hidden-in-the-console-until-the-backend-ships-it) says what is
   hidden.

3. **`@tfd/domain` is vendored by the backend and the app.** *Closed 29 October 2026.*
   Both copy `packages/domain/src` (`npm run vendor:pull`) and fail their own CI on a
   local edit (`vendor:check`). The app imports its types, the credit rules, the banner
   resolver and the page points from it, no longer keeping its own. `npm run domain:drift`
   here compares both copies with this one and names who has a pull to do; the app's
   CI asks the same of this repository (`vendor:upstream`). What is left is the pull
   itself: a change here reaches the API and the app only when each pulls it.

4. **Nothing is pushed.** The API's sender is a no-op until it is built; M13 records what
   it would send and what it would reach. When it lands it brings a per-device delivery
   result arriving later, which `NotificationSend.status` (`queued`, `failed`) is ready
   for and nothing sets yet.

5. **A composed notification picks its language per supplier in the inbox only.** Since 30
   October 2026 the composer has the language strip M11 has: English required, Sinhala and
   Tamil optional, the gaps marked and named before the send, all languages sent as
   `translations`. The API keeps them and the app's inbox answers in the supplier's language
   (`?lang=`, the fallback otherwise). What is left is the push itself: the sender (gap 4)
   must pick each device's language the same way (`notificationCopyFor`).

6. **Corrections after a published bill wait for the API** (C5, BACKEND-TODO #57). Built
   in the console and the app on 30 October 2026: the manager posts one on the supplier's Money
   tab (a balance moves at once, a payment lands on the next bill as a "Correction" line with
   the reason). Hidden by `CORRECTIONS_ON_SERVER` until the backend ships the endpoints.

7. **The Sinhala and Tamil labels still need a native speaker's reading in place.** On
   26 October 2026 every label was read against the English and 665 were corrected (323
   Sinhala, 342 Tamil). Among them:
   - meanings turned round: Tamil "take down" read as delete, and "Undo changes" as
     "redo"; Sinhala "against" read as "opposed to", and "settled" as "balanced";
   - English left in about 100 newer Sinhala labels;
   - one word per term, the same as the app's where the app has one: Sinhala දළු,
     ඇතුළු වන්න, ඉතිරිකිරීම්, විමසීම්, බලාපොරොත්තුවෙන්; Tamil வழங்குநர் (not
     three names for the supplier), கொழுந்து, தேயிலைப் பொதி, திகதி, and the Sri
     Lankan month spellings.

   `stringTables.test.ts` now fails on a letter of the other script, a broken vowel
   sign, a renamed placeholder, untranslated English or an em dash. *To close:* somebody
   in the office reads the si and ta screens in place, before the console is
   demonstrated in either language. The fixtures and default pages (mocks.md) were not
   part of the review. Four words were settled on 28 October 2026, each one word across the
   console, the app, its PDF and the website: Sinhala ආනයනය / අපනයනය for import and
   export; Sinhala ඉදිරියට ගෙන යන ණය for Next Month Deb (beside ඉදිරියට ගෙන යන ශේෂය and
   පෙර ණය; the app's screen and PDF had said it two other ways); Tamil கொழுந்து for green
   leaf (the account is கொழுந்துக் கணக்கு; on 29 October the bare இலை, "leaf", was replaced
   too, in the app, the website and the default pages); and Tamil பொதி for a tea packet, the Sri
   Lankan word (தேயிலைப் பொதிகள், no longer பாக்கெட் in the app).

8. **No evidence attachment on a change request, by decision** (29 October 2026). A
   bank-detail change is approved on the details alone, and inquiries stay text only.
   The Evidence card on the change-request screen stays hidden while `attachments` is
   empty, which it always is; nothing on either side uploads one.

9. **Error reporting waits for a Sentry project.** It is built (`lib/monitoring.ts`, 28
   October 2026) and switched on by `VITE_SENTRY_DSN`; until a DSN is set nothing is loaded
   and a console error reaches `console.error` only. *To close:* create the Sentry project
   and set the DSN in Vercel for staging and production (operations.md, Error reporting).

10. **The screen-reader pass is still a person's to do.** The automated half is done: axe runs
    against WCAG 2.2 A and AA on every screen, light and dark, as the administrator and the
    manager (`e2e/accessibility.spec.ts`); its first run's 79 findings were fixed on 30 October
    2026 (contrast kept at AA for any factory's colours, radio groups for choices that are not
    tabs, the sidebar mark's name, one `h1` per screen). Nobody has yet driven NVDA or
    VoiceOver over it: the checklist is [accessibility.md](./accessibility.md) §2.

11. **Reports read live records.** §19.5 asks for a read replica; the reports are single
    passes over live records, so moving them is a connection string, not a rewrite.

---

## Open business questions

Numbering follows `status.md` §21 in the mobile repo.

| § | Question | Effect today |
| --- | --- | --- |
| 21.6 | **Approval thresholds**: above what amount must someone above the manager approve? | `canApproveAmount(…, null)` treats "not configured" as "the base capability suffices", so the answer becomes configuration |
| 21.12 | **Retention**: for bills, payout records, delivery data | M17's retention policy, and §20.4. Settled whatever the answer: no hard deletes anywhere, and the audit log survives an erasure request ([api-contract.md §8](./api-contract.md#8-m17-audit-get-adminaudit)) |
| 21.18 | **Inquiry statuses**: is Resolved/Closed the right pair? | Built with both; `INQUIRY_STATUSES` is data, so a third is a row |
| 21.24 | **Notifications**: should a bill publication push to every supplier, and is `content: approve` the right gate on free text? | Built as configuration (one switch per category); the factory has not confirmed the settings |
| - | **Gross or net leaf?** Does the weighing point record one figure, or a gross weight and a sack/water deduction? | One net `kgs` per weighing in the console and on the wire. The backend already books `grossKg` + `deductionKg` (0) and derives `kgs`, so a two-figure answer is no migration on the server; it would still change `Delivery` in every client that reads it |
| - | **What is a plausible weighing?** | The leaf grid questions a figure over 150 kg that is also 3× the session's mean (`OUTLIER_KG_MULTIPLE`, `OUTLIER_KG_FLOOR_KG`). A guess until the factory gives a number |
| - | **How far back may leaf be entered?** | Any date in an unpublished month; the publish lock is the only guard |

---

## What is deliberately not built

| § | Question | What is missing | Why not guess |
| --- | --- | --- | --- |
| 19.1 | What shape is the reporting warehouse? | Reports beyond the three tabs | A report nobody asked for is a query somebody maintains and nobody reads. M16 needs §19.1's warehouse shape more than a report list; the list is served (`GET /admin/reports`), so when the warehouse comes M16 grows without a console release |
| - | Payouts and savings postings | M6 payouts and M8 savings screens | The factory pays from its own system; savings are read from the bills and shown on the supplier's record and in M16 |

---

## What I would build next

1. **Finish #45 on the backend**, in the order in [BACKEND-TODO.md](./BACKEND-TODO.md):
   leaf and months next (opening balances shipped in `5b58f81`). Remove each line
   from `serverReady.ts` as it ships.
2. **The push sender** (gap 4): every notification setting in the console is a control
   over nothing until it exists.
3. **The factory-system sync** (gap 1), when a factory with a reachable system signs up.
