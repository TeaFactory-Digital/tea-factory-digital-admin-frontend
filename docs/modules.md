# Modules

The §18.1 module map, what is built, and what each planned module needs. Scope and
rationale for all 17 are in the mobile repo's `docs/admin-console.md`; this is the
console's state against it.

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
| M4 | **Rates & month close** | ✅ Built (bills not generated) | `/rates` |
| M5 | Bills | ⏳ Planned | — |
| M6 | Payouts | ⏳ Planned | — |
| M7 | Credit queues | ⏳ Planned | — |
| M8 | Savings | ⏳ Planned | — |
| M10 | Inquiries | ⏳ Planned | — |
| M11 | News (CMS) | ⏳ Planned | — |
| M12 | Static content | ⏳ Planned | — |
| M13 | Notifications | ⏳ Planned | — |
| M14 | Configuration | ⏳ Planned | — |
| M15 | Users & roles | ⏳ Planned | — |
| M16 | Reports | ⏳ Planned | — |

**Planned modules have no routes.** They appear in the sidebar as disabled rows
with a *Planned* chip. A route rendering "coming soon" is worse than no route — it
is a URL a clerk can bookmark, share, and then report as broken. The rows are
shown rather than hidden because the office signed off a 17-module scope, and a
sidebar with four rows reads as a different product.

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
- **M3 and M4 were deliberately not first**, and are now the second slice. §18.2
  names them as where the project succeeds or fails, which is the argument for
  building them on a foundation that was already proven end to end rather than at
  the same time as it.
- **What was left out of M4 rather than guessed at.** §21.8 — may a published bill
  be corrected? — decides whether `bills` is immutable, so bill *generation* is not
  built and the `billsGenerated` stage is unoccupied. The month close itself does
  not depend on that answer: a rate, a resolved exception list and a second pair of
  eyes are required whatever the answer turns out to be.

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

**Not built yet:** bill generation. The stage enum has `billsGenerated` between
`rateEntered` and `published`, and nothing occupies it — publishing currently goes
straight from the rate and a clear exception list. That is M5, and §21.8 (may a
published bill be corrected?) shapes it.

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

## M17 Audit log

Filterable by entity, read-only, newest first. Built now rather than deferred
because AC-09 says every decision appears here with actor and before/after, and an
acceptance criterion with no screen behind it cannot be signed off.

Before/after render as JSON, deliberately: an audit entry is evidence, and a
prettified summary is an interpretation of evidence.

**CSV/XLSX export is listed in §18.1 and is not built** — recorded in
[status.md](./status.md) rather than implied by a disabled button.

---

## What each planned module needs

Ordered by what I would build next.

| Module | Blocked on / needs |
| --- | --- |
| **M7 Credit queues** | Nothing external. AC-05 needs eligibility byte-for-byte identical to the app's endpoint, including the working — `packages/domain/src/leafCredit.ts` is already the shared implementation. §21.6 (manager threshold) shapes it but `canApproveAmount(…, null)` already handles "not configured" |
| **M10 Inquiries** | Nothing external. §21.18 asks whether Resolved/Closed is the right pair — build with the two and add states as data |
| **M11 / M12 Content** | Nothing external. si/en/ta tabs from `config.localization.contentLanguages`, with **missing translations visible to the editor** (AC-08) |
| **M14 Configuration** | Nothing external. It is the other end of `GET /config`, and AC-12 says a new factory must go live through it without a code deploy |
| **M5 Bills** | M4 is built, so the rate and the close exist. Still open: §21.8 — may a published bill be corrected? That decides whether `bills` is immutable. AC-03 requires field-for-field identity with the app's Home screen and the PDF |
| **M6 Payouts** | **Blocked**: §21.17 — what format the factory's bank accepts (SLIPS / CEFTS / bank-specific CSV), and whether cheques print on pre-printed stock |
| **M8 Savings** | **Blocked**: §21.9 — may a supplier withdraw, with what notice, is interest paid |
| **M13 Notifications** | **Blocked**: §21.24 — does the office compose every send by hand, or does bill-published fire automatically off the publish step, and who may send free-text |
| **M15 Users & roles** | Nothing external, but it must edit the §12.1 matrix **as data** (see [rbac.md](./rbac.md)), and MFA enrolment belongs here |
| **M16 Reports** | Needs the warehouse shape from §19.1 more than the report list. Run off a read replica (§19.5) |
