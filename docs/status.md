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
console, which is the promise the whole product rests on. Then **M11 and M12**, the
Content section — the smallest slice that closes an acceptance criterion outright, because
AC-08 was the last one with no screen behind it at all — followed by **M13**, built at the
factory's request with §21.24 answered as configuration rather than code.

Now **M14, M15 and M16**, the Administration section, which is the slice that turns a
console that can be *demonstrated* into one that can be *handed over*: every field of a
factory's `client_config` row has a control (AC-12), the §12.1 matrix is editable so
[rbac.md](./rbac.md)'s central claim is finally true, and the figures the office quotes come
out of the records rather than out of a spreadsheet. **All seventeen §18.1 modules now have
a route.** What is unfinished is no longer module-shaped — see the gaps below, every one of
which is a named absence inside a built module.

| Area | State |
| --- | --- |
| **Workspace** | npm workspaces: `@tfd/domain`, `@tfd/brand`, `@tfd/admin`. Packages consumed as TS source, no build step |
| **Runtime white-label** | Subdomain → tenant → `GET /config` → CSS custom properties → Tailwind tokens. Three tenants, one of them reduced-feature |
| **Auth realm** | Separate from suppliers. Password → optional TOTP → in-memory access token + httpOnly refresh cookie, with refresh-on-401 |
| **RBAC** | The §12.1 matrix as data, server grants overriding per capability, four-eyes, capability route guards |
| **Transport** | Axios with domain-code-preserving errors, tenant header, idempotency keys, single-retry refresh |
| **Mock API** | MSW: 84 suppliers, 14 change requests, 14 credit requests, 7 inquiries, **eight months of delivery rows**, months with stored stages and derived exceptions, bills and savings ledgers chained month to month, payout runs in every state, 3 tenants, **6 console users whose suspensions and roles actually take effect on the next request**, an editable §12.1 matrix, five news articles and the app's six fixed pages in si/en/ta — enforcing every refusal the real API must |
| **UI kit** | 15 token-driven primitives, keyboard-navigable data grid, i18n throughout |
| **M1 Dashboard** | Queue cards with age and SLA, month-cycle stage, today's leaf, server-composed alerts, 14-day trend — the leaf figures now derived from M3's rows, so committing a session moves the card |
| **M2 Suppliers** | Search/filter/sort grid with URL state, detail, suspend/reactivate, the audited bank reveal |
| **M3 Leaf collection** | Day-and-point view in the URL, two-field keyboard entry, outlier confirmation, one-request session commit keyed for idempotency, per-row rejections kept on the line, void with a mandatory reason, entry withheld in a published month |
| **M4 Rates & month close** | Stored stage per month, the rate as two figures with correction before publish, exceptions as a resolvable work queue, and a publish gated on **six** refusals including four-eyes and the bill run |
| **M5 Bills** | A read model over M3's leaf × M4's rate, generated and re-generatable while the month is open, staleness derived at read time, the nine deduction lines with their total recomputed (BR-107), whole-rupee payment with the coins carried, and the slip rendered field-for-field for AC-03 |
| **M6 Payouts** | One run per month per method, refused against an unpublished month, lines held rather than dropped when there is nowhere to pay, four-eyes on the release, and per-line reconciliation with a mandatory reason on a failure |
| **M8 Savings** | Balance as a liability, ledger derived from published bills only, oldest-first passbook, and the registry's balance following the ledger rather than sitting beside it. **Withdrawals (§21.9)**: asked for in a configurable window (April by default), paid on the next Green Leaf Account, and posted to the passbook only when that account is published — so there is still exactly one thing that moves a balance |
| **M7 Credit queues** | One queue over all three facilities, the **eligibility working printed rather than summarised** (AC-05), a decision that carries the ceiling it was made against so `stale-eligibility` is enforceable (BR-310), `over-ceiling` refused on both sides, and an approval that raises the supplier's balance so the next bill deducts against it |
| **M9 Change requests** | Queue oldest-first, side-by-side comparison, approve/reject with mandatory note, four-eyes, already-decided |
| **M10 Inquiries** | Open/answered/closed as data (§21.18), reply and close-unanswered as **different acts**, prose-first triage grid, and the reply screen reading M13's `inquiryReplied` trigger so it says whether a notification actually goes out rather than a sentence that was true when it was written |
| **M11 News** | Per-language authoring with the fallback and the gap lists shared with the app (`content.ts`), a server-resolved preview, a "live with a gap" working list, and publish/unpublish/archive split from writing by §12.1 |
| **M12 Static content** | The app's six fixed pages, unwritten ones shown as a state rather than omitted, and every edit to a live page audited with its previous wording |
| **M13 Notifications** | Automatic triggers as per-tenant data (§21.24 deferred as config, not guessed), a reach preview that counts opt-outs before anything is sent, composed sends gated on `content: A`, and a log where reached and suppressed sit side by side |
| **M14 Configuration** | Five independently-patched sections covering the **whole** `client_config` row (AC-12), the tenant id shown and immutable, and every edit's consequences computed from the shared `configImpact` **before** the save — a flag holding money is refused with the figure, a collection point with leaf against it cannot be removed, and the fallback language cannot be dropped |
| **M15 Users & roles** | Invite, re-role, suspend and reactivate with a mandatory reason, the §12.1 matrix **editable as data**, and three lockout guards including the one nobody thinks of: a matrix in which no role grants `usersAndRoles` is refused, because every user keeps their roles while nobody can ever manage users again |
| **M16 Reports** | Four reports, each carrying the citation that justifies it, computed from live records at request time; self-describing columns so one screen renders any report; totals only under the columns that add up; and the month list served behind the `reports` grant rather than `billing` |
| **M17 Audit** | Filterable read-only log, plus per-record panels on M2, M9 and M11. Every mutation in every built module writes to it |
| **Tests** | 342 Vitest + 29 Playwright. Typecheck and lint clean |

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
| AC-12 | A new factory goes live without a code deploy | ✅ **Met, and now demonstrable field by field.** M14 puts a control on every block of the `client_config` row — identity, the ten flags, collection points, banks, savings rates, languages, branding, push — so there is no value left that needs a developer. The console bundles no factory identity, resolves the tenant from the subdomain, and reads the row at runtime. **One step is still outside the console:** inserting the row for a factory that does not have one. §12.1 has a `tenants` capability and §18.1's seventeen modules have no screen behind it, so the first row is created by whoever adds the DNS record — the same act, by the same person, which is what AC-12 describes. Everything *after* that is this screen |
| AC-03 | A bill matches the app's Home screen and the PDF field for field | ⚠️ **Console half met.** The slip renders every `GreenLeafBill` field in the printed account's order, and the derivation is shared (`packages/domain/src/bill.ts`) so the API cannot compute it differently. Integration-tested as identities — gross from kilos × rate, the nine lines summing to their total, whole rupees plus carried coins equalling the balance. **Unprovable end to end until the app reads the same endpoint**, and the PDF is not built |
| AC-07 | A flag off removes the surface **and** the endpoint refuses | ⚠️ **Console half met, mock API half met for every flag.** Two ways round: `enablePayouts` is off for `highland` and `GET /admin/payout-runs` answers `403 feature-disabled` for it, and — since M14 — a flag can be turned **off through the console** and the endpoint behind it refuses on the next request. That second path is asserted with a clerk's token taken *before* the change and replayed after it, which is how a hand-typed URL arrives; it is also what closed the old "`enableInquiry` has no off-tenant" gap, because the off-tenant is now made rather than found. It caught a real defect on the way in: the gate read the **seed** while `GET /config` served live state, so a flag turned off removed the sidebar row and the route while every endpoint behind them kept answering. **The real backend still has none of this** |
| AC-05 | Credit eligibility matches the app's, byte for byte, including the working | ⚠️ **Console half met.** M7 renders every intermediate figure — months of history against the requirement, the average account and the multiple, the last settled rate and the kilos it priced — and the derivation is shared (`packages/domain/src/leafCredit.ts`), so the API cannot compute it differently. Integration-tested as identities rather than as fixed numbers: the ceiling equals its own arithmetic. **Unprovable end to end until the app reads the same endpoint** |
| AC-08 | Content falls back to English, and the gap is visible to the editor | ✅ **Met.** The fallback is `resolveTranslation` in `@tfd/domain`, shared so the API cannot resolve it differently, and the preview is fetched from the server rather than composed by the console. The gap appears on the tab for the language that has it, on the list row, in a "live with a gap" filter, in the publish confirmation, and in the publish audit entry. Integration-tested as identities between the preview and the shared function. Also flags **stale** copy — written before the English it was translated from — which AC-08's wording does not cover and an office hits second |
| AC-11 | The FAQ | ✅ Met — M12 carries the app's six fixed pages, and the FAQ is written in all three languages in the fixture. A page the factory has never written is shown as such rather than omitted, because the app is rendering its own bundled default |

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
   disabled surface end to end, and the mock now refuses **every** flagged endpoint with
   `403 feature-disabled` — either for a fixture tenant that has the flag off, or for a flag
   an administrator turns off through M14, which is the same mechanism reached the way a
   factory would actually reach it. But nothing refuses `POST /loans` at a factory that does
   not lend, because **there is no backend**. Until the real API reproduces `featureGate`, a
   flag is a UI preference — and the console's own gate is a courtesy, not a control.

