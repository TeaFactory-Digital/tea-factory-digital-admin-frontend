# Status

What works, what is deliberately unfinished, and what only the factory can answer.
Read this before planning the next slice.

Written in the mobile repo's `status.md` voice on purpose: **anything marked a gap
is exactly that.** Nothing here is quietly assumed to be solved.

---

## What is built

Foundation plus M1, M2, M9 and M17 — the first agreed milestone — and now **M3
and M4**, the pair §18.2 calls the ones the project succeeds or fails on.

| Area | State |
| --- | --- |
| **Workspace** | npm workspaces: `@tfd/domain`, `@tfd/brand`, `@tfd/admin`. Packages consumed as TS source, no build step |
| **Runtime white-label** | Subdomain → tenant → `GET /config` → CSS custom properties → Tailwind tokens. Three tenants, one of them reduced-feature |
| **Auth realm** | Separate from suppliers. Password → optional TOTP → in-memory access token + httpOnly refresh cookie, with refresh-on-401 |
| **RBAC** | The §12.1 matrix as data, server grants overriding per capability, four-eyes, capability route guards |
| **Transport** | Axios with domain-code-preserving errors, tenant header, idempotency keys, single-retry refresh |
| **Mock API** | MSW: 84 suppliers, 14 change requests, ~14 days of delivery rows, months with stored stages and derived exceptions, 3 tenants, 4 console users — enforcing every refusal the real API must |
| **UI kit** | 15 token-driven primitives, keyboard-navigable data grid, i18n throughout |
| **M1 Dashboard** | Queue cards with age and SLA, month-cycle stage, today's leaf, server-composed alerts, 14-day trend — the leaf figures now derived from M3's rows, so committing a session moves the card |
| **M2 Suppliers** | Search/filter/sort grid with URL state, detail, suspend/reactivate, the audited bank reveal |
| **M3 Leaf collection** | Day-and-point view in the URL, two-field keyboard entry, outlier confirmation, one-request session commit keyed for idempotency, per-row rejections kept on the line, void with a mandatory reason, entry withheld in a published month |
| **M4 Rates & month close** | Stored stage per month, the rate as two figures with correction before publish, exceptions as a resolvable work queue, and a publish gated on five refusals including four-eyes |
| **M9 Change requests** | Queue oldest-first, side-by-side comparison, approve/reject with mandatory note, four-eyes, already-decided |
| **M17 Audit** | Filterable read-only log, plus per-record panels on M2 and M9. Every M3/M4 mutation writes to it |
| **Tests** | 91 Vitest + 3 Playwright, all passing. Typecheck and lint clean |

## Acceptance criteria

Against `docs/admin-console.md` §18.3. Only criteria whose module exists can be
assessed.

| # | Criterion | State |
| --- | --- | --- |
| AC-01 | App and M2 show the same active bank details, savings rate, payment method | ✅ Met — the detail screen shows active values only; a pending change renders as pending |
| AC-02 | Approving changes the app's displayed value; rejecting leaves it and shows the note | ✅ Met, with an integration test on both halves |
| AC-06 | Rejecting without a note is impossible | ✅ Met at three layers: disabled button, Zod schema, server `note-required` |
| AC-09 | Every decision appears in M17 within a second, with actor and before/after | ✅ Met against the mock; the real API must do the same |
| AC-10 | No console user can approve a record they created | ✅ Met — buttons withheld, server refuses `four-eyes-violation` |
| AC-04 | The month cannot be published with an unresolved exception | ✅ Met — exceptions are records with a mandatory resolution note, and publish answers `exceptions-open`. Integration-tested, including the four-eyes refusal on the publisher who entered the rate |
| AC-07 | A flag off removes the surface **and** the endpoint refuses | ⚠️ Console half met (sidebar, dashboard, guards). **The API half is unbuilt** |
| AC-12 | A new factory goes live without a code deploy | ⚠️ Mechanism met — subdomain + config + no bundled identity. Unprovable until M14 exists |
| AC-03, AC-05, AC-08, AC-11 | Bills, credit eligibility, content fallback, FAQ | ⛔ Not assessable — M5, M7, M11, M12 are not built. M4 now supplies the rate and the close that AC-03's bill is derived from |

