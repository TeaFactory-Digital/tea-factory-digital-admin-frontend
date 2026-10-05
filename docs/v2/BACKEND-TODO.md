# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (4 October 2026)

**Nothing open.** Items #1 to #25 are done and have been removed from this file. The last
batch (#19 to #25) is in `285b489`, `94844db` and `b683ed2`, and was checked on staging:

- #19 change request detail sends `decidedAt` and `decidedById`.
- #20 refresh accepts the console's `Origin` (no more `403 csrf`).
- #21 bank details change requests can be approved.
- #22 credit request detail opens.
- #23 inquiries send `closedByName` and `createdByName`.
- #24 `manureProducts` is a list again, and saved wholesale.
- #25 inquiries are conversations (`messages`, `POST /inquiries/:id/messages`).

New items will be added below as they are found.

---

## 27. Savings report: savings held across the factory, month by month

**Priority:** Medium. A new report the office asked for. The console's Reports screen has a
Savings tab that is already built and switches on by itself when this exists; until then it
says the report is not available yet.

**What is missing**
There is no way to see how much the factory is holding for all suppliers together. One
supplier's passbook exists (`GET /admin/savings/:supplierId/ledger`, now shown on the
supplier record), but there is no total.

**What to do**
Add a report `savingsHeld` to `REPORTS` in `apps/api/src/modules/admin/reports.service.ts`,
so it answers `GET /v1/admin/reports/savingsHeld` like `channelShift` does. Feature
`enableSavings`; capability `reports: R`.

One row per month that has any savings entry, **oldest first**:

```json
{
  "rows": [
    { "monthKey": "2026-09", "paidIn": 130000.00, "takenOut": 30000.00,
      "balanceTotal": 1000000.00, "suppliersSaving": 415 }
  ]
}
```

- `paidIn`: sum of `savings_entries.amount` where `amount > 0` in that month.
- `takenOut`: sum of `-amount` where `amount < 0` in that month (sent as a positive number).
- `balanceTotal`: for every supplier, their latest `balance_after` up to and including that
  month (by `seq`), summed. This is the figure an auditor reconciles, so compute it from
  `balance_after`, not by adding `paidIn - takenOut` across months.
- `suppliersSaving`: how many of those latest balances are above zero.
- Optional `from` / `to` (`YYYY-MM`), the same as `channelShift`.

Read only: the report changes nothing.

**Check**
Open Reports, then Savings, in the console. "Savings held" equals the sum of every supplier's
"Balance now" on their savings passbook.

---

## 28. Queues ignore `supplierId`, so "this supplier's requests" shows everyone's

**Priority:** High. The office is shown other suppliers' requests while believing they are
looking at one supplier.

**What is wrong**
The console's supplier record has quick links to that supplier's requests:
`/credit?supplierId=…`, `/tea-packets?supplierId=…`, `/inquiries?supplierId=…`. The console
sends `supplierId` to the API, but the query schemas in
`apps/api/src/modules/queues/queues.controller.ts` (`queueQuerySchema`, `creditQuerySchema`,
`inquiryQuerySchema`, and the tea packets one) have no `supplierId`, and zod drops unknown
keys. So the filter is silently ignored and every supplier's rows come back.

Checked on staging (5 October) with a supplier id that does not exist: credit requests
answered 2 rows, tea packet requests 1, inquiries 3. All should be 0.

**What to do**
1. Add `supplierId: z.string().uuid().optional()` to those schemas.
2. In each list (`CreditRequestsService.list`, the tea packets list, `InquiriesService.list`,
   and the change requests list), add `...(query.supplierId ? { supplierId: query.supplierId } : {})`
   to the `where`.
3. Consider making these schemas `.strict()`, so a filter the API does not know is refused
   (`400`) instead of silently ignored. That is how this bug stayed hidden.

**Check**
`GET /admin/credit-requests?status=rejected&supplierId=00000000-0000-0000-0000-000000000000`
answers no rows. Open a supplier in the console, press "Credit requests": only that
supplier's requests are listed.

---

## 29. Credit and tea packets report: what was given out, month by month

**Priority:** Medium. A new report the office asked for. The console's Reports screen has a
"Credit & tea packets" tab that is already built and switches on by itself when this exists.

**What to do**
Add a report `creditGiven` to `REPORTS` in `apps/api/src/modules/admin/reports.service.ts`,
answering `GET /v1/admin/reports/creditGiven` like `channelShift`. Capability `reports: R`;
no feature flag on the report itself (a facility that is off simply has zeros).

One row per month, **oldest first**, counting requests by the month they were **decided**
(`decided_at`, Asia/Colombo):

```json
{
  "rows": [
    { "monthKey": "2026-09",
      "advanceAmount": 50000.00, "advanceCount": 5,
      "loanAmount": 300000.00,   "loanCount": 2,
      "manureAmount": 0.00,      "manureCount": 0,
      "teaPacketAmount": 3000.00, "teaPackets": 6,
      "rejected": 1 }
  ]
}
```

- `advance*`, `loan*`, `manure*`: approved `credit_requests` of that facility; amount is the
  approved `amount`, count is the number of requests.