3. **Refresh-token rotation is unverified.** The mock stands in for the httpOnly
   cookie with a `sessionStorage` entry, which is enough for the console to
   survive a reload but has **no rotation and no reuse detection**. Both are
   specified in [api-contract.md](./api-contract.md) §2.3 and testable only
   against the real backend.

4. **M17 has no export, and neither has M16.** §18.1 says "read-only, exportable" and
   neither is built. **M6's payout file now is** — through a configurable layout rather than
   a guessed format (see §21.17 below) — which leaves M5's bill PDF as the other document
   the console should produce and does not. So: four places a document should come out of,
   one of which now does. None of the remaining three is blocked on anything. Deliberately not disabled buttons — a control that does nothing
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

14. **The chrome is translated; its dates, numbers and money are not.** ~~The i18n
    table is English-only.~~ **Closed** — `src/i18n/locales/` now carries si/en/ta,
    typed against English so a missing key fails the build, with a picker in the
    topbar and on sign-in (see [white-label.md](./white-label.md) → Localization).
    What did *not* come with it: `src/lib/format.ts` builds its `Intl` formatters as
    module constants pinned to `en-GB` and `en-LK`, so a Tamil console still reads
    "04 Aug 2026" and "3,549.16 kg" — the unit suffix is a hardcoded English string
    too. Arguably right for an audit trail, where a figure that reads the same in
    every language is a figure two people can agree on over the phone; but it is a
    **decision nobody has actually taken**, and it should be taken rather than
    inherited from the order the work happened in. *To close:* decide, then either
    thread the active language into those formatters or write down why not.

    Two consequences of the tables themselves, both measured:

    - **Every clerk downloads all three languages.** The tables sit in the
      always-loaded `index` chunk, and si + ta are **~54 kB gzip** of it — measured
      as the difference between an en-only build and this one (see
      [operations.md](./operations.md) → Performance). Splitting them per language
      is a `resources` change plus a lazy `addResourceBundle`; it has not been done
      because the console is a desktop product on office broadband, and that is the
      reason to leave it rather than an excuse not to notice.
    - **Nothing enforces cross-script correctness.** The type system guarantees a
      Tamil key *exists*; it cannot guarantee the value is Tamil. Sinhala and Tamil
      share glyph shapes across unrelated code points — U+0DD2 and U+0BBF are near
      enough visually that a wrong one is invisible in review — and two such slips
      were caught by comparing code points, not by reading. *To close:* a unit test
      asserting each table's values fall in its own script range.

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

