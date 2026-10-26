# Decisions only the factory can make

| | |
| --- | --- |
| **Status** | Draft for review |
| **Audience** | The factory's owner and management |
| **What this document is** | The handful of decisions that are the factory's, not the developers' |
| **What it is not** | A technical document. Nothing here needs a developer to read it |

---

## 1. What is being built, in one paragraph

**The factory is giving its suppliers a mobile app.** A supplier will see their own
weighings, their monthly account and their balances on a phone, and will be able to ask
for an advance, a loan, manure or tea packets without walking to the office.

**The factory's existing system keeps running the business exactly as it does today.**
Every rate, every account, every payout and every approval stays where it is. The app is
a window onto that, plus a letterbox for requests. The office still decides, still keys
the request into the existing system, and still holds every rupee of the accounting.

**Until the existing system is connected**, the "Factory system sync" stays **off**, which
is how every factory starts: the office keeps suppliers, leaf, rates, bills and balances in
the new console instead, and the app reads them from there
([factory-records.md](./factory-records.md)). The sync is switched on only deliberately,
once the factory's system is connected. This is Galaboda's arrangement today: its own
system keeps printing the bills, and the office imports them into the console each month.

The full design is in [factory-integration-spec.md](./factory-integration-spec.md).
**This document only covers what management has to decide**, and records what it has
already decided (§2a).

---

## 2. The decision the project actually depends on

> **Somebody who does not work for us has to do one small piece of work, and only the
> factory can ask them to do it.**

The app needs to read the factory's own data: weighings, rates, accounts, balances. That
data lives in the **existing Factory System**, maintained by whoever built it. That team
is being asked for **one read-only endpoint**: a way for the app's platform to read the
figures. No change to how the system works, nothing rewritten, nothing removed.

It is a small piece of work. **It is also the piece that nothing else can proceed
without**, and the platform team has no relationship with the people who must do it.

### Three ways this stalls, none of them technical

| What happens | Why |
| --- | --- |
| **The existing vendor sees a competitor** | A new system touching their data reads as the first step to replacing them. A vendor who feels that rarely says so; the work simply takes a long time |
| **Nobody is named, so nobody acts** | *"We sent them the specification"* is not an instruction. It sits in an inbox belonging to no one |
| **It is agreed verbally** | No scope, no price, no date. It holds until the first invoice or the first busy week, and then it does not |

**A specification cannot create an obligation.** This one is written to be as small and as
unthreatening as the work honestly is: one read-only endpoint, no logic change, and a
section that names the three things it deliberately does *not* ask for. That is as far as
a document can go. The rest is a commercial relationship the factory owns.

### What to settle before any building starts

- [ ] **Who at the factory instructs the existing vendor?** A **name**, not a department.
      This person receives the vendor's questions and answers them
- [ ] **Is this work inside the existing maintenance contract, or is it a quoted
      change?** Ask the vendor to say which, in writing, before the first build meeting
- [ ] **If it is quoted, what is the price and who approves it?** A modest quote
      approved slowly costs the project more than a large one approved quickly
- [ ] **What is the agreed delivery date**, and what does the factory do if it passes?
- [ ] **Who at the vendor is doing it?** One named engineer. "The team will look at it"
      is the answer that produces nothing

### If the vendor declines, or cannot deliver

Say so early rather than waiting. There is a fallback and it asks the vendor for *less*,
not more:

> **Give the platform team a read-only login to the database.** No code change at all:
> genuinely less work for the vendor than building anything. The platform team then
> builds and hosts the reading part itself.

This is a **larger trust decision**, not a smaller one: a login can read more than a
purpose-built endpoint would expose. It should be scoped to a named user, named tables
and a named source address, and that is the factory's call to make, not the platform
team's. The detail is in
[factory-system-team.md §7](./factory-system-team.md#7-if-either-assumption-is-false).

**If both are refused, the app still shows money**, but the office must keep the records
in the new console with the sync off: suppliers and their opening balances, each day's
leaf, the month's rate, and the bills (imported from the factory's own system each month,
or calculated in the console). That is more work for the office than the sync, and it is
better decided now than six months in.

---

## 2a. Already decided

