# Status

**As of 26 October 2026.** What works, what the backend has, what the console hides until
the backend ships, and what is still open. Read this before planning the next slice.

**Anything marked a gap is exactly that.** Nothing here is quietly assumed to be solved.

---

## Where things stand

| | |
| --- | --- |
| **Console** | Every module in [modules.md](./modules.md) is built and routed, in both modes: factory-system sync **on** (the console manages the app) and **off** (the office also keeps the factory's records: Leaf intake, Rates & month close, Add supplier, opening balances, transport rate, walk-in credit requests, other deductions, bills imported or calculated, and an Excel/CSV import for each) |
| **Backend** | `tea-factory-digital-backend`, deployed to staging, latest `12eea12`. BACKEND-TODO **#1 to #44, #46, #47, #49 and #51 are done**; **#45** (factory records without the factory system) is partly done (step 1, the bills import with the month reads and publish, is live except the late-bills change); **#48** and **#50** are open. See [BACKEND-TODO.md](./BACKEND-TODO.md) |
| **How the console runs** | Against the real API at `VITE_API_BASE_URL` (local on `:3000`, or staging). There is no in-browser mock any more |
| **How the console is tested** | Vitest against the MSW mock in `services/mocks/handlers.ts`, which implements every endpoint the console calls, including the ones the backend has not built: **565 tests in 77 files**. Playwright: **29 tests in 7 specs**, the real console on its own dev server (port 5274) with every `/v1/**` call answered in Node by the same handlers (`e2e/fixtures.ts`). Typecheck and lint clean |

### Built against the mock and tested

Everything in [factory-records.md](./factory-records.md) §3 and §4 is built in the console
and implemented by the mock with the same rules the API must keep:

- The **Factory system** switch, with `409 sync-switch-blocked` naming the months.
- **Add supplier** and the `suppliers` import; supplier identity is the bare number,
  unique per factory.
- **Opening balances** (one cut-over month, locked once a bill is published) and their
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

Shipped by the backend up to `12eea12` (BACKEND-TODO.md now lists only what is open): `factorySync`,
`advanceInterest` and `billSettings` (including `source`) in config, and `loanInterest`
with its `recovery`; `factorySync` stored as `{ enabled: false }` by default, absent or
`null` read as off (`068faf3`, migration `20261024010000`); the factory administrator's
`R` on `deliveries`, `ratesAndMonthClose` and `billing` (`068faf3`); the finished-bills
import with `GET /admin/months`, `GET /admin/months/:monthKey` and
`POST /admin/months/:monthKey/publish` (`12eea12`); `409 factory-sync-on` on every record
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
| Import → Opening balances, Daily leaf, Monthly rates, Other deductions, Printed slip balances | `POST /admin/imports/{openingBalances, deliveries, monthlyRates, billAdjustments, printedBalances}` (`IMPORT_KINDS_NOT_ON_SERVER`; Finished bills is live since `12eea12`) |
| Opening balances card (supplier → Money) | `GET` / `PUT /admin/suppliers/:id/opening-balances` (`OPENING_BALANCES_ON_SERVER`) |
| Other deductions → Edit on a bill | `PUT /admin/bills/:id/adjustment` (`OTHER_DEDUCTIONS_ON_SERVER`) |
| Rates & month close: "Compare with printed slips", the checklist step, held badges | `GET .../slip-comparison`, `PUT /admin/bills/:id/printed`, `POST /admin/bills/:id/hold`, `/release` (`SLIP_COMPARISON_ON_SERVER`) |
| Configuration → Features: "Account tab: this month so far" | `GET /bills/month-to-date` (`MONTH_TO_DATE_ON_SERVER`) |
| Import dialog: the preview of rows already there, "import them anyway" for leaf | `dryRun`, `duplicates`, `skipped` on `POST /admin/imports/:kind` (`IMPORT_SKIP_ON_SERVER`) |

The Leaf intake grid and Rates & month close stay visible. On Rates & month close the
month list, the finished-bills import, the checklist and the publish work against the API
for imported months (`12eea12`); entering a rate, the exceptions queue (still rendered for
an imported month) and the leaf calls start working as those endpoints land. Still to come on the backend, in order: late bills waiting
for a manager (R15), opening balances, leaf and months, other deductions, then the bill
engine with the printed-slip check (no factory needs it yet: galaboda imports its bills).
"Where the bills come from" and "How the loan interest is taken" shipped in `970be6f`, so
the console shows and sends both.

---

## Acceptance criteria

Against `docs/admin-console.md` §18.3 in the mobile repo.

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
   headroom twice ([factory-integration-spec.md](./factory-integration-spec.md) §3.4).
   Switching a factory from records kept here back to the sync also waits for Phase 10.

2. **BACKEND-TODO #45 is not finished.** A sync-off factory can add suppliers, set
   transport rates, record walk-ins, and import and publish its finished bills against the
   real API, but a late division file's bills are still published at once by the importer
   (R15), and it cannot enter opening balances, enter leaf, enter a rate by hand, generate
   bills or type other deductions. The table above says what is hidden.

3. **`@tfd/domain` is shared with the backend but copied into the app.** The backend
   vendors it (`vendor:pull`), so the two cannot drift silently. The mobile app keeps its
   own types and ports of the shared rules (`creditCeilingFromRule`, `bannerTarget()`),
   and drift there is found by reading the two side by side. *To close:* merge the repos,
   or a CI check that diffs the exported symbol lists.

4. **Nothing is pushed.** The API's sender is a no-op until it is built; M13 records what
   it would send and what it would reach. When it lands it brings a per-device delivery
   result arriving later, which `NotificationSend.status` (`queued`, `failed`) is ready
   for and nothing sets yet.

5. **A composed notification is English-only.** Articles are authored in three languages
   and fall back (AC-08); a push is not. Doing it properly means the composer grows the
   same language strip M11 has, and the send picks per device.

6. **A balance found wrong after the first published bill has no correction entry.**
   Decided (C5): a manager posts a correction with a note, applied on the next bill. Not
   built.

7. **Dates, numbers and money are not localized.** `lib/format.ts` pins its `Intl`
   formatters to `en-GB` and `en-LK`, so a Tamil console still reads "04 Aug 2026". It may
   be right for figures two people read over the phone, but nobody has decided it.

8. **No Sinhala or Tamil here has been reviewed by a native speaker**: the fixtures, the
   default pages and about 1,250 console labels per language. *To close:* somebody in the
   office reads the si and ta screens in place, before the console is demonstrated in
   either language. A unit test asserting each table's values fall in its own script range
   would catch the Sinhala/Tamil look-alike code points.

9. **Change-request evidence attachments are shown only if the API sends them**, and it does
   not yet. Whether an attachment is required to approve a bank-details change is open.

10. **No error reporting.** A console error reaches `console.error` and nowhere else.

11. **No screen-reader pass.** The semantics are built in (real tables, `aria-sort`,
    `role="alert"`, accessible names, a global focus ring), but nobody has driven NVDA or
    VoiceOver over it.

12. **Reports read live records.** §19.5 asks for a read replica; the reports are single
    passes over live records, so moving them is a connection string, not a rewrite.

---

## Open business questions

Numbering follows `status.md` §21 in the mobile repo.

| § | Question | Effect today |
| --- | --- | --- |
| 21.6 | **Approval thresholds**: above what amount must someone above the manager approve? | `canApproveAmount(…, null)` treats "not configured" as "the base capability suffices", so the answer becomes configuration |
| 21.9 | **Savings interest basis**: closing balance or the year's minimum, simple or compound? | The rate is stored (0% by default) and nothing is posted |
| 21.12 | **Retention**: for bills, payout records, delivery data | M17's retention policy, and §20.4 |
| 21.18 | **Inquiry statuses**: is Resolved/Closed the right pair? | Built with both; `INQUIRY_STATUSES` is data, so a third is a row |
| 21.24 | **Notifications**: should a bill publication push to every supplier, and is `content: approve` the right gate on free text? | Built as configuration (one switch per category); the factory has not confirmed the settings |
| - | **Who may reveal a full bank account number?** | Any user who can open the supplier's record (clerk, manager, both administrators). Probably should be the clerk alone; a one-line change |
| - | **Gross or net leaf?** Does the weighing point record one figure, or a gross weight and a sack/water deduction? | One net `kgs` per weighing. Two would be a schema change in every system that reads `Delivery` |
| - | **What is a plausible weighing?** | The leaf grid questions a figure over 150 kg that is also 3× the session's mean (`OUTLIER_KG_MULTIPLE`, `OUTLIER_KG_FLOOR_KG`). A guess until the factory gives a number |
| - | **How far back may leaf be entered?** | Any date in an unpublished month; the publish lock is the only guard |

---

## What I would build next

1. **Finish #45 on the backend**, in the order in [BACKEND-TODO.md](./BACKEND-TODO.md):
   the late bills (R15) first, then opening balances, leaf and months. Remove each line
   from `serverReady.ts` as it ships.
2. **The push sender** (gap 4): every notification setting in the console is a control
   over nothing until it exists.
3. **The CI symbol diff** between `@tfd/domain` and the app's types (gap 3).
4. **The factory-system sync** (gap 1), when a factory with a reachable system signs up.
