# Status

What works, what is deliberately unfinished, and what only the factory can answer.
Read this before planning the next slice.

Written in the mobile repo's `status.md` voice on purpose: **anything marked a gap
is exactly that.** Nothing here is quietly assumed to be solved.

The v1 status — the seventeen-module console, its acceptance-criteria coverage and
its open questions — is kept unchanged at [../v1/status.md](../v1/status.md). It is
the reference for the factory's own build, and this document does not restate it.

---

## What is built

**v2 is a boundary, not a milestone.** The console manages the mobile app; the
factory's own console runs the factory. What that changed:

| | |
| --- | --- |
| **Handed back** | M3 leaf collection, M4 rates & month close, M6 payouts, M8 savings. Commented out, not deleted — see [modules.md](./modules.md) |
| **Narrowed** | M1 to app adoption and content health · M2 to the app account · M5 to a read-only support view · M16 to `channelShift` |
| **Built** | **M18 tea packets** and **M11's banner editor** — two surfaces the app has always had and this console never did |
| **Corrected** | The feature flag set, which claimed to be the app's and was four flags short in one direction and two long in the other |

The last row is the one to read twice. `FeatureFlagSet`'s docblock said *"identical
to the app's set"*; the type held ten against the app's fourteen. Six flags the app
gates real screens on had **no control anywhere in this console**, which made AC-12
false on the very screen that is AC-12 — and nothing failed, because a comment
cannot.

| Area | State |
| --- | --- |
| **Workspace** | npm workspaces: `@tfd/domain`, `@tfd/brand`, `@tfd/admin`. Packages consumed as TS source, no build step |
| **Runtime white-label** | Subdomain → tenant → `GET /config` → CSS custom properties → Tailwind tokens. Three tenants, one of them reduced-feature |
| **Auth realm** | Separate from suppliers. Password → optional TOTP → in-memory access token + httpOnly refresh cookie, with refresh-on-401 |
| **RBAC** | The §12.1 matrix as data, server grants overriding per capability, four-eyes, capability route guards |
| **Transport** | Axios with domain-code-preserving errors, tenant header, idempotency keys, single-retry refresh |
| **Mock API** | MSW: 84 suppliers, 14 change requests, 14 credit requests, **6 tea-packet requests**, 7 inquiries, five news articles, **four banners in every window state**, the app's six fixed pages in si/en/ta, 3 tenants, 6 console users whose suspensions take effect on the next request — enforcing every refusal the real API must. The v1 money-chain fixtures and handlers are all still there, feeding the commented-out modules |
| **UI kit** | 15 token-driven primitives, keyboard-navigable data grid, i18n throughout |
| **M1 Dashboard** | Queue cards with age and SLA (now six queues), app-adoption figures, content-health figures, server-composed alerts, and a 12-month adoption trend whose line **breaks** on a month with no requests rather than dropping to zero |
| **M2 Suppliers** | The app account **and the support desk**: `hasApp` in three states with a `?hasApp=false` filter the dashboard links into; a **month history** in the app's own three views (graph / list / deductions); a **push diagnosis** naming per category why a supplier would or would not be reached, with the sends that actually went to them; links into all four queues; the audited bank reveal and the §21.15/§21.16 password reset. Everything else read-only |
| **M5 Bills** | Read-only. The slip rendered field-for-field for AC-03, the nine deduction lines with their total recomputed (BR-107), the three lenses. `BillRunCard` commented out, because a control nobody on this screen may use is not a control |
| **M7 Credit queues** | Unchanged: one queue over three facilities, the eligibility working printed rather than summarised (AC-05), `stale-eligibility` (BR-310), `over-ceiling` refused on both sides |
| **M18 Tea packets** | **New.** One screen, no detail page, because there is no eligibility working to print. Packets and kilos side by side, the delivery filter as the storekeeper's working view, the price stamped at the decision, the stock cap refused on approval and **not** on rejection, and approved-unrecovered value blocking the flag in M14 |
| **M9 Change requests** | Unchanged: oldest-first, side-by-side comparison, mandatory note, four-eyes, already-decided |
| **M10 Inquiries** | Unchanged: reply and close as different acts, prose-first triage, reading M13's trigger so it says whether a push actually goes out |
| **M11 News** | Unchanged: per-language authoring, shared fallback and gap lists, server-resolved preview, "live with a gap" working list |
| **M11 Banners** | **New.** The window as the primary column rather than the status, the live lens by default, the app's own `bannerTarget()` run at every write, `teafactory://` refused by name, and a publish that allows a translation gap and refuses a broken button |
| **M12 Static content** | Unchanged: six fixed pages, unwritten ones shown as a state, every edit to a live page audited with its previous wording |
| **M13 Notifications** | Unchanged: triggers as per-tenant data, a reach preview that counts opt-outs before anything is sent, composed sends gated on `content: A` |
| **M14 Configuration** | **Seven** independently-patched sections covering the whole `client_config` row (AC-12) — including the fourteen flags and the new tea-packet policy — with every edit's consequences computed from the shared `configImpact` before the save |
| **M15 Users & roles** | Unchanged: invite, re-role, suspend with a reason, the §12.1 matrix editable as data, three lockout guards |
| **M16 Reports** | One report — `channelShift`, §19.3's KPI — computed from live records, self-describing columns, `null` never rendered as `0` |
| **M17 Audit** | Filterable read-only log, plus per-record panels. Two new entity types (`promoBanner`, `teaPacketRequest`) and **`actorType`** — which is what finally records the supplier's own app writes, interleaved with the office's actions on the same record |
| **Tests** | 382 Vitest passing + Playwright. Typecheck and lint clean. The v1 suites for handed-back modules are commented out with their reason; `teaPackets.test.ts`, `banners.test.ts` and `supplierSupport.test.ts` are new |

