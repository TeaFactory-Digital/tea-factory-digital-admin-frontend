# Modules

The §18.1 module map, what each module decides, and what a real deployment still
needs. Scope and rationale for all 17 are in the mobile repo's
`docs/admin-console.md`; this is the console's state against it.

`NAVIGATION` in `apps/admin/src/layout/navigation.ts` is the machine-readable
version of this table — it carries each module's capability, feature flag and
build status, and the sidebar is generated from it.

---

## Status

| # | Module | Status | Route |
| --- | --- | --- | --- |
| M1 | **Dashboard** | ✅ Built | `/` |
| M2 | **Suppliers** | ✅ Built | `/suppliers`, `/suppliers/:id` |
| M9 | **Change requests** | ✅ Built | `/change-requests`, `/change-requests/:id` |
| M17 | **Audit log** | ✅ Built (no export) | `/audit` |
| M3 | **Leaf collection** | ✅ Built (no scale-file import) | `/deliveries` |
| M4 | **Rates & month close** | ✅ Built | `/rates` |
| M5 | **Bills** | ✅ Built (no PDF) | `/bills`, `/bills/:id` |
| M6 | **Payouts** | ✅ Built (file layout configurable; no fixed-width or cheque printing) | `/payouts`, `/payouts/:id` |
| M7 | **Credit queues** | ✅ Built | `/credit`, `/credit/:id` |
| M8 | **Savings** | ✅ Built, with withdrawals (§21.9) | `/savings` |
| M10 | **Inquiries** | ✅ Built | `/inquiries`, `/inquiries/:id` |
| M11 | **News (CMS)** | ✅ Built | `/news`, `/news/:id` |
| M12 | **Static content** | ✅ Built | `/content` |
| M13 | **Notifications** | ✅ Built (§21.24 answered as config) | `/notifications` |
| M14 | **Configuration** | ✅ Built (AC-12), 6 sections | `/configuration` |
| M15 | **Users & roles** | ✅ Built | `/users` |
| M16 | **Reports** | ✅ Built (4 reports, no export) | `/reports` |

**All seventeen have a route.** The *Planned* chip and the disabled sidebar row that
carried it are gone from the tree, and `NAVIGATION` no longer has a `planned` status to
render. What is left is not "planned modules" but **named absences inside built ones** —
the payout file, savings movements, a deduction editor, CSV export — each recorded below
and stated on the screen where somebody would look for the control. That distinction
matters: a missing module is a schedule, a missing control inside a built module is a
decision, and the second needs a reason on the screen.

---

## Why this slice first

The chosen milestone was *foundation + M1/M2/M9*. The reasoning, kept here because
the next slice should be argued the same way:

- **M9 closes the app's loudest open loop.** Every `pending` change request in a
  supplier's app is this queue, and today nothing on earth can decide one
  (status.md §10 item 4). It is also the whole read → approve → audit path proved
  end to end on a low-risk module — no money moves.
- **M2 is what every other module links into.** A credit queue row, a bill, a
  payout line all resolve to a supplier record.
- **M1 is where a clerk starts the day**, and it is the only place the month-cycle
  stage is visible — which is the console's most-asked question, because it decides
  what every other module will let you do.
- **M3 and M4 were deliberately not first**, and were the second slice. §18.2
  names them as where the project succeeds or fails, which is the argument for
  building them on a foundation that was already proven end to end rather than at
  the same time as it.
- **M5, M6 and M8 are the third slice**, and they are one slice rather than three
  because they are one chain: a bill is a read model over M3's leaf and M4's rate, a
  payout line pays a bill, and a savings contribution *is* a bill's savings deduction.
  Building any one of them alone would have meant inventing the other two ends — a
  payout amount derived a second time, a savings balance posted by hand — and every
  one of those inventions is a figure the office would later reconcile against itself.
  It also fills §13's `billsGenerated` stage, which M4 shipped empty.
- **M11 and M12 are the fourth slice**, and they are the smallest one that closes an
  acceptance criterion outright. **AC-08 — a missing translation falling back to English
  *and the gap being visible to the editor* — was the last criterion with no screen behind
  it at all.** The two modules are one slice because they are one problem: an article and
  a fixed page differ in their lifecycle, not in their copy, and a second translation
  editor would be a second place for the fallback rules to drift.
- **M14, M15 and M16 are the fifth slice**, and they are one slice because they are the
  three things a factory needs before it can be *handed over* rather than demonstrated.
  M14 is the one that closes an acceptance criterion outright: **AC-12 says a new factory
  is a DNS record and a `client_config` row with no build and no deploy**, and until every
  field of that row had a control, the criterion was an aspiration. M15 is the other half
  of the same handover — rbac.md always claimed §12.1 was *"data, not code"*, and until
  this slice `packages/domain/src/rbac.ts` was the authority while calling itself a
  default. M16 is last on purpose and smallest on purpose; see below.
- **What is left out of each rather than guessed at.** Three questions the factory has
  not answered would each have been a wrong build: §21.17 (what the bank accepts) is
  the payout *file*, §21.9 (may a supplier withdraw) is savings *movements*, and
  §21.10 (who may set which deduction line) is a deduction *editor*. Each is stated on the
  screen where somebody would look for the control — see "What is deliberately not built"
  below. **§21.17 has since been half answered** by making the layout configurable rather
  than guessing the format, which is the pattern worth reusing: when a question is about
  *shape* rather than *policy*, the answer can often be a config row.

---

## M1 Dashboard

