# Design system

Tokens, components, and the decisions behind them. The mechanism that makes any
of it re-brandable is in [white-label.md](./white-label.md).

---

## What the console is optimising for

> The office is the system of record. … **Speed of the repetitive path beats
> richness of the rare one.** A clerk enters hundreds of delivery rows a day and
> approves twenty requests. Keyboard entry, bulk actions and a fast queue matter
> more than dashboards.
> — `docs/admin-console.md` §18

Every decision below follows from that sentence. This is a **data-entry product
on a 1366×768 office laptop**, not a marketing site.

---

## Tokens

All from `@tfd/brand`, all the same values the mobile app uses. Utilities are
generated from them by Tailwind; the mapping is in `src/styles/theme.css`.

### Colour

Semantic (what the colour is **for**), never literal.

| Token | Utility | Use |
| --- | --- | --- |
| `primary` / `primaryContrast` / `primaryMuted` | `bg-primary`, `text-primary-contrast`, `bg-primary-muted` | Brand, primary action, selected nav |
| `secondary` / `secondaryContrast` | `bg-secondary` | Accent |
| `background` / `surface` / `surfaceVariant` | `bg-background`, `bg-surface` | Page, card, input fill |
| `textPrimary` / `textSecondary` / `textInverse` | `text-text-primary` | Copy |
| `border` / `divider` | `border-border`, `divide-divider` | Outlines, row rules |
| `success` `warning` `error` `info` (+ `*Muted`, `onStatus`) | `text-error`, `bg-error-muted` | Status. **Never the only signal** — see below |
| `overlay` / `disabled` / `disabledContrast` | `bg-overlay` | Scrim, disabled controls |
| `tableHeader` / `tableRowHover` / `tableRowAlt` | `bg-table-header` | Console-only: the data grid |
| `focusRing` | `outline` (global) | Keyboard focus |

`text-text-primary` reads awkwardly. It is deliberate: the utility name is exactly
the token name, so any colour in a component is greppable back to `@tfd/brand`.
Explicitness beat brevity here, because "never hardcode a colour" is lint-enforced
and traceability is the whole point.

**Tailwind's default palette is removed** (`--color-*: initial`). There is no
`bg-red-500`; a status colour that is not one of the four is a colour the factory
cannot rebrand.

### Spacing, radius, icons

Named tokens matching the shared scale, so `p-lg` is the same 16 the phone uses:
`none xxs xs sm md lg xl xxl xxxl huge giant` → `p-lg`, `gap-sm`, `mt-xxs`.
`rounded-md`, `size-icon-md`.

Tailwind's numeric scale (`p-4`, `w-64`) stays available — it is a scale step, not
a magic number, and `w-*`/`inset-*` are built on it. **Prefer the named token when
the value is spacing.** Arbitrary values (`p-[13px]`) are a lint error.

### Layout widths — and the collision that forced them

`max-w-card` (28rem) · `max-w-dialog` (32rem) · `max-w-dialog-wide` (48rem) ·
`max-w-page` (80rem).

These exist because of a genuine Tailwind trap, worth knowing before touching
either scale. **Tailwind resolves a named sizing value against `--spacing-*`
before `--container-*`.** Defining `--spacing-md` therefore silently redefines
`max-w-md` from 28rem to **12px**:

```css
.max-w-md { max-width: var(--spacing-md) }   /* 12px — not what anyone wrote */
```

Nothing errors. The page just collapses into a column one word wide, which is
exactly how it shipped in the first screenshot of the sign-in screen. Defining
`--container-md` explicitly does **not** win it back — spacing is matched first.

So layout widths are semantic tokens whose names cannot collide with a spacing
step, and `eslint.config.js` rejects any t-shirt-named sizing utility (`max-w-md`,
`w-lg`, `h-xl`, …) so the trap cannot be stepped on again. `max-w-card` also says
what it is *for*, which `max-w-md` never did.

Fixed rem values rather than brand variables: this is layout geometry, not brand.
A factory re-colours the console; it does not re-flow it.

### Typography

One class carries size, line height, weight and tracking together, so a heading
cannot be half-applied. `text-h2` is the whole variant.

`display-large h1 h2 h3 title subtitle body body-strong body-small label button
caption overline` — plus two the console added:

- **`text-data-cell`** (13/18) — a grid needs a size below `body-small` that is
  still readable across a 12-column row. Adding it as a token beat every table
  reaching for `text-[13px]`.
