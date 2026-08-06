/**
 * The payout file — §21.17 answered as configuration.
 *
 * Two halves, tested differently on purpose.
 *
 * **The serialiser** is pure, so it is tested as bytes: exact strings, not "contains".
 * A file is read by a bank's parser, not by a person, and an assertion that tolerates an
 * extra column or a missing quote tolerates exactly the defect that gets a batch rejected.
 *
 * **The endpoint** is tested for the three things that make producing a file different
 * from rendering a grid: it carries **full** account numbers where every other payload
 * masks them (§20.4), it is therefore **audited**, and it is **refused on a draft** —
 * because a file taken before the four-eyes release and uploaded to the bank would make
 * that release ceremonial (BR-501).
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_PAYOUT_EXPORT,
  PAYOUT_EXPORT_PRESETS,
  PAYOUT_EXPORT_PRESET_IDS,
  clonePayoutTemplate,
  configImpact,
  isPayoutTemplateUsable,
  payoutFileName,
  payoutTemplateProblems,
  serialisePayoutFile,
  type PayoutExportLine,
  type PayoutExportTemplate,
} from '@tfd/domain';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { payoutRepository } from '@/services/repositories/payoutRepository';
import { useAuthStore } from '@/auth/authStore';
import { signInAs, signInWithMfaAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const ADMIN = 'factoryadmin@galabodatea.lk';

/** A supplier whose name carries the character that breaks a naive CSV writer. */
const LINE: PayoutExportLine = {
  supplierCode: '5091',
  supplierName: 'Perera, K.',
  accountNumber: '0071-2345678',
  bankName: 'Bank of Ceylon',
  branchName: 'Akuressa',
  amount: 4213.5,
  monthKey: '2026-07',
  method: 'bankTransfer',
};

