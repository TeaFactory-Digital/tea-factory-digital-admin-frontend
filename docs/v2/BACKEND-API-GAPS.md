# Backend API gaps: admin console and supplier app

**For:** the backend developer, `tea-factory-digital-backend`
**From:** the two frontend integrations
**Verified against:** backend `a953823`, driven on your staging deployment
`https://tfd-api-fja1.onrender.com`, tenant `galaboda`, as supplier `5708` and as
`admin@galaboda.lk`.

> ## Everything from the last round is closed, and verified on the wire.
>
> O1 uploads, G-02a, the news `PATCH`, the savings `thisMonth` fix and the eligibility
> re-vendor were all driven against staging rather than read off your summary. The upload
> flow was exercised end to end against the real R2 bucket, including a byte-for-byte
> check that what came back down the signed GET is what went up.
>
> **Both frontends are updated.** The console now has the office's BR-008 screen, a cover
> image on the article editor, and the `503` refusal handled; the app's stale note about
> `thisMonth` is gone. Details under *What the frontends changed*.
>
> Two new items below, both small, both found by driving the thing rather than reading it.

---

## Still open

| | Gap | Realm | What it costs today |
|---|---|---|---|
| 🟠 | **G-33** `refresh` does not carry `passwordChangeRequired` | console | A clerk who **reloads** while owing a change loses the flag |
| 🟡 | **G-34** nothing refuses re-entering the issued password | both | BR-008 can be satisfied by retyping what was read out down the corridor |

Neither blocks anything. G-33 has a client-side recovery already in place, described
below, so this is about removing the need for it rather than about a broken console.

---

## 🟠 G-33: the flag is reported at sign-in and nowhere else

```
POST /admin/auth/login    -> { status, session, passwordChangeRequired }   ✅
POST /admin/auth/refresh  -> { status, session }                           ← no flag
GET  /admin/auth/me       -> { user, grants }                              ← no flag
```

**Why that matters here specifically.** The console does not call `me`: it bootstraps from
a rotation on every page load, deliberately, because the rotation already answers with the
whole session and a follow-up `me` would be a second round trip on the critical path of
the first paint. Your own `authStore` comment and ours agree on that.

So the sequence that breaks is an ordinary one:

1. A new clerk signs in. Flag arrives, console shows the password screen.
2. They reload the page, or come back to an open tab tomorrow.
3. Bootstrap rotates. **The flag is not in the answer.**
4. The console believes everything is fine and renders the dashboard.
5. Every panel on it fails, because the guard refuses all of them.

That is a console which looks signed in and does nothing, with no screen saying why.

**What we did about it.** The transport watches for `password-change-required` on any
response and raises the flag from the refusal itself, which turns the dead end back into
the screen that resolves it. It works, it is tested, and it is a recovery rather than a
design: the console is relying on being refused in order to learn something it should have
been told. Putting `passwordChangeRequired` on the refresh response would make it
unnecessary, and we would keep the recovery anyway as a belt.

Either endpoint would do. `refresh` is the one the console actually reads.

---

## 🟡 G-34: the rule can be satisfied by retyping the password you were given

`POST /admin/auth/initial-password` checks length and nothing else:

```
{"next":"short"}  ->  422 invalid  { field: "password", minLength: 12 }
```

There is no comparison against the password currently on the account. We grepped both
realms for one and there is none, so this applies to `POST /auth/initial-password` on the
supplier side too.

**Why it is worth a few lines.** `userRepository` mints a 16-character random password, so
the credential a clerk is handed is usually strong. The thing BR-008 is actually about is
not strength, it is *who knows it*: the office chose it, read it out, and may well have
written it down. A clerk who satisfies the rule by typing that same string back has
changed nothing about who knows their password, and the flag is now down for ever.

A `bcrypt.compare` against the stored hash, refused as its own code, closes it. We cannot
do this client-side: the console has never seen the hash, and keeping the string the clerk
typed at sign-in in memory to compare against would be storing a credential for no good
reason.

**One small thing in the same area, not worth its own number.** Both length refusals answer
`invalid` with `{ field: 'password', minLength: 12 }` rather than a code of their own, so
the console renders its generic validation message. It catches the short case before the
round trip, so an editor does see a useful sentence. Mentioned only because our first pass
guessed there were `weak-password` and `same-password` codes and wrote copy for both; we
removed it once we drove the endpoint instead of assuming.

---

## Closed in `a953823`, verified on the wire

| Was | Check | Result |
|---|---|---|
| **O1** no object store | `sign` → `PUT` → `confirm` → signed `GET` | **all four**, bytes identical round trip, against the real R2 bucket |
| | `sign` with a PDF, and with 6 MB | `422 upload-type`, `422 upload-too-large` |
| **news `PATCH` missing** | `PATCH /admin/news/{id}` | exists, `404 not-found` on a fake id |
| **G-02a** no BR-008 for staff | `login` | carries `passwordChangeRequired` |
| | `POST /admin/auth/initial-password/keep` | `204` |
| **`thisMonth` meant "newest entry"** | `/savings/summary` | summed over the Colombo month, `currentMonth` agrees |
| **G-21a** eligibility undeclared | `/loans/eligibility` | `interest`, `hasRequiredHistory`, `installmentOptions`, `pendingRequestId` |

