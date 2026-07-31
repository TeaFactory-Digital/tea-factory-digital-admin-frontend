# Admin API contract

**This is the document to hand to the backend developer.** It specifies every
endpoint the console calls, the exact payloads, the error envelope, and the
refusals the server must produce. The console is written against it already and
runs on a mock that implements it (see [mocks.md](./mocks.md)), so anything here
is testable the day it lands.

It extends `docs/api.md` §17.6 in the mobile repo, which lists the admin surface
by area. Where the two disagree, this document is more specific and §17.6 is the
scope. Conventions (§17.1), the error codes the app understands (§17.4), and the
supplier-facing endpoints are unchanged — build those from `api.md`.

> **The base URL below is a placeholder.** `https://api.teafactory.example/v1`
> is what the console ships with; replace it and nothing else changes.

---

## 0. The five rules that matter most

Everything else is detail. These five are the ones that will be expensive to fix
later, and the console already depends on all of them.

| # | Rule | Why |
| --- | --- | --- |
| 1 | **The error body carries a domain `code`.** Never only an HTTP status. | The console renders a different screen for `four-eyes-violation`, `feature-disabled` and `already-decided` — all `403`/`409`. The mobile app already has this bug (api.md §17.7) and it must not be reproduced here |
| 2 | **Bank account numbers are masked in every read payload.** The full number is one separate, audited endpoint. | §20.4. A masked field the console un-masks is not a control; the number would sit in the browser's network tab |
| 3 | **Four eyes is a refusal, not a warning.** The creator of a record cannot approve it. | BR-501. A warning that can be clicked through is a control that does not exist |
| 4 | **A feature flag that is off makes the endpoint answer `403 feature-disabled`.** | AC-07. A flag that only hides a screen is a UI preference; anyone with a token can still `POST` |
| 5 | **Every mutation writes an audit entry, synchronously.** | AC-09, "within one second, with actor and before/after". An approval the office cannot demonstrate was recorded will be disputed |

---

## 1. Conventions

```
Base URL     https://{tenant}.api.teafactory.example/v1   ← or a fixed origin; see §1.2
Auth         Authorization: Bearer <access token>
Tenant       X-Tenant: galaboda        (routing hint only — see §1.2)
Content      application/json in and out
Timestamps   ISO 8601 UTC — "2026-07-30T09:00:00.000Z"
Months       monthKey strings — "2026-07"
Money        JSON numbers, 2 dp, no symbol, no thousands separator
Dates        Colombo-local calendar days as "YYYY-MM-DD" (BR-104)
```

### 1.1 What must never appear in a payload

- **A formatted string where a number belongs** (BR-110). No `"LKR 1,240.00"`.
- **A localized label.** The server sends keys; the console localizes. The two
  exceptions, both because a human in the office wrote them, are **news/static
  content** and **notification copy** — those take a `lang` parameter.
- **`0` in place of `null`** on a rate-derived field (BR-102). `null` means "the
  auction result is not in", and the console renders a different state for it.
  Substituting `0` produces a figure the office has to explain.

### 1.2 The tenant

Two mechanisms are available and the console uses both:

- **Subdomain** — `galaboda.admin.teafactory.lk` asks
  `galaboda.api.teafactory.example`. This is the recommendation in
  white-label.md.
- **`X-Tenant` header** — sent alongside, so a single shared origin also works.

**The header and the subdomain are routing hints. Neither is an authorization
decision.** The authoritative tenant is the one inside the access token. A
request whose `X-Tenant` disagrees with its token is `403 forbidden`, never a
tenant switch. Get this wrong and every factory can read every other factory's
suppliers by editing a header.

The console substitutes `{tenant}` into its configured base URL, so a factory
that later moves to its own deployment needs no console release.

### 1.3 Idempotency

The console sends `Idempotency-Key: <uuid>` on **every** non-GET request. Honour
it: return the original response for a repeated key rather than acting twice.

The reason is not theoretical. A clerk who clicks *Approve* twice because the
first click seemed not to register must not produce two disbursements, and a
retried payout run must not pay twice.

