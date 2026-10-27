/**
 * The Sinhala and Tamil tables, checked the way a reader would notice first.
 *
 * Not a language review (that was done by reading every entry against the English, on
 * 26 October 2026); these are the mistakes a machine can catch and a person reads past:
 * a Tamil letter in the Sinhala table (the two scripts have look-alike glyphs), a vowel
 * sign with no letter before it (it renders as a dotted circle), a `{{placeholder}}`
 * renamed in translation (it prints as literal text), and English left untranslated.
 */
import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/locales/en';
import { si } from '@/i18n/locales/si';
import { ta } from '@/i18n/locales/ta';

const SINHALA = /[඀-෿]/;
const TAMIL = /[஀-௿]/;
type Range = readonly [number, number];
const within = (code: number, ranges: readonly Range[]) => ranges.some(([from, to]) => code >= from && code <= to);

/** Letters, and the dependent signs (vowel signs, virama, anusvara) that must follow one. */
const SINHALA_LETTERS: Range[] = [[0x0d85, 0x0dc6]];
const SINHALA_SIGNS: Range[] = [[0x0d81, 0x0d83], [0x0dca, 0x0dca], [0x0dcf, 0x0ddf], [0x0df2, 0x0df3]];
const TAMIL_LETTERS: Range[] = [[0x0b85, 0x0bb9]];
const TAMIL_SIGNS: Range[] = [[0x0b82, 0x0b82], [0x0bbe, 0x0bcd], [0x0bd7, 0x0bd7]];
const ZWJ = 0x200d;

/** A sign with no letter, sign or joiner before it: it renders as a dotted circle. */
function hasLooseSign(value: string, letters: readonly Range[], signs: readonly Range[]): boolean {
  const codes = [...value].map((char) => char.codePointAt(0) ?? 0);
  return codes.some(
    (code, index) =>
      within(code, signs) &&
      !(index > 0 && (within(codes[index - 1]!, letters) || within(codes[index - 1]!, signs) || codes[index - 1] === ZWJ)),
  );
}

const placeholders = (value: string) =>
  [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((match) => match[1]).sort();

/** Entries that are the same in every language on purpose: names, and lines that are only placeholders. */
const SAME_EVERYWHERE = new Set(['suppliers.push.platform.ios', 'suppliers.push.platform.android']);

/** Entries offered more values than they use: `format.date` is given the month long and short, and English takes the short one. */
const PLACEHOLDER_CHOICE = new Set(['format.date']);

describe.each([
  ['si', si, SINHALA, TAMIL, SINHALA_LETTERS, SINHALA_SIGNS],
  ['ta', ta, TAMIL, SINHALA, TAMIL_LETTERS, TAMIL_SIGNS],
] as const)('the %s table', (_lang, table, own, other, letters, signs) => {
  const keys = Object.keys(en) as (keyof typeof en)[];

  it('has no letters of the other script', () => {
    expect(keys.filter((key) => other.test(table[key]))).toEqual([]);
  });

  it('has no vowel sign without a letter before it', () => {
    expect(keys.filter((key) => hasLooseSign(table[key], letters, signs))).toEqual([]);
  });

  it('keeps every placeholder name as the English has it', () => {
    const renamed = keys.filter(
      (key) => !PLACEHOLDER_CHOICE.has(key) && placeholders(table[key]).join() !== placeholders(en[key]).join(),
    );
    expect(renamed).toEqual([]);
  });

  it('leaves no English sentence untranslated', () => {
    const untranslated = keys.filter(
      (key) => !SAME_EVERYWHERE.has(key) && /[a-z]{3,}/i.test(en[key].replace(/\{\{[^}]*\}\}/g, '')) && !own.test(table[key]),
    );
    expect(untranslated).toEqual([]);
  });

  it('never uses the em dash', () => {
    expect(keys.filter((key) => table[key].includes('\u2014'))).toEqual([]);
  });
});
