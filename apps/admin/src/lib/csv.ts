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