---

## Known gaps

Worst first: correctness, then plumbing, then polish.

1. **`@tfd/domain` is a copy of the mobile types, not the same file.** The mobile
   app still lives in its own repository, so `src/types/index.ts` exists twice and
   keeping the two in step is manual — exactly the drift the shared package was
   meant to prevent. *To close:* merge the repos (`git mv src → apps/mobile/src`)
   in its own PR, verified with clean iOS and Android builds. Deferred because it
   touches the Xcode project, Gradle paths and every `@/` alias, and breaking a
   working native build for a console change is not a trade worth making blind.

2. **The API half of every feature flag does not exist.** The console hides a
   disabled surface end to end, but nothing refuses `POST /loans` at a factory
   that does not lend. Until the backend answers `403 feature-disabled`, AC-07 is
   half met and the flag is a UI preference, not a policy.

3. **Refresh-token rotation is unverified.** The mock stands in for the httpOnly
   cookie with a `sessionStorage` entry, which is enough for the console to
   survive a reload but has **no rotation and no reuse detection**. Both are
   specified in [api-contract.md](./api-contract.md) §2.3 and testable only
   against the real backend.

4. **M17 has no export.** §18.1 says "read-only, exportable" and the export is not
   built. Same for M16's CSV/XLSX. Deliberately not a disabled button — a control
   that does nothing is worse than an absent one.

5. **M3's scale-file import is not built.** §18.2's data-entry story has two
   halves and only the keyboard one exists. `source: 'scaleFile'` is already in
   the type, the fixture and the grid's source column, and the import is meant to
   land as the same batch the grid commits — but **no factory has told us what
   its weighbridge exports**, and a parser written against a guessed format is a
   parser that gets thrown away. Blocked on a sample file, not on effort.

6. **A delivery is one net figure.** The console records `kgs` and nothing else.
   If a weighing point actually books a gross weight and a sack/water deduction —
   which is common practice and which nobody has confirmed either way — then this
   is a data-model gap, not a UI one, and it is cheaper to answer now than after
   a month has been published on the wrong column.

7. **Supplier create and edit are not wired.** `POST` and `PATCH` exist in the
   repository and the endpoint layer with full types, and no screen calls them.
   Registration is also blocked on §21.15 (who issues a code, what the supplier
   receives), so building the form first would be guessing at the flow.

8. **Evidence attachments are read-only.** M9 renders existing attachments and the
   upload path is fully built (`uploadRepository`, presign + PUT, validation) —
   but no screen calls it, because whether an attachment is *required* to approve
   a bank-details change is an open question.

9. **No error reporting.** A console error reaches `console.error` and nowhere
   else. `sentryDsn` is a placeholder on both sides.

10. **No console analytics.** §19.3's KPIs — app adoption and channel shift — need
    the `channel` column on office-raised requests, which the mock sets and the
    backend must too. Nothing measures console-side usage.

11. **Dark mode is off.** The palette exists and the bridge emits whichever scheme
    it is given; enabling it is a toggle plus a QA pass. Off because the console
    runs on office desktops in daylight and doubling the theming QA buys nothing.

12. **No screen-reader pass.** The semantics are built in — real tables,
    `aria-sort`, `role="alert"`, a clean accessible name on every field, a global
    focus ring — but nobody has driven NVDA or VoiceOver over it.

13. **The i18n table is English-only.** By decision, not omission (see
    [white-label.md](./white-label.md) → Localization). Every label goes through
    `t()`, so adding Sinhala is a copy deliverable. **M3's leaf-entry grid is now
    the surface that most needs it**, since weighing-point staff are not office
    staff — and it is the one screen a supplier stands in front of.

14. **The console's ceiling arithmetic is untested against the server's.** AC-05
    requires byte-for-byte agreement, and `packages/domain/src/leafCredit.ts` is
    the shared implementation — but nothing yet compares it to a real
    `/advances/eligibility` response. That comparison is the first test M7 needs.

---

## Blocking business questions

