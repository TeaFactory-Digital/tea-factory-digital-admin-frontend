# Status

What works, what is deliberately unfinished, and what only the factory can answer.
Read this before planning the next slice.

Written in the mobile repo's `status.md` voice on purpose: **anything marked a gap
is exactly that.** Nothing here is quietly assumed to be solved.

---

## What is built

Foundation plus M1, M2, M9 and M17 — the first agreed milestone — then **M3 and M4**,
the pair §18.2 calls the ones the project succeeds or fails on, then **M5, M6 and
M8**: the money chain those two exist to feed. Now **M7 and M10**, which finish the
sidebar's Queues section — every `pending` in the supplier's app is a queue in the
console, which is the promise the whole product rests on.

| Area | State |
| --- | --- |
| **Workspace** | npm workspaces: `@tfd/domain`, `@tfd/brand`, `@tfd/admin`. Packages consumed as TS source, no build step |
| **Runtime white-label** | Subdomain → tenant → `GET /config` → CSS custom properties → Tailwind tokens. Three tenants, one of them reduced-feature |
| **Auth realm** | Separate from suppliers. Password → optional TOTP → in-memory access token + httpOnly refresh cookie, with refresh-on-401 |
| **RBAC** | The §12.1 matrix as data, server grants overriding per capability, four-eyes, capability route guards |
| **Transport** | Axios with domain-code-preserving errors, tenant header, idempotency keys, single-retry refresh |
| **Mock API** | MSW: 84 suppliers, 14 change requests, 14 credit requests, 7 inquiries, **eight months of delivery rows**, months with stored stages and derived exceptions, bills and savings ledgers chained month to month, payout runs in every state, 3 tenants, 4 console users — enforcing every refusal the real API must |
| **UI kit** | 15 token-driven primitives, keyboard-navigable data grid, i18n throughout |
| **M1 Dashboard** | Queue cards with age and SLA, month-cycle stage, today's leaf, server-composed alerts, 14-day trend — the leaf figures now derived from M3's rows, so committing a session moves the card |
| **M2 Suppliers** | Search/filter/sort grid with URL state, detail, suspend/reactivate, the audited bank reveal |
| **M3 Leaf collection** | Day-and-point view in the URL, two-field keyboard entry, outlier confirmation, one-request session commit keyed for idempotency, per-row rejections kept on the line, void with a mandatory reason, entry withheld in a published month |
| **M4 Rates & month close** | Stored stage per month, the rate as two figures with correction before publish, exceptions as a resolvable work queue, and a publish gated on **six** refusals including four-eyes and the bill run |
| **M5 Bills** | A read model over M3's leaf × M4's rate, generated and re-generatable while the month is open, staleness derived at read time, the nine deduction lines with their total recomputed (BR-107), whole-rupee payment with the coins carried, and the slip rendered field-for-field for AC-03 |
| **M6 Payouts** | One run per month per method, refused against an unpublished month, lines held rather than dropped when there is nowhere to pay, four-eyes on the release, and per-line reconciliation with a mandatory reason on a failure |
| **M8 Savings** | Read-only. Balance as a liability, ledger derived from published bills only, oldest-first passbook, and the registry's balance following the ledger rather than sitting beside it |
| **M7 Credit queues** | One queue over all three facilities, the **eligibility working printed rather than summarised** (AC-05), a decision that carries the ceiling it was made against so `stale-eligibility` is enforceable (BR-310), `over-ceiling` refused on both sides, and an approval that raises the supplier's balance so the next bill deducts against it |
| **M9 Change requests** | Queue oldest-first, side-by-side comparison, approve/reject with mandatory note, four-eyes, already-decided |
| **M10 Inquiries** | Open/answered/closed as data (§21.18), reply and close-unanswered as **different acts**, prose-first triage grid, and the console saying plainly that no notification is sent because M13 is not built |
| **M17 Audit** | Filterable read-only log, plus per-record panels on M2 and M9. Every M3/M4/M5/M6 mutation writes to it |
| **Tests** | 169 Vitest + 13 Playwright, all passing. Typecheck and lint clean |

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
| AC-12 | A new factory goes live without a code deploy | ⚠️ Mechanism met — subdomain + config + no bundled identity. Unprovable until M14 exists |
| AC-03 | A bill matches the app's Home screen and the PDF field for field | ⚠️ **Console half met.** The slip renders every `GreenLeafBill` field in the printed account's order, and the derivation is shared (`packages/domain/src/bill.ts`) so the API cannot compute it differently. Integration-tested as identities — gross from kilos × rate, the nine lines summing to their total, whole rupees plus carried coins equalling the balance. **Unprovable end to end until the app reads the same endpoint**, and the PDF is not built |
| AC-07 | A flag off removes the surface **and** the endpoint refuses | ⚠️ **Console half met, API half now met for the two flags that have an off-tenant.** `enablePayouts` is off for `highland`, and `GET /admin/payout-runs` answers `403 feature-disabled` for it — asserted with a raw request carrying an explicit `X-Tenant`, which is how a replayed request or a hand-typed URL would arrive. The mechanism (`featureGate`) is in place for savings too; no fixture tenant has that flag off. **The real backend still has none of this** |
| AC-05 | Credit eligibility matches the app's, byte for byte, including the working | ⚠️ **Console half met.** M7 renders every intermediate figure — months of history against the requirement, the average account and the multiple, the last settled rate and the kilos it priced — and the derivation is shared (`packages/domain/src/leafCredit.ts`), so the API cannot compute it differently. Integration-tested as identities rather than as fixed numbers: the ceiling equals its own arithmetic. **Unprovable end to end until the app reads the same endpoint** |
| AC-08, AC-11 | Content fallback, FAQ | ⛔ Not assessable — M11 and M12 are not built |

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