18. ~~**`enableInquiry` has no off-tenant.**~~ **Closed by M14**, and the way it closed is
    worth keeping: rather than adding a fourth fixture tenant with the flag off, the test
    turns the flag off *through the configuration screen* and replays a clerk's existing
    token — so the assertion is about the mechanism a factory would actually use rather than
    about a fixture. Every flag now has an off-tenant on demand. It also found a defect in
    the process: the mock's flag gate read the seed while `GET /config` served live state, so
    the surface disappeared and the endpoints did not.

19. **No Sinhala or Tamil in this repository has been reviewed by a native speaker —
    and that is now the whole chrome, not just the fixtures.** It was five articles and
    six pages; it is now those **plus ~1,250 console labels in each language**, which is
    the largest unreviewed surface in the project by a wide margin.

    It is real script rather than Latin placeholders on purpose — the `[lang="si"]` and
    `[lang="ta"]` line-height and wrapping rules (§20.2) cannot be exercised by English
    three times over, and a right-to-length bug would ship. But it is approximate, and
    **approximate Sinhala in front of a Sinhala-speaking office is worse than an obvious
    gap**: a gap is a question and bad copy is an answer. The chrome raises the stakes,
    because a clerk cannot route around a mistranslated button the way they can skip a
    news article — and the domain words are exactly where a translator without the
    printed account in hand will go wrong. The tables follow the paper — `bills.detailTitle`
    is දළු ගිණුම in Sinhala and கொழுந்து கணக்கு in Tamil, the words a supplier reads on
    their own account every month, not a dictionary rendering of "Green Leaf Account" —
    and that is a judgement which needs confirming rather than trusting.

    *To close:* two deliverables, and the second is no longer half an hour. (a) The
    factory's staff write the fixture's five articles and six pages. (b) Somebody who
    works in the office reads the si and ta tables against the screens — cheapest as a
    walkthrough in each language, since the labels only make sense in place. **Do both
    before the console is demonstrated in either language.**

