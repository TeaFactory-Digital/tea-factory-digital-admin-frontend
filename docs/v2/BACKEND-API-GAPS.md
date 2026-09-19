# Backend API gaps: admin console and supplier app

**For:** the backend developer, `tea-factory-digital-backend`
**From:** the two frontend integrations
**Verified against:** backend `abf325a`, in **two** environments.

1. **Local**, API on `:3000`, Postgres and Redis in Docker, `npm run setup`, a `galaboda`
   tenant, an administrator, and a supplier with an app account, eight published bills and
   a manure catalogue.
2. **Your staging deployment**, `https://tfd-api-fja1.onrender.com`, tenant `galaboda`,
   signed in as `admin@galaboda.lk` and as supplier `5708`.

Every API gap below reproduces in **both**. The three **deployment** items are staging
only, and they are the ones stopping the console from using that box at all.

**This file lists only what is still open.** Every status is what the wire actually did,
not what a commit message said.

> **Thank you: eight of the ten open gaps are closed, and both frontends are now
> integrated against the closed versions.** G-12a, G-20, G-21, G-22, G-23, G-24, G-27 and
> G-28 are gone from this file; they are in its git history if the reasoning is ever
> needed. `app-wire.ts` and `app-parity.spec.ts` are the right mechanism, and they found
> things neither side had spotted.
>
> **Both frontends changed to match**, because several of your fixes made the app's old
> workarounds wrong rather than merely redundant. See *What the frontends changed* below.
> Nothing in either repo works around a closed gap any more.

---

## What is still open

| | Gap | Realm | What it costs today |
|---|---|---|---|
| 🔴 | **D-01** `CORS_ORIGINS` is unset on staging | console | **No browser can reach the API.** The console is completely blocked on that box |
| 🟠 | **D-02** the cold start outlasts both clients' timeouts | both | First request after an idle period always fails, on a free Render instance |
| 🟠 | **G-31** manure `amount` is still honoured if the client sends one | app | A price the phone chose is believed over the factory's, so **G-20's guarantee is opt-in** |
| 🟠 | **G-30** `PUT /devices` `500`s on an unknown notification category | app | A client bug reads as "the server is broken", on the one write every session makes |
| 🟡 | **G-21a** four fields are on the wire and not in `CreditEligibility` | both | `interest`, `hasRequiredHistory`, `installmentOptions`, `pendingRequestId`: all used, none typed |
| 🟡 | **G-32** `PUT`/`PATCH /devices` omit `id` and `registeredAt` | app | `GET /devices` has both; the writes answer a partial row |
| 🟡 | **G-25** `null` served as an empty body | app | Adapted with `\|\| null` at both call sites |
| 🟡 | **G-26** `GET /bills/{month}` 404s where the app expects `null` | app | Adapted |
| 🟡 | **D-03** the staging factory has no credit rules, manure catalogue or packet policy | both | Three flag-enabled facilities cannot complete a request on staging |

**D-01 first, ahead of everything else in this file.** It is a dashboard setting rather
than code, and until it is set the console cannot make a single call to staging. After
that, G-31 is a one-line change and it is about money, and G-30 is the same species as the
R1 uuid fix you already shipped. The rest are recorded so the wire and the shared types can
be reconciled, not because anything is broken.

---

# Deployment

Three things about `tfd-api-fja1.onrender.com` specifically. None of them is a defect in
the code; all three stop the staging box doing the job it exists for.

## 🔴 D-01: `CORS_ORIGINS` is unset, so no browser can reach the API

```
GET /v1/config              Origin: http://localhost:5273
  → 200, vary: Origin,  and NO Access-Control-Allow-Origin        ← browser discards it

OPTIONS /v1/admin/auth/login  Origin: https://tfd-console.vercel.app
  → 404, no CORS headers at all                                   ← preflight fails
```