2. **The API half of every feature flag exists only in the mock.** The console hides a
   disabled surface end to end, and the mock now refuses the payouts and savings
   endpoints with `403 feature-disabled` for a tenant that has the flag off — which is
   what closed the AC-07 argument for those two. But nothing refuses `POST /loans` at a
   factory that does not lend, because **there is no backend**. Until the real API
   reproduces `featureGate`, a flag is a UI preference for every module the mock has
   not been extended to cover.

3. **Refresh-token rotation is unverified.** The mock stands in for the httpOnly
   cookie with a `sessionStorage` entry, which is enough for the console to
   survive a reload but has **no rotation and no reuse detection**. Both are
   specified in [api-contract.md](./api-contract.md) §2.3 and testable only
   against the real backend.

4. **M17 has no export.** §18.1 says "read-only, exportable" and the export is not
   built. Same for M16's CSV/XLSX, **and now M6's payout file and M5's bill PDF** — the
   console has four places a document should come out of and produces none of them. The
   payout file is blocked on §21.17 rather than on effort; the other three are not
   blocked on anything. Deliberately not disabled buttons — a control that does nothing
   is worse than an absent one.

   *To close M5's:* the slip already renders every field in the printed account's
   order, so a PDF is a print stylesheet plus a server-side renderer for the copy the
   supplier is handed — not a second layout.

5. **M3's scale-file import is not built.** §18.2's data-entry story has two
   halves and only the keyboard one exists. `source: 'scaleFile'` is already in
   the type, the fixture and the grid's source column, and the import is meant to
   land as the same batch the grid commits — but **no factory has told us what
   its weighbridge exports**, and a parser written against a guessed format is a
   parser that gets thrown away. Blocked on a sample file, not on effort.

6. **The deduction values on a bill are the mock's invention, and only the values.**
   The *shape* is real — nine lines in the printed account's order, with the total
   recomputed from them (BR-107) — and two of the nine are genuine derivations the API
   must reproduce: `savings` is kilos × the supplier's approved rate, and
   `previousDebts` is last month's unpaid balance. **The other seven are made up**:
   transport at LKR 2.50/kg, credit instalments capped as a share of the gross, and a
   few fixed figures. §21.10 (which lines the office may set per supplier, and who may
   set them) is what decides them, so the console offers no editor and a demo bill's
   transport charge is not a number to quote at anybody. *To close:* the answer is a
   permission question as much as a form — see the blocking table below.

7. **A delivery is one net figure.** The console records `kgs` and nothing else.
   If a weighing point actually books a gross weight and a sack/water deduction —
   which is common practice and which nobody has confirmed either way — then this
   is a data-model gap, not a UI one, and it is cheaper to answer now than after
   a month has been published on the wrong column.

8. **Supplier create and edit are not wired.** `POST` and `PATCH` exist in the
   repository and the endpoint layer with full types, and no screen calls them.
   Registration is also blocked on §21.15 (who issues a code, what the supplier
   receives), so building the form first would be guessing at the flow.

9. **Evidence attachments are read-only.** M9 renders existing attachments and the
   upload path is fully built (`uploadRepository`, presign + PUT, validation) —
   but no screen calls it, because whether an attachment is *required* to approve
   a bank-details change is an open question.

10. **No error reporting.** A console error reaches `console.error` and nowhere
   else. `sentryDsn` is a placeholder on both sides.

