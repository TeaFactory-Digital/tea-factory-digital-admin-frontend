/**
 * Each list remembers its last filters (22 November 2026). Opened again from the menu (no
 * filters in the address), a screen comes back as the person left it: the same status, search
 * and lens. A link that carries its own filters (a dashboard tile, a shared address) always
 * wins, and clearing the filters clears what is remembered.
 *
 * Kept in this browser only, per person, and never needed: storage that is blocked or full
 * just means the screen opens with its defaults. The page number and the month or day are
 * not remembered, so a screen never reopens on page four or on a month already closed.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/auth/authStore';
import { filtersToRemember, rememberedFilters, storageKey } from './rememberedFilters';

export function RememberFilters({ screen, children }: { screen: string; children: ReactNode }) {
  const location = useLocation();
  const userId = useAuthStore((s) => s.user?.id);
  // Read once, on arriving: clearing the filters later must not bring them back.
  const [saved] = useState(() => (location.search ? null : rememberedFilters(screen, userId)));
  const [restored, setRestored] = useState(false);
  const restoring = Boolean(saved) && !restored && !location.search;

  useEffect(() => {
    if (restoring) return;
    if (location.search) setRestored(true);
    const keep = filtersToRemember(location.search);
    try {
      if (keep) window.localStorage.setItem(storageKey(screen, userId), keep);
      else window.localStorage.removeItem(storageKey(screen, userId));
    } catch {
      // Storage blocked or full: the screen still works, it just does not remember.
    }
  }, [location.search, restoring, screen, userId]);

  // Restored before the screen mounts, so its own first render reads the filters.
  if (restoring)
    return (
      <Navigate
        to={{ pathname: location.pathname, search: `?${saved}` }}
        state={location.state}
        replace
      />
    );
  return <>{children}</>;
}