- **`text-data-header`** (12/16, 0.3 tracking, uppercase) — column headers.

### `numeric`

A custom utility applying `font-variant-numeric: tabular-nums lining-nums`.

**Use it on every money, kilo, code, NIC and timestamp cell.** Not cosmetic: a
clerk scans a column of amounts to catch a mistyped kilo before it becomes a bill,
and proportional digits make that column unscannable.

---

## Component inventory

`src/components/ui/` — headless Radix where the platform has no equivalent,
native elements everywhere else.

| Component | Notes |
| --- | --- |
| `Button` / `IconButton` | Variants `primary secondary ghost danger`; sizes `sm md`. A loading button is **always** disabled — otherwise a clerk clicks Approve three times. `IconButton` requires a `label` |
| `Card` / `CardHeader` / `CardBody` / `CardFooter` / `DetailRow` | `CardBody` is unpadded-optional so a card can wrap a grid without padding it — the sticky header must line up with the rows |
| `Badge` / `CountBadge` | `CountBadge` renders **nothing** at zero, not a `0` |
| `Field` / `Input` / `Textarea` / `Select` / `SearchInput` | See below |
| `Dialog` | Radix. Focus trap and scroll lock are exactly what a hand-rolled modal gets subtly wrong, and this is where irreversible decisions are confirmed |
| `Toast` / `useToast` | Confirmations only |
| `DataTable` | See below |
| `Spinner` `Skeleton` `TableSkeleton` `EmptyState` `ErrorState` `Notice` | See below |
| `PageHeader` | One `<h1>` per page, here — so the document outline is right |
| `AuditPanel` | Renders nothing without `auditLog` access |
| `Logo` | Served image, or a themed wordmark from the factory's initials |

### Forms use native controls

`<input>`, `<textarea>` and `<select>`, not Radix equivalents. One reason
outweighs the styling gain: **this is a keyboard product.** A native select opens
on first keystroke, filters by typing, and works with the OS's own accessibility
tools. A custom listbox is prettier and slower.

Radix is used for dialogs, toasts and menus — where the platform has nothing
equivalent.

`Field` uses a render prop so the ids connect: `aria-describedby` has to name both
the hint and the error, and a component that renders its own input cannot know
which of them a caller supplied. It passes `{ id, describedBy, invalid, required }`
down.

**Width is a variant (`fullWidth`, default `true`), not a class the caller
overrides.** This was learned the hard way: `w-full` used to be baked into the
control and a filter passed `w-auto` after it. Both classes have the same
specificity, so the winner is whichever Tailwind emits *later in the stylesheet* —
not whichever appears later in the attribute. `w-full` won, and the suppliers
filter bar rendered as four full-width rows. It is the precise failure the
"no `tailwind-merge`" decision below predicts, so the fix was a variant rather
than a merge utility.

**The required marker is drawn, not written.** `label[data-required]::after`
supplies the asterisk, because a text node inside the label becomes part of the
field's accessible name — "Email star" — and no `aria-hidden` suppresses that
reliably across tools. Required is conveyed programmatically by the control's own
`required` attribute.

### The data grid

`DataTable`, on TanStack Table. The console is mostly grids, so this component
decides whether the office is fast or slow.

- **Server-side paging and sorting.** A factory has thousands of suppliers;
  loading them all to sort in the browser is a 30-second first paint on an office
  connection shared with the phones.
- **Keyboard row navigation** — ↑/↓ move, Enter opens. A clerk working a queue
  never reaches for the mouse. `tabindex` is only applied when there is somewhere
  to go; on a non-interactive row it would be a keyboard trap leading nowhere.
- **Sticky header.** A hundred-row page with twelve columns is unreadable once the
  header scrolls away.
- **Real `<table>` / `<tr>` / `<th scope>`**, not divs — so "next column" works in
  a screen reader and the office can paste it into a spreadsheet, which is where
  the office lives (§19.5).
- **Horizontal scroll lives inside the grid**, never on the page body. Twelve
  columns will not fit 1366 px.
- `aria-sort` on sortable headers; `placeholderData` keeps the previous page on
  screen while the next loads, so paging never flashes empty.
- **A sortable header repeats `uppercase` on its button.** The UA stylesheet sets
  `text-transform: none` on form controls, so a `<button>` does not inherit it
  from its `<th>` — without the repeat, sortable columns render mixed-case beside
  uppercase non-sortable ones.