11. **No console analytics.** §19.3's KPIs — app adoption and channel shift — need
    the `channel` column on office-raised requests, which the mock sets and the
    backend must too. Nothing measures console-side usage.

12. **Dark mode is off.** The palette exists and the bridge emits whichever scheme
    it is given; enabling it is a toggle plus a QA pass. Off because the console
    runs on office desktops in daylight and doubling the theming QA buys nothing.

13. **No screen-reader pass.** The semantics are built in — real tables,
    `aria-sort`, `role="alert"`, a clean accessible name on every field, a global
    focus ring — but nobody has driven NVDA or VoiceOver over it.

14. **The i18n table is English-only.** By decision, not omission (see
    [white-label.md](./white-label.md) → Localization). Every label goes through
    `t()`, so adding Sinhala is a copy deliverable. **M3's leaf-entry grid is now
    the surface that most needs it**, since weighing-point staff are not office
    staff — and it is the one screen a supplier stands in front of.

15. **The console's ceiling arithmetic is untested against the server's.** AC-05
    requires byte-for-byte agreement, and `packages/domain/src/leafCredit.ts` is
    the shared implementation — now rendered field for field by M7's eligibility
    panel and asserted as an identity (the ceiling equals its own working) rather
    than against a fixed number. **But nothing has yet compared it to a real
    `/advances/eligibility` response**, because there is no backend. Both sides
    calling one function is the mechanism; a live comparison is the proof, and it
    is the first test to write the day the API answers.

16. **An approved credit has no repayment schedule.** M7 raises
    `creditBalances[facility]` on approval, and M5 deducts an instalment against it
    next month — but the *share* it deducts (30% of gross for an advance, 20% for a
    loan, 15% for manure) is the mock's guess, and it is the other half of §21.10.
    Approving LKR 40,000 today therefore shows a plausible repayment and not a
    promised one, which is not a number to quote at a supplier.

17. **A supplier's pending requests are each priced against the same headroom.**
    Two open advances both read as approvable when only one of them is. The detail
    page links to the supplier's other open requests so an approver can see it, and
    the server re-checks at the moment of approval — so the *second* approval is
    refused with `over-ceiling` rather than paid. What is missing is the console
    saying so before the first one is decided. §21.5 is the rule question behind it.

18. **`enableInquiry` has no off-tenant.** M10's endpoint half of AC-07 is built —
    `featureGate` guards every inquiry route — and no fixture tenant turns the flag
    off, so it is unasserted. Exactly the same gap savings has, and it means the
    flag is a UI preference for M10 until either a fixture tenant or the real API
    refuses the call. M7's half **is** asserted: `highland` sells advances and not
    loans or manure, and a loan reached by its own URL answers `feature-disabled`.

---

## Blocking business questions

These stop specific modules. Numbering follows `status.md` §21 in the mobile repo,
so an answer can be recorded in one place.

### Stops a module I could otherwise build now

| § | Question | Blocks |
| --- | --- | --- |
| 21.15 | **Registration** — how does a new supplier get a code and a login? Who creates it, and what does the supplier receive? | M2 create |
| 21.16 | **Password reset** — the app says "contact the factory". What does the office actually do, and how is the supplier's identity checked? | M2's reset action, currently disabled with an explanation. The wrong flow here is an account-takeover path |
| 21.24 | **Notifications** — does the office compose every send, or does bill-published fire automatically off the publish step? Who may send free text? | M13. M5 has now given the trigger a real event to hang off — `month.publish` is the moment a bill becomes something the supplier can see |

### Stops one control inside a module that is otherwise built

These three used to read as "blocks M5 / M6 / M8 entirely". Building the three modules
showed that each blocks a **single control** rather than a module, which is a much
smaller ask of the factory — and the console now says so on the screen where somebody
would look for it.

| § | Question | Blocks |
| --- | --- | --- |
| 21.17 | **Payout files** — SLIPS, CEFTS or a bank-specific CSV? Cheques on pre-printed stock? | M6's **file export**, not M6. The run, the release and the reconciliation are built; a serialiser against a guessed format is one that gets thrown away |
| 21.9 | **Savings** — may a supplier withdraw, with what notice, is interest paid? | M8's **movements**, not M8. The balance, the passbook and the totals are built; `SavingsEntrySource` already carries `withdrawal` and `interest`, so the answer adds endpoints rather than migrating a money table |
| 21.10 | **Deduction authority** — which lines may the office set per supplier per month, and **who may set them**? | M5's **deduction editor**. The nine lines are on the slip and seven of their values are the mock's invention (gap 6). It is a permission question as much as a form, which is why it is not a guess worth making |
| 21.8 | **Corrections** — may a published bill be corrected, or is an error always adjusted on the next account? | Nothing today. The console **assumes not**, which is BR-108's lock already in place, and says so on a published slip. If the answer is yes, that is a new audited reversal endpoint — never a relaxation of the lock |

