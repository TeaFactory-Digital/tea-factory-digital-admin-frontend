# Modules

The v2 module map: what this console contains, what each module decides, and what
left. Scope and rationale for the original seventeen are in the mobile repo's
`docs/admin-console.md`; the v1 state against them is in [../v1/modules.md](../v1/modules.md),
which is kept unchanged.

`NAVIGATION` in `apps/admin/src/layout/navigation.ts` is the machine-readable
version of this table — it carries each module's capability and feature flag, and
the sidebar is generated from it. The v1 rows are commented out in that file rather
than deleted, with the reason on each.

---

## Status

| # | Module | Status | Route |
| --- | --- | --- | --- |
| M1 | **Dashboard** | ✅ Rebuilt around app adoption and content health | `/` |
| M2 | **Suppliers** | ✅ Narrowed to the app account | `/suppliers`, `/suppliers/:id` |
| M5 | **Bills** | ✅ **Read-only** support view | `/bills`, `/bills/:id` |
| M7 | **Credit queues** | ✅ Built | `/credit`, `/credit/:id` |
| M9 | **Change requests** | ✅ Built | `/change-requests`, `/change-requests/:id` |
| M10 | **Inquiries** | ✅ Built | `/inquiries`, `/inquiries/:id` |
| M11 | **News (CMS)** | ✅ Built | `/news`, `/news/:id` |
| M11 | **Promo banners** | 🆕 **New in v2** | `/banners`, `/banners/:id` |
| M12 | **Static content** | ✅ Built | `/content` |
| M13 | **Notifications** | ✅ Built | `/notifications` |
| M14 | **Configuration** | ✅ Built, **7 sections**, fourteen flags | `/configuration` |
| M15 | **Users & roles** | ✅ Built | `/users` |
| M16 | **Reports** | ✅ Narrowed to `channelShift` | `/reports` |
| M17 | **Audit log** | ✅ Built (no export) | `/audit` |
| **M18** | **Tea packets** | 🆕 **New in v2** | `/tea-packets` |

---

## What moved to the factory's own console

| # | Module | Route (v1) | Why it left |
| --- | --- | --- | --- |
| M3 | Leaf collection | `/deliveries` | The weighing point is the factory's system of record, and it has one |
| M4 | Rates & month close | `/rates` | The auction result and the publish are the accountant's, in the console that holds the ledger |
| M6 | Payouts | `/payouts` | Money leaving the factory, reconciled against the factory's own bank statements |
| M8 | Savings | `/savings` | A view over published bills, which this console no longer produces |

**Their screens are still in the tree.** The routes, the sidebar rows and the lazy
imports are commented out in `router.tsx` and `navigation.ts`; the MSW handlers
still answer; the fixtures still seed. What is gone is the claim that *this* console
is where the work happens.

Three reasons the code stayed, in order of weight:

- **The handlers are a specification.** [mocks.md](./mocks.md) calls them *"the
  specification the server has to satisfy, not a stand-in for one"*. M4's five
  ordered publish refusals and M6's `payoutExport.ts` serialiser are the only
  written statement of what those flows require, and the factory's own console has
  to satisfy the same rules or the app will disagree with it.
- **The scope decision may be revisited.** A commented card is a smaller change to
  reverse than a deleted module.
- **A deletion loses the argument.** The comments say why each module left, and
  that is the part a reader cannot reconstruct from the diff.

**Nothing was left behind a capability nobody holds, and nothing renders a "moved"
notice.** This console has no way to know where the factory's own console lives,
and a screen that guessed would be a broken link somebody maintains. A v1 URL
inside the shell goes home, via the `*` route.

---

## Why this slice

The v1 document argued its milestone order and that argument is kept in
[../v1/modules.md](../v1/modules.md). v2's slice is not a milestone — it is a
boundary — so it is argued differently: **by what breaks on a phone if it is
missing.** Every module above answers that question, and the four that left do not.

Three consequences worth naming:

- **The queues did not change and should not have.** M7, M9 and M10 were already
  the app's open loops. What changed is that they are now the *point* of the
  console rather than three of seventeen modules.