### 1.4 Paging

Every list returns this envelope. `page` is zero-based.

```json
{ "items": [], "page": 0, "pageSize": 50, "total": 2431, "nextPage": 1 }
```

`nextPage` is `null` on the last page. `total` is required — a grid shows
"Showing 1–50 of 2,431" and a queue badge needs a count without walking pages.

Query parameters on any list: `page`, `pageSize` (max 200), `sort` (field name),
`dir` (`asc` | `desc`). The console never sends an empty filter — an absent
parameter means "no filter", and `?status=` should never arrive.

### 1.5 Errors

```json
{
  "code": "four-eyes-violation",
  "message": "You raised this request, so you cannot decide it.",
  "details": { "createdByName": "Nadeeka Perera" }
}
```

`message` is **English only** and treated as a fallback; the console has its own
copy for every code it knows. `details` is free-form and used for context the
copy interpolates.

#### Codes the console handles specifically

| Code | Status | Meaning |
| --- | --- | --- |
| `unauthenticated` | 401 | No or expired access token |
| `invalid` | 401 | Bad credentials. **Same code and message for unknown user and wrong password** — distinguishing them is an account-enumeration oracle |
| `mfa-required` | — | Not an error; see §2.1. A correct password is not an authentication failure |
| `mfa-invalid` | 401 | Wrong or expired TOTP code |
| `forbidden` | 403 | The role does not grant this capability. `details: { capability, required, granted }` |
| `feature-disabled` | 403 | The tenant has this feature flag off (AC-07) |
| `four-eyes-violation` | 409 | The approver created the record (BR-501) |
| `already-decided` | 409 | Someone else decided it first. `details: { decidedByName }` |
| `note-required` | 422 | A decision, suspension or reveal arrived without a reason (AC-06) |
| `stale-eligibility` | 409 | Credit eligibility moved since the queue rendered (BR-310). **Refuse, do not warn** |
| `supplier-code-taken` | 409 | The code exists **for this factory** (§16.2) |
| `month-locked` | 409 | The month is published and immutable (BR-108) |
| `exceptions-unresolved` | 409 | Publish attempted with open M4 exceptions (AC-04) |

Anything else the console renders as a generic failure, so an unknown code is
safe but unhelpful.

---

## 2. Authentication — `/admin/auth/*`

A **separate realm** from suppliers: different table, different token audience,
different login screen. **A supplier token must never open the console**, and a
console token carries a factory id and a role set.

### 2.1 `POST /admin/auth/login`

```json
→ { "email": "clerk@galabodatea.lk", "password": "…" }
```

Two possible `200` responses. Note that the MFA case is **`200`, not `401`** — a
password that was correct is not an authentication failure, and treating it as
one makes lockout counters and rate limits wrong.

```json
200 { "status": "authenticated", "session": { … } }        // see §2.5
200 { "status": "mfaRequired",
      "challenge": { "challengeToken": "opaque", "method": "totp" } }
401 { "code": "invalid",   "message": "Email or password is incorrect." }
403 { "code": "forbidden", "message": "This account is suspended." }
```

`challengeToken` is opaque, single-use and short-lived (≤5 min). It is **not** a
session token and must not authorize anything.

Rate-limit this endpoint strictly, per email and per IP.

### 2.2 `POST /admin/auth/mfa`

```json
→ { "challengeToken": "opaque", "code": "123456" }
200 { "session": { … } }
401 { "code": "mfa-invalid" }
```

Consume the challenge on use — a replayed challenge is a replayed second factor.

**MFA is mandatory for manager and above.** A manager account without an enrolled
authenticator must be forced through enrolment, not allowed past it. On first
enrolment include `challenge.enrolment: { secret, otpauthUrl }` in the login
response.

### 2.3 `POST /admin/auth/refresh`

No body. Reads a **rotating refresh token from an httpOnly, Secure, SameSite=Lax
cookie**.

```json
200 { "accessToken": "…", "expiresAt": "2026-07-30T09:15:00.000Z" }
401 { "code": "invalid" }
```

