/**
 * The language pill.
 *
 * What is worth testing here is not that a click changes a string — it is the set of
 * things that would strand the person the control exists for:
 *
 *  - an option rendered in the *active* language instead of its own script, which
 *    makes the way out unreadable to whoever needs it
 *  - a choice that does not survive a reload, on machines where the next shift is a
 *    different person
 *  - `<html lang>` left behind, which is what a screen reader and the font stack read
 *  - three tab stops instead of one, and arrow keys that do nothing
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import '@/i18n';
import { i18next, setLanguage } from '@/i18n';
import { LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';

const STORAGE_KEY = 'tfd.admin.language';

/**
 * The endonyms are the accessible names, so they are how the segments are found —
 * and they are read from `languages.ts` rather than copied into this file.
 *
 * Not fussiness. Sinhala and Tamil share glyph *shapes* across unrelated code
 * points: U+0DD2 (Sinhala is-pilla) and U+0BBF (Tamil vowel i) are near enough
 * visually that a hand-copied literal can differ from the shipped one by a single
 * invisible character and fail with a diff nobody can read. Deriving them means the
 * test asserts against exactly what the control renders.
 */
function endonym(code: LanguageCode): string {
  const language = LANGUAGES.find((candidate) => candidate.code === code);
  if (!language) throw new Error(`no such language: ${code}`);
  return language.name;
}

const SINHALA = endonym('si');
const ENGLISH = endonym('en');
const TAMIL = endonym('ta');

/**
 * A working `localStorage`.
 *
 * This environment's `window.localStorage` is an empty object — no `getItem`, no
 * `setItem` — while `sessionStorage` is a real `Storage`. The guards in `@/i18n`
 * swallow that, which is the correct production behaviour (Safari in private mode
 * throws here) but means persistence cannot be observed without a real one.
 *
 * Installed per test rather than in `test/setup.ts`: nothing else in the console
 * touches `localStorage` by design, so giving the whole suite one would be changing
 * shared infrastructure for a single feature's benefit.
 */
function installLocalStorage(): void {
  const entries = new Map<string, string>();
  const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'> = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, String(value)),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
  };
  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  });
}

beforeEach(async () => {
  installLocalStorage();
  await setLanguage('en');
});

describe('LanguageSwitcher', () => {
  it('offers all three languages, each named in its own script', () => {
    render(<LanguageSwitcher />);
    const group = screen.getByRole('radiogroup');

    for (const name of [SINHALA, ENGLISH, TAMIL]) {
      expect(within(group).getByRole('radio', { name })).toBeInTheDocument();
    }
    expect(within(group).getAllByRole('radio')).toHaveLength(3);
  });

  it('keeps every option in its own script when the active language changes', async () => {
    render(<LanguageSwitcher />);
    // Wrapped: `setLanguage` re-renders every subscriber of `useTranslation`.
    await act(async () => setLanguage('si'));

    // The regression this guards: routing the labels through t() would render all
    // three in Sinhala, so a Tamil reader could no longer find தமிழ்.
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: TAMIL })).toBeInTheDocument();
    });
    expect(screen.getByRole('radio', { name: ENGLISH })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: SINHALA })).toBeInTheDocument();
  });

  it('marks exactly one segment checked, and it is the active language', async () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole('radio', { name: ENGLISH })).toBeChecked();

    await act(async () => setLanguage('ta'));

    await waitFor(() => expect(screen.getByRole('radio', { name: TAMIL })).toBeChecked());
    expect(screen.getByRole('radio', { name: ENGLISH })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: SINHALA })).not.toBeChecked();
  });

  it('switches the chrome when a segment is clicked', async () => {
    render(<LanguageSwitcher />);
    await userEvent.click(screen.getByRole('radio', { name: SINHALA }));

    await waitFor(() => expect(i18next.resolvedLanguage).toBe('si'));
  });

  it('remembers the choice, so the next shift opens in the language it was left in', async () => {
    render(<LanguageSwitcher />);
    await userEvent.click(screen.getByRole('radio', { name: TAMIL }));

    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBe('ta'));
  });

  it('moves <html lang> with the language, which the font stack and a reader follow', async () => {
    render(<LanguageSwitcher />);
    await userEvent.click(screen.getByRole('radio', { name: SINHALA }));

    await waitFor(() => expect(document.documentElement.lang).toBe('si'));
  });

  it('is one tab stop, not three', () => {
    render(<LanguageSwitcher />);
    const reachable = screen
      .getAllByRole('radio')
      .filter((segment) => segment.getAttribute('tabindex') === '0');

    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toHaveAccessibleName(ENGLISH);
  });

  it('moves the selection with the arrow keys, and wraps', async () => {
    render(<LanguageSwitcher />);
    screen.getByRole('radio', { name: ENGLISH }).focus();

    // en → ta (right), then wrap ta → si.
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(i18next.resolvedLanguage).toBe('ta'));

    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(i18next.resolvedLanguage).toBe('si'));
  });

  it('labels each segment with its own lang, so glyphs resolve to the right face', () => {
    render(<LanguageSwitcher />);

    for (const language of LANGUAGES) {
      expect(screen.getByRole('radio', { name: language.name })).toHaveAttribute(
        'lang',
        language.code,
      );
    }
  });
});
