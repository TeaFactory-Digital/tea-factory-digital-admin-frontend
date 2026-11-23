/**
 * The weighing sheet: M3's reason to exist, rebuilt (21 November 2026) for many suppliers at
 * many collection points in as few keystrokes as possible.
 *
 *  - **Supplier, Tab, kilos, Enter.** The caret is back in the supplier field after every
 *    line; the mouse is not on the path. Enter in the supplier field moves to the kilos.
 *  - **The point fills itself in.** Each line takes the supplier's registered collection
 *    point (else the point the screen is filtered on, else the last one used), and can be
 *    changed on the line, before or after it is added. One sheet holds several points; the
 *    commit sends one batch per point, because the API files a batch against one point.
 *  - **A line is fixed where it is.** Point and kilos stay editable in the table, so a wrong
 *    figure is corrected, not removed and re-typed.
 *  - **Paste from Excel.** Lines of `number, kilos[, point]` pasted into the supplier field
 *    are matched and added at once; lines that cannot be are listed, not dropped silently.
 *  - **The code is matched, not guessed.** `5708` and `5708 (MAKADURA)` both match; a prefix
 *    only when it is the only hit, so `5` never silently picks `5007`.
 *  - **A big number is questioned, never refused** (`isOutlierKg`): a second Enter accepts it.
 *  - **Nothing is sent until the sheet is recorded** (the button, or Ctrl+Enter). Each
 *    point's batch keeps its id until it is accepted, so a retry replays rather than
 *    recording twice (§1.3). A refused line stays, with the server's reason on it.
 */

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ClipboardPaste, CornerDownLeft, Trash2, TriangleAlert } from 'lucide-react';
import {
  MAX_DELIVERY_BATCH_ROWS,
  MAX_DELIVERY_KG,
  isExactKg,
  isOutlierKg,
  PLAUSIBLE_WEIGHING_MAX_KG,
  roundKg,
  summariseKgs,
  type DeliveryRejection,
  type SupplierListItem,
} from '@tfd/domain';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/useDebounced';
import { cn } from '@/lib/cn';
import { formatKg } from '@/lib/format';
import { errorMessageKey } from '@/lib/errorMessage';
import { useSuppliers } from '@/modules/suppliers/hooks';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { useCommitBatch } from './hooks';
import { pickMatch } from './pickMatch';

/** A line on the sheet, before it is anything the factory has recorded. */
interface DraftRow {
  /** Local only: React keys and removal. The server never sees it. */
  key: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  point: string;
  /** As typed, so a line can be corrected in place; checked again on record. */
  kgText: string;
  /** The server's reason this line was refused, once a record has come back. */
  rejection?: DeliveryRejection;
}

export interface EntrySessionProps {
  date: string;
  /** The point the screen is filtered on: a line's point when its supplier has none. */
  defaultPoint?: string;
  onCommitted?: () => void;
}

let keySeq = 0;
const nextKey = () => `line-${(keySeq += 1)}`;

/** Why a kilo figure cannot be recorded, as an i18n key; `null` when it can. */
function kgProblem(text: string): string | null {
  const value = Number(text);
  const kgs = roundKg(value);
  if (!text.trim() || !Number.isFinite(kgs) || kgs <= 0 || kgs > MAX_DELIVERY_KG) return 'deliveries.error.kgRange';
  // Refused rather than rounded: a weight stored as something else will not match the slip.
  if (!isExactKg(value)) return 'deliveries.error.kgPrecision';
  return null;
}

