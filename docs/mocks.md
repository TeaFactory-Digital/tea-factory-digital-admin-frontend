# The mock API

The backend has not started, so the console runs against MSW. This document is
what it does, what it deliberately does not, and how to leave it behind.

---

## Why a service worker rather than stubbed repositories

The obvious shortcut is to make `services/repositories/*` return fixtures. It was
not taken, for one reason: the console would then never exercise its own
transport. Interceptors, refresh-on-401, the idempotency header and the error
envelope would all be untested, and **§17.7's error-code flattening bug is exactly
the class of defect that hides behind a stubbed repository.**

With MSW, swapping to the live API changes what answers, not how the console asks.

Same handlers in both places:

- **Browser** — `services/mocks/browser.ts`, started in `main.tsx` before React
  mounts, gated on `import.meta.env.DEV && env.useMock`.
- **Vitest** — `services/mocks/server.ts`, via `test/setup.ts`.

A test that passed against different fixtures from the ones a developer clicks
through proves nothing about the console.

---

## It is a specification, not a demo

Every refusal the mock produces is a refusal the real API must reproduce. That is
what makes `handlers.ts` readable as an executable version of
[api-contract.md](./api-contract.md):

| Enforced | Rule |
| --- | --- |
| `403 forbidden`, from a **server-side** capability check | §12.1. The console hides what a role cannot do as a courtesy; this is the authority |
| `409 four-eyes-violation` | BR-501 — the approver created the record |
| `409 already-decided` | Two clerks working one inbox |
| `422 note-required` | AC-06, on **both** approve and reject, and on suspend, reveal, void and exception resolution |
| Masked bank details in every read payload | §20.4 |
| An audit entry for every mutation, in the same tick | AC-09 |
| A queue omitted when its feature flag is off | AC-07 |
| `409 month-locked` on a delivery, a void or a rate in a published month | BR-108 |
| An idempotent replay of a committed weighing session | §1.3 — the same `batchId` returns the original result, rejections included |
| Per-row rejections inside a `200` on a batch | §9.3 — one bad code must not send fifty-nine good rows back |
| `409 exceptions-open` on a publish with unresolved exceptions | AC-04 |
| `409 flag-has-records` / `409 point-in-use` on a config change that would hide money or orphan rows | M14. A flag holding a liability is not a preference the factory gets to express |
| `422 tenant-immutable` on a patch containing `tenantId` | The subdomain owns it and every other row is keyed on it |
| `409 last-admin` on suspending or re-roling the only user who can administer users | A factory locking itself out of its own console has no recovery path |
| `409 last-admin` on a **role matrix** in which no role grants `usersAndRoles` | The same lockout with no user record changing — a check written per user misses it entirely |
| `422 unknown-category` on a notification the app would drop | M13. A send the console called successful, reaching nobody, reporting nothing |
| `422 invalid` on a report run missing a parameter | M16. An empty grid reads as "no leaf that month", which is the one wrong answer that screen can give |
| `409 run-not-approved` on a payout **file** taken from a draft | A file generated before the four-eyes release and uploaded to the bank walks straight around BR-501 |
| Full account numbers in the payout file, and **nowhere else** | §20.4. A payment file cannot be masked, which is why producing one is audited (`payout.run.export`) and the console cannot assemble it from the grid |

Two structural choices worth copying into the backend:

1. **Full account numbers live in a separate map from the supplier records.** A
   list handler *cannot* leak one, because the record does not contain it. Do the
   equivalent server-side: mask in the read model, join to the real value only in
   the reveal endpoint.
2. **`authorize()` returns either the user or the response to send.** A handler
   cannot forget the check and still compile into something that answers `200`.
3. **A handler reads live state; it never reads the seed.** This one was learned three
   times, from three bugs with the same shape and three different symptoms:
   - `bearer()` read `mockUsers`, so suspending a user was cosmetic — their token kept working.
   - `roleMatrix()` wrote `state.roleMatrix ??= …` on *read*, so merely opening the matrix
     screen marked the factory as having customised its permissions.
   - `flagsOf()` and `contentLanguagesOf()` read `mockConfigs` while `GET /config` served
     live state, so a flag turned off in M14 removed the sidebar row and the route while
     every endpoint behind them went on answering — which is exactly the half of AC-07 the
     criterion exists to insist on.

   The pattern: **once a fixture becomes editable, every reader of it is a potential bug**,
   and the symptom is always "the screen changed and the thing behind it did not". Worth the
   same care server-side, where the equivalent is a cached config or a stale read replica.

---

## Fixtures