- Access token: **15 minutes**, returned in the body, held **in memory** by the
  console.
- Refresh token: httpOnly cookie, rotated on every use, with reuse detection.

This shape is not a preference. The console runs on shared office machines; a
token in `localStorage` is readable by any script on the origin and outlives the
session. The console has no way to read the refresh cookie, which is the point.

**CORS:** the console is on a different subdomain from the API and sends
`withCredentials`. You need `Access-Control-Allow-Credentials: true` and an
explicit origin allowlist — a wildcard origin is illegal with credentials.

### 2.4 `POST /admin/auth/logout` → `204`

Revoke the refresh token server-side. The console clears its session regardless
of the response: a clerk who clicks *Sign out* on a shared machine and walks away
must not remain signed in because the request timed out.

### 2.5 `GET /admin/auth/me`

```json
200 {
  "user": {
    "id": "usr-clerk-1",
    "name": "Nadeeka Perera",
    "email": "clerk@galabodatea.lk",
    "factoryId": "galaboda",
    "roles": ["clerk"],
    "mfaEnrolled": false,
    "lastLoginAt": "2026-07-29T13:00:00.000Z",
    "status": "active"
  },
  "grants": { "suppliers": "write", "changeRequests": "approve", "reports": "read" }
}
```

`grants` maps capability → `"none" | "read" | "write" | "approve"`.

**Send it explicitly rather than expecting the console to derive it from
`roles`.** §12.1 is emphatic that the matrix is "data, not code: a factory will
want to split or merge these roles, and that must not be a deploy". The console
ships the default matrix as an offline fallback and lets your grants override it
per capability — so a role this build has never heard of still works. The full
matrix and capability list are in [rbac.md](./rbac.md).

The same `AuthSession` shape is returned inside `login` and `mfa`:

```ts
{ accessToken, expiresAt, user, grants }
```

---

## 3. Tenant configuration — `GET /config`

**Unauthenticated, and it has to be.** The console needs the factory's name,
logo and colours to draw its own sign-in screen; behind a token, every factory's
login page is identical and grey and a clerk cannot tell which deployment they
are pointed at.

Which means: **this payload must contain nothing sensitive.** It is the tenant's
public identity, its feature flags, its bank list and its collection points.

```json
200 {
  "tenantId": "galaboda",
  "factory": {
    "name": "Galaboda Tea Factory",
    "telephone": "041-2283282",
    "regNo": "M.F. 1041",
    "location": "Akuressa, Sri Lanka",
    "supportEmail": "office@galabodatea.lk",
    "supportHours": "Mon–Sat, 8:00am – 5:00pm",
    "legalFooter": "Issued under the Tea Control Act No. 51 of 1957. …"
  },
  "flags": {
    "enableSavings": true, "enableAdvances": true, "enableLoans": true,
    "enableManure": true, "enableInquiry": true, "enableNews": true,
    "enablePushNotifications": true, "enablePromoBanner": true,
    "enablePayouts": true, "enableReports": true
  },
  "savings": { "perKgOptions": [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
  "banks": [{ "name": "Bank of Ceylon", "branches": ["Akuressa", "Matara"] }],
  "localization": {
    "defaultLanguage": "en",
    "supportedLanguages": ["si", "en", "ta"],
    "contentLanguages": ["si", "en", "ta"]
  },
  "theme": {
    "colors": { "light": { "primary": "#2E8B57" }, "dark": { "primary": "#5FBE7E" } },
    "radius": { "md": 12 }
  },
  "branding": { "logoUrl": "https://…", "logoDarkUrl": "https://…", "faviconUrl": "https://…" },
  "push": { "topicPrefix": "galaboda", "categories": [], "defaultCategories": [] },
  "collectionPoints": [{ "id": "cp-makadura", "name": "MAKADURA" }]
}
```

Notes for the implementer:

- **Serve `ETag` and honour `If-None-Match`.** The console fetches this on every
  load; a `304` makes it free.
- **`flags` is the same block the mobile app reads.** One source, both consumers
  — that is what makes "turning off manure removes the manure queue from the
  office as well as the request screen from the app" true.
