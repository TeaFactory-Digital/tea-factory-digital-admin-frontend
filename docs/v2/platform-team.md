# What the platform team builds

| | |
| --- | --- |
| **Status** | Draft for review |
| **Audience** | The team building this console, the API behind it and the supplier app |
| **Read first** | [factory-integration-spec.md](./factory-integration-spec.md): the design and its constraints |
| **The endpoint being consumed** | [factory-system-team.md](./factory-system-team.md) |
| **Records kept in the console (sync off)** | [factory-records.md](./factory-records.md), with the work list in [BACKEND-TODO.md](./BACKEND-TODO.md) #45 |

**Two modes, one per factory** (Configuration → Factory system, `config.factorySync`):

| | Sync **on** (default) | Sync **off** |
| --- | --- | --- |
| Records come from | The hourly pull (§1), **not built yet: Phase 10** | The office, in the console (§4) |
| Credit requests | The console records the factory's decision (§2; not built yet) | The console decides them, four-eyes |
| Freshness (§3) | Shown | Not shown: there is nothing to fall behind |

> **Nothing in this document lands on the Factory System team.** It is written down so
> they can see that, and so the split of work is not re-argued at every meeting.

---

## 1. Consuming the endpoint (sync on, Phase 10)

- **Pull hourly, automatically**, 05:30–20:00 Colombo. **No human upload step**: a file
  somebody has to remember does not get uploaded on a Poya day
- **Upsert by id. Never insert blind.** The same date range may be re-fetched at any
  time, and nothing may double-apply
- **Follow `nextCursor` to the end of every window.** A window abandoned half way is a
  day of missing figures that nothing will report
- **Display balances and accounts as received.** Never recompute a figure the Factory
  System already calculated: two implementations disagree on the first rounding
- **Alert on a failed sync.** Silence must never look like agreement