### Loading, empty and error are primitives

Because these are where a console usually lies. A grid showing an empty table
while it loads reads as "no suppliers"; a failed request rendering nothing reads
as "the queue is clear". **Both are worse than an error, because the clerk acts on
them.**

`ErrorState` maps the domain code to specific copy via `errorMessageKey()` — which
is only possible because the transport preserves the code instead of flattening it
to the HTTP status.

---

## Density and layout

- **Root font size 15px.** 16 pushes a dense grid past a 1366×768 viewport; 14
  is tiring for eight hours.
- **Row height ~34px** at `text-data-cell` with `py-sm` — roughly 18 rows visible
  without scrolling.
- **Max content width `max-w-7xl`**, centred. Full-bleed 24-inch monitors put the
  action buttons a head-turn away from the data.
- **Zebra striping** on alternate rows (`bg-table-row-alt`), plus hover — a
  12-column row needs help staying on one line.
- **The page body never scrolls horizontally**, in any language.

### A grid must never be squeezed to nothing

`AppShell` gives a screen a **definite** height (`h-full`) so a `flex-1` grid card can
resolve against it and scroll internally instead of the page scrolling. That is the right
default and it has one sharp edge: a flex item only shrinks below its content if it opts
out of `min-height: auto`, and every grid card opted out with `min-h-0` — which says
*shrink me as far as you like*, including to zero.

On a tall window that is invisible. On a 13-inch laptop, with a page header **and a card
above the grid**, the leftover space runs out and the list disappears. Measured on the
notifications screen: 28 px of list at 1440×785 and 0 px at 1440×700, with the rows still
in the DOM at full size behind a zero-height scroller. Nothing errored, and the browser
test asserting the first row was visible **passed** — Playwright's visibility check asks
whether an element has a box, not whether the box is anywhere a person could see it.

Two rules follow:

1. **Use `GRID_CARD`** (`components/ui/layout.ts`) for the card that holds a grid. It
   carries `min-h-[22rem]` *instead of* `min-h-0` — fill the window when there is room,
   and when there is not, take a usable height and let the page scroll. Never write both:
   same property, and the winner is whichever Tailwind emits later in the stylesheet.
2. **Do not stack a tall card on top of a grid in the fill-height column.** Put it beside
   the grid above `xl` and *underneath* it below, with the grid first in the DOM — the
   notifications screen is the worked example. Reading order stays the same at every
   width, and the settings can be as tall as they like without costing the list a row.

`min-h-full` on the shell wrapper looks like the fix and is not: it makes the container
auto-height, so `flex-grow` has no free space to distribute and every grid sizes to its own
content. A fifty-row savings table rendered 2,582 px tall and scrolled the whole page
rather than itself. Tried, measured, reverted.

`e2e/short-screen.spec.ts` holds the line at five viewports down to 1152×640, and asserts
the first row is **inside the viewport** — scrolling the page first if it sits below the
fold, because "below the fold" is fine and "nowhere" is not.

---

## Accessibility

Following the app's bar (§20.3), adapted for the web:

- **Focus is styled once, globally** (`:focus-visible` in the base layer), so no
  component has to remember it and none can opt out by forgetting.
- **Touch targets ≥44px** on their short axis. The console is mouse-and-keyboard,
  but the same office uses a touchscreen all-in-one often enough.
- **Colour is never the only signal.** Every badge carries its own text. A queue
  coloured red with no words is unreadable to a colour-blind clerk *and* in a
  printed screenshot pasted into an email — which is how the office escalates.
- **Reduced motion** is honoured globally in the base layer, following the app's
  rule: motion is removed, **information is not**.
- **`role="alert"`** on validation errors and error states, so a failure is
  announced and not only shown.
- **Skip-to-content** link in the shell.
- **Sinhala/Tamil** get `overflow-wrap: anywhere` and looser line height.

---

## Two decisions recorded, not omitted

**No dark mode.** The dark palette exists in `@tfd/brand` and the CSS bridge emits
whichever scheme it is given, so enabling it later is a toggle plus a QA pass, not
a refactor. It is off because the console runs on office desktops in daylight and
doubling the theming QA buys nothing in the field.

**No `tailwind-merge`.** Class-conflict resolution by last-wins is a convenience
that hides a design problem: if a caller needs to override a component's
background, the component should take a variant. Every primitive here takes
explicit variants and accepts `className` for layout only.