## Acceptance criteria

Against `docs/admin-console.md` §18.3. **v2 changes what four of them can be
assessed against**, because the module they were written for is no longer here.
Stated rather than quietly reinterpreted.

| # | Criterion | State |
| --- | --- | --- |
| AC-01 | App and M2 show the same active bank details, savings rate, payment method | ✅ Met — the detail screen shows active values only; a pending change renders as pending. **The write side is now the factory's console's**, which makes this an integration criterion rather than a console one |
| AC-02 | Approving changes the app's displayed value; rejecting leaves it and shows the note | ✅ Met, with an integration test on both halves |
| AC-05 | Credit eligibility matches the app's, byte for byte, including the working | ⚠️ **Console half met.** Every intermediate figure is rendered and the derivation is shared (`leafCredit.ts`). Unprovable end to end until the app reads the same endpoint |
| AC-06 | Rejecting without a note is impossible | ✅ Met at three layers on every queue, **including M18** |
| AC-07 | A flag off removes the surface **and** the endpoint refuses | ✅ **Console half met, mock API half met for every flag** — and v2 widens it: the criterion now covers all fourteen of the app's flags rather than ten, and the two console-only flags it used to be demonstrated with are gone. Asserted for `enableTeaPackets` and `enablePromoBanner` with a token taken *before* the change and replayed after it, which is how a hand-typed URL arrives. **The real backend still has none of this** |
| AC-08 | Content falls back to English, and the gap is visible to the editor | ✅ **Met, and now met for banners too.** `resolveTranslation` is shared; the preview comes from the server. Banners needed their own `isBannerWritten` — headline + button label, not headline + body — because the article rule would have marked a headline-only banner as missing and a label-less one as written |
| AC-09 | Every decision appears in M17 within a second, with actor and before/after | ✅ Met against the mock, for every module still here |
| AC-10 | No console user can approve a record they created | ✅ Met — buttons withheld, server refuses `four-eyes-violation`, **including M18** |
| AC-11 | The FAQ is driven by M12 content | ✅ Met |
| AC-12 | A new factory goes live without a code deploy | ✅ **Met in v2, and it was not in v1.** M14 now has a control for every field of the row *measured against the app's own type* — the fourteen flags, the tea-packet policy, identity, collection points, banks, savings rates, languages, branding and push. v1 met the criterion against its own ten-flag type, which is the wrong thing to measure it against. One step is still outside the console: inserting the row for a factory that has none |
| AC-03 | A bill matches the app's Home screen and the PDF field for field | ⚠️ **Read half met, and the derivation is now three-way.** The slip renders every field in the printed account's order from the shared `bill.ts`. **The bill is produced by the factory's own console in v2**, so this criterion now spans three systems rather than two — see *Known gaps*. The PDF is not built |
| AC-04 | The month cannot be published with an unresolved exception | ⛔ **Not assessable here.** M4 is the factory's own console's. The rule, its five ordered refusals and its exception queue are commented out in this repository rather than deleted, and [../v1/modules.md](../v1/modules.md) is the specification the factory's build has to satisfy |