Tried from `http://localhost:5273` (the console's dev origin) and from a Vercel-shaped
origin. Both identical. The preflight `404` is the harder half: every console request
carries `Content-Type: application/json`, `X-Tenant` and `Authorization`, so **none of
them is a simple request** and all of them are blocked before they are sent.

`render.yaml` says exactly why, and it is deliberate:

> ```yaml
> # Empty until the console is deployed. Empty means NO browser origin is allowed,
> # which is the safe default [...]
> - key: CORS_ORIGINS
>   sync: false
> ```

`sync: false` means it is set by hand in the Render dashboard, and it has not been. That
is the right default and it is also the last thing standing between the console and this
deployment. The mobile app is unaffected, because a native client sends no `Origin`, which
is why driving both realms with curl looked completely healthy.

**The rest of the cross-site work is already correct**, which is worth saying because it
means this really is one setting:

```
set-cookie: tfd_refresh=…; Path=/v1/admin/auth; HttpOnly; Secure; SameSite=None
set-cookie: tfd_csrf=…;    Path=/v1/admin/auth;           Secure; SameSite=None
```

`SameSite=None`, `Secure`, refresh `HttpOnly` and the CSRF token readable, scoped to the
auth path. `COOKIE_MODE=cross-site` is set in the blueprint and `assertCookieTopology`
agrees with it. `enableCors` in `configure-app.ts` already allowlists every header the
console sends (`Authorization`, `Content-Type`, `X-Tenant`, `Idempotency-Key`,
`If-None-Match`, `X-CSRF-Token`) and already sets `credentials: true`. So this really is
one variable.

**What to set**, in the Render dashboard on the `tfd-api` service, comma separated with
no trailing slash (`configure-app.ts` splits on `,` and trims):

```
CORS_ORIGINS=http://localhost:5273
```

Add the deployed console origin beside it when there is one:

```
CORS_ORIGINS=http://localhost:5273,https://<the-console-host>
```

`http://localhost:5273` is worth including permanently, not just as a stopgap. It is the
console's dev-server origin, and it is how either of us drives a real browser against
staging.

A redeploy is needed for the change to take, because the value is read at boot.

### What we did in the meantime

The console now has `npm run dev:staging`, which routes `/v1` through a **Vite dev
proxy** to this box. The page calls `localhost`, which is same origin, and Vite forwards
the request from Node where CORS does not apply. That is a workaround for our own
testing, not a fix and not a substitute: it only exists on a developer's machine, and a
console deployed anywhere still cannot call this API until `CORS_ORIGINS` is set.

Driven through that proxy, the whole cross-site chain works against staging: sign-in,
`Set-Cookie`, a CSRF-protected refresh that returns a new access token, and a refresh
**without** the `X-CSRF-Token` header correctly refused with `403 forbidden`
`{"reason":"csrf"}`. So the server side of this is already right, and D-01 is the only
thing in the way.

## 🟠 D-02: the cold start outlasts both clients' timeouts

Measured on the first request after the instance had been idle:

```
GET /health  →  200 in 32.9s
```

Against:

| Client | Timeout | Result on a cold instance |
|---|---|---|
| Console | `VITE_API_TIMEOUT_MS=20000` | fails |
| Mobile | `timeoutMs: 15000` | fails, and shows *"The factory did not answer in time."* |

A free Render instance sleeps after inactivity, so **the first person to open either
client after a quiet period always gets an error**, and a retry then works. That reads
exactly like an intermittent backend fault and it will be reported as one.

Not asking you to change the timeouts: 15 and 20 seconds are right for a rural connection
and raising them to 35 would make every genuine failure take 35 seconds. Either a paid
instance that does not sleep, or a keep-alive ping, or simply everyone knowing that the
first request wakes the box. Worth agreeing which, so it is not diagnosed twice.

## 🟡 D-03: the staging factory has no credit rules, catalogue or packet policy

`GET /v1/config` on staging:

```json
{ "creditRules": null, "manureProducts": null, "teaPackets": null,
  "theme": null, "branding": null, "push": null,
  "flags": { "enableLoans": true, "enableManure": true, "enableTeaPackets": true, … } }
```

The flags are all **on** and the configuration behind three of them is absent, so those
facilities are reachable and cannot complete:

- **Manure** cannot be priced at all. `priceManure` reads `manureProducts`, finds nothing,
  and answers `422 manureType not in this factory's catalogue`. It is hidden right now only
  because the history rung fires first (`409 manure-history-short`); give the supplier six
  settled months and every manure request on staging starts failing.
- **Tea packets** always report *"the factory has not set a price"*. Correct behaviour for
  `policy: null`, and it means the screen can never be exercised past that state.
- **Credit rules** are `null` while `installmentOptions` still comes back populated
  (`[3…12]` for loans, `[1…6]` for manure), so those are platform defaults rather than this
  factory's.

The supplier also has no bills, so every credit ceiling is `0` and every facility answers
`shortHistory` or `noSettledRate`. Nothing past a refusal ladder can be tested on staging
as it stands.

Not a code problem, and the "no invented suppliers" instinct in `staging.ts` was right. But
a box meant for driving real clients needs enough data to reach a success path. A handful
of published bills, a two-line manure catalogue and a tea-packet policy on the seeded
factory would make the whole supplier app reachable.

---

---

# API gaps

Everything below reproduces on **both** the local box and staging.

## 🟠 G-31: the server prices manure unless the client would rather it did not

**This is the one that matters, and it is one line.**

`credit.controller.ts` line 650:

```ts
const amount = body.amount ?? (await this.priceManure(tx, actor.factoryId, facility, body));
```

`priceManure` is a **fallback**, not a rule. A client that sends its own `amount` is
believed, and nothing downstream re-prices: `priceManure` has exactly one call site, and
the approval path reads the stored figure.

**Driven on a live server**, supplier with eight published bills, catalogue
`{ name: 'Urea', packKg: 50, pricePerPack: 4900 }`:

```
POST /manure-requests {"manureType":"Urea","quantityKg":100,"installmentMonths":3}
  → 201  "amount": 9800      ← two bags, priced by you. Correct.

POST /manure-requests {"amount":1,"manureType":"Urea","quantityKg":100,...}
  → 201  "amount": 1         ← 100 kg of urea, for one rupee.
```

The app no longer sends `amount`, so nothing exploits this today. It still matters for two
reasons.

**The staleness G-20 was about is not actually closed.** Your own reasoning was that *"a
price the client computed is a price from whenever that client last loaded the config"*,
and an app build already on a phone **is still sending its computed price**. Phones update
when their owner allows it. The server redeploying does not retire those builds, and while
`amount` is honoured they keep pricing their own requests from whatever catalogue they
last saw.

**It is a client-controlled figure that becomes a debt.** Not a privilege escalation,
since the supplier is asking for *less*, but it is a number that lands on a credit account
from the one place in this system where a guess moves money, and the ceiling check
(`amount > answer.available`) passes trivially for a small one.

**Suggested fix**, in the spirit of the tea-packet `unitPrice` rule you already cite:

```ts
const amount =
  facility === 'manure'
    ? await this.priceManure(tx, actor.factoryId, facility, body)
    : (body.amount ?? throwMissingAmount());
```

Refusing a manure body that carries `amount` would also work and is louder, but it breaks
every app build in the field, which is the sequencing lesson from your own `.strict()`
commit. Ignoring the field does not.

---

## 🟠 G-30: an unknown notification category answers `500`, where an unknown platform answers `422`

Same family as **R1**, the mistyped-uuid finding you closed with `UuidParamPipe`: a client
mistake reported as a server fault.

```
PUT /devices {"token":"…","platform":"blackberry","categories":["billPublished"]}
  → 422 invalid  {"path":"platform","message":"expected one of \"ios\"|\"android\""}   ✅

PUT /devices {"token":"…","platform":"android","categories":["nonsense"]}
  → 500 internal {"code":"internal","details":{"requestId":"39228781-…"}}              ❌
```

The log:

```
PrismaClientValidationError
  Invalid `tx.device.upsert()` invocation … devices.controller.ts:101
  Invalid value for argument `categories`. Expected NotificationCategory.
```

**Reproduced on staging as well**, so it is not an artefact of the local build.

`platform` is a `z.enum` and `categories` is not, so the array reaches Prisma unvalidated
and the enum rejection surfaces as an uncoded `500`. That is the one code meaning *we are
broken*, which in production is what pages somebody at night.

**Why this endpoint in particular.** `useNotifications.sync()` calls `PUT /devices` on
every sign-in and again on every token rotation. It is the most frequently called write in
the app, and it runs inside a `useEffect` where nothing surfaces the failure to the
supplier. It would therefore arrive as a `500` rate in your logs with no user report
attached to it.

Both sides agree on the four values (`billPublished`, `requestDecided`, `newsArticle`,
`inquiryReplied`), so this is not a live mismatch. It is the absence of the boundary that
would make a future one legible. **A `z.enum([...])` on `categories`** closes it.

---

## 🟡 G-21a: four fields are on the wire, used by both clients, and in neither shared type

G-21 is otherwise closed. `withAppEligibilityNames` is the right shape, `interest` now has
a source, and the app reads the **domain** names rather than the aliases, so nothing here
depends on the compatibility layer staying.

What `@tfd/domain`'s `CreditEligibility` still does not declare:

| Field | Served by | Read by | Note |
|---|---|---|---|
| `installmentOptions` | supplier realm | app, the whole repayment picker | BR-315: a factory lending over a different span needs no app release |
| `pendingRequestId` | supplier realm | app, withholds the button | a control that `409`s is a control that should not have been offered |
| `interest` | supplier realm | app, advance screen | `0` until a basis is decided, and honestly `0` |
| `hasRequiredHistory` | supplier realm | app, gates the form | derived, but derived *server-side*, which is the point |

All four are declared locally in the app's `endpoints.ts` instead. That works, and it is
exactly the drift ADR-029 is about: a field a shared type does not know exists cannot be
checked against anything.

**One narrower thing in the same payload.** `withAppEligibilityNames` coerces
`averageMonthlyIncome` through `orZero`, so the **supplier** realm serves `0` where the
type says `number | null` and BR-102 says *never `0`*. The **console** realm calls
`forSupplier` raw and still gets `null`. This is harmless today: the app gates on
`hasRequiredHistory` and never prints the zero as an income, and AC-05's load-bearing
figures (`ceiling`, `outstanding`, `available`) come from one function and do match
byte-for-byte. But one documented `null` contract is now false on one of the two realms,
and that is the sort of thing which stays true only until somebody reads the type.

---

## 🟡 G-32: the device writes answer a partial row

`GET /devices` carries `id` and `registeredAt`. Thank you, that was G-09's sibling and it
is fixed. The two writes did not follow:

```
GET   /devices            → {"id":"26d76e30-…","token":"…","platform":"android",
                             "categories":[…],"registeredAt":"2026-09-19T13:47:50.898Z"}   ✅
PUT   /devices            → {"token":"…","platform":"android","categories":[…]}            ← no id, no registeredAt
PATCH /devices/{token}    → {"token":"…","platform":"android","categories":[…]}            ← same
```

The app declared `RegisteredDevice` for all three, which was a lie about two of them. It
now declares a `DeviceAck` for the writes. Nothing reads either response
(`useNotifications` awaits both and discards them), so this was a type defect rather than
a blank screen. Worth making the three agree so it stays that way.

---

## 🟡 G-25: `null` is served as an empty body

Unchanged, and still worth a one-liner. `GET /bills/current` and `GET /banners/active` are
both documented as answering `null` rather than `404`, which is the right decision. Nest
serialises a `null` return as an **empty body**:

```
GET /banners/active?lang=en

HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
Content-Length: 0
```

No `Content-Type`, no `null` literal. axios hands an empty body over as `''`, so a caller
comparing `bill === null` gets an empty string, and the declared type
`GreenLeafBill | null` is a lie about what arrives. `GET /bills/current` behaves the same
way on a supplier with no bills; once one exists it correctly answers the bill, so the
empty body is reachable only in the state the `null` was designed for.

Worked around with `|| null` at both call sites. An explicit `res.json(null)`, or a small
interceptor, would let the type mean what it says.

---

## 🟡 G-26: `GET /bills/{monthKey}` 404s where the app expects `null`

Unchanged. `GET /bills/current` answers `null` for "no account yet", while
`GET /bills/{monthKey}` throws `404 not-found` for the same situation one month over:

```
GET /bills/2025-03  →  404 {"code":"not-found","details":{"entity":"bill","monthKey":"2025-03"}}
```

A month the supplier *does* have a bill for answers `200` with the bill, as it should. The
disagreement is only about the empty case.

The app's contract is `GreenLeafBill | null` for both, and a month a supplier simply did
not supply into is an ordinary state: the picker offers every month of the year. The app
translates `not-found` to `null` and lets every other refusal through, so a `403` still
surfaces rather than showing an empty screen. Worth making the two endpoints agree.

---

## Open, and no change requested

Recorded so the shared types can be reconciled one day, not as work:

- **G-05.** Bank reveal answers `{ accountNumber, auditId }` and stays minimal. The right
  call for the one endpoint that hands over an account number; the console passes bank and
  branch in from the record it already has.
- **G-11.** Mutations acknowledge with `{ id }`. The console invalidates and refetches
  anyway, and its types now say so.
- **G-09** *(partly)*. The notification log is paged; `/admin/users` and `/admin/banners`
  are still bare arrays. Fine at office scale, where both lists are small by construction.
- **G-01.** No `POST /admin/suppliers`. The register is replicated from the factory's own
  system and no v2 screen creates one.
- **G-13.** Deliveries, months, rates and payouts unimplemented. Cut from this console
  deliberately; the factory's own system runs them.
- **G-18.** `GET /config` sends `slug` and `factoryId` where `RuntimeConfig` says
  `tenantId`. The console resolves the tenant from the subdomain, so nothing breaks.

## Deferred by your decision, and agreed

- **G-02.** `POST /admin/users` requires a password `ConsoleUserDraft` has no field for.
  *"Needs a product decision, not code."* The console mints one and prints it once.
- **G-03.** `GET /admin/auth/me` returns a thin identity. The console bootstraps from
  refresh and no longer calls it, so there is no reader to serve.
- **G-07.** News and banner create read a flat body where the shared drafts carry
  `translations`. *"Should be decided once for both resources."*

## One question back, on a rule rather than a shape

**Tea packets are now capped per month, and the console still labels the figure
per-request.** You flagged this as a product decision and chose the stricter reading,
which is the right default: a cap that can only refuse more than the screen promised is
safe. The app now reads `maxPacketsPerMonth`, `requestedThisMonth` and
`remainingThisMonth` straight off `/tea-packets/info`, so it agrees with enforcement
either way.

What the **console** shows is the other half. M18 and M14 label `maxPacketsPerRequest`
with per-request copy, and it is now enforced per month. We have left the console copy
alone rather than guess. Tell us which the factory wants, one figure relabelled or a
separate monthly cap alongside the per-request one, and the console follows in an
afternoon.

---

## What the frontends changed

Recorded because several of these were **not** optional: your fixes made the previous
workarounds wrong, and both apps would have been broken against `abf325a` without them.

### Supplier app: was broken, now fixed

| | What it sent | What `abf325a` reads | Was |
|---|---|---|---|
| change request, `paymentMethod` | `paymentMethod` | `method` | **`422`, every payment-method change dead** |
| change request, `address` | top-level `homeAddress` / `estateAddress` | nested `address` | **`422`, every address change dead** |
| change request, `bankDetails` | *refused client-side* | `bankDetails: { bankName, branchName, accountNumber }` | **feature unreachable for no reason** |

`.strict()` is why the first two were loud rather than silent, which is the outcome
everyone wanted. It does mean the app had to ship with the server, which is worth noting
for next time: an additive alias, which is what you did for `installmentMonths`, can land
ahead of the client. A rename plus `.strict()` cannot.

### Supplier app: workarounds removed

- **Manure** no longer prices client-side and no longer sends `amount`. `deliveryNotes`
  travels under its own name instead of being folded into `reason`.
- **Loans** send `installmentMonths` and stop renaming it. One name only, never both:
  your `.refine()` refuses a body carrying two, and it is right to.
- **Tea packets** read the count off `/tea-packets/info`. The second `GET /tea-packets`
  and the device-month derivation are gone. That also removed a real defect, because a
  handset outside Asia/Colombo counted the allowance into the wrong month around midnight
  on the 1st. Your Colombo-time count fixed it for free.
- **Savings** reads `thisMonth`, `previousBalance` and `toDate` instead of deriving them
  from the last two ledger rows. The headline stays your `balance`.
- **Advance** reads `interest` instead of hardcoding `0`.
- The `bank-change-unavailable` refusal code and its three translations are deleted.

⚠️ **One inherited weakness worth knowing about**, since it is now yours: `thisMonth` is
the **newest ledger entry's movement**, not a sum over the calendar month, so it reads `0`
when nothing was posted rather than when nothing was saved. That is exactly what the app
used to do and you reproduced it faithfully. Flagged only because the name now sits on
your side of the wire.

### Admin console: was broken, now fixed

**The dashboard trends.** Camel-casing them server-side was the right call, and it is a
breaking change: the console mapped `row.month_key` and `row.app_share`, so both charts
would have rendered `undefined` for every point. The mapper is deleted; the sort stays.

The mock fixture reproduced the snake_case rows *and* sent `total` as a plain `number`
where you sent a `bigint`, which is precisely why a green console suite said nothing about
an endpoint that was answering `500`. That fixture now matches the real payload.

Nothing else on the console side moved. `/admin/reports/:id` to `:report` is the same wire
path, and `note-required` on the withdrawal cancel is already handled: the console has no
withdrawal screen, and the code is surfaced correctly everywhere else it appears.

---

## Local setup

```bash
# backend
npm install                 # prisma generate runs on postinstall
cp .env.example .env
npm run setup               # db:up + db:migrate + db:seed:dev
npm run dev                 # -> http://localhost:3000/v1

# console
npm run dev                 # -> http://localhost:5273
```

⚠️ **`db:seed:dev` creates no supplier with an app account**, so nothing in the supplier
realm can be driven from a clean database without hand-writing one. The eight bills and
the manure catalogue this round needed were hand-seeded too. A `db:seed:app`, giving one
supplier, an app account with a printed password, a few published bills and a catalogue,
would make the supplier realm reproducible the way `db:seed:dev` already makes the console
realm.

Also worth knowing: **`idNumber` on `POST /auth/login` carries the supplier *code*, not
the NIC** (Q16). It is documented in `supplier-auth.service.ts`, and it is not where a
reader looks first.

**Both frontends talk only to the real API.** The console's in-browser mock and the mobile
app's fixture layer are gone from the runtime; their fixtures survive for the test suites
alone and answer exactly what your handlers answer. A green test run means the frontends
agree with *this* API, not an idealised one.

---

## How each item was checked

Driven against a live `abf325a`, not read off a diff. Local means Docker on `:3000`;
staging means `tfd-api-fja1.onrender.com`. Blank means the check was not run there.

| Checked | Result |
|---|---|
| `GET /admin/dashboard`, 4 change requests present | **`200`**, G-12a closed |
| `adoptionTrend` / `intakeTrend` | `{monthKey, appShare}` / `{monthKey, totalKgs}`, no `total`, closed |
| `POST /change-requests` `{type:'address',address:{…}}` | `201`, closed |
| `POST /change-requests` `{type:'address',address:{}}` | **`422`**, the silent-accept rung is gone |
| `POST /change-requests` `{type:'paymentMethod',method:…}` | `201`, closed |
| `POST /change-requests` `{type:'bankDetails',bankDetails:{…names}}` | `201`, G-28 closed |
| `POST /manure-requests` no `amount`, 100 kg of a 50 kg @ 4900 product | `201` **`amount: 9800`**, G-20 closed |
| `POST /manure-requests` `{"amount":1,…}`, same 100 kg | **`201` `amount: 1`**, **G-31** |
| `POST /loans` `{installmentMonths}` | clears the schema, G-23 closed |
| `GET /advances\|loans\|manure/eligibility` | domain names plus `interest` and `hasRequiredHistory`, G-21 closed |
| `GET /savings/summary` | `thisMonth`, `previousBalance`, `toDate` and the withdrawal view, G-22 closed |
| `GET /tea-packets/info` | policy plus `requestedThisMonth` and `remainingThisMonth`, G-24 closed |
| `GET /inquiries` | status `pending`, `reply` alias present, closed |
| `GET /devices` | carries `id`, closed |
| `PUT /devices` bad `platform` / bad `categories` | `422` / **`500`**, **G-30** |
| `PUT`/`PATCH /devices` response | no `id`, no `registeredAt`, **G-32** |
| `GET /admin/suppliers/not-a-uuid` | `404 not-found`, R1 confirmed fixed |
| `GET /bills/current`, `GET /banners/active`, no rows | `200` with `Content-Length: 0`, **G-25** |
| `GET /bills/2025-03` with no bill | `404 not-found`, **G-26** |

And on staging specifically:

| Checked | Result |
|---|---|
| `GET /v1/config` and `OPTIONS` preflight, from two browser origins | no `Access-Control-Allow-Origin`, preflight `404`, **D-01** |
| `POST /v1/admin/auth/login` `Set-Cookie` | `SameSite=None; Secure; HttpOnly` plus a readable `tfd_csrf`, correct |
| `GET /health` on an idle instance | `200` in **32.9s**, against client timeouts of 20s and 15s, **D-02** |
| `GET /v1/config` `creditRules` / `manureProducts` / `teaPackets` | all `null` while the flags are on, **D-03** |
| `PUT /v1/devices` with a bad category | `500 internal`, **G-30** reproduced off the local box |
| the 25 other contract checks | identical to local |

**State of both frontends against this API.**

- **Console:** typecheck clean, lint clean, production build clean, **403/403 tests pass**.
- **Mobile:** typecheck clean, **140/140 tests pass**, lint back to its 4 pre-existing
  errors, all in screens untouched by this work.
- **A live contract probe** over both realms, asserting the exact fields each frontend now
  reads: **27/27 against local Docker**, and **25/30 against staging**. The five staging
  failures are the four CORS checks (D-01) and G-30. Every contract check that passes
  locally also passes on staging.

⚠️ **The console has not been driven against staging in a browser**, because D-01 makes
that impossible. Its staging verification is curl-level only. As soon as `CORS_ORIGINS`
includes the console origin we will point it at that box and walk all 11 screens.

> **The console suite's flakiness is gone.** Last round it produced 0 to 19 timeout
> failures on identical code. It has run clean since. If it returns, it is the vite-node
> module-resolution problem described previously and not a contract break.

**Not exercised:** savings ledger entries, delivery rows and payout lines. The hand-seeded
bills gave credit history but no ledger and no `leaf_deliveries`, so `intakeTrend` and the
savings ledger answered correctly over empty collections and nothing more.
