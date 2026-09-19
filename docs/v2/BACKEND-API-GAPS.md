# Backend API gaps: admin console and supplier app

**For:** the backend developer, `tea-factory-digital-backend`
**From:** the two frontend integrations
**Verified against:** backend `0c43b39`, driven on your staging deployment
`https://tfd-api-fja1.onrender.com`, tenant `galaboda`, as supplier `5708` and as both
`admin@galaboda.lk` and `manager@galaboda.lk`.

> ## Nothing in this file is blocking.
>
> **Every gap is closed.** All eight from the last round were verified on the wire, not
> read off your summary, and both frontends have had their workarounds deleted rather
> than left in place around a fixed server.
>
> What is left below is one item waiting on a re-vendor, one rule that follows from a
> product answer that has now come back, **the upload contract for O1 now that both
> frontend halves are built**, and the standing list of shapes both sides have agreed not
> to change. The tea-packet question is answered too: **per month**, which is what you
> already enforce.

---

## Still open

| | Item | Owner | State |
|---|---|---|---|
| 🟡 | **G-21a** four fields undeclared in `@tfd/domain` | ours, then yours | **Declared. Re-vendor when you like.** |
| 🟠 | **G-02a** a console user does not owe a password change | yours | The office now sets the first password, so staff should be held to BR-008 like suppliers |
| 🟠 | **O1** uploads: bucket, three endpoints, and news `PATCH` | yours | **Both frontend halves are built and waiting.** Contract below |

### G-21a: the four fields are now declared

You were right that this one was ours. `packages/domain/src/types/admin.ts` in this repo
now declares all four on `CreditEligibility`:

```ts
installmentOptions: number[];
pendingRequestId: string | null;
interest: number;
hasRequiredHistory: boolean;
```

Each carries a docblock saying why it exists, so the reasoning survives the vendor copy.

**One thing to look at before you re-vendor**, because it changes a signature rather than
only adding fields. Three of the four cannot come from `buildCreditEligibility`:
`installmentOptions` is configuration, `pendingRequestId` is a query, and `interest` is
the newest bill's carry-forward. The builder is pure and clock-free, which is exactly why
AC-05 holds, so it should not be reaching for any of them.

So the builder now returns a named subset and the server composes the rest, which is what
your controller already does:

```ts
export type CreditEligibilityWorking = Omit<
  CreditEligibility,
  'installmentOptions' | 'pendingRequestId' | 'interest'
>;

export function buildCreditEligibility(…): CreditEligibilityWorking
```

`hasRequiredHistory` stayed **inside** the builder, because it is just the two counts it
already has, and deriving it once is the point.

Your `withAppEligibilityNames` should type-check against this unchanged. If the drift
check complains, it will be about that return type rather than the fields.

### G-02a: the decision came back, and it leaves you one change

**The factory's answer is that the office sets the first password.** Not an invitation
email, which settles it the only way this system can actually deliver: an invitation needs
a mail sender and there is not one, so a flow built on it is a flow that never delivers an
account.

**Our half is done.** `ConsoleUserDraft` in `@tfd/domain` now declares `password`, so the
shared type finally describes the body you have always required. The console used to
splice that field in at the endpoint, which meant the type documented a request nobody
sends. It still mints the value rather than letting an administrator type one, and that
part is deliberate: a first password chosen by one person for another is chosen to be easy
to say down a corridor.

**Your half is the rule that should follow from it.** A console user created today does
**not** owe a password change on first sign-in, where a supplier does (BR-008). That
asymmetry was defensible while the question was open. It is not now: the office setting
the credential is precisely the case BR-008 exists for, and it is the one password the
holder did not choose and may never change.

Staff should be held to the same rule as the farmers. You flagged this yourself in
`questions-we-need-answered.md`, and the answer has arrived.

### Tea packets: answered, and it is per month

**The factory has confirmed the allowance is per calendar month.** Your monthly
enforcement stands as it is, no code change, no second configured figure. You picked the
stricter reading before the answer came back and it turned out to be the right one.

The console copy is updated to match, in all three languages:

- `config.teaPackets.maxPerRequest` is renamed `maxPerMonth`, and the label now reads
  *"Most packets in one month"*.
- The hint says the factory allows that many packets **per supplier per calendar month**.
- `teaPackets.problem.over-max` says the request exceeds the whole month's allowance.
- The `bad-max` save refusal says *monthly limit* rather than *limit per request*.

**The stored field keeps its name.** `maxPacketsPerRequest` is what `client_config` and
the wire call it, and renaming a column to settle a wording question is not worth a
migration. Both sides now carry a docblock saying the name says request and the rule is
month, so the next reader does not have to rediscover it.

