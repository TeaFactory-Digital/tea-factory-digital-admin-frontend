# Integrating with the factory's own console

**The deliverable for whoever builds the bridge.** The factory runs an existing
system with its own database; this platform — the supplier app, this console and the
API behind them — is new. Neither can be rewritten into the other, so they have to
agree, and this document says about what.

It is written the same way [api-contract.md](./api-contract.md) is: what must happen,
what must be refused, and why — so a disagreement about a figure has a paragraph to
settle it rather than an argument.

> **This console needs no change to support any of this.** It talks to one API
> (`VITE_API_BASE_URL`) and always has. The integration is between *that* API and the
> factory's system, and the console's only stake in it is freshness — see
> [What the office has to be told](#what-the-office-has-to-be-told).

---

## 1. The thing to get right first

**This is not an import.** The word invites a picture that is wrong in a way that is
expensive to discover late:

```
   ✗ what "import" suggests          ✓ what is actually true

   factory ──────► platform          factory ◄──────► platform
     (once a day, one way)             (both ways, on a deadline)
```

Data flows **in both directions**, and the direction most people forget is the one
with a deadline on it. An advance approved in this console must appear as a deduction
line on a bill the *factory's* system generates. Miss it, and a supplier who was told
*yes* sees nothing on their account and telephones the office — which is the failure
this whole platform exists to prevent.

Any design that treats this as a nightly one-way file drop will produce a monthly
reconciliation done by hand. That is precisely what v2's scope split was for
([modules.md](./modules.md) → *What moved to the factory's own console*), and an
integration that reintroduces it has undone the decision it was built to serve.

---

## 2. Who owns what

Each system is the **system of record** for different facts. Neither is "the master"
overall, and pretending otherwise is what makes these projects fail.

| Fact | Owner | The other system |
| --- | --- | --- |
| Leaf delivered, per supplier per day | **Factory** | Reads totals only |
| The monthly rate, and the month's stage | **Factory** | Reads |
| The Green Leaf Account (bill), every line | **Factory** | Reads, renders, never edits |
| Payouts, and whether one was paid | **Factory** | Does not read today |
| Savings balances and the passbook | **Factory** | Reads the balance |
| Supplier registry — who exists, their code | **Factory** | Reads |
| **App account** — has the app, devices, password | **Platform** | Does not need it |
| **Bank details, payment method, savings rate** | **Contested — see §5** | — |
| **Home and estate address** | **Contested — see §5** | — |
| Approved credit, and tea packets | **Platform** | Must deduct them |
| News, banners, static pages, push | **Platform** | Does not need it |
| Feature flags, branding, the `client_config` row | **Platform** | Does not need it |

The three contested rows are the whole difficulty. Everything else is a copy.

---

## 3. Direction 1 — factory → platform

What the app and this console cannot function without.

| What | When it must arrive | Why that timing |
| --- | --- | --- |
| **A published bill**, every field | Within minutes of the month being published | The supplier is told *"your account is ready"* by a push that fires on the same event. A push whose bill has not landed opens the app on a blank screen |
| **The month's stage** (§13) | On every change | `awaitingRate` is *why the app shows blanks instead of amounts*. Without it the office cannot answer the telephone |
| **Supplier registry changes** — new supplier, code, suspension | Same day | A supplier who cannot sign in because the platform has never heard of them is a support call the office cannot resolve |
| **Savings balance** | On publish | The app shows it; a stale figure is a supplier arguing with their passbook |
| **Delivery totals** per supplier per month | On publish is enough | Only totals. The app shows a monthly figure and this console shows a month history — **neither needs the individual weighings** |

**Send bills whole, not as deltas.** A bill is a read model the factory regenerates
whenever a delivery is voided or a rate is corrected ([../v1/modules.md](../v1/modules.md)
→ M5), so *"re-generating is the normal case"*. A delta protocol has to express a
recomputation, and the first one it gets wrong is a figure on a slip somebody is
holding.

**AC-03 is the acceptance test for this direction.** The bill in the factory's system,
the bill this console renders and the bill on the supplier's phone must agree **field
for field**. `packages/domain/src/bill.ts` is the shared derivation on this side; if
the factory's system computes its own, the integration must transfer the *result*
rather than the inputs, or two implementations will disagree on the first rounding
decision.

---

## 4. Direction 2 — platform → factory ⚠️ **the hard one**

Every one of these is a decision the office made in this console that **changes a bill
the factory's system has not generated yet**.

| Decision | What the factory's next bill must do | Deadline |
| --- | --- | --- |
| **Credit approved** (advance · loan · manure) | Deduct an instalment on `deductions.advance` / `loansAdvance` / `manure`, and carry the balance | Before the month's bill run |
| **Tea packets approved** | Add the value to `deductions.tea` | Before the bill run |
| **Savings rate changed** (M9) | Deduct at the new rate per kilo | Before the bill run |
| **Bank details changed** (M9) | Pay into the new account | Before the payout run |
| **Address changed** (M9) | Post the account to the new address | Before the slips are printed |
| **Payment method changed** (M9) | Move the supplier between the bank / cheque / cash runs | Before the payout run |

### The deadline problem

> **An approval that arrives after the bill run has been generated is invisible.**

The supplier was told *yes* in the app and their account does not show it. Nobody
finds out until they telephone — and by then the month is published and BR-108 locks
it, so the correction is next month's problem.

This is the single most important property of the integration, and it has to be
designed for rather than hoped about. Two mechanisms, and **both** are needed:

1. **Push each approval as it happens.** Not batched. The office approves twenty
   requests a day; twenty small calls are cheaper than one reconciliation.
2. **Let the factory's bill run ask.** Before generating, the factory's system calls
   the platform for *"every approval affecting this month that you have and I may not"*.
   This is the belt to the braces: a push that failed at 11pm is caught at 6am by the
   run itself rather than by a supplier.

Mechanism 2 is what makes the integration **self-healing**. Without it, one dropped
webhook is one supplier's money, silently.

### Idempotency

Every push carries a stable id — the change request's, the credit request's. The
factory's system must apply the same id twice with no extra effect. This console
already works this way for delivery batches (`Idempotency-Key`, api-contract §1.3),
and for the same reason: a retry after a timeout must not deduct an instalment twice.

---

## 5. The contested fields, and how to settle them

Bank details, payment method, savings rate and address exist in **both** systems, and
both systems have a screen that edits them. That is the real risk in this project.

**Settle it by making the platform the only writer**, and here is the argument:

- The supplier changes these **from the app**, and that is the point of the product.
- Every change is already an approval with a note, an actor and an audit entry (AC-02,
  AC-06, AC-09, BR-501's four eyes).
- If the factory's console also edits them, there are **two approval paths for one
  fact** and no way to say which was later — the classic last-write-wins bug, on a
  supplier's bank account.

So: the factory's system treats these as **read-only, replicated from the platform**,
and its own edit screens for them are disabled. That is a change on their side and it
is the one worth insisting on.

**If they will not**, the fallback is *the factory's system wins and the platform
mirrors it* — which means the app's change-request flow becomes advisory and AC-01
(*"the app and the record show the same active values at all times"*) can no longer be
guaranteed. That is a real product loss and should be a written decision rather than
something discovered in testing.

---

## 6. Three designs

| | How | Recommend |
| --- | --- | --- |
| **A. Shared database** | The platform's API reads the factory's tables directly | ❌ **No.** It couples the platform's uptime and its schema to a system nobody here controls. A column rename becomes an app outage |
| **B. Event push, both ways** | Each system calls the other's API when a fact changes, plus the reconciliation pull in §4 | ✅ **Yes** |
| **C. Scheduled file exchange** | CSV / SFTP, nightly | ❌ Not for direction 2. It cannot meet the bill-run deadline, and §4's failure is silent |

**B, with C as a migration step if their system genuinely cannot call out yet** — a
nightly pull covers direction 1 acceptably (bills change once a month), and direction 2
gets the reconciliation endpoint from §4 straight away. Direction 2 is the one that
cannot wait.

### The seam on this side

Nothing here changes for the console. For the API:

```
  factory system ──► POST /integration/bills            (direction 1)
                 ──► POST /integration/suppliers
                 ──► GET  /integration/pending-approvals?month=  ← the reconciliation pull

  platform       ──► (the factory's endpoint) on every approval  (direction 2)
```

Keep them **under their own path prefix and their own credential**. They are not
`/admin/*`: no console user is behind them, the audit actor is `system`
([api-contract.md](./api-contract.md) §8), and mixing them into the console's surface
means one of them ends up behind a role check that makes no sense for a machine.

---

## 7. What the office has to be told

**This is the one part that touches the console**, and it is worth doing whichever
design is chosen.

If a bill reaches this console by replication, then a figure on M5 or on a supplier's
month history is **as fresh as the last sync** — and a clerk reading it to a supplier
over the telephone has no way to know that. Today the screen says *"read-only"* and
implies *"and current"*.

So: whichever endpoint serves bills should carry **when the platform last heard from
the factory**, and the screens that render money should say so when it is not recent.
One line, in the same spirit as the *"showing bundled defaults"* notice the shell
already renders when `/config` fails ([white-label.md](./white-label.md)).

Not built, because it depends on a design decision that has not been made yet. It is
recorded in [status.md](./status.md) rather than assumed away — and it is small once
the shape is settled.

---

## 8. Checklist

**Before any code:**

- [ ] Decide §5 — who owns bank details, payment method, savings rate and address.
      Write it down. This is the decision that costs the most to change later
- [ ] Confirm the factory's system can call an outbound HTTP API. If not, §6's
      fallback applies and direction 2 still needs the pull endpoint
- [ ] Get the factory's bill schema, and check it field-for-field against
      `GreenLeafBill` in `packages/domain`. AC-03 is unachievable until these agree

**Direction 1:**

- [ ] `POST /integration/bills` — whole bills, idempotent on bill id
- [ ] `POST /integration/suppliers` — registry changes
- [ ] Month stage on every change
- [ ] A backfill path for the first load

**Direction 2:**

- [ ] Push on approval, idempotent on the request id
- [ ] `GET /integration/pending-approvals?month=` — **the reconciliation pull the bill
      run calls before generating.** Without this, one dropped call is one supplier's
      money and nobody is told
- [ ] The factory's system honours the approvals in the next run

**Both:**

- [ ] `system` audit entries on both sides for every replicated change (AC-09)
- [ ] An alert when a sync has not succeeded — silence must not look like agreement
- [ ] The freshness signal in §7