- `teaPackets`: the number of **packets** in approved `tea_packet_requests`;
  `teaPacketAmount` their `amount`.
- `rejected`: rejected requests of all four kinds in that month.
- Optional `from` / `to` (`YYYY-MM`), the same as `channelShift`.

**Check**
Approve one advance in the console, then open Reports, then Credit & tea packets: this
month's Advances goes up by that amount and by one request.

---

## 30. Delete a console user, three days after it is asked for

**Priority:** Medium. A new feature the office asked for. The console's Users screen is
already built for it: a Delete button, a "Deletes on <date>" badge, and Cancel deletion.

**The rules**
- Deleting **waits three days**, so a mistake can be undone. During those days the account
  **cannot sign in** (treat it as suspended, and end its sessions at once).
- **Cancel deletion** during the three days makes the account active again.
- After three days the account is **removed from the console**: it is gone from
  `GET /admin/users`, cannot sign in, and its email can be used for a new account.
- **Names stay on records.** Audit entries, decisions (`decidedByName`), replies and
  published content keep the name they recorded. So do not cascade-delete anything, and
  prefer a soft delete (`deleted_at`) on `console_users` over removing the row, because
  other tables point at the user's id.
- Same refusals as suspending: not your own account (`409 self-modification`), and not the
  last person who can manage users (`409 last-admin`). A reason of at least 10 characters
  (`422 note-required`).

**What to do**
1. `console_users`: add `deletes_at timestamptz null` and `deleted_at timestamptz null`.
2. `POST /v1/admin/users/:id/deletion` `{ reason }`, capability `usersAndRoles: W`: set
   `status = suspended`, `deletes_at = now() + 3 days`, bump the grant cache version, revoke
   the user's refresh tokens. Answer `{ id, deletesAt }`. Audit `user.deletionScheduled`.
3. `DELETE /v1/admin/users/:id/deletion` `{ reason }`: only while `deletes_at` is set and in
   the future; clear it and set `status = active`. Audit `user.deletionCancelled`.
4. `GET /admin/users`: add `deletesAt` to each row; leave out rows with `deleted_at` set.
5. A sweep (hourly, like the upload sweeper): for rows whose `deletes_at` has passed, set
   `deleted_at = now()` and free the email (for example append `#deleted-<id>` so the unique
   index allows a new account). Audit `user.deleted`.
6. Login and refresh refuse an account with `deleted_at` set, the same as an unknown email.

**Check**
In the console, delete a user: the row shows "Deletes on" three days ahead, and that person
cannot sign in. Cancel it: they can sign in again. Let it pass (or move `deletes_at` back in a
test): the row is gone, and their name still shows on audit entries they made.

---

## 31. App versions: tell old apps to update

**Priority:** High before release. The app is built for it; nothing happens until this is sent.

Add an `app` block to `GET /v1/config`, set per factory (or one value for all):

```json
"app": {
  "minVersion": "1.0.0",
  "latestVersion": "1.2.0",
  "iosStoreUrl": "https://apps.apple.com/app/id...",
  "androidStoreUrl": "https://play.google.com/store/apps/details?id=lk.galaboda.app"
}
```

- Below `minVersion` the app shows a full screen "Please update the app" with a button to the
  store, and cannot be used. Raise it only when the API stops supporting an old app.
- Below `latestVersion` the app offers the update once, with "Later".
- Versions are compared part by part (`1.10.0` is newer than `1.9.0`).

**Check:** set `minVersion` above the installed app's version: the app shows the update screen.

---

## 32. Supplier asks to delete their app account

**Priority:** High. Google Play and the App Store require an app with accounts to offer this.

`POST /v1/profile/deletion-request` `{ password, reason? }` (supplier realm):
- Check the password (`401 invalid` if wrong, like sign-in).
- Record the request (who, when, reason), revoke every refresh token and device of the supplier,
  and stop the app account signing in. Answer `202 { requestedAt }`. Audit
  `supplier.deletionRequested`.
- Delete the **app account** (sign-in, devices, notification settings) within 30 days. **Do not**
  delete the factory's records of leaf, bills, savings or credit: the factory keeps those by
  law, and the app screen says so.
