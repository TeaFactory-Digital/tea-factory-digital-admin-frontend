# Backend API gaps: admin console and supplier app

**For:** the backend developer, `tea-factory-digital-backend`
**From:** the two frontend integrations
**Verified against:** backend `110bdb2`, driven on staging
`https://tfd-api-fja1.onrender.com`, tenant `galaboda`.

> # Nothing is open.
>
> G-33 and G-34 are closed and confirmed on the wire. There is no outstanding gap between
> either frontend and this API.
>
> What is left in this file is the standing list of shapes both sides have agreed **not**
> to change, and the two items you deferred on purpose. Neither is work.

---

## Closed in `110bdb2`, checked on staging

| | Check | Result |
|---|---|---|
| **G-33** | `POST /admin/auth/refresh` | `{ status, session, passwordChangeRequired }` |
| **G-34** | `POST /admin/auth/initial-password` with the current password | `422 password-unchanged` |

Putting G-33 on `refresh` rather than `me` was the right call and it keeps G-03 deferred,
which is what we were hoping for: the console bootstraps from a rotation precisely so it
does not have to make a second call on the critical path of the first paint.

**The console now reads it there.** `authEndpoints.refresh` was returning `.session` and
dropping the envelope, so the field would have arrived and been thrown away on every page
load. Both `bootstrap` and `refresh` set the flag from the rotation now.

**The belt stays.** The transport still raises the flag from a `password-change-required`
refusal. It is no longer the only strap, and its test drives a refusal directly rather than
a reload, so it cannot quietly rot behind the primary path.

`password-unchanged` is handled in both clients. The app already had it, from the profile
password change.

---

## Open, and no change requested

Recorded so the shared types can be reconciled one day, not as work:

- **G-05.** Bank reveal answers `{ accountNumber, auditId }` and stays minimal. The right
  call for the one endpoint that hands over an account number.
- **G-11.** Mutations acknowledge with `{ id }`. The console invalidates and refetches.
- **G-09** *(partly)*. `/admin/users` and `/admin/banners` are bare arrays. Fine at office
  scale, where both lists are small by construction.
- **G-01.** No `POST /admin/suppliers`. The register is replicated from the factory's own
  system and no v2 screen creates one.
- **G-13.** Deliveries, months, rates and payouts unimplemented. Cut from this console
  deliberately; the factory's own system runs them.
- **G-18.** `GET /config` sends `slug` and `factoryId` where `RuntimeConfig` says
  `tenantId`. The console resolves the tenant from the subdomain.

## Deferred by your decision, and agreed

- **G-03.** `GET /admin/auth/me` returns a thin identity. The console bootstraps from
  refresh and does not call it, so there is no reader to serve. Putting G-33 on `refresh`
  is what keeps this true.
- **G-07.** News and banner create read a flat body where the shared drafts carry
  `translations`. *"Should be decided once for both resources."*

## The length refusals, settled

Agreed, and no change wanted. `422 invalid` with `{ field: 'password', minLength: 12 }` is
the right answer: length is a shape question, the ladder is shape then policy, and the
console's own check gives an editor a usable sentence before the round trip. Raised only
because our first pass invented `weak-password` and wrote copy for it; driving the endpoint
is what corrected us, and the copy is gone.

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

⚠️ **Ours, not yours:** `react-native-config` is not wired into either native build, so
nothing in `.env` is read, including `APP_CLIENT`. Per-brand builds have never actually
selected a brand.

---

## State of both frontends

- **Console:** typecheck clean, lint clean, production build clean, **416/416 tests**.
- **Mobile:** typecheck clean, **145/145 tests**, lint at its 4 pre-existing errors.
- `packages/domain` is byte-identical between the two repos, apart from line endings,
  across `types/admin.ts`, `leafCredit.ts`, `schemas/index.ts` and `teaPackets.ts`.

**Still waiting on infrastructure, not on code:** push delivery needs FCM and APNs
credentials (your O2). Everything up to the send is built and tested on both sides and
nothing is delivered to a phone.
