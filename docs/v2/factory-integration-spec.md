# Integration Specification

**Between the existing Factory System and the new Supplier Mobile App**

| | |
| --- | --- |
| **Status** | Draft for review |
| **What we ask the Factory System team to build** | **One read-only endpoint.** Nothing else |
| **What changes in the Factory System's business logic** | **Nothing** |
| **This document** | The design, and why it is this shape. Shared by every audience |

---

## Who reads what

**This document is the shared core.** Each audience has its own document holding the part
that asks something of *them* — one home per fact, so nothing has to be kept in step
between copies.

| You are | Hand you | Which holds |
| --- | --- | --- |
| **The existing Factory System team** | [factory-system-team.md](./factory-system-team.md) **+ [`factory-updates-sample.json`](./factory-updates-sample.json)** | The endpoint, field by field. The only document that asks them to build anything |
| **The business analyst** | [business-analyst.md](./business-analyst.md) | The three conversations to run, and what each must produce in writing |
| **The platform team** | [platform-team.md](./platform-team.md) | Consuming the endpoint, the credit ceiling, the freshness indicator |
| **The factory's owner / management** | [factory-management.md](./factory-management.md) | The commercial and workflow decisions nobody else can make — **including who instructs the existing vendor** |

> **Sending this to the factory's vendor?** Send
> [factory-system-team.md](./factory-system-team.md) and the sample JSON, not this file.
> This one carries the reasoning, which is ours rather than theirs.

---

## 1. What this project is

**The factory is giving its suppliers a mobile app.** That is the whole of it.

The existing Factory System runs the business and **keeps running it, unchanged** —
leaf collection, monthly rates, Green Leaf Accounts, payouts, savings, advances,
loans, manure and tea packets. Every rule, every calculation and every decision stays
exactly where it is today.

What is new is **where the supplier stands**:

```
        TODAY                                AFTER

  Supplier walks to the office        Supplier opens the app
            │                                   │
            │                                   ▼
            │                         ┌──────────────────────┐
            │                         │  App Platform (new)  │
            │                         │  · shows their data  │
            │                         │  · takes requests    │
            │                         └──────────┬───────────┘
            │                                    │ the office reads it
            ▼                                    ▼
  ┌───────────────────┐               ┌───────────────────┐
  │  Factory System   │               │  Factory System   │
  │   (everything)    │               │   (everything)    │
  │                   │               │    UNCHANGED      │
  └───────────────────┘               └───────────────────┘
```

The supplier used to come to the counter. Now the request arrives on a screen. **The
office does the same work, in the same system, as before.**

### 1.1 What each side does

| | Existing Factory System | App Platform (new) |
| --- | --- | --- |
| Leaf, rates, accounts, payouts, savings | ✅ **Owns and decides** | Displays a copy |
| Advances, loans, manure, tea packets | ✅ **Owns and decides** | Receives the request, displays the outcome |
| Supplier registry, balances | ✅ **Owns** | Displays a copy |
| Mobile app accounts, passwords, devices | — | ✅ Owns |
| App content — news, banners, FAQ, terms | — | ✅ Owns |
| Push notifications | — | ✅ Owns |
| Which features the app shows | — | ✅ Owns |
| The lending **rule** configuration | — | ✅ Owns (§3.4) |

> **One sentence for the BA:** the Factory System remains the single source of truth
> for everything about money. The App Platform is a window onto it, plus a letterbox
> for requests.

---

## 2. The constraint that shapes this design

> **The Factory System's business logic does not change.**

That rules out three things a textbook integration would ask for, and it is worth
naming them so nobody proposes them later:

| ✗ Not asked for | Why it would be a logic change |
| --- | --- |
| Storing an external reference against a request | A schema change and a write path |
| Calling an outside API before generating accounts | A change to the bill-run job |
| Accepting a decision made elsewhere | A change to who may approve |

**What *is* asked for is one read-only endpoint** — data going out. Reading does not
change how the business works.

Everything below is designed around that single ask.

