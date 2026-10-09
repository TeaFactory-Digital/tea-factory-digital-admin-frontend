/**
 * Many records at once, from an Excel (`.xlsx`) or CSV file.
 *
 * Three steps in one dialog, so the office never sends a file it has not seen:
 *
 *  1. **Choose** a file, or download the template with the exact column names.
 *  2. **Check**: every row is shown with its problems marked, before anything is sent.
 *     A file with any problem cannot be imported; the office fixes it and chooses again.
 *  3. **Import**. The server checks again (an unknown supplier code, a published month)
 *     and saves **all rows or none**, so a file is never half in.
 *
 * Column names are English and fixed whatever the console's language, so one template
 * works for every clerk and the API reads the same names (`IMPORT_COLUMNS`).
 */

import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import {
  IMPORT_COLUMNS,
  importRowProblems,
  importTemplateCsv,
  type ImportKind,
  type ImportRowProblem,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { downloadText } from '@/lib/csv';
import { errorMessageKey } from '@/lib/errorMessage';
import { ImportFileError, readImportFile, type ImportFile } from '@/lib/importFile';
import { useImportRows } from '@/modules/records/hooks';

/** Rows shown in the preview. The count and every problem cover the whole file. */
const PREVIEW_ROWS = 50;

export function ImportDialog({
  kind,
  open,
  onClose,
}: {
  kind: ImportKind;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const importRows = useImportRows(kind);

  const [file, setFile] = useState<{ name: string; data: ImportFile } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<ImportRowProblem[] | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const columns = IMPORT_COLUMNS[kind];
  const missing = useMemo(
    () =>
      file
        ? columns.filter((c) => c.required && !file.data.headers.includes(c.key)).map((c) => c.key)
        : [],
    [file, columns],
  );
  const problems = useMemo(
    () => serverProblems ?? (file && missing.length === 0 ? importRowProblems(kind, file.data.rows) : []),
    [serverProblems, file, missing, kind],
  );
  const badCells = useMemo(
    () => new Set(problems.map((p) => `${p.row}:${p.column ?? ''}`)),
    [problems],
  );
  const badRows = useMemo(() => new Set(problems.map((p) => p.row)), [problems]);

  function reset() {
    setFile(null);
    setReadError(null);
    setServerProblems(null);
    setSaved(null);
    if (input.current) input.current.value = '';
  }

  function close() {
    reset();
    onClose();
  }

  async function choose(chosen: File | undefined) {
    if (!chosen) return;
    reset();
    try {
      setFile({ name: chosen.name, data: await readImportFile(chosen) });
    } catch (error) {
      const code = error instanceof ImportFileError ? error.code : 'unreadable';
      setReadError(t(`records.import.fileError.${code}`));
    }
  }

  async function submit() {
    if (!file) return;
    try {
      const result = await importRows.mutateAsync({ fileName: file.name, rows: file.data.rows });
      if (result.problems.length > 0) {
        setServerProblems(result.problems);
        return;
      }
      setSaved(result.saved);
      toast.success(t('records.import.saved', { count: result.saved }));
    } catch (error) {
      toast.error(t('records.import.failed'), t(errorMessageKey(error)));
    }
  }

  const describe = (problem: ImportRowProblem) =>
    t('records.import.problemLine', {
      row: problem.row,
      column: problem.column ?? '-',
      message: t(`records.import.problem.${problem.code}`, {
        defaultValue: t('records.import.problem.other', { code: problem.code }),
      }),
    });

  const shownColumns = file ? columns.filter((c) => file.data.headers.includes(c.key)) : [];
  const canImport = file !== null && missing.length === 0 && problems.length === 0 && saved === null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
      size="md"
      title={t(`records.import.title.${kind}`)}
      description={t(`records.import.intro.${kind}`)}
      footer={
        saved !== null ? (
          <Button variant="primary" onClick={close}>
            {t('records.import.done')}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              {t('common.cancel')}
            </Button>
            {file ? (
              <Button variant="secondary" iconLeft={<RotateCcw className="size-icon-sm" aria-hidden />} onClick={reset}>
                {t('records.import.another')}
              </Button>
            ) : null}
            <Button
              variant="primary"
              iconLeft={<Upload className="size-icon-sm" aria-hidden />}
              disabled={!canImport}
              loading={importRows.isPending}
              onClick={() => void submit()}
            >
              {file
                ? t('records.import.submit', { count: file.data.rows.length })
                : t('records.import.submitEmpty')}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-md">
        {saved !== null ? (
          <div className="flex flex-col items-center gap-sm py-lg text-center">
            <CheckCircle2 className="size-icon-xl text-success" aria-hidden />
            <p className="text-subtitle font-semibold text-text-primary">
              {t('records.import.saved', { count: saved })}
            </p>
          </div>
        ) : !file ? (
          <>
            <button
              type="button"
              onClick={() => input.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void choose(event.dataTransfer.files[0]);
              }}
              className="flex flex-col items-center gap-sm rounded-lg border-2 border-dashed border-border px-lg py-xl text-center hover:border-primary hover:bg-primary-muted"
            >
              <FileSpreadsheet className="size-icon-xl text-primary" aria-hidden />
              <span className="text-body font-medium text-text-primary">{t('records.import.choose')}</span>
              <span className="text-caption text-text-secondary">{t('records.import.formats')}</span>
            </button>
            <input
              ref={input}
              type="file"
              accept=".csv,.xlsx,text/csv"
              className="sr-only"
              aria-label={t('records.import.choose')}
              onChange={(event) => void choose(event.target.files?.[0])}
            />

            {readError ? <Notice tone="error">{readError}</Notice> : null}

            <div className="flex flex-col gap-sm rounded-md bg-surface-variant p-md">
              <div className="flex flex-wrap items-center justify-between gap-sm">
                <span className="text-body-small font-semibold text-text-primary">
                  {t('records.import.columns')}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  iconLeft={<Download className="size-icon-sm" aria-hidden />}
                  onClick={() => downloadText(`${kind}-template.csv`, importTemplateCsv(kind))}
                >
                  {t('records.import.template')}
                </Button>
              </div>
              <ul className="flex flex-wrap gap-xs">
                {columns.map((column) => (
                  <li
                    key={column.key}
                    className={cn(
                      'rounded-sm px-sm py-xxs font-mono text-caption',
                      column.required ? 'bg-primary-muted text-primary' : 'bg-surface text-text-secondary',
                    )}
                    title={column.values?.join(' | ')}
                  >
                    {column.key}
                    {column.required ? ' *' : ''}
                  </li>
                ))}
              </ul>
              <span className="text-caption text-text-secondary">{t('records.import.columnsHint')}</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-sm text-body-small">
              <FileSpreadsheet className="size-icon-sm text-primary" aria-hidden />
              <span className="font-medium text-text-primary">{file.name}</span>
              <span className="text-text-secondary">
                {t('records.import.rowCount', { count: file.data.rows.length })}
              </span>
            </div>

            {missing.length > 0 ? (
              <Notice tone="error">{t('records.import.missingColumns', { columns: missing.join(', ') })}</Notice>
            ) : problems.length > 0 ? (
              <Notice tone="error">
                <span className="flex flex-col gap-xs">
                  <strong className="font-semibold">
                    {serverProblems
                      ? t('records.import.serverProblems', { count: problems.length })
                      : t('records.import.problems', { count: problems.length })}
                  </strong>
                  <ul className="max-h-40 list-disc overflow-y-auto pl-lg">
                    {problems.slice(0, 100).map((problem, index) => (
                      <li key={index}>{describe(problem)}</li>
                    ))}
                  </ul>
                </span>
              </Notice>
            ) : (
              <Notice tone="info">{t('records.import.ready', { count: file.data.rows.length })}</Notice>
            )}

            {missing.length === 0 ? (
              <div className="max-h-80 overflow-auto rounded-md border border-border">
                <table className="w-full text-left text-caption">
                  <thead className="sticky top-0 bg-surface-variant">
                    <tr>
                      <th className="px-sm py-xs font-semibold text-text-secondary">#</th>
                      {shownColumns.map((column) => (
                        <th key={column.key} className="whitespace-nowrap px-sm py-xs font-mono font-semibold text-text-secondary">
                          {column.key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {file.data.rows.slice(0, PREVIEW_ROWS).map((row, index) => {
                      const line = index + 2;
                      return (
                        <tr key={line} className={cn('border-t border-divider', badRows.has(line) && 'bg-error-muted')}>
                          <td className="numeric px-sm py-xs text-text-secondary">{line}</td>
                          {shownColumns.map((column) => (
                            <td
                              key={column.key}
                              className={cn(
                                'whitespace-nowrap px-sm py-xs',
                                badCells.has(`${line}:${column.key}`)
                                  ? 'font-semibold text-error'
                                  : 'text-text-primary',
                              )}
                            >
                              {row[column.key] || '-'}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {file.data.rows.length > PREVIEW_ROWS ? (
              <span className="text-caption text-text-secondary">
                {t('records.import.previewLimit', { shown: PREVIEW_ROWS, count: file.data.rows.length })}
              </span>
            ) : null}
          </>
        )}
      </div>
    </Dialog>
  );
}