*The day at a glance.* One request — `GET /admin/dashboard`.

| Area | What it shows |
| --- | --- |
| **Queue cards** | Pending count per queue, the age of the **oldest** item, and a count past the §14.4 target. A queue of three sitting four days is worse than twenty from this morning |
| **Month cycle** | The §13 stage, open M4 exceptions, and a plain-English hint. `awaitingRate` explains *why the app is showing blanks instead of amounts* — the office has to say that on the telephone |
| **Today's leaf** | Kilos, suppliers, deliveries, and the delta against yesterday so the number means something |
| **Alerts** | Server-composed, as an i18n key + params. The rule that makes something an alert is policy; a console inventing its own thresholds would disagree with the reports |
| **Intake trend** | 14 Colombo-local days, oldest first — charts read left to right |

The **shell** owns this query, not the screen, because the sidebar's queue badges
need the same numbers. One request, two consumers — the alternative is a badge
count disagreeing with the screen it links to.

A queue whose feature flag is off is **absent**, not zero.

## M2 Suppliers

*The registry.* List and detail.

- **Search is primary**: autofocused, debounced 250 ms, no submit. Matches code,
  name or NIC, and **tolerates the division suffix** — `5708`,
  `5708 (MAKADURA)` and `makadura` all work, because the office searches by
  whichever they remember.
- **Filter state is in the URL.** That is what lets the dashboard's "9 suppliers
  have no bank details" alert link straight to the filtered grid, and lets a clerk
  send a colleague exactly what they are looking at.
- **`hasBankDetails: false` is flagged in the grid.** Those are M4 exceptions that
  will block publishing the month (AC-04) — surfacing them here fixes them weeks
  earlier.
- **Detail** is ordered the way the office asks: who is this, how are they paid,
  what do they owe us, what has happened to the record. Every value shown is the
  **active** one (AC-01); a pending change appears as pending, never as applied.
- **Suspend / reactivate require a reason** (≥10 chars, audited). A supplier who
  finds their account suspended will telephone, and "suspended on the 14th" with no
  why is a conversation nobody in the office can have.
- **The audited bank reveal** — see below.
- **Reset app password is disabled** and says why: what the office actually does is
  still an open question (§21.16), and the wrong flow is an account-takeover path.

### The bank-details reveal

§20.4: *"Bank account numbers are masked in the console except to roles that need
them, and every unmasked view is audited."* Made operable in three details:

1. **A reason is required** — an audit entry recording *that* someone looked
   without recording *why* answers the wrong question.
2. **The clerk is told it is recorded, before they ask.** A control the person
   subject to it does not know about does not change behaviour.
3. **The audit id is shown back**, which is the difference between "we log this"
   as a policy statement and as something visibly happening.

The revealed number is **never cached** — the dialog holds it and drops it on
close. In the query cache it would stay in memory for the session, readable by any
component that guessed the key.

## M3 Leaf collection

*Where the leaf is recorded.* §18.2 calls this the module the project succeeds or
fails on, and it is built as **a data-entry product, not a screen**.

**The day is the unit**, not the delivery list: a point opens, records leaf until it
closes, and the figure that matters at the end is the day's total. The date and the
collection point are the primary controls and they live in the URL, so "look at
Makadura yesterday" is a link a supervisor can send.

**Entry is two fields and the Enter key.** Code → Tab → kilos → Enter, and the
caret returns to the code field; the mouse is not on the path. The code matches with
or without its division suffix (`5708` or `5708 (MAKADURA)`) through the same search
the registry uses, and the grower's name appears as confirmation *before* the line
is added — "did I type the right supplier" is the question the office actually asks.
A code that matches nothing is refused on the line, and a bare prefix never
silently picks a grower.

**A big figure is questioned, not refused.** `isOutlierKg` catches `1250` typed for
`125.0` — invisible in a column of numbers, very visible in next month's bill — and
asks for a second Enter. A genuinely heavy load must still be enterable.

**A session is one request** (api-contract.md §9.3), and the batch id the console
generates travels as the `Idempotency-Key`. That is what makes a re-sent commit
safe: a dropped connection and a second click replay the original result instead of
recording sixty deliveries twice.

**Partial acceptance.** Per-row rejections come back inside a `200`; the refused
lines stay in the grid with the server's reason on each, and the accepted ones
leave. All-or-nothing would send fifty-nine good rows back to be re-typed at a
counter with a queue at it.

**Nothing is deleted.** A withdrawn weighing is voided with a mandatory reason
(§12.1) — out of the day's totals, out of the default list, still in the record and
returned by `includeVoided`. The supplier holds a slip for it and will ask.

**A published month refuses everything** (BR-108), for entry and voiding alike. The
screen reads `locked` from the day summary and does not render an entry grid at all,
because a form that fails on submit is a worse way to say the same thing.

**Totals are the server's.** The day summary is its own endpoint rather than a sum
of the page on screen — a busy point is more than one page, and a console adding up
what it happens to be holding would print a figure the month close disagrees with.

**Not built yet:** the scale-file import (`source: 'scaleFile'` exists in the data
and the fixture, but there is no upload path), and a supplier's own delivery history
on the M2 detail page.

---

## M4 Rates & month close

*The gate every other money module reads.* §13's cycle stage decides what M3 will
accept and what a bill can be built from, so this screen's job is to make the
month's state — and what is blocking it — impossible to misread.

**The stage is state, not a calendar calculation.** This is the load-bearing
decision of the module: publishing is irreversible, so a stage recomputed per
request would revert the publish on the next call and M3 would keep accepting leaf
into a closed month. The mock keeps a record per month for the same reason the API
must.

