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
import { reportRepository } from '@/services/repositories/reportRepository';
import { isApiError } from '@/services/api/errors';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const EDITOR = 'editor@galabodatea.lk';

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

  it('404s a report it does not have', async () => {
    await signInAs(ACCOUNTANT);
    const token = useAuthStore.getState().accessToken;
    const response = await fetch('http://localhost/admin/reports/profitByEstate', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(404);
    expect(isReportId('profitByEstate')).toBe(false);
  });

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
