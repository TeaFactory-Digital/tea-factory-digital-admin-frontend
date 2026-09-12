/**
 * The seam between what the API answers and what the console's types promise.
 *
 * Everything in this file exists because the backend and `@tfd/domain` disagree in a
 * *shape* rather than in a *fact* — a list that arrives bare where the type says paged,
 * a mutation that acknowledges with an id where the type says "the updated record". The
 * facts are the same; only the envelope differs.
 *
 * It lives here rather than in each repository so that every one of those disagreements
 * is written down in one place. Each is cross-referenced in `docs/BACKEND-API-GAPS.md`,
 * and each becomes deletable the day the API closes it — which is the point of keeping
 * them together rather than sprinkling `?? 0` through eighteen files.
 *
 * **Nothing here invents a fact.** A count the API does not send arrives as `null`, never
 * as `0`: an empty queue and a queue whose age the server never reported look identical
 * on screen, and the office reads both as "nothing waiting".
 */

import type { Paged } from '@tfd/domain';

/**
 * What every mutating endpoint on this API actually answers with.
 *
 * The backend returns a thin acknowledgement — `{ id }`, sometimes `{ id, status }` —
 * rather than the record it just wrote (see gap **G-11**). That is a legitimate design:
 * the console invalidates and refetches on success, so the round trip the full record
 * would have saved is one it takes anyway for the *list* beside the record.
 *
 * What it must not do is pretend otherwise. A repository typed `Promise<AdminSupplier>`
 * over a `{ id }` body is a lie the type checker cannot catch, and the first component to
 * read `result.name` renders `undefined` in production only.
 */
export interface MutationAck {
  id: string;
}

/** An acknowledgement that also reports the state the record landed in. */
export interface StatusAck<S extends string = string> extends MutationAck {
  status: S;
}

/**
 * Wrap a bare array in the paging envelope the console's types expect.
 *
 * Several list endpoints answer with a plain array and no total — `GET /admin/users`,
 * `GET /admin/banners`, `GET /admin/notifications` (gap **G-09**). The rows are complete
 * and unpaged, so the honest envelope is *one page holding everything*:
 *
 *  - `total` is the array's length, which for an unpaged answer is the true total.
 *  - `nextPage` is `null`, because there is no next page — not `page + 1`, which would
 *    make a grid offer a pager onto an empty second page.
 *
 * `pageSize` reports the number of rows rather than the size that was *asked for*, so
 * "1–37 of 37" reads correctly instead of "1–50 of 37".
 */
export function asSinglePage<T>(rows: readonly T[]): Paged<T> {
  return {
    items: [...rows],
    page: 0,
    pageSize: rows.length,
    total: rows.length,
    nextPage: null,
  };
}

/**
 * Page an array the server sent whole.
 *
 * Used where the console asks for a page and the API ignores the request: slicing here
 * keeps the grid's pager honest about what it is showing, and the `total` stays the real
 * one so the count in the header is right.
 *
 * Client-side paging over a server-side list is a stopgap and is marked as one — it
 * transfers every row to page through any of them. It is acceptable only for the lists
 * that are small by construction (staff, notification history, banners) and is the
 * reason gap **G-09** asks for real paging rather than shrugging at it.
 */
export function paginate<T>(
  rows: readonly T[],
  query: { page?: number; pageSize?: number } = {},
): Paged<T> {
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : rows.length || 1;
  const page = query.page && query.page > 0 ? query.page : 0;
  const start = page * pageSize;
  const items = rows.slice(start, start + pageSize);

  return {
    items,
    page,
    pageSize,
    total: rows.length,
    // `null` rather than `page + 1` at the end: a pager that offers a page which comes
    // back empty is worse than one that stops.
    nextPage: start + items.length < rows.length ? page + 1 : null,
  };
}
