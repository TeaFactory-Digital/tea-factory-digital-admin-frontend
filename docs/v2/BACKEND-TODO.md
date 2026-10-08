# Backend to-do

Backend fixes found while testing the admin console and the mobile app against staging.
Each item says what is wrong, where, and what to change.

## Status (9 October 2026)

**Done and removed from this file: #1 to #43** (latest in `792a474` and `687fec9`, checked on
staging: galaboda's untouched Terms and Privacy now have the new text in en, si and ta; its
FAQ, savings scheme, credit terms and about pages were edited in the console and were kept).

**Still open:**

| # | What | Priority |
|---|------|----------|
| 44 | Static pages: serve the default text, so the office can restore it | Medium |

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

---

## 44. Static pages: serve the default text, so the office can restore it

The console's static page editor now has a **Restore default text** button. It loads the
starting text for that page and language into the form; nothing is stored until the editor
presses Save, which is the existing `PUT .../translations/:lang`. It is how an office that
has edited a page can go back to the default, which the seed on its own never does for an
edited page (#43).

The console calls this, and answers "not available on this server" while it 404s:

```
GET /admin/static-pages/:slug/default?lang=en|si|ta
200 { "slug": "faq", "lang": "si", "title": "...", "body": "..." }
```

- The text comes from `static-pages.defaults.json` (the same file the seed uses), with
  `{{factory}}` replaced by the factory's name, exactly as when seeding.
- `lang` missing: use the editorial fallback (`en`).
- `404 not-found` when the slug is not one of the six, or the file has no text for that
  language.
- Permission: the same as reading static pages (`content: R`). It is a read; the save that
  may follow is the existing write and is audited as today.
- It must not change the page or count as an office edit. Only the Save that follows does,
  and after that the page is the office's, as #43 already treats it.

**Check:** `GET /admin/static-pages/faq/default?lang=si` answers the Sinhala FAQ from the
defaults file with galaboda's name in it, and the page itself is unchanged.