### Shapes a module without stopping it

| § | Question | Effect |
| --- | --- | --- |
| 21.6 | **Approval thresholds** — above what amount must a manager rather than a clerk approve? | M7, **now built without it**. `canApproveAmount(…, null)` treats "not configured" as "the base capability suffices", so the answer becomes tenant config rather than a rewrite. Note §12.1 already puts every credit decision with the manager, so the question is really about escalating *above* the manager |
| 21.5 | **Stacking** — does a pending request block another of the same type? | M7's queue behaviour. The console currently allows it and prices each request against the same headroom, which means two pending advances can each look approvable and only one of them is. The detail page links to the supplier's other open requests so the approver can see it; whether the *rule* should refuse the second is the open question |
| 21.13 | **Collection points** — first-class entities, or does the division suffix suffice? | Already modelled as first-class in the config and the supplier record. Reporting by route needs it, so this is the right guess — but it is a guess |
| 21.18 | **Inquiry statuses** — is Resolved/Closed the right pair? | M10, **now built with both**. `INQUIRY_STATUSES` is data and `inquiryStatusForApp` is the single place the console's three states map onto the app's three words — an answer that adds `escalated` adds a row, not a migration. The mapping is knowingly imprecise: a closed message becomes the app's `rejected`, because those are the only words the app has |
| 21.12 | **Retention** — for bills, payout records, delivery data | M17's retention policy, and §20.4 |

### Questions the console raises that §21 does not

**Who may reveal a full bank account number?** §20.4 says "except to roles that
need them" without naming them. The console currently gates the reveal on
`suppliers: read`, which is every role except editor — almost certainly too broad.
It should probably be clerk and accountant only, and it is a one-line change once
the factory says.

**Is a whole-rupee payout right?** The bill pays whole rupees and carries the cents as
the slip's "coins" line, which is what `coinsBroughtForward` and `coinsCarriedForward`
in the shared type imply and what the printed account appears to do. Nobody has
confirmed it, and it is not a rounding preference — it decides whether a payout line is
`LKR 4,213.00` or `LKR 4,213.47`, and a bank file the factory's bank rejects on the
decimal is a payout run that has to be re-sent.

**Are the deductions settled in instalments, and who decides the share?** The console
caps a credit instalment as a share of the gross so a facility cannot swallow a whole
month, because a supplier paid nothing telephones the office and is right to. The
*shares* are a guess (30% advance, 20% loan, 15% manure). This is the other half of
§21.10.

Building M3 raised three more, all of them cheap to answer now and expensive
after a month has been published on the wrong assumption:

| Question | What the console assumes today |
| --- | --- |
| **Gross or net?** Does the weighing point record one figure, or a gross weight and a deduction for the sack and surface water? | One net `kgs` per weighing. If the answer is two, it is a schema change (gap 7 above) |
| **What is a plausible delivery?** The grid questions a figure over 150 kg that is also 3× the session's mean. Those numbers are a guess sized for smallholder routes | `OUTLIER_KG_MULTIPLE` and `OUTLIER_KG_FLOOR_KG` in `@tfd/domain`, and the same pair raises M4's `outlierDelivery` exception. Tenant config once the factory has a number |
| **How far back may leaf be entered?** A paper slip found on Monday for Saturday's weighing is normal; a row backdated three weeks into a month about to close is not | Any date in an unpublished month is accepted. The publish lock is the only guard, which is a policy nobody chose |

---

## What I would build next

1. **The bill PDF.** The slip renders every field in the printed account's order, so
   this is a print stylesheet plus a renderer for the copy the supplier is handed — not
   a second layout. It is the last thing standing between the console and AC-03 being
   assessable end to end, and it is blocked on nothing.
2. **The scale-file import for M3.** The entry grid is built; the other half of
   §18.2's data-entry story is a scale file the weighing point can upload, and
   `source: 'scaleFile'` is already in the data waiting for it.
3. **M11 / M12 Content.** Nothing external blocks them, and AC-08 — a missing
   translation being visible to the editor rather than silently falling back — is the
   last acceptance criterion with no screen behind it at all.
4. **The repo merge**, before the shared types drift far enough to hurt.

**Not next, and why:** M13 Notifications is tempting now that `month.publish` is a real
event to fire "your bill is ready" from — but §21.24 has to say whether that send is
automatic or composed by hand before a single line of it is worth writing.
