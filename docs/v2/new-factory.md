# Adding and running a factory

**For:** the platform team, the developers, the factory's own administrator, and the
factory's owner and management (§7 and §8 need no developer to read them).
**In short:** one API and one console serve every factory, so a new factory is **data and
configuration, not code**. Each factory is a *tenant* identified by a short **slug** (for
example `hillside`). Only the supplier app is built separately per factory, because each
factory publishes its own app with its own name and icon.

| Part | Shared or per factory | Who |
|---|---|---|
| API (`tea-factory-digital-backend`) | Shared; one database, rows keyed on the factory | Platform team |
| Admin console (`tea-factory-digital-admin-frontend`) | Shared bundle; the subdomain picks the factory | Platform team, then the factory administrator |
| Supplier app (`tea-factory-digital-mobile-frontend`) | **One build per factory** | Mobile developer |

## Who does what

| Who | Does | Where |
|---|---|---|
| **The factory's owner and management** | The decisions only the factory can make: who instructs its system's vendor, who owns the lending rule, who imports and who publishes the bills | §7; what is already decided is §8.2 |
| **The platform team** | Creates the factory, its DNS and hosting; builds and runs the console and the API, including the sync | §1, §2, §9 |
| **The factory administrator** | Configures the factory in the console, adds the office's users; reads the factory's records but changes none | §3, §8.1 |
| **The clerk and the manager** | Keep the factory's records while the sync is off, and work the queues | §4, §8.1 |
| **The mobile developer** | One supplier-app build for this factory | §5 |
| **The factory's system vendor** (sync on only) | One read-only endpoint, and nothing else | [factory-system-team.md](./factory-system-team.md) |
| **The backend developer** | What the API still has to build for the records kept in the console | [BACKEND-TODO.md](./BACKEND-TODO.md), [factory-records.md](./factory-records.md) |

## 0. Decide first

- [ ] **Slug:** lower-case letters and digits, e.g. `hillside`. It becomes the console
      subdomain and the app's `X-Tenant`, and it **never changes**.
- [ ] **The factory's real details:** registered name, telephone, reg. no. (as on the
      bill), location, support email and hours. These print on every bill; never use
      placeholders.
- [ ] **Collection points** (code and name), e.g. `HATTON:Hatton`.
- [ ] **Factory system sync: on or off.** On: the factory's own system feeds the platform
      every hour. Off (how every factory starts): the office keeps suppliers, leaf, rates
      and bills in the console ([factory-records.md](./factory-records.md)).
- [ ] **The first administrator:** name and email.
- [ ] **The factory's own decisions** (§7): with the sync on, who instructs the vendor;
      with it off, who types approvals into the factory's system, who imports the bills
      and who publishes them.

## 1. Backend: create the factory (platform team)

- [ ] Run the onboarding command in `tea-factory-digital-backend` with the details above:

      ```bash
      npm run db:seed:tenant -- \
        --slug hillside --name "Hillside Tea Factory" \
        --telephone 051-2223344 --reg-no "M.F. 2207" --location Hatton \
        --admin-name "S. Jayawardena" --admin-email admin@hillsidetea.lk \
        --points "HATTON:Hatton,DIKOYA:Dikoya" --sync off
      ```

      It names the database it is about to write to and waits for you to type the slug
      back (`--yes --expect-host <host>` in a script), and prints the administrator's
      password only to a terminal or to `--password-out <file>`. It creates the factory,
      its configuration with every feature flag written, the bank list, the collection
      points, the first `factoryAdmin` account, and the default static
      pages and notification triggers in Sinhala, Tamil and English with the factory's name.
- [ ] Hand the administrator their one-time password in person. They change it at first
      sign-in.
- [ ] Add the console's address to `CORS_ORIGINS` on the API and redeploy.

## 2. DNS and hosting (platform team)

- [ ] Point `<slug>.admin.<domain>` at the console deployment. The console reads the
      factory from the subdomain, so nothing is rebuilt.
- [ ] The API answers every factory at one host; the app and the console say which factory
      with the `X-Tenant` header (or the subdomain).

## 3. Console: brand and configure

**Optional, developer:** a bundled brand in `packages/brand/src/clients/index.ts` (logo and
colours). Without one the console starts on the neutral base brand and repaints in the
factory's colours as soon as `GET /config` answers.

**The factory administrator**, signed in at `<slug>.admin.<domain>`, under
**Configuration**:

- [ ] **The factory:** details as they appear on the bill.
- [ ] **Features:** switch off what the factory does not offer (loans, manure, tea packets,
      news...). A switched-off feature disappears from the app and the console together.
- [ ] **Factory system:** sync on or off (see step 0).
- [ ] **Collection & savings:** collection points, savings rates, withdrawal month,
      fertilizer catalogue with bag sizes and prices.
- [ ] **Banks & branches:** check the list the app offers suppliers.
- [ ] **Languages & branding:** logo, colours, languages.
- [ ] **Notifications:** which categories may be sent.
- [ ] **Tea packets:** packet size, price and monthly limit. Until set, the app does not let
      suppliers ask for packets.
- [ ] **Credit rules:** how each ceiling is worked out (basis, multiplier, months, cap).
      Name who owns this screen (§7.3).
- [ ] **Bill calculation** (sync off): where the bills come from (**imported** from the
      factory's own system, or **calculated** here); for calculated bills, pay in Rs. 1, 5
      or 10 and the next bill number after the factory's last paper bill; advance and loan
      interest per month (loan 0% unless set) and whether the loan interest is taken on
      top of the instalment or inside it.
- [ ] **Common notes:** the office's ready-made sentences.
- [ ] **Static content:** read the default terms, privacy, FAQ, savings scheme, credit terms
      and about pages in all three languages, and edit them for this factory.
- [ ] **Users & roles:** add the clerks, managers (at least **two**, so one can approve what
      the other proposes) and the content editor (§8.1).

## 4. The factory's records

**Sync on:**
- [ ] The factory's system vendor builds the read-only endpoint in
      [factory-system-team.md](./factory-system-team.md), checked against
      [factory-updates-sample.json](./factory-updates-sample.json).
- [ ] The first full pull is checked against one month of the factory's paper bills.

**Sync off** (some of these wait for the backend; the console hides each until it ships,
see [status.md](./status.md#hidden-in-the-console-until-the-backend-ships-it)):
- [ ] Import the suppliers, then their opening balances, from Excel/CSV
      (**Suppliers → Import**; each screen offers a template). Settle or cancel any savings
      withdrawal still pending before the cut-over month, then enter the opening savings.
- [ ] Enter or import the month's leaf (**Factory records → Leaf intake**), the rate, and the
      deduction rates (transport per collection point, stamps, caps).
- [ ] **Bills imported** (the factory's own system prints them, as at Galaboda): once the
      month has ended, import its finished bills (**Rates & month close → Import → Finished
      bills**; with no months yet the screen offers the Import menu, and the import creates
      the month), check a few against the printed slips, then a manager **other than the
      importer** publishes.
- [ ] **Bills calculated here:** generate one month's bills, enter or import each printed
      slip's Balance (**Rates & month close → Compare with printed slips**), fix or hold
      every bill that differs, then publish.

## 5. Supplier app: one build for this factory (mobile developer)

Follow "Add a new client" in the app repo's `docs/white-label.md`. In short:

- [ ] `src/config/clients/<slug>/index.ts`, copied from `default`: identity, colours,
      `api.headers['X-Tenant'] = '<slug>'`, and **its own `push.topicPrefix`** (sharing
      another factory's would let that factory's notifications reach these suppliers).
- [ ] Register it: `ClientId` in `src/config/types.ts`, `clients` in
      `src/config/clients/index.ts`, `VALID_CLIENTS` in `src/config/env.ts`.
- [ ] `.env.<slug>` with `APP_CLIENT=<slug>` and the production `API_BASE_URL`; build with
      `ENVFILE=.env.<slug>` (read on Android through `dotenv.gradle`, on iOS by the pod).
- [ ] Android product flavour and iOS scheme: package name, app name, icon, splash colour
      (the splash colour must equal the factory's primary colour).
- [ ] A Firebase project (or app) for push, and the store listings.

## 6. Before suppliers get the app

- [ ] Sign in to the console as each role and open the screens that role uses.
- [ ] Sign in to the app as one real supplier: the bill, savings and requests show this
      factory's figures, and nothing from another factory.
- [ ] Send one request from the app; it appears in the console queue, is decided, and the
      phone is notified.
- [ ] Publish a news article; it reaches the phone in the supplier's language.

---

## 7. What only the factory can decide

**For the factory's owner and management.** Nothing in this section needs a developer to
read it; it is the handful of decisions that are the factory's, not the developers'.

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

The design behind the sync is in
[factory-system-team.md](./factory-system-team.md#a-why-the-design-is-this-shape).
This section covers only what management has to decide; what it has already decided is
§8.2.

### 7.1 Who instructs the existing vendor

> **Somebody who does not work for us has to do one small piece of work, and only the
> factory can ask them to do it.**

The app needs to read the factory's own data: weighings, rates, accounts, balances. That
data lives in the **existing Factory System**, maintained by whoever built it. That team
is being asked for **one read-only endpoint**: a way for the app's platform to read the
figures. No change to how the system works, nothing rewritten, nothing removed.

It is a small piece of work. **It is also the piece that nothing on the sync can proceed
without**, and the platform team has no relationship with the people who must do it.

**Three ways this stalls, none of them technical:**

| What happens | Why |
| --- | --- |
| **The existing vendor sees a competitor** | A new system touching their data reads as the first step to replacing them. A vendor who feels that rarely says so; the work simply takes a long time |
| **Nobody is named, so nobody acts** | *"We sent them the specification"* is not an instruction. It sits in an inbox belonging to no one |
| **It is agreed verbally** | No scope, no price, no date. It holds until the first invoice or the first busy week, and then it does not |

**A specification cannot create an obligation.** This one is written to be as small and as
unthreatening as the work honestly is: one read-only endpoint, no logic change, and a
section that names the three things it deliberately does *not* ask for. That is as far as
a document can go. The rest is a commercial relationship the factory owns.

**What to settle before any building starts:**

- [ ] **Who at the factory instructs the existing vendor?** A **name**, not a department.
      This person receives the vendor's questions and answers them
- [ ] **Is this work inside the existing maintenance contract, or is it a quoted
      change?** Ask the vendor to say which, in writing, before the first build meeting
- [ ] **If it is quoted, what is the price and who approves it?** A modest quote
      approved slowly costs the project more than a large one approved quickly
- [ ] **What is the agreed delivery date**, and what does the factory do if it passes?
- [ ] **Who at the vendor is doing it?** One named engineer. "The team will look at it"
      is the answer that produces nothing

**If the vendor declines, or cannot deliver**, say so early rather than waiting. There is
a fallback and it asks the vendor for *less*, not more:

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

### 7.2 The one new thing the office is asked to do

Today a supplier walks in and asks; the clerk keys it into the Factory System; the
Factory System decides; the clerk tells the supplier.

With the app (sync on), everything is the same **except the last step**: instead of
telling the supplier across the counter, the clerk marks the request **Handled** in the new
console and records what the factory decided. **It is one click**, and it exists so the
supplier's phone can tell them, which is the point of the whole project.

- [ ] **Confirm the office agrees to that step**, and that it is somebody's named job.
      Every other part of the office's day is unchanged

**With the sync off** (Galaboda's arrangement) the office's work is different, and two
jobs need a named owner:

- [ ] **Who types each approval made in the new console into the factory's own system**
      before the bills are printed. An imported bill file that lacks an approved advance,
      loan, manure or tea packet is refused, naming the supplier
- [ ] **Who imports the month's finished bills, and who publishes them.** Two different
      people: the one who imports cannot publish (four-eyes). A clerk may import; a
      manager publishes, including the bills of a division file that arrives late

### 7.3 Who owns the lending rule

The app shows a supplier **how much they may ask for** before they ask. That figure comes
from a rule the factory configures in the new console: a basis, a multiplier, a cap, and
how much history a supplier needs.

**The office still decides each actual request.** The app's figure is a guide, not a
promise. But if the configured rule says one thing and the counter does another, the app
is promising money the factory will not lend.

- [ ] **Name the factory administrator who owns that screen**, and confirm the configured
      rule matches what the counter actually approves

### 7.4 Who is called when it breaks

With the sync on, the app's figures are copies, refreshed from the Factory System through
the day. If that refresh stops, the console says so on every screen (§9.3), but somebody
has to act on it. (With the sync off there is no refresh to stop.)

- [ ] **Name who is called when the sync fails**, at the factory and at the vendor

### 7.5 What management is *not* being asked to decide

Worth stating, because it is the usual worry:

| | |
| --- | --- |
| **Any change to how the factory calculates anything** | Not asked for. Rates, accounts, deductions, payouts and approvals stay exactly as they are |
| **Replacing the existing Factory System** | Not proposed, now or later |
| **Who may approve credit** | Unchanged. The office decides: with the sync on, in the system it decides in today; with it off, in the new console, where the person who records a request cannot approve it |
| **New work for the collection points** | None. Weighing is unchanged |

### 7.6 The short version

| Decision | Owner | Blocking? |
| --- | --- | --- |
| Who instructs the existing vendor, and on what commercial terms | **Management** | ✅ **Yes, for the sync; nothing on it starts without it** |
| What happens if the vendor declines (a database login, or the sync off) | **Management** | ✅ Yes |
| The office's **Handled** step (sync on) | Management + office | ✅ Yes |
| Who types approvals into the factory's system, who imports the bills and who publishes them (sync off) | Management + office | Before the first month is imported |
| Who owns the lending rule screen | Management | Before the app shows a limit |
| Who is called when the sync fails (sync on) | Management | Before go-live |

The decisions in §8.2 are taken and are not repeated here.

---

## 8. Running the factory

### 8.1 Who does what in the console

Five roles ([rbac.md](./rbac.md) has the whole matrix). With the sync off, the default
grants split the record keeping like this:

| Role | Does | Grants that matter here |
| --- | --- | --- |
| **Clerk** | Adds suppliers, enters leaf, records walk-in credit requests, imports or generates bills, types other deductions | `suppliers`, `deliveries`, `creditRequests`, `billing`: write |
| **Manager** | Enters the month's rate; decides what a clerk recorded (credit requests; deduction rates proposed by another person); publishes a month, including a late division file's bills, and releases a held bill; pays back savings | `ratesAndMonthClose`, `creditRequests`, `billing`: approve (a savings withdrawal needs `billing`: approve) |
| **Factory administrator** | Configuration, users, content; **reads** the factory's records (leaf, rates, bills) and changes none | `deliveries`, `ratesAndMonthClose`, `billing`: read; no credit capability |
| **Platform administrator** | Reads a factory's records to answer a support question, never changes them; creates factories | `deliveries`, `ratesAndMonthClose`, `billing`: read; `tenants`: write |
| **Editor** | News, banners, static pages | `content`: write |

Nobody approves or publishes what they recorded or imported (four-eyes), so the factory
needs at least two managers. With the sync on, the records come from the factory's system
and the API refuses every record write (`409 factory-sync-on`).

### 8.2 Already decided by the factory

Decided by the factory between 9 and 26 October 2026 (the detail is in
[factory-records.md §8](./factory-records.md#8-decided-by-the-factory)). Nothing here is
open; where the console or the API has not caught up, the row says so.

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
| 13 | **Importing a file again skips what is already there**; a supplier already in the console is left as they are. Built in the console; not on the API yet (`IMPORT_SKIP_ON_SERVER`) |
| 14 | **Galaboda's slip** carries only what was approved by the month's last day; a blank balance is 0 |
| 15 | **Imported months**: a division file that arrives after the month is published waits for a manager to publish its bills, and **whoever imported a month's bills cannot publish them**. Both are built (backend `671627d`). While late bills wait, the next month cannot be published, and a waiting bill may be replaced by sending it again (R18, built `76b50f2`) |
| 16 | **The sync starts off.** A factory keeps its records in the new console until its own system is connected and the sync is switched on deliberately |
| 17 | **The factory administrator can see the factory's records** (leaf, rates, bills) but not change them; entering, approving and publishing stay with the clerk and the manager |
| 18 | **A full bank account number may be revealed by anyone who can open the supplier's record** (clerk, manager, both administrators), as built: each reveal asks for a reason and is audited (api-contract.md §5.4). Kept as it is (26 October 2026) |

---

## 9. The platform team's side of each mode

**Nothing in this section lands on the Factory System team.** It is written down so they
can see that, and so the split of work is not re-argued at every meeting. The design it
implements is [factory-system-team.md §A to §F](./factory-system-team.md#a-why-the-design-is-this-shape);
the endpoint being consumed is the same document's §1 to §7; the records kept in the
console are [factory-records.md](./factory-records.md), with the work list in
[BACKEND-TODO.md](./BACKEND-TODO.md) #45.

**Two modes, one per factory** (Configuration → Factory system, `config.factorySync`):

| | Sync **on** | Sync **off** (default) |
| --- | --- | --- |
| Records come from | The hourly pull (§9.1), **not built yet: Phase 10** | The office, in the console (§9.4) |
| Credit requests | The console records the factory's decision (§9.2; not built yet) | The console decides them, four-eyes |
| Freshness (§9.3) | Shown | Not shown: there is nothing to fall behind |

The rules both sides keep (`null` is not `0`, money as numbers to 2 decimals, truncate
never round up, Colombo dates, safe re-fetch, a void sent not omitted, a failed sync is
loud) are [factory-system-team.md §8](./factory-system-team.md#8-rules-that-must-hold-on-both-sides).
What this platform owns outright, and the Factory System knows nothing about (app
accounts, content, push, which features the app shows, the lending rule), is
[factory-system-team.md §A.2](./factory-system-team.md#a2-what-each-side-does).

### 9.1 Consuming the endpoint (sync on, Phase 10)

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

### 9.2 Credit: compute the ceiling, never the decision

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
> office may approve.** Why, and the one obligation it leaves on the factory, is
> [factory-system-team.md §C](./factory-system-team.md#c-who-decides-credit-and-what-each-side-calculates).

### 9.3 Telling the office how fresh the data is (built)

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

**What this asks of the Factory System: nothing.** The freshness is this platform's own
record of its own pulls; it knows when it last called the endpoint and what date range
came back. No extra field, no extra endpoint. The status rides on `GET /admin/dashboard`
as `sync` ([api-contract.md §4](./api-contract.md#the-other-blocks)).

### 9.4 Records kept in the console (sync off; console built)

For every factory until its own system is connected and the sync is switched on
deliberately: that is the default. The contract is
[factory-records.md](./factory-records.md); in short:

- **The switch.** `config.factorySync.enabled`, read only through `isFactorySyncEnabled`
  (`enabled === true`; absent or `null` is off, and a new factory is stored as
  `{ enabled: false }`). While it is on, every record write answers `409 factory-sync-on`.
  Switching is refused while a month has generated but unpublished bills
  (`409 sync-switch-blocked`).
- **Who does what** (§8.1). The clerk enters leaf, records walk-in requests and imports or
  generates bills (`deliveries`, `creditRequests`, `billing: W`); the manager approves and
  publishes; the factory and platform administrators **read** the records
  (`deliveries`, `ratesAndMonthClose`, `billing: R`) and change none. A savings withdrawal
  needs `billing: approve`.
- **Screens that appear only with the sync off:** Add supplier, opening balances and the
  supplier's own transport rate (supplier → Money), the sidebar section **Factory
  records** (**Leaf intake**, `/deliveries`; **Rates & month close**, `/rates`), Other
  deductions on a calculated bill, and **Record walk-in request** on the credit queue.
- **Imports.** Every record one at a time or from an Excel/CSV file
  (`POST /admin/imports/:kind`), **all rows or none**: one bad row refuses the file and
  lists every problem. The console checks each row with the same domain function the
  server runs (`importRowProblems`).
- **Bills, one way per factory** (`billSettings.source`): **imported** from the factory's
  own system, stored exactly as printed (Galaboda; live on the backend since `12eea12`,
  the import creating the month), or **calculated** here by `computeBillAmounts` and
  compared with the factory's printed slips, a bill that differs being held and later
  released in order. Then reviewed and published, four-eyes, which also covers whoever
  imported the month's bills; a late division file's bills wait for a manager (built
  `671627d`; a waiting one is replaced by sending it again, `76b50f2`). Payment in units
  of Rs. 1, 5 or 10 (`paymentUnit`, plus `loanInterest.recovery` for how loan interest is
  taken); bill numbers are the year of the bill's month and a serial that never resets
  (`factoryBillNumber`).
- **Not on the backend yet.** Features the API has not built are hidden in one place,
  `apps/admin/src/lib/serverReady.ts`; remove a line the day its endpoint ships
  (BACKEND-TODO #45 and #48 list them; [status.md](./status.md#hidden-in-the-console-until-the-backend-ships-it)
  has the table).

### 9.5 Other console pieces the office relies on

- **The notification bell** (top right): what is waiting (the queues) and recent supplier
  activity (`GET /admin/activity`, read mark per user with `POST /admin/activity/read`).
  A kind is hidden while its feature flag is off (`ACTIVITY_FLAG`).
- **Every refusal explained.** Each error code in `ADMIN_ERROR_CODES`, and each import
  problem code, has its own sentence in English, Sinhala and Tamil; an import problem the
  console does not know still shows, as "refused (code)".

### 9.6 Checklist

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
- [x] Freshness indicator ([§9.3](#93-telling-the-office-how-fresh-the-data-is-built))
- [x] The console for records kept here (§9.4); the backend's half is BACKEND-TODO #45