export function EntrySession({ date, defaultPoint, onCommitted }: EntrySessionProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useRuntimeConfig();
  const commit = useCommitBatch();
  const configured = config.collectionPoints;

  /**
   * The factory's name for a supplier's point: matched by id, then by name in any case
   * (a registry row may say `DENIYAYA` where Configuration says `Deniyaya`). A point the
   * configuration does not list is kept as the supplier has it.
   */
  function pointOf(supplier: SupplierListItem): string | undefined {
    const own = supplier.collectionPoint;
    if (!own) return undefined;
    return (
      configured.find((one) => one.id === own.id)?.name ??
      configured.find((one) => one.name.toLowerCase() === own.name.toLowerCase())?.name ??
      own.name
    );
  }

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [code, setCode] = useState('');
  const [kgText, setKgText] = useState('');
  const [point, setPoint] = useState(defaultPoint || configured[0]?.name || '');
  // Every point a line may be filed against: the configured ones, and any a supplier brought.
  const points = useMemo(
    () => [...new Set([...configured.map((one) => one.name), point, ...rows.map((row) => row.point)].filter(Boolean))],
    [configured, point, rows],
  );
  /** The clerk chose the point by hand for this line: a supplier match must not undo it. */
  const [pointTouched, setPointTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingOutlier, setConfirmingOutlier] = useState(false);
  const [pasteReport, setPasteReport] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);
  const kgRef = useRef<HTMLInputElement>(null);
  /** One idempotency key per point, kept until that point's batch is accepted. */
  const batchIds = useRef(new Map<string, string>());

  const debouncedCode = useDebounced(code.trim(), 200);
  const { data: matches, isFetching: matching } = useSuppliers(
    { q: debouncedCode || undefined, status: 'active', page: 0, pageSize: 5 },
    { enabled: debouncedCode.length >= 2 },
  );
  const candidates = debouncedCode.length >= 2 ? (matches?.items ?? []) : [];
  const match = debouncedCode === code.trim() ? pickMatch(candidates, debouncedCode) : null;

  // A matched supplier brings their own point, unless the clerk has chosen one by hand.
  const matchPoint = match ? pointOf(match) : undefined;
  useEffect(() => {
    if (matchPoint && !pointTouched) setPoint(matchPoint);
  }, [match?.id, matchPoint, pointTouched]);

  const totals = useMemo(
    () =>
      summariseKgs(
        rows
          .filter((row) => kgProblem(row.kgText) === null)
          .map((row) => ({ supplierId: row.supplierId, kgs: roundKg(Number(row.kgText)) })),
      ),
    [rows],
  );
  const byPoint = useMemo(() => {
    const sums = new Map<string, number>();
    for (const row of rows) {
      if (kgProblem(row.kgText) === null) sums.set(row.point, roundKg((sums.get(row.point) ?? 0) + Number(row.kgText)));
    }
    return [...sums.entries()];
  }, [rows]);
  const invalidLines = rows.filter((row) => kgProblem(row.kgText) !== null || !row.point).length;

  function resetEntry() {
    setCode('');
    setKgText('');
    setError(null);
    setConfirmingOutlier(false);
    setPointTouched(false);
    codeRef.current?.focus();
  }

  function addRow() {
    if (rows.length >= MAX_DELIVERY_BATCH_ROWS) {
      setError(t('deliveries.error.sessionFull', { limit: MAX_DELIVERY_BATCH_ROWS }));
      return;
    }
    if (!match) {
      setError(matching || debouncedCode !== code.trim() ? t('deliveries.error.stillMatching') : t('deliveries.error.unknownSupplier'));
      codeRef.current?.focus();
      return;
    }
    if (!point) {
      setError(t('deliveries.error.noPoint'));
      return;
    }
    const problem = kgProblem(kgText);
    if (problem) {
      setError(t(problem, { max: MAX_DELIVERY_KG }));
      kgRef.current?.focus();
      return;
    }
    if (isOutlierKg(roundKg(Number(kgText))) && !confirmingOutlier) {
      setConfirmingOutlier(true);
      setError(null);
      return;
    }
    setRows((current) => [
      ...current,
      { key: nextKey(), supplierId: match.id, supplierCode: match.supplierCode, supplierName: match.name, point, kgText },
    ]);
    resetEntry();
  }

  function onCodeKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    // Enter in the supplier field goes to the kilos; with kilos already typed it adds.
    if (kgText.trim()) addRow();
    else if (match) kgRef.current?.focus();
    else addRow();
  }

  function onKgKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    addRow();
  }

  /** Ctrl+Enter (Cmd+Enter on a Mac) anywhere on the sheet records it. */
  function onSheetKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && rows.length > 0 && !commit.isPending) {
      event.preventDefault();
      void submit();
    }
  }

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch, rejection: undefined } : row)));
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
    codeRef.current?.focus();
  }

  /**
   * Lines pasted from a spreadsheet: `number, kilos[, point]`, split by tab, comma or
   * spaces. Each number is matched as a typed one is; a line that cannot be is reported.
   */
  async function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData('text');
    if (!/[\n\t]/.test(text.trim())) return;
    event.preventDefault();
    setPasting(true);
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const added: DraftRow[] = [];
    const problems: string[] = [];
    for (const [index, line] of lines.entries()) {
      const [rawCode = '', rawKgs = '', ...rest] = line.split(/\t|,|\s{2,}/).map((cell) => cell.trim());
      const rawPoint = rest.join(' ').trim();
      // A header row ("Supplier", "Kilos") is skipped quietly.
      if (index === 0 && !/\d/.test(rawCode)) continue;
      const lineNo = index + 1;
      if (kgProblem(rawKgs)) {
        problems.push(t('deliveries.pasteLine', { line: lineNo, reason: t('deliveries.pasteBadKgs') }));
        continue;
      }
      const found = await supplierRepository
        .list({ q: rawCode, status: 'active', page: 0, pageSize: 5 })
        .then((page) => pickMatch(page.items, rawCode))
        .catch(() => null);
      if (!found) {
        problems.push(t('deliveries.pasteLine', { line: lineNo, reason: t('deliveries.pasteNoSupplier', { code: rawCode }) }));
        continue;
      }
      // A named point is taken in the factory's spelling; one it does not know is sent as
      // typed, and the server refuses that line with its reason rather than refiling it.
      const named = rawPoint
        ? (configured.find((one) => one.name.toLowerCase() === rawPoint.toLowerCase())?.name ?? rawPoint)
        : undefined;
      added.push({
        key: nextKey(),
        supplierId: found.id,
        supplierCode: found.supplierCode,
        supplierName: found.name,
        point: named ?? pointOf(found) ?? (point || configured[0]?.name || ''),
        kgText: rawKgs,
      });
    }
    setRows((current) => [...current, ...added].slice(0, MAX_DELIVERY_BATCH_ROWS));
    setPasting(false);
    setPasteReport(
      [
        added.length > 0 ? t('deliveries.pasteAdded', { count: added.length }) : null,
        problems.length > 0 ? t('deliveries.pasteProblems', { count: problems.length, lines: problems.join('; ') }) : null,
      ]
        .filter(Boolean)
        .join(' '),
    );
    resetEntry();
  }

  async function submit() {
    if (invalidLines > 0) {
      toast.error(t('deliveries.commitFailed'), t('deliveries.fixLinesFirst', { count: invalidLines }));
      return;
    }
    // One batch per point, in the order the points first appear on the sheet.
    const groups = new Map<string, DraftRow[]>();
    for (const row of rows) groups.set(row.point, [...(groups.get(row.point) ?? []), row]);

    let accepted = 0;
    let lastTotal: number | null = null;
    const refused = new Map<string, DeliveryRejection>();
    const done = new Set<string>();
    for (const [groupPoint, groupRows] of groups) {
      const batchId = batchIds.current.get(groupPoint) ?? crypto.randomUUID();
      batchIds.current.set(groupPoint, batchId);
      const result = await commit
        .mutateAsync({
          date,
          collectionPoint: groupPoint,
          batchId,
          rows: groupRows.map((row) => ({ supplierId: row.supplierId, kgs: roundKg(Number(row.kgText)) })),
        })
        .catch((cause: unknown) => {
          toast.error(t('deliveries.commitFailed'), t(errorMessageKey(cause)));
          return null;
        });
      // A failed request stops here: the lines stay, with the same batch id for a retry.
      if (!result) break;
      batchIds.current.delete(groupPoint);
      accepted += result.accepted.length;
      lastTotal = result.day.totalKgs;
      groupRows.forEach((row, index) => {
        const rejection = result.rejected.find((one) => one.index === index);
        if (rejection) refused.set(row.key, rejection);
        else done.add(row.key);
      });
    }

    if (done.size === 0 && refused.size === 0) return;
    setRows((current) =>
      current.filter((row) => !done.has(row.key)).map((row) => ({ ...row, rejection: refused.get(row.key) ?? row.rejection })),
    );
    onCommitted?.();
    if (refused.size === 0 && done.size === rows.length) {
      toast.success(
        t('deliveries.committed', { count: accepted }),
        lastTotal !== null ? t('deliveries.committedTotal', { kgs: formatKg(lastTotal) }) : undefined,
      );
      setPasteReport(null);
    } else if (refused.size > 0) {
      toast.show({
        tone: 'info',
        title: t('deliveries.committedPartly', { accepted, rejected: refused.size }),
        body: t('deliveries.committedPartlyHint'),
      });
    }
    codeRef.current?.focus();
  }

  return (
    <div className="flex flex-col gap-sm p-md" onKeyDown={onSheetKeyDown}>
      {/* One compact line: supplier, kilos, point. Enter adds it. */}
      <div className="flex flex-wrap items-start gap-sm">
        <Field
          label={t('deliveries.supplierCode')}
          className="w-64"
          error={error && !match ? error : undefined}
          hint={
            match ? (
              <span className="flex items-center gap-xxs text-success">
                <Check className="size-icon-xs" aria-hidden />
                {match.name}
              </span>
            ) : (
              t('deliveries.supplierCodeHint')
            )
          }
        >
          {({ id, describedBy, invalid }) => (
            <Input
              ref={codeRef}
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              autoFocus
              autoComplete="off"
              value={code}
              disabled={pasting}
              onChange={(event) => {
                setCode(event.target.value);
                setError(null);
              }}
              onKeyDown={onCodeKeyDown}
              onPaste={(event) => void onPaste(event)}
              placeholder={t('deliveries.supplierCodePlaceholder')}
            />
          )}
        </Field>

        <Field label={t('deliveries.kgs')} className="w-36" error={error && match ? error : undefined}>
          {({ id, describedBy, invalid }) => (
            <Input
              ref={kgRef}
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="off"
              inputMode="decimal"
              className="numeric text-right"
              value={kgText}
              onChange={(event) => {
                setKgText(event.target.value);
                setError(null);
                setConfirmingOutlier(false);
              }}
              onKeyDown={onKgKeyDown}
              placeholder="0.00"
            />
          )}
        </Field>

        <Field label={t('deliveries.point')} className="w-52" hint={t('deliveries.pointHint')}>
          {({ id, describedBy }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              value={point}
              onChange={(event) => {
                setPoint(event.target.value);
                setPointTouched(true);
              }}
            >
              {points.map((one) => (
                <option key={one} value={one}>
                  {one}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="flex flex-col gap-xs">
          {/* Aligns the button with the inputs, under a label-height gap. */}
          <span aria-hidden className="text-label opacity-0">.</span>
          <Button variant="secondary" onClick={addRow} iconLeft={<CornerDownLeft className="size-icon-sm" aria-hidden />}>
            {t('deliveries.addRow')}
          </Button>
        </div>
      </div>

      <p className="flex items-center gap-xs text-caption text-text-secondary">
        <ClipboardPaste className="size-icon-xs shrink-0" aria-hidden />
        {t('deliveries.entryHint')}
      </p>

      {confirmingOutlier ? (
        <p role="alert" className="flex items-start gap-xs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
          <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          {t('deliveries.outlierConfirm', {
            kgs: formatKg(roundKg(Number(kgText))),
            limit: formatKg(PLAUSIBLE_WEIGHING_MAX_KG),
          })}
        </p>
      ) : null}

      {pasteReport ? (
        <p role="status" className="rounded-md bg-surface-variant px-md py-sm text-body-small text-text-primary">
          {pasteReport}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <section aria-label={t('deliveries.pendingTitle', { count: rows.length })} className="flex flex-col gap-sm rounded-md border border-warning/40 bg-surface">
          <h3 className="flex items-center gap-xs border-b border-divider px-md py-sm text-label text-warning">
            <TriangleAlert className="size-icon-sm" aria-hidden />
            {t('deliveries.pendingTitle', { count: rows.length })}
          </h3>
          <div className="relative max-h-80 overflow-auto">
            <table className="w-full border-collapse text-data-cell">
              <caption className="sr-only">{t('deliveries.sessionTable')}</caption>
              <thead className="sticky top-0 bg-table-header">
                <tr>
                  <th scope="col" className="w-12 px-md py-xs text-left text-data-header uppercase text-text-secondary">#</th>
                  <th scope="col" className="px-md py-xs text-left text-data-header uppercase text-text-secondary">{t('deliveries.column.supplier')}</th>
                  <th scope="col" className="w-52 px-md py-xs text-left text-data-header uppercase text-text-secondary">{t('deliveries.column.point')}</th>
                  <th scope="col" className="w-36 px-md py-xs text-right text-data-header uppercase text-text-secondary">{t('deliveries.column.kgs')}</th>
                  <th scope="col" className="w-12 px-md py-xs"><span className="sr-only">{t('common.actions')}</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const bad = kgProblem(row.kgText);
                  return (
                    <tr key={row.key} className={cn('border-b border-divider', row.rejection ? 'bg-error-muted' : index % 2 === 1 && 'bg-table-row-alt')}>
                      <td className="numeric px-md py-xs text-text-secondary">{index + 1}</td>
                      <td className="px-md py-xs">
                        <span className="flex flex-col">
                          <span className="numeric font-semibold text-text-primary">{row.supplierCode}</span>
                          <span className="text-caption text-text-secondary">{row.supplierName}</span>
                          {row.rejection ? <span className="text-caption text-error">{row.rejection.message}</span> : null}
                        </span>
                      </td>
                      <td className="px-md py-xs">
                        <Select
                          aria-label={t('deliveries.pointForLine', { line: index + 1 })}
                          value={row.point}
                          onChange={(event) => updateRow(row.key, { point: event.target.value })}
                        >
                          {points.map((one) => (
                            <option key={one} value={one}>
                              {one}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-md py-xs">
                        <Input
                          aria-label={t('deliveries.kgsForLine', { line: index + 1 })}
                          invalid={bad !== null}
                          inputMode="decimal"
                          className="numeric text-right"
                          value={row.kgText}
                          onChange={(event) => updateRow(row.key, { kgText: event.target.value })}
                        />
                      </td>
                      <td className="px-md py-xs text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={t('deliveries.removeLine', { line: index + 1 })}
                          title={t('deliveries.removeRow')}
                          onClick={() => removeRow(row.key)}
                          iconLeft={<Trash2 className="size-icon-sm" aria-hidden />}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* The totals and the one button together, so the figure checked is next to the
              button that records it. */}
          <div className="flex flex-wrap items-center justify-between gap-md border-t border-divider px-md py-sm">
            <dl className="flex flex-wrap items-baseline gap-lg text-body-small">
              <div className="flex items-baseline gap-xs">
                <dt className="text-text-secondary">{t('deliveries.totalKgs')}</dt>
                <dd className="numeric text-subtitle font-semibold text-text-primary">{formatKg(totals.totalKgs)}</dd>
              </div>
              <div className="flex items-baseline gap-xs">
                <dt className="text-text-secondary">{t('deliveries.supplierCount')}</dt>
                <dd className="numeric text-text-primary">{totals.supplierCount}</dd>
              </div>
              {byPoint.length > 1
                ? byPoint.map(([name, kgs]) => (
                    <div key={name} className="flex items-baseline gap-xs">
                      <dt className="text-text-secondary">{name}</dt>
                      <dd className="numeric text-text-primary">{formatKg(kgs)}</dd>
                    </div>
                  ))
                : null}
            </dl>
            <div className="flex items-center gap-sm">
              <span className="text-caption text-text-secondary">{t('deliveries.commitShortcut')}</span>
              <Button variant="primary" onClick={() => void submit()} loading={commit.isPending}>
                {t('deliveries.commit', { count: rows.length })}
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <p className="py-sm text-body-small text-text-secondary">{t('deliveries.sessionEmpty')}</p>
      )}
    </div>
  );
}