- **The gaps this exposed were app-facing ones.** Narrowing to the app is what
  surfaced tea packets, the missing banner editor and the four flags — none of
  which a seventeen-module console noticed, because they were small next to a month
  close.
- **M5 survived by a different argument from the rest**, and it is the only one:
  reading a bill is app support, producing one is not. See below.

---

## M1 Dashboard

*The app at a glance.* One request — `GET /admin/dashboard`.

**v1 led with today's kilos and the month-cycle stage.** That is the right first
screen for a console that runs the factory, and the wrong one for a console that
manages an app — the office has a weighing system for kilos.

| Area | What it shows |
| --- | --- |
| **Queue cards** | Unchanged. Pending count per queue, the age of the **oldest** item, and a count past the §14.4 target. A queue of three sitting four days is worse than twenty from this morning |
| **App adoption** | Suppliers signed in against the total, devices registered, and this month's app-request share. §19.3 calls app adoption and channel shift *"the two KPIs that justify the project"*, and nothing else in the factory can answer it |
| **Content** | Banners live now, plus what is quietly wrong: published articles falling back, banners whose window has closed, fixed pages nobody has written |
| **Alerts** | Server-composed, as an i18n key + params. Unchanged |
| **Adoption trend** | Twelve months of app-request share, oldest first |

**Every figure on the content card is a silent failure.** A supplier reading a
Sinhala article in English, an FAQ page that is still the bundled default, a banner
published a fortnight ago whose window closed on Tuesday — none of them produce an
error anywhere, and only a screen that goes looking will find them. That is AC-08's
argument about editor-visible gaps, one level up.

**The trend is monthly, not daily.** Adoption moves when the office hands out
passwords at the counter, which is a campaign rather than a day's weather. A month
with no requests carries `null` and **breaks the line** rather than dropping it to
zero — a month with no requests has no adoption share, and a zero would report a
collapse that did not happen (BR-102, as a chart).

The **shell** owns this query, not the screen, because the sidebar's queue badges
need the same numbers. A queue whose feature flag is off is **absent**, not zero.

`cycle`, `today` and `intakeTrend` are still on the payload and the cards that read
them are commented out on the screen. The month-cycle card is the one most likely to
be wanted back: `awaitingRate` is *why the app is showing a supplier blanks instead
of amounts*, and that is a telephone call the office takes either way.

## M2 Suppliers

*The app account, and everything support needs to answer a telephone call.* The
registry — register, suspend, close, edit the estate address — is the factory's own
console's. What is left is the record app support works from, and v2 added three
things to it that v1 could not show **for one person** even though it held every
fact needed for all three.

- **`hasApp` is the first column**, ahead of the last delivery date. The question a
  clerk arrives with is "are they using it", not "when did they last deliver".
- **Three states, not two.** Signed in with a device registered, signed in with
  none (they turned notifications off, or the token expired — a supplier who will
  never see a `billPublished` push), and never installed. Collapsing the middle case
  into "has the app" hides the reason a supplier says nobody told them.
- **`?hasApp=false` is the working filter**, and the dashboard's adoption card links
  straight into it. A percentage nobody can turn into a list of names is a
  percentage nobody acts on — which is what filter-state-in-the-URL is for.
- **Everything else is read-only**: the bank details, the savings rate, the credit
  balances. Every value shown is the **active** one (AC-01); a pending change appears
  as pending, never as applied.
- **The audited bank reveal stays**, unchanged from v1. §20.4 applies to a support
  clerk exactly as it applied to a registry clerk: a reason is required, the clerk is
  told it is recorded before they ask, the audit id is shown back, and the revealed
  number is never cached.
- **Resetting the app password stays**, and it is now one of the module's main jobs
  — §21.15/§21.16 as the factory answered them. The password is one-time
  (`owesPasswordChange`), how identity was checked is recorded, and existing sessions
  end. See `packages/domain/src/supplierCredentials.ts`.

`hasApp` and `mockDevicesBySupplier` are derived from the **same rule** in the
fixture, deliberately: the dashboard counts adoption from the device registry and
this grid reads `hasApp`, so two different predicates would put a percentage on one
screen that the list on the next screen disagrees with.