- **`localization.contentLanguages` is new** and distinct from
  `supportedLanguages`: it is the set of languages **editorial content must be
  authored in**, which drives the si/en/ta tabs in M11/M12. The console chrome is
  English; the content is not.
- **`theme` colour values are validated by the console** against a known token
  list and a colour-shape check, and anything unrecognised is dropped. Send only
  the semantic token names in [design-system.md](./design-system.md).
- `404 { "code": "tenant-unknown" }` for a subdomain with no factory behind it.

---

## 4. M1 Dashboard — `GET /admin/dashboard`

Capability: `reports` (read).

**One request, not one per queue.** The alternative — the console fanning out to
five list endpoints with `pageSize=1` and reading totals — puts five round trips
and five counts behind the first screen every clerk opens, on a connection shared
with the phones. Serve this from indexes.

```json
200 {
  "queues": [
    { "queue": "changeRequests", "pending": 12,
      "oldestPendingAt": "2026-07-26T04:00:00.000Z", "breachingSla": 3 }
  ],
  "cycle": {
    "monthKey": "2026-07", "stage": "awaitingRate", "openExceptions": 9,
    "ratePerKg": null, "extraRatePerKg": null,
    "publishedAt": null, "publishedByName": null
  },
  "today": {
    "date": "2026-07-30", "totalKgs": 5218.5,
    "supplierCount": 61, "deliveryCount": 74, "previousDayKgs": 4903.25
  },
  "alerts": [
    { "id": "alert-missing-bank", "severity": "warning",
      "messageKey": "dashboard.alert.missingBankDetails",
      "params": { "count": 9 }, "href": "/suppliers?hasBankDetails=false" }
  ],
  "intakeTrend": [{ "date": "2026-07-17", "totalKgs": 4211.0 }]
}
```

- `queue` ∈ `changeRequests | advanceRequests | loanRequests | manureRequests |
  inquiries`. **Omit a queue whose feature flag is off** — do not send it with
  `pending: 0`. An empty inbox and an inbox that cannot exist look identical on
  screen, and one of them wastes a clerk's attention.
- `stage` ∈ `collecting | awaitingRate | rateEntered | billsGenerated |
  published`, per the §13 cycle.
- **Alerts carry an i18n key and params, never a sentence** — the copy belongs in
  the console's string table (BR-110). Keys the console currently renders:
  `dashboard.alert.missingBankDetails`, `dashboard.alert.slaBreach`,
  `dashboard.alert.awaitingRate`. An unknown key renders as the key, so add
  console copy in the same PR as a new alert.
- `intakeTrend` is **oldest first** — charts read left to right. 14 days.
- All dates are Colombo-local days (BR-104).

---

## 5. M2 Suppliers — `/admin/suppliers`

Capability: `suppliers`. `read` for the list and detail, `write` for every
mutation. Note that §12.1 gives the **manager `read` only** — they cannot edit a
supplier record, which is easy to get wrong because a manager outranks a clerk
elsewhere.

### 5.1 `GET /admin/suppliers`

Query: `q`, `status`, `collectionPoint`, `hasBankDetails` (`true`|`false`),
`dormantMonths`, plus the §1.4 paging parameters. Default `pageSize` 50, default
sort `supplierCode` ascending.

**`q` must match a supplier code with or without its division suffix**, and match
name and NIC. The office searches by whichever they remember: `5708`,
`5708 (MAKADURA)` and `makadura` all have to work.

```json
200 { "items": [{
  "id": "sup-1",
  "supplierCode": "5007 (MAKADURA)",
  "name": "Kamal Perera",
  "nic": "196000007919V",
  "collectionPoint": "MAKADURA",
  "status": "active",
  "paymentMethod": "bankTransfer",
  "savingsPerKg": 20,
  "hasBankDetails": true,
  "lastDeliveryAt": "2026-07-29T02:00:00.000Z",
  "pendingRequests": 1
}], "page": 0, "pageSize": 50, "total": 84, "nextPage": 1 }
```

