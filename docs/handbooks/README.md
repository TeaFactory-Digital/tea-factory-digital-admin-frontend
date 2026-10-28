# Logic handbooks

Plain-language guides to every rule the console and the app follow, for factory owners,
managers, office staff and support. Each comes in English, Sinhala and Tamil.

| File | What |
| --- | --- |
| `console.en.pdf`, `console.si.pdf`, `console.ta.pdf` | Admin Console: How It Works |
| `app.en.pdf`, `app.si.pdf`, `app.ta.pdf` | Supplier App: How It Works |

The sources are in `src/`: one HTML file per guide and language, and `handbook.css`. The
English is the source; the Sinhala and Tamil follow it tag for tag.

**When a rule changes:** edit `src/<guide>.en.html`, make the same change in the `si` and
`ta` files (using the words in the string tables), then from the repo root:

```sh
python3 -I docs/handbooks/src/check_translation.py console.en.html console.si.html
node docs/handbooks/src/build.mjs            # all six, or name some: console.si app.ta
```

The checker refuses a translation that lost a tag or a figure, kept a long English phrase,
or contains an em dash. `build.mjs` prints with Playwright's Chromium, which shapes Sinhala
and Tamil correctly (it uses the system's Sinhala Sangam MN and Tamil Sangam MN fonts).
