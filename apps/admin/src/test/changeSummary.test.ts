import { describe, expect, it } from 'vitest';
import { compareSummaries } from '@/lib/changeSummary';

describe('compareSummaries', () => {
  it('pairs labelled parts and marks only the one that changes', () => {
    expect(compareSummaries('Home: — · Estate: —', 'Home: Probe Road · Estate: —')).toEqual([
      { label: 'Home', current: null, requested: 'Probe Road', changed: true },
      { label: 'Estate', current: null, requested: null, changed: false },
    ]);
  });

  it('keeps an unlabelled summary as one row', () => {
    expect(compareSummaries('bankTransfer', 'cash')).toEqual([
      { label: null, current: 'bankTransfer', requested: 'cash', changed: true },
    ]);
  });

  it('does not split a bank line on its separators', () => {
    expect(compareSummaries('none on file', 'Bank of Ceylon · Galle · ••••7890')).toEqual([
      { label: null, current: null, requested: 'Bank of Ceylon · Galle · ••••7890', changed: true },
    ]);
  });
});