**The rate is two figures** — the auction rate and the extra the factory adds. The
app shows the sum and the bill itemizes both, so collapsing them would lose a
number the supplier is entitled to see. Entering it again before the publish is a
**correction**, not a second rate (`PUT`), because the auction result gets mistyped
and the alternative is closing the month on the wrong figure.

**Exceptions are records, not a count** (api-contract.md §10.4). AC-04 requires the
accountant to resolve each one, so each has an id, a type, a link to the record it
is about, and a mandatory note on resolution — "who decided this was acceptable,
and why" is what an auditor asks about a month that closed with exceptions on it.
They are **derived from the data**: leaf with no bank details, leaf from an inactive
supplier, an open change request that would change the bill, a weighing far outside
the month's spread. A hand-written list would disagree with the registry.

**The checklist states what is blocking it**, in words, next to the disabled
control. "Publish (disabled)" with no reason is a support call, and a tooltip is a
reason nobody reads. The steps only render while the month is open — a closed month
owes the reader the rate it closed on and who closed it, not a re-litigation.

**Publishing needs a second person.** `ratesAndMonthClose` is `W` for the
accountant and `A` for the manager, and because `approve` implies `write` a manager
*could* enter a rate and close the month on it — so the four-eyes rule (BR-501) is
checked on the rate's `enteredById`. The console says so before the attempt; the
server refuses regardless.

**Four refusals guard the publish:** `rate-missing`, `exceptions-open` (AC-04),
`already-published`, and `four-eyes-violation`. A month the factory has no records
for is a `404`, never an empty month rendered from a URL.

**Five refusals guard the publish**, in the order the office meets them:
`rate-missing`, `exceptions-open` (AC-04), `bills-missing`/`bills-stale`,
`already-published`, and `four-eyes-violation` when the publisher entered the rate
(BR-501). The bills check is **after** the exceptions rather than before, and that
ordering is deliberate: resolving an exception is what changes a bill — collecting a
bank details form, deciding a change request — so bills built before the queue is
clear are bills that need building again. The refusals report the earliest unmet
precondition, which sends the accountant to the first thing to do rather than the last.

A month the factory has no records for is a `404`, never an empty month rendered from
a URL.

---

## M5 Bills

*The Green Leaf Account.* The month's leaf and its rate, turned into the document each
supplier is handed.

**A bill is derived, not authored** (api.md §16). That one sentence produces the whole
module:

- **There is no bill editor, and there will not be one.** A wrong bill is a wrong
  delivery or a wrong rate. An editor would let the office correct the symptom and
  leave the cause in place, so the next run would reintroduce it.
- **Re-generating is the normal case**, not a repair. The auction result gets read off
  a fax and mistyped, a weighing gets voided, a change request is approved — and the
  figures move. `generate` is therefore a `POST` that may be repeated for as long as
  the month is open, and a re-run *replaces* the previous one rather than accumulating
  beside it: two runs for one month is two sets of figures nobody can choose between.
- **A run knows when it has gone stale.** `stale` is computed at read time by comparing
  the run's kilos with the month's live total, never stored — staleness is a
  relationship between the run and the delivery rows, and a stored flag would go on
  lying the moment somebody voided a weighing. Publishing on a stale run is refused
  (`bills-stale`), because it would freeze figures that disagree with the leaf the
  month closed on.
- **The arithmetic is shared, not re-derived** — `packages/domain/src/bill.ts`. AC-03
  requires the console, the printed slip and the app's Home screen to agree field for
  field, and three implementations of one derivation is three figures the office
  reconciles by hand after a supplier has already been handed a slip.

**The nine deduction lines are the document's shape**, so all nine render including the
zeros. A slip with a blank where "Stamps" should be is a slip the supplier queries.
Their **total is recomputed from the lines, never trusted** (BR-107): an unbalanced
bill is flagged in the grid, said loudly on the slip, and refuses the whole run at
generation — because this is the last screen before the figure is something somebody
is holding.

**The factory pays whole rupees.** The sub-rupee remainder is the slip's "coins" line
and it carries into the next account, which is what `coinsBroughtForward` and
`coinsCarriedForward` are for and why neither is ever `null`. An account whose
deductions came to more than it earned pays **nothing** and carries the shortfall as
`nextMonthDeb` — stated as its own case rather than falling out of the arithmetic,
because the alternative reaches a payout run as a negative line that no bank file can
express and no cheque can be written for.

The grid's three lenses are the queries the office actually runs — *nothing payable*,
*payable with no bank details*, *lines that do not add up* — rather than badges to hunt
for in a hundred rows.

**Not built:** the PDF. AC-03 names it alongside the app's Home screen and the console
renders the same fields, but nothing produces a printable file yet.

---

## M6 Payouts

*Money leaving the factory.* Prepared by the accountant, released by a manager,
reconciled against what the bank actually did.

**§21.17 is answered as configuration, which is the module's most interesting decision.**
The factory has not said what its bank accepts — SLIPS, CEFTS or its own bulk-upload sheet
— and the tempting build was three coded serialisers behind a dropdown. That is wrong
twice: two of the three layouts would be invented, and **a file the bank rejects is two
hundred suppliers unpaid** until the run is re-sent. A wrong file is worse than no file.

