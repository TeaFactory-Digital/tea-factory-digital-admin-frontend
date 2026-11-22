import type { CreditVerb } from './hooks';

/** The money queue's own sentences, by verb. Words in the string tables. */
export const SUGGESTIONS: Record<CreditVerb, readonly string[]> = {
  approve: ['withinCeiling', 'counter', 'deducted'],
  reject: ['overCeiling', 'shortHistory', 'outstanding'],
};