`hasBankDetails: false` is not cosmetic — those suppliers are M4 exceptions that
will block publishing the month (AC-04), so the console flags them weeks earlier.

### 5.2 `GET /admin/suppliers/{id}`

The list row plus the registry facts. **`bankDetails.accountNumber` is masked**
(`"••••0137"`).

```json
200 {
  "…": "every SupplierListItem field, plus:",
  "phone": "0771234567",
  "email": "supplier1@example.lk",
  "dateOfBirth": "1972-04-18",
  "homeAddress": "No 41, MAKADURA Road, Akuressa",
  "estateAddress": "MAKADURA Estate, Lot 12",
  "registeredAt": "2019-03-04T00:00:00.000Z",
  "bankDetails": { "bankName": "Bank of Ceylon", "branchName": "Akuressa",
                   "accountNumber": "••••0137" },
  "savingsBalance": 84210.50,
  "creditBalances": { "advance": 12400.00, "loan": 0, "manure": 3150.75 },
  "suspendedReason": null
}
```

### 5.3 Mutations

| Method & path | Body | Notes |
| --- | --- | --- |
| `POST /admin/suppliers` | `SupplierRegistration` | `409 supplier-code-taken` — uniqueness is **per factory** |
| `PATCH /admin/suppliers/{id}` | `Partial<SupplierEditable>` | Never accepts `bankDetails`, `paymentMethod` or `savingsPerKg`: those move through M9 |
| `POST /admin/suppliers/{id}/suspend` | `{ reason }` | ≥10 chars, `422 note-required` otherwise |
| `POST /admin/suppliers/{id}/reactivate` | `{ reason }` | Same |
| `POST /admin/suppliers/{id}/close` | `{ reason }` | **Closing is not deleting.** Keep every bill, ledger entry and credit transaction (§12.1) |

All five return the updated `AdminSupplier` and write an audit entry.

The reason is mandatory for the same reason a rejection note is: a supplier who
finds their account suspended will telephone the office, and "suspended on the
14th" with no why is a conversation nobody there can have.

### 5.4 `POST /admin/suppliers/{id}/bank-details/reveal`

The **only** endpoint that returns a full account number.

```json
→ { "reason": "Verifying a bank rejection for the July payout run." }
200 { "bankName": "Bank of Ceylon", "branchName": "Akuressa",
      "accountNumber": "70000137", "auditId": "aud-1041" }
422 { "code": "note-required" }
```

Three requirements:

1. **`reason` is mandatory** (≥10 chars). An audit entry that records *that*
   someone looked without recording *why* answers the wrong question.
2. **Write the audit entry before responding**, and return its `auditId`. The
   console shows that id to the clerk — the difference between "we log this" as a
   policy statement and as something visibly happening.
3. **Build the read model so a list handler cannot leak it.** In the mock, full
   numbers live in a separate map from the supplier records; do the equivalent —
   mask in the projection, join to the real value only here.

Consider restricting this capability further than `suppliers: read` once the
factory says which roles need it (§20.4 says "except to roles that need them").

### 5.5 `POST /admin/suppliers/{id}/password-reset` — **shape provisional**

```json
→ { "reason": "…" }
200 { "issued": true, "deliveredTo": "sms" }
```

**Blocked on a business answer** (status.md §21.16): the app tells a supplier to
"contact the factory", and what the office then does — who checks the supplier's
identity, and what the supplier receives — is undecided. The console has the
button disabled and says so. Do not build this until the factory answers; the
wrong flow here is an account-takeover path.

---

## 6. M9 Change requests — `/admin/change-requests`

Capability: `changeRequests`. `read` to list, **`approve`** to decide.

This module is the other half of the app's loudest open loop. AC-02 is the
criterion: **approving changes the app's displayed value on next refresh;
rejecting leaves the value untouched and shows the note.**

### 6.1 `GET /admin/change-requests`

Query: `status` (default `pending`), `type`, `supplierId`, `q`, plus paging.
Default `pageSize` 25.

