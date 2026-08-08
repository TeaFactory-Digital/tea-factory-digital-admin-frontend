# Architecture

How the console is built. Screens and scope are in [modules.md](./modules.md);
the brand machinery is in [white-label.md](./white-label.md).

---

## The workspace

```
TeaFactoryDigital-Admin/
├── packages/
│   ├── domain/     @tfd/domain — types, constants, RBAC matrix, credit basis, Zod schemas
│   └── brand/      @tfd/brand  — design tokens, createTheme, the CSS-variable bridge
├── apps/
│   └── admin/      @tfd/admin  — React 19 + Vite + Tailwind v4 console
└── docs/
```

npm workspaces. The packages are consumed as **TypeScript source**, aliased in
`vite.config.ts` and `tsconfig.json` — no build step, and a change to
`@tfd/domain` shows up in the dev server immediately. That is the point of
sharing the model rather than publishing it.

### Why two packages

`docs/admin-console.md` in the mobile repo prescribes this split, and the
argument is worth restating because it is the whole reason for the workspace:

> The decisive argument: `src/types/index.ts` is already the domain model.
> Sharing it means the app, the API and the console cannot drift, and a change to
> `GreenLeafBill` breaks the build in all three.

- **`@tfd/domain`** is a verbatim port of the mobile app's `src/types/index.ts`
  plus the console-only types the API also implements, the §12.1 permission
  matrix, the credit arithmetic, and the Zod schemas. **Framework-free by
  contract** — no React, no React Native, no axios, enforced by lint. If
  something here cannot be imported by a Node service, it is in the wrong place.
- **`@tfd/brand`** is the mobile app's `src/theme` with a different sink. Same
  tokens, same `createTheme`, but the values are emitted as CSS custom properties
  instead of handed to React context.

### What has *not* happened yet

The mobile app still lives in its own repository. Two follow-ups, both
deliberately deferred:

1. **Merging the repos.** Relocating `src/` → `apps/mobile/src/` means editing the
   Xcode project, Gradle paths, Metro config and every `@/` alias — a real chance
   of breaking a working iOS/Android build for a console change. It belongs in its
   own PR, verified with clean native builds.
2. **`apps/api`.** When the backend starts, it joins this workspace and imports
   `@tfd/domain` rather than hand-writing DTOs. [api-contract.md](./api-contract.md)
   is written on that assumption.

Until then `@tfd/domain` is a **copy** of the mobile types, and keeping them in
step is manual. That is a known gap, recorded in [status.md](./status.md).

---

## The layers

```
screen ─► hook ─► repository ─► endpoint ─► apiClient ─► HTTP
                     │
                     └─ where a wire response becomes a domain object
```

Copied from the mobile app, including the rule that makes it worth having:
**UI never imports axios**, and only a repository may import an endpoint. Both
are enforced by `no-restricted-imports` in `eslint.config.js`.

| Layer | Owns | Never |
| --- | --- | --- |
| **Screen** (`modules/*/…Screen.tsx`) | Layout, URL state, which hooks to call | Fetching directly, formatting money by hand |
| **Hook** (`modules/*/hooks.ts`) | Query keys, cache invalidation, mutation wiring | Knowing about HTTP |
| **Repository** (`services/repositories/`) | Domain mapping, ordering guarantees, client-side pre-checks | Knowing about React |
| **Endpoint** (`services/endpoints/`) | Paths, query strings, response typing | Business rules |
| **`apiClient`** (`services/api/`) | Auth header, tenant header, idempotency key, refresh-on-401, error normalisation | Anything domain-specific |

The repository seam is the one that earns its keep: it is what absorbs a backend
that returns something slightly different from what the console wants, without a
screen changing. When the mock is replaced, **repository internals change and
nothing above them does.**

### Two fixes built in from the start

`docs/api.md` §17.7 lists two things that are wrong in the mobile app today and
only surface when a real API is wired. Both are correct here by construction:

1. **Domain codes survive normalisation.** `normalizeError` prefers
   `body.code` over the HTTP status. Without this, a `409` carrying
   `four-eyes-violation` reaches the screen as `code: "409"` and every specific
   banner in the console is unreachable. There is a test asserting it
   (`changeRequests.test.tsx`).
2. **Token refresh exists.** A `401` triggers exactly one refresh and one replay,
   guarded by a `_retried` flag so an expired session cannot loop.

---

## State

Four kinds, deliberately in four places.

| Kind | Where | Why there |
| --- | --- | --- |
| **Server state** | TanStack Query | It is a cache, not state. Keys are centralized in `query/queryKeys.ts` |
| **Session** | Zustand (`auth/authStore.ts`) | The transport's 401 interceptor must reach it, and an interceptor cannot call a hook |
| **Tenant config** | React context (`RuntimeConfigProvider`) | Read by almost every component, written once per session |
| **Filters, paging, search** | **The URL** | So the dashboard can link to a filtered grid, and a clerk can send a colleague exactly what they are looking at |