---

## Known gaps


Worst first: correctness, then plumbing, then polish.

1. **`@tfd/domain` is a copy of the mobile types, not the same file — and v2 is the
   proof that this is the worst gap in the list rather than a housekeeping item.**

   `types/app.ts` calls itself *"a verbatim port of the mobile app's
   `src/types/index.ts`"*. It was missing `TeaPacketRequest` and
   `TeaPacketDeliveryMethod`, so a request type the app has shipped since its first
   release had no queue, no endpoint and no flag anywhere in this console. Nothing
   failed; nothing could. In the same sweep, `FeatureFlagSet`'s docblock claimed to be
   *"identical to the app's set"* while holding ten flags against the app's fourteen.

   Both were found by reading the two repositories side by side, which is not a process
   — it is an accident that happened to occur. **Until the packages are one file, assume
   more drift exists.**

   *To close:* merge the repos (`git mv src → apps/mobile/src`) in its own PR, verified
   with clean iOS and Android builds. Deferred because it touches the Xcode project,
   Gradle paths and every `@/` alias, and breaking a working native build for a console
   change is not a trade worth making blind. **Until then, a cheap partial:** a CI check
   that diffs the exported symbol lists of the two type files and fails on a difference.
   It would have caught both of v2's findings.

2. **AC-03 now spans three systems, and this console can only prove one of them.** The
   bill is produced by the factory's own console, rendered here for support, and read on
   the supplier's phone; all three must agree field for field. The derivation is shared
   (`packages/domain/src/bill.ts`) and this repository asserts identities against it —
   but **the factory's console is not built against this package**, which makes the
   agreement an assumption rather than a property.

   *To close:* the factory's console consumes `@tfd/domain`, or the API becomes the only
   producer of a bill and both consoles read it. The second is better and larger.

3. **Two notification triggers now fire from a system this repository does not
   contain.** `billPublished` fires off M4's publish, `requestDecided` off a payout
   decision. M13 owns the trigger rows and the reach calculation; what it no longer owns
   is the **event**. A publish in the factory's console that does not call the trigger is
   a supplier who is never told their account is ready, and nothing here can detect it.

   *To close:* the trigger is part of [api-contract.md](./api-contract.md) and the
   factory's console has to call it. Worth an integration test that neither repository
   can currently host.

4. **The API half of every feature flag exists only in the mock.** The console hides a
   disabled surface end to end, and the mock now refuses **every** flagged endpoint with
   `403 feature-disabled` — either for a fixture tenant that has the flag off, or for a flag
   an administrator turns off through M14, which is the same mechanism reached the way a
   factory would actually reach it. But nothing refuses `POST /loans` at a factory that does
   not lend, because **there is no backend**. Until the real API reproduces `featureGate`, a
   flag is a UI preference — and the console's own gate is a courtesy, not a control.

5. **Refresh-token rotation is unverified.** The mock stands in for the httpOnly
   cookie with a `sessionStorage` entry, which is enough for the console to
   survive a reload but has **no rotation and no reuse detection**. Both are
   specified in [api-contract.md](./api-contract.md) §2.3 and testable only
   against the real backend.

6. **M17 has no export, and neither has M16.** §18.1 says "read-only, exportable" and
   neither is built. Deliberately absent rather than disabled buttons — a control that
   does nothing is worse than one that is not there.

   M16's grid is a real `<table>`, so the office can select it and paste it into a
   spreadsheet, which is where the office lives. That is a workaround, not a close.

7. **~~The office cannot answer "why didn't I get the notification?"~~** ✅ **Closed.**
   `GET /admin/suppliers/{id}/notifications` names the reason per category and lists
   what actually went to that supplier. Kept in the list rather than deleted because
   the shape of the failure is worth remembering: **every fact was already in the
   console** — the device registry, the consent lists, the category list, the send log
   — and none of it was reachable for one person. A console can hold everything needed
   to answer a question and still be unable to answer it.

