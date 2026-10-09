/**
 * Reads an import file, Excel (`.xlsx`) or CSV, into rows keyed by the header row.
 *
 * Every value comes back as text, trimmed, because the checks that follow
 * (`importRowProblems`) and the server both work on text: "24.50" and 24.5 are the same
 * weighing, and a date Excel stored as a number has to become `YYYY-MM-DD` the same way
 * whichever program saved the file.
 */

import type { ImportRow } from '@tfd/domain';
import { parseCsv } from './csv';

export interface ImportFile {
  headers: string[];
  rows: ImportRow[];
}

export class ImportFileError extends Error {
  constructor(public readonly code: 'unsupported' | 'empty' | 'unreadable') {
    super(code);
  }
}

/** A cell as text. Excel dates arrive as `Date` (midnight UTC) and become `YYYY-MM-DD`. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function toRows(table: unknown[][]): ImportFile {
  const [head, ...body] = table;
  if (!head || body.length === 0) throw new ImportFileError('empty');
  const headers = head.map(cellText);
  const rows = body
    .map((cells) =>
      Object.fromEntries(headers.map((header, index) => [header, cellText(cells[index])])),
    )
    .filter((row) => Object.values(row).some((value) => value !== ''));
  if (rows.length === 0) throw new ImportFileError('empty');
  return { headers, rows };
}

/** `File.text()` where the browser has it, `FileReader` where it does not. */
function readText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function readImportFile(file: File): Promise<ImportFile> {
  const name = file.name.toLowerCase();
  try {
    if (name.endsWith('.csv') || file.type === 'text/csv') {
      return toRows(parseCsv(await readText(file)));
    }
    if (name.endsWith('.xlsx')) {
      // Loaded only when somebody imports a spreadsheet, so the console's first page does
      // not carry a spreadsheet reader.
      const { readSheet } = await import('read-excel-file/browser');
      return toRows((await readSheet(file)) as unknown[][]);
    }
  } catch (error) {
    if (error instanceof ImportFileError) throw error;
    throw new ImportFileError('unreadable');
  }
  throw new ImportFileError('unsupported');
}
