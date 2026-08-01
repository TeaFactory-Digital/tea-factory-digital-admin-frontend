/**
 * The weighing session — M3's reason to exist.
 *
 * modules.md: *"a data-entry product, not a screen"*. Everything here follows from
 * that, and it is worth stating what it means concretely, because a grid that
 * merely looks like this one is much slower to use:
 *
 *  - **Two fields and the Enter key.** Code → Tab → kilos → Enter, and the caret
 *    is back in the code field. A clerk with a queue at the counter never leaves
 *    the keyboard, and the mouse is not on the path at all.
 *  - **The code is matched, not validated later.** A supplier code is typed as
 *    `5708` or `5708 (MAKADURA)` depending on which the clerk remembers, and the
 *    match tolerates both. The name appears as confirmation *before* the row is
 *    added, because "did I type the right grower" is the question the office asks.
 *  - **A big number is questioned, never refused** (`isOutlierKg`). `1250` typed
 *    for `125.0` is invisible in a column of figures and very visible in next
 *    month's bill — but a genuinely heavy load must still be enterable, so the
 *    grid asks for a second Enter instead of rejecting the figure.
 *  - **Nothing is sent until the session is committed**, and then all of it goes
 *    in one request. The rows live here until then, which is also what makes undo
 *    a local operation rather than a void.
 *  - **A refused row comes back to be fixed, not re-typed.** Partial acceptance
 *    means the good rows are recorded and the rejections stay in the grid with the
 *    server's reason on the line.
 */

