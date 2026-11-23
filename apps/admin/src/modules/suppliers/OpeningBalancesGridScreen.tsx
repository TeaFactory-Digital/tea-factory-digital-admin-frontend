/**
 * Opening balances for many suppliers on one sheet (22 November 2026), for the week a
 * factory starts on the console: type a code, the figures across, Enter, the next supplier.
 * A block copied from Excel can be pasted into any code box.
 *
 * Saved through the same import as the opening balances file, so it is checked the same way
 * and is all or nothing: a code that does not exist, a supplier whose bill is already out, or
 * the same code twice, and nothing is saved; the line says why and stays to be fixed.
 */

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CornerDownLeft, Plus, Trash2 } from 'lucide-react';
import type { ImportRow, ImportRowProblem } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input } from '@/components/ui/Field';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { Notice } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { errorMessageKey } from '@/lib/errorMessage';
import { useDebounced } from '@/lib/useDebounced';
import { pickMatch } from '@/modules/deliveries/pickMatch';
import { useImportRows } from '@/modules/records/hooks';
import { useSuppliers } from './hooks';
import { GRID_COLUMNS, lastMonthKey, newLine, parseGridPaste, type Line } from './openingGrid';
import { InfoTip } from '@/components/ui/Tooltip';

export function OpeningBalancesGridScreen() {
  const { t } = useTranslation();
  const toast = useToast();
  const save = useImportRows('openingBalances');
  const [month, setMonth] = useState(lastMonthKey());
  const [lines, setLines] = useState<Line[]>(() => [newLine()]);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const sheet = useRef<HTMLTableSectionElement>(null);

  const filled = lines.filter((line) => line.code.trim() !== '');
  const monthOk = /^\d{4}-(0[1-9]|1[0-2])$/.test(month);

  function update(key: string, change: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change, problems: undefined } : line)));
  }

  function addLine(after?: string) {
    const line = newLine();
    setLines((current) => {
      const at = after ? current.findIndex((one) => one.key === after) + 1 : current.length;
      return [...current.slice(0, at), line, ...current.slice(at)];
    });
    setFocusKey(line.key);
  }

  /** Enter moves right; on the last box it opens the next line. Ctrl+Enter saves the sheet. */
  function onCellKey(event: KeyboardEvent<HTMLInputElement>, line: Line, isLast: boolean) {
    if (event.key !== 'Enter' || event.altKey || event.shiftKey) return;
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      void submit();
      return;
    }
    const boxes = Array.from(sheet.current?.querySelectorAll<HTMLInputElement>('input:not([disabled])') ?? []);
    const next = boxes[boxes.indexOf(event.currentTarget) + 1];
    if (isLast && lines[lines.length - 1]?.key === line.key) addLine(line.key);
    else next?.focus();
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>, line: Line) {
    const text = event.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    const pasted = parseGridPaste(text);
    if (pasted.length === 0) return;
    setLines((current) => {
      const at = current.findIndex((one) => one.key === line.key);
      // The empty line pasted into is replaced; a filled one keeps its place above.
      const keep = current[at]?.code.trim() ? at + 1 : at;
      return [...current.slice(0, keep), ...pasted, ...current.slice(at + 1)];
    });
    toast.success(t('records.openingGrid.pasted', { count: pasted.length }));
  }

  async function submit() {
    if (!monthOk || filled.length === 0 || save.isPending) return;
    const rows: ImportRow[] = filled.map((line) => ({
      supplierCode: line.code.trim(),
      asOfMonth: month,
      ...Object.fromEntries(GRID_COLUMNS.map((column) => [column, line.values[column].trim()])),
    }));
    try {
      const result = await save.mutateAsync({ fileName: t('records.openingGrid.fileName'), rows });
      if (result.problems.length > 0) {
        // Row numbers count the header as row 1, as the import does for a file.
        const byRow = new Map<number, ImportRowProblem[]>();
        for (const problem of result.problems) byRow.set(problem.row, [...(byRow.get(problem.row) ?? []), problem]);
        const keys = new Map(filled.map((line, index) => [line.key, index + 2]));
        setLines((current) =>
          current.map((line) => {
            const found = byRow.get(keys.get(line.key) ?? -1);
            return found ? { ...line, problems: found.map(describe) } : line;
          }),
        );
        toast.error(t('records.openingGrid.notSaved'), t('records.openingGrid.fixLines', { count: byRow.size }));
        return;
      }
      toast.success(t('records.openingGrid.saved', { count: result.saved }));
      setLines([newLine()]);
    } catch (error) {
      toast.error(t('records.openingGrid.notSaved'), t(errorMessageKey(error)));
    }
  }

  function describe(problem: ImportRowProblem): string {
    const column = problem.column && problem.column !== 'supplierCode' ? `${columnLabel(problem.column)}: ` : '';
    return column + t(`records.import.problem.${problem.code}`, {
      defaultValue: t('records.import.problem.other', { code: problem.code }),
    });
  }

  function columnLabel(column: string): string {
    if (column === 'loanMonthsLeft') return t('records.opening.loanMonthsLeft');
    if (column === 'loanInstalmentsPaid') return t('records.opening.loanInstalmentsPaid');
    if (column === 'asOfMonth') return t('records.opening.asOfMonth');
    return t(`records.opening.field.${column}`, { defaultValue: column });
  }

  return (
    <div className="flex flex-col gap-lg">
      <PageHeader
        title={t('records.openingGrid.title')}
        description={t('records.openingGrid.body')}
        breadcrumb={
          <Link to="/suppliers" className="hover:text-text-primary">
            {t('suppliers.title')}
          </Link>
        }
        actions={
          <Button
            variant="primary"
            iconLeft={<CornerDownLeft className="size-icon-sm" aria-hidden />}
            disabled={!monthOk || filled.length === 0}
            loading={save.isPending}
            onClick={() => void submit()}
          >
            {t('records.openingGrid.save', { count: filled.length })}
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-md">
          <div className="flex flex-wrap items-end gap-md">
            <Field label={t('records.opening.asOfMonth')} required hint={t('records.opening.asOfMonthHint')}>
              {({ id, describedBy }) => (
                <Input id={id} aria-describedby={describedBy} type="month" fullWidth={false} value={month} onChange={(event) => setMonth(event.target.value)} />
              )}
            </Field>
            <InfoTip label={t('tip.howToEnter')} text={t('tip.howToEnter')}>
              {t('records.openingGrid.keys')}
            </InfoTip>
          </div>

          <div className="relative overflow-x-auto">
            <table className="w-full min-w-max border-collapse text-body-small">
              <thead>
                <tr className="border-b border-divider text-left text-overline text-text-secondary uppercase">
                  <th className="px-xs py-xs">{t('records.openingGrid.code')}</th>
                  <th className="px-xs py-xs">{t('records.openingGrid.name')}</th>
                  {GRID_COLUMNS.map((column) => (
                    <th key={column} className="px-xs py-xs text-right">
                      {columnLabel(column)}
                    </th>
                  ))}
                  <th className="px-xs py-xs">
                    <span className="sr-only">{t('records.openingGrid.remove')}</span>
                  </th>
                </tr>
              </thead>
              <tbody ref={sheet}>
                {lines.map((line, index) => (
                  <GridLine
                    key={line.key}
                    line={line}
                    number={index + 1}
                    autoFocus={focusKey === line.key}
                    onChange={(change) => update(line.key, change)}
                    onRemove={() => setLines((current) => (current.length > 1 ? current.filter((one) => one.key !== line.key) : [newLine()]))}
                    onCellKey={onCellKey}
                    onPaste={onPaste}
                    columnLabel={columnLabel}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-sm">
            <Button size="sm" variant="secondary" iconLeft={<Plus className="size-icon-sm" aria-hidden />} onClick={() => addLine()}>
              {t('records.openingGrid.addLine')}
            </Button>
            <span className="text-caption text-text-secondary">{t('records.openingGrid.count', { count: filled.length })}</span>
          </div>
          {lines.some((line) => line.problems) ? <Notice tone="error">{t('records.openingGrid.allOrNothing')}</Notice> : null}
        </CardBody>
      </Card>
    </div>
  );
}

function GridLine({
  line,
  number,
  autoFocus,
  onChange,
  onRemove,
  onCellKey,
  onPaste,
  columnLabel,
}: {
  line: Line;
  number: number;
  autoFocus: boolean;
  onChange: (change: Partial<Line>) => void;
  onRemove: () => void;
  onCellKey: (event: KeyboardEvent<HTMLInputElement>, line: Line, isLast: boolean) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>, line: Line) => void;
  columnLabel: (column: string) => string;
}) {
  const { t } = useTranslation();
  const code = useDebounced(line.code.trim(), 250);
  const { data, isFetching } = useSuppliers({ q: code || undefined, page: 0, pageSize: 5 }, { enabled: code.length >= 2 });
  const match = code.length >= 2 && code === line.code.trim() ? pickMatch(data?.items ?? [], code) : null;
  const loanRunning = Number(line.values.loan) > 0;

  return (
    <>
      <tr className={cn('border-b border-divider align-top', line.problems && 'bg-error-muted')}>
        <td className="px-xs py-xxs">
          <Input
            aria-label={t('records.openingGrid.codeFor', { number })}
            className="w-28"
            autoFocus={autoFocus}
            value={line.code}
            onChange={(event) => onChange({ code: event.target.value })}
            onKeyDown={(event) => onCellKey(event, line, false)}
            onPaste={(event) => onPaste(event, line)}
          />
        </td>
        <td className="min-w-40 px-xs py-sm text-text-secondary">
          {match ? (
            <span className="text-text-primary">{match.name}</span>
          ) : code.length >= 2 && !isFetching && code === line.code.trim() ? (
            <span className="text-warning">{t('records.openingGrid.noMatch')}</span>
          ) : null}
        </td>
        {GRID_COLUMNS.map((column, index) => {
          const loanOnly = column === 'loanMonthsLeft' || column === 'loanInstalmentsPaid';
          return (
            <td key={column} className="px-xs py-xxs">
              <MoneyInput
                aria-label={`${columnLabel(column)}, ${t('records.openingGrid.line', { number })}`}
                className="w-28 text-right"
                enterToNext={false}
                disabled={loanOnly && !loanRunning}
                placeholder={loanOnly ? '' : '0'}
                value={line.values[column]}
                onValueChange={(plain) => onChange({ values: { ...line.values, [column]: loanOnly ? plain.replace('.', '') : plain } })}
                onKeyDown={(event) => onCellKey(event, line, index === GRID_COLUMNS.length - 1 || (!loanRunning && column === 'previousDebt'))}
              />
            </td>
          );
        })}
        <td className="px-xs py-xxs">
          <Button size="sm" variant="ghost" aria-label={t('records.openingGrid.removeLine', { number })} onClick={onRemove}>
            <Trash2 className="size-icon-sm" aria-hidden />
          </Button>
        </td>
      </tr>
      {line.problems ? (
        <tr className="bg-error-muted">
          <td colSpan={GRID_COLUMNS.length + 3} className="px-xs pb-xs text-caption text-error">
            {line.problems.join('; ')}
          </td>
        </tr>
      ) : null}
    </>
  );
}
