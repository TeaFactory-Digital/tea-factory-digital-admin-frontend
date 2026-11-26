/**
 * Rows that were just decided leave the list before it is refetched (26 November 2026).
 *
 * `leave(ids, refetch)` marks the rows (`DataTable`'s `leavingIds`), lets them slide out, then
 * refetches, and only clears the marks once the new list is in: clearing them first would
 * show the decided rows again for the length of the request. Instant when nothing moves.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { MOTION_MS, motionAllowed } from '@/lib/motion';

const NONE: ReadonlySet<string> = new Set();

export function useLeavingRows() {
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(NONE);
  const timer = useRef<number | undefined>(undefined);
  const live = useRef(true);
  useEffect(
    () => () => {
      live.current = false;
      window.clearTimeout(timer.current);
    },
    [],
  );

  const leave = useCallback((ids: readonly string[], refetch: () => Promise<unknown>) => {
    if (ids.length === 0) {
      void refetch();
      return;
    }
    setLeaving(new Set(ids));
    timer.current = window.setTimeout(
      () => {
        void refetch().finally(() => {
          if (live.current) setLeaving(NONE);
        });
      },
      motionAllowed() ? MOTION_MS.base : 0,
    );
  }, []);

  return { leaving, leave };
}