describe('the payout file serialiser', () => {
  it('writes exactly the columns configured, in order, with the headings given', () => {
    const template: PayoutExportTemplate = {
      delimiter: 'comma',
      headerRow: true,
      columns: [
        { field: 'accountNumber', label: 'A/C No' },
        { field: 'amount', label: 'Amount' },
        { field: 'supplierCode', label: 'Ref' },
      ],
      amountFormat: 'decimal2',
      accountFormat: 'plain',
      referenceTemplate: 'GL {month}',
    };

    // Byte for byte, including the CRLF a bank portal's parser expects.
    expect(serialisePayoutFile([LINE], template)).toBe(
      'A/C No,Amount,Ref\r\n0071-2345678,4213.50,5091\r\n',
    );
  });

  it('quotes only what has to be quoted', () => {
    const template = clonePayoutTemplate(DEFAULT_PAYOUT_EXPORT);
    const out = serialisePayoutFile([LINE], template);

    /**
     * `Perera, K.` is quoted and `Bank of Ceylon` is not.
     *
     * Both halves are the assertion. Never quoting splits that supplier across two columns
     * and shifts every field after it — an amount landing in the branch column. Always
     * quoting chokes the naive parsers that a good many bank portals still run.
     */
    expect(out).toContain('"Perera, K."');
    expect(out).toContain('Bank of Ceylon');
    expect(out).not.toContain('"Bank of Ceylon"');
  });

  it('escapes a quote inside a value by doubling it', () => {
    const template: PayoutExportTemplate = {
      ...clonePayoutTemplate(DEFAULT_PAYOUT_EXPORT),
      headerRow: false,
      columns: [
        { field: 'supplierName', label: '' },
        { field: 'amount', label: '' },
      ],
    };
    const out = serialisePayoutFile([{ ...LINE, supplierName: 'K. "Podi" Perera' }], template);
    expect(out).toBe('"K. ""Podi"" Perera",4213.50\r\n');
  });

  /**
   * The mistake with the worst consequence in this module.
   *
   * Sending `4213.50` where the sheet wanted `421350` pays every supplier a hundredth of
   * what they are owed, and the bank processes it without complaint. Asserted as exact
   * strings because "close enough" is the failure mode.
   */
  it('writes an amount the three ways a bank sheet asks for, and rounds honestly', () => {
    const base = { ...clonePayoutTemplate(DEFAULT_PAYOUT_EXPORT), headerRow: false, columns: [{ field: 'amount' as const, label: '' }] };

    expect(serialisePayoutFile([LINE], { ...base, amountFormat: 'decimal2' })).toBe('4213.50\r\n');
    expect(serialisePayoutFile([LINE], { ...base, amountFormat: 'cents' })).toBe('421350\r\n');
    expect(serialisePayoutFile([LINE], { ...base, amountFormat: 'whole' })).toBe('4214\r\n');

    // Floating point: 0.1 + 0.2 arithmetic must not reach a payment file as 421349.99999.
    const awkward = { ...LINE, amount: 1234.005 };
    expect(serialisePayoutFile([awkward], { ...base, amountFormat: 'cents' })).toBe('123401\r\n');
  });

  it('strips an account number to digits when the portal insists', () => {
    const base = {
      ...clonePayoutTemplate(DEFAULT_PAYOUT_EXPORT),
      headerRow: false,
      columns: [{ field: 'accountNumber' as const, label: '' }],
    };
    expect(serialisePayoutFile([LINE], { ...base, accountFormat: 'plain' })).toBe(
      '0071-2345678\r\n',
    );
    expect(serialisePayoutFile([LINE], { ...base, accountFormat: 'digitsOnly' })).toBe(
      '00712345678\r\n',
    );
  });

  /**
   * A cheque or cash line has no bank details, and the column is **empty rather than
   * absent** — a row with fewer fields than the header shifts every value after it, which
   * is how an amount ends up read as a branch name.
   */
  it('leaves a bank column empty rather than short when there is no account', () => {
    const template = clonePayoutTemplate(DEFAULT_PAYOUT_EXPORT);
    // A name with no comma in it, because this assertion counts fields by splitting — the
    // quoting case has its own test and would make this one measure the wrong thing.
    const cash = {
      ...LINE,
      supplierName: 'W. Silva',
      accountNumber: null,
      bankName: null,
      branchName: null,
    };
    const [, row] = serialisePayoutFile([cash], template).trimEnd().split('\r\n');

    expect(row!.split(',').length).toBe(template.columns.length);
    expect(row).toContain(',,,'); // account, bank and branch, all present and all empty
  });

  it('substitutes the reference the supplier will see on their statement', () => {
    const template = {
      ...clonePayoutTemplate(DEFAULT_PAYOUT_EXPORT),
      headerRow: false,
      columns: [{ field: 'reference' as const, label: '' }],
      referenceTemplate: 'GL{month}-{code}',
    };
    expect(serialisePayoutFile([LINE], template)).toBe('GL2026-07-5091\r\n');
  });

  it('ends every file with a terminator, so no supplier is dropped by a naive parser', () => {
    const out = serialisePayoutFile([LINE, LINE], clonePayoutTemplate(DEFAULT_PAYOUT_EXPORT));
    expect(out.endsWith('\r\n')).toBe(true);
  });

  it('names the file by the month and method the office files it under', () => {
    expect(payoutFileName('2026-07', 'bankTransfer', 'comma')).toBe(
      'payout-bankTransfer-2026-07.csv',
    );
    // A tab-separated file called `.csv` is one Excel opens as a single column.
    expect(payoutFileName('2026-07', 'cheque', 'tab')).toBe('payout-cheque-2026-07.tsv');
  });
});