### Month history — graph, list and deductions

**The screen a clerk needs while the supplier is talking**, and v1 had no way to show
it. `BillQuery` offered `monthKey` and a text search — the accountant's axis: pick a
month, then filter within it. Right when M5 fed the month close; wrong now that M5
survives only as support, because the question support is asked is never about one
month. It is *"why is my July less than my June?"*, and answering it needs both.

So `supplierId` is on `BillQuery`, and `GET /admin/suppliers/{id}/income` serves the
series. **The three views are the app's three views, in the app's order**, because the
whole point is that the clerk and the supplier are looking at the same thing:

| View | What it answers |
| --- | --- |
| **Graph** | A bar per month, switchable between earnings and kilos. The switch is what makes *"I delivered more and got less"* visible rather than arguable — it is a rate question, and the two series have to be seen apart |
| **List** | The months, newest first, each opening the slip the supplier is holding |
| **Deductions** | A donut of one month's nine lines. The view that answers the real complaint most of the time: the gross was fine and something came off it |

Two rules carried from the app rather than reinvented:

- **`null` is not `0`** (BR-102). The graph **omits** an unsettled month in earnings
  mode rather than drawing a zero bar, and the list shows a pending badge. A zero
  would tell a supplier they earned nothing in a month that has simply not settled.
- **The deduction labels are M5's**, not a second set. The donut and the slip must
  name a line identically, or a clerk reading one to a supplier holding the other is
  reading two different words for one charge.

The series arrives **oldest-first** and the list reverses it: a chart reads left to
right, a list is read from the top.

### Notifications — why a push does or does not reach *this* supplier

**The most common push support call there is, and v1 could not answer it.**

*"Nobody told me my account was ready."* There are four possible reasons, and the
console held every fact for all four — the device registry, the tenant's category
list, each device's consent list, the send log — while exposing them only in
aggregate. M13's reach panel can say *"reaches 61 devices, 6 opted out"* and cannot
name one of the six.

The panel is a **diagnosis, not a dump**. One line per category, and when it does not
reach, which reason it is — because the reasons have different fixes:

| Reason | What the office does |
| --- | --- |
| No device at all | Help them install it. Nothing else on the panel applies, so nothing else is shown |
| The factory does not send this category | M14. Not the supplier's doing, and sending them to their phone settings wastes both their time |
| Every device opted out | Their setting, on their phone. The office can explain it and cannot change it |
| Reachable, and nothing was sent | The send log below it |

That last row is why `recentSends` is on the panel rather than left to M13: **a clean
diagnosis and an empty log is a complete answer**, and the two halves have to be on
one screen to be read as one. Without it the panel shows four green ticks and leaves
the office insisting the message must have arrived.

`deliveredToDevices: 0` on a send that reached hundreds is the row that matters, and
an aggregate log can never show it — which is why the figure is per-supplier on the
wire.

**No push token anywhere on the payload.** It is a credential, nothing in the office
can act on one, and §20.4's argument about account numbers applies unchanged.

### Every queue this supplier can be in

v1 linked to **one** of four. The app shows a supplier their whole request history in
a single list (`RequestHistoryList`); the office had to visit four screens and type
the supplier code into each — which in practice means checking one and assuming the
rest.

`supplierId` was already on all four query types. Only the links were missing. They
are unconditional rather than hidden when a queue is empty: *"nothing outstanding"* is
an answer a clerk needs, and a row that vanishes when the answer is *no* cannot give
it. Each is gated on the same flag as its sidebar row.

Deliberately **not** counts: four extra requests to render numbers that are stale the
moment a colleague decides something, when the queue itself answers accurately.

## M5 Bills — read-only

*The account the supplier is looking at on their phone.*

**The only module kept on a support argument rather than an app-management one.**
A supplier telephones about a figure; the clerk has to see the same account. That is
a read. Generating a run, re-generating after a correction and publishing a month
are the factory's own console's, and they move money.