**Order oldest first within a status.** This is the opposite of every other list
and it is deliberate: a queue is worked front to back, and the item that has
waited longest is the one at risk of breaching the §14.4 target. A newest-first
inbox is one where the oldest item is never seen.

```json
200 { "items": [{
  "id": "chg-1",
  "supplierId": "sup-4", "supplierCode": "5028 (AKURESSA)", "supplierName": "Nimal Silva",
  "type": "bankDetails",
  "status": "pending",
  "createdAt": "2026-07-30T05:00:00.000Z",
  "currentSummary": "Bank of Ceylon · Akuressa · ••••0137",
  "requestedSummary": "Sampath Bank · Matara · ••••1972",
  "requestedBankDetails": { "bankName": "Sampath Bank", "branchName": "Matara",
                            "accountNumber": "••••1972" },
  "channel": "app",
  "createdById": null, "createdByName": null,
  "decision": null,
  "attachments": [],
  "ageHours": 2.4
}], "page": 0, "pageSize": 25, "total": 12, "nextPage": null }
```

- `type` ∈ `bankDetails | paymentMethod | savingsRate`, with
  `requestedBankDetails` / `requestedPaymentMethod` / `requestedSavingsPerKg`
  present accordingly.
- **`currentSummary` and `requestedSummary` are server-composed strings.** The
  one deliberate exception to "no presentation in payloads": they summarise a
  heterogeneous change for side-by-side display, and composing them client-side
  would mean three renderers that can disagree with the app's wording. Keep bank
  numbers **masked** inside them.
- **`requestedBankDetails.accountNumber` is masked too.** The office approves a
  *change*; seeing the full number is a separate audited act even inside an
  approval.
- `channel` ∈ `app | office`. Set it, always — **app adoption and channel shift
  are the two KPIs that justify the project** (§19.3), and neither is measurable
  unless office-originated requests land in the same table with this column.
- `createdById` is the console user who raised it, or `null` when the supplier
  did. It is what makes four-eyes enforceable.
- `ageHours` is derived at read time, not stored.

### 6.2 `GET /admin/change-requests/{id}` → the same object

### 6.3 `POST /admin/change-requests/{id}/approve` · `/reject`

```json
→ { "note": "Passbook checked against the NIC at the counter.",
    "attachmentIds": ["att-1041"] }
200 → the updated AdminChangeRequest, with `decision` populated
```

Both verbs take the same body and both **require the note** — not just reject.

The checks, in order, all as refusals:

```
422 note-required          note missing or < 10 characters              (AC-06)
409 already-decided        status is not `pending`                       + details.decidedByName
409 four-eyes-violation    createdById === the authenticated user        (BR-501)
```

`already-decided` matters more than it looks: two clerks working one inbox is the
normal case, and silently overwriting the first decision would replace it in the
audit log.

On approve, apply the change to the supplier's **active** values — payment
method, bank details, savings rate — and decrement their `pendingRequests`. On
reject, change nothing except the request itself. That asymmetry *is* AC-02, and
getting it backwards would be invisible in the console and very visible in the
app.

Both verbs write an audit entry with `before: { status }` and
`after: { status, note }`.

---

## 7. Attachments — `/admin/uploads/sign`

Two-step and presigned. The file never passes through the API: a photo of a
passbook is megabytes and the API is sized for JSON on a rural connection.

```json
→ { "filename": "passbook.jpg", "contentType": "image/jpeg",
    "sizeBytes": 402113, "entity": "changeRequest", "entityId": "chg-1" }
200 {
  "uploadUrl": "https://storage…/att-1041?X-Amz-Signature=…",
  "headers": { "Content-Type": "image/jpeg" },
  "attachment": { "id": "att-1041", "filename": "passbook.jpg",
                  "contentType": "image/jpeg", "sizeBytes": 402113,
                  "url": "https://storage…/att-1041",
                  "uploadedAt": "…", "uploadedByName": "Nadeeka Perera" }
}
```

The console then `PUT`s the bytes to `uploadUrl` with exactly `headers` and
nothing else — any extra header breaks the signature.

