# What the platform team builds

| | |
| --- | --- |
| **Status** | Draft for review |
| **Audience** | The team building this console, the API behind it and the supplier app |
| **Read first** | [factory-integration-spec.md](./factory-integration-spec.md) — the design and its constraints |
| **The endpoint being consumed** | [factory-system-team.md](./factory-system-team.md) |

> **Nothing in this document lands on the Factory System team.** It is written down so
> they can see that, and so the split of work is not re-argued at every meeting.

---

## 1. Consuming the endpoint

- **Pull hourly, automatically**, 05:30–20:00 Colombo. **No human upload step** — a file
  somebody has to remember does not get uploaded on a Poya day
- **Upsert by id. Never insert blind.** The same date range may be re-fetched at any
  time, and nothing may double-apply
- **Follow `nextCursor` to the end of every window.** A window abandoned half way is a
  day of missing figures that nothing will report
- **Display balances and accounts as received.** Never recompute a figure the Factory
  System already calculated — two implementations disagree on the first rounding
- **Alert on a failed sync.** Silence must never look like agreement

> ⚠️ **If a collection falls back to a wholesale mode**
> ([factory-system-team.md §7](./factory-system-team.md#7-if-either-assumption-is-false)),
> the handling inverts: a wholesale payload must **delete rows it no longer sees**, a
> delta payload must never do that. Get it backwards and either voided weighings live for
> ever or a supplier's history disappears. The mode is agreed per collection at build
> time and written into that document.

---

## 2. Credit — compute the ceiling, never the decision

```
    available  =  ceiling(configured rule, leaf history)  −  outstanding
                  └─ this platform ──────────────────┘     └─ Factory System ─┘
                     one rule · one implementation            never our number
```

- **Compute the ceiling** from the factory's configured rule (M14 · *Credit rules*)
  through the shared `creditCeilingFromRule` in `packages/domain/src/leafCredit.ts` —
  **never a second implementation.** The same function is ported to the mobile repository,
  so the limit a supplier reads and the limit this console draws are one calculation
- **Subtract the Factory System's `outstanding*`.** Never the second term from our own
  records — a supplier who borrowed at the counter has a balance this platform has never
  seen
- **Record the factory's decision. Never make one.** Under this integration the request
  queues carry no `over-ceiling` and no `stale-eligibility`, and the button reads
  *"Approved by the factory"* rather than *"Approve"*. See [integration.md](./integration.md)
- **Never re-derive an account figure** the Factory System has already calculated

> The ceiling's job is to tell the supplier **what to ask for**, never to gate **what the
> office may approve.**

---

## 3. Telling the office how fresh the data is ✅ built

Accounts and balances in this console are **as fresh as the last successful sync**.
A clerk reading a balance to a supplier on the telephone has no way to know that.

The console says so, in two places and for two different reasons:

| | When | Where |
| --- | --- | --- |
| *"Read from the factory's system at 09:12, covering up to 7 August"* | Always, while the sync is healthy | Under the bills grid and the supplier's month history |
| A warning across the whole shell | The last success is more than **3 hours** old | Every screen |
| An error across the whole shell | The console has **never** synced | Every screen |

Three decisions worth keeping:

- **The everyday line matters more than the warning.** A signal that only appears when
  something is wrong teaches the office that *no banner means live* — so on the day the
  banner is a few minutes late, a figure gets quoted as though it were.
- **"Never synced" is separated from "stale"**, because they need different people: one
  is a deployment that was not finished, the other is a job that has stopped running.
- **`coversUpTo` is the field the office actually uses.** *"Synced 12 minutes ago"* is
  not answerable to a supplier asking about last Tuesday; *"we have everything up to the
  7th"* is.

**Staleness is measured in polling hours, not wall-clock hours.** Without that, the first
clerk in at six every morning would meet a red "figures may be out of date" banner over a
perfectly healthy console — the last sync genuinely being ten hours old — and would have
learned to ignore it by the end of the first week. A day of polls actually missed still
raises it.

### What this asks of the Factory System

**Nothing.** The freshness is this platform's own record of its own pulls — it knows when
it last called the endpoint and what date range came back. No extra field, no extra
endpoint.

---

## 4. What this platform owns outright

Not a copy of anything, and nothing the Factory System knows about:

- Mobile app accounts, passwords, devices
- App content — news, banners, FAQ, terms
- Push notifications
- Which features the app shows
- The lending **rule** configuration (M14 · *Credit rules*)

---

## 5. Checklist

- [ ] Hourly pull during office hours only, 05:30–20:00 Colombo; upsert by id
- [ ] Follow `nextCursor` to the end of every window
- [ ] Handle wholesale-mode collections as replaces, not merges, where any apply
- [ ] Ceiling from the configured rule through the shared `creditCeilingFromRule` —
      never a second implementation, and never a figure presented as a decision
- [ ] Never re-derive an account figure the Factory System has already calculated
- [ ] Request screens **record** the factory's decision rather than making one
- [ ] Freshness indicator ([§3](#3-telling-the-office-how-fresh-the-data-is--built)) ✅ built
- [ ] Alert on a failed sync

---

## 6. Rules that must hold on both sides

| Rule | Why |
| --- | --- |
| **`null` ≠ `0`** | "Earned nothing" and "not settled yet" are different sentences |
| **Money: numbers, 2 decimals** | A figure that arrives as a string is parsed differently on each side |
| **Truncate, never round up** | The supplier did not agree to a rounded-up rupee |
| **Dates are Colombo local** | A weighing at 8pm on the 31st belongs to that month |
| **The same range may be re-fetched safely** | Every sync can be retried. Nothing may double-apply |
| **A void is sent, not omitted** | An absent row and a withdrawn row are different facts |
| **A failed sync is loud** | Silence must never look like agreement |
