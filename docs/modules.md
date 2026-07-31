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
| M3 | Leaf collection | ⏳ Planned | — |
| M4 | Rates & month close | ⏳ Planned | — |
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
- **M3 and M4 were deliberately not first.** §18.2 names them as where the project
  succeeds or fails, and M4 is gated on business answers that are still open
  (status.md §21.1–21.2). Building a month-close checklist before the factory has
  answered whether a published bill may be corrected is building it twice.

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
| **M3 Leaf collection** | Nothing external, but it is **a data-entry product, not a screen**: keyboard-only entry (tab code → kg, Enter commits), supplier-code autocomplete tolerating the division suffix, running totals that catch a mistyped kilo, undo, and a scale-file import. Needs the batch endpoint in [api-contract.md](./api-contract.md) §9 |
| **M11 / M12 Content** | Nothing external. si/en/ta tabs from `config.localization.contentLanguages`, with **missing translations visible to the editor** (AC-08) |
| **M14 Configuration** | Nothing external. It is the other end of `GET /config`, and AC-12 says a new factory must go live through it without a code deploy |
| **M4 Rates & month close** | **Blocked**: §21.8 (may a published bill be corrected?) decides whether `bills` is immutable. Also irreversible — needs a checklist that will not let the accountant past an unresolved exception, and manager approval (BR-501) |
| **M5 Bills** | Depends on M4. AC-03 requires field-for-field identity with the app's Home screen and the PDF |
| **M6 Payouts** | **Blocked**: §21.17 — what format the factory's bank accepts (SLIPS / CEFTS / bank-specific CSV), and whether cheques print on pre-printed stock |
| **M8 Savings** | **Blocked**: §21.9 — may a supplier withdraw, with what notice, is interest paid |
| **M13 Notifications** | **Blocked**: §21.24 — does the office compose every send by hand, or does bill-published fire automatically off the publish step, and who may send free-text |
| **M15 Users & roles** | Nothing external, but it must edit the §12.1 matrix **as data** (see [rbac.md](./rbac.md)), and MFA enrolment belongs here |
| **M16 Reports** | Needs the warehouse shape from §19.1 more than the report list. Run off a read replica (§19.5) |