20. **Content is plain text, and the FAQ is the case that strains it.** A body keeps its
    line breaks and nothing else — no headings, no links, no lists. The fixture's FAQ is
    therefore questions and answers separated by blank lines inside one field, which reads
    acceptably and is not what it is. Whether the app renders Markdown, a subset of HTML,
    or structured Q&A pairs is a **mobile** decision the console has to follow, not lead:
    a rich editor built against a guess produces copy the app renders as literal asterisks.
    *To close:* ask what the app's content renderer does today.

21. **A published article cannot be scheduled, and a cover image cannot be uploaded.**
    Publishing is immediate, and `coverImageUrl` is on the type and settable through the
    API with no way to put a file behind it — `uploadRepository` exists and does presign +
    PUT for M9's evidence, so this is wiring rather than design. Both are absent rather
    than half-built. Neither is blocked on anything.

22. **§21.24 is answered by the console, not by the factory.** The defaults are read from
    `push.defaultCategories` rather than invented, and every choice is a toggle — but
    nobody at the factory has confirmed that a bill publication *should* push to every
    supplier, or that `content: approve` is the right gate on free text. Both are the
    console's reading, and both are one row and one line respectively to change. *To
    close:* show the office the Notifications screen and ask whether the four switches are
    set the way they want them.

23. **Nothing is actually sent, and nothing ever reports back.** There is no FCM or APNs
    integration — the mock records a send and computes its reach, which is every part of
    the problem *except* the transport. When the real one lands it brings a failure mode
    the console currently has no shape for: a per-device delivery result arriving
    asynchronously, minutes later. `NotificationSend.status` already has `queued` and
    `failed` in its vocabulary for that reason, and nothing sets them yet.

24. **A composed notification is English-only.** M11 taught the console that editorial copy
    is authored in three languages and falls back (AC-08); a push does not, and it should —
    a Sinhala supplier receiving an English lock-screen message is the same failure AC-08
    is written about, in the one place the supplier cannot go and find the translation.
    Deliberately not half-built: doing it properly means the composer grows the same
    language strip M11 has, and the send picks per device.

25. **M16 reads the same store a clerk is writing to.** §19.5 asks that reports run off a
    **read replica** so a month-close query does not compete with leaf entry, and the mock
    has one store. That is a deployment concern rather than a console one — but the four
    reports are written as single-pass scans over live records precisely so that moving them
    to a replica is a connection string and not a rewrite. Recorded because "the report is
    slow during month close" is the failure it produces, and it will look like a console bug.