### The provider stack

Order is load-bearing (`app/App.tsx`):

```
QueryClientProvider          everything below fetches
└─ RuntimeConfigProvider     fetches config; provides flags
   └─ BrandProvider          reads config → theme, title, favicon
      └─ ToastProvider       needs tokens applied before it paints
         └─ RouterProvider   the screens
```

Auth is **not** in the stack, for the reason in the table above.

### Query defaults worth knowing

- **No retry on a domain error.** A `403` or a `409 four-eyes-violation` is a
  final answer; retrying it three times delays the message the clerk needs.
  Transport failures do retry.
- **`refetchOnWindowFocus` on.** Two clerks work the same inbox. Returning to a
  tab that has been open since lunch and seeing an hour-old queue is how
  `already-decided` gets hit.
- **Mutations never retry automatically.** Every mutation here moves money or
  changes payout details. The idempotency key makes a *deliberate* retry safe; an
  automatic one is indistinguishable from a clerk clicking twice.

---

## Start-up sequence

`main.tsx`, in order, and each step depends on the one before:

1. **`assertEnvUsable()`** — refuse to boot a production bundle wired to the
   placeholder origin or with mocks on. A console that looks fine, serves
   fixtures, and reports every failure as a network problem is the worst
   available outcome.
2. **Apply the bundled tenant theme, synchronously.** The stylesheet's tokens are
   `var(--brand-*)` with **no fallback values**, so a paint before this line would
   be unstyled. Doing it here rather than in an effect is what makes the first
   frame branded — and it is why the palette is not duplicated in CSS.
3. **`connectAuthToTransport()`** — registers the store with the axios
   interceptors.
4. **Start MSW and await it** (dev only). Without the await, the first requests
   race the worker's registration and fall through to a domain nobody owns —
   which looks exactly like the backend being down.
5. **Render.** `App` then calls `bootstrap()`: there is no access token on a fresh
   document, so the session is recovered from the refresh cookie before anything
   renders behind `RequireAuth`.

---

## Routing

`react-router-dom`, one browser router, module screens **lazy**. The first thing
anyone loads is a sign-in form; without lazy routes it arrives with a charting
library, a table engine and every screen attached.

**Only built modules have routes.** A route rendering "coming soon" is worse than
no route — it is a URL a clerk can bookmark, share, and then report as broken. There used
to be a *Planned* chip on a disabled sidebar row for the modules that had none; all
seventeen of §18.1's modules now have routes, so both the chip and the branch that rendered
it are gone rather than kept warm for a case no row can reach.

Every route is wrapped in `RequireCapability`, so a bookmarked or emailed URL is
refused the same way the sidebar would have hidden it. Guards render an
explanation rather than redirecting: a clerk who followed a link should be told
their role does not allow it, not silently returned to the dashboard wondering
whether the link was broken.

---

## Errors

Three tiers, and the distinction between them is a design decision, not an
accident:

| Tier | Used for | Component |
| --- | --- | --- |
| **Toast** | Confirming something that worked | `useToast()` |
| **Inline / dialog** | A refusal the clerk must read and act on | `Notice`, or the dialog stays open |
| **Boundary** | A render error | `RouteErrorBoundary` |

**A toast may confirm, never inform.** "Approved — the app will show the new value
on next refresh" is a toast. A four-eyes refusal is not: a message that disappears
after five seconds is a message the clerk can miss and then wonder why the queue
did not change. `isBlockingError()` encodes which is which.

The boundary logs the error rather than displaying it. A stack trace tells an
office clerk nothing and may carry a supplier's name from a props dump — which
would be a PDPA problem in a screenshot pasted into an email (§20.4).

---

## Security posture

Summarised here; the endpoint-level requirements are in
[api-contract.md](./api-contract.md) §2.

- **Access token in memory only.** Not `localStorage`, not `sessionStorage`: the
  console runs on shared office machines, and a token in web storage is readable
  by any script on the origin and outlives the tab.
- **Refresh token in an httpOnly cookie** the JS cannot read. This is what makes
  surviving a reload possible without storing anything readable.
- **Bank account numbers arrive masked.** The full number is one audited
  endpoint, and its result is never cached — the dialog holds it and drops it.
- **Permissions are enforced server-side.** Everything in
  `auth/guards.tsx` and every hidden button is a courtesy.
- **Served theme values are validated** before reaching a style declaration —
  they are factory-authored content, so they get the same treatment the app gives
  a promo banner's action URL.
- **`console.error` for diagnostics, never a rendered stack.**