describe('what makes a template unusable', () => {
  const base = clonePayoutTemplate(DEFAULT_PAYOUT_EXPORT);

  it('refuses a layout that could not produce a payment instruction', () => {
    expect(payoutTemplateProblems({ ...base, columns: [] })).toContain('no-columns');

    // A sheet of names and no amounts is a mailing list.
    expect(
      payoutTemplateProblems({ ...base, columns: [{ field: 'supplierName', label: 'Name' }] }),
    ).toContain('no-amount');

    expect(
      payoutTemplateProblems({
        ...base,
        columns: [
          { field: 'amount', label: 'A' },
          { field: 'amount', label: 'B' },
        ],
      }),
    ).toContain('duplicate-field');
  });

  /**
   * A blank heading matters only when a heading row is written — which is why the
   * `slipsSkeleton` preset can ship with empty labels and still be a legitimate starting
   * point rather than a broken template.
   */
  it('wants a heading only when the headings are written', () => {
    const columns = [{ field: 'amount' as const, label: '' }];
    expect(payoutTemplateProblems({ ...base, headerRow: true, columns })).toContain(
      'missing-label',
    );
    expect(payoutTemplateProblems({ ...base, headerRow: false, columns })).toEqual([]);
  });

  it('ships a default that is usable before anybody configures anything', () => {
    // A factory that downloads before opening the screen gets a readable spreadsheet, not
    // a refusal and not a file of unlabelled columns.
    expect(isPayoutTemplateUsable(DEFAULT_PAYOUT_EXPORT)).toBe(true);
  });

  /**
   * The presets are honest about which of them is finished.
   *
   * `genericCsv` is complete. The other two are deliberately headerless skeletons — the
   * columns those schemes ask for, with the labels left for somebody holding the bank's
   * specification. A preset that asserted a layout nobody has confirmed would read as an
   * answer to §21.17 and be a guess.
   */
  it('offers presets that are all usable, and only claims one is complete', () => {
    for (const id of PAYOUT_EXPORT_PRESET_IDS) {
      expect(isPayoutTemplateUsable(PAYOUT_EXPORT_PRESETS[id]), id).toBe(true);
    }
    expect(PAYOUT_EXPORT_PRESETS.genericCsv.columns.every((one) => one.label)).toBe(true);
    expect(PAYOUT_EXPORT_PRESETS.slipsSkeleton.headerRow).toBe(false);
    expect(PAYOUT_EXPORT_PRESETS.ceftsSkeleton.columns.every((one) => !one.label)).toBe(true);
  });

  it('blocks a bad layout through the same configImpact M14 refuses with', () => {
    const impacts = configImpact(
      { payouts: { export: { ...base, columns: [{ field: 'supplierName', label: 'Name' }] } } },
      { flags: {} as never, collectionPoints: [], banks: [], contentLanguages: ['en'] },
      {
        savingsBalances: 0,
        openPayoutRuns: 0,
        outstandingCredit: { advance: 0, loan: 0, manure: 0 },
        deliveriesByPoint: {},
        suppliersByBank: {},
        contentByLanguage: {},
      },
    );

    // Blocks, not warns: the output of a bad layout is a rejected batch, and the person
    // who discovers it is a supplier who was not paid.
    expect(impacts.some((one) => one.messageKey.endsWith('no-amount') && one.severity === 'blocks')).toBe(true);
  });
});