8. **~~A supplier's profile self-edits are invisible~~** ✅ **Closed**, as
   `actorType: 'supplier'` on the audit entry. The API has to write those entries —
   see [api-contract.md](./api-contract.md) §8 — and until it does, the console has the
   vocabulary and nothing to render. **That is the live half of this gap**: the model
   is in place and the app's `PATCH /profile` still has to start recording.

9. **~~One supplier's requests are scattered across four queues~~** ✅ **Closed** — the
   links were the whole of it; `supplierId` was already on all four query types.

10. **Banner artwork cannot be uploaded.** `imageUrl` and `imageAspectRatio` are on the
   record, the app renders them at the declared ratio, and the editor has no way to put a
   file there. `uploadRepository` exists for M9's evidence attachments, but a CMS image
   needs a store, a size policy and a CDN — none of which is this repository.

   **Not blocking, and the app is why:** with no `imageUrl` it draws a branded panel
   carrying the same message, deliberately, because *"a banner with a blank rectangle
   where the picture should be reads as a broken app rather than a quiet one"*
   (mobile `docs/banners.md`). The seeded banners have no artwork for the same reason.

11. **The deduction values on a bill are the mock's invention, and only the values.**
   *(v2: the bill is the factory's console's to produce. This gap describes what the
   mock renders on M5's read-only slip, and is kept because AC-03 requires all three
   systems to agree on the shape — see gap 2.)*
   The *shape* is real — nine lines in the printed account's order, with the total
   recomputed from them (BR-107) — and two of the nine are genuine derivations the API
   must reproduce: `savings` is kilos × the supplier's approved rate, and
   `previousDebts` is last month's unpaid balance. **The other seven are made up**:
   transport at LKR 2.50/kg, credit instalments capped as a share of the gross, and a
   few fixed figures. §21.10 (which lines the office may set per supplier, and who may
   set them) is what decides them, so the console offers no editor and a demo bill's
   transport charge is not a number to quote at anybody. *To close:* the answer is a
   permission question as much as a form — see the blocking table below.

12. **A delivery is one net figure.** ⛔ *v2: M3 is the factory's own console's.* Kept
   because it is a **schema** question rather than a UI one and `Delivery` is in the
   shared package: if a weighing point books a gross weight and a sack/water deduction —
   common practice, and nobody has confirmed it either way — then the type is wrong in
   every system that reads it, including the app.

13. **Supplier create and edit are not wired.** `POST` and `PATCH` exist in the
   repository and the endpoint layer with full types, and no screen calls them.
   Registration is also blocked on §21.15 (who issues a code, what the supplier
   receives), so building the form first would be guessing at the flow.

14. **Evidence attachments are read-only.** M9 renders existing attachments and the
   upload path is fully built (`uploadRepository`, presign + PUT, validation) —
   but no screen calls it, because whether an attachment is *required* to approve
   a bank-details change is an open question.

15. **No error reporting.** A console error reaches `console.error` and nowhere
   else. `sentryDsn` is a placeholder on both sides.

16. **No console analytics.** §19.3's KPIs — app adoption and channel shift — need
    the `channel` column on office-raised requests, which the mock sets and the
    backend must too. Nothing measures console-side usage.

17. **Dark mode is off.** The palette exists and the bridge emits whichever scheme
    it is given; enabling it is a toggle plus a QA pass. Off because the console
    runs on office desktops in daylight and doubling the theming QA buys nothing.

18. **No screen-reader pass.** The semantics are built in — real tables,
    `aria-sort`, `role="alert"`, a clean accessible name on every field, a global
    focus ring — but nobody has driven NVDA or VoiceOver over it.

19. **The chrome is translated; its dates, numbers and money are not.** ~~The i18n
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

20. **The console's ceiling arithmetic is untested against the server's.** AC-05
    requires byte-for-byte agreement, and `packages/domain/src/leafCredit.ts` is
    the shared implementation — now rendered field for field by M7's eligibility
    panel and asserted as an identity (the ceiling equals its own working) rather
    than against a fixed number. **But nothing has yet compared it to a real
    `/advances/eligibility` response**, because there is no backend. Both sides
    calling one function is the mechanism; a live comparison is the proof, and it
    is the first test to write the day the API answers.