One thing worth stating, since it is now a documented asymmetry rather than an accident:
`teaPacketRequestProblems` in `@tfd/domain` checks a **single request** against the monthly
cap, so it catches only the unambiguous case of one request exceeding the whole month's
allowance. It cannot see what the supplier has already taken, because that needs a query a
pure function does not get. Your `tea-packets-over-limit`, with `requestedThisMonth` and
`remainingThisMonth`, is the real check. A clean result from ours is the cheap half, run
before a round trip, and not a promise of approval.

The app needed no change: it already read `maxPacketsPerMonth`, `requestedThisMonth` and
`remainingThisMonth` off `/tea-packets/info`, and its copy has always said *"this month"*.

---

## Fixed in `0c43b39`, verified on the wire

Driven against staging, not taken from the commit message.

| Gap | Check | Result |
|---|---|---|
| **D-01** CORS | `OPTIONS /v1/admin/auth/login`, `Origin: http://localhost:5273` | **`204`**, origin echoed, `credentials: true`, all six headers allowed |
| **G-31** manure price | `POST /manure-requests {"amount":1,…}` for 100 kg of a 50 kg @ 4900 product | **`201` `amount: 9800`**. The client figure is ignored |
| **G-30** bad category | `PUT /devices` with `categories: ["nonsense"]` | **`422 invalid`**, was `500 internal` |
| **G-32** device writes | `PUT` and `PATCH /devices` | both carry `id` and `registeredAt` |
| **G-25** `null` | `GET /banners/active` with none live | **`200`, literal `null`, `application/json`**, was an empty body |
| **G-26** `/bills/{month}` | `GET /bills/2020-01` | **`200 null`**, was `404 not-found` |
| **G-21a** income | `/loans/eligibility` and `/manure/eligibility` | `9531.66` and `null`. No coerced `0` |
| **D-03** staging data | `GET /config` | credit rules, two manure products, packet policy all present |

**All three credit facilities reach a success path**, which is the thing staging existed
for and could not do before: advance ceiling `13020`, loan `28594.98`, manure `12090`.

**Every console endpoint answers.** Dashboard, credit requests, change requests,
tea-packet requests, inquiries, suppliers, audit and reports as `manager`; users, news,
banners, config, static pages and notifications as `admin`. The one `404` in our first
sweep was our own path error (`/admin/tea-packets` instead of
`/admin/tea-packet-requests`), not yours.

### D-02, the cold start: agreed, and no longer tracked

Accepted on your reasoning. We are pre-users and a 30-second first request is fine. Both
clients raise their timeout for staging alone (45s against 20s and 15s), so a waking
instance reads as slow rather than as a failure, and both notes say to put it back for a
real deployment.

---

## What the frontends deleted

Your fixes made these wrong rather than merely redundant, so none of them survives.

**Supplier app**

- The `|| null` coercion at all three call sites (`billRepository`, `bannerRepository`,
  `newsRepository`). `null` arrives as `null`.
- The `not-found` to `null` translation in `billRepository.getBill`, and the `try/catch`
  around it. A refusal now has no reason to be translated, so a `403` surfaces as a `403`.
- The narrowed `DeviceAck` type. Both device writes are a full `RegisteredDevice` again.
- The note claiming `averageMonthlyIncome` is coerced to `0`, which is no longer true.

**Admin console**

- The Vite dev proxy, and `VITE_DEV_PROXY_TARGET` with it. `npm run dev:staging` calls
  staging directly now, which is the only arrangement that exercises the real preflight
  and the real cross-site cookie.

**A test replaced the two we deleted.** `__tests__/absentRecords.test.ts` pins the new
contract: a null bill, a null month, a null banner and a null article all arrive as
`null`, and a `403` on a bill still throws rather than reading as an absence. It asserts
`toBeNull` rather than `toBeFalsy` on purpose, because `''` is falsy too and telling those
two apart is the whole of what G-25 was.

### One thing we noticed while deleting them

`GET /bills/{monthKey}` answering `200 null` for a month the office has **generated but
not published** is a good decision and worth keeping deliberate. A `404` there against
`null` for a month that was never generated would let a supplier tell the two apart, and
that difference tells them the office has started on their account. It is recorded in
`billRepository` so nobody "fixes" it back into a `404` later.

---

## O1, the object store: the frontends are now built, and here is the contract

**Both frontend halves are written and tested.** The console has a file field on the news
create dialog and the banner editor; the app renders a real cover on the feed and the
article screen, and its banner artwork was already there. What does not exist is the
server half, so every attempt currently ends at a `404` which the console renders as
*"image uploads are not available on this server yet"* rather than as an error.

This replaces the note we sent last round. We said the frontends were not blocked on O1,
which was true then because there was no image UI at all. There is now.

### The three calls

