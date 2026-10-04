# Backend to-do

Backend fixes still open, found while testing the admin console and the mobile app against
staging. Each one says what is wrong, where, and what to change. Items #1 to #18 are done
and have been removed from this file.

## Open (4 October 2026)

| # | What | Priority |
|---|------|----------|
| 19 | Change request detail: send when it was decided | Low |
| 20 | Refresh always fails with `403 csrf`, so the console signs out on every reload | High |
| 21 | Bank details change requests cannot be approved | High |
| 22 | Credit request detail always answers `403 feature-disabled` | High |
| 23 | Inquiry detail: send who closed it, and who entered it at the office | Low |
| 24 | Saving manure products turns the list into an object; manure requests break | High |
| 25 | Inquiries as conversations: more than one message each way | Medium (new feature) |

---

## 19. Change request detail: send when it was decided

**Priority:** Low. Nothing breaks; the console shows a dash for the time.

**What is wrong**
`GET /v1/admin/change-requests/:id` sends `decisionNote` and `decidedByName`, but not
`decidedAt` or `decidedById`. Both are already stored (`decide()` writes them), so a decided
request shows "Rejected by Ruwan Jayasuriya" with a dash instead of the date and time.

**What to do**
In `apps/api/src/modules/queues/change-requests.service.ts`, the row-to-response function
(around line 114): add `decidedAt` and `decidedById` to the `select` and to the returned object:

```ts
decidedById: row.decidedById,
decidedAt: row.decidedAt?.toISOString() ?? null,
```

**Optional:** if a request can carry documents (a bank letter, an ID photo), also send
`attachments: [{ id, fileName, url }]`. The console shows them when present and an empty list
when the key is missing.

**Check**
Open a decided request in the console: the line under the status shows the decision's date and
time.

---

## 20. Refresh always fails with `403 csrf` (console signs out on reload)

**Priority:** High. Every page reload, and every access token expiry (15 minutes), sends the
user back to the sign-in screen.

**What is wrong**
Staging runs with `COOKIE_MODE=cross-site`, so `assertCsrf()`
(`apps/api/src/modules/auth/cookies.ts`) wants the `X-CSRF-Token` header to equal the
`tfd_csrf` cookie. But the console **cannot read that cookie**:

- The cookie is set by the API, so it belongs to `tfd-api-fja1.onrender.com` (path
  `/v1/admin/auth`).
- The console runs on another site (`localhost:5173` in development, its own host when
  deployed). JavaScript can only read cookies of its own site, so `document.cookie` never
  contains `tfd_csrf`.
- So the console sends no header, and the API answers:
  `403 { "code": "forbidden", "details": { "reason": "csrf", "header": "X-CSRF-Token" } }`.

Double-submit only works when the console and the API share a site. In cross-site mode it
can never pass. No console change can fix this.

**What to do (recommended: check `Origin`)**
In `assertCsrf()`, accept the request when its `Origin` header is one of `CORS_ORIGINS`.
A browser always sends `Origin` on a cross-site `POST`, and a page cannot fake it, so this
stops the forced sign-out attack the token was there for.

```ts
export function assertCsrf(request: Request, env: NodeJS.ProcessEnv = process.env): void {
  if (cookieMode(env) !== 'cross-site') return;

  const fromBody = (request.body as { refreshToken?: unknown } | undefined)?.refreshToken;
  if (typeof fromBody === 'string' && fromBody.length > 0) return;

  // NEW: the console's own origin is enough. It cannot read our cookie cross-site.
  const allowed = (env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  const origin = request.header('origin');
  if (origin && allowed.includes(origin)) return;

  // Keep the double-submit check for any other caller.
  const cookie = parseCookies(request.header('cookie'))[CSRF_COOKIE];
  const header = request.header(CSRF_HEADER);
  if (!cookie || !header || !constantTimeEqual(cookie, header)) {
    throw new DomainError('forbidden', { reason: 'csrf', header: 'X-CSRF-Token' });
  }
}
```

