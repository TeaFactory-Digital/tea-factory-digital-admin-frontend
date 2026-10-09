/**
 * A change request's two summaries, as rows the office can compare.
 *
 * The API sends each side as one string: `"Home: - · Estate: -"` and
 * `"Home: Probe Road · Estate: -"`. Read whole, the office has to spot the one word that
 * differs. Split into labelled parts and paired by label, the screen can show a table with
 * the changed row marked and an empty value written as "Not set" rather than a dash.
 *
 * A summary without labels (`"bankTransfer"`, `"LKR 2.00 per kg"`, a bank line with dots
 * in it) stays one row: splitting a bank line on its separators would invent fields.
 */

export interface SummaryRow {
  /** The part's own label (`Home`), or null when the summary has none. */
  label: string | null;
  current: string | null;
  requested: string | null;
  changed: boolean;
}

const SEPARATOR = ' · ';
const LABELLED = /^([A-Za-z][A-Za-z ]{0,29}):\s*(.*)$/;
/**
 * What the API writes for "nothing on file". `\u2014` (the long dash) is kept as an escape:
 * summaries the API stored before it switched to `-` still carry it.
 */
const EMPTY_VALUES = new Set(['', '\u2014', '-', 'none on file', 'none', 'null']);

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return EMPTY_VALUES.has(trimmed.toLowerCase()) ? null : trimmed;
}

/** `Label: value` parts, or null when any part is unlabelled. */
function labelledParts(summary: string | null): Map<string, string | null> | null {
  if (!summary) return new Map();
  const parts = summary.split(SEPARATOR);
  const map = new Map<string, string | null>();
  for (const part of parts) {
    const match = LABELLED.exec(part.trim());
    if (!match) return null;
    map.set(match[1]!.trim(), clean(match[2]));
  }
  return map;
}

export function compareSummaries(
  currentSummary: string | null,
  requestedSummary: string | null,
): SummaryRow[] {
  const current = labelledParts(currentSummary);
  const requested = labelledParts(requestedSummary);

  if (current && requested && (current.size > 0 || requested.size > 0)) {
    const labels = [...new Set([...current.keys(), ...requested.keys()])];
    return labels.map((label) => {
      const before = current.get(label) ?? null;
      const after = requested.get(label) ?? null;
      return { label, current: before, requested: after, changed: before !== after };
    });
  }

  const before = clean(currentSummary);
  const after = clean(requestedSummary);
  return [{ label: null, current: before, requested: after, changed: before !== after }];
}
