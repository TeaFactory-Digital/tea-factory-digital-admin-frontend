# What the business analyst confirms, agrees and obtains

| | |
| --- | --- |
| **Status** | Draft for review |
| **Audience** | The business analyst on this project |
| **Your job here** | Three conversations, each with a different party, each producing a written answer |
| **Read first** | [factory-integration-spec.md](./factory-integration-spec.md) — the design, and why it is this shape |

---

## 1. Why this role carries the project

The design is deliberately narrow: **one read-only endpoint, no change to the Factory
System's business logic, and the office as the bridge.** That narrowness is what makes it
buildable — and it works only if a set of assumptions about the factory turn out to be
true.

**Nobody on either development team can check those assumptions.** They are questions
about the factory's data, the factory's office and the factory's commercial
relationships. That is this role.

Three conversations, and they are with three different people:

| With | About | Written up in |
| --- | --- | --- |
| **The Factory System team** | What their data actually contains | [factory-system-team.md](./factory-system-team.md) §10 |
| **The factory office** | The one new step in their day | [§3](#3-with-the-office--the-workflow) below |
| **Factory management** | Who instructs the vendor, and on what terms | [factory-management.md](./factory-management.md) §2 |

> ⚠️ **The third one is the blocking conversation and it is the easiest to postpone.** A
> perfect specification does not oblige anybody to build it. If management has not named
> who instructs the existing vendor and on what commercial basis, the rest of this list
> is preparation for work that may not start.

---

## 2. With the Factory System team — what their data holds

The endpoint is specified in [factory-system-team.md](./factory-system-team.md). Your job
is not to review the technical detail; it is to establish **which of it is real**.

### The two that decide the shape of everything

- [ ] **Does every table carry a modified timestamp?** The whole design pulls "what
      changed since yesterday" by filtering on it. If those columns do not exist, each
      collection falls back separately —
      [factory-system-team.md §7](./factory-system-team.md#7-if-either-assumption-is-false)
- [ ] **Can the Factory System serve HTTPS?** If it is a desktop application over a shared
      database, there is no server to put an endpoint on, and the fallback is a read-only
      database login — **a decision for management, not for the vendor's developers**

### The four that decide whether figures can be trusted

- [ ] **Is there a stable supplier id**, or only a supplier code that changes when a
      supplier moves division? Everything on the platform is keyed on it
- [ ] **Do the `outstanding*` balances include credit raised at the counter**, or only
      what came through the app? **This one loses money if it is wrong** — see
      [§4](#4-the-question-that-loses-money-if-it-is-wrong)
- [ ] **Are voided weighings retained or deleted?** If deleted, the platform can never
      learn that one was withdrawn
- [ ] **Are savings and credit balances stored, or derived on demand?** Derived balances
      may be expensive to serve on every call

### The one to obtain rather than ask

- [ ] **The Green Leaf Account layout, field by field.** The app prints a supplier's
      monthly slip and it must match the paper one the supplier already knows —
      same fields, same order, same words

---

## 3. With the office — the workflow

The office's day is unchanged except for **one new step**, and it is worth walking through
at the counter rather than describing in a meeting:

| Today | With the app |
| --- | --- |
| Kamal walks in and asks | The request appears in the new console |
| The clerk enters it into the Factory System | *unchanged* |
| The Factory System decides it | *unchanged* |
| The clerk tells Kamal | The clerk marks the request **Handled** in the new console, with the outcome |
| — | Kamal's app shows it, and a notification is sent |

- [ ] **Agree the Handled step**, and confirm it is a named person's job rather than
      "whoever is free". It is one click, and the supplier is told nothing if it is
      not made
- [ ] **Confirm the hours the factory actually weighs.** The platform's 05:30–20:00
      polling window is a guess, and the console's staleness warning is calibrated
      against it
- [ ] **Agree who is called when a sync fails**, at the factory and at the vendor

---

## 4. The question that loses money if it is wrong

The app shows a supplier what they may ask for:

```
    available  =  ceiling(the factory's configured rule)  −  outstanding
                  └─ the new console works this out ──┘     └─ Factory System ─┘
```

The left-hand side is settled: the factory configures its lending rule in the new console
and one shared implementation draws both the app's figure and the console's, so they
cannot disagree.

**The right-hand side is the risk.** If `outstanding` covers only credit raised through
the app, then a supplier who took an advance at the counter is shown headroom they have
already used — and can borrow the same money twice.

- [ ] **Confirm the Factory System's `outstanding*` figures are complete** — counter-raised
      and app-raised together. If they are not, say so **before build starts**: the app
      then shows no figure at all, which is a product decision rather than an
      implementation detail
- [ ] **Name the factory administrator who owns the lending rule screen**, and confirm the
      configured rule matches what the counter actually approves. The app prints that
      ceiling to suppliers before they ask

---

## 5. Your checklist, in one place

**Blocking — nothing starts without these**

- [ ] Management has named **who instructs the existing vendor**, and on what commercial
      basis ([factory-management.md §2](./factory-management.md#2-the-decision-the-project-actually-depends-on))
- [ ] The Factory System team has answered the **modified timestamp** and **HTTPS**
      questions

**Before build**

- [ ] Confirm which of the endpoint's fields the Factory System actually holds
- [ ] Confirm a **stable supplier id** exists
- [ ] Confirm `outstanding*` includes counter-raised credit
- [ ] Confirm whether voided weighings are retained
- [ ] Agree the office workflow, especially the **Handled** step
- [ ] Name the owner of the lending rule screen
- [ ] Agree who is called when a sync fails
- [ ] Obtain the Green Leaf Account layout, field by field

**Carry to the first meeting**

- [factory-system-team.md](./factory-system-team.md) and
  [`factory-updates-sample.json`](./factory-updates-sample.json) — for the Factory System
  team
- [factory-management.md](./factory-management.md) — for the factory's owner
- The full [factory-integration-spec.md](./factory-integration-spec.md) — for yourself