Nothing changes in the console: it already sends the refresh cookie (`withCredentials`).

**Other option (only if you prefer the token)**
Send the token in the body of `POST /admin/auth/login` and `POST /admin/auth/refresh`
(for example `session.csrfToken`). Then tell us, and the console will store it and send it
back in `X-CSRF-Token`. This needs a console change; the `Origin` check does not.

**Check**
Sign in to the console on staging, then reload the page. You stay signed in, and
`POST /v1/admin/auth/refresh` answers `200`. A `POST` to the same URL with
`Origin: https://evil.example` still answers `403`.

---

## 21. Bank details change requests cannot be approved

**Priority:** High. A supplier who changes their bank account from the app gets a request the
office can only reject, so their payout keeps going to the old account.

**What is wrong**
`POST /v1/admin/change-requests/:id/approve` on a `bankDetails` request answers:

```json
{ "code": "invalid", "details": { "reason": "bank-details-approval-not-implemented",
  "hint": "the account number is not carried on the request row (Q3)" } }
```

The app sends the full details (`bankName`, `branchName`, `accountNumber`, optional
`accountName`) to the supplier requests endpoint
(`apps/api/src/modules/supplier-app/requests.controller.ts`, the `bankDetails` case), but the
API keeps only the masked summary (`"Bank of Ceylon ••••7890"`). The account number is dropped,
so at approval (`change-requests.service.ts`, `case 'bankDetails'`) there is nothing to apply.
`change_requests.requested_bank_detail_id` exists for this but is never filled.

**What to do**

1. **Keep the requested details, on their own row.** New table, for example
   `change_request_bank_details`: `change_request_id` (PK, FK), `factory_id`, `bank_name`,
   `branch_name`, `account_number` (store it the same way as
   `supplier_bank_details.account_number`), `account_number_masked`, `account_name` (nullable).
   Write it in the same transaction that creates the change request, and set
   `requested_bank_detail_id` (or just join on `change_request_id`).
2. **Apply it on approval.** In `applyChange`, `case 'bankDetails'`:
   - read that row;
   - find `bankCode` and `branchCode` in the bank catalogue by name (refuse with
     `422 unknown-bank` / `unknown-branch` if not found);
   - upsert `supplier_bank_details` for the supplier: codes, name snapshots, account number,
     masked number, `accountName` (the row's value, otherwise the supplier's registered name),
     `changeRequestId`, `updatedById`;
   - record the audit entry with the masked number only.
3. **Optional: account name at approval.** The app does not ask for the account holder's name.
   If you want the office to type it, accept an optional `accountName` in the approve body
   (`{ note, accountName? }`) and tell us: the console will add the field to the approve
   dialog. Until then, do not make it required.
4. **Old requests.** Requests already sent (like `7b6a4685-...` on staging) have no account
   number anywhere. Keep refusing those with the same reason; the office will reject them and
   ask the supplier to send the change again.

**Already done in the console:** this refusal now shows "Bank changes cannot be approved yet"
with what to do, instead of the generic error, and the Approve button is disabled. Nothing else
in the console needs to change for steps 1 and 2.

**Check**
In the app, change the bank account. In the console, approve the request: it answers `200`, and
the supplier's record shows the new bank and the new masked number.

---

## 22. Credit request detail always answers `403 feature-disabled`

**Priority:** High. No credit request (advance, loan or manure) can be opened in the console,
so none can be read before deciding it.

**What is wrong**
On staging, `GET /v1/admin/credit-requests/8878d038-ccc4-4300-9a5f-268a7a11777e` answers:

```json
{ "code": "feature-disabled", "details": { "flag": "enableLoans" } }
```

but the same request **is listed** by `GET /v1/admin/credit-requests?status=pending`, and the
dashboard counts it as a pending loan. So `enableLoans` is on; the detail endpoint just does
not see it.

The cause is in `apps/api/src/core/features/feature.guard.ts`. For a `@FeatureFromRecord`
route the guard returns **before** it loads the flags:

```ts
if (disposition.kind === 'fromRecord') return true;   // leaves early

const flags = await this.flags.forFactory(state.actor.factoryId);
(request as ...)[ENABLED_FLAGS] = flags;               // never reached for fromRecord
```

So `readFlags(request)` is `{}` in `creditRequestById`, and
`CreditRequestsService.byId()` sees every facility flag as off.

**What to do**
Load the flags first, then return for `fromRecord`. Move the `fromRecord` line below the
`ENABLED_FLAGS` assignment:

```ts
const request = context.switchToHttp().getRequest<Request>();
const state = readAuthState(request);
if (!state) throw new DomainError('unauthenticated', { reason: 'no session' });

const flags = await this.flags.forFactory(state.actor.factoryId);
(request as { [ENABLED_FLAGS]?: Record<string, boolean> })[ENABLED_FLAGS] = flags;

// The handler checks the flag after loading the record (Q17): the guard only supplies them.
if (disposition.kind === 'fromRecord') return true;
if (disposition.kind === 'filter') return true;
```

Please also add a test: with `enableLoans` on, `GET /admin/credit-requests/:id` for a loan
answers `200`; with it off, `403 feature-disabled`.

**Check**
In the console, open any credit request from the Credit queues screen. The detail shows, with
the Approve and Reject buttons.

---

## 23. Inquiry detail: send who closed it, and who entered it at the office

**Priority:** Low. Nothing breaks; the console shows "Closed unanswered" without a name.

**What is wrong**
`GET /v1/admin/inquiries/:id` (and the list) sends `closureNote` and `closedAt` but not
**who** closed the message, and for a message a clerk entered for a supplier (walk-in,
telephone) it does not say **who** entered it. The console has fields for both:
`closedByName`, `createdById`, `createdByName`.

**What to do**
Add these three fields to the inquiry response (the same names as above), `null` when not set.
If the table does not store them yet, store them when the inquiry is created and when it is
closed, the same way `repliedByName` is stored on reply.

**Check**
Close a message in the console: the detail screen shows "Closed by <name>, <date and time>".

---

## 24. Saving manure products turns the list into an object; manure requests break

**Priority:** High. Suppliers cannot request manure: the app's screen did not open, and sending
a request fails.

**What is wrong**
On staging, `GET /v1/config` serves `manureProducts` as an object keyed by index, not a list:

```json
"manureProducts": { "0": { "name": "Urea", ... }, "1": { "name": "T200 Mixture", ... } }
```

The cause is `PATCH /admin/config` in `apps/api/src/modules/admin/config-admin.service.ts`.
`manureProducts` is not in `WHOLESALE_BLOCKS`, so it goes through the merge branch:

```ts
data[columnFor(block)] = { ...existing, ...(value as object) };
```

Spreading an array into an object gives `{ "0": ..., "1": ... }`. A product deleted in the
console would also never be removed, because the old keys are kept.

The same object then breaks the API itself: `credit.controller.ts` (around line 285) calls
`products.find(...)` on it when pricing a manure request, which throws (`500`).

**What to do**

1. Add `manureProducts` to `WHOLESALE_BLOCKS`, like `banks`: the console always sends the
   whole list.
   ```ts
   const WHOLESALE_BLOCKS = new Set(['teaPackets', 'creditRules', 'payouts', 'banks', 'manureProducts']);
   ```
   Please check every other block that holds a list the same way.
2. Repair the rows already saved in this shape (staging has one). For example, once:
   ```sql
   UPDATE client_config
      SET manure_products = (SELECT jsonb_agg(value ORDER BY key::int)
                               FROM jsonb_each(manure_products))
    WHERE jsonb_typeof(manure_products) = 'object';
   ```
3. Add a test: save `manureProducts` twice through `PATCH /admin/config`, the second time
   with one product removed. `GET /config` answers a list with only the remaining product.

**Already done in the app:** it now reads this object shape as a list, so the manure screen
opens again. Sending a request still needs steps 1 and 2.

