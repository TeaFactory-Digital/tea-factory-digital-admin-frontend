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

/**
 * A two-column screen where **one side scrolls and the other stays put**.
 *
 * Four screens want this and they do not all want it the same way round:
 *
 * | Screen | Fixed | Scrolls |
 * | --- | --- | --- |
 * | M14 configuration, M12 static content | the rail of sections/pages | the editor |
 * | M11 banner editor, M8 news article | the live preview | the form |
 *
 * Both readings are the same fix and the same three rules — which side gets
 * {@link SPLIT_PANE_SCROLLER} is the only difference — so the **track is not included
 * here**. A screen states its own proportions, because a 1fr/3fr rail and a 3fr/2fr
 * form-and-preview are different judgements about what the reader is looking at.
 *
 * Without it the page scrolls as one, and whichever half is shorter goes with it: on M12
 * that meant scrolling back up to a page-picker that had left the window, and on the
 * banner editor it means the preview you are checking your copy against scrolls out of
 * sight exactly when you are editing the copy.
 *
 * Three things have to line up, and missing any one of them silently does nothing:
 *
 *  1. **A definite height to resolve against.** `AppShell` wraps a screen in
 *     `flex h-full flex-col`, so `flex-1` here takes what the page header leaves. Under an
 *     auto-height parent `flex-grow` has nothing to grow into and the rule is inert.
 *  2. **`min-h-0` on the scrolling child.** A grid item's `min-height: auto` refuses to
 *     shrink below its content, so without it the column grows to fit the editor, pushes
 *     the pane taller, and the page scrolls exactly as before — `overflow-y-auto` on a box
 *     that is never smaller than its content never shows a scrollbar.
 *  3. **No `overflow` on the fixed side.** A rail that clips is a page an editor cannot
 *     reach, with no scrollbar to look for; a preview that clips is a preview that lies.
 *     If the fixed side outgrows the floor, raise the floor.
 *
 * `lg:` only. On a narrow window an inner scroller nested inside the page scroller is the
 * worse of the two behaviours — two scrollbars, and a wheel that stops working depending
 * on where the pointer happens to be.
 *
 * The floor is `GRID_CARD`'s lesson again: a `flex-1` child that opts out of
 * `min-height: auto` will shrink to nothing on a short window and take the other column
 * with it. 30 rem clears any of the four with room to spare.
 *
 * **Pair with a `lg:grid-cols-…` track of the screen's own.**
 */
export const SPLIT_PANE = 'grid gap-lg lg:min-h-[30rem] lg:flex-1';

/** The one column of a {@link SPLIT_PANE} that scrolls. Put it on exactly one side. */
export const SPLIT_PANE_SCROLLER = 'lg:min-h-0 lg:overflow-y-auto';
