# White-label

One bundle, many branded factory consoles. Everything that differs between
factories is data served at runtime — identity, theme, feature flags, bank list,
savings options, collection points — never forked code.

The mobile equivalent is the mobile repo's `docs/white-label.md`. Read that for
the product rules; this document is the console's implementation of them.

---

## The one structural difference from mobile

```
mobile:   APP_CLIENT env var  ─► clients[id]  ─► ThemeProvider  (fixed for the app's life)
console:  subdomain / token   ─► GET /config  ─► CSS variables  (per session)
```

The mobile app resolves its brand at **build** time: one binary per factory,
`APP_CLIENT` baked in. The console cannot. There is one deployment, and which
factory it shows depends on the subdomain it was reached through.

So the console **cannot `import { clientA }`**. It fetches the same `/config`
payload the app does and themes itself from that. Which is the point: the office
sees its own colours and logo, and a platform admin switching tenants sees the
console rebrand.

---

## The Tailwind problem, and the fix

Tailwind generates its utility classes at **build** time. The brand does not
exist until a fetch resolves at **runtime**. Those two facts are in direct
conflict, and everything below is the resolution.

**One level of indirection.** Every Tailwind token is declared as a `var()`
pointing at a `--brand-*` property, and `applyTheme()` writes those properties
onto `documentElement` once the tenant is known.

```css
/* src/styles/theme.css — build time */
@theme {
  --color-primary: var(--brand-color-primary);
}
```
```ts
// @tfd/brand css.ts — runtime, per tenant
element.style.setProperty('--brand-color-primary', theme.colors.primary);
```
```
.bg-primary { background-color: var(--color-primary) }   ← generated
             → var(--brand-color-primary)                 ← written at runtime
             → #2E8B57                                     ← Galaboda's green
```

The payoff is that **the golden rule survives onto the web**: `bg-primary` is
brand-driven and needs no rebuild to rebrand, and `bg-[#128C7E]` is a lint error.
There is no legal way to write a colour into a component.

### Three consequences

1. **`--color-*: initial` drops Tailwind's default palette.** There is no
   `bg-red-500` in this codebase — a status colour that is not
   `error`/`warning`/`success`/`info` is a colour the factory cannot rebrand.
   `transparent` and `currentColor` survive because they are structural.
2. **No fallback values in the `var()` calls.** Fallbacks would mean the palette
   is written twice — in CSS and in `@tfd/brand` — and the copies would drift.
   Instead `main.tsx` applies the bundled tenant theme **synchronously before the
   first render**, so a paint never happens without brand properties present.
3. **dp becomes px in exactly one place.** The scale tokens are shared with a
   React Native bundle and are therefore unitless; `packages/brand/src/css.ts` is
   the only file that decides they mean pixels.

---

## Resolving the tenant

```
galaboda.admin.teafactory.lk    ─┐
hillcountry.admin.teafactory.lk  ├─► same static bundle ─► GET /config per subdomain
highland.admin.teafactory.lk    ─┘
```

`packages/brand/src/tenant.ts` parses it, as a pure function so it is testable
without a DOM:

| Host | Result |
| --- | --- |
| `galaboda.admin.teafactory.lk` | `galaboda` (source: `subdomain`) |
| `admin.teafactory.lk` | `null` → fallback. It is the bare deployment, not a factory called "admin" |
| `localhost` | `null` → `VITE_DEFAULT_TENANT` |
| `localhost?tenant=highland` | `highland` (source: `override`) — **development only** |

**The `?tenant=` override is off in production.** A query parameter that
repointed a live console at another factory would be a tenant-switch primitive in
the URL bar. The token still governs, but the request would be routed and themed
as someone else, which is confusing at best.

**Resolved once, at module load.** A tenant that could change mid-session would
mean every cached query, every open form and the applied theme belong to a factory
that is no longer selected. The dev switcher therefore reloads the page — which is
also what production does, since switching tenant there means a different
subdomain and a fresh document.

**The subdomain is a routing hint, never an authorization decision.** The
authoritative tenant is inside the access token; a mismatch is a `403`. See
[api-contract.md](./api-contract.md) §1.2.

---

## Bundled fallback vs served config

The pattern is the app's, one layer deeper: **bundled value is the default,
served value overrides it, and the UI never blocks on the fetch.**

```
bundled defaults  ──►┐
                     ├─► merged RuntimeConfig ─► RuntimeConfigProvider ─► useFeatureFlag()
served /config    ──►┘
```

`configRepository.get()` **never throws**. A failed fetch resolves to the bundled
config with `degraded: true`, and the shell shows one honest line — "showing
bundled defaults" — instead of an error page where a working console should be.

Three things are bundled, for different reasons:

| Bundled | Why |
| --- | --- |
| **Brand colours** per tenant (`@tfd/brand`'s registry) | A grey login screen is a visible regression, and a colour cannot be wrong in a way that misleads anyone |
| **One default mark** (`public/brand/logo.svg`, wired up in `brand/assets.ts`) | Same argument as the colours: artwork cannot be wrong in a way that misleads anyone, and two grey initials on the login screen of a tea factory is a visible regression. It is *one* generic mark, never a factory's own — see below |
| **Neutral identity + all flags on** (`config/defaults.ts`) | A per-tenant name and telephone number here would be a second source of truth, and *a wrong telephone number in a shipped bundle is exactly what serving config was meant to fix* |

The bundled mark is the **default**, not a source of truth. `branding.logoUrl` from
`GET /config` wins wherever it is set, so a factory that uploads artwork in M14
sees its own without a deploy. `Logo` walks the chain
`served → bundled → initials`: the last step is what keeps the promise that a new
factory can be brought live *without waiting on artwork*, and it is also what a
404'd CDN link degrades to instead of a broken-image glyph in the sidebar.

Note what is deliberately **not** bundled per tenant: there is no `galaboda.svg`.
A tenant-specific image file in the bundle would be a second source of truth for
that factory's identity, which is the mistake the neutral-identity row above
exists to avoid.

Flags default **on**. The alternative hides queues from a clerk whenever `/config`
is slow, which reads as "the manure requests have disappeared". Defaulting on
risks briefly showing a queue the factory does not use, which reads as an empty
inbox. The second failure is the cheaper one — and the API is the authority
either way (`403 feature-disabled`).

An **unknown tenant falls back to the neutral base**, deliberately not to another
factory's green: a clerk pointed at the wrong deployment must be able to tell.

---

## Feature flags

A factory's feature set is data. Every surface not all factories offer is gated on
a flag and read with `useFeatureFlag('…')` — **never by branching on the tenant
id.**

```tsx
const flags = useFeatureFlags();
// Flag first, then capability. Asking in the other order shows a manure queue to
// a manager at a factory that has never sold fertilizer.
const visible = (!item.flag || flags[item.flag]) && can(grants, item.capability);
```

| Flag | Gates in the console |
| --- | --- |
| `enableAdvances` · `enableLoans` · `enableManure` | The M7 credit queues, independently — a factory that lends against leaf may not lend against income history |
| `enableInquiry` | M10 |
| `enableNews` | M11 |
| `enablePushNotifications` | M13 |
| `enableSavings` | M8 |
| `enablePayouts` | M6 |
| `enableReports` | M16 |
| `enablePromoBanner` | The banner editor inside M11 |

A flag turns a surface off **end to end**: the sidebar row disappears, the route
is never reached, the dashboard omits the queue entirely rather than showing
`0` — and the API refuses the call with `403 feature-disabled` (AC-07). All four
are required. *"Otherwise a clerk is staffing an inbox nothing can reach."*

The reduced-feature reference is **`highland`**: no loans, no manure, no push, no
reports. Switching to it in the dev switcher should visibly empty those rows out
of the sidebar, which is the fastest way to check nothing is hardcoded. A
Playwright spec asserts exactly that.

---

## Localization

**si/en/ta chrome, si/en/ta content.** Both halves, for different reasons:

- **The chrome ships in all three.** Every label resolved through `t()` from the
  start — never a literal — and that is the whole reason Sinhala and Tamil arrived
  as a **copy deliverable** rather than a refactor of every screen. `src/i18n/locales/`
  holds one table per language, and the two additions are typed
  `Record<TranslationKey, string>` against `en`: **a key present in English and
  missing from another language is a compile error**, not a screen that quietly
  falls back in front of a weighing-point clerk. `fallbackLng` stays as a runtime
  net for a build that ships anyway; it is not the guard.
- **Editorial content is authored in all three**, driven by
  `config.localization.contentLanguages`, because a Sinhala supplier reading an
  English-only FAQ is the app failing. Missing translations must be visible to the
  editor (AC-08).

### Choosing a language

`LanguageSwitcher` — a three-segment pill in the topbar **and on the sign-in
screen**. Sign-in is not a courtesy: the preference lives in `localStorage`, so it
survives from whoever used the shared machine last, which means the person who most
needs to change it arrives at a screen they cannot read. It is also the one control
there that works without a session.

Three rules the control has to hold:

- **The options never go through `t()`.** `src/i18n/languages.ts` is the single
  source of truth for the labels, and they are literals on purpose. A picker must
  show every option in its own script whatever the active language is — a Tamil
  clerk on a Sinhala console finds the way out by recognising தமிழ், not by reading
  a Sinhala word for "Tamil". (`content.language.*` in the string tables is a
  different job and stays translated: that is for *talking about* a language in
  prose, where the reader's own language is the right one.)
- **It is one tab stop, not three.** `radiogroup` semantics with a roving tabindex
  and wrapping arrow keys. Three `aria-pressed` buttons would announce as three
  unrelated controls in a topbar that already has several.
- **`<html lang>` follows the choice.** Not cosmetic: it selects the screen
  reader's voice — an English synthesiser reading Sinhala is unintelligible, not
  merely accented — and lets the browser resolve the Sinhala or Tamil face out of
  the font stack instead of guessing per glyph run.

The default is **English**, and it is not sniffed from `navigator.language`: office
machines report `en-*` near-universally regardless of who is sitting at them, so
detection would be a coin toss dressed as a preference. `config.localization.defaultLanguage`
is not it either — that is the *supplier app's* default, a different audience.

### What the scripts cost

The font stack in `packages/brand` carries `Noto Sans Sinhala` and `Noto Sans Tamil`
as fallbacks after the system faces, so no glyph resolves to tofu. Base CSS gives
`[lang="si"]` and `[lang="ta"]` `overflow-wrap: anywhere` and a looser line height —
Sinhala and Tamil run longer than English and must not clip (§20.2).

Two things measured rather than assumed:

- **Indic line boxes are taller at the same font size.** Left to a token's own line
  height, a Sinhala or Tamil row is a pixel or two taller than the Latin one, so a
  long list's total height becomes a function of which language is active. Anywhere
  that matters, the line height is pinned rather than inherited.
- **12px is not enough.** Sinhala and Tamil carry meaning in diacritics and conjunct
  forms where Latin puts it in letter outlines, so the same pixel height buys
  materially less legibility. Chrome controls that would be 12px in English are
  14px here.

---

## Adding a tenant

**A new factory is a DNS record and a `client_config` row.** No build, no deploy.

That asymmetry with mobile — where a new brand still needs a binary — is expected:
app stores demand binaries, browsers do not.

**Since M14, the row is editable from inside the console** — which is what turns AC-12 from a
mechanism into something you can watch happen. `/configuration` has a control for every block
of the row: identity, the ten flags, collection points, banks, savings rates, languages,
branding, the push block. That completeness is the criterion: one field still requiring a
developer would make AC-12 false however good the rest of the screen was.

Two consequences worth knowing before you use it:

- **`tenantId` is not editable.** It comes from the subdomain and every other row is keyed on
  it, so the API refuses a patch containing it (`tenant-immutable`). Renaming a factory is a
  new row and a new DNS record, not an edit.
- **Turning a flag off is refused when the module behind it holds money.** Savings balances,
  unfinished payout runs and outstanding credit each block their flag, with the figure in the
  message. The screen computes this from the same `configImpact` the API refuses with, so
  what it predicts is what happens.

What is still outside the console is **creating** the row for a factory that has none. §12.1
has a `tenants` capability and §18.1's seventeen modules have no screen behind it, so the
first row is inserted by whoever adds the DNS record — the same act by the same person, which
is what AC-12 describes. Everything after that is the configuration screen.

Optionally, for a branded login screen on the very first paint before `/config`
resolves, add a bundled fallback:

```ts
// packages/brand/src/clients/index.ts
export const newfactory: BrandConfig = {
  tenantId: 'newfactory',              // must match the subdomain
  displayName: 'New Factory Tea (Pvt) Ltd',
  theme: { colors: { light: { primary: '#…', primaryMuted: '#…' } } },
};

export const brands = { base: baseBrand, galaboda, hillcountry, highland, newfactory };
```

This is polish, not a requirement: an unknown tenant renders neutral, fetches its
config and brands itself correctly one paint later.

**Do not add the factory's name, telephone or flags here.** Those come from
`/config`, and duplicating them creates the second source of truth this design
exists to avoid.

---

## What the linter can and cannot enforce

| Golden rule | Enforced? |
| --- | --- |
| Never hardcode a colour | **Yes** — `className` containing `[#…]` is an error |
| Never hardcode a size | **Partly** — arbitrary `[13px]`/`[7rem]` in `className` is an error; Tailwind's numeric scale (`p-4`) is allowed as a scale step |
| Never use a t-shirt-named sizing utility | **Yes** — `max-w-md`, `w-lg`, `h-xl` are errors. They resolve against `--spacing-*`, so `max-w-md` means 12px here, not 28rem (see [design-system.md](./design-system.md) → Layout widths) |
| Never hardcode a string | **No** — a review item. A missing `t()` key warns in the dev console instead |
| Never branch on the tenant id | **No** — not statically checkable. A review item |
| UI never imports axios | **Yes** — by import path |
| Only repositories import endpoints | **Yes** — by import path |
| `@tfd/*` stays framework-free | **Yes** — react/react-native/axios imports are errors there |

Where the linter cannot reach, this table says so rather than implying coverage.
