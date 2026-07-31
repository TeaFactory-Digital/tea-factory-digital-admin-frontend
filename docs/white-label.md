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

Two things are bundled, for different reasons:

| Bundled | Why |
| --- | --- |
| **Brand colours** per tenant (`@tfd/brand`'s registry) | A grey login screen is a visible regression, and a colour cannot be wrong in a way that misleads anyone |
| **Neutral identity + all flags on** (`config/defaults.ts`) | A per-tenant name and telephone number here would be a second source of truth, and *a wrong telephone number in a shipped bundle is exactly what serving config was meant to fix* |

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

**English chrome, si/en/ta content.** The decision and its reason:

- Office staff work in English, so every console label is English — but resolved
  through `t()`, never a literal. That is the difference between adding Sinhala
  later as a **copy deliverable** and adding it as a refactor of every screen.
  M3's leaf-entry grid, used by weighing-point staff rather than office staff, is
  the surface most likely to need it.
- **Editorial content is authored in all three**, driven by
  `config.localization.contentLanguages`, because a Sinhala supplier reading an
  English-only FAQ is the app failing. Missing translations must be visible to the
  editor (AC-08).

Base CSS gives `[lang="si"]` and `[lang="ta"]` `overflow-wrap: anywhere` and a
looser line height — Sinhala and Tamil run longer than English and must not clip
(§20.2).

---

## Adding a tenant

**A new factory is a DNS record and a `client_config` row.** No build, no deploy.

That asymmetry with mobile — where a new brand still needs a binary — is expected:
app stores demand binaries, browsers do not.

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
