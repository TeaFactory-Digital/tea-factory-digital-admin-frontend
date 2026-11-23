/**
 * The part of a long text that changed, with a little context either side (24 November
 * 2026): the common start and end are trimmed away, so "1 ## When is my bill..." against
 * "## When is my bill..." reads as "1 " removed, not as two pages of text.
 */

export interface ChangeExcerpt {
  leading: string;
  removed: string;
  added: string;
  trailing: string;
  /** More text before `leading` / after `trailing`, so the reader is shown "…". */
  cutStart: boolean;
  cutEnd: boolean;
}

const CONTEXT = 40;
const MAX_PART = 240;

const clip = (text: string) => (text.length > MAX_PART ? `${text.slice(0, MAX_PART)}…` : text);

export function changeExcerpt(before: string, after: string): ChangeExcerpt {
  let start = 0;
  const shortest = Math.min(before.length, after.length);
  while (start < shortest && before[start] === after[start]) start += 1;
  let end = 0;
  while (
    end < shortest - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end += 1;
  }
  // Whole words: "two weeks" to "ten days", not "wo week" to "en day". The prefix and suffix
  // are common to both texts, so widening into them keeps the two sides aligned.
  const isSpace = (char: string | undefined) => char === undefined || /\s/.test(char);
  while (start > 0 && !isSpace(before[start - 1])) start -= 1;
  while (end > 0 && !isSpace(before[before.length - end - 1]) && !isSpace(before[before.length - end])) end -= 1;
  return {
    leading: before.slice(Math.max(0, start - CONTEXT), start),
    removed: clip(before.slice(start, before.length - end)),
    added: clip(after.slice(start, after.length - end)),
    trailing: before.slice(before.length - end, before.length - end + CONTEXT),
    cutStart: start > CONTEXT,
    cutEnd: end > CONTEXT,
  };
}
