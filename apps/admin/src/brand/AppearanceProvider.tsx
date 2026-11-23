/**
 * The reader's own scheme and text size, shared with whatever needs to render them.
 *
 * Context rather than a module-level value, because two things read it and one of them
 * writes: `BrandProvider` turns it into CSS custom properties, and the control in the top
 * bar has to show which option is currently on. A module constant would leave the control
 * unable to re-render when the choice changes.
 *
 * Deliberately **not** Zustand, which this app uses for auth. Auth is asked for from deep
 * inside repositories and interceptors that are not React; this is read by exactly two
 * components and belongs to the tree.
 */

import { useCallback, useMemo, useState, type PropsWithChildren } from 'react';
import { persistAppearance, readAppearance, type Appearance } from './appearance';
import { AppearanceContext, type AppearanceValue } from './appearanceContext';

export function AppearanceProvider({ children }: PropsWithChildren) {
  /**
   * Read once, lazily.
   *
   * Not on every render: `readAppearance` touches `localStorage` and parses JSON, and the
   * value cannot change underneath this component: every write in the app goes through
   * the setters below.
   */
  const [appearance, setAppearance] = useState<Appearance>(readAppearance);

  /**
   * Merged into the **latest** value, not the one this render saw: the profile screen applies
   * several settings in one go, and each setter spreading a stale copy would undo the one
   * before it.
   */
  const update = useCallback((change: Partial<Appearance>) => {
    setAppearance((previous) => {
      const next = { ...previous, ...change };
      // Persisted with the state update rather than in an effect, so a choice survives a
      // reload even if the tab is closed in the same tick.
      persistAppearance(next);
      return next;
    });
  }, []);

  const value = useMemo<AppearanceValue>(
    () => ({
      appearance,
      setScheme: (scheme) => update({ scheme }),
      setTextSize: (textSize) => update({ textSize }),
      setGlass: (glass) => update({ glass }),
      setBackdrop: (backdrop, photo) => update(photo === undefined ? { backdrop } : { backdrop, photo }),
      setDensity: (density) => update({ density }),
      setContrast: (contrast) => update({ contrast }),
      setSidebar: (sidebar) => update({ sidebar }),
      updateAppearance: update,
    }),
    [appearance, update],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
