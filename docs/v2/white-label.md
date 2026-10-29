# White-label

One bundle, many branded factory consoles. Everything that differs between
factories is data served at runtime (identity, theme, feature flags, bank list,
savings options, tea-packet policy, credit rules, collection points, whether the
records come from the factory's own system, how bills are paid, numbered and charged
interest), never forked code.

The mobile equivalent is the mobile repo's `docs/white-label.md`. Read that for
the product rules; this document is the console's implementation of them.

**v2 changed one thing here and it is the most important thing in the document:
the feature flags are now the app's, exactly.** See *Feature flags* below.

---

## The one structural difference from mobile

```
mobile:   APP_CLIENT env var  ─► clients[id]  ─► ThemeProvider  (fixed for the app's life)
console:  subdomain / token   ─► GET /config  ─► CSS variables  (per session)
```

The mobile app resolves its brand at **build** time: one binary per factory,
`APP_CLIENT` baked in. The console cannot. There is one deployment, and which
factory it shows depends on the subdomain it was reached through.

So the console **cannot import a factory's brand at build time**. It fetches the
same `/config` payload the app does and themes itself from that. Which is the point: the office
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
/* src/styles/theme.css, build time */
@theme {
  --color-primary: var(--brand-color-primary);
}
```
```ts
// @tfd/brand css.ts, runtime, per tenant
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
   `bg-red-500` in this codebase: a status colour that is not
   `error`/`warning`/`success`/`info` is a colour the factory cannot rebrand.
   `transparent` and `currentColor` survive because they are structural.
2. **No fallback values in the `var()` calls.** Fallbacks would mean the palette
   is written twice (in CSS and in `@tfd/brand`) and the copies would drift.
   Instead `main.tsx` applies the bundled tenant theme **synchronously before the
   first render**, so a paint never happens without brand properties present.
3. **dp becomes px in exactly one place.** The scale tokens are shared with a
   React Native bundle and are therefore unitless; `packages/brand/src/css.ts` is
   the only file that decides they mean pixels.

---

## Resolving the tenant

```
galaboda.admin.teafactory.lk    ─┐
<factory>.admin.teafactory.lk    ├─► same static bundle ─► GET /config per subdomain
<factory>.admin.teafactory.lk   ─┘
```

`packages/brand/src/tenant.ts` parses it, as a pure function so it is testable
without a DOM:

| Host | Result |
| --- | --- |
| `galaboda.admin.teafactory.lk` | `galaboda` (source: `subdomain`) |
| `admin.teafactory.lk` | `null` → fallback. It is the bare deployment, not a factory called "admin" |
| `localhost` | `null` → `VITE_DEFAULT_TENANT` |
| `localhost?tenant=highland` | `highland` (source: `override`), **development only**. `highland` is a mock tenant, test data only |

**The `?tenant=` override is off in production.** A query parameter that
repointed a live console at another factory would be a tenant-switch primitive in
the URL bar. The token still governs, but the request would be routed and themed
as someone else, which is confusing at best.