So what a factory configures in M14 is the **layout** — which columns, in what order, with
what headings, what delimiter, whether amounts are rupees or cents, whether account numbers
keep their dashes — and a format's *name* becomes a preset somebody completes once their
bank confirms it. `payoutExport.ts` holds the serialiser, shared so the preview on the
configuration screen and the bytes the API writes cannot drift. Same shape as M13's answer
to §21.24: the factory's eventual answer is a config row, not a release.

**What that still does not cover, and the screen says so in both places:** a *fixed-width*
format with record types and control totals is rules rather than a column order, and
printing cheques on pre-printed stock is millimetres on a specific cheque book. The
`SLIPS` and `CEFTS` presets are therefore headerless skeletons with blank labels, named for
what they are *for* rather than as a claim about the layout.

**Producing the file is a server act, and audited.** Every payload in this API masks account
numbers (§20.4) and a payment file cannot — so the export joins to the full numbers, which
means it is an event worth recording, and the console cannot assemble the file from the grid
it already has. It is also **refused on a draft**: a file taken before the four-eyes release
and uploaded to the bank would reduce that release to a formality performed after the money
moved.

**A run is one month and one method.** A bank transfer file, a cheque book and a cash
counter are three different jobs done on three different days and reconciled from three
different pieces of paper; one run covering all of them shows a total nobody in the
office is responsible for.

**`month-not-published` is the load-bearing refusal.** A run against an open month pays
against figures that can still change — a rate correction, a voided delivery, an
approved change request — and money that has left the factory cannot be re-derived.

**A line that cannot be paid is held, not dropped.** A supplier owed money with no
account on file stays on the run, counted and carrying the reason, because a line
silently filtered out is a supplier who is not paid and nobody notices until they
telephone. Held lines are excluded from the total and from the `paid / payable`
progress, so a run can still reach `completed` — a run that could never finish is a run
the office stops looking at.

**The amount comes from the bill, never recomputed.** The bill is the record the
supplier holds (AC-03); a payout that re-derived the figure would be a second answer to
a question that already has one. Zero and negative accounts are not lines at all.

**Four eyes on the release** (BR-501): `payouts` is `W` for the accountant and `A` for
the manager, and because `approve` implies `write` a manager *could* prepare a run and
release it — so the check is on `createdById`. And **reconciliation is the half systems
leave out**: `paid` needs only a confirmation, `failed` needs a reason, and the
asymmetry is the point — the supplier has not been paid, and the next person to pick the
run up works entirely from that note.

---

## M8 Savings

*What the factory is holding, and whose it is.* Read-only, by decision.

The screen leads with the **balance as a liability**, because that is the question the
office is asked and the figure an auditor reconciles against the bank. This is
suppliers' money; a screen leading with "contributions this month" would read like
revenue.

**There is exactly one way a contribution is created: publishing a month.** A savings
movement *is* the `savings` deduction on a published bill, credited at the moment the
month closes — not when the bills are generated, because crediting a passbook off a
draft would put money against a figure the office might still re-run. Two write paths
for one movement would be two balances to reconcile, and the two that disagreed would be
the supplier's passbook and their slip.

Three consequences:

- **The registry's balance follows the ledger.** `AdminSupplier.savingsBalance` (M2)
  and the savings account row are one number, which is what AC-01 is about.
- **The ledger is oldest-first**, which is part of the wire contract: a passbook is read
  forward, and a running balance only means something in the order it accumulated.
- **The rate is not set here.** It belongs to the supplier and moves through M9's queue,
  which already carries the four-eyes rule and the audit trail. A row with an open
  request links there rather than offering an edit, and shows the **active** rate until
  it is decided.

**Blocked on §21.9:** may a supplier withdraw, on what notice, and is interest paid?
Until that is answered there is no withdrawal endpoint and no interest posting —
`SavingsEntrySource` already carries `withdrawal` and `interest` so the answer adds
endpoints rather than migrating a money table. Stated in the passbook, where somebody
would look for the control.

---


### Withdrawals — §21.9, as the factory answered it

*A supplier may take their savings out, normally in April; the month must be changeable;
interest is changeable too and starts at 0% a year; the money is paid on the next Green Leaf
Account.*

**The last clause is the design.** A withdrawal is not a movement — it is a request that
becomes a bill line that becomes a passbook entry:

| Step | What changes |
| --- | --- |
| The accountant records it, in the window | Nothing. The balance is untouched; the amount is subtracted from what may be asked for *again* |
| M5 generates the month's bills | The account carries `savingsWithdrawal`, added to what is payable |
| A manager publishes the month | *Now* the passbook moves — a negative `withdrawal` entry beside that month's contribution |

That shape exists to keep **one rule**: the savings ledger is derived from published bills
and nothing else. Taking the money out at request time would have been simpler and would
have told a supplier their savings were gone a month before they were paid.

**The window is Colombo-local** (BR-104) and out of season the control is withheld with the
month named, rather than offered and refused. **The month and the rate are `client_config`**,
so a factory that pays out in September changes a row.

**A supplier with no leaf that month still gets an account**, reading zero kilos and one
payment — otherwise their withdrawal would have nothing to be paid on, and the money would
sit unpaid with nothing on any screen saying why.

**The withdrawal is an addition beside `coinsBroughtForward`, not a tenth deduction line.**
BR-107 balances the nine against their own total, and `balanceAmount` means "what the leaf
earned, less what was taken off" — a supplier's own money coming back is neither. On an
account that owes more than it earned the withdrawal goes against the debt, which falls out
of the arithmetic rather than being a special case.

