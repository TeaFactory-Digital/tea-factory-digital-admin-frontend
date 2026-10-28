# User manuals

Step-by-step guides with screenshots, for the people who use the products: suppliers (and
the office staff who help them) for the app, and the factory office for the console. The
rules behind each screen are in [`../handbooks/`](../handbooks/).

| File | What |
| --- | --- |
| `app-manual.en.pdf`, `app-manual.si.pdf`, `app-manual.ta.pdf` | Supplier App User Manual |
| `console-manual.en.pdf`, `console-manual.si.pdf`, `console-manual.ta.pdf` | Admin Console User Manual |

Each language has its own screenshots, taken with the app and the console in that language
(`images/app-si/`, `images/console-ta/` and so on). Sample records (names, news titles,
inquiry text) stay in English: they are data, not labels.

## Sources

- `src/<manual>.<lang>.html` and `src/manual.css` (which imports the handbook style). The
  English is the source; check a translation with
  `python3 -I docs/manuals/src/check_translation.py app-manual.en.html app-manual.si.html`.
- `images/app/`, `images/console/` (English) and `images/app-si/`, `images/app-ta/`,
  `images/console-si/`, `images/console-ta/`: the screenshots, as compressed JPEGs.

```sh
node docs/manuals/src/build.mjs        # all manuals, or name some: app-manual.en
```

## How the screenshots were made

They show the real console and the real app, with sample data only; no real supplier's
data is in them.

- **Console:** the console's own Playwright setup (`apps/admin/e2e/fixtures.ts`), which
  answers every API call with the sample data in `services/mocks/handlers.ts`, at
  1440 × 900, with the console's language set before sign-in and each button found through
  the string tables. A few screens use a temporary override (an imported-bills factory).
- **App:** a Debug build in the iOS simulator (iPhone 16), pointed at a small local demo API
  that served the app's own test fixtures (`src/services/mock/`, supplier 5708, July 2026)
  and worked out credit limits with `packages/domain` (`buildCreditEligibility`). A
  temporary, uncommitted driver in the app moved between screens, scrolled and filled the
  example forms. None of that is in either repo; retaking the app screenshots means setting
  it up again.
