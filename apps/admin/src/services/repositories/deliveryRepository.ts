/**
 * M3 Leaf collection — the entry gateway.
 *
 * This repository carries more than most, because a delivery is the fact every
 * money figure downstream is derived from. Three guarantees the UI relies on and
 * the wire does not promise:
 *
 *  - **Kilos arrive rounded to the kilo scale.** A backend answering
 *    `12.500000001` would put a figure in the grid that the office cannot
 *    reproduce and that will not match the bill.
 *  - **The batch is validated before it leaves.** The server must refuse a bad
 *    row too, and it does — but a clerk who typed `12.345` should be told in the
 *    grid, on the row, rather than after a round trip that also carried 59 good
 *    rows.
 *  - **A day's rows come back newest first.** A weighing session is worked by
 *    watching what was just entered appear at the top.
 */

import {
  deliveryBatchSchema,
  roundKg,
  voidDeliverySchema,
  type CollectionDaySummary,
  type Delivery,
  type DeliveryBatch,
  type DeliveryBatchResult,
  type DeliveryQuery,
  type Paged,
} from '@tfd/domain';
import { deliveryEndpoints } from '../endpoints/deliveries';
import { ApiError } from '../api/errors';

const withRoundedKgs = (delivery: Delivery): Delivery => ({
  ...delivery,
  kgs: roundKg(delivery.kgs),
});

export const deliveryRepository = {
  /** Newest first: a clerk watches the row they just entered arrive at the top. */
  list: async (query: DeliveryQuery = {}): Promise<Paged<Delivery>> => {
    const page = await deliveryEndpoints.list({ page: 0, pageSize: 50, ...query });
    return {
      ...page,
      items: page.items
        .map(withRoundedKgs)
        .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    };
  },

  day: (date: string, collectionPoint?: string): Promise<CollectionDaySummary> =>
    deliveryEndpoints.summary({ date, collectionPoint }),

  /**
   * Commit a weighing session.
   *
   * `async` so a validation failure **rejects** rather than throwing
   * synchronously — the same reason M9's decision methods are: React Query's
   * `mutate` would otherwise surface a client-side refusal as an uncaught
   * exception and the server's identical refusal as `mutation.error`.
   */
  commit: async (batch: DeliveryBatch): Promise<DeliveryBatchResult> => {
    const parsed = deliveryBatchSchema.safeParse(batch);
    if (!parsed.success) {
      throw new ApiError({
        code: 'invalid-batch',
        message: 'This weighing session has a row the factory cannot record.',
        details: parsed.error.flatten(),
      });
    }

    const result = await deliveryEndpoints.createBatch({
      ...batch,
      rows: batch.rows.map((row) => ({ ...row, kgs: roundKg(row.kgs) })),
    });
    return { ...result, accepted: result.accepted.map(withRoundedKgs) };
  },

  /** The reason is checked here too, so the dialog can say so without a round trip. */
  void: async (id: string, reason: string): Promise<Delivery> => {
    const parsed = voidDeliverySchema.safeParse({ reason });
    if (!parsed.success) {
      throw new ApiError({
        code: 'note-required',
        message: 'A reason is required to void a delivery.',
        details: parsed.error.flatten(),
      });
    }
    return deliveryEndpoints.void(id, reason).then(withRoundedKgs);
  },
};