Deterministic — a seeded mulberry32 PRNG, not `Math.random`. A screenshot in a bug
report matches what the next developer sees, and the integration tests can assert
on real values.

### Users

| Email | Role | MFA | Purpose |
| --- | --- | --- | --- |
| `clerk@galabodatea.lk` | `clerk` | no | Works the change-request queue |
| `manager@galabodatea.lk` | `manager` | **yes** — code `123456` | Approves, publishes a month; exercises the MFA step |
| `accountant@galabodatea.lk` | `accountant` | no | Enters the rate, resolves M4 exceptions |
| `weigher@galabodatea.lk` | `weigher` | no | **The only one who can record leaf** |
| `editor@galabodatea.lk` | `editor` | no | **The only one who can write content.** `content: W` and nothing else at all — not even `auditLog: R` |
| `factoryadmin@galabodatea.lk` | `factoryAdmin` | no | **The only one who can publish it.** §12.1 splits writing from publishing, and that split *is* M11/M12's control |

Password for all six: `demo1234`, and all six are **printed on the sign-in
screen** while `VITE_USE_MOCK` is on — deliberate, because a demo credential that
has to be looked up in a source file gets pasted into a chat thread and outlives
the demo. The block cannot render in a production build.

The editor is worth a second look: it is the **narrowest account the console has**, and it
is why the news screen's audit panel tolerates a `403` instead of treating it as an error —
the person most likely to be on that screen cannot read the log.

