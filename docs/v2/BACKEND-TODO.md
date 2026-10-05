# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (5 October 2026)

**Done and removed from this file: #1 to #25 and #27 to #30** (latest in `e8c65af` and
`955fff2`, checked on staging).

**Still open:**

| # | What | Priority |
|---|------|----------|
| 26 | Staging sleeps (Render free plan), so the first screen sometimes does not load | Medium |
| 31 | App versions: tell old apps to update | High before release |
| 32 | Supplier asks to delete their app account | High |
| 33 | Supplier cancels a pending request | Medium |
| 34 | Push: today's leaf weight | Medium |
| 35 | Inquiries: who is handling it, and office-only notes | Medium |
| 36 | News: publish at a chosen time | Medium |
| 37 | Console user forgot their password: an administrator issues a new one | Medium |
| 38 | Configuration: the office's own "common notes" chips | Low |

**Answers to the last note**
- **#26 exists** (below): it is about hosting, not code. Items #31 to #38 were added after
  the copy you had.
- **Queues and `.strict()`:** the console was sending `sort` and `dir` to all four queues, and
  staging refused every one of them (`422 unrecognized_keys`), so the queue screens did not
  load. Fixed in the console: the queues no longer send a sort (the API never applied one;
  the queues are oldest waiting first). Nothing to do on your side. If you want sortable
  queues later, accept `sort` and `dir` and tell us.
- **#25 legacy fields** (`message`, `reply`, `replyBody`, `repliedAt`, `repliedByName`): keep
  sending them. Neither app has shipped the conversation version to the stores yet; we will
  tell you when both have.

---

## 26. Staging sleeps, so the app's first screen sometimes does not load

**Priority:** Medium for testing; must be solved before suppliers use it.

**What is wrong**
`render.yaml` runs the API on `plan: free`. Render stops a free service after about 15
minutes with no requests, and the next request waits while it starts again (often 30 to 60
seconds, plus Neon waking the database). The app's timeout is 45 seconds, so the first
request after a quiet spell can time out: the Account tab shows an error or an empty state,
and the token refresh at launch can fail the same way and sign the supplier out.

Measured on 5 October: a warm request answers in about 0.45 s.

**What to do (choose one)**
1. **Recommended for production:** a paid Render plan (Starter or above) for the API. It
   does not sleep.
2. **For staging only:** keep it awake with a request every 10 minutes, for example a free
   uptime monitor or a GitHub Actions schedule calling
   `GET https://tfd-api-fja1.onrender.com/v1/config` with `X-Tenant: galaboda`. (Render may
   still restart it occasionally; this only makes it rare.)

**Already done in the app:** a long first load says the server is starting; the Account tab
can be pulled down to refresh, and reloads when the app comes back to the front; the data
cache is cleared on sign-out; and the last data is kept on the phone for offline use.

**Check**
Leave staging unused for 30 minutes, then open the app: the Account tab loads within a few
seconds.

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