**Interest is recorded and never applied.** The factory set a rate; nobody has said whether
it is paid on the closing balance or the year's minimum, and those differ materially. So the
console stores it, shows it, and posts nothing — the accountant records an `interest` entry
when the factory decides. Stated on both the savings screen and M14.
## M11 News

*The feed suppliers read in the app.* Authored in every language the tenant sells in.

**The whole module is `content.ts` plus a way to see it.** AC-08 has two halves — copy
falls back to English when a translation is missing, *and* the gap is visible to the
editor — and both are only true if the console and the app resolve a translation with the
**same function**. A console with its own fallback would show the editor a preview of
something that is never rendered, which is a worse failure than having no preview: the
editor signs off copy nobody sees. So `resolveTranslation` is shared, the preview is
fetched from the **server**, and the gap lists come back on the record rather than being
worked out locally.

**Copy is saved one language at a time.** `PUT /news/{id}/translations/{lang}`, not a
whole-record save, and the reason is not tidiness: two editors translating one article is
the normal case in an office with a Sinhala speaker and a Tamil speaker, and a
whole-record save means whoever presses the button second discards the other's work. It is
also what makes staleness detectable — each translation carries its own `updatedAt`.

**Three states, not two**, and the third is the one that earns the module:

| State | What the supplier gets | Why it matters |
| --- | --- | --- |
| **Written** | Their language | — |
| **Missing** | The English, by fallback | AC-08's case. Visible on the tab, in the list, and named in the publish confirmation |
| **Stale** | Their language, saying the old thing | Written *before* the English it was translated from was corrected. **Nothing anywhere looks wrong** — the app renders it happily — so only this screen can catch it. AC-08's wording does not cover it and an office hits it second |

**Publishing with a gap is allowed and loud.** That is the policy, not a compromise:
`EDITORIAL_FALLBACK_LANGUAGE` is documented as "the fallback, not a default", which only
means anything if content can go out incomplete. The one hard refusal is a record with
**no fallback copy at all** — there would be nothing to fall back *to* — and the
confirmation names every language that will fall back before anybody agrees to it. The
publish audit entry records those languages, because "who decided a Sinhala supplier could
read this in English" is the question AC-08 turns into an argument six months later.

**Gaps are relative to the tenant.** A factory that authors in English and Tamil is not
missing Sinhala — it never asked for it. Derived per request from
`config.localization.contentLanguages`, because an office told it has work it does not
have stops reading the warnings.

**Nothing is deleted.** An article a supplier has read and may quote on the telephone is
archived — the same rule that voids a delivery rather than removing it (§12.1).

**§12.1 is the control.** `content: W` for the editor, `A` for the factory administrator:
the person who writes a circular is not the person who puts it in front of every supplier
the factory has. There is no four-eyes rule on top — unlike money there is no amount to
escalate on, and the capability split is the whole of it.

## M12 Static content

*The app's fixed pages.* Same copy machinery, different lifecycle.

**A closed set, not a collection.** Nobody creates a "terms" page; they edit the one that
exists. The app links to `STATIC_PAGE_SLUGS` directly, so there is no create, no delete
and no archive — a page that could be removed is a link to nowhere in a shipped binary.
The list returns all six **including the ones nobody has written**, because an unwritten
page is a state to be shown: the app is rendering its own bundled default, and an office
that cannot see the page listed assumes it already filled it in.

**An edit to a live page is live when it is saved**, and the asymmetry with M11 is
deliberate. A *new* article must not appear half-written, while a correction to the FAQ
sitting in an unpublished draft leaves the wrong answer in front of suppliers for as long
as nobody remembers to press a second button. What makes that safe rather than merely
convenient is the audit entry: every save records the **previous wording and the new one**,
by name, which is what a review step would otherwise have been for. If the factory wants
one, that is a versioning feature and a real piece of work — not a tweak.

`publish` therefore exists once per page and means "the factory has written this at all".

---

## M13 Notifications

*What suppliers are told, and what they are told automatically.*

**Built while §21.24 was still open**, which is the whole design problem. The question —
does the office compose every send, or does "your bill is ready" fire off the publish
step, and who may send free text? — is answered here as **configuration rather than
code**, so the factory's eventual answer is a switch and not a rewrite.

The defaults are not invented. `config.push.defaultCategories` already says which
categories a supplier is opted into when they install the app, and it pointedly excludes
`newsArticle` — so `billPublished`, `requestDecided` and `inquiryReplied` fire by default
and news does not. That is the platform's existing decision being read rather than a new
one being made.

**A push is the only act in this console with no undo and no delivery report.** Nothing
comes back from a phone to say the message was dropped; no supplier reports that they had
the category switched off. Every safeguard is therefore a *pre*-check:

| Rule | Why it is a refusal rather than a warning |
| --- | --- |
| **`unknown-category`** | The app **drops** a push whose category it does not recognize rather than opening an arbitrary screen. A send the console called successful would reach nobody and report nothing at all — the worst available outcome |
| **Per-device consent** | A device subscribed to the factory's topic but opted out of `newsArticle` must not get news. Topic membership is routing; the category list is consent |
| **`no-recipients`** | Refused for a *composed* send, because somebody is standing at the screen and can put it on the noticeboard instead. Not refused for an automatic one — a month published where nobody has the app is a normal month, and a red row would train the office to ignore red rows |
| **`push-not-configured`** | `hillcountry` has the flag on and no `push` block at all. The flag being on and the module being set up are different things, and M14 is what sets it up |