So `BillRunCard` is **commented out rather than disabled**, and the distinction is
the point: that card is a *control*: its entire subject is which of three states the
run is in and which button to press about it. A disabled version would be a card
explaining a decision nobody on this screen can make. The screen says where that work
happens instead.

What survives is what a supplier can ask about: the nine deduction lines including
the zeros, the coins carried forward, `nextMonthDeb` on an account that owes more
than it earned, and the three lenses (*nothing payable*, *payable with no bank
details*, *lines that do not add up*). The arithmetic is still
`packages/domain/src/bill.ts`, shared — AC-03 requires this screen, the printed slip
and the app's Home screen to agree field for field, and that is now a three-way
agreement across two consoles.

## M7 Credit queues

*Advances, loans and manure on credit.* **Unchanged from v1**, and it is worth
saying why nothing moved: these requests originate in the app, the eligibility
figures must match what the supplier was shown byte for byte (AC-05), and the
arithmetic behind them is `packages/domain/src/leafCredit.ts` — shared code the app,
this console and the API all read.

One queue, filtered, not three screens. The decision must be defensible: the detail
page prints the working in the order the rule reads it, `ceilingSeen` makes BR-310
enforceable, `over-ceiling` is refused on both sides, and BR-501 is checked **before**
the figures because who may decide does not depend on what the ceiling says.

**§12.1 is unusual here and stays unusual**: `creditRequests` is `R` for the clerk
and the accountant, `A` for the manager alone. Most people who open this screen
cannot act on it, and they are told who can.

## M18 Tea packets — new in v2

*The factory's own tea, issued to the supplier who grew the leaf.*

**This module exists because v1 had nothing for it at all.** The app has shipped
`RequestTeaPacketsScreen` since its first release. This console had no type, no
endpoint, no queue and no flag — a supplier could ask, and the request went nowhere.
Every other `pending` in the app is a queue somewhere; this was the one that was not,
and it was invisible because the domain package's own docblock claimed to be *"a
verbatim port of the mobile app's `src/types/index.ts`"* while missing exactly two
exports.

**A separate queue from M7, not a fourth facility**, and that is the module's one
real design decision:

| M7 | M18 |
| --- | --- |
| Priced off the supplier's leaf | Priced off a catalogue of one |
| `CreditEligibility` on every row, AC-05 byte-for-byte | No eligibility at all |
| `ceilingSeen` + `stale-eligibility` (BR-310) | Nothing to go stale |
| A detail page, because the working has to be printed | One screen, because every column fits in the grid |

Folding it into `AdminCreditRequest` would have given every tea-packet row three
null eligibility figures and an AC-05 obligation it cannot meet.

