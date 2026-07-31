/**
 * The React Query client.
 *
 * Defaults tuned for an office, not a phone. Two of them are decisions rather
 * than taste:
 *
 *  - **No retry on a domain error.** A `403 forbidden` or a
 *    `409 four-eyes-violation` is a final answer; retrying it three times delays
 *    the message the clerk needs and multiplies the audit noise. Transport
 *    failures do retry.
 *  - **`refetchOnWindowFocus` on.** Two clerks work the same inbox. Coming back
 *    to a tab that has been open since lunch and seeing a queue that was decided
 *    an hour ago is how the `already-decided` error gets hit.
 */

import { QueryClient } from '@tanstack/react-query';
import { isApiError, isTransportError } from '@/services/api/errors';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (isApiError(error) && !isTransportError(error)) return false;
          return failureCount < 2;
        },
      },
      mutations: {
        // Never retried automatically. Every mutation here moves money, changes a
        // supplier's payout details or writes an audit entry; the idempotency key
        // makes a *deliberate* retry safe, and an automatic one indistinguishable
        // from a clerk clicking twice.
        retry: false,
      },
    },
  });
}
