/**
 * M16 Reports.
 *
 * **One screen for every report, and the report describes itself.** The server sends its
 * columns with its rows, including what each column *is* — money, kilos, a count, a percentage
 * — so this screen formats without knowing which report it is looking at. That is not
 * generality for its own sake: the API is the only thing that knows a number's units, and a
 * grid that guessed would print `LKR 412.00` over a supplier count.
 *
 * **The list is short on purpose**, and the screen says so. modules.md records that M16 needs
 * the §19.1 warehouse shape more than it needs a report list, and §19.1 is not in this
 * repository — so the four reports here are the ones whose definition already exists in the
 * codebase, each carrying the citation that justifies it. A fifth would be a guess dressed as
 * a requirement, and a report the factory did not ask for is a query somebody maintains and
 * nobody reads.
 *
 * **There is no export.** §18.1 asks for CSV/XLSX and it is not built, exactly as it is not
 * for M17 — recorded in status.md rather than implied by a disabled download button. The grid
 * is a real `<table>`, so the office can select it and paste it into a spreadsheet, which is
 * where the office lives (§19.5).
 */

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { FileBarChart } from 'lucide-react';
import {
  REPORT_DEFINITIONS,
  REPORT_IDS,
  isReportId,
  missingReportParams,
  type ReportColumn,
  type ReportId,
  type ReportRunParams,
} from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Field, Input, Select } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import {
  formatAmount,
  formatCount,
  formatDate,
  formatKg,
  formatMonthKey,
  NOT_AVAILABLE,
} from '@/lib/format';
import { useReportCatalogue, useReportRun } from './hooks';

/**
 * One cell, formatted by what the column says it is.
 *
 * `null` is never `0` (BR-102) and never blank: a supplier who has never delivered has no last
 * delivery, and a month with no requests has no adoption share — both render as an em dash,
 * because a zero there is a figure the office would quote.
 */
function cell(value: string | number | null, column: ReportColumn, t: (key: string) => string) {
  if (value === null || value === undefined) return NOT_AVAILABLE;

  switch (column.type) {
    case 'money':
      return formatAmount(Number(value));
    case 'kg':
      return formatKg(Number(value));
    case 'count':
      return formatCount(Number(value));
    case 'percent':
      return `${formatAmount(Number(value))}%`;
    case 'month':
      return formatMonthKey(String(value));
    case 'date':
      return formatDate(String(value));
    case 'metricKey':
      // `monthSummary`'s row label is a key, not prose — localized like everything else.
      return typeof value === 'string' ? t(`reports.metric.${value}`) || value : String(value);
    default:
      // `text` is literal: a supplier code, a collection point name, a person's name. Never
      // run through `t()` — that was the bug (`reports.metric.5091`, `reports.metric.MAKADURA`).
      return String(value);
  }
}

const NUMERIC: ReportColumn['type'][] = ['money', 'kg', 'count', 'percent'];

