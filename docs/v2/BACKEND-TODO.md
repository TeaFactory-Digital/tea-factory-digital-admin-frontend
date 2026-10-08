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
| 43 | Seed all six static pages with the new text (en, si, ta) | Medium |

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

## 43. Seed all six static pages with the new text (en, si, ta)

The default text for **all six** static pages is now in this repository, written and checked
in English, Sinhala and Tamil: `docs/v2/static-pages.seed.json`.

| Page | Slug | Points |
|------|------|--------|
| Frequently asked questions | `faq` | 16 |
| The savings scheme | `savingsScheme` | 7 |
| Credit terms | `creditTerms` | 9 |
| About the factory | `about` | 5 |
| Terms of supply | `terms` | 17 |
| Privacy | `privacy` | 9 |

FAQ, Terms and Privacy are rewritten (they described old behaviour: savings interest paid every
year, calling the office for a forgotten password, fixed "6 months" and "three times" limits).
The savings scheme, credit terms and about pages are new. The shape is unchanged:
`{ slug, translations: [{ lang, title, body }] }`, points as `## ` lines, `{{factory}}`
replaced with the factory's name.

**To do:**
1. Copy the file over `apps/api/src/modules/tenant-defaults/static-pages.defaults.json`, and
   drop the "only faq, terms and privacy are seeded" note: the app has screens for all six now.
2. A factory that does **not** have a page gets it, published, as today.
3. A factory that **already** has a page: replace it with the new text **only if nobody in the
   office has touched it** (every translation still `updatedByName: 'System'`). A page the office
   has edited is theirs and must never be overwritten.
4. Never re-seed a page the office has edited, added points to or removed points from. These
   texts are only a starting point; the office owns them after that.

**Check:**
- A new factory gets all six pages, published, in all three languages, with its own name
  where the text says `{{factory}}`.
- On staging, a page the galaboda office edited is unchanged after a restart; an untouched
  seeded page shows the new text.
- After an office edit in the console, a restart does not bring the old text back.
