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
 * A file can be imported again without doubling anything (`IMPORT_SKIP_KINDS`): leaf
 * already recorded and suppliers already on the roll are **skipped**, not refused. Before
 * the Import button, the server is asked what it would do (`dryRun`), so the office sees
 * which rows are already there; for leaf it may still choose to import them, for the rare
 * second weighing of the same kilos on the same day.
 *
 * Column names are English and fixed whatever the console's language, so one template
 * works for every clerk and the API reads the same names (`IMPORT_COLUMNS`).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import {
  IMPORT_COLUMNS,
  IMPORT_SKIP_KINDS,
  importRowProblems,
  missingImportColumns,
  importTemplateCsv,
  type ImportKind,
  type ImportRow,
  type ImportResult,
  type ImportRowProblem,
} from '@tfd/domain';
import { Checkbox } from '@/components/ui/Checkbox';
import { Label } from '@/components/ui/Label';
import { IMPORT_SKIP_ON_SERVER } from '@/lib/serverReady';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { downloadText } from '@/lib/csv';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatCount, formatKg, formatMoney } from '@/lib/format';
import { ImportFileError, readImportFile, type ImportFile } from '@/lib/importFile';
import { useImportRows, usePreviewImport } from '@/modules/records/hooks';

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
  const previewImport = usePreviewImport(kind);
  // Ask the server first only where rows can be skipped, and only once it takes `dryRun`.
  const previews = IMPORT_SKIP_ON_SERVER && IMPORT_SKIP_KINDS.has(kind);

  const [file, setFile] = useState<{ name: string; data: ImportFile } | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [serverProblems, setServerProblems] = useState<ImportRowProblem[] | null>(null);
  // The server sends at most 500 problems back; this is how many it found in all.
  const [serverTotal, setServerTotal] = useState(0);
  const [saved, setSaved] = useState<number | null>(null);
  // What the server would do with this file, and the skipped rows of the actual import.
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [savedSkipped, setSavedSkipped] = useState(0);
  // `bills` (A8): how many suppliers' kilos on the slips differ from the leaf entered here.
  const [leafDifferences, setLeafDifferences] = useState<ImportResult['leafDifferences']>(undefined);
  // Leaf only: import the rows already recorded anyway.
  const [keepDuplicates, setKeepDuplicates] = useState(false);

  const columns = IMPORT_COLUMNS[kind];
  // Required columns, and the balance columns whose header must be there even when blank.
  const missing = useMemo(() => (file ? missingImportColumns(kind, file.data.headers) : []), [file, kind]);
  const problems = useMemo(
    () => serverProblems ?? (file && missing.length === 0 ? importRowProblems(kind, file.data.rows) : []),
    [serverProblems, file, missing, kind],
  );
  const badCells = useMemo(
    () => new Set(problems.map((p) => `${p.row}:${p.column ?? ''}`)),
    [problems],
  );
  const badRows = useMemo(() => new Set(problems.map((p) => p.row)), [problems]);
  const skippedRows = useMemo(
    () => (keepDuplicates ? new Set<number>() : new Set((preview?.skipped ?? []).map((one) => one.row))),
    [preview, keepDuplicates],
  );
  const skippedTotal = preview?.skippedTotal ?? preview?.skipped?.length ?? 0;
  const clientReady = file !== null && missing.length === 0 && serverProblems === null && problems.length === 0;

  /** The preview, once the file passes the console's own checks. */
  useEffect(() => {
    if (!previews || !clientReady || !file || preview) return;
    let current = true;
    previewImport
      .mutateAsync({ fileName: file.name, rows: file.data.rows })
      .then((result) => {
        if (!current) return;
        if (result.problems.length > 0) {
          setServerProblems(result.problems);
          setServerTotal(result.problemTotal ?? result.problems.length);
        } else {
          setPreview(result);
        }
      })
      .catch((error: unknown) => {
        if (current) toast.error(t('records.import.failed'), t(errorMessageKey(error)));
      });
    return () => {
      current = false;
    };
    // The preview is asked once per file; `previewImport` and `toast` are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previews, clientReady, file, preview]);

  function reset() {
    setFile(null);
    setReadError(null);
    setServerProblems(null);
    setSaved(null);
    setPreview(null);
    setSavedSkipped(0);
    setLeafDifferences(undefined);
    setKeepDuplicates(false);
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
      const data = await readImportFile(chosen);
      setFile({ name: chosen.name, data: { ...data, rows: data.rows.map((row) => cleanExcelNumbers(kind, row)) } });
    } catch (error) {
      const code = error instanceof ImportFileError ? error.code : 'unreadable';
      setReadError(t(`records.import.fileError.${code}`));
    }
  }

  async function submit() {
    if (!file) return;
    try {
      const result = await importRows.mutateAsync({
        fileName: file.name,
        rows: file.data.rows,
        ...(kind === 'deliveries' && keepDuplicates ? { duplicates: 'import' as const } : {}),
      });
      if (result.problems.length > 0) {
        setServerProblems(result.problems);
        setServerTotal(result.problemTotal ?? result.problems.length);
        return;
      }
      setSaved(result.saved);
      setSavedSkipped(result.skippedTotal ?? result.skipped?.length ?? 0);
      setLeafDifferences(result.leafDifferences);
      toast.success(t('records.import.saved', { count: result.saved }));
    } catch (error) {
      toast.error(t('records.import.failed'), t(errorMessageKey(error)));
    }
  }

  const describe = (problem: ImportRowProblem) =>
    t('records.import.problemLine', {
      row: problem.row,
      column: problem.column ?? '-',
      message:
        // `approval-missing` names the rupees we approved that the slip lacks, when sent.
        problem.code === 'approval-missing' && problem.amount === undefined
          ? t('records.import.problem.approval-missing-plain')
          : t(`records.import.problem.${problem.code}`, {
              amount: problem.amount === undefined ? '' : formatMoney(problem.amount),
              defaultValue: t('records.import.problem.other', { code: problem.code }),
            }),
    });

  const shownColumns = file ? columns.filter((c) => file.data.headers.includes(c.key)) : [];
  // With a preview: what it said would be saved, or every row when the office keeps the
  // duplicates. Without one: the whole file, as before.
  const toImport = !file ? 0 : preview && !keepDuplicates ? preview.saved : file.data.rows.length;
  const canImport =
    clientReady && saved === null && (!previews || preview !== null) && toImport > 0;

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
              loading={importRows.isPending || previewImport.isPending}
              onClick={() => void submit()}
            >
              {file ? t('records.import.submit', { count: toImport }) : t('records.import.submitEmpty')}
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
            {leafDifferences && leafDifferences.suppliers > 0 ? (
              <p className="text-body-small text-text-secondary">
                {t('records.import.leafDifferences', {
                  suppliers: formatCount(leafDifferences.suppliers),
                  kgs: formatKg(leafDifferences.kgs),
                })}
              </p>
            ) : null}
            {savedSkipped > 0 ? (
              <p className="text-body-small text-text-secondary">
                {t(`records.import.skip.done.${kind === 'suppliers' ? 'suppliers' : 'deliveries'}`, {
                  count: savedSkipped,
                })}
              </p>
            ) : null}
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
                      ? t('records.import.serverProblems', { count: serverTotal })
                      : t('records.import.problems', { count: problems.length })}
                  </strong>
                  <ul className="max-h-40 list-disc overflow-y-auto pl-lg">
                    {problems.slice(0, 100).map((problem, index) => (
                      <li key={index}>{describe(problem)}</li>
                    ))}
                  </ul>
                </span>
              </Notice>
            ) : preview && skippedTotal > 0 ? (
              <SkippedNotice
                kind={kind}
                preview={preview}
                total={skippedTotal}
                keepDuplicates={keepDuplicates}
                onKeepDuplicates={setKeepDuplicates}
              />
            ) : previews && !preview ? (
              <Notice tone="info">{t('records.import.skip.checking')}</Notice>
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
                        <tr
                          key={line}
                          className={cn(
                            'border-t border-divider',
                            badRows.has(line) && 'bg-error-muted',
                            skippedRows.has(line) && 'text-text-secondary opacity-60',
                          )}
                          title={skippedRows.has(line) ? t('records.import.skip.rowTitle') : undefined}
                        >
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

/**
 * What the preview found already there: how many, which rows, and for leaf the choice to
 * import them anyway. Skipping is the default and needs no click.
 */
function SkippedNotice({
  kind,
  preview,
  total,
  keepDuplicates,
  onKeepDuplicates,
}: {
  kind: ImportKind;
  preview: ImportResult;
  total: number;
  keepDuplicates: boolean;
  onKeepDuplicates: (keep: boolean) => void;
}) {
  const { t } = useTranslation();
  const which = kind === 'suppliers' ? 'suppliers' : 'deliveries';
  const rows = (preview.skipped ?? []).map((one) => one.row);
  return (
    <Notice tone="warning">
      <span className="flex flex-col gap-xs">
        <strong className="font-semibold">
          {keepDuplicates
            ? t('records.import.skip.keeping', { count: total })
            : preview.saved === 0
              ? t(`records.import.skip.nothingNew.${which}`)
              : t(`records.import.skip.found.${which}`, { count: total, saving: preview.saved })}
        </strong>
        <span>
          {t('records.import.skip.rows', {
            rows: rows.slice(0, 40).join(', ') + (total > 40 ? ', …' : ''),
          })}
        </span>
        {kind === 'deliveries' ? (
          <Label className="flex items-start gap-sm text-text-primary">
            <Checkbox
              className="mt-xxs shrink-0"
              checked={keepDuplicates}
              onCheckedChange={(checked) => onKeepDuplicates(checked === true)}
            />
            <span>{t('records.import.skip.keepDuplicates')}</span>
          </Label>
        ) : null}
      </span>
    </Notice>
  );
}

/**
 * Excel stores `79.53` as `79.53000000000002`, which the decimals check would refuse. A
 * value that is a whole number of the column's decimals once floating-point noise is
 * removed is written back that way; a real extra decimal (`24.555`) is left to be refused.
 */
function cleanExcelNumbers(kind: ImportKind, row: ImportRow): ImportRow {
  const out = { ...row };
  for (const column of IMPORT_COLUMNS[kind]) {
    if (column.type !== 'number') continue;
    const raw = (out[column.key] ?? '').trim();
    if (!/^-?\d+\.\d{6,}$/.test(raw)) continue;
    const value = Number(raw);
    const rounded = Number(value.toFixed(column.decimals ?? 2));
    if (Math.abs(rounded - value) < 1e-6) out[column.key] = String(rounded);
  }
  return out;
}

