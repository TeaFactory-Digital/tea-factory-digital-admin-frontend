/**
 * The bill engine's open points, as the factory decided them on 10 November 2026 (Vinul's
 * questions on the bill engine design). The mock's `generateBills` is what the console is
 * tested against, so it follows them:
 *
 * - an advance is taken back in full, even past the gross, and bears no interest;
 * - a month without leaf charges nothing: no instalment, no interest, no stamps;
 * - a withdrawal paid on the bill leaves the savings to date with it;
 * - several manure plans at once: each plan's instalment, added together. The handler
 *   passes their sum as one plan of one month; here, that the bill takes it whole.
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_DEDUCTION_RATES } from '@tfd/domain';
import type { AdminSupplier, Delivery } from '@tfd/domain';
import { billFactoryOf, generateBills, mockDeliveries, mockSuppliers } from '@/services/mocks/seed';

const MONTH = '2026-10';
const RATE = { monthKey: MONTH, ratePerKg: 118.75, extraRatePerKg: 6 } as never;

function supplierWith(balances: Partial<AdminSupplier['creditBalances']>): AdminSupplier {
  const base = mockSuppliers[0]!;
  return {
    ...base,
    id: 'sup-rules',
    supplierCode: '9001',
    creditBalances: { advance: 0, loan: 0, manure: 0, ...balances },
  };
}

function leaf(supplierId: string, kgs: number): Delivery[] {
  const template = mockDeliveries[0]!;
  return [{ ...template, id: 'del-rules', supplierId, monthKey: MONTH, date: `${MONTH}-05`, kgs, voidedAt: null }];
}

function billFor(
  supplier: AdminSupplier,
  deliveries: Delivery[],
  extra: Partial<Parameters<typeof generateBills>[0]> = {},
) {
  const bills = generateBills({
    monthKey: MONTH,
    runId: 'run-rules',
    generatedAt: `${MONTH}-31T12:00:00.000Z`,
    generatedById: 'u1',
    generatedByName: 'Tester',
    publishedAt: null,
    deliveries,
    suppliers: [supplier],
    rate: RATE,
    factory: billFactoryOf('galaboda'),
    coinsBroughtForward: new Map(),
    debtBroughtForward: new Map(),
    savingsBefore: new Map([[supplier.id, 5000]]),
    deductionRates: { ...DEFAULT_DEDUCTION_RATES, stamps: 25 },
    loanInterest: { monthlyRatePercent: 1 },
    ...extra,
  });
  return bills[0];
}

describe('the bill engine, as the factory decided it', () => {
  it('takes an advance back in full, even past the gross, with no interest on it', () => {
    // 10 kg is about Rs. 1,250 gross; the advance is Rs. 20,000.
    const supplier = supplierWith({ advance: 20000 });
    const bill = billFor(supplier, leaf(supplier.id, 10))!;
    expect(bill.deductions.advance).toBe(20000);
    expect(bill.carryForward.nextMonthDeb).toBeGreaterThan(0);
    expect(bill.carryForward.loanInterest).toBe(0);
  });

  it('charges nothing in a month without leaf: no instalment, no interest, no stamps', () => {
    const supplier = supplierWith({ loan: 50000, manure: 3000, advance: 1000 });
    // Only a savings withdrawal brings this supplier a bill.
    const bill = billFor(supplier, [], { savingsWithdrawals: new Map([[supplier.id, 2000]]) })!;
    expect(bill.totalKgs).toBe(0);
    expect(bill.deductions.stamps).toBe(0);
    expect(bill.deductions.loansAdvance).toBe(0);
    expect(bill.deductions.advance).toBe(0);
    expect(bill.deductions.manure).toBe(0);
    expect(bill.carryForward.loanInterest).toBe(0);
    expect(bill.carryForward.loanBalance).toBe(50000);
    // And with nothing owed to them, no bill at all.
    expect(billFor(supplier, [])).toBeUndefined();
  });

  it('still charges stamps and the loan in a month with leaf', () => {
    const supplier = supplierWith({ loan: 50000 });
    const bill = billFor(supplier, leaf(supplier.id, 400))!;
    expect(bill.deductions.stamps).toBe(25);
    expect(bill.carryForward.loanInterest).toBe(500);
  });

  it('leaves a withdrawal paid on the bill out of the savings to date', () => {
    const supplier = supplierWith({});
    const bill = billFor(supplier, leaf(supplier.id, 400), {
      savingsWithdrawals: new Map([[supplier.id, 2000]]),
    })!;
    expect(bill.savingsSummary.previous).toBe(5000);
    expect(bill.savingsSummary.toDate).toBe(
      Math.round((5000 + bill.savingsSummary.thisMonth - 2000) * 100) / 100,
    );
  });

  it('adds together the instalments of several manure plans', () => {
    const supplier = supplierWith({ manure: 10000 });
    // Two plans: 6,000 over 6 months and 4,000 over 4 months, so 1,000 + 1,000 a month.
    const bill = billFor(supplier, leaf(supplier.id, 400), {
      repaymentMonths: new Map([[supplier.id, { manure: { amount: 2000, months: 1 } }]]),
      deductionRates: {
        ...DEFAULT_DEDUCTION_RATES,
        instalmentShares: { ...DEFAULT_DEDUCTION_RATES.instalmentShares, manure: 1 },
      },
    })!;
    expect(bill.deductions.manure).toBe(2000);
  });
});
