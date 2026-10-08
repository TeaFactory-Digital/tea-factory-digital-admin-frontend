# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (8 October 2026)

**Done and removed from this file: #1 to #43** (latest in `792a474` and `687fec9`, checked on
staging: galaboda's untouched Terms and Privacy now have the new text in en, si and ta; its
FAQ, savings scheme, credit terms and about pages were edited in the console and were kept).

**Still open:** nothing.

**Answers to the last note**
- **One refresh at a time:** confirmed, and now across tabs too.
  - Console, one tab: every caller already shared one in-flight promise.
  - Console, several tabs: was **not** covered. Fixed: the rotation now runs inside a Web
    Lock (`navigator.locks`, name `tfd-admin-refresh`), so a second tab waits and then
    sends the cookie the first tab's rotation set. Browsers without the API fall back to
    the per-tab promise.
  - Mobile app: one shared in-flight promise for every refresh, including the one at app
    start, and a phone runs one copy of the app, so it cannot send two at once.
- **Seed note:** updated. The `_note` in `static-pages.seed.json` now says untouched pages
  are refreshed too. That changes the file, so please copy it over the defaults again
  (only the `_note` differs; the pages are the same).