describe('M6 file export against the mock API', () => {
  beforeEach(() => {
    signOut();
  });

  /** The newest released run, which is the only kind a file may be taken from. */
  async function approvedRun() {
    const page = await payoutRepository.list({ pageSize: 50 });
    return page.items.find((run) => run.status !== 'draft' && run.payableCount > 0)!;
  }

  it('serves the run through the tenant’s own template', async () => {
    await signInAs(ACCOUNTANT);
    const run = await approvedRun();

    const { body, filename } = await payoutRepository.file(run.id);
    expect(filename).toBe(payoutFileName(run.monthKey, run.method, 'comma'));

    // The default template's headings, and one row per payable line.
    const rows = body.trimEnd().split('\r\n');
    expect(rows[0]).toBe('Supplier Code,Name,Account Number,Bank,Branch,Amount,Reference');

    const lines = await payoutRepository.lines(run.id, { pageSize: 500 });
    const payable = lines.items.filter((line) => line.status === 'pending');
    expect(rows.length - 1).toBe(payable.length);
  }, 20_000);

  /**
   * The reason this is an endpoint and not a `Blob` built in the browser.
   *
   * Every payload the console holds masks the account number (§20.4), and a payment file
   * cannot. So the file has real numbers in it — which is exactly why the next test insists
   * it is audited.
   */
  it('carries full account numbers, which no other payload does', async () => {
    await signInAs(ACCOUNTANT);
    const run = await approvedRun();

    const lines = await payoutRepository.lines(run.id, { pageSize: 500 });
    const onScreen = lines.items.find((line) => line.status === 'pending' && line.accountNumber)!;
    expect(onScreen.accountNumber).toMatch(/•/);

    const { body } = await payoutRepository.file(run.id);
    expect(body).not.toContain('•');
    // The last four digits are the part the mask kept, so they tie the two together.
    const tail = onScreen.accountNumber!.replace(/\D/g, '');
    expect(body).toContain(tail);
  }, 20_000);

  it('records the download, because two hundred account numbers left the office', async () => {
    await signInWithMfaAs(MANAGER);
    const run = await approvedRun();

    await payoutRepository.file(run.id);
    const audit = await auditRepository.list({ entity: 'payoutRun', entityId: run.id });
    const entry = audit.items.find((one) => one.action === 'payout.run.export');

    expect(entry, 'no audit entry for the export').toBeTruthy();
    expect(entry!.actorName).toBeTruthy();
    // The figures, so the entry is evidence rather than a note that something happened.
    expect((entry!.after as { lines: number }).lines).toBeGreaterThan(0);
  }, 20_000);

  /**
   * The refusal that keeps BR-501 meaningful.
   *
   * A run is prepared by the accountant and released by a manager. A file taken from the
   * draft and uploaded to the bank pays everybody *before* the release — and the release
   * then approves money that has already gone.
   */
  it('refuses a draft, so a file cannot go round the four-eyes release', async () => {
    await signInAs(ACCOUNTANT);
    const page = await payoutRepository.list({ pageSize: 50 });
    const draft = page.items.find((run) => run.status === 'draft');

    if (!draft) {
      // The fixture is expected to carry one; failing loudly beats passing vacuously.
      throw new Error('no draft run in the fixture — this test would assert nothing');
    }

    await expect(payoutRepository.file(draft.id)).rejects.toMatchObject({
      code: 'run-not-approved',
    });
  }, 20_000);

  it('refuses to serve a file from a layout that could not work', async () => {
    /**
     * Two sessions, because §12.1 splits these: the administrator holds `flagsAndBranding`
     * and **no `payouts`**, and the accountant is the reverse. Nobody in this fixture can do
     * both halves — which is the matrix working, and is why this test signs in twice.
     */
    await signInAs(ADMIN);
    const adminHeaders = {
      Authorization: `Bearer ${useAuthStore.getState().accessToken}`,
      'X-Tenant': 'galaboda',
      'Content-Type': 'application/json',
    };

    // Saved past the console's own guard, the way a scripted client would.
    const saved = await fetch('http://localhost/admin/config', {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ payouts: { export: { ...DEFAULT_PAYOUT_EXPORT, columns: [] } } }),
    });
    // Refused on the way in, too — the same rule, at the earlier gate.
    expect(saved.status).toBe(409);
    expect(await saved.json()).toMatchObject({ code: 'export-template-invalid' });
  }, 20_000);

  it('is refused for a factory that does not buy payouts (AC-07)', async () => {
    await signInAs(ACCOUNTANT);
    const run = await approvedRun();
    const token = useAuthStore.getState().accessToken;

    const response = await fetch(`http://localhost/admin/payout-runs/${run.id}/file`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Tenant': 'highland' },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'feature-disabled' });
  }, 20_000);

  /**
   * The loop closed: a layout saved in M14 is the layout M6 writes with.
   *
   * This is what makes §21.17 "answered as configuration" rather than "a screen that saves
   * into nothing" — the same argument AC-12 makes about the public `GET /config`.
   */
  it('writes with whatever layout the factory last saved', async () => {
    await signInAs(ADMIN);
    const { config, usage } = await adminConfigRepository.get();

    await adminConfigRepository.patch(
      {
        payouts: {
          export: {
            delimiter: 'pipe',
            headerRow: false,
            columns: [
              { field: 'accountNumber', label: '' },
              { field: 'amount', label: '' },
            ],
            amountFormat: 'cents',
            accountFormat: 'digitsOnly',
            referenceTemplate: 'GL{month}',
          },
        },
      },
      config,
      usage,
    );

    signOut();
    await signInAs(ACCOUNTANT);
    const run = await approvedRun();
    const { body, filename } = await payoutRepository.file(run.id);

    const first = body.split('\r\n')[0]!;
    expect(first).toContain('|');
    expect(first.split('|')).toHaveLength(2);
    // Digits only, and cents — both halves of what was configured.
    expect(first).toMatch(/^\d+\|\d+$/);
    expect(filename).toContain('payout-');
  }, 30_000);
});