21. **An approved credit has no repayment schedule.** M7 raises
    `creditBalances[facility]` on approval, and M5 deducts an instalment against it
    next month — but the *share* it deducts (30% of gross for an advance, 20% for a
    loan, 15% for manure) is the mock's guess, and it is the other half of §21.10.
    Approving LKR 40,000 today therefore shows a plausible repayment and not a
    promised one, which is not a number to quote at a supplier.

22. **A supplier's pending requests are each priced against the same headroom.**
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

23. **No Sinhala or Tamil in this repository has been reviewed by a native speaker —
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

24. **Content is plain text, and the FAQ is the case that strains it.** A body keeps its
    line breaks and nothing else — no headings, no links, no lists. The fixture's FAQ is
    therefore questions and answers separated by blank lines inside one field, which reads
    acceptably and is not what it is. Whether the app renders Markdown, a subset of HTML,
    or structured Q&A pairs is a **mobile** decision the console has to follow, not lead:
    a rich editor built against a guess produces copy the app renders as literal asterisks.
    *To close:* ask what the app's content renderer does today.

25. **A published article cannot be scheduled, and a cover image cannot be uploaded.**
    Publishing is immediate, and `coverImageUrl` is on the type and settable through the
    API with no way to put a file behind it — `uploadRepository` exists and does presign +
    PUT for M9's evidence, so this is wiring rather than design. Both are absent rather
    than half-built. Neither is blocked on anything.

26. **§21.24 is answered by the console, not by the factory.** The defaults are read from
    `push.defaultCategories` rather than invented, and every choice is a toggle — but
    nobody at the factory has confirmed that a bill publication *should* push to every
    supplier, or that `content: approve` is the right gate on free text. Both are the
    console's reading, and both are one row and one line respectively to change. *To
    close:* show the office the Notifications screen and ask whether the four switches are
    set the way they want them.

27. **Nothing is actually sent, and nothing ever reports back.** There is no FCM or APNs
    integration — the mock records a send and computes its reach, which is every part of
    the problem *except* the transport. When the real one lands it brings a failure mode
    the console currently has no shape for: a per-device delivery result arriving
    asynchronously, minutes later. `NotificationSend.status` already has `queued` and
    `failed` in its vocabulary for that reason, and nothing sets them yet.

28. **A composed notification is English-only.** M11 taught the console that editorial copy
    is authored in three languages and falls back (AC-08); a push does not, and it should —
    a Sinhala supplier receiving an English lock-screen message is the same failure AC-08
    is written about, in the one place the supplier cannot go and find the translation.
    Deliberately not half-built: doing it properly means the composer grows the same
    language strip M11 has, and the send picks per device.

29. **M16 reads the same store a clerk is writing to.** §19.5 asks that reports run off a
    **read replica** so a month-close query does not compete with leaf entry, and the mock
    has one store. That is a deployment concern rather than a console one — but the four
    reports are written as single-pass scans over live records precisely so that moving them
    to a replica is a connection string and not a rewrite. Recorded because "the report is
    slow during month close" is the failure it produces, and it will look like a console bug.

30. **The report list is four long because §19.1 is in the other repository.** Each of the
    four is defined by something already in this codebase and carries that citation on the
    row. The rest of what the factory asked for needs the warehouse shape, and a report
    invented to fill the list is a query somebody maintains and nobody reads. The screen says
    this where somebody would look for the missing reports, rather than leaving the shortness
    to be read as an oversight.

31. **A created user's password is the demo password, and nothing forces a change.** M15
    invites a user and the mock gives them `demo1234`, which is why the success toast says
    *"tell them their password"*. A real API issues a one-time credential the office cannot
    read back, and insists on a change at first sign-in. Neither exists here, and the
    console has no screen for either — this is the one place in the console where the mock is
    weaker than the contract rather than equal to it.

32. **MFA is owed and never collected.** `MFA_REQUIRED_ROLES` marks manager and above, the
    user list shows *Two-factor not set up*, and the sign-in demands a code from anyone who
    **is** enrolled — but nothing enrols anybody. The only MFA control that exists is the
    reset, which un-enrols. So a manager who owes a second factor signs in with a password
    indefinitely, and the badge is a note rather than a gate. *To close:* an enrolment step
    at first sign-in for a role that requires it, which is a screen plus a TOTP secret the
    server issues — and it is where §18.1 expected MFA enrolment to live.