26. **The report list is four long because §19.1 is in the other repository.** Each of the
    four is defined by something already in this codebase and carries that citation on the
    row. The rest of what the factory asked for needs the warehouse shape, and a report
    invented to fill the list is a query somebody maintains and nobody reads. The screen says
    this where somebody would look for the missing reports, rather than leaving the shortness
    to be read as an oversight.

27. **A created user's password is the demo password, and nothing forces a change.** M15
    invites a user and the mock gives them `demo1234`, which is why the success toast says
    *"tell them their password"*. A real API issues a one-time credential the office cannot
    read back, and insists on a change at first sign-in. Neither exists here, and the
    console has no screen for either — this is the one place in the console where the mock is
    weaker than the contract rather than equal to it.

28. **MFA is owed and never collected.** `MFA_REQUIRED_ROLES` marks manager and above, the
    user list shows *Two-factor not set up*, and the sign-in demands a code from anyone who
    **is** enrolled — but nothing enrols anybody. The only MFA control that exists is the
    reset, which un-enrols. So a manager who owes a second factor signs in with a password
    indefinitely, and the badge is a note rather than a gate. *To close:* an enrolment step
    at first sign-in for a role that requires it, which is a screen plus a TOTP secret the
    server issues — and it is where §18.1 expected MFA enrolment to live.

29. **The role matrix has no "restore the standard roles".** A factory that has narrowed
    six roles has no single control to put them back, and `DEFAULT_ROLE_MATRIX` is right
    there in the bundle. Left out deliberately: a one-click reset of every permission in the
    console is a control whose worst case is worse than the inconvenience it saves, and the
    matrix already says whether it has diverged. If it is wanted, it should be a confirm
    dialog naming what changes, not a button.

30. **The payout template covers the CSV family and not the fixed-width one.** §21.17 is
    now half answered — a factory sets its own column order, headings, delimiter and number
    formats in M14, and M6 writes the file through them. What a column template cannot
    express is a **fixed-width record layout with control totals or a checksum**, which is
    what SLIPS may turn out to need, and it cannot print a cheque on pre-printed stationery
    at all. The presets named `SLIPS` and `CEFTS` are therefore **headerless skeletons with
    the labels left blank**, not claims about those layouts — and the screen says so above
    the editor. *To close:* one sample file, or the bank's specification page.

31. **Interest has a rate and no basis.** §21.9's answer set both the withdrawal month and
    an interest rate, and the console stores and shows the rate — but it **applies nothing**,
    because nobody has said what the rate is calculated on. Closing balance rewards a
    supplier who paid in late as much as one who held a balance all year; the year's minimum
    balance is the usual passbook rule and cannot be gamed. On a 5% rate those differ by a
    lot, and this is the supplier's own money. Harmless today — the default is 0% — and the
    screen says so where somebody would expect the console to start accruing. *To close:* ask
    which of the two, then it is one posting job and an `interest` ledger entry, which the
    ledger's vocabulary already has a word for.

32. **`otherCards` is the last invented deduction line.** §21.10's answer covered eight of
    the nine: transport and stamps are the factory's approved rates, the three credit
    instalments are the supplier's chosen period under a cap, savings is M9, previous debts
    is derived, and tea becomes an app request. Nobody has said what *other cards* is, so it
    is still `LKR 260 for every seventh supplier` and still uneditable. Harmless in the
    fixture and wrong in production. *To close:* one sentence from the office.

33. **The app cannot yet ask for tea, or choose a repayment period.** §21.10's answer puts
    three things in the mobile app that are not there: a **tea-packet request**, and a
    **repayment period** on the loan and fertilizer requests. The console is ready for the
    second — `AdminCreditRequest.repaymentMonths` is on the type, the fixture carries it on
    every third request, and `creditInstalment` honours it — but nothing sends it, so live
    requests fall back to the cap alone. The tea request has no console queue yet either.
    Both are app work first.

---

## Blocking business questions

These stop specific modules. Numbering follows `status.md` §21 in the mobile repo,
so an answer can be recorded in one place.

### Stops a control inside a module, and no module any more

Nothing here blocks a module — all seventeen are routed. Both of these stop a **supplier
identity** operation, which is the one area of the console where the wrong flow is worse than
no flow:

| § | Question | Blocks |
| --- | --- | --- |
| 21.15 | **Registration** — how does a new supplier get a code and a login? Who creates it, and what does the supplier receive? | M2 create. The endpoint and types exist; no screen calls them, because the form is the *flow* and the flow is the question |
| 21.16 | **Password reset** — the app says "contact the factory". What does the office actually do, and how is the supplier's identity checked? | M2's reset action, currently disabled with an explanation. The wrong flow here is an account-takeover path |
| 21.24 | **Notifications** — does the office compose every send, or does bill-published fire automatically off the publish step? Who may send free text? | **Nothing.** Built as configuration instead: every trigger is a row and "who may send free text" is `content: approve`, stated on the screen so it can be contested. This is what an unanswered question should cost — a switch to flip, not a rewrite. See gap 22 |

### Stops one control inside a module that is otherwise built

These three used to read as "blocks M5 / M6 / M8 entirely". Building the three modules
showed that each blocks a **single control** rather than a module, which is a much
smaller ask of the factory — and the console now says so on the screen where somebody
would look for it.

| § | Question | Blocks |
| --- | --- | --- |
| 21.17 | **Payout files** — SLIPS, CEFTS or a bank-specific CSV? Cheques on pre-printed stock? | **Half answered, as configuration.** M6 now writes a delimited file through a layout the factory sets in M14 (`payoutExport.ts`), which covers the family most banks' bulk-upload sheets belong to — so "SLIPS" is a preset somebody completes once their bank confirms it, not a release. Still open: a **fixed-width** format with control totals (rules, not a column order) and **cheques on pre-printed stock** (millimetres on a specific cheque book). Both are stated on the screen |
| 21.9 | ~~**Savings** — may a supplier withdraw, with what notice, is interest paid?~~ | **Answered and built.** *Yes, normally in April, but the month must be changeable; interest is changeable too and starts at 0% a year; the money is paid on the next Green Leaf Account.* Both values are `client_config`, so the month is a row rather than a release. `SavingsEntrySource` already carried `withdrawal`, so it was endpoints rather than a migration — exactly what that vocabulary was reserved for. **Still open: what interest is calculated *on*** — closing balance or the year's minimum, simple or compound. Those pay different money, so the console records the rate and posts nothing of its own |
| 21.10 | ~~**Deduction authority**~~ | **Answered, and it reshaped the question.** *Almost nothing is typed per supplier.* Transport-per-kg and stamps are one factory figure each, changed by the manager **with a second person approving** (the factory asked for that). The credit instalments are the supplier's own repayment period under a share-of-gross cap the factory sets. Tea, fertilizer and the advance are asked for **from the app**. Fertilizer is a console catalogue with **bag size and price**, so a request is priced from the list rather than typed. **Still open: `otherCards`** — the one line nobody has explained, and the only one still invented |
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
3. **MFA enrolment** (gap 28), which is the largest hole the Administration slice left
   behind: the console now names who owes a second factor and still has no way for them to
   set one up. It is one screen and a server-issued secret, and until it exists the *Two-factor
   not set up* badge is a note rather than a gate.
4. **The repo merge**, before the shared types drift far enough to hurt.

**Every module in §18.1 now has a route, and that changes what this list is for.** It is no
longer a build order — it is the four things that would make what exists trustworthy in
production rather than demonstrable in a meeting. Nothing on it is blocked on the factory;
the things that are, are in the tables above.

**M13 was built out of order, at the factory's request**, and the way it was built is the
point: §21.24 is answered as **configuration** rather than code. Which categories fire
automatically is a per-tenant row, defaulted from `push.defaultCategories` — the platform's
own existing statement about which categories are routine — and "who may send free text" is
`content: approve`, stated on the screen so it can be contested. When the factory answers,
somebody flips a switch. See gap 22 for what is still genuinely unknown.

**M14 answered a question the other modules kept asking.** Seven of them read a config value
that had no editor — `contentLanguages` for M11 and M12, `push.defaultCategories` and the
topic prefix for M13, `savings.perKgOptions` for M8, the collection points for M3, the bank
list for M2 and M6. Every one of those was a value the console *depended* on and a developer
*owned*. That is the sense in which AC-12 was mechanised but not met.
