/**
 * M16 Reports — the shared half.
 *
 * **The report list is deliberately short, and this comment is the reason.** modules.md says
 * M16 *"needs the warehouse shape from §19.1 more than the report list"*, and §19.1 lives in
 * the mobile repository — it is not in this one. So rather than inventing a plausible dozen,
 * the four below are the reports whose **definition already exists in this codebase**:
 *
 *  | Report | Where it is defined here |
 *  | --- | --- |
 *  | `dormantSuppliers` | `SupplierQuery.dormantMonths`, whose doc comment says it "feeds the dormant-suppliers report (§19.2)" |
 *  | `channelShift` | `REQUEST_CHANNELS`, whose comment calls app adoption and channel shift "the two KPIs that justify the project" (§19.3) |
 *  | `leafByCollectionPoint` | M3's delivery rows, which the dashboard already trends |
 *  | `monthSummary` | M4's rate and M5's bill run, which are the month's own figures |
 *
 * Anything beyond those would be a guess dressed as a requirement, and a report the factory
 * did not ask for is a query somebody maintains and nobody reads. The gap is recorded in
 * status.md rather than filled in.
 *
 * A report is **read-only, derived, and never stored**. There is no "saved report" and no
 * scheduling: a stored result is a second answer waiting to disagree with the records it came
 * from, which is the same argument that keeps a bill a read model over deliveries and a rate.
 */

/** The four reports this codebase can define without guessing. */
export const REPORT_IDS = [
  'monthSummary',
  'leafByCollectionPoint',
  'dormantSuppliers',
  'channelShift',
] as const;

export type ReportId = (typeof REPORT_IDS)[number];

/** What a report needs before it can run. */
export type ReportParamKind = 'month' | 'dormantMonths' | 'monthRange';

export interface ReportDefinition {
  id: ReportId;
  params: ReportParamKind[];
  /**
   * The paragraph that defines it, carried on the definition.
   *
   * Not decoration: it is what stops the list growing by accident. A report with no citation
   * is one somebody thought would be useful, and this module's whole constraint is that the
   * requirement lives somewhere else.
   */
  definedBy: string;
}

export const REPORT_DEFINITIONS: Record<ReportId, ReportDefinition> = {
  monthSummary: {
    id: 'monthSummary',
    params: ['month'],
    definedBy: "M4's rate and M5's bill run",
  },
  leafByCollectionPoint: {
    id: 'leafByCollectionPoint',
    params: ['month'],
    definedBy: "M3's delivery rows",
  },
  dormantSuppliers: {
    id: 'dormantSuppliers',
    params: ['dormantMonths'],
    definedBy: '§19.2, via SupplierQuery.dormantMonths',
  },
  channelShift: {
    id: 'channelShift',
    params: ['monthRange'],
    definedBy: '§19.3 — app adoption and channel shift',
  },
};

/**
 * What `GET /admin/reports` answers: the reports, and the months they can be run over.
 *
 * **The months are here because of a capability, not for convenience.** §12.1 gives the factory
 * administrator `reports: R` and `billing: none`, so a month picker fed from M5's
 * `GET /admin/bill-months` leaves the one role that owns the Administration section unable to
 * run a single month report — the screen renders, the picker is empty, and nothing says why.
 * The list a report is chosen from has to sit behind the same grant as the report.
 *
 * Newest first, because a report is nearly always about the month just closed.
 */
export interface ReportCatalogue {
  reports: ReportDefinition[];
  months: string[];
}

/**
 * How a column should be rendered.
 *
 * Carried with the data rather than decided by the screen, because the API is the only thing
 * that knows whether a number is money, kilos or a count — and a report grid that guessed
 * would print `LKR 412.00` over a supplier count. The same reason the wire never carries a
 * formatted string (BR-110): the server says *what* it is, the console decides how it looks.
 *
 * **`text` is literal, never translated.** A supplier code, a collection point name and a
 * person's name are all `text` — running any of them through `t()` is how `reports.metric.5091`
 * and `reports.metric.MAKADURA` ended up on screen, which is the bug this type split fixes.
 *
 * **`metricKey` is the one column that is not prose.** `monthSummary`'s row label — `stage`,
 * `totalKgs`, `ratePerKg` — is a key under `reports.metric.*`, because a report about *this*
 * month cannot know in advance what language it will be read in. It is the only column in
 * any of the four reports where that is true.
 */
export type ReportColumnType =
  | 'text'
  | 'metricKey'
  | 'count'
  | 'money'
  | 'kg'
  | 'percent'
  | 'month'
  | 'date';

export interface ReportColumn {
  key: string;
  /** i18n key — never a label (BR-110). */
  labelKey: string;
  type: ReportColumnType;
}

export interface ReportRunParams {
  monthKey?: string;
  from?: string;
  to?: string;
  dormantMonths?: number;
}

export interface ReportResult {
  id: ReportId;
  columns: ReportColumn[];
  /** `null` is a real value — a supplier who has never delivered has no last delivery. */
  rows: Array<Record<string, string | number | null>>;
  /**
   * Column totals, only where a total means something.
   *
   * Summing kilos is a fact; summing a percentage is nonsense, and summing a month key is
   * worse. So this is per-report rather than derived from the column types, and a report that
   * omits it is saying its columns do not add up.
   */
  totals?: Record<string, number>;
  generatedAt: string;
  /** The window the figures cover, echoed so a printed page says what it is. */
  params: ReportRunParams;
}

/** Is this a report id the API knows? */
export function isReportId(value: string): value is ReportId {
  return (REPORT_IDS as readonly string[]).includes(value);
}

/**
 * Does this run have the parameters its report needs?
 *
 * Shared so the console can disable the button and the server can refuse with the same rule.
 * A report run with a missing month is not an empty result — it is a question nobody asked.
 */
export function missingReportParams(id: ReportId, params: ReportRunParams): ReportParamKind[] {
  return REPORT_DEFINITIONS[id].params.filter((kind) => {
    if (kind === 'month') return !params.monthKey;
    if (kind === 'dormantMonths') return params.dormantMonths === undefined;
    return !params.from || !params.to;
  });
}
