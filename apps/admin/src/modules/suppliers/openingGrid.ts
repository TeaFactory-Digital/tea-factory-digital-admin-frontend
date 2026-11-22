/** The opening balances sheet's lines, apart from the screen so they can be tested. */

import { plainFigure } from '@/components/ui/moneyFigures';

/** The figures across a line, in the order of the opening balances file after the code. */
export const GRID_COLUMNS = [
  'advance',
  'loan',
  'manure',
  'teaPackets',
  'savings',
  'previousDebt',
  'loanMonthsLeft',
  'loanInstalmentsPaid',
] as const;
export type Column = (typeof GRID_COLUMNS)[number];

export interface Line {
  key: string;
  code: string;
  values: Record<Column, string>;
  problems?: string[];
}

const emptyValues = (): Record<Column, string> =>
  Object.fromEntries(GRID_COLUMNS.map((column) => [column, ''])) as Record<Column, string>;
export const newLine = (code = ''): Line => ({
  key: crypto.randomUUID(),
  code,
  values: emptyValues(),
});

/** Last month, `YYYY-MM`: the month the figures were true at the end of, usually. */
export function lastMonthKey(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Tab-separated lines from Excel: the code, then the figures in `GRID_COLUMNS` order. */
export function parseGridPaste(text: string): Line[] {
  return text
    .split(/\r?\n/)
    .map((row) => row.split('\t').map((cell) => cell.trim()))
    .filter((cells) => cells[0])
    .map((cells) => {
      const line = newLine(cells[0]);
      GRID_COLUMNS.forEach((column, index) => {
        line.values[column] = plainFigure(cells[index + 1] ?? '');
      });
      return line;
    });
}
