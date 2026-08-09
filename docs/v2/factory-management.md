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

The full design is in [factory-integration-spec.md](./factory-integration-spec.md).
**This document only covers what management has to decide.**

---

## 2. The decision the project actually depends on

> **Somebody who does not work for us has to do one small piece of work, and only the
> factory can ask them to do it.**

The app needs to read the factory's own data — weighings, rates, accounts, balances. That
data lives in the **existing Factory System**, maintained by whoever built it. That team
is being asked for **one read-only endpoint**: a way for the app's platform to read the
figures. No change to how the system works, nothing rewritten, nothing removed.

It is a small piece of work. **It is also the piece that nothing else can proceed
without**, and the platform team has no relationship with the people who must do it.

### Three ways this stalls, none of them technical

| What happens | Why |
| --- | --- |
| **The existing vendor sees a competitor** | A new system touching their data reads as the first step to replacing them. A vendor who feels that rarely says so — the work simply takes a long time |
| **Nobody is named, so nobody acts** | *"We sent them the specification"* is not an instruction. It sits in an inbox belonging to no one |
| **It is agreed verbally** | No scope, no price, no date. It holds until the first invoice or the first busy week, and then it does not |

**A specification cannot create an obligation.** This one is written to be as small and as
unthreatening as the work honestly is — one read-only endpoint, no logic change, and a
section that names the three things it deliberately does *not* ask for. That is as far as
a document can go. The rest is a commercial relationship the factory owns.

### What to settle before any building starts

- [ ] **Who at the factory instructs the existing vendor?** A **name**, not a department.
      This person receives the vendor's questions and answers them
- [ ] **Is this work inside the existing maintenance contract, or is it a quoted
      change?** Ask the vendor to say which, in writing, before the first build meeting
- [ ] **If it is quoted — what is the price and who approves it?** A modest quote
      approved slowly costs the project more than a large one approved quickly
- [ ] **What is the agreed delivery date**, and what does the factory do if it passes?
- [ ] **Who at the vendor is doing it?** One named engineer. "The team will look at it"
      is the answer that produces nothing

### If the vendor declines, or cannot deliver

Say so early rather than waiting. There is a fallback and it asks the vendor for *less*,
not more:

> **Give the platform team a read-only login to the database.** No code change at all —
> genuinely less work for the vendor than building anything. The platform team then
> builds and hosts the reading part itself.

This is a **larger trust decision**, not a smaller one — a login can read more than a
purpose-built endpoint would expose. It should be scoped to a named user, named tables
and a named source address, and that is the factory's call to make, not the platform
team's. The detail is in
[factory-system-team.md §7](./factory-system-team.md#7-if-either-assumption-is-false).

**If both are refused, the factory should know what it still gets:** the app can be built
and released with supplier accounts, factory news, notifications, and the ability to
*send* requests to the office. **What it cannot show is money** — no weighings, no monthly
account, no balances — because those figures exist only in the Factory System. That is a
materially smaller product, and it is better known now than six months in.

---

## 3. The one new thing the office is asked to do

Today a supplier walks in and asks; the clerk keys it into the Factory System; the
Factory System decides; the clerk tells the supplier.

With the app, everything is the same **except the last step**: instead of telling the
supplier across the counter, the clerk marks the request **Handled** in the new console
and records what the factory decided. **It is one click**, and it exists so the supplier's
phone can tell them — which is the point of the whole project.

- [ ] **Confirm the office agrees to that step**, and that it is somebody's named job.
      Every other part of the office's day is unchanged

---

## 4. Who owns the lending rule

The app shows a supplier **how much they may ask for** before they ask. That figure comes
from a rule the factory configures in the new console — a basis, a multiplier, a cap, and
how much history a supplier needs.

**The office still decides each actual request.** The app's figure is a guide, not a
promise. But if the configured rule says one thing and the counter does another, the app
is promising money the factory will not lend.

- [ ] **Name the factory administrator who owns that screen**, and confirm the configured
      rule matches what the counter actually approves

---

## 5. Who is called when it breaks

The app's figures are copies, refreshed from the Factory System through the day. If that
refresh stops, the console says so on every screen — but somebody has to act on it.

- [ ] **Name who is called when the sync fails**, at the factory and at the vendor

---

## 6. What management is *not* being asked to decide

Worth stating, because it is the usual worry:

| | |
| --- | --- |
| **Any change to how the factory calculates anything** | Not asked for. Rates, accounts, deductions, payouts and approvals stay exactly as they are |
| **Replacing the existing Factory System** | Not proposed, now or later |
| **Who may approve credit** | Unchanged. The office decides, in the system it decides in today |
| **New work for the collection points** | None. Weighing is unchanged |

---

## 7. The short version

| Decision | Owner | Blocking? |
| --- | --- | --- |
| Who instructs the existing vendor, and on what commercial terms | **Management** | ✅ **Yes — nothing starts without it** |
| What happens if the vendor declines | **Management** | ✅ Yes |
| The office's **Handled** step | Management + office | ✅ Yes |
| Who owns the lending rule screen | Management | Before the app shows a limit |
| Who is called when the sync fails | Management | Before go-live |
