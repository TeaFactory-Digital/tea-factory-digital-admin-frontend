# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (6 October 2026)

**Done and removed from this file: #1 to #38** (latest in `b9de4ed`, `c0b981d`, `b7c203a`
and `a5ac903`, checked on staging). #26 is as far as code can take it; the paid plan is a
decision for the factory, not a backend task.

**Still open:**

| # | What | Priority |
|---|------|----------|
| 39 | `@tfd/domain` has `leafWeighed` and `cancelled` now: re-vendor | High |
| 40 | Queues: accept `?status=cancelled` (separate filter, not under rejected) | Medium |
| 41 | Suppliers list: send `appDeletionRequestedAt` on each row | Low |

**Answers to the last note**
- **Cancelled requests:** a separate **Cancelled** filter, please (#40). Cancelling is the
  supplier's act, not the office's decision; counting it under Rejected would make the
  office look like it refused requests it never saw.
- **Audit action names:** thanks. The console now labels every name in your
  `ACTION_REGISTRY`, including `creditRequest.cancel`, `teaPacketRequest.cancel` and
  `news.scheduleCancel`. Several older labels were under contract names the server never
  used (`user.create` where you write `consoleUser.create`, and so on), so those rows showed
  the raw verb; both spellings are labelled now.
- **New supplier fields:** the supplier page now shows "Left the app", with the date and
  reason, from `appDeletionRequestedAt`, `appDeletionReason` and `appAccountErasedAt`.

---

## 39. `@tfd/domain` has `leafWeighed` and `cancelled` now: re-vendor

Added upstream in `packages/domain/src`:

- `types/app.ts`: `RequestStatus` is `'pending' | 'approved' | 'rejected' | 'cancelled'`, and
  `NotificationCategory` includes `'leafWeighed'`.
- `notifications.ts`: `NOTIFICATION_EVENTS.leafWeighed = 'delivery.sync'`, so
  `NOTIFICATION_CATEGORIES` has five entries.
- `types/admin.ts`: `AdminSupplier` has `appDeletionRequestedAt`, `appDeletionReason` and
  `appAccountErasedAt` (optional, `string | null`).

**To do:** `npm run vendor:pull`, then turn the test that asserts `PUT /devices` refuses
`leafWeighed` into one that accepts it.

**Check:** `PUT /devices` with `categories: ["billPublished", "leafWeighed"]` answers 200.

## 40. Queues: accept `?status=cancelled`

`GET /admin/credit-requests` and `GET /admin/tea-packet-requests` validate `status` as
`pending | approved | rejected` (`queues.controller.ts`, line 45). The console now offers a
**Cancelled** filter on both screens, and staging answers it with **422**.

**To do:** add `cancelled` to that enum for those two queues, and return only the cancelled
rows for it. Keep `?status=rejected` meaning rejected by the office only. Change requests
cannot be cancelled, so that queue can keep refusing it.

**Check:** `GET /admin/credit-requests?status=cancelled` answers 200 with only `cancelled` rows.

## 41. Suppliers list: send `appDeletionRequestedAt` on each row

The detail now says a supplier left the app, but the list row only has `hasApp: false`, so in
the list a supplier who left reads as **"Never installed"**. The console already shows a "Left
the app" badge when the field is there.

**To do:** add `appDeletionRequestedAt` (ISO string or `null`) to each row of
`GET /admin/suppliers`.

**Check:** a supplier who asked to delete their app account has a date in that field in the list.
