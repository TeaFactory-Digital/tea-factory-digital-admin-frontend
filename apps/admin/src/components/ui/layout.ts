/**
 * Layout classes that more than one screen depends on getting exactly right.
 *
 * Not a general utility bucket: everything here exists because the same mistake was made
 * in several places at once and the reasoning has to live somewhere findable.
 */

/**
 * The card that holds a data grid on a fill-the-window screen.
 *
 * **`min-h-[22rem]`, not `min-h-0`** — and that swap is the whole point of this constant.
 *
 * `AppShell` gives a screen a definite height so a grid can fill it, and a flex item only
 * shrinks below its content if it opts out of `min-height: auto`. Every grid card opted
 * out with `min-h-0`, which says "shrink me as far as you like" — including **to nothing**.
 * On a tall window that is invisible. On a 13-inch laptop, with a page header and a card
 * above the grid, the leftover space goes to zero and the list disappears: the rows are
 * still in the DOM at their normal size, clipped by a zero-height scroll container, so
 * nothing errors and a `toBeVisible()` assertion still passes. Measured on the
 * notifications screen at 1440×785 the scroller was 28 px, and at 1440×700 it was 0.
 *
 * A floor says the honest thing instead: fill the window when there is room, and when
 * there is not, take a usable height and let the page scroll. 22 rem clears the filter
 * bar, the sticky header and the pagination with about four rows left over — enough that
 * the grid reads as a list rather than as a scrollbar.
 *
 * Do not add `min-h-0` alongside it. Both set the same property, so the winner is
 * whichever Tailwind emits later in the stylesheet rather than whichever is written last —
 * the same trap documented on `Field`'s width variant.
 *
 * One screen had already reached for a floor independently and written `min-h-96`, which is
 * why this is a constant rather than a number copied twelve times: two screens disagreeing
 * about how short a list may get is a decision nobody made.
 */
export const GRID_CARD = 'flex min-h-[22rem] flex-1 flex-col';