**The reach panel is the module.** Before anything is sent, the server answers how many
devices would receive it, how many opted out, and how many suppliers never installed the
app. Three numbers rather than one, because they are three different problems: *reaches 3,
11 opted out* is a circular that belongs on the noticeboard, and there is no way to learn
that afterwards. It is also the only place a factory ever sees its own opt-out rate.

**Automatic sends fire from the module that owns the event** — `month.publish`,
`news.publish`, a change-request decision, an inquiry reply — rather than from something
watching the audit log. The event is the fact; whether it notifies is one row. Firing
cannot throw and cannot block: a push that failed must never roll back an irreversible
publish, so the failure is recorded on the send instead.

**What a push does not carry.** Neither the decision note nor the reply body reaches a
lock screen, even though both are the most useful sentence the office wrote. They are
written *to* one supplier and can name a bank account or a dispute; a lock screen is read
by whoever is holding the phone. The notification says there is an answer, and the app
shows it.

**Who may send free text** is `content: approve` — the same boundary M11 draws between
writing a circular and putting it in front of every supplier. Stated on the screen so the
factory can contest it, which is the point: this is the console's answer to a question
nobody has answered, and it should be easy to argue with.

---

## M14 Configuration

*Everything about a factory that is data rather than code.*

**This module is AC-12.** [white-label.md](./white-label.md) says a new factory is *"a DNS
record and a `client_config` row — no build, no deploy"*, and the criterion is therefore not
whether this screen exists but whether the **last** field a factory needs is on it. One value
still requiring a developer makes AC-12 false, so the five sections cover the whole payload
rather than the parts that were convenient: factory identity, the ten feature flags,
collection points / banks / savings rates, languages and branding, and the push block.

`tenantId` is **shown and not editable** — it comes from the subdomain and every other row is
keyed on it, so a patch containing it is refused (`tenant-immutable`).

**The screen's real job is showing what an edit costs, before it is made.** A configuration
edit is the only change in the console whose effects are almost all somewhere the person
making it is not looking — another module's sidebar row, a supplier's app, a printed bill —
so every section computes its consequences from the same `configImpact` the API refuses
with, and shows them while the change is still a draft.

| Impact | Severity | Why |
| --- | --- | --- |
| `savingsHeld`, `payoutRunsOpen`, `creditOutstanding` | **Blocks** | Turning off a flag whose module holds money would hide balances the factory owes. The figure is in the message, because "23 suppliers have money in the savings scheme" is an argument and "cannot disable" is not |
| `pointInUse` | **Blocks** | A delivery names its collection point and nothing else. Removing a point with leaf filed against it orphans those rows |
| `fallbackLanguageRequired` | **Blocks** | Every article and page falls back to English (AC-08). Removing it removes the floor |
| `surfaceRemoved` | Warns | A flag that only shows something is a choice the factory is entitled to make |
| `bankInUse` | Warns | A supplier's details keep the bank name; it just stops being offered for new ones |
| `languageDroppedWithCopy` | Warns | The copy survives, but stops being counted as missing — so nothing will tell you it is out of date |

**One `PATCH` per section, not a `PUT`.** Two administrators editing different parts of the
row is normal, and a save should carry only what its author touched. Sections are drafted
locally and saved as a unit so the impact list can describe the *complete* change: "remove
Deniyaya, add Kamburupitiya" as two patches would refuse the first for orphaning rows the
second would have kept.

## M15 Users & roles

*Who may use the console, and what each role may do.*

**Every refusal in this module is one failure wearing different clothes: a factory locking
itself out of its own console.** There is no recovery path outside the console, so the guard
is not a nicety.

| Guard | Where it can happen |
| --- | --- |
| **`last-admin`** | Suspending or re-roling the only user who can administer users. Withheld on the row *and* refused by the server |
| **`self-modification`** | Changing your own roles, or resetting your own second factor. Neither is recovery — the second is dropping your own second factor while holding a live session |
| **Matrix recovery** | The one nobody thinks of: strip `usersAndRoles` from every **role** and every user keeps the roles they had while nobody can manage users again. Not one user record changes, so a check written per user misses it entirely — `matrixKeepsRecovery` guards the *proposed matrix* |

`isLastAdministrator` is **derived per read**, not stored. It stops being true the moment
somebody else is given the role, and a stored flag would go on withholding the suspend
button afterwards.

**The §12.1 matrix is editable, which is what makes [rbac.md](./rbac.md) honest.** That
document always said the table is *"data, not code: a factory will want to split or merge
these roles, and that must not be a deploy"* — and until this module,
`packages/domain/src/rbac.ts` was the authority while calling itself a default. Now it is
the default it always claimed to be: the offline fallback, with the server's matrix winning.

**There is no delete.** A user who approved a payout or published a month is the actor on an
audit entry, and an entry whose actor cannot be resolved is not evidence — the same rule that
voids a delivery rather than removing it. Accounts are suspended, and the screen says why
where somebody would look for the delete button.

**MFA is owed, not enforced at the point of granting.** A user cannot enrol a second factor
before they have an account, so refusing to create a manager without one would make the
senior roles unassignable. The console states the obligation and shows *Two-factor not set
up* on the row; the sign-in is what insists.

## M16 Reports

*Figures pulled straight from the records, every time you look.*

**Four reports, and the shortness is the design.** §19.1 defines the reporting warehouse and
it lives in the mobile repository, not this one — so rather than inventing a plausible dozen,
these are the reports whose **definition already exists in this codebase**, each carrying its
citation on the row:

| Report | Defined by |
| --- | --- |
| `dormantSuppliers` | `SupplierQuery.dormantMonths`, whose own comment cites §19.2 |
| `channelShift` | `REQUEST_CHANNELS` — app adoption and channel shift, *"the two KPIs that justify the project"* (§19.3) |
| `leafByCollectionPoint` | M3's delivery rows |
| `monthSummary` | M4's rate and M5's bill run |

A fifth would be a guess dressed as a requirement, and a report the factory did not ask for
is a query somebody maintains and nobody reads. The screen says so where somebody would look
for the missing reports.

**A report is asked for and answered, never stored.** No saved reports, no scheduling: a
stored result is a second answer waiting to disagree with the records it came from — the same
argument that keeps a bill a read model over deliveries and a rate.

**The report describes itself.** Columns come with the rows, carrying what each one *is* —
money, kilos, a count, a percentage — so one screen renders any report. The API is the only
thing that knows a number's units, and a grid that guessed would print `LKR 412.00` over a
supplier count. It is the same rule as BR-110: the server says what a value is, the console
decides how it looks.

**Totals appear only under columns that add up, and the gaps are deliberate.** No supplier
total across collection points — a grower who delivers to two points is not two growers — and
no `appShare` total, because averaging monthly percentages across months of different sizes is
not the overall share. Both would be figures the office quotes.

`null` is never `0` (BR-102): a supplier who has never delivered has no last delivery, and a
month with no requests has no adoption share. Both render as an em dash.

**The month picker is served with the report list**, not fetched from M5's
`GET /admin/bill-months`. §12.1 gives the factory administrator `reports: R` and
`billing: none`, so a picker behind the billing grant left the one role that owns this
section with an empty picker and a screen that said "nothing to show yet" for a report they
are entitled to run. The list a report is chosen from belongs behind the same grant as the
report. (Found by the browser test, not the unit tests — those called the repository directly
and never rendered the picker.)

**No export**, and §19.5 is not met either: these queries run against the same store a clerk
is writing to, where §19.5 asks for a read replica. Both are in [status.md](./status.md)
rather than implied by a disabled download button. The grid is a real `<table>`, so the office
can select it and paste it into a spreadsheet, which is where the office lives.

---

## What is deliberately not built

With all seventeen modules routed, **this table is what "not finished" now means.** Every
row is an absence inside a built module, and each is stated on the screen where somebody
would look for the control — because a missing control that says nothing reads as a bug,
and a guessed one reads as a decision the factory never made.

| § | Question | What is missing | Why not guess |
| --- | --- | --- | --- |
| 21.17 | What format does the bank accept? | A **fixed-width** bank file, and cheque printing | Half answered as configuration: the CSV family is a layout the factory sets in M14. A fixed-width scheme is rules and control totals, which a column order cannot express |
| 21.9 | On what basis is interest calculated? | **Interest accrual only** — withdrawals are built | Closing balance and the year's minimum pay different money on the same rate, and it is the supplier's savings |
| 21.10 | Who may set which deduction line? | A deduction **editor** | It decides who can change what a supplier is paid, which is a permission, not a form |
| 21.8 | May a published bill be corrected? | Any post-publish change | The console assumes not. If the answer is yes, that is a new audited reversal endpoint — never a relaxation of BR-108's lock |
| 19.1 | What shape is the reporting warehouse? | The reports beyond the four whose definition already exists here | A report nobody asked for is a query somebody maintains and nobody reads. §19.1 is in the mobile repo, not this one |
| 21.24 | Which notifications fire, and who may compose one? | Nothing — it is answered as **configuration** | The one question that did not need an absence: triggers are rows, so the factory's answer is a switch rather than a rewrite |

---

## M9 Change requests

*Payout and savings-rate approvals.* The module that closes the loop.

**Queue.** Oldest first within a status — the opposite of every other list, and
deliberate: a queue is worked front to back, and the item that has waited longest
is the one at risk of breaching §14.4. A newest-first inbox is one where the oldest
item is never seen.

Current and requested are **in the grid**, not only on the detail page: most
decisions are obvious, and a clerk should be able to work a whole queue without
opening fourteen records.

**Detail.** Current vs requested side by side, because the office is deciding
whether to *replace* a value — a form showing only the new one asks them to approve
a change they cannot see.

**Deciding.** Approve and reject share a dialog and differ in copy: the approve
text explains what the supplier will see; the reject text reminds the clerk they
are writing *to* the supplier.

Three rules, each implemented rather than assumed:

| Rule | How |
| --- | --- |
| **AC-06** — rejecting without a note is impossible | Button disabled under 10 chars · Zod schema refuses · server answers `note-required`. Three layers, because this note is what the supplier reads as the reason |
| **BR-501 / AC-10** — nobody approves what they created | The buttons are not offered, and the server refuses with `four-eyes-violation` — because the console can be lied to |
| **AC-02** — approve changes the value, reject does not | The mutation invalidates the supplier, the queue, this request and the dashboard. Getting the asymmetry backwards would be invisible here and very visible in the app |

`already-decided` is handled as a first-class case: two clerks on one inbox is the
normal case, and the dialog stays open with an explanation and refetches rather
than discarding the note the clerk just wrote.

## M7 Credit queues

*Advances, loans and manure on credit.* **One queue, filtered — not three screens.**
The office does not have an advances clerk and a loans clerk; somebody works the
credit inbox, and the three facilities differ only in how the ceiling is priced.
Three screens would triple the navigation to save nobody a decision, and would hide
the case that matters most: one supplier with two open facilities against one set of
leaf.

