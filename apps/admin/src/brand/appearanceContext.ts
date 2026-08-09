/**
 * The context object, apart from both the provider and the hook.
 *
 * Three files for one small piece of state is more than it looks like it needs, and the
 * reason is fast refresh: a module that exports a component **and** a context loses hot
 * reloading for that component, so an edit anywhere under the provider remounts the tree
 * and drops whatever was on screen. Same split as `lib/localDate.ts` beside `<Calendar>`.
 */

import { createContext } from 'react';
import { DEFAULT_APPEARANCE, type Appearance, type ConsoleScheme, type TextSize } from './appearance';

export interface AppearanceValue {
  appearance: Appearance;
  setScheme: (scheme: ConsoleScheme) => void;
  setTextSize: (size: TextSize) => void;
}

/**
 * Defaulted to the same values `readAppearance` falls back on, so a component rendered
 * outside the provider shows the console's ordinary appearance rather than blank tokens.
 * The setters are no-ops there, which is the honest behaviour: there is nothing to set.
 */
export const AppearanceContext = createContext<AppearanceValue>({
  appearance: DEFAULT_APPEARANCE,
  setScheme: () => {},
  setTextSize: () => {},
});