**The signature encodes the policy**: content type allowlist (JPEG, PNG, WebP,
PDF) and a size ceiling (8 MB). The console pre-checks both, but that is a
courtesy to save a clerk a wasted upload — the signature is the control.

`attachment.url` should be a short-lived signed GET, not a public object.

---

## 8. M17 Audit — `GET /admin/audit`

Capability: `auditLog` (read). Per §12.1 that is **accountant and above — a clerk
has no audit access at all**, which is deliberate: the log is for the people
reviewing the work, not the people doing it.

Query: `entity`, `entityId`, `actorId`, `action`, `from`, `to`, plus paging.
Newest first.

```json
200 { "items": [{
  "id": "aud-1041",
  "at": "2026-07-30T06:12:04.881Z",
  "actorId": "usr-manager-1", "actorName": "Ruwan Jayasuriya",
  "action": "changeRequest.approve",
  "entity": "changeRequest", "entityId": "chg-2",
  "before": { "status": "pending" },
  "after": { "status": "approved", "note": "…" },
  "ip": "192.168.10.24"
}], "page": 0, "pageSize": 50, "total": 3, "nextPage": null }
```

- **Append-only. No write endpoint, ever** (BR-502). An audit trail a client can
  author is not evidence of anything — entries are a side effect of the mutation
  that caused them.
- `action` is a dotted verb. The console maps known ones to copy and falls
  through to the raw string, so a new action shows up in the log the day it ships.
  Current set: `changeRequest.approve`, `changeRequest.reject`,
  `supplier.update`, `supplier.suspend`, `supplier.reactivate`,
  `supplier.bankDetails.reveal`, `rate.set`.
- The log **outlives everything it describes** (§20.4). Do not cascade-delete it.

---

## 9. Not yet called by the console

These are in §17.6's scope and the console has no code for them yet, so the
shapes are open. Two requests from the front end when you get there:

| Area | Ask |
| --- | --- |
| **M3 Deliveries** | `POST /admin/deliveries` must accept a **batch** of rows in one call, not one row per request. The grid commits a whole weighing session, and a row-per-request design makes a 200-row entry session 200 round trips on office wifi |
| **M4 Month close** | `GET /admin/months/{monthKey}/exceptions` as a first-class list, not a count. AC-04 requires the accountant to resolve each one, which means each needs an id, a type and a link to the record |
| **M7 Credit** | Eligibility in a queue row must be **byte-for-byte identical** to `GET /advances\|loans\|manure/eligibility` for that supplier (AC-05), including the working — months of history, rate × kilos, the ceiling. Re-check at the moment of approval and answer `stale-eligibility` (BR-310). `packages/domain/src/leafCredit.ts` is the shared implementation; import it rather than re-deriving |
| **M13 Notifications** | Sends must carry a recognized `data.category` — the app drops anything else rather than opening an arbitrary screen — and must honour each device's opted-in categories, not only its topic subscriptions |
| **M16 Reports** | Run off a read replica or nightly snapshot (§19.5). A month-close query must not compete with a clerk entering deliveries |

---

## 10. A checklist for the first PR

Ordered so each step is independently useful to the console.

- [ ] `GET /config` for one tenant, unauthenticated, with `ETag`
- [ ] The error envelope with domain `code` — **before anything else**, because
      every later endpoint's failures are unreadable without it
- [ ] `POST /admin/auth/login` + `POST /admin/auth/refresh` + `GET /admin/auth/me`
      with real `grants`
- [ ] `GET /admin/suppliers` with `q`, paging and **masked** bank details
- [ ] `GET /admin/suppliers/{id}` and the audited reveal
- [ ] `GET /admin/change-requests` (oldest first) and the two decision endpoints
      with all three refusals
- [ ] Audit rows written by every mutation above, and `GET /admin/audit`
- [ ] `GET /admin/dashboard`

Point `VITE_API_BASE_URL` at it and set `VITE_USE_MOCK=0`; the console needs no
other change. If a shape differs from this document, the seam that absorbs it is
`apps/admin/src/services/repositories/` — tell the front end rather than
reshaping the console's types.