These stop specific modules. Numbering follows `status.md` §21 in the mobile repo,
so an answer can be recorded in one place.

### Stops a module I could otherwise build now

| § | Question | Blocks |
| --- | --- | --- |
| 21.15 | **Registration** — how does a new supplier get a code and a login? Who creates it, and what does the supplier receive? | M2 create |
| 21.16 | **Password reset** — the app says "contact the factory". What does the office actually do, and how is the supplier's identity checked? | M2's reset action, currently disabled with an explanation. The wrong flow here is an account-takeover path |
| 21.8 | **Corrections** — may a published bill be corrected, or is an error always adjusted on the next account? | M4, M5. It decides whether `bills` is immutable, so it is a data-model question, not a UI one |
| 21.17 | **Payout files** — SLIPS, CEFTS or a bank-specific CSV? Cheques on pre-printed stock? | M6 entirely |
| 21.9 | **Savings** — may a supplier withdraw, with what notice, is interest paid? | M8 |
| 21.24 | **Notifications** — does the office compose every send, or does bill-published fire automatically off the publish step? Who may send free text? | M13 |

### Shapes a module without stopping it

| § | Question | Effect |
| --- | --- | --- |
| 21.6 | **Approval thresholds** — above what amount must a manager rather than a clerk approve? | M7. `canApproveAmount(…, null)` already treats "not configured" as "base capability suffices", so M7 can be built and the number added later |
| 21.5 | **Stacking** — does a pending request block another of the same type? | M7's queue behaviour |
| 21.13 | **Collection points** — first-class entities, or does the division suffix suffice? | Already modelled as first-class in the config and the supplier record. Reporting by route needs it, so this is the right guess — but it is a guess |
| 21.18 | **Inquiry statuses** — is Resolved/Closed the right pair? | M10. Build with two and add states as data |
| 21.10 | **Deduction authority** — which lines may the office set per supplier per month? | M5 |
| 21.12 | **Retention** — for bills, payout records, delivery data | M17's retention policy, and §20.4 |

### Questions the console raises that §21 does not

**Who may reveal a full bank account number?** §20.4 says "except to roles that
need them" without naming them. The console currently gates the reveal on
`suppliers: read`, which is every role except editor — almost certainly too broad.
It should probably be clerk and accountant only, and it is a one-line change once
the factory says.

Building M3 raised three more, all of them cheap to answer now and expensive
after a month has been published on the wrong assumption:

| Question | What the console assumes today |
| --- | --- |
| **Gross or net?** Does the weighing point record one figure, or a gross weight and a deduction for the sack and surface water? | One net `kgs` per weighing. If the answer is two, it is a schema change (gap 6 above) |
| **What is a plausible delivery?** The grid questions a figure over 150 kg that is also 3× the session's mean. Those numbers are a guess sized for smallholder routes | `OUTLIER_KG_MULTIPLE` and `OUTLIER_KG_FLOOR_KG` in `@tfd/domain`, and the same pair raises M4's `outlierDelivery` exception. Tenant config once the factory has a number |
| **How far back may leaf be entered?** A paper slip found on Monday for Saturday's weighing is normal; a row backdated three weeks into a month about to close is not | Any date in an unpublished month is accepted. The publish lock is the only guard, which is a policy nobody chose |

---

## What I would build next

1. **M7 Credit queues.** Nothing external blocks it, `leafCredit.ts` is already
   shared, and AC-05 — the eligibility figures matching the app byte for byte — is
   the criterion most likely to cause a real dispute if it is wrong. It also
   exercises `stale-eligibility`, the only refusal the console has no path for yet.
2. **M10 Inquiries.** Small, unblocked, and it completes the "every pending in the
   app is a queue in the console" promise.
3. **M5 Bills**, now that M4 exists: the rate, the close and the exception list are
   in place, so a bill is a read model over deliveries × rate. §21.8 still decides
   whether a published bill may be corrected.
4. **The scale-file import for M3.** The entry grid is built; the other half of
   §18.2's data-entry story is a scale file the weighing point can upload, and
   `source: 'scaleFile'` is already in the data waiting for it.
5. **The repo merge**, before the shared types drift far enough to hurt.
