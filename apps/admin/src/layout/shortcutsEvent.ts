/** The event Ctrl+K's "Keyboard shortcuts" action sends, and the sheet listens for. */
export const SHORTCUTS_EVENT = 'tfd:shortcuts';

/** Opens the keyboard shortcuts sheet from anywhere. */
export function openShortcuts(): void {
  window.dispatchEvent(new Event(SHORTCUTS_EVENT));
}