import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Plus, Trash2, TriangleAlert } from 'lucide-react';
import {
  MAX_DELIVERY_BATCH_ROWS,
  MAX_DELIVERY_KG,
  isExactKg,
  isOutlierKg,
  roundKg,
  summariseKgs,
  type DeliveryRejection,
  type SupplierListItem,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/useDebounced';
import { formatKg } from '@/lib/format';
import { errorMessageKey } from '@/lib/errorMessage';
import { useSuppliers } from '@/modules/suppliers/hooks';
import { useCommitBatch } from './hooks';

/** A line in the session, before it is anything the factory has recorded. */
interface DraftRow {
  /** Local only — React keys and removal. The server never sees it. */
  key: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  kgs: number;
  /** The server's reason this line was refused, once a commit has come back. */
  rejection?: DeliveryRejection;
}

export interface EntrySessionProps {
  date: string;
  collectionPoint: string;
  /** Sessions are numbered per point per day; the id travels as the idempotency key. */
  onCommitted?: () => void;
}

export function EntrySession({ date, collectionPoint, onCommitted }: EntrySessionProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const commit = useCommitBatch();

  const [rows, setRows] = useState<DraftRow[]>([]);
  const [code, setCode] = useState('');
  const [kgText, setKgText] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Set when a figure looks wrong: the next Enter accepts it as typed. */
  const [confirmingOutlier, setConfirmingOutlier] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);

  /**
   * A fresh id per session, generated when the session starts rather than at
   * commit time. That is what makes a re-sent commit idempotent: the retry
   * carries the *same* id, so the server replays the original result instead of
   * recording the session twice (§1.3).
   */
  const [batchId, setBatchId] = useState(() => crypto.randomUUID());

  /**
   * The code lookup goes through the same search the registry uses, which is what
   * makes `5708` and `5708 (MAKADURA)` both match — the server tolerates the
   * division suffix, and re-implementing that here would be a second answer.
   */
  const debouncedCode = useDebounced(code.trim(), 200);
  const { data: matches, isFetching: matching } = useSuppliers(
    { q: debouncedCode || undefined, status: 'active', page: 0, pageSize: 5 },
    { enabled: debouncedCode.length >= 2 },
  );

  const candidates = debouncedCode.length >= 2 ? (matches?.items ?? []) : [];
  const match = pickMatch(candidates, debouncedCode);

  const totals = useMemo(
    () => summariseKgs(rows.map((row) => ({ supplierId: row.supplierId, kgs: row.kgs }))),
    [rows],
  );

  function reset() {
    setCode('');
    setKgText('');
    setError(null);
    setConfirmingOutlier(false);
    codeRef.current?.focus();
  }

  function addRow(event?: FormEvent) {
    event?.preventDefault();

    if (rows.length >= MAX_DELIVERY_BATCH_ROWS) {
      setError(t('deliveries.error.sessionFull', { limit: MAX_DELIVERY_BATCH_ROWS }));
      return;
    }
    if (!match) {
      setError(
        matching ? t('deliveries.error.stillMatching') : t('deliveries.error.unknownSupplier'),
      );
      return;
    }

    const kgs = roundKg(Number(kgText));
    if (!kgText.trim() || !Number.isFinite(kgs) || kgs <= 0 || kgs > MAX_DELIVERY_KG) {
      setError(t('deliveries.error.kgRange', { max: MAX_DELIVERY_KG }));
      return;
    }
    // Refused rather than rounded: a weight the database would store as something
    // else is a figure that will not match the slip handed over at the counter.
    if (!isExactKg(Number(kgText))) {
      setError(t('deliveries.error.kgPrecision'));
      return;
    }

    // The mean is the session's own, so the first few rows set the scale the rest
    // are judged against — which is what makes it useful at one collection point
    // on one day rather than against a factory-wide average.
    if (isOutlierKg(kgs, totals.meanKgs) && !confirmingOutlier) {
      setConfirmingOutlier(true);
      setError(null);
      return;
    }

    setRows((current) => [
      ...current,
      {
        key: `${match.id}-${current.length}-${kgs}`,
        supplierId: match.id,
        supplierCode: match.supplierCode,
        supplierName: match.name,
        kgs,
      },
    ]);
    reset();
  }

  /** Enter in either field commits the line — the kilos field is not a submit trap. */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addRow();
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
    codeRef.current?.focus();
  }

  async function submit() {
    const result = await commit
      .mutateAsync({
        date,
        collectionPoint,
        batchId,
        rows: rows.map((row) => ({ supplierId: row.supplierId, kgs: row.kgs })),
      })
      .catch((cause: unknown) => {
        toast.error(t('deliveries.commitFailed'), t(errorMessageKey(cause)));
        return null;
      });

    if (!result) return;

    if (result.rejected.length === 0) {
      toast.success(
        t('deliveries.committed', { count: result.accepted.length }),
        t('deliveries.committedTotal', { kgs: formatKg(result.day.totalKgs) }),
      );
      setRows([]);
      // A new id for the next session: the committed one is now the server's
      // record of *that* batch, and reusing it would replay this result.
      setBatchId(crypto.randomUUID());
      onCommitted?.();
      reset();
      return;
    }

    /**
     * Partial acceptance. The refused lines stay, carrying the server's reason,
     * and the accepted ones go — so the grid holds exactly the work that is left.
     */
    const refusedIndexes = new Set(result.rejected.map((r) => r.index));
    setRows((current) =>
      current
        .map((row, index) => ({ ...row, rejection: result.rejected.find((r) => r.index === index) }))
        .filter((_, index) => refusedIndexes.has(index)),
    );
    setBatchId(crypto.randomUUID());
    onCommitted?.();
    toast.show({
      tone: 'info',
      title: t('deliveries.committedPartly', {
        accepted: result.accepted.length,
        rejected: result.rejected.length,
      }),
      body: t('deliveries.committedPartlyHint'),
    });
  }

  return (
    <div className="flex flex-col gap-md p-md">
      <form onSubmit={addRow} className="flex flex-wrap items-end gap-sm">
        <Field
          label={t('deliveries.supplierCode')}
          className="min-w-56 flex-1"
          error={error && !match ? error : undefined}
          hint={
            match ? (
              <span className="flex items-center gap-xxs text-success">
                <Check className="size-icon-xs" aria-hidden />
                {match.supplierCode} · {match.name}
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
              inputMode="numeric"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder={t('deliveries.supplierCodePlaceholder')}
            />
          )}
        </Field>

        <Field
          label={t('deliveries.kgs')}
          className="w-40"
          error={error && match ? error : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              autoComplete="off"
              inputMode="decimal"
              className="numeric"
              value={kgText}
              onChange={(event) => {
                setKgText(event.target.value);
                setError(null);
                setConfirmingOutlier(false);
              }}
              onKeyDown={handleKeyDown}
              placeholder="0.00"
            />
          )}
        </Field>

        <Button type="submit" variant="secondary" iconLeft={<Plus className="size-icon-sm" />}>
          {t('deliveries.addRow')}
        </Button>
      </form>

      {/* A question, not a refusal — and it says which figure it is asking about,
          because "are you sure" with no number is a dialog people click through. */}
      {confirmingOutlier ? (
        <p role="alert" className="flex items-start gap-xs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning">
          <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          {t('deliveries.outlierConfirm', { kgs: formatKg(roundKg(Number(kgText))) })}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="py-lg text-center text-body-small text-text-secondary">
          {t('deliveries.sessionEmpty')}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border border-divider">
            <table className="w-full border-collapse text-data-cell">
              <caption className="sr-only">{t('deliveries.sessionTable')}</caption>
              <thead className="bg-table-header">
                <tr>
                  <th scope="col" className="px-md py-sm text-left text-data-header text-text-secondary uppercase">
                    {t('deliveries.column.line')}
                  </th>
                  <th scope="col" className="px-md py-sm text-left text-data-header text-text-secondary uppercase">
                    {t('deliveries.column.supplier')}
                  </th>
                  <th scope="col" className="px-md py-sm text-right text-data-header text-text-secondary uppercase">
                    {t('deliveries.column.kgs')}
                  </th>
                  <th scope="col" className="px-md py-sm text-right text-data-header text-text-secondary uppercase">
                    <span className="sr-only">{t('common.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.key}
                    className={cnRow(Boolean(row.rejection), index)}
                  >
                    <td className="numeric px-md py-sm text-text-secondary">{index + 1}</td>
                    <td className="px-md py-sm">
                      <span className="flex flex-col">
                        <span className="numeric font-semibold text-text-primary">
                          {row.supplierCode}
                        </span>
                        <span className="text-caption text-text-secondary">{row.supplierName}</span>
                        {row.rejection ? (
                          <span className="text-caption text-error">{row.rejection.message}</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="numeric px-md py-sm text-right font-semibold">
                      {formatKg(row.kgs)}
                    </td>
                    <td className="px-md py-sm text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRow(row.key)}
                        iconLeft={<Trash2 className="size-icon-sm" />}
                      >
                        {t('deliveries.removeRow')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Running totals: the point of them is that a mistyped kilo shows up
              here, one line after it was typed, rather than in the month close. */}
          <div className="flex flex-wrap items-center justify-between gap-md">
            <dl className="flex flex-wrap items-center gap-lg text-body-small">
              <div className="flex items-baseline gap-xs">
                <dt className="text-text-secondary">{t('deliveries.totalKgs')}</dt>
                <dd className="numeric text-subtitle font-semibold text-text-primary">
                  {formatKg(totals.totalKgs)}
                </dd>
              </div>
              <div className="flex items-baseline gap-xs">
                <dt className="text-text-secondary">{t('deliveries.rowCount')}</dt>
                <dd className="numeric text-text-primary">{totals.rowCount}</dd>
              </div>
              <div className="flex items-baseline gap-xs">
                <dt className="text-text-secondary">{t('deliveries.supplierCount')}</dt>
                <dd className="numeric text-text-primary">{totals.supplierCount}</dd>
              </div>
            </dl>

            <Button onClick={() => void submit()} loading={commit.isPending}>
              {t('deliveries.commit', { count: rows.length })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function cnRow(rejected: boolean, index: number): string {
  if (rejected) return 'border-b border-divider bg-error-muted';
  return index % 2 === 1 ? 'border-b border-divider bg-table-row-alt' : 'border-b border-divider';
}

/**
 * Which of the search hits the clerk meant.
 *
 * An exact code wins over a prefix, and a prefix only wins when it is the *only*
 * hit. Typing `5` must not silently pick `5007` — a wrong grower recorded with no
 * refusal is the one failure this screen cannot allow, and the office would not
 * find it until the bill.
 */
function pickMatch(candidates: SupplierListItem[], typed: string): SupplierListItem | null {
  if (candidates.length === 0) return null;
  const wanted = typed.trim().toLowerCase();
  const bare = wanted.replace(/\s*\(.*\)$/, '');

  const exact = candidates.find((c) => {
    const code = c.supplierCode.toLowerCase();
    return code === wanted || code.replace(/\s*\(.*\)$/, '') === bare;
  });
  if (exact) return exact;

  return candidates.length === 1 ? candidates[0]! : null;
}