**What the approver actually needs is the store's question**, so the grid carries it:
how many packets, **what it weighs** (packets is the supplier's question, kilos is the
storekeeper's), how it travels, and what it will cost on the account. The delivery
filter is a working view — requests going back on the collection vehicle have to be
packed before it leaves.

**The price is stamped at the decision and never re-read.** A catalogue edit
afterwards must not silently re-price a request the office already answered at a
figure the supplier was quoted.

**The cap is stock, not credit.** `maxPacketsPerRequest` says how much of the store
one person may take at once. An over-cap request is refused on **approval only** — the
rejection has to stay available, or the row is trapped in the queue for ever with the
office unable either to issue the tea or to say why. Same reasoning as BR-310 not
gating M7's rejections.

**Approved and not yet recovered is money the factory is owed**, so
`enableTeaPackets` is refused while any exists — the same rule that blocks
`enableSavings` while balances exist.

Rules shared with M9 and M7 unchanged: AC-06's note on both verbs, BR-501 on
`createdById`, `already-decided` as a first-class case.

## M9 Change requests

*Payout, savings-rate **and address** approvals.* Oldest first within a status,
current-vs-requested in the grid as well as on the detail page, and the three rules
implemented rather than assumed: AC-06 in three layers, BR-501/AC-10 by withholding
the buttons *and* refusing server-side, AC-02's asymmetry in the invalidation set.

`already-decided` keeps the dialog open with an explanation and refetches, rather
than discarding the note the clerk just wrote.

### `address` — the fourth type

**It corrects an asymmetry rather than adding a feature.** Bank details, the payment
method and the savings rate came through this queue because they decide where money
goes. An address decided nothing visible, so the app's `PATCH /profile` wrote it
straight to the record and the office never heard about it.

That is wrong twice over. The **estate address is where the leaf comes from** — it
ties a supplier to a collection point and to land — and the **home address is where
every printed Green Leaf Account is posted**. A wrong one is a slip delivered nowhere,
and nobody in the office knew it had changed.

**The console needed almost nothing.** The grid, the detail page and the decision
dialog render it unchanged, because they were built against `currentSummary` and
`requestedSummary` rather than against the three types that happened to exist. The
filter dropdown is the one place that names them. That is the design paying for
itself — a queue that had branched per type would have needed four screens touched.

Two things did need care:

- **Apply per key, not per block.** `requestedAddress` carries only what moved, and
  changing only the estate address is a normal request. A handler spreading the whole
  object would blank the field the supplier never touched — and the leaf is filed
  against that one. The fixture's seeded request changes the home address alone,
  precisely so a test fails if anybody rewrites it as a spread.
- **The write path had to close.** Adding the request type changes nothing while
  `PATCH /profile` still accepts an address. The app enforces its half in the **type
  system** — `EditablePersonal` no longer includes either field — because a form can
  be changed back by anybody and a `Pick` cannot be reached around without the build
  failing. The API must refuse rather than ignore; see
  [api-contract.md](./api-contract.md) §6.4.

**On the app side** the profile screen is now two cards with two lifecycles: contact
details save immediately, addresses are asked for. A single form with one Save would
have told a supplier correcting their email that their *address* had been submitted
for approval. While a request is pending the address fields are read-only and show
what was asked for — two pending changes to one address is two decisions for the
office to reconcile, and the supplier cannot withdraw the first.

## M10 Inquiries

*Messages from suppliers.* Unchanged. The only queue whose rows are prose, so the
subject gets the width and the first line sits under it.

**Reply and close are different acts**: replying writes something the supplier reads,
closing files a message that needed no answer. A single "resolve" would make the two
indistinguishable, and *how many suppliers we actually answered* is the number
§19.3's channel-shift KPI wants — which in v2 is the console's headline figure.

§12.1 is unusual and stays: `A` for the **clerk**, `R` for the manager. Answering a
supplier is counter work; a manager reading the queue is oversight.

## M11 News

*The feed suppliers read in the app.* Unchanged.

AC-08 has two halves — copy falls back to English, *and* the gap is visible to the
editor — and both are only true because `resolveTranslation` is **shared** and the
preview is fetched from the server. A console with its own fallback would show the
editor a preview of something that is never rendered.

Copy is saved one language at a time. Three states, not two, and the third earns the
module: **stale** — written before the English it was translated from was corrected,
which nothing anywhere looks wrong about.

Publishing with a gap is allowed and loud. The one hard refusal is a record with no
fallback copy at all.

## M11 Promo banners — new in v2

*The full-width announcement on the way into the app.*

**v1 shipped the flag, the type and the specification, and no way to author one.**
`enablePromoBanner` was on the configuration screen mapped to M11; `PromoBanner` was
in the domain package; the mobile repo's `docs/banners.md` described artwork,
headline, one button, a live window and an action allowlist. A factory that turned the
switch on got nothing — which is worse than the feature not existing, because the
switch says otherwise.

It gets its **own sidebar row** rather than living inside an article's detail page,
for exactly that reason: a surface reachable only from inside another module is a
surface the office does not know it has. Gated on `enablePromoBanner`, **not**
`enableNews` — a factory that runs no feed may still want to say the store is closed
on Friday.

### The window is the column, not the status

An article is published or it is not. A banner has a status **and** a live window,
and the two disagree constantly:

| State | What every badge says | What suppliers see |
| --- | --- | --- |
| Published, starts next week | Published | Nothing |
| Published, ended on Tuesday | Published | Nothing |
| Draft | Draft | Nothing |
| Published, inside the window | Published | The banner |

So the list defaults to the **live** lens, and the editor screen leads with a window
notice rather than a status badge — the office's question is "why are suppliers not
seeing this", and the answer is a date. `window` is computed **server-side**: a
console reading the browser's clock would disagree with the phone on the day a banner
starts, and differently on every machine in the office.

### The action runs the app's own resolver

This is the module's load-bearing decision. `banners.md` is explicit that an action
the app cannot resolve renders **artwork with no button and reports nothing** — right
on a phone, where a supplier can always close a banner and where a console newer than
the app will eventually send action types the binary has never heard of.

That silence is what makes it dangerous to author against: from the office, a banner
with a dead button looks exactly like one that works. So `packages/domain/src/banners.ts`
is a **verbatim port of the app's `src/services/banners`**, and the console runs
`bannerTarget()` on every keystroke, at save, at patch and at publish.

| Refusal | Why it is named separately |
| --- | --- |
| `banners.action.appSchemeRefused` | `teafactory://manure` is the mistake an editor makes **on purpose**, and the answer is "use an in-app screen", not "unsupported scheme" |
| `banners.action.badPath` | A path with a query string is one the linking config cannot match |
| `banners.action.badUrl` | `https`, `tel`, `mailto` only, parsed with `new URL` so malformed input is refused rather than normalised |

The field also prints, in words, **what the app will do** with what is currently
typed. Positive confirmation rather than only an error, because "no error" and "this
works" are different claims — and it is how an editor notices they pasted a tracking
URL that normalised into something else.

### Two asymmetries with M11's articles

- **A missing translation may be published over; a refused action may not.** The
  first falls back to English and the supplier reads *something*, which AC-08
  explicitly permits. The second has nothing to fall back to — the button is simply
  not drawn — so publishing puts artwork in front of every supplier with no way to act
  on it.
- **"Written" means headline + button label, not headline + body.** A headline-only
  banner is a normal banner; a banner with no button label is not. Reusing
  `content.ts`'s `isWritten` would have marked the first as missing and the second as
  written — both halves of AC-08 pointing the wrong way. Hence `isBannerWritten` and
  `staleBannerTranslations` beside the shared ones.

**Taking a banner down is distinct from editing `endsAt`.** The window is a schedule;
this is an intervention — a banner announcing a price that turned out to be wrong has
to stop showing this afternoon — and the record should say it was withdrawn.

## M12 Static content

*The app's fixed pages.* Unchanged. A closed set, not a collection: no create, no
delete, no archive, and the list returns all six **including the ones nobody has
written**, because an unwritten page is a state to be shown — the app is rendering its
own bundled default and an office that cannot see the page listed assumes it filled it
in.

An edit to a live page is live when saved, and what makes that safe rather than merely
convenient is the audit entry recording the previous wording and the new one.

## M13 Notifications

*What suppliers are told, and what they are told automatically.* Unchanged.

§21.24 is answered as **configuration rather than code**, so the factory's eventual
answer is a switch and not a rewrite. A push is the only act in this console with no
undo and no delivery report, so every safeguard is a *pre*-check: `unknown-category`,
per-device consent, `no-recipients` on a composed send only, `push-not-configured`.

The reach panel is the module: three numbers rather than one, because *reaches 3, 11
opted out* is a circular that belongs on the noticeboard, and there is no way to learn
that afterwards.

**One v2 note.** Automatic sends fire from the module that owns the event, and two of
those events — `month.publish` and a payout — now happen in the factory's own console.
The trigger rows are unchanged and the API contract is unchanged; what changes is
*which system calls it*. That is in [api-contract.md](./api-contract.md) and
[status.md](./status.md), because it is an integration this console cannot verify.

## M14 Configuration

*Everything about a factory that is data rather than code.*

**This module is AC-12, and v2 is where the criterion actually became true.**
[white-label.md](./white-label.md) has always said a new factory is *"a DNS record and
a `client_config` row — no build, no deploy"*, and the test is whether the **last**
field a factory needs is on this screen. It was not: six of the app's fourteen feature
flags had no control anywhere in the console, so turning off biometric sign-in or the
onboarding screens required a developer.

Seven sections now: factory identity, **the fourteen flags**, collection points /
banks / savings rates, languages and branding, the push block, and — new in v2 — the
**tea-packet policy**.

**The flag section now says two different things**, and the distinction is v2's:
some flags remove a console module *and* an app screen (`enableManure` → M7), and the
rest remove only an app screen (`enableBiometricLogin` → the app). Saying "M7" against
the first and "the app" against the second is more honest than inventing a module id
for a phone setting. **Editing a flag is a console feature; obeying it is the app's
job.**

**The tea-packet section is its own section**, not three fields appended to
*Operations*, for the reason the banner editor got its own row: a price buried under a
heading about collection points is a price nobody finds, and M18 then quotes
`DEFAULT_TEA_PACKET_POLICY` at real suppliers — a real number, and not this factory's.
Both the queue and this section say so when it has never been set.

**The screen's real job is still showing what an edit costs**, computed from the same
`configImpact` the API refuses with:

| Impact | Severity | Why |
| --- | --- | --- |
| `savingsHeld`, `creditOutstanding`, **`teaPacketsOutstanding`** | **Blocks** | Turning off a flag whose module holds money would hide what the factory owes — or, for tea, what it is owed |
| `pointInUse` | **Blocks** | A delivery names its collection point and nothing else |
| `fallbackLanguageRequired` | **Blocks** | Every article, page and banner falls back to English |
| **`teaPacketPolicy.*`** | **Blocks** | A zero pack size or negative price does not fail visibly — it prices every request wrong, and the person who finds out is holding a slip with it deducted |
| `surfaceRemoved` | Warns | A flag that only shows something is a choice the factory is entitled to make |
| `bankInUse`, `languageDroppedWithCopy` | Warns | The data survives; only what is offered changes |

`tenantId` is shown and not editable (`tenant-immutable`). One `PATCH` per section,
drafted locally and saved as a unit so the impact list can describe the *complete*
change.

**`payoutFile` is commented out** with M6. `PayoutFileSection.tsx` and
`payoutExport.ts` both stay: §21.17's answer — that the layout is configuration rather
than three guessed serialisers — is still the right answer, and whoever owns payouts
next needs the serialiser rather than a second guess at the format.

## M15 Users & roles

*Who may use the console.* Unchanged.

Every refusal is one failure wearing different clothes: a factory locking itself out.
`last-admin`, `self-modification`, and the one nobody thinks of — strip `usersAndRoles`
from every **role** and every user keeps the roles they had while nobody can manage
users again, which a check written per user misses entirely (`matrixKeepsRecovery`).

There is no delete: a user who approved a request is the actor on an audit entry, and
an entry whose actor cannot be resolved is not evidence.

**§12.1's matrix keeps every capability**, including `deliveries`,
`ratesAndMonthClose` and `payouts`. Removing them would be a migration of every role
record for no gain, and the same roles exist in the factory's own console. See
[rbac.md](./rbac.md).

## M16 Reports — narrowed to one

*The one report an app-management console owes anybody.*

`channelShift` stays because §19.3 calls app adoption and channel shift **"the two
KPIs that justify the project"**. The other three — `dormantSuppliers`,
`leafByCollectionPoint`, `monthSummary` — are the factory's own console's, and are
commented out in `REPORT_IDS`, in the mock's `runReport` switch and in the test suite,
each with its citation intact.

**No flag.** `enableReports` was console-only and went with `enablePayouts`; what is
left is not a feature a factory declines to have.

A report is still asked for and answered, never stored. It still describes itself —
columns come with the rows carrying what each one *is* — and `null` is never `0`
(BR-102): a month with no requests has no adoption share.

## M17 Audit log

Filterable by entity, read-only, newest first. It gains two entity types —
`promoBanner` and `teaPacketRequest` — and one field that closes a real hole.

### `actorType` — what the supplier did themselves

v1 had no such field, because every entry was written by somebody signed into this
console: `actorId` implied `consoleUser` and nothing needed to say so.

That stopped being true when the console became the app's management surface. **The
app lets a supplier change their own name, telephone, date of birth and both
addresses through `PATCH /profile`** — no approval, no change request
(`ChangeRequestType` covers only payout and savings-rate changes) — and v1 recorded it
**nowhere**. The office could be asked *"when did this address change?"* and had no
way to answer; a wrong telephone number had no history at all.

Three kinds rather than a boolean, because the third is a real and separate answer:

| `actorType` | Who |
| --- | --- |
| `consoleUser` | The office. **The default**, and an entry with no `actorType` is one of these — every v1 entry was |
| `supplier` | The supplier, in the app. Their own profile edits, and their first-sign-in password change |
| `system` | An automatic send firing off an event. Attributing it to whoever published the month would read as though they composed it |

**The supplier's actions sit on the same timeline as the office's**, on the same
record, deliberately: *"what we did to this account"* and *"what they did"* are two
readings of one history, and a clerk investigating a dispute needs them interleaved.
Which makes the label essential — an address change by the supplier and one by a clerk
are the same row shape and completely different facts.

Office entries carry **no** badge. They are the norm here, and badging every row would
make the exception invisible again, which is the failure this closes. M17 gains an
actor filter for the same reason: an investigator is always asking one of the two
questions rather than both.

`supplier.password.change` is the entry that makes §21.16 auditable end to end. The
office issues a one-time password and records the identity check; this is the other
half — the supplier replacing it, which is what makes the credential the office knew
stop working. Without it the console can show that a password was issued and never
that it was consumed.

An `ip` of `null` on a supplier entry is deliberate: a phone on a mobile network has no
address the office can act on, and inventing one would make the column look meaningful.

Before/after render as JSON, deliberately: an audit entry is evidence, and a
prettified summary is an interpretation of evidence.

Two v2 entries are worth knowing about:

- **A banner publish records the languages that will fall back.** "Who decided a Tamil
  supplier could read this in English" is the question AC-08 turns into an argument six
  months later, and the answer has to be in the record rather than in somebody's memory
  of a confirmation dialog.
- **A tea-packet decision records the unit price.** "Approved at LKR 1,200 a packet" is
  what settles a query about a `deductions.tea` line three weeks afterwards.

**CSV/XLSX export is still not built** — recorded in [status.md](./status.md) rather
than implied by a disabled button.

---

## What is deliberately not built

| § | Question | What is missing | Why not guess |
| --- | --- | --- | --- |
| — | Artwork upload for banners | The image **upload**; `imageUrl` and `imageAspectRatio` are on the record and the app renders them | `uploadRepository` exists for attachments, but a CMS image needs a store, a size policy and a CDN — none of which is this repository. The app draws a branded panel without one, deliberately |
| 21.10 | What is `otherCards`? | The **ninth** deduction line | Unchanged from v1. The other eight are answered — and `tea` is now answered by M18 rather than being *"an app request"* with nothing behind it |
| 19.1 | What shape is the reporting warehouse? | Everything beyond `channelShift` | A report nobody asked for is a query somebody maintains and nobody reads. §19.1 is in the mobile repo |
| — | CSV/XLSX export | M16 and M17 | Absent rather than a disabled button |

The v1 table's other rows — §21.17's fixed-width bank file, §21.9's interest accrual,
§21.8's post-publish correction — are **not** listed here, because they are questions
about modules this console no longer contains. They are in
[../v1/modules.md](../v1/modules.md), where the factory's own build can read them.

---

## What a real deployment still needs

| Needs | Why it is not a console change |
| --- | --- |
| **A real API** | Every screen talks to MSW, which is an executable reading of [api-contract.md](./api-contract.md) — see [mocks.md](./mocks.md) |
| **A push provider** | M13 records what it *would* send and what it would reach. The topic prefix and category list are configured (M14); the transport is not this repository |
| **The factory's console calling the notification triggers** | `month.publish` and a payout decision fire `billPublished` and `requestDecided`. Those events now happen elsewhere, so the trigger is an integration this repository cannot verify |
| **An image store for banner artwork** | See above |
| **§19.1's warehouse** | M16 grows a report list without a console release |
