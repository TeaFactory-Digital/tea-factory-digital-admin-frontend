# Reply 

Answers to `open-questions.md`.

Every
answer below was checked against the code rather than the contract document, and the five
places they disagree are called out where they come up.

---

## Q15–Q22 — settled, build against these

| # | Answer |
| --- | --- |
| **Q15** | Code is **`fallback-language-required`, 422**, `details.impacts` (an array). `language-required` exists nowhere in the codebase — §18.2 is stale. For news create: **suffix the slug collision**, never return `slug-taken`; the real refusal is `422 fallback-translation-missing` |
| **Q16** | **No contradiction.** The wire field is `idNumber` and it carries the supplier code. **Do not rename it** — the app keychains credentials under that key. The supplier types the **bare code**: `5708`, `1111`, `1234`. **Store it as a string, not an integer** (`0708` ≠ `708`). Unique per factory. NIC is not a login identifier |
| **Q17** | Order: **401 → capability (`forbidden`) → flag (`feature-disabled`) → 404 → state**. Unknown id at a flag-off tenant → **`403 feature-disabled`, not 404**. One exception: where the flag depends on the record (`credit-requests/{id}`, flag is per facility) 404 must come first. The mock is inconsistent — build the rule, not the mock |
| **Q18** | `FactorySyncStatus` is the whole shape: `{ lastSucceededAt, lastAttemptedAt, coversUpTo }`, all nullable. **No new endpoint** — put it on `GET /admin/dashboard` and on every money-bearing read. **Do not send a boolean** `isStale`; the threshold is the console's and belongs in config |
| **Q19** | Real hole — specified nowhere. Since the factory publishes in its own database, **build it as a service-to-service endpoint**: machine credential (not a clerk token), body `{ category, event, occurredAt, context }`, **idempotent on `{category, eventKey}`** e.g. `month.publish:2026-07`. `no-recipients` must be **accepted**, not refused. Also carry the **month stage in the hourly sync**, so a publish that never fires the trigger is detectable |
| **Q20** | The console generates a **fresh key per HTTP request**, so a repeated key means the transport retried — not that a clerk clicked twice. Build it as a **network-retry guard**; double-action stays guarded by `already-decided` / `four-eyes-violation`. Four codes to add: `422 idempotency-key-reused` (different body — never replay), `400 idempotency-key-required`, `409 idempotency-in-progress`, and replay-verbatim for same body. Scope: tenant + user + endpoint, TTL 24 h |
| **Q21** | **At-send, and it must stay at-send** — nothing reports back yet, so it is the only true figure. Async results go on `NotificationSend.status` (`queued`/`failed`). Confirmed delivery later would be a **new field**, never a redefinition |
| **Q22** | **The domain package governs.** Build **`POST /admin/suppliers/{id}/credentials/reset`**. Do **not** build `/password-reset` — §5.5 is stale and that endpoint is now deleted from this repo. Spec: `suppliers: write`; reason ≥ 15 chars else `422 note-required`; `409 supplier-closed`; CSPRNG password, 9 chars from `ACDEFGHJKMNPQRTUVWXY34679`; returned **once**, never stored readably, never in the audit; set `owesPasswordChange`; end existing sessions and return the real count. **And the half that makes it safe is on the supplier API**: `owesPasswordChange` must come back on `POST /auth/login` and the API must refuse every other endpoint until the supplier changes it |

---

## Q1–Q14 — the factory's, but nine have work in them now

Where an answer changes a **value**, build the hole and default it null. Where it changes
a **schema**, build the wider shape now.

- **Q3** is genuinely first — don't model supplier bank details until it is answered in writing.
- **Q5 / Q6** — build `outstanding` as a real **per-facility balance with a ledger**. The ceiling is settled; only the subtrahend is missing. The stacking *rule* is one predicate on top.
- **Q12** — ⚠️ the one schema question. Book **`grossKg` + `deductionKg`**, derive `kgs`. If the answer is "one figure", `deductionKg` is 0 and nothing is lost. If you build one and the answer is two, it is a migration over every published month.
- **Q7 / Q11** — add the config fields now, default null, apply nothing.
- **Q8** — `otherCards` must appear on every bill (BR-107). Default it to **0**, not the mock's invented figure.
- **Q9** — keep BR-108's lock absolute. Don't add a "corrections" flag in anticipation.
- **Q10** — no hard deletes anywhere; the audit log must survive an erasure request.
- **Q13 / Q14** — whole rupees with `coinsCarriedForward`; keep the file's number format in `payouts.export` config so a bank rejection is a config change.
- **Q1 / Q2 / Q4** — nothing to build. Read `factory-system-team.md` §7 before the meeting; it already writes out both fallbacks for Q2.

---

## Two notes on scope

**1. It is two realms, ~70 endpoints.** The mobile app has its own full supplier API
(`docs/api.md` §17.2–17.5) — bills, income, savings, four credit facilities, news,
banners, inquiries, profile, change requests, devices, notifications. The console has
its own (`docs/v2/api-contract.md` §1–§20). **§22's second checklist is not yours** —
deliveries, month close, bill generate, payout runs belong to the factory's console.

⚠️ **Do not build from mobile `docs/api.md` §17.6.** It is a v1-era sketch of the admin
API and it is wrong in five places — `/admin/rates/{monthKey}`, `/months/{key}/close`,
`PUT /admin/config`, `PUT /admin/users/{id}/roles`, and `/admin/bills/{id}/adjustments`
which must never exist. **`docs/v2/api-contract.md` governs the admin realm; mobile
`docs/api.md` §17.1–17.5 governs the supplier realm.**

**2. The read endpoints are not blocked on the sync.** Both clients read money the
factory's system produces — `GET /bills/current`, `/income/summaries`,
`/savings/ledger`, `/admin/bills/{id}`. Those are yours; their *data source* is Phase 10
(Q1/Q2). Build the replica tables and read models now — they serve empty until the
factory's endpoint lands, then serve real data with no reshaping.

**Where to start:** the error envelope with the domain `code`, then `GET /config`, then
auth in both realms including `/credentials/reset` and `owesPasswordChange`.

The error envelope is first for a reason: both clients branch on the `code` string, and
every later endpoint's failures are unreadable without it. Send the domain code in the
body — `{ code, message, details }` — and never let the HTTP status be the only signal.

---

*Note: both repos were just cleaned of dead code, so some client-side files named in
older docs are gone — the payouts/savings/deductionRates/uploads repositories here, and
the mobile app's entire unwired HTTP layer. **Nothing you need is lost.**
`docs/v2/api-contract.md` specifies all of it in prose, and the **MSW mock in
`apps/admin/src/services/mocks/handlers.ts` still implements every one of those
endpoints** — 17 route groups, including the ones whose client code went. That mock is
the closest thing to a reference implementation any of this has: run the console with
`VITE_USE_MOCK=1` and read it. If a shape differs from the document, tell us rather than
reshaping your side — the seam that absorbs it is `apps/admin/src/services/repositories/`
and it is usually a one-file change here.*