> ⚠️ **If a collection falls back to a wholesale mode**
> ([factory-system-team.md §7](./factory-system-team.md#7-if-either-assumption-is-false)),
> the handling inverts: a wholesale payload must **delete rows it no longer sees**, a
> delta payload must never do that. Get it backwards and either voided weighings live for
> ever or a supplier's history disappears. The mode is agreed per collection at build
> time and written into that document.

---

## 2. Credit: compute the ceiling, never the decision

```
    available  =  ceiling(configured rule, leaf history)  −  outstanding
                  └─ this platform ──────────────────┘     └─ Factory System ─┘
                     one rule · one implementation            never our number
```

- **Compute the ceiling** from the factory's configured rule (M14 · *Credit rules*)
  through the shared `creditCeilingFromRule` in `packages/domain/src/leafCredit.ts`,
  **never a second implementation.** The same function is ported to the mobile repository,
  so the limit a supplier reads and the limit this console draws are one calculation
- **Subtract the Factory System's `outstanding*`.** Never the second term from our own
  records: a supplier who borrowed at the counter has a balance this platform has never
  seen
- **Record the factory's decision. Never make one.** Under the sync the request queues
  carry no `over-ceiling` and no `stale-eligibility`, and the button says the factory
  approved it. **Not built yet:** today's queues serve factories with the sync off, where
  the console does decide: `over-ceiling`, `stale-eligibility`, `loan-outstanding` (an
  open loan blocks a new loan and an advance) and four-eyes all apply
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
| A **"Figures out of date"** chip in the top bar | The last success is more than **3 hours** old (`FACTORY_SYNC_STALE_HOURS`) | Every screen, linking to the Data status page |
| A **"Never synced"** chip, in the error colour | The console has **never** synced | Every screen |
| A **"Sync status unknown"** chip | The status call itself failed | Every screen. The figures are real; the console only cannot say how current they are |

None of these shows while the factory keeps its records in the console (sync off).

Three decisions worth keeping:

- **The everyday line matters more than the warning.** A signal that only appears when
  something is wrong teaches the office that *no banner means live*, so on the day the
  banner is a few minutes late, a figure gets quoted as though it were.
- **"Never synced" is separated from "stale"**, because they need different people: one
  is a deployment that was not finished, the other is a job that has stopped running.
- **`coversUpTo` is the field the office actually uses.** *"Synced 12 minutes ago"* is
  not answerable to a supplier asking about last Tuesday; *"we have everything up to the
  7th"* is.

**Staleness is measured in polling hours, not wall-clock hours.** Without that, the first
clerk in at six every morning would meet a red "figures may be out of date" banner over a
perfectly healthy console (the last sync genuinely being ten hours old) and would have
learned to ignore it by the end of the first week. A day of polls actually missed still
raises it.

### What this asks of the Factory System

**Nothing.** The freshness is this platform's own record of its own pulls; it knows when
it last called the endpoint and what date range came back. No extra field, no extra
endpoint.

---

## 4. Records kept in the console (sync off) ✅ console built

For a factory whose system cannot be connected. The contract is
[factory-records.md](./factory-records.md); in short:

- **The switch.** `config.factorySync.enabled`, read only through `isFactorySyncEnabled`.
  While it is on, every record write answers `409 factory-sync-on`. Switching is refused
  while a month has generated but unpublished bills (`409 sync-switch-blocked`).
- **Screens that appear only with the sync off:** Add supplier, opening balances and the
  supplier's own transport rate (supplier → Money), the sidebar section **Factory
  records** (**Leaf intake**, `/deliveries`; **Rates & month close**, `/rates`), Other
  deductions on a calculated bill, and **Record walk-in request** on the credit queue.
- **Imports.** Every record one at a time or from an Excel/CSV file
  (`POST /admin/imports/:kind`), **all rows or none**: one bad row refuses the file and
  lists every problem. The console checks each row with the same domain function the
  server runs (`importRowProblems`).
- **Bills, one way per factory** (`billSettings.source`): **imported** from the factory's
  own system, stored exactly as printed (Galaboda), or **calculated** here by
  `computeBillAmounts`. Then reviewed and published, four-eyes.
- **Not on the backend yet.** Features the API has not built are hidden in one place,
  `apps/admin/src/lib/serverReady.ts`; remove a line the day its endpoint ships
  (BACKEND-TODO #45 lists them).

## 5. Other console pieces the office relies on

- **The notification bell** (top right): what is waiting (the queues) and recent supplier
  activity (`GET /admin/activity`, read mark per user with `POST /admin/activity/read`).
  A kind is hidden while its feature flag is off (`ACTIVITY_FLAG`).
- **Every refusal explained.** Each error code in `ADMIN_ERROR_CODES`, and each import
  problem code, has its own sentence in English, Sinhala and Tamil; an import problem the
  console does not know still shows, as "refused (code)".

---

## 6. What this platform owns outright

Not a copy of anything, and nothing the Factory System knows about:

- Mobile app accounts, passwords, devices
- App content: news, banners, FAQ, terms
- Push notifications
- Which features the app shows
- The lending **rule** configuration (M14 · *Credit rules*)

---

## 7. Checklist

Sync on (Phase 10):

- [ ] Hourly pull during office hours only, 05:30–20:00 Colombo; upsert by id
- [ ] Follow `nextCursor` to the end of every window
- [ ] Handle wholesale-mode collections as replaces, not merges, where any apply
- [ ] Never re-derive an account figure the Factory System has already calculated
- [ ] Request screens **record** the factory's decision rather than making one
- [ ] Alert on a failed sync
- [ ] Switching a factory from records kept here to the sync: the sync's records replace
      ours for the same supplier, day or month (factory-records.md §2)

Both modes:

- [x] Ceiling from the configured rule through the shared `creditCeilingFromRule`,
      never a second implementation, and never a figure presented as a decision
- [x] Freshness indicator ([§3](#3-telling-the-office-how-fresh-the-data-is--built))
- [x] The console for records kept here (§4); the backend's half is BACKEND-TODO #45

---

## 8. Rules that must hold on both sides

| Rule | Why |
| --- | --- |
| **`null` ≠ `0`** | "Earned nothing" and "not settled yet" are different sentences |
| **Money: numbers, 2 decimals** | A figure that arrives as a string is parsed differently on each side |
| **Truncate, never round up** | The supplier did not agree to a rounded-up rupee |
| **Dates are Colombo local** | A weighing at 8pm on the 31st belongs to that month |
| **The same range may be re-fetched safely** | Every sync can be retried. Nothing may double-apply |
| **A void is sent, not omitted** | An absent row and a withdrawn row are different facts |
| **A failed sync is loud** | Silence must never look like agreement |
