/**
 * M16 against the mock API.
 *
 * Every figure a report prints is derived from live state at request time, so the assertions
 * here are mostly **identities against the modules the figures came from**: the month summary's
 * kilos are M3's rows, its payable total is M5's bills, and the channel-shift counts are the
 * `channel` column M9, M7 and M10 all carry. A report that agreed with nothing would still
 * render, which is why agreeing is what gets tested.
 *
 * Two decisions get their own cases because both are easy to get wrong in the direction that
 * misleads an office:
 *
 *  - **`null` is not `0`** (BR-102). A supplier who has never delivered has no last delivery,
 *    and a month with no requests has no adoption share. A zero in either is a figure the
 *    office would quote.
 *  - **A total is only sent where a total means something.** No supplier count across
 *    collection points (a grower at two points is not two growers) and no average of monthly
 *    percentages (which is not the overall share).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { REPORT_DEFINITIONS, REPORT_IDS, isReportId, missingReportParams } from '@tfd/domain';
/* v1's imports, for the cases commented out below: `round2`, `monthRepository`,
 * `supplierRepository`. */
import { reportRepository } from '@/services/repositories/reportRepository';
import { isApiError } from '@/services/api/errors';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const EDITOR = 'editor@galabodatea.lk';
/* v1: `FACTORY_ADMIN` and `publishedMonthKey()`, for the month-report cases below.
 *
 *   const FACTORY_ADMIN = 'factoryadmin@galabodatea.lk';
 *
 *   /** The newest month with bills — what the month reports are worth running on. *\/
 *   async function publishedMonthKey() {
 *     const months = await billRepository.months();
 *     return months.find((month) => !month.open && month.billCount > 0)!.monthKey;
 *   }
 */