export function ReportsScreen() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();

  const catalogue = useReportCatalogue();

  const requested = params.get('report');
  /**
   * v2's default is the only report left. `REPORT_IDS[0]` rather than a literal, so the
   * default follows the catalogue if the factory's own reporting ever adds to it again.
   */
  const id: ReportId = requested && isReportId(requested) ? requested : REPORT_IDS[0];
  const definition = REPORT_DEFINITIONS[id];

  /** Parameter state, defaulted so the common case runs on arrival. */
  const monthOptions = catalogue.data?.months ?? [];
  const [monthKey, setMonthKey] = useState('');
  const [dormantMonths, setDormantMonths] = useState(3);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const resolvedMonth = monthKey || monthOptions[0] || '';
  const resolvedFrom = from || monthOptions.at(-1) || '';
  const resolvedTo = to || monthOptions[0] || '';

  const runParams = useMemo<ReportRunParams>(
    () => ({
      monthKey: definition.params.includes('month') ? resolvedMonth : undefined,
      dormantMonths: definition.params.includes('dormantMonths') ? dormantMonths : undefined,
      from: definition.params.includes('monthRange') ? resolvedFrom : undefined,
      to: definition.params.includes('monthRange') ? resolvedTo : undefined,
    }),
    [definition, resolvedMonth, dormantMonths, resolvedFrom, resolvedTo],
  );

  const missing = missingReportParams(id, runParams);
  const run = useReportRun(id, runParams, missing.length === 0);

  function selectReport(next: string) {
    const params2 = new URLSearchParams(params);
    params2.set('report', next);
    setParams(params2, { replace: true });
  }

  const result = run.data;

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        description={t('reports.subtitle')}
        actions={
          result ? (
            <span className="flex flex-col">
              <span className="text-caption text-text-secondary">{t('reports.rows')}</span>
              <span className="numeric text-subtitle text-text-primary">
                {formatCount(result.rows.length)}
              </span>
            </span>
          ) : null
        }
      />

      <div className="grid gap-lg lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        {/* The rail, like M12 and M14: a handful of named things, each with what defines it. */}
        <Card>
          <CardHeader title={t('reports.available')} />
          <CardBody className="p-0">
            <ul>
              {(catalogue.data?.reports ?? Object.values(REPORT_DEFINITIONS)).map((one) => (
                <li key={one.id}>
                  <button
                    type="button"
                    onClick={() => selectReport(one.id)}
                    aria-current={one.id === id ? 'true' : undefined}
                    className={cn(
                      'flex w-full items-start gap-sm border-l-2 px-lg py-sm text-left',
                      one.id === id
                        ? 'border-primary bg-primary-muted'
                        : 'border-transparent hover:bg-surface-variant',
                    )}
                  >
                    <FileBarChart
                      className="mt-xxs size-icon-sm shrink-0 text-text-secondary"
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-col">
                      <span
                        className={cn(
                          'text-body-small',
                          one.id === id ? 'font-semibold text-primary' : 'text-text-primary',
                        )}
                      >
                        {t(`reports.name.${one.id}`)}
                      </span>
                      {/* What defines it. A report with no citation is one somebody thought
                          would be useful, and this module's constraint is that the
                          requirement lives elsewhere (§19.1). */}
                      <span className="text-caption text-text-secondary">{one.definedBy}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardBody>

          <CardBody className="border-t border-divider">
            <p className="text-caption text-text-secondary">{t('reports.shortListNote')}</p>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-lg">
          <Card>
            <CardHeader
              title={t(`reports.name.${id}`)}
              description={t(`reports.description.${id}`)}
            />
            <CardBody className="flex flex-wrap items-end gap-md">
              {definition.params.includes('month') ? (
                <Field label={t('money.pickMonth')} className="w-56">
                  {({ id: fieldId }) => (
                    <Select
                      id={fieldId}
                      value={resolvedMonth}
                      onChange={(event) => setMonthKey(event.target.value)}
                    >
                      {monthOptions.map((month) => (
                        <option key={month} value={month}>
                          {formatMonthKey(month)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              ) : null}

              {definition.params.includes('dormantMonths') ? (
                <Field
                  label={t('reports.param.dormantMonths')}
                  className="w-56"
                  hint={t('reports.param.dormantMonthsHint')}
                >
                  {({ id: fieldId, describedBy }) => (
                    <Input
                      id={fieldId}
                      aria-describedby={describedBy}
                      type="number"
                      min={1}
                      max={36}
                      className="numeric"
                      value={dormantMonths}
                      onChange={(event) => setDormantMonths(Number(event.target.value) || 1)}
                    />
                  )}
                </Field>
              ) : null}

              {definition.params.includes('monthRange') ? (
                <>
                  <Field label={t('reports.param.from')} className="w-48">
                    {({ id: fieldId }) => (
                      <Select
                        id={fieldId}
                        value={resolvedFrom}
                        onChange={(event) => setFrom(event.target.value)}
                      >
                        {monthOptions.map((month) => (
                          <option key={month} value={month}>
                            {formatMonthKey(month)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={t('reports.param.to')} className="w-48">
                    {({ id: fieldId }) => (
                      <Select
                        id={fieldId}
                        value={resolvedTo}
                        onChange={(event) => setTo(event.target.value)}
                      >
                        {monthOptions.map((month) => (
                          <option key={month} value={month}>
                            {formatMonthKey(month)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </>
              ) : null}

              {/* No "run" button: the report runs when it has what it needs. A button would be
                  a second thing to press for an answer already available. */}
              <p className="text-caption text-text-secondary">
                {missing.length > 0 ? t('reports.needsParams') : t('reports.runsAutomatically')}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('reports.results')}
              actions={
                result ? (
                  <Badge tone="neutral">
                    {t('reports.generatedAt', { when: formatDate(result.generatedAt) })}
                  </Badge>
                ) : null
              }
            />

            {run.isPending && missing.length === 0 ? (
              <CardBody className="flex justify-center py-xl">
                <Spinner />
              </CardBody>
            ) : run.error ? (
              <CardBody>
                <ErrorState error={run.error} onRetry={() => void run.refetch()} compact />
              </CardBody>
            ) : !result ? (
              <CardBody>
                <EmptyState title={t('reports.noParams')} body={t('reports.noParamsHint')} />
              </CardBody>
            ) : result.rows.length === 0 ? (
              <CardBody>
                <EmptyState title={t('reports.empty')} body={t('reports.emptyHint')} />
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-data-cell" aria-label={t(`reports.name.${id}`)}>
                  <thead className="sticky top-0 z-10 bg-table-header shadow-[inset_0_-1px_0_0_var(--color-border)]">
                    <tr>
                      {result.columns.map((column) => (
                        <th
                          key={column.key}
                          scope="col"
                          className={cn(
                            'px-md py-sm text-data-header whitespace-nowrap uppercase text-text-secondary',
                            NUMERIC.includes(column.type) ? 'text-right' : 'text-left',
                          )}
                        >
                          {t(column.labelKey)}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {result.rows.map((row, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 1 ? 'border-b border-divider bg-table-row-alt' : 'border-b border-divider'}
                      >
                        {result.columns.map((column) => (
                          <td
                            key={column.key}
                            className={cn(
                              'px-md py-sm align-middle',
                              NUMERIC.includes(column.type)
                                ? 'numeric text-right text-text-primary'
                                : 'text-text-primary',
                            )}
                          >
                            {/* v1: `monthSummary` rendered its `stage` row through the
                                month vocabulary rather than as a bare string —
                                  id === 'monthSummary' && column.key === 'value' && row.metric === 'stage'
                                    ? t(`month.stage.${row.value}`) : …
                                Commented out with the report; see `REPORT_IDS`. */}
                            {cell(row[column.key] ?? null, column, t)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>

                  {result.totals ? <ReportTotals columns={result.columns} totals={result.totals} /> : null}
                </table>
              </div>
            )}

            <CardBody className="border-t border-divider">
              <p className="text-caption text-text-secondary">{t('reports.noExportNote')}</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

/**
 * The totals row.
 *
 * Its own component so `totals` is a narrowed prop rather than a possibly-undefined field
 * read inside a closure — the version written inline needed a non-null assertion per cell,
 * which is three assertions to protect one condition already checked above it.
 *
 * A column with no entry renders **blank, not zero**. That is the whole point of the server
 * choosing which columns to total: a share of a share is not a share, and a supplier who
 * delivers to two points is not two suppliers. A zero there would be a figure the office
 * quotes.
 */
function ReportTotals({
  columns,
  totals,
}: {
  columns: ReportColumn[];
  totals: Record<string, number>;
}) {
  const { t } = useTranslation();

  return (
    <tfoot>
      <tr className="border-t-2 border-border font-semibold">
        {columns.map((column, index) => {
          const value = totals[column.key];
          return (
            <td
              key={column.key}
              className={cn(
                'px-md py-sm',
                NUMERIC.includes(column.type)
                  ? 'numeric text-right text-text-primary'
                  : 'text-text-secondary',
              )}
            >
              {index === 0 ? t('reports.total') : value === undefined ? '' : cell(value, column, t)}
            </td>
          );
        })}
      </tr>
    </tfoot>
  );
}