- Show the request to the office (a list, or an entry on the supplier's record), so they know
  the supplier left the app.

Google Play also asks for a **web page** where a supplier can ask for deletion without the app.
A simple page with the factory's phone number and email is enough; give us the URL and we will
add it to the store listing.

**Check:** in the app, Settings, Delete my account, enter the password: the app signs out, and
signing in again with that password is refused.

---

## 33. Supplier cancels a pending request

**Priority:** Medium. The app shows "Cancel request" on pending advance, loan, manure and tea
packet requests.

`POST /v1/advances/:id/cancel`, `/v1/loans/:id/cancel`, `/v1/manure-requests/:id/cancel`,
`/v1/tea-packets/:id/cancel` (supplier realm, own requests only):
- Only while `pending`; set the status to `cancelled` and answer `{ id, status: "cancelled" }`.
- Already decided: `409 already-decided` (the app explains it).
- The list endpoints return `status: "cancelled"` for these; the console queues should leave
  them out of "pending" (show them under rejected, or a Cancelled filter).
- A cancelled advance, loan or manure request no longer counts against the supplier's limit.
- Audit `creditRequest.cancelled` / `teaPacketRequest.cancelled` with the supplier as actor.

**Check:** send an advance in the app, cancel it: it shows "Cancelled", the console queue no
longer has it, and the advance limit is back.

---

## 34. Push: today's leaf weight

**Priority:** Medium. The app has the category; suppliers see it in notification settings once
the factory offers it.

- New push category `leafWeighed`. Add it to the categories the console can offer
  (`config.push.categories`) and to the trigger rows.
- When a day's deliveries for a supplier arrive from the factory system (the sync), send one
  push per supplier per day: title "Leaf weighed", body like "Today 42.5 kg" (in the supplier's
  language), data `{ category: "leafWeighed", date: "2026-10-05", kgs: "42.5" }`. Tapping opens
  the Account tab.
- Send once per day even if the sync runs several times (key on supplier and date).

**Check:** sync a delivery for a supplier whose phone has the category on: the push arrives once.

---

## 35. Inquiries: who is handling it, and office-only notes

**Priority:** Medium. The console shows "Handling" and "Office notes" on each inquiry, and an
"Assigned to" column in the list.

- `inquiries`: add `assigned_to_id`, `assigned_to_name` (nullable). New table
  `inquiry_notes` (`id`, `factory_id`, `inquiry_id`, `body`, `author_id`, `author_name`,
  `created_at`).
- `POST /v1/admin/inquiries/:id/assignment` `{ assignToMe: boolean }`, capability
  `inquiries: A`: set (or clear) the assignee to **the caller**. Answer
  `{ id, assignedToId, assignedToName }`. Audit `inquiry.assigned`.
- `POST /v1/admin/inquiries/:id/notes` `{ body }` (2 to 2000 characters), capability
  `inquiries: R`: add a note by the caller. Audit `inquiry.note`.
- `GET /admin/inquiries/:id`: add `assignedToId`, `assignedToName`, and `notes` (oldest first).
  `GET /admin/inquiries`: add `assignedToId`, `assignedToName`; optional filter
  `assignedTo=me`.
- **Never** send notes or the assignee to the app.

**Check:** press "Assign to me" on an inquiry, add a note: both show after a reload, and the
app's conversation shows neither.

---

## 36. News: publish at a chosen time

**Priority:** Medium. The console has "Schedule…" on a draft. (Banners already have their
Starts / Ends window.)

- `news_articles`: add `scheduled_publish_at timestamptz null`.
- `POST /v1/admin/news/:id/schedule` `{ publishAt }` (ISO instant), capability `content: A`:
  only a draft, only a future time (`422 invalid` otherwise). Answer
  `{ id, scheduledPublishAt }`. Audit `news.scheduled`.
- `DELETE /v1/admin/news/:id/schedule`: clear it. Audit `news.scheduleCancelled`.
- `GET /admin/news/:id` and the list: add `scheduledPublishAt`.
- A job (every minute or five) publishes articles whose time has come, exactly as the
  Publish button does (same checks, same push to `newsArticle`, `publishedByName` = the person
  who scheduled it), and clears the schedule. If the publish is refused (for example the English
  copy was removed), clear the schedule and record why in the audit.

**Check:** schedule a draft two minutes ahead: it publishes itself and appears in the app.

---

## 37. Console user forgot their password: an administrator issues a new one

**Priority:** Medium. There is no mail sender, so no reset link; the console's Users screen has
"Reset password", and the sign-in screen says to ask an administrator.

`POST /v1/admin/users/:id/password/reset` `{ reason }` (10+ characters), capability
`usersAndRoles: W`:
- Not your own account (`409 self-modification`).
- Generate a one-time password (the same rules as a supplier reset), store its hash, set
  `owes_password_change = true`, revoke the user's sessions. Answer `{ password, issuedAt }`.
  The password is in this answer only, never logged.
- Audit `user.passwordReset` with the reason (not the password).

**Check:** reset a clerk's password, sign in as the clerk with it: the console asks them to
choose their own.

---

## 38. Configuration: the office's own "common notes" chips

**Priority:** Low. The console has a Common notes section in Configuration; the decision and
reply boxes already use what it saves.

- `client_config`: add `note_suggestions jsonb null`. Serve it as `noteSuggestions` on
  `GET /admin/config` (**not** on the app's `GET /config`; these are office words).
- Accept `noteSuggestions` on `PATCH /admin/config` and save it **wholesale** (add it to
  `WHOLESALE_BLOCKS`), so a deleted chip does not come back from a merge.
- Shape: keys `changeRequests.approve`, `changeRequests.reject`, `credit.approve`,
  `credit.reject`, `teaPackets`, `inquiries.reply`; each a list of
  `{ label: { en, si, ta }, text: { en, si, ta } }` (any language may be missing). Refuse more
  than 12 chips per list or a text longer than 300 characters (`422 invalid`).

**Check:** in Configuration, Common notes, add a chip to Inquiry replies and save: it appears
under the reply box of an inquiry, and a reload keeps it.