33. **The role matrix has no "restore the standard roles".** A factory that has narrowed
    six roles has no single control to put them back, and `DEFAULT_ROLE_MATRIX` is right
    there in the bundle. Left out deliberately: a one-click reset of every permission in the
    console is a control whose worst case is worse than the inconvenience it saves, and the
    matrix already says whether it has diverged. If it is wanted, it should be a confirm
    dialog naming what changes, not a button.

32. ⛔ *v2: M6 is the factory's own console's, and this gap goes with it. Kept because
    `payoutExport.ts` is still the shared serialiser and §21.17's answer — that the layout
    is configuration rather than three guessed formats — is still the right one for
    whoever builds it next.*

    **The payout template covers the CSV family and not the fixed-width one.** §21.17 is
    now half answered — a factory sets its own column order, headings, delimiter and number
    formats in M14, and M6 writes the file through them. What a column template cannot
    express is a **fixed-width record layout with control totals or a checksum**, which is
    what SLIPS may turn out to need, and it cannot print a cheque on pre-printed stationery
    at all. The presets named `SLIPS` and `CEFTS` are therefore **headerless skeletons with
    the labels left blank**, not claims about those layouts — and the screen says so above
    the editor. *To close:* one sample file, or the bank's specification page.

33. ⛔ *v2: M8 is the factory's own console's.* Kept because the **rate and the withdrawal
    month are `client_config`**, which this console still edits — so the value travels
    through M14 even though nothing here posts against it.

    **Interest has a rate and no basis.** §21.9's answer set both the withdrawal month and
    an interest rate, and the console stores and shows the rate — but it **applies nothing**,
    because nobody has said what the rate is calculated on. Closing balance rewards a
    supplier who paid in late as much as one who held a balance all year; the year's minimum
    balance is the usual passbook rule and cannot be gamed. On a 5% rate those differ by a
    lot, and this is the supplier's own money. Harmless today — the default is 0% — and the
    screen says so where somebody would expect the console to start accruing. *To close:* ask
    which of the two, then it is one posting job and an `interest` ledger entry, which the
    ledger's vocabulary already has a word for.

34. **`otherCards` is the last invented deduction line.** §21.10's answer covered eight of
    the nine: transport and stamps are the factory's approved rates, the three credit
    instalments are the supplier's chosen period under a cap, savings is M9, previous debts
    is derived, and tea is an app request — **which as of v2 has a queue behind it (M18)
    rather than being an answer with nothing implementing it.** Nobody has said what *other
    cards* is, so it is still `LKR 260 for every seventh supplier` and still uneditable.
    Harmless in the fixture and wrong in production. *To close:* one sentence from the
    office.

35. **~~The app cannot yet ask for tea~~, or choose a repayment period.** ✅ **Half closed
    in v2, and the half that closed had the facts backwards.**

    This gap said *"the tea request has no console queue yet either"* and filed the whole
    item under "app work first". The app has had `RequestTeaPacketsScreen` since its first
    release; it was **the console** that had nothing — no type, no endpoint, no queue, no
    flag. M18 closes that side. See gap 1 for how a sentence like this survives review:
    the domain package claimed to be a verbatim port and nobody diffed it.

    **The repayment period is still open.** `AdminCreditRequest.repaymentMonths` is on the
    type, the fixture carries it on every third request and `creditInstalment` honours it
    — but nothing sends it, so live requests fall back to the cap alone. App work.

36. **The one-time password is only one-time if the app enforces it.** §21.16's flow is safe
    because `owesPasswordChange` forces a supplier to replace the office-issued credential at
    first sign-in — and **nothing in this repository can make that happen.** The console sets
    the flag, the API must return it, and the *app* must refuse to go further until the
    supplier has chosen their own. Until it does, every password the office has ever issued
    stays valid, and a clerk who wrote one down can sign in as that supplier and raise a
    change request as them. This is the highest-value item on the mobile side.