**The screen is the working, not the answer.** AC-05 requires the eligibility
figures in a queue row to match `GET /advances|loans|manure/eligibility` for that
supplier *byte for byte, including the working* — because the supplier is looking at
the same numbers on their phone. So the detail page prints the arithmetic in the
order the rule reads it: months of history against the requirement, the average
monthly account and the multiple, the last settled rate and the kilos it was
multiplied by, then the ceiling, what is already drawn, and what is left.

`packages/domain/src/leafCredit.ts` is the single implementation. The console does
not re-derive; it renders what the server sent, and the server built it with
`buildCreditEligibility`. Two implementations of a ceiling agree until the first
rounding decision.

| Rule | How |
| --- | --- |
| **AC-05** — the figures match the app's | One shared function. The API imports it rather than reimplementing, and the integration suite asserts the ceiling against its own working rather than against a fixed number |
| **BR-310** — eligibility must not go stale | The decision carries `ceilingSeen`, the figure that was on screen. The server recomputes and answers `stale-eligibility` rather than lending against a number the approver never agreed to. **Approval only** — gating a rejection on fresh figures would trap the row, because they move again while the clerk reloads |
| **`over-ceiling`** — more than they may draw | Refused on both sides. The Approve button is *withheld* rather than disabled, with the reason above it: a disabled control invites "why?" and a hover title nobody reads |
| **BR-501** — four eyes on money | Checked **before** the figures, because who may decide does not depend on what the ceiling says |
| **§12.1** — read and decide are different roles | `creditRequests` is `R` for the clerk and the accountant, `A` for the manager alone. So the decision controls are capability-gated, unlike M9's — most people who open this screen cannot act on it, and they are told who can |

**An approval is a balance.** It raises `creditBalances[facility]`, which the next
eligibility read subtracts from the ceiling and the next bill deducts an instalment
against (§11.3). Without that write the module would be a queue that decides things
and changes nothing.

§21.6's manager threshold — above what amount a manager rather than a clerk must
approve — is **not** blocking: `canApproveAmount(…, null)` already treats "not
configured" as "the base capability suffices", so the number becomes config rather
than a rewrite.

## M10 Inquiries

*Messages from suppliers.* The module that completes the promise the rest of the
console makes: **every `pending` in the app is a queue here**, and this is the last
of them.

It is also the only queue whose rows are prose, which changes the grid. The subject
gets the width and the first line of the message sits under it, because reading
"July account is short" is what decides whether this is answered now or after lunch
— a row showing only a supplier code and a date makes every message look the same.

**Reply and close are different acts, deliberately.** Replying writes something the
supplier reads in the app; closing files a message that needed no answer — a
duplicate, a test, something meant for the weighing point. A single "resolve" with an
optional note would make the two indistinguishable in the record, and *how many
suppliers we actually answered* is the number §19.3's channel-shift KPI wants.

**No four-eyes rule, and that is not an omission.** BR-501 is about money: nobody
approves a payment they raised. Answering a question moves nothing, and requiring a
second clerk to release a reply would put a day between a supplier's question and its
answer to guard against a risk that does not exist.

§12.1 is unusual here and worth reading twice: inquiries are `A` for the **clerk**
and `R` for the manager. Answering a supplier is counter work; a manager reading the
queue is oversight. That is the opposite of every money module.

**Statuses are data (§21.18).** The console says `open | resolved | closed`; the
app's `Inquiry.status` has only `pending | approved | rejected`. The mapping is
imprecise — a closed message is not one that was *rejected* — and that imprecision is
exactly what §21.18 is being asked to resolve, so it lives in one function
(`inquiryStatusForApp`) rather than spread across screens. An answer that adds
`escalated` adds a row to `INQUIRY_STATUSES`, not a migration.

**Whether a reply is pushed is now a row, not a fact.** M13 owns the `inquiryReplied`
trigger, and this screen reads it: with the trigger on, answering fires a push; with it
off, the reply lands in the app the next time it is opened — and the screen says whichever
is true rather than a sentence that was true when it was written. A clerk who believes a
notification went out when it did not is a clerk who does not follow up.

## M17 Audit log

Filterable by entity, read-only, newest first. Built now rather than deferred
because AC-09 says every decision appears here with actor and before/after, and an
acceptance criterion with no screen behind it cannot be signed off.

Before/after render as JSON, deliberately: an audit entry is evidence, and a
prettified summary is an interpretation of evidence.

**CSV/XLSX export is listed in §18.1 and is not built** — recorded in
[status.md](./status.md) rather than implied by a disabled button.

---

## What a real deployment still needs

There is no "planned modules" table any more — §18.1's seventeen all have routes. What is
left is not module-shaped, and pretending otherwise would make this document read as
finished:

| Needs | Why it is not a console change |
| --- | --- |
| **A real API** | Every screen here talks to MSW, which is an executable reading of [api-contract.md](./api-contract.md). The handlers are the specification the server has to satisfy, not a stand-in for one — see [mocks.md](./mocks.md) |
| **§19.1's warehouse** | M16 grows a report list without a console release; the four here are the ones this codebase can define. §19.5 also asks that reports run off a **read replica**, and they currently read the same store a clerk is writing to |
| **§18.1 export** | CSV/XLSX for M16 and M17. Absent rather than a disabled button |
| **Answers to §21.8, §21.9, §21.10, §21.17** | Each is a decision about money or authority, listed above with what it would add |
| **A push provider** | M13 records what it *would* send and what it would reach. The topic prefix and category list are configured (M14); the transport is not this repository |
