/**
 * Reads the reader's scheme and text size.
 *
 * Its own module because `AppearanceProvider.tsx` exports a component, and a file that
 * exports both a component and a hook loses fast refresh for the component — the same
 * reason `lib/localDate.ts` sits apart from `<Calendar>`.
 */

import { useContext } from 'react';
import { AppearanceContext, type AppearanceValue } from './appearanceContext';

export function useAppearance(): AppearanceValue {
  return useContext(AppearanceContext);
}