```
POST /admin/uploads/sign
  { filename, contentType, sizeBytes, entity, entityId? }
  -> 201 { attachmentId, uploadUrl, headers?, expiresAt }

PUT <uploadUrl>                      (browser to the store, no Authorization header)
  -> 200

POST /admin/uploads/{attachmentId}/confirm
  -> 200 { id, url, contentType, sizeBytes }
```

`entity` is one of `newsArticle | banner | changeRequest | creditRequest`. `entityId` is
absent when the record does not exist yet, which is the ordinary case: a cover image is
chosen in a create dialog, before the article has an id.

**`headers` matters more than it looks.** S3 and MinIO disagree about which headers a
signature covers, and a client guessing wrong gets a `403` from the store with nothing
readable in it. Send back exactly what the `PUT` must reproduce.

### What the clients send and read, and why they are different fields

The write is an **attachment id** and the read is a **URL**:

| | Write | Read |
| --- | --- | --- |
| News | `coverImageAttachmentId` on `POST /admin/news` | `coverImageUrl` on the article |
| Banner | `imageAttachmentId` on `PATCH /admin/banners/{id}` | `imageUrl` on the banner |

That asymmetry is forced by your own schema rather than chosen. `attachments` has no
`url` column because *"`attachment.url` is a SHORT-LIVED SIGNED GET generated per read"*,
so a console that sent back the URL it was given would be storing a value that expires,
and the app would render a broken image a few minutes later. `@tfd/domain` now declares
both write fields.

⚠️ **Omit means leave alone; `null` means remove.** A patch that cannot tell those apart
blanks the artwork of every banner whose window somebody nudged.

### Two smaller things the flow needs

**`PATCH /admin/news/{id}` has to come back**, at least for the cover image. There is no
way to change an article's cover after creation today: `NewsDraftBody` takes one,
`ContentTranslationBody` has no image field, and `saveTranslation` is the only write.
Your `news.ts` docblock says *"an article's cover image and its copy both move through
`saveTranslation`"*, and that is not accurate, which is worth correcting either way. This
is precisely the case the same docblock anticipates: *"It comes back the day the editor
grows a field that is not copy."* That day has arrived.

**A `confirmedAt`-less row needs a sweeper.** An upload whose connection dropped between
the signature and the `PUT` leaves a reservation. Your schema comment already names the
state; nothing collects it.

### What we refuse client-side, so you know what you will actually receive

JPEG, PNG and WebP only, and **5 MB**. The size is about the reader rather than the
bucket: a cover renders a few hundred pixels wide on a phone, often over a connection that
charges by the megabyte, and a 12 MB photograph straight off a camera looks identical to a
300 KB one. Storage is the cheapest thing in this system and a farmer's data is not.

Checked before signing, so a file that was never going to be accepted does not reserve a
row. Your refusals are still the authority and we never permit anything you would refuse.
Two coded ones would help an editor act: `upload-too-large` and `upload-type`, because a
generic `invalid` on a file picker does not say which file to choose instead.

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

- **G-03.** `GET /admin/auth/me` returns a thin identity. The console bootstraps from
  refresh and no longer calls it, so there is no reader to serve.
- **G-07.** News and banner create read a flat body where the shared drafts carry
  `translations`. *"Should be decided once for both resources."*

---

## Running against staging

```sh
# console
npm run dev:staging       # -> http://localhost:5273, talking to the deployed API
```

The dev server prints its target on startup, so `dev` and `dev:staging` cannot be
confused for one another.

The mobile app points at `https://tfd-api-fja1.onrender.com/v1` from
`src/config/clients/default/index.ts`, so a fresh build signs in with no setup.

⚠️ **The `/v1` suffix is load-bearing for the app** and was missing before this round.
`client.ts` uses `baseUrl` as the axios `baseURL` unchanged and adds no prefix, while
`endpoints.ts` asks for `/auth/login`. Without it every call is a `404`.

Two things about the app worth knowing, neither of them yours:

- **`react-native-config` is not wired into either native build**, so nothing in `.env` is
  read. That includes `APP_CLIENT`, which means per-brand builds have never actually
  selected a brand. Ours to fix.
- **`idNumber` on `POST /auth/login` carries the supplier *code*, not the NIC** (Q16).
  Documented in `supplier-auth.service.ts` and not where a reader looks first. Worth a
  line in `api.md` if that file ever gets one.

---

## State of both frontends

- **Console:** typecheck clean, lint clean, production build clean, **410/410 tests**
  (seven new, covering the upload flow and each of its four refusals).
- **Mobile:** typecheck clean, **145/145 tests** (five new, pinning the `null` contract),
  lint at its 4 pre-existing errors, all in screens untouched by this work.
- **Every closed gap above re-driven against staging** rather than assumed.

**Not exercised:** savings withdrawals through a full approval cycle, and push delivery,
which is still waiting on FCM and APNs credentials (your O2).