**One identity per rule that needs two people.** AC-10 ("no console user can
approve a record they created") cannot be demonstrated with one, and neither can
BR-501 on the month close, where the accountant enters the rate and the manager
publishes it. The weigher exists because §12.1 gives `deliveries: W` to nobody
else in this fixture — signed in as the clerk, M3 is read-only, and that is the
matrix working rather than a broken screen.

**M15 makes these six mutable, and that changed what they are for.** A suspension now takes
effect on the next request rather than being a badge, so the fixture can demonstrate the one
failure the module exists to prevent: `factoryadmin` is the *only* user holding
`usersAndRoles`, which makes them the last way back in — the row says so and the suspend
button is withheld from it. Invite a second factory administrator and the badge disappears
from both rows, because `isLastAdministrator` is derived on every read rather than stored.

The §12.1 matrix is mutable too, and `state.roleMatrix` is `null` until somebody edits it —
`null` meaning *"this factory uses the standard roles"*, which is what the *Standard roles*
badge reports. That is why reading the matrix must not materialise it (see the seed-versus-
state rule above).

### Suppliers — 84

Enough to exercise server-side paging at the 50-row default, small enough to read
through while debugging. Systematically varied so the edge cases are always
present:

- 1 in 9 has **no bank details** → the M4 exceptions the dashboard alert counts
- 1 in 17 is **suspended**, 1 in 41 **closed**
- 1 in 13 is **dormant** (no delivery for 95+ days)
- savings rates cycle through `0, 0, 5, 10, 15, 20, 25` — so opted-out suppliers
  are always in view

### Change requests — 14

The ids are fixed, because the integration tests name them:

| Id | Type | Notes |
| --- | --- | --- |
| `chg-1` | bankDetails | app-raised |
| `chg-2` | savingsRate | app-raised — the approve test |
| `chg-3` | paymentMethod | app-raised — the reject and detail-screen tests |
| `chg-4` | bankDetails | app-raised — the note-required tests |
| `chg-5` | savingsRate | app-raised — the already-decided test |
| `chg-6` | paymentMethod | **office-raised by the clerk** — the four-eyes test |
| `chg-7`…`chg-12` | mixed | ages 2 h to 5 d, so SLA colouring has something to show |
| `chg-13` | approved | so the non-pending filters are not empty |
| `chg-14` | rejected | with a real rejection note |

### Credit requests — 14

Ids fixed, because the integration tests name them. Amounts are **priced off each
supplier's actual headroom** rather than picked as round numbers: a fixture whose
asks are unrelated to the ceilings makes every row either trivially approvable or
absurd, and the judgement in between is the queue's whole job.

| Id | Facility | Notes |
| --- | --- | --- |
| `crd-1` | advance | comfortably inside — the approve, stale-eligibility and dialog tests |
| `crd-2` | loan | inside — the AC-05 loan-arithmetic test |
| `crd-3` | manure | inside — the note-required tests |
| `crd-4` | advance | **asks for more than is available** — the `over-ceiling` tests |
| `crd-5` | advance | 80 h old, so SLA colouring has something to show |
| `crd-6` | loan | **raised by the manager** — the four-eyes test |
| `crd-7` | manure | against a supplier who **already owes** on the facility, so "already drawn" is a real figure and not a column of zeroes |
| `crd-9` | loan | a supplier with **no settled months** — the `shortHistory` reason |
| `crd-8`, `crd-10`…`crd-12` | mixed | ages 2 h to 4 d |
| `crd-13` | approved | so the non-pending filters are not empty |
| `crd-14` | rejected | a loan above three times the average account |

Two of those need their reason stated, because both were originally wrong and the
test suite caught them:

- **`crd-6` is raised by the *manager*, not the clerk.** §12.1 gives
  `creditRequests: A` to the manager alone, so a clerk-raised request could never
  trip BR-501 — the clerk cannot approve anything and every other role is innocent
  of raising it. Attributing it to the manager is the only way the four-eyes refusal
  is reachable at all.
- **`crd-9`'s supplier is chosen on months of history**, which is the property the
  rule reads. An earlier version used "has no bill in the open month" as a proxy and
  picked the wrong supplier three days out of four: on the 1st only a fraction of the
  round has delivered, so the proxy caught someone with seven settled months who
  simply had not been in that morning.

Eligibility on a **pending** row is recomputed on every read from the *live*
delivery rows — so committing a weighing session in M3 moves an advance ceiling, and
`stale-eligibility` is reachable by doing one's job rather than by sending a wrong
number. A **decided** row keeps the figures it was decided against; recomputing them
would make every past approval look wrong the moment a supplier's leaf changed.

### Inquiries — 7

Five open, one answered, one closed unanswered — so all three states and both
channels are present without anyone creating them. Written as things a smallholder
would actually send ("My July account shows 96 kg less than my own book"), because
the queue is triaged by reading the subject, and lorem-ipsum rows make the triage
columns look like they work when nobody has tried reading one.

`inq-6` is a one-word test message closed with a reason, which is the case the
close-unanswered path exists for.

### Deliveries — eight months

Generated per day per supplier rather than as a flat list, so the shape of a real
fortnight is present: **Sundays are empty** (the factory does not weigh), about
three suppliers in five deliver on any given day, and one in seven of those brings
a second load in the afternoon — which is why `supplierCount` and `deliveryCount`
are different figures everywhere they appear.

It spans **the fixture's whole month window, not the last fortnight**, and that is
M5's doing rather than generosity: a bill is a read model over these rows, so a
published month with no leaf in it generates no bills — and Bills, Payouts and
Savings would each render an empty screen that reads as a broken module rather than
as a fixture with nothing in it.

Four properties are load-bearing rather than decorative:

- **Only non-dormant active suppliers have rows.** Derived from the registry, not
  invented beside it: a supplier the grid calls dormant (no delivery for 95+ days)
  with deliveries last Tuesday is a fixture contradicting itself, and the
  dormant-suppliers report would be built on the contradiction.
- **`lastDeliveryAt` on the supplier record is set *from* these rows**, for the
  same reason.
- **One row is voided**, so the state is visible without anyone creating it and
  `includeVoided` has something to return. It sits in the **open** month
  deliberately: BR-108 refuses a void in a published one, and a fixture showing an
  impossible state teaches the wrong rule.
- **A scale file every fourth day**, so `source` and the unbuilt import path have
  something to show.

The dashboard's "today's leaf" and 14-day trend are computed from these rows, so
committing a session in M3 moves the dashboard — which is what
`deliveries.test.ts` asserts, and what the real API must reproduce.

### Months — 8, and exceptions derived from the data

The current month is `awaitingRate` with no rate; the seven before it are
`published` with a rate and a publisher, so **`month-locked` has a date it can
actually happen on**.

**Eight rather than four, and M7 is why.** A loan or manure ceiling is gated on
`REQUIRED_MONTHS_OF_HISTORY` (six) closed months of income, so at four months every
loan in the fixture was ineligible for the one reason that says nothing about the
module — a queue whose every row is refused by the same rule cannot show that any of
the others work. Seven published months also keeps the mix worth having: a supplier
who has delivered throughout clears the bar, a dormant one does not, so
`shortHistory` stays the honest minority rather than the universal answer.

Widening the window moved two things that were sized against the old one, and both
are now **derived from `MONTHS_OF_HISTORY`** rather than restated:

- The **opening debts** that make `carriesDebt` reachable. A credit instalment is
  capped as a share of the gross, so a debt is worked off at roughly a month's leaf
  per month — a flat figure that survived four months is fully repaid by seven, and
  the state quietly stops existing in the newest month.
- The savings screen's **trend table**, which renders one row per month. Unbounded,
  it made the summary card's height a function of how long the factory had been on
  the platform, and squeezed the accounts grid below it to fifteen pixels of scroll
  area — rows present, focusable and physically unclickable behind the pagination
  bar. Caught by the e2e suite; a real factory reaches the same state by existing
  for a year. Rates drift month to month rather than repeating one figure,
because a bill screen showing the same LKR 122.50 for every month reads as a
hardcoded placeholder — which is what it would be.

The stage is **stored per month, never recomputed from the calendar**. That is the
one thing worth copying verbatim into the backend: a derived stage would revert a
publish on the next request, and M3 would go on accepting leaf into a closed
month.

Exceptions are **queries, not fixtures** — leaf with no bank details, leaf against
an inactive supplier, a pending change request that would change the bill, and a
weighing outside the day's spread. A hand-written exception list would say "12
suppliers have no bank details" while the registry said something else, and the
accountant would be reconciling the console against itself.

### Bills, payouts and savings — one chained history

The three money modules share one fixture builder, and it is **chronological and
chained**: a month's `previousDebts` is the previous month's unpaid balance, its
`coinsBroughtForward` is the previous month's sub-rupee remainder, and its savings
`previous` is the ledger's running balance. Three independent fixtures would show
three months that do not add up — and "the carried figures do not tie" is precisely
the bug M5 exists to make impossible.

What that produces, and why each piece is there:

| Piece | Why |
| --- | --- |
| A **bill run per published month**, one bill per supplier with leaf | A published month with no bills is a month M6 has nothing to pay against |
| A **few suppliers carrying debt** from an opening balance | An account that owes more than it earned is the state a payout run must never turn into a negative bank line, and nothing else in the fixture reaches it — the credit instalments are capped as a share of the gross precisely so a facility cannot swallow a month |
| A handful of suppliers marked **`bankTransfer` with no account on file** | The real case AC-04's `missingBankDetails` exception is about (the office recorded a transfer and never got the passbook), and the only way M6's `held` status happens. A status nothing in the fixture reaches is a status nobody notices is broken |
| Payout runs in **all three states** — `completed`, `approved` part-worked with a failed line, `draft` | Each is a different set of available actions, and none of them should need creating before it can be seen |
| A **savings ledger derived from the published bills**, with the registry's `savingsBalance` recomputed from it | M2's detail page and M8's account row must be one number, not two (AC-01) |

The **deduction values are the mock's invention and the shape is not** — see
status.md gap 6. `savings` (kilos × the supplier's rate) and `previousDebts` (last
month's shortfall) are real derivations the API must reproduce; the other seven lines
stand in for §21.10, which nobody has answered.

### News and static content — AC-08 in the fixture

Five articles and the app's six fixed pages, and the middle three articles are the reason
the fixture exists rather than decoration:

| Fixture | State | Why |
| --- | --- | --- |
| `nws-1` | Live, all three languages | The good case, and the only one that proves a translated preview is *not* a fallback |
| `nws-2` | **Live, no Sinhala or Tamil** | AC-08 itself: it is out there, a Sinhala supplier is reading English right now, and the office should see that from the list without opening anything |
| `nws-3` | **Live, Sinhala and Tamil stale** | The English was corrected *after* both were written. The app renders them happily, so nothing looks wrong anywhere — the failure only this screen can catch |
| `nws-4` | Draft, English only | The normal half-finished state |
| `nws-5` | Archived | So archive is visible without anybody creating it |
| `faq` | Live, all three | **AC-11 is about the FAQ**, and a criterion whose fixture is half-written cannot be signed off |
| `savingsScheme`, `about`, `terms`, `privacy` | Live, English only | What a factory that has just gone live actually looks like |
| `creditTerms` | **Never written** | The app falls back to its bundled default. A state the office must be able to see rather than mistake for a page it already filled in |

**The Sinhala and Tamil copy has not been reviewed by a native speaker** (status.md gap
19). It is real script rather than Latin placeholders on purpose — the `[lang="si"]` and
`[lang="ta"]` rules in §20.2 cannot be exercised by English three times over — but it is
approximate, and it must be replaced before the console is shown to the factory.

Gaps are **never stored**. `missingLanguages` and `staleLanguages` are derived when a
record is serialised, against the *requesting tenant's* `contentLanguages` — the same
reason `stale` is not stored on a bill run. Galaboda authors in si/en/ta and highland in
en/ta, so the two see different gaps on the same page, which is what the AC-08 tenant test
asserts.

### Devices and notifications — the opt-outs are the fixture

A fixture where every device accepts everything cannot demonstrate the one push rule that
matters (*honour each device's opted-in categories, not only its topic subscription*), so
this one is built around consent:

- **one supplier in five has no device at all** — they never installed the app, and the
  office needs that number separated from the opt-outs;
- every device starts from the tenant's `defaultCategories`, which **excludes
  `newsArticle`** — so a news push reaches far fewer phones than a bill does, and that
  asymmetry is the platform's existing decision rather than one invented here;
- one in seven has turned `newsArticle` back on and one in eleven has turned
  `billPublished` off, because both are things people do;
- a few carry two devices, which is why reach counts **devices** and an audience counts
  **suppliers**.

The triggers default from `push.defaultCategories` for the same reason: it is the closest
thing to an answer to §21.24 already in the codebase. Three sends seed the log — two
automatic and one composed to a single collection point, the last with 3 reached against
11 opted out, which is the figure that tells an office a push was the wrong channel.

### Tenants — 3

`galaboda` (full), `hillcountry` (full, different palette and radius — and **push turned
on with no `push` block at all**, which is a real state rather than an oversight: the flag
being on and the module being configured are different things, and M13 answers
`push-not-configured` for it), and
**`highland` — the reduced-feature reference**: no loans, no manure, no push, no
reports, no payouts, **no news**, and it authors content in English and Tamil only, mirroring mobile's `clientB`.

`highland` is what makes AC-07's second half assertable, and it now covers two
modules rather than one:

- `enablePayouts: false` — the sidebar loses the row **and**
  `GET /admin/payout-runs` answers `403 feature-disabled`.
- `enableLoans: false` and `enableManure: false` — the credit queue still **opens**,
  because the factory does lend against leaf, and it serves only advances. A loan
  reached by its own URL answers `403 feature-disabled` rather than merely being
  unlisted, and the facility filter offers only what the factory sells.

That second case is the more interesting one: M7 is a single screen over three
independently-sold facilities, so the row is gated on **any** of the three flags
rather than on advances alone. Gating it on `enableAdvances` would have hidden the
queue from a factory that lends against income history and not against leaf.

**Every flag now has an off-tenant on demand**, which retired the old "`enableInquiry` is
`true` on all three tenants, so its half of AC-07 is unasserted" caveat. Since M14 the
configuration screen writes to live state and `featureGate` reads it, so a test turns the
flag off *through the console* and replays a clerk's existing token — the mechanism a factory
would actually use, rather than a fourth fixture tenant invented to be assertable. A fixture
tenant is still the better demonstration (`highland` shows a reduced-feature console on
arrival); a config edit is the better test.

Switching to `highland` in the dev tenant switcher should visibly empty those rows
out of the sidebar. It is the fastest check that no surface is hardcoded, and a
Playwright spec asserts it.

---

## Two honest caveats

**1. Writes do not survive a reload.** State lives in module scope — the same
property the mobile app's `mockDb` has (status.md §10 item 6). A feature for a demo
(the fixture is always the same) and a trap in a manual test. Stated here rather
than discovered.

`resetMockState()` exists for Vitest, where module state persists across files and
a decided request leaking into the next case would make failures order-dependent.

**2. `POST /admin/auth/refresh` has no rotation or reuse detection.** The real
implementation reads a *rotating* httpOnly cookie; the mock stands in with a
`sessionStorage` entry holding a mock user id.

That stand-in matters more than it sounds. The console holds its access token in
memory by design, so a fresh document has none and must recover the session from
the refresh cookie. Without something that survives a reload, **every browser
refresh and every deep link bounced the developer back to sign-in** — the console
behaving correctly against a mock that could not answer. `sessionStorage` is the
closest honest analogue: scoped to the tab, cleared on close, cleared on sign-out,
and holding no credential. A Playwright spec covers reload, deep-link and
sign-out-then-reload.

What still cannot be tested here is **token rotation and reuse detection**
([api-contract.md](./api-contract.md) §2.3). Those need the real backend.

---

## Leaving the mock behind

```bash
VITE_USE_MOCK=0
VITE_API_BASE_URL=https://api.your-real-host.lk/v1
```

That is the whole change. `assertEnvUsable()` refuses a production build with mocks
on, and the MSW chunk is eliminated from production entirely — the guard is
`import.meta.env.DEV && env.useMock`, so Vite drops the branch rather than shipping
a ~300 kB chunk nobody loads.

**When a real shape differs from the contract**, the seam that absorbs it is
`services/repositories/`. Map it there and tell the backend developer; do not
reshape `@tfd/domain`'s types to match a temporary backend quirk, because those
types are also the app's and the API's.

The mock is worth keeping after the API lands — as the test fixture, and as the way
to develop offline or against a broken staging environment. `services/mocks/` is
excluded from nothing except the production bundle.