describe('M16 reports', () => {
  beforeEach(() => {
    signOut();
  });

  it('offers only the reports this codebase can define, each with its citation', async () => {
    await signInAs(ACCOUNTANT);
    const served = await reportRepository.list();

    /**
     * The list is short **on purpose**: modules.md records that M16 needs §19.1's warehouse
     * shape more than a report list, and §19.1 is not in this repository. A fifth report here
     * would be a guess dressed as a requirement.
     */
    expect(served.reports.map((one) => one.id).sort()).toEqual([...REPORT_IDS].sort());
    for (const definition of served.reports) {
      // A report with no citation is one somebody thought would be useful.
      expect(definition.definedBy, `${definition.id} has no citation`).toBeTruthy();
      expect(definition.params.length).toBeGreaterThan(0);
    }

    // The months come with the list, newest first — a report is nearly always about the month
    // just closed.
    expect(served.months.length).toBeGreaterThan(1);
    expect([...served.months].sort().reverse()).toEqual(served.months);
  });

  /**
   * The bug a unit test that called the repository directly could never find, and a browser
   * test found immediately.
   *
   * §12.1 gives the factory administrator `reports: R` and **`billing: none`**. The month
   * picker was fed from M5's `GET /admin/bill-months`, so the one role that owns the
   * Administration section got an empty picker, no month, and a screen that said "nothing to
   * show yet" — for a report they are entitled to run. The list a report is chosen from has to
   * sit behind the same grant as the report.
   */
  // ────────────────────────────────────────────────────────────────────────
  // v1. Commented out with `REPORT_IDS`, not deleted: it is still the statement of
  // what that report owed, and whoever builds the factory's own reporting has to
  // satisfy it. Restoring the report restores this with it.
  // ────────────────────────────────────────────────────────────────────────
  // it('lets a factory administrator, who holds no billing grant, run a month report', async () => {
  // await signInAs(FACTORY_ADMIN);
  //
  // // The grant that made this fail, asserted rather than assumed — if §12.1 ever gives the
  // // administrator `billing`, this test stops testing anything.
  // expect(useAuthStore.getState().grants?.billing ?? 'none').toBe('none');
  // await expect(billRepository.months()).rejects.toMatchObject({ code: 'forbidden' });
  //
  // const catalogue = await reportRepository.list();
  // expect(catalogue.months.length).toBeGreaterThan(0);
  //
  // const result = await reportRepository.run('monthSummary', { monthKey: catalogue.months[0]! });
  // expect(result.rows.length).toBeGreaterThan(0);
  // }, 20_000);
  //
  // it('ties the month summary to the modules its figures come from', async () => {
  // await signInAs(ACCOUNTANT);
  // const monthKey = await publishedMonthKey();
  //
  // const result = await reportRepository.run('monthSummary', { monthKey });
  // const value = (metric: string) =>
  // result.rows.find((row) => row.metric === metric)?.value ?? null;
  //
  // // M4's own summary, and M5's run. A report that disagreed with either would still render.
  // const month = await monthRepository.get(monthKey);
  // const run = await billRepository.run(monthKey);
  //
  // expect(value('totalKgs')).toBeCloseTo(month.totalKgs, 2);
  // expect(value('supplierCount')).toBe(month.supplierCount);
  // expect(value('deliveryCount')).toBe(month.deliveryCount);
  // expect(value('ratePerKg')).toBe(month.rate!.ratePerKg);
  // expect(value('billCount')).toBe(run.billCount);
  // expect(value('payableTotal')).toBeCloseTo(run.payableTotal, 2);
  // expect(value('savingsTotal')).toBeCloseTo(run.savingsTotal, 2);
  //
  // // The window is echoed back, so a printed page says what it is.
  // expect(result.params.monthKey).toBe(monthKey);
  // expect(result.generatedAt).toBeTruthy();
  // }, 30_000);
  //
  // it('breaks the month down by collection point, and totals only what adds up', async () => {
  // await signInAs(ACCOUNTANT);
  // const monthKey = await publishedMonthKey();
  //
  // const result = await reportRepository.run('leafByCollectionPoint', { monthKey });
  // expect(result.rows.length).toBeGreaterThan(1);
  //
  // // Heaviest first: the supervisor's question is which point is carrying the month.
  // const kilos = result.rows.map((row) => Number(row.totalKgs));
  // expect([...kilos].sort((a, b) => b - a)).toEqual(kilos);
  //
  // // The parts sum to the month.
  // const month = await monthRepository.get(monthKey);
  // expect(round2(kilos.reduce((sum, one) => sum + one, 0))).toBeCloseTo(month.totalKgs, 1);
  // expect(result.totals!.totalKgs).toBeCloseTo(month.totalKgs, 1);
  //
  // /**
  // * **No supplier total**, and that omission is the assertion. A grower who delivers to two
  // * points appears in both rows, so a sum would double-count people — and a total that
  // * double-counts is worse than none, because the office would quote it.
  // */
  // expect(result.totals!.supplierCount).toBeUndefined();
  // expect(result.totals!.deliveryCount).toBe(month.deliveryCount);
  // }, 30_000);
  //
  // it('finds the suppliers who have stopped, and keeps null as null', async () => {
  // await signInAs(ACCOUNTANT);
  //
  // const result = await reportRepository.run('dormantSuppliers', { dormantMonths: 3 });
  // expect(result.rows.length).toBeGreaterThan(0);
  //
  // // Longest-dormant first, which is the order the office telephones in.
  // const dates = result.rows.map((row) => String(row.lastDeliveryAt ?? ''));
  // expect([...dates].sort()).toEqual(dates);
  //
  // /**
  // * A supplier who has **never** delivered carries `null`, not an epoch or a blank string.
  // * That row is a registration that never became a supply relationship, which is a different
  // * conversation from one that lapsed — and BR-102 is the general form of the rule.
  // */
  // for (const row of result.rows) {
  // expect(row.lastDeliveryAt === null || typeof row.lastDeliveryAt === 'string').toBe(true);
  // }
  //
  // // The balances are carried because a dormant supplier who is owed savings is a different
  // // telephone call, and they tie to the registry.
  // const first = result.rows[0]!;
  // const supplier = (await supplierRepository.list({ q: String(first.supplierCode), pageSize: 1 }))
  // .items[0]!;
  // const detail = await supplierRepository.get(supplier.id);
  // expect(first.savingsBalance).toBeCloseTo(detail.savingsBalance, 2);
  //
  // // A tighter window cannot return more rows than a looser one.
  // const tighter = await reportRepository.run('dormantSuppliers', { dormantMonths: 12 });
  // expect(tighter.rows.length).toBeLessThanOrEqual(result.rows.length);
  // }, 30_000);
  //
  // it('measures app adoption from the channel column, month by month', async () => {
  // await signInAs(ACCOUNTANT);
  // const months = await billRepository.months();
  // const from = months.at(-1)!.monthKey;
  // const to = months[0]!.monthKey;
  //
  // const result = await reportRepository.run('channelShift', { from, to });
  // expect(result.rows.length).toBeGreaterThan(0);
  //
  // // Oldest first: a trend is read forward.
  // const keys = result.rows.map((row) => String(row.monthKey));
  // expect([...keys].sort()).toEqual(keys);
  //
  // for (const row of result.rows) {
  // const total = Number(row.total);
  // expect(total).toBe(Number(row.fromApp) + Number(row.fromOffice));
  // if (total === 0) {
  // // A share of nothing is not zero per cent, and a chart plotting it as such would show
  // // adoption collapsing in a quiet month.
  // expect(row.appShare).toBeNull();
  // } else {
  // expect(Number(row.appShare)).toBeCloseTo(round2((Number(row.fromApp) / total) * 100), 2);
  // }
  // }
  //
  // /**
  // * **No `appShare` total.** Averaging monthly percentages across months of different sizes
  // * does not give the overall share, and the office would quote whatever number was there.
  // */
  // expect(result.totals!.appShare).toBeUndefined();
  // const totals = result.totals!;
  // expect(totals.total).toBe(totals.fromApp! + totals.fromOffice!);
  //
  // // The fixture carries office-raised requests in all three queues, so this is a real
  // // measurement rather than a column of zeros — §19.3's KPI needs both channels present.
  // expect(totals.fromOffice).toBeGreaterThan(0);
  // expect(totals.fromApp).toBeGreaterThan(0);
  // }, 30_000);
  //
  // it('refuses a report that is missing a parameter rather than returning nothing', async () => {
  // await signInAs(ACCOUNTANT);
  //
  // /**
  // * An empty grid would read as "no leaf that month", which is the one wrong answer this
  // * screen can give. Refused on the client by the shared rule, before a round trip.
  // */
  // await expect(reportRepository.run('monthSummary', {})).rejects.toMatchObject({
  // code: 'invalid',
  // });
  //
  // // And by the server, for a request that skipped the repository.
  // const token = useAuthStore.getState().accessToken;
  // const response = await fetch('http://localhost/admin/reports/monthSummary', {
  // headers: { Authorization: `Bearer ${token}` },
  // });
  // expect(response.status).toBe(422);
  // expect(await response.json()).toMatchObject({ code: 'invalid' });
  // });

  it('404s a report it does not have', async () => {
    await signInAs(ACCOUNTANT);
    const token = useAuthStore.getState().accessToken;
    const response = await fetch('http://localhost/admin/reports/profitByEstate', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(404);
    expect(isReportId('profitByEstate')).toBe(false);
  });

  // ────────────────────────────────────────────────────────────────────────
  // v1. Commented out with the flag it asserts on.
  //
  // `enablePayouts` and `enableReports` were **console-only flags** — neither exists in
  // the app's `FeatureFlags` — and both went with the modules they gated (see
  // `FeatureFlagSet`). The endpoint therefore no longer refuses, because there is no
  // longer a flag for it to refuse on.
  //
  // Kept rather than deleted because AC-07 is still a live criterion for every flag that
  // remains: `configuration.test.ts` and the credit suites assert exactly this shape for
  // `enableSavings`, `enableInquiry`, `enableTeaPackets` and the three facilities.
  // ────────────────────────────────────────────────────────────────────────
  // it('refuses the module for a tenant that does not buy reports (AC-07)', async () => {
  // await signInAs(ACCOUNTANT);
  // const token = useAuthStore.getState().accessToken;
  //
  // // `highland` has `enableReports: false`. The sidebar hides the row; this is the half a
  // // replayed request cannot get past.
  // const response = await fetch('http://localhost/admin/reports', {
  // headers: { Authorization: `Bearer ${token}`, 'X-Tenant': 'highland' },
  // });
  // expect(response.status).toBe(403);
  // expect(await response.json()).toMatchObject({ code: 'feature-disabled' });
  // });

  it('gives every operational role read access and the editor none (§12.1)', async () => {
    // `reports: R` for clerk, weigher, accountant, manager and both admins — this is the
    // dashboard's capability, so almost everybody has it.
    await signInWithMfaAs(MANAGER);
    await expect(reportRepository.list()).resolves.toBeTruthy();

    // The editor is the exception: §12.1 gives them `content: W` and nothing else at all.
    signOut();
    await signInAs(EDITOR);
    const refused = await reportRepository.list().catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  }, 20_000);
});

describe('missingReportParams (the shared rule)', () => {
  it('asks each report for exactly what it needs', () => {
    // Shared so the console can disable the control and the server can refuse identically.
    expect(missingReportParams('channelShift', { from: '2026-01' })).toEqual(['monthRange']);
    expect(missingReportParams('channelShift', { from: '2026-01', to: '2026-07' })).toEqual([]);

    /* v1's three, commented out with their ids (`REPORT_IDS`). `missingReportParams`
     * still handles them — the rule is per `ReportParamKind`, not per report — so these
     * come back with the reports rather than needing rewriting:
     *
     *   expect(missingReportParams('monthSummary', {})).toEqual(['month']);
     *   expect(missingReportParams('monthSummary', { monthKey: '2026-07' })).toEqual([]);
     *   expect(missingReportParams('dormantSuppliers', {})).toEqual(['dormantMonths']);
     *   // Zero is a real answer — "no leaf at all this month" — not a missing parameter.
     *   expect(missingReportParams('dormantSuppliers', { dormantMonths: 0 })).toEqual([]);
     */
  });

  it('keeps every definition\'s params satisfiable', () => {
    // A report whose parameters no form can supply is a report nobody can run.
    for (const id of REPORT_IDS) {
      for (const kind of REPORT_DEFINITIONS[id].params) {
        expect(['month', 'dormantMonths', 'monthRange']).toContain(kind);
      }
    }
  });
});
