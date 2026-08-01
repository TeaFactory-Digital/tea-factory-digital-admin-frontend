/**
 * M4 gateway.
 *
 * The client-side guards here are not a substitute for the server's — the server
 * refuses all of this too, and it is the authority (§9.3). They exist because the
 * feedback belongs where the accountant is typing: a rate with three decimals
 * should be refused under the field, not after a round trip, and a publish that
 * will fail on open exceptions should never leave the browser.
 */

import {
  monthlyRateSchema,
  publishMonthSchema,
  resolveExceptionSchema,
  type MonthException,
  type MonthExceptionQuery,
  type MonthSummary,
  type MonthlyRateEntry,
  type Paged,
} from '@tfd/domain';
import { monthEndpoints } from '../endpoints/months';
import { ApiError } from '../api/errors';

export const monthRepository = {
  /** Newest first — the office works in the month in progress. */
  list: (): Promise<Paged<MonthSummary>> => monthEndpoints.list({ page: 0, pageSize: 24 }),

  get: (monthKey: string): Promise<MonthSummary> => monthEndpoints.get(monthKey),

  setRate: async (monthKey: string, body: MonthlyRateEntry): Promise<MonthSummary> => {
    const parsed = monthlyRateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError({
        code: 'invalid-rate',
        message: 'That is not a rate the factory can record.',
        details: parsed.error.flatten(),
      });
    }
    return monthEndpoints.setRate(monthKey, parsed.data);
  },

  exceptions: (monthKey: string, query: MonthExceptionQuery = {}): Promise<Paged<MonthException>> =>
    monthEndpoints.exceptions(monthKey, { page: 0, pageSize: 100, ...query }),

  resolveException: async (
    monthKey: string,
    id: string,
    note: string,
  ): Promise<MonthException> => {
    const parsed = resolveExceptionSchema.safeParse({ note });
    if (!parsed.success) {
      throw new ApiError({
        code: 'note-required',
        message: 'A note is required to resolve an exception.',
        details: parsed.error.flatten(),
      });
    }
    return monthEndpoints.resolveException(monthKey, id, parsed.data.note);
  },

  /**
   * Publish, with the month key validated on the way out.
   *
   * A malformed key here would reach the server as a path segment and could match
   * a different month; this is cheap insurance on the one call in the console that
   * cannot be taken back.
   */
  publish: async (monthKey: string, note?: string): Promise<MonthSummary> => {
    const parsed = publishMonthSchema.safeParse({ monthKey, note });
    if (!parsed.success) {
      throw new ApiError({
        code: 'invalid',
        message: 'That is not a month the console can publish.',
        details: parsed.error.flatten(),
      });
    }
    return monthEndpoints.publish(parsed.data.monthKey, parsed.data.note);
  },
};