Decided by the factory between 9 and 26 October 2026 (the detail is in
[factory-records.md §8](./factory-records.md#8-decided-by-the-factory)). Nothing here is
open.

| # | Decision |
| --- | --- |
| 1 | **Transport** can differ by collection point and by supplier |
| 2 | The bill's `otherCards` line is **"Other deductions"**: small deductions the office types, each with a reason |
| 3 | **The bill follows the printed slip**: the coins brought forward are part of the gross, the payment is rounded to the factory's unit (Galaboda pays in tens), and "Loans / Advance 3" is the loan and its instalment number |
| 4 | **Galaboda's own system keeps printing the bills**; the office imports them and the console must match them exactly. A factory whose system cannot export its bills has them calculated in the console. In both cases the office also enters every approval in the factory's own system |
| 5 | **An advance is closed within its month**: deducted in full on that month's bill; anything the account cannot cover becomes Next Month Deb |
| 6 | **"Loan Balance" is the loan's** balance; **"Loan Interest" is this month's charge** in rupees |
| 7 | **Loan interest** is 0% unless set in Configuration, and the factory chooses whether it is taken on top of the instalment or inside it |
| 8 | **No new loan and no advance while a loan is owed** (manure is not affected) |
| 9 | **A supplier number is unique across the factory** |
| 10 | **Bill numbers**: the year of the bill's month, and a serial that never resets |
| 11 | **The office enters each day's leaf** while the sync is off |
| 12 | **A calculated bill that does not match the printed slip is held**: the rest of the month is published, the held bill is fixed and released on its own, and that supplier's next bill waits behind it |
| 13 | **Importing a file again skips what is already there**; a supplier already in the console is left as they are |
| 14 | **Galaboda's slip** carries only what was approved by the month's last day; a blank balance is 0 |
| 15 | **Imported months**: a division file that arrives after the month is published waits for a manager to publish its bills, and **whoever imported a month's bills cannot publish them** |
| 16 | **The sync starts off.** A factory keeps its records in the new console until its own system is connected and the sync is switched on deliberately |
| 17 | **The factory administrator can see the factory's records** (leaf, rates, bills) but not change them; entering, approving and publishing stay with the clerk and the manager |

---

## 3. The one new thing the office is asked to do

Today a supplier walks in and asks; the clerk keys it into the Factory System; the
Factory System decides; the clerk tells the supplier.

With the app, everything is the same **except the last step**: instead of telling the
supplier across the counter, the clerk marks the request **Handled** in the new console
and records what the factory decided. **It is one click**, and it exists so the supplier's
phone can tell them, which is the point of the whole project.

- [ ] **Confirm the office agrees to that step**, and that it is somebody's named job.
      Every other part of the office's day is unchanged

**With the sync off** (Galaboda's arrangement) the office's work is different, and two jobs need
a named owner:

- [ ] **Who types each approval made in the new console into the factory's own system**
      before the bills are printed. An imported bill file that lacks an approved advance,
      loan, manure or tea packet is refused, naming the supplier
- [ ] **Who imports the month's finished bills, and who publishes them.** Two different
      people: the one who imports cannot publish (four-eyes). A clerk may import; a
      manager publishes, including the bills of a division file that arrives late

---

## 4. Who owns the lending rule

The app shows a supplier **how much they may ask for** before they ask. That figure comes
from a rule the factory configures in the new console: a basis, a multiplier, a cap, and
how much history a supplier needs.

**The office still decides each actual request.** The app's figure is a guide, not a
promise. But if the configured rule says one thing and the counter does another, the app
is promising money the factory will not lend.

- [ ] **Name the factory administrator who owns that screen**, and confirm the configured
      rule matches what the counter actually approves

---

## 5. Who is called when it breaks

With the sync on, the app's figures are copies, refreshed from the Factory System through
the day. If that refresh stops, the console says so on every screen, but somebody has to
act on it. (With the sync off there is no refresh to stop.)

- [ ] **Name who is called when the sync fails**, at the factory and at the vendor

---

## 6. What management is *not* being asked to decide

Worth stating, because it is the usual worry:

| | |
| --- | --- |
| **Any change to how the factory calculates anything** | Not asked for. Rates, accounts, deductions, payouts and approvals stay exactly as they are |
| **Replacing the existing Factory System** | Not proposed, now or later |
| **Who may approve credit** | Unchanged. The office decides: with the sync on, in the system it decides in today; with it off, in the new console, where the person who records a request cannot approve it |
| **New work for the collection points** | None. Weighing is unchanged |

---

## 7. The short version

| Decision | Owner | Blocking? |
| --- | --- | --- |
| Who instructs the existing vendor, and on what commercial terms | **Management** | ✅ **Yes, for the sync; nothing on it starts without it** |
| What happens if the vendor declines (a database login, or the sync off) | **Management** | ✅ Yes |
| The office's **Handled** step (sync on) | Management + office | ✅ Yes |
| Who types approvals into the factory's system, who imports the bills and who publishes them (sync off) | Management + office | Before the first month is imported |
| Who owns the lending rule screen | Management | Before the app shows a limit |
| Who is called when the sync fails (sync on) | Management | Before go-live |

The decisions in §2a are taken and are not repeated here.