> ⚠️ **The constraint that is not technical.** The team that must build that endpoint does
> not work for us, and a specification cannot create an obligation. Who instructs them,
> and on what commercial basis, is
> [factory-management.md §2](./factory-management.md#2-the-decision-the-project-actually-depends-on)
> — and it blocks everything here.

---

## 3. How the duplicate problem is solved

This is the question that decides the design, so it comes before the endpoints.

### 3.1 The problem, if we get it wrong

> Kamal asks for an advance in the app. The office enters it into the Factory System.
> The Factory System sends it back to us in the next sync. **We do not recognise it and
> record a second advance.** Kamal appears to have borrowed twice.

### 3.2 The solution: we never create a credit record at all

**The App Platform does not create advances. It creates *messages*.**

| | What it is |
| --- | --- |
| **App Platform** | An **inbox**. "Kamal asked for Rs. 10,000 on 2 August." That is a *message*, not a facility |
| **Factory System** | The **record**. The advance itself — the balance, the instalments, the deduction on the account |

Since only one system ever creates the record, **there is nothing to duplicate.** The
matching problem does not need solving; it needs not to exist.

```
   ┌────────────────────────────────────────────────────────────┐
   │  App Platform                                              │
   │                                                            │
   │   "Kamal asked for an advance of Rs. 10,000 on 2 Aug"     │
   │    └─ a message. No balance. No instalment. No deduction. │
   │                                                            │
   └────────────────────────────────────────────────────────────┘
                              │
                       the office reads it
                              │
                              ▼
   ┌────────────────────────────────────────────────────────────┐
   │  Factory System                                            │
   │                                                            │
   │   ADV-2026-08-0042  ·  Rs. 10,000  ·  approved            │
   │    └─ THE record. Balance, instalments, deductions.        │
   │                                                            │
   └────────────────────────────────────────────────────────────┘
                              │
                     comes back in the sync
                              ▼
   ┌────────────────────────────────────────────────────────────┐
   │  App Platform displays it                                  │
   │   "Outstanding advance: Rs. 10,000"                        │
   │    └─ read from the Factory System. Not our number.        │
   └────────────────────────────────────────────────────────────┘
```

### 3.3 What the office does

The workflow is the same one the office runs today, with the walk-in replaced by a
screen:

| Today | With the app |
| --- | --- |
| Kamal walks in and asks | The request appears in the new console |
| The clerk enters it into the Factory System | *unchanged* |
| The Factory System decides it | *unchanged* |
| The clerk tells Kamal | The clerk marks the request **Handled** in the new console, with the outcome |
| — | Kamal's app shows it, and a notification is sent |

**The one new step is the last one**, and it takes a click. It exists so the supplier
is told — which is the point of the whole project.

### 3.4 Who decides, and what each side calculates

**The Factory System decides. Every time.**

The office enters the request into the Factory System exactly as it does today, the
Factory System applies the factory's lending rules, and the clerk then records the
outcome in the new console (§3.3's **Handled** step). The console is where a decision is
*written down* — never where it is *made*. Deciding elsewhere would change who may
approve, which [§2](#2-the-constraint-that-shapes-this-design) rules out.

That leaves one question: what does the app show a supplier **before** they ask?

#### The ceiling the app shows is this platform's, and the factory admin owns it

**The lending rule is configuration in the new console, not a formula in anybody's
build.** The factory administrator sets it under *Settings → Credit rules* — a basis, a
multiplier, how many months to average, how many settled months are required, and an
optional cap, per facility. See `modules.md` **M14 · Credit rules**.

There is exactly **one implementation** of the arithmetic, `creditCeilingFromRule`
(`packages/domain/src/leafCredit.ts`), shared between this platform and the mobile app.
The supplier reads the factory's own configured policy, computed once — not a second
formula that agrees with the console's until the first policy change.

**The console's request queue does not check against it.** Under this integration the
queue *records* the factory's decision and nothing more — no `over-ceiling`, no
`stale-eligibility`, and the button reads *"Approved by the factory"* (see
[integration.md](./integration.md)). The ceiling's job here is to tell the supplier
**what to ask for**, never to gate **what the office may approve**.

```
    available  =  ceiling(configured rule, leaf history)  −  outstanding
                  └─ App Platform ────────────────────┘     └─ Factory System ─┘
                     one rule · one implementation            the only unknown
```

**This is why the ceiling is not a copy of anything.** The Factory System holds no
lending rule for it to drift from — the factory's policy lives in the console, where the
administrator maintains it, and both screens read it from there.

> ⚠️ **But the App Platform must never compute the right-hand term from its own
> records.** A supplier who took an advance at the counter has a balance the platform has
> never seen; subtracting only what it knows about shows headroom that is not there — and
> a supplier shown Rs. 15,000 and refused it at the counter trusts the app less
> afterwards, not more.

**So the `outstanding*` fields must be the Factory System's complete balances** —
counter-raised and app-raised together
([factory-system-team.md §3](./factory-system-team.md#3-field-notes--please-read-these)).
Configuring the rule in the console solves the left-hand term completely; **it does
nothing for the right-hand one.** If the Factory System can report only app-raised credit,
say so before build starts: the app would then have to stop showing a figure at all,
which is a product decision rather than an implementation detail.

#### The one obligation this leaves on the factory

The console computes the ceiling. **The office still decides the request.** So the
configured rule must match what the office actually approves — if *Credit rules* says
3× the last settled month and the counter refuses anything above Rs. 30,000, the app is
promising money the factory will not lend.

That is not a drift between two systems; it is a drift between a **configured policy and
an actual practice**, and it has one owner: **the factory administrator who maintains the
screen**. Naming that owner is
[a management decision](./factory-management.md#4-who-owns-the-lending-rule), not a build
item.

### 3.5 Why not match records automatically?

Three alternatives were considered and rejected under the "no logic change"
constraint:

| Approach | Why not |
| --- | --- |
| Factory System stores our reference and echoes it | A schema and logic change — ruled out by §2 |
| Match on supplier + type + amount + date | Two advances of the same amount in a week match wrongly. Silent, and about money |
| Clerk types our reference into a notes field | Workable, but a typo produces a silent wrong match |

**Not creating the record in the first place is better than any of them**, and it is
free.

> If the Factory System team can later store an external reference (§6), the
> **Handled** click can be automated away. It is an optimisation, not a prerequisite.

---

## 4. How data moves

**One direction, one endpoint.** Everything the app shows about money is a copy of the
Factory System, pulled automatically.

```
┌──────────────────────┐                        ┌──────────────────────┐
│   Factory System     │                        │    App Platform      │
│   (unchanged)        │                        │    (new)             │
└──────────────────────┘                        └──────────────────────┘
           │                                               │
           │   GET /api/updates?from=&to=&include=&limit=  │
           │◄──────────────────────────────────────────────┤  hourly, 05:30–20:00
           │                                               │  automatic
           ├──────────────────────────────────────────────►│  no human step
           │   suppliers · deliveries · months             │
           │   bills · requests · balances                 │  ~8–40 KB gzipped
           │                                               │
           └───────────────────────────────────────────────┘

           ◄── requests travel back on paper, not on wire ──►
                    (the office reads the console and
                     enters them as it always has)
```

**There is no second endpoint and no callback**, because there is nothing for the
Factory System to receive: the office is the bridge, exactly as it is today.

The endpoint itself — parameters, payload, field notes, volume, and the fallbacks if the
Factory System cannot serve it as written — is
[factory-system-team.md](./factory-system-team.md).

---

## 5. Rules that must hold on both sides

| Rule | Why |
| --- | --- |
| **`null` ≠ `0`** | "Earned nothing" and "not settled yet" are different sentences |
| **Money: numbers, 2 decimals** | A figure that arrives as a string is parsed differently on each side |
| **Truncate, never round up** | The supplier did not agree to a rounded-up rupee |
| **Dates are Colombo local** | A weighing at 8pm on the 31st belongs to that month |
| **The same range may be re-fetched safely** | Every sync can be retried. Nothing may double-apply |
| **A void is sent, not omitted** | An absent row and a withdrawn row are different facts |
| **A failed sync is loud** | Silence must never look like agreement |

---

## 6. Optional, later — not required now

If the Factory System team can do these **at some future point**, they remove the
manual step in §3.3. None is needed for the first release, and none should delay it.

| Upgrade | What it removes |
| --- | --- |
| Accept a request over an API (create only, same rules) | The office re-keying an app request |
| Store an external reference against a request | The **Handled** click; the platform could match automatically |
| Send a webhook when a request is decided | The hourly wait before the supplier is told |

**Do not design the first release around these.** Deliver the endpoint, prove it, and
revisit.