37. **A supplier code is still issued by nobody.** §21.15's login half is answered; the code
    half is not. M2's create form waits on who assigns a code and how it is chosen — the
    endpoint and types have existed since the first slice.

---

## Blocking business questions

These stop specific modules. Numbering follows `status.md` §21 in the mobile repo,
so an answer can be recorded in one place.

### Stops a control inside a module, and no module any more

Nothing here blocks a module. Both of these stop a **supplier identity** operation, which is
the one area of the console where the wrong flow is worse than no flow.

**Questions that only stopped a control in a handed-back module are not repeated here** —
§21.17's bank file, §21.9's interest basis and §21.8's post-publish correction are the
factory's own console's to answer now. They are in [../v1/status.md](../v1/status.md), which
is the specification that build should be read against.

| § | Question | Blocks |
| --- | --- | --- |
| 21.15 | **Registration** — how does a new supplier get a code and a login? | **Half answered.** The *login* is settled: a random one-time password the office issues and hands over at the counter, built and audited. The **code** is not — who issues a supplier code and how it is chosen is still open, which is what M2's create form waits on |
| 21.16 | ~~**Password reset**~~ | **Answered and built.** A random password from an unambiguous alphabet, shown **once**, handed over at the counter — with the identity check recorded against the clerk's name and audited. Safe rather than a takeover path because of one property: `owesPasswordChange` makes it **one-time**, so the credential the office knows dies when the supplier replaces it at first sign-in. **The app must enforce that** — see gap 34 |
| 21.24 | **Notifications** — does the office compose every send, or does bill-published fire automatically off the publish step? Who may send free text? | **Nothing.** Built as configuration instead: every trigger is a row and "who may send free text" is `content: approve`, stated on the screen so it can be contested. This is what an unanswered question should cost — a switch to flip, not a rewrite. See gap 22 |

### Stops one control inside a module that is otherwise built

These used to read as "blocks M5 / M6 / M8 entirely". Building the three modules showed
that each blocks a **single control** rather than a module, which is a much smaller ask
of the factory.

⛔ **In v2, three of the four are no longer this console's questions at all** — §21.17,
§21.9 and §21.8 are about modules the factory's own console owns now. The rows are kept
verbatim because they are the specification that build has to answer, and because
§21.9's and §21.10's answers are still `client_config` values M14 edits.

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
| **Gross or net?** Does the weighing point record one figure, or a gross weight and a deduction for the sack and surface water? | One net `kgs` per weighing. If the answer is two, it is a schema change (gap 12 above) |
| **What is a plausible delivery?** The grid questions a figure over 150 kg that is also 3× the session's mean. Those numbers are a guess sized for smallholder routes | `OUTLIER_KG_MULTIPLE` and `OUTLIER_KG_FLOOR_KG` in `@tfd/domain`, and the same pair raises M4's `outlierDelivery` exception. Tenant config once the factory has a number |
| **How far back may leaf be entered?** A paper slip found on Monday for Saturday's weighing is normal; a row backdated three weeks into a month about to close is not | Any date in an unpublished month is accepted. The publish lock is the only guard, which is a policy nobody chose |

---

## What I would build next

1. **The API writing `supplier` audit entries** (gap 8). The console has the vocabulary
   and the screens; `PATCH /profile` still has to start recording. Until it does, the
   supplier-action history is a model with nothing in it outside the fixture — and this
   is the one item on the list where the console's half is already done.
2. **The repo merge, or at least the CI symbol diff** (gap 1). v2 found two drifts by
   accident. The next one will not announce itself either, and the check that would have
   caught both is an afternoon's work.
3. **Banner artwork upload** (gap 10) — the one thing an editor can want on the new module
   and cannot have. It needs a store and a size policy more than it needs a form.
4. **MFA enrolment** (gap 32): the console names who owes a second factor and has no way
   for them to set one up, so the *Two-factor not set up* badge is a note rather than a
   gate.
5. **The notification-trigger integration** (gap 3), which is not a screen — it is
   getting the factory's console to call the endpoint on publish, and an environment where
   that can be tested.

**This list is no longer a build order.** Every module in v2's scope has a route; what is
left is the work that would make what exists trustworthy in production rather than
demonstrable in a meeting. The first item is first because it is the only one that guards
against a class of failure rather than an instance of one.

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