**Resolved once, at module load.** A tenant that could change mid-session would
mean every cached query, every open form and the applied theme belong to a factory
that is no longer selected. Switching tenant in development therefore means loading
the page again with a different `?tenant=`, which is also what production does,
since switching tenant there means a different subdomain and a fresh document.

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
config with `degraded: true`, and the shell shows one honest line ("showing
bundled defaults") instead of an error page where a working console should be.

Three things are bundled, for different reasons:

| Bundled | Why |
| --- | --- |
| **Brand colours** per tenant (`@tfd/brand`'s registry: today `base` and `galaboda` only) | A grey login screen is a visible regression, and a colour cannot be wrong in a way that misleads anyone |
| **One default mark** (`public/brand/logo.svg`, wired up in `brand/assets.ts`) | Same argument as the colours: artwork cannot be wrong in a way that misleads anyone, and two grey initials on the login screen of a tea factory is a visible regression. It is *one* generic mark, never a factory's own; see below |
| **Neutral identity + every flag on but `enableMonthToDate`** (`config/defaults.ts`) | A per-tenant name and telephone number here would be a second source of truth, and *a wrong telephone number in a shipped bundle is exactly what serving config was meant to fix* |

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

Flags default **on** (all but `enableMonthToDate`, which is app-only and ships off). The
alternative hides queues from a clerk whenever `/config`
is slow, which reads as "the manure requests have disappeared". Defaulting on
risks briefly showing a queue the factory does not use, which reads as an empty
inbox. The second failure is the cheaper one, and the API is the authority
either way (`403 feature-disabled`).

An **unknown tenant falls back to the neutral base**, deliberately not to another
factory's green: a clerk pointed at the wrong deployment must be able to tell.

---

## Feature flags

A factory's feature set is data. Every surface not all factories offer is gated on
a flag and read with `useFeatureFlag('…')`, **never by branching on the tenant
id.**

```tsx
const flags = useFeatureFlags();
// Flag first, then capability. Asking in the other order shows a manure queue to
// a manager at a factory that has never sold fertilizer.
const visible = (!item.flag || flags[item.flag]) && can(grants, item.capability);
```

### v2: the set is the app's, and it was not

`FeatureFlagSet`'s docblock said the flags were *"identical to the app's set"*. The
type held **ten**; the app's `FeatureFlags` (mobile `src/config/types.ts`) held
**fourteen** (fifteen since `enableMonthToDate`). Six the app gates real screens on had no control anywhere in this
console, and two were console-only.

That is the most expensive kind of drift, because nothing fails. A factory wanting
to turn off biometric sign-in had to ask a developer, which is precisely what
AC-12 says must not be true, on the screen that *is* AC-12.

So v2's rule: **this console is the app's management surface, therefore this type is
the app's flag set.** Nothing more, nothing less.

| Flag | Gates in the console | Gates in the app |
| --- | --- | --- |
| `enableAdvances` · `enableLoans` · `enableManure` | The M7 credit queues, independently: a factory may lend against leaf but not against income history | The three request screens |
| `enableTeaPackets` | **M18** | `RequestTeaPacketsScreen` |
| `enableSavings` | The savings figures on a supplier's record | The savings screen and the rate picker |
| `enableInquiry` | M10 | The inquiry screen |
| `enableNews` | M11's articles | The feed |
| `enablePromoBanner` | **M11's banner editor** | The banner itself |
| `enablePushNotifications` | M13 | Notification settings and the device registry |
| `enableOnboarding` | - | The onboarding screens |
| `enableBiometricLogin` | - | Fingerprint / face sign-in |
| `enableDarkModeToggle` | - | The dark-mode switch |
| `enableProfileTab` | - | Nothing: the app has no Profile tab (29 October 2026). Hidden in Configuration → Features; the stored value is kept |
| `enableAutoLock` | - | `useAutoLock` |
| `enableMonthToDate` | - (M14 shows its switch only once `MONTH_TO_DATE_ON_SERVER` is true) | "This month so far" on the Account tab: `MonthToDateCard`, compact, with a day strip (off by default; BACKEND-TODO #48) |

**Six of the fifteen gate nothing this console renders, and that is expected.**
`enableBiometricLogin` is a phone capability; there is no office equivalent and
there should not be one. **Editing a flag is a console feature; obeying it is the
app's job.** M14's flag list says which kind each one is rather than citing a module
that does not exist.

A flag turns a surface off **end to end**: the sidebar row disappears where there is
one, the route is never reached, the app hides the screen, and the API refuses the
call with `403 feature-disabled` (AC-07). All four are required. *"Otherwise a clerk
is staffing an inbox nothing can reach."*

### The two that left

`enablePayouts` and `enableReports` were **console-only** (neither exists in the
app's `FeatureFlags`) and both went with the modules they gated (M6, and three of
M16's four reports). A console that went on serving them would be offering the office
a switch the app has never read.

What is left of M16 is `channelShift`, deliberately **ungated**, for the same reason
M12, M14 and M15 have no flag: a factory does not decline to know whether its own app
is being used.

Their definitions and the AC-07 tests written against them are in git history; live
equivalents for `enableTeaPackets` and `enablePromoBanner` are in `teaPackets.test.ts`
and `banners.test.ts`. AC-07 did not weaken; it moved to flags the app actually reads.

### The reduced-feature reference

**`highland`**, a tenant that exists only in the mock (`services/mocks/seed.ts`) as
test data: no loans, no manure, no news, no push, no tea packets and no promo banner.
It has no bundled brand (the `hillcountry` and `highland` brands were removed from
`packages/brand`), so it renders on the neutral base. Opening the console in
development with `?tenant=highland` should visibly empty those rows out of the
sidebar, which is the fastest way to check nothing is hardcoded. The Playwright specs
(`e2e/smoke.spec.ts`, `e2e/queues.spec.ts`) assert exactly that.

Its app-only flags are deliberately **not** all off: a tenant with every app flag
false would be a phone with almost no screens, which tests nothing anybody ships.

## Localization

**si/en/ta chrome, si/en/ta content.** Both halves, for different reasons:

- **The chrome ships in all three.** Every label resolved through `t()` from the
  start (never a literal) and that is the whole reason Sinhala and Tamil arrived
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

`LanguageSwitcher`: a three-segment pill in the topbar **and on the sign-in
screen**. Sign-in is not a courtesy: the preference lives in `localStorage`, so it
survives from whoever used the shared machine last, which means the person who most
needs to change it arrives at a screen they cannot read. It is also the one control
there that works without a session.

Three rules the control has to hold:

- **The options never go through `t()`.** `src/i18n/languages.ts` is the single
  source of truth for the labels, and they are literals on purpose. A picker must
  show every option in its own script whatever the active language is: a Tamil
  clerk on a Sinhala console finds the way out by recognising தமிழ், not by reading
  a Sinhala word for "Tamil". (`content.language.*` in the string tables is a
  different job and stays translated: that is for *talking about* a language in
  prose, where the reader's own language is the right one.)
- **It is one tab stop, not three.** `radiogroup` semantics with a roving tabindex
  and wrapping arrow keys. Three `aria-pressed` buttons would announce as three
  unrelated controls in a topbar that already has several.
- **`<html lang>` follows the choice.** Not cosmetic: it selects the screen
  reader's voice (an English synthesiser reading Sinhala is unintelligible, not
  merely accented) and lets the browser resolve the Sinhala or Tamil face out of
  the font stack instead of guessing per glyph run.

The default is **English**, and it is not sniffed from `navigator.language`: office
machines report `en-*` near-universally regardless of who is sitting at them, so
detection would be a coin toss dressed as a preference. `config.localization.defaultLanguage`
is not it either; that is the *supplier app's* default, a different audience.

### Dates, numbers and money

`lib/format.ts` follows the chrome language, read at call time, so the language switch
re-formats every screen it re-renders:

| | English | Sinhala | Tamil |
| --- | --- | --- | --- |
| Date | `30 Jul 2026` | `2026 ජූලි 30` | `30 ஜூலை 2026` |
| Date and time | `30 Jul 2026, 14:05` | `2026 ජූලි 30, 14:05` | `30 ஜூலை 2026, 14:05` |
| Month | `July 2026` | `2026 ජූලි` | `ஜூலை 2026` |
| Money | `LKR 1,234,567.50` | `රු. 1,234,567.50` | `ரூ. 1,234,567.50` |
| Weight | `1,240.50 kg` | `1,240.50 කි.ග්‍රෑ.` | `1,240.50 கிலோ` |
| Waiting | `5 h`, `3 d` | `පැය 5`, `දින 3` | `5 மணி நேரம்`, `3 நாள்` |

The words and their order come from the string tables (`format.*`), **not from the
browser's locale data**: ICU names the Sinhala months by the traditional calendar (`ඇසළ`
for July, `දුරුතු` for January) in some versions and not in others, and a bill month must
read the same on every machine. The digits and their grouping do **not** change: Western
digits, grouped in thousands, in every language, as the factory's printed slip has them.
(Tamil locale data groups in lakhs, `12,34,567.50`, which is not how Sri Lanka writes
money.) Every time is Colombo time on the 24-hour clock. `format.test.ts` holds the table
above.

### What the scripts cost

The font stack in `packages/brand` carries `Noto Sans Sinhala` and `Noto Sans Tamil`
as fallbacks after the system faces, so no glyph resolves to tofu. Base CSS gives
`[lang="si"]` and `[lang="ta"]` `overflow-wrap: anywhere` and a looser line height:
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
The step by step is [new-factory.md](./new-factory.md).

That asymmetry with mobile (where a new brand still needs a binary) is expected:
app stores demand binaries, browsers do not.

**Since M14, the row is editable from inside the console**, which is what turns AC-12 from a
mechanism into something you can watch happen. `/configuration` has a section for every block
of the row:

| Section | Blocks of the row |
| --- | --- |
| The factory | `factory` (identity, as printed on the bill) |
| Features | `flags`, **the fifteen** (`enableMonthToDate` neither shown nor sent until `MONTH_TO_DATE_ON_SERVER`) |
| Factory system | `factorySync`: the sync on or off (absent or `null` reads as off) |
| Collection & savings | `collectionPoints`, `savings` (rates, withdrawal month, interest), `manureProducts` |
| Banks & branches | `banks` |
| Languages & branding | `localization`, `branding`, `theme` |
| Notifications | `push` |
| Tea packets | `teaPackets` |
| Credit rules | `creditRules` |
| Bill calculation | `billSettings` (where the bills come from, pay in Rs. 1 / 5 / 10, the next bill serial), `advanceInterest`, `loanInterest` (rate and how it is taken) |
| Common notes | `noteSuggestions` |

That completeness is the criterion: one field still requiring a developer would make AC-12
false however good the rest of the screen was.

**And until v2 it was false.** The screen said "ten flags" and meant it: six of the app's
fourteen had no control here at all, so a factory wanting to turn off the onboarding screens
or biometric sign-in had to ask a developer. The criterion is not "is there a configuration
screen"; it is whether the **last** field a factory needs is on it, and counting the fields
against the app's own type is the only way to check.

Consequences worth knowing before you use it:

- **`tenantId` is not editable.** It comes from the subdomain and every other row is keyed on
  it, so the API refuses a patch containing it (`tenant-immutable`). Renaming a factory is a
  new row and a new DNS record, not an edit.
- **The savings scheme's rules are configuration.** §21.9's answer (withdrawals in April,
  0% interest) arrived as *"but the month must be changeable, and so must the rate"*, which
  is this row's whole purpose: a factory that pays out at the start of the school year is a
  value, not a build.
- **The credit rules are configuration**, and they are the clearest case on the row of
  why that matters. How much a supplier may borrow used to be a formula in the build
  with two constants behind it, so a factory saying *"manure: average the last three
  months, capped at 20,000"* needed a release. It is now four values per facility,
  and the same rule produces the ceiling the **app** shows the supplier and the ceiling
  the **office's queue** checks against, which is what stops the two disagreeing about
  a limit somebody is being refused.

  The bundled defaults reproduce the old formulas exactly, so a factory that never
  opens the screen sees no change in what anybody may borrow.
- **Where a factory's records come from is configuration.** **Off is the default**
  (stored as `{ enabled: false }`; absent or `null` also reads as off): the office keeps
  suppliers, daily leaf, rates and bills in the console
  ([factory-records.md](./factory-records.md)) until its own system is connected and
  *Factory system* switches the hourly sync on deliberately. The **Factory records**
  sidebar section (Leaf intake, Rates & month close) and the entry and import screens
  appear only while it is off. The API refuses the switch while a month has generated but
  unpublished bills (`sync-switch-blocked`).
- **How a bill is worked out is configuration**, and it only matters with the sync off.
  *Bill calculation* says whether the bills are **imported** as the factory's own system
  printed them (galaboda) or **calculated** here (one way per factory; the source cannot
  change while a month has generated but unpublished bills, `bill-source-blocked`), the
  unit the payment is rounded down to (Rs. 1, 5 or 10), the serial the next bill number
  continues from (the year of the bill's month, then a serial that never resets), and the
  advance and loan interest a month (loan 0% unless set, taken on top of the instalment or
  inside it, `loanInterest.recovery`). With the sync on the
  factory system's bills carry their own figures, and the section says so rather than
  hiding, so an administrator about to switch the sync off can set them first.
- **The tea-packet policy is configuration**: the pack size, the price and the most one
  supplier may take at once. New in v2 with M18, and it carries the row's argument in
  miniature: a factory that changes its packet price changes a value, not a build. It is also
  the one config block whose *absence* is dangerous rather than neutral, so both M18 and M14
  say so when it has never been set: unset means M18 is quoting
  `DEFAULT_TEA_PACKET_POLICY`, a real number, and not this factory's.
- **Turning a flag off is refused when the module behind it holds money.** Savings balances,
  outstanding credit and **tea packets issued but not yet recovered** each block their flag,
  with the figure in the message. The screen computes this from the same `configImpact` the
  API refuses with, so what it predicts is what happens.
- **The payout file's layout is still configuration, and no longer edited here.** §21.17's
  answer (that the columns, headings, delimiter and number formats are per-tenant values
  rather than three guessed serialisers) remains the right answer, and `payoutExport.ts`
  still holds the shared serialiser. But in v2 the factory pays from its own system and
  the payouts module (M6: payout runs and payout files) has left the console, so the
  section that edited it is gone. Whoever owns payouts next inherits the
  serialiser rather than a second guess at the format.

What is still outside the console is **creating** the row for a factory that has none. §12.1
has a `tenants` capability and no screen behind it, so the platform team creates it with the
backend's onboarding command (`npm run db:seed:tenant`, see [new-factory.md](./new-factory.md)):
the factory, its configuration with every flag written, banks, collection points, the first
administrator, and the default static pages and notification triggers. Everything after that
is the configuration screen.

Optionally, for a branded login screen on the very first paint before `/config`
resolves, add a bundled fallback. Only `galaboda` has one today:

```ts
// packages/brand/src/clients/index.ts
export const newfactory: BrandConfig = {
  tenantId: 'newfactory',              // must match the subdomain
  displayName: 'New Factory Tea (Pvt) Ltd',
  theme: { colors: { light: { primary: '#…', primaryMuted: '#…' } } },
};

export const brands = { base: baseBrand, galaboda, newfactory };
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
| Never hardcode a colour | **Yes**, `className` containing `[#…]` is an error |
| Never hardcode a size | **Partly**, arbitrary `[13px]`/`[7rem]` in `className` is an error; Tailwind's numeric scale (`p-4`) is allowed as a scale step |
| Never use a t-shirt-named sizing utility | **Yes**, `max-w-md`, `w-lg`, `h-xl` are errors. They resolve against `--spacing-*`, so `max-w-md` means 12px here, not 28rem (see [design-system.md](./design-system.md) → Layout widths) |
| Never hardcode a string | **No**, a review item. A missing `t()` key warns in the dev console instead |
| Never branch on the tenant id | **No**, not statically checkable. A review item |
| The console's flag set matches the app's | **No**, the two live in different repositories, and v1 drifted by four flags with a docblock claiming otherwise. A review item, and the reason [status.md](./status.md#m14-configuration) states the count (M14 Configuration, Features) |
| UI never imports axios | **Yes**, by import path |
| Only repositories import endpoints | **Yes**, by import path |
| `@tfd/*` stays framework-free | **Yes**, react/react-native/axios imports are errors there |

Where the linter cannot reach, this table says so rather than implying coverage.