**The upload contract matches what we specified exactly**, including `headers` on the sign
response, which is the part we were least sure you would want. Your `ALLOWED_UPLOAD_TYPES`
and `MAX_UPLOAD_BYTES` are the same three types and the same 5 MB the console refuses
before signing, so the two sides cannot disagree about which files are allowed.

**The re-vendor is clean.** `packages/domain` in this repo and yours are byte-identical
apart from line endings, across `types/admin.ts`, `leafCredit.ts`, `schemas/index.ts` and
`teaPackets.ts`. `CreditEligibilityWorking` landed as intended and `withAppEligibilityNames`
is constrained on it.

### Two notes on things you got right that are easy to lose later

**`confirm` looks in the bucket before believing the client.** That is the half a simpler
implementation would skip, and skipping it means a row marked usable with nothing behind
it, discovered by a supplier looking at a broken image on an article the office thinks it
published.

**`storageKey` is derived from the row id, not the filename.** Two people uploading
`cover.jpg` cannot collide, and a filename from a browser never becomes a path.

---

## What the frontends changed

### Admin console

- **The office's BR-008 screen.** `InitialPasswordScreen`, gated inside `RequireAuth`'s
  authenticated branch rather than as a route: owing a change is a signed-in state with
  one screen available, not a refusal, and redirecting to sign-in would send a clerk back
  to the only password they have. Set a new one, or keep the issued one deliberately, or
  sign out. 4 tests.
- **The transport raises the flag from `password-change-required`**, which is the G-33
  recovery above.
- **A cover image on the article editor**, using the new `PATCH`. It sits beside the
  preview rather than inside the translation editor, because one picture serves all three
  languages and a field that moved with the tab would suggest otherwise.
- **`503 upload-not-configured` passes straight through**, and a `404` from a server
  predating O1 is translated into the same thing. Both disable the picker and explain,
  rather than colouring the message red as though the editor chose a bad file.
- `LoginResult`, `NewsPatch` and `AdminConsoleUser.owesPasswordChange` added to
  `@tfd/domain`. Ready for your next re-vendor.

### Supplier app

- The note warning that `thisMonth` was really "the newest ledger entry's movement" is
  gone, because it is not true any more.

### One fixture decision worth flagging

Our mock answers `passwordChangeRequired` on **login only**, not on refresh, because that
is what staging does. It would have been easy to add it to both and have a green suite
while a reload locked somebody out. The fixture reproduces the gap on purpose, and the
test that covers the recovery is written so it still passes once you close G-33.

---

## Open, and no change requested

- **G-05.** Bank reveal answers `{ accountNumber, auditId }` and stays minimal.
- **G-11.** Mutations acknowledge with `{ id }`. The console invalidates and refetches.
- **G-09** *(partly)*. `/admin/users` and `/admin/banners` are bare arrays. Fine at office
  scale, where both lists are small by construction.
- **G-01.** No `POST /admin/suppliers`. The register is replicated from the factory's own
  system and no v2 screen creates one.
- **G-13.** Deliveries, months, rates and payouts unimplemented. Cut from this console
  deliberately.
- **G-18.** `GET /config` sends `slug` and `factoryId` where `RuntimeConfig` says
  `tenantId`. The console resolves the tenant from the subdomain.

## Deferred by your decision, and agreed

- **G-03.** `GET /admin/auth/me` returns a thin identity. The console bootstraps from
  refresh and does not call it. *(If you close G-33 on `me` rather than `refresh`, this
  would have to change, which is the argument for putting it on `refresh`.)*
- **G-07.** News and banner create read a flat body where the shared drafts carry
  `translations`. *"Should be decided once for both resources."*

---

## Running against staging

```sh
npm run dev:staging       # console -> http://localhost:5273, talking to the deployed API
```

The dev server prints its API target on startup, so `dev` and `dev:staging` cannot be
confused. Use `manager@galaboda.lk` for the queues: `admin` is `factoryAdmin` and correctly
has no money capability (§12.1).

The mobile app points at `https://tfd-api-fja1.onrender.com/v1` from
`src/config/clients/default/index.ts`. The `/v1` suffix is load-bearing: `client.ts` uses
`baseUrl` as the axios `baseURL` unchanged and `endpoints.ts` asks for `/auth/login`.

⚠️ **Still ours, not yours:** `react-native-config` is not wired into either native build,
so nothing in `.env` is read, including `APP_CLIENT`. Per-brand builds have never actually
selected a brand.

---

## State of both frontends

- **Console:** typecheck clean, lint clean, production build clean, **415/415 tests**
  (four new for BR-008, one more on uploads).
- **Mobile:** typecheck clean, **145/145 tests**, lint at its 4 pre-existing errors.
- **12/12 live checks** against staging, covering every item above.

**Not exercised:** push delivery, still waiting on FCM and APNs credentials (your O2), and
savings withdrawals through a full approval cycle.
