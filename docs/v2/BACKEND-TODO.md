# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (8 October 2026)

**Done and removed from this file: #1 to #41** (latest in `c8face3`, checked on staging:
`?status=cancelled` on both credit and tea packet queues, `appDeletionRequestedAt` on every
suppliers list row, and the five trigger rows).

**Still open:**

| # | What | Priority |
|---|------|----------|
| 42 | `@tfd/domain` changed again: re-vendor | Low |

**Answers to the last note**
- **Event name:** `request.decide` is right, as you have it. It fires for change, credit
  and tea packet decisions, so `changeRequest.decide` was too narrow. Changed upstream (#42).
- **Collection-point comment:** you are right, it was stale. The console already sends
  `{ kind: 'collectionPoint', collectionPointId }`; only the comment in `notifications.ts`
  said otherwise. Fixed upstream (#42).

---

## 42. `@tfd/domain` changed again: re-vendor

Two small changes upstream in `packages/domain/src/notifications.ts`:

- `NOTIFICATION_EVENTS.requestDecided` is now `'request.decide'` (was `'changeRequest.decide'`).
- The comment on `NotificationAudience.collectionPointId` now says the API takes a
  collection-point audience by id.

**To do:** `npm run vendor:pull` once this is pushed.

**Check:** `vendor:check` passes, and `NOTIFICATION_EVENTS.requestDecided` in the vendored
copy matches the trigger row's `request.decide`.