**Check**
In the app, open Request manure, pick Urea and send. It answers `201`, and the request shows
in the console's credit queue.

---

## 25. Inquiries as conversations: more than one message each way

**Priority:** Medium. A new feature the office asked for. The console and the app are already
built for it and switch on by themselves when the API sends `messages`; until then they
work exactly as today.

**What is wrong today**
An inquiry holds one question (`message`) and one answer (`reply_body`). After the office
answers, the supplier cannot say anything more about it, and the office cannot add a second
answer (`POST /admin/inquiries/:id/reply` refuses `already-answered`). A supplier with a
follow-up has to start a new inquiry, and the office loses the thread.

**The rules**
- **Open** (`open`, app `pending`): waiting for the office.
- **Answered** (`resolved`, app `approved`): the office wrote last. The supplier may still
  write; that moves it back to **Open** and into the queue.
- **Closed** (`closed`, app `rejected`): the office ended it. Nobody can write; the supplier
  starts a new inquiry.
- The office may reply while it is Open **or** Answered (to add something). Replying makes it
  Answered.

**What to do**

1. **Table** `inquiry_messages`: `id`, `factory_id`, `inquiry_id` (FK), `author`
   (`'supplier' | 'office'`), `author_id` (nullable), `author_name` (nullable), `body`,
   `created_at`. Index on `(inquiry_id, created_at)`. Row-level security like `inquiries`.
2. **Backfill** in the migration: for every inquiry, one `supplier` row from `message` at
   `created_at`, and one `office` row from `reply_body` at `replied_at` when it is set.
   Keep the old columns for now (see step 6).
3. **One message shape**, oldest first, on every response below:
   ```json
   { "id": "uuid", "author": "supplier", "authorName": "K.A. Sunil", "body": "...", "createdAt": "ISO" }
   ```
4. **Console endpoints**
   - `GET /admin/inquiries/:id`: add `messages` (the first one is the original question).
   - `GET /admin/inquiries`: add `lastMessageAt` and `lastAuthor`. While Open, measure
     `ageHours` from the supplier's **latest** message, so a follow-up does not jump the
     queue as if it had waited since the first question.
   - `POST /admin/inquiries/:id/reply` `{ body }`: allowed when Open or Answered (still `409`
     when Closed). Inserts an `office` message, sets the status to `resolved`, sends the
     existing `inquiryReplied` push. Audit `inquiry.reply` as today.
   - The `inquiryReplied` push: add `inquiryId` to its data (today it carries only
     `supplierId`), so tapping it opens that conversation in the app instead of the list.
   - `POST /admin/inquiries/:id/close`: unchanged.
5. **App endpoints**
   - `GET /inquiries`: add `messages` to each item.
   - `GET /inquiries/:id`: one inquiry with `messages` (new).
   - `POST /inquiries/:id/messages` `{ body }` (1 to 2000 characters, new): only the
     supplier's own inquiry. Inserts a `supplier` message; if the status is `resolved`, sets it
     back to `open`. Answers `409 inquiry-closed` when Closed. Returns the inquiry with
     `messages`. Audit `inquiry.message`. `@Feature('enableInquiry')`, `@Idempotent()`.
6. **Compatibility:** keep sending `message`, `reply` / `replyBody`, `repliedAt` and
   `repliedByName` (the first question and the latest office answer) until both apps have
   shipped, then they can go.

**Already done**
- Console: the detail screen shows the whole thread from `messages`, and lets a clerk reply
  again to an Answered inquiry when `messages` is present.
- App: Inquiries opens each conversation on its own screen, with a message box at the bottom
  when `messages` is present and the inquiry is not Closed.

**Check**
1. In the app, send a question. In the console, reply. In the app, open it: the reply is
   there, and the message box is too. Send a follow-up.
2. In the console the inquiry is Open again, with both supplier messages and the reply in
   order. Reply again; the app shows all four messages.
3. Close it in the console. In the app the message box is gone, with a note that it is closed.
