/**
 * A table as a CSV file the browser downloads.
 *
 * With a byte-order mark, so Excel opens Sinhala and Tamil headers as UTF-8 rather than as
 * question marks, and every cell quoted, so a name with a comma stays one cell.
 */
export function downloadCsv(filename: string, header: string[], rows: unknown[][]): void {
  const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((line) => line.map(quote).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Today as `YYYY-MM-DD`, for file names. */
export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * CSV text → rows of cells. RFC 4180: quoted cells may hold commas, quotes (doubled) and
 * line breaks. Accepts `,` or `;` as the separator (Excel in some locales saves `;`), a
 * leading byte-order mark, and `\r\n` or `\n` line ends. Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] ?? '';
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === separator) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((one) => one.some((value) => value.trim() !== ''));
}

/** Downloads text as a file, e.g. an import template. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
