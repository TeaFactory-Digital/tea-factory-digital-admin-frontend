/**
 * The console conveniences of 22 November 2026: money boxes that group thousands and move on
 * with Enter, queue keys, the queue's neighbours, remembered filters, the opening balances
 * sheet, and the bulk decision on the tea packet queue.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router-dom';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { groupThousands, plainFigure } from '@/components/ui/moneyFigures';
import { useQueueKeys } from '@/components/useQueueKeys';
import { queueNeighbours } from '@/components/useQueueNeighbours';
import { filtersToRemember } from '@/components/rememberedFilters';
import { RememberFilters } from '@/components/RememberFilters';
import { parseGridPaste } from '@/modules/suppliers/openingGrid';
import { OpeningBalancesGridScreen } from '@/modules/suppliers/OpeningBalancesGridScreen';
import { TeaPacketsScreen } from '@/modules/tea-packets/TeaPacketsScreen';
import { SuppliersScreen } from '@/modules/suppliers/SuppliersScreen';
import { CommandMenu } from '@/layout/CommandMenu';
import { factoryRecordRepository } from '@/services/repositories/factoryRecordRepository';
import { clearFactorySync, setFactorySync } from './factorySync';
import { renderWithProviders, signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

/** This test environment's storage is not a working one: an in-memory stand-in. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

beforeEach(() => {
  signOut();
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
});
afterEach(() => clearFactorySync());

describe('money figures', () => {
  it('groups thousands and keeps the decimals as typed', () => {
    expect(groupThousands('45000')).toBe('45,000');
    expect(groupThousands('1234567.5')).toBe('1,234,567.5');
    expect(groupThousands('999')).toBe('999');
    expect(groupThousands('-12000')).toBe('-12,000');
    expect(groupThousands('')).toBe('');
  });

  it('turns what was typed back into the plain figure', () => {
    expect(plainFigure('45,000.50')).toBe('45000.50');
    expect(plainFigure('Rs 1,200')).toBe('1200');
    expect(plainFigure('1.2.3')).toBe('1.23');
    expect(plainFigure('-500')).toBe('500');
    expect(plainFigure('-500', true)).toBe('-500');
  });
});

function TwoBoxes() {
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  return (
    <form>
      <MoneyInput aria-label="First" value={first} onValueChange={setFirst} />
      <MoneyInput aria-label="Second" value={second} onValueChange={setSecond} />
      <output data-testid="plain">{first}</output>
    </form>
  );
}

describe('MoneyInput', () => {
  it('shows commas while typing, hands back the plain figure, and Enter moves on', async () => {
    const user = userEvent.setup();
    render(<TwoBoxes />);
    const first = screen.getByLabelText('First');
    await user.type(first, '1250000');
    expect(first).toHaveValue('1,250,000');
    expect(screen.getByTestId('plain')).toHaveTextContent('1250000');
    await user.keyboard('{Enter}');
    expect(screen.getByLabelText('Second')).toHaveFocus();
  });
});

function QueueKeys(props: { onApprove: () => void; onNext: () => void }) {
  useQueueKeys({ onApprove: props.onApprove, onNext: props.onNext });
  return <input aria-label="Note" />;
}

describe('queue keys', () => {
  it('A and J act, but not while typing or with a dialog open', async () => {
    const onApprove = vi.fn();
    const onNext = vi.fn();
    const user = userEvent.setup();
    render(<QueueKeys onApprove={onApprove} onNext={onNext} />);

    await user.keyboard('a');
    await user.keyboard('j');
    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText('Note'), 'aj');
    expect(onApprove).toHaveBeenCalledTimes(1);

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.appendChild(dialog);
    fireEvent.keyDown(window, { key: 'a' });
    expect(onApprove).toHaveBeenCalledTimes(1);
    dialog.remove();

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('finds the requests either side of the one on screen', () => {
    expect(queueNeighbours(['a', 'b', 'c'], 'b')).toEqual({ next: 'c', previous: 'a' });
    expect(queueNeighbours(['a', 'b', 'c'], 'c')).toEqual({ next: undefined, previous: 'b' });
    // Already decided, so no longer in the queue: the oldest waiting is next.
    expect(queueNeighbours(['a', 'b'], 'z')).toEqual({ next: 'a' });
  });
});

function Where() {
  const location = useLocation();
  return <span data-testid="where">{location.search}</span>;
}

describe('remembered filters', () => {
  it('keeps the filters but not the page, month or day', () => {
    expect(filtersToRemember('?status=approved&page=3&month=2026-10&q=saman')).toBe('status=approved&q=saman');
    expect(filtersToRemember('?page=2')).toBe('');
  });

  it('brings a list back as it was left, unless the link names its own filters', async () => {
    const first = renderWithProviders(
      <Routes>
        <Route path="/credit" element={<RememberFilters screen="credit"><Where /></RememberFilters>} />
      </Routes>,
      { route: '/credit?status=approved&page=2' },
    );
    await waitFor(() => expect(window.localStorage.getItem('tfd.filters.anyone.credit')).toBe('status=approved'));
    first.unmount();

    const again = renderWithProviders(
      <Routes>
        <Route path="/credit" element={<RememberFilters screen="credit"><Where /></RememberFilters>} />
      </Routes>,
      { route: '/credit' },
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('?status=approved');
    again.unmount();

    renderWithProviders(
      <Routes>
        <Route path="/credit" element={<RememberFilters screen="credit"><Where /></RememberFilters>} />
      </Routes>,
      { route: '/credit?status=rejected' },
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('?status=rejected');
  });
});

describe('opening balances sheet', () => {
  it('reads a block pasted from Excel: the code, then the figures in order', () => {
    const lines = parseGridPaste('5147\t0\t45,000\t3200\t0\t12850\t0\t4\t2\n\n5148\t1000\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]!.code).toBe('5147');
    expect(lines[0]!.values).toMatchObject({ loan: '45000', manure: '3200', savings: '12850', loanMonthsLeft: '4', loanInstalmentsPaid: '2' });
    expect(lines[1]!.values.advance).toBe('1000');
    expect(lines[1]!.values.loan).toBe('');
  });

  async function openSheet() {
    await setFactorySync(false);
    await signInAs(CLERK);
    renderWithProviders(
      <Routes>
        <Route path="/suppliers/opening-balances" element={<OpeningBalancesGridScreen />} />
      </Routes>,
      { route: '/suppliers/opening-balances' },
    );
    return screen.findByLabelText('Supplier code, line 1');
  }

  it('saves several suppliers typed down the sheet', async () => {
    await setFactorySync(false);
    await signInAs(CLERK);
    const ids: string[] = [];
    for (const [code, nic] of [['9301', '881234567V'], ['9302', '881234568V']] as const) {
      const added = await factoryRecordRepository.createSupplier({ supplierCode: code, name: `Sheet ${code}`, nic, collectionPoint: 'DENIYAYA', paymentMethod: 'cash', savingsPerKg: 0 });
      ids.push(added.id);
    }
    const user = userEvent.setup();
    const code = await openSheet();

    await user.type(code, '9301');
    await user.type(screen.getByLabelText('Advance owed, line 1'), '5000');
    // Enter walks across; from the last open box of the last line it opens a new line.
    await user.click(screen.getByLabelText('Unpaid from the last bill, line 1'));
    await user.keyboard('{Enter}');
    const second = await screen.findByLabelText('Supplier code, line 2');
    await waitFor(() => expect(second).toHaveFocus());
    await user.type(second, '9302');
    await user.type(screen.getByLabelText('Loan owed, line 2'), '45000');
    expect(screen.getByLabelText('Loan owed, line 2')).toHaveValue('45,000');

    await user.click(screen.getByRole('button', { name: 'Save 2' }));
    expect(await screen.findByText('Opening balances saved for 2 suppliers')).toBeInTheDocument();
    expect(await factoryRecordRepository.openingBalances(ids[0]!)).toMatchObject({ advance: 5000 });
    expect(await factoryRecordRepository.openingBalances(ids[1]!)).toMatchObject({ loan: 45000 });
  });

  it('saves nothing when one line is wrong, and says which', async () => {
    const user = userEvent.setup();
    const code = await openSheet();
    await user.type(code, '99999');
    await user.click(screen.getByRole('button', { name: 'Save 1' }));
    expect(await screen.findByText('Nothing was saved')).toBeInTheDocument();
    expect(await screen.findByText(/no supplier with this code/)).toBeInTheDocument();
  });
});

describe('bulk decision on the tea packet queue', () => {
  it('approves the selected requests with one note, each on its own', async () => {
    await signInAs(MANAGER);
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route path="/tea-packets" element={<TeaPacketsScreen />} />
      </Routes>,
      { route: '/tea-packets' },
    );
    const all = await screen.findByRole('checkbox', { name: 'Select every row that can be decided' }, { timeout: 10_000 });
    await user.click(all);
    const bar = screen.getByRole('toolbar', { name: 'Selected requests' });
    await user.click(within(bar).getByRole('button', { name: 'Approve selected' }));

    const dialog = await screen.findByRole('dialog');
    const note = within(dialog).getByRole('textbox');
    await user.type(note, 'Ready to collect at the office counter.');
    const submit = within(dialog).getByRole('button', { name: /^Approve \d+$/ });
    await user.click(submit);
    await waitFor(() => expect(within(dialog).getAllByText('Done').length).toBeGreaterThan(0), { timeout: 10_000 });
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});

describe('Ctrl+K actions', () => {
  it('offers "Add a supplier" to a clerk while the factory keeps its records here, and opens the dialog', async () => {
    await setFactorySync(false);
    await signInAs(CLERK);
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <CommandMenu />
        <Routes>
          <Route path="/" element={null} />
          <Route path="/suppliers" element={<SuppliersScreen />} />
        </Routes>
      </>,
    );
    await user.keyboard('{Control>}k{/Control}');
    const box = await screen.findByRole('combobox', { name: /search/i });
    await user.type(box, 'add a');
    await user.click(await screen.findByRole('option', { name: /Add a supplier/ }));
    expect(await screen.findByRole('dialog', { name: 'Add a supplier' }, { timeout: 10_000 })).toBeInTheDocument();
  }, 20_000);

  it('does not offer record-keeping actions while the factory system sends the records', async () => {
    await setFactorySync(true);
    await signInAs(CLERK);
    const user = userEvent.setup();
    renderWithProviders(<CommandMenu />);
    await user.keyboard('{Control>}k{/Control}');
    await screen.findByRole('listbox');
    expect(screen.queryByRole('option', { name: /Add a supplier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Enter leaf/ })).not.toBeInTheDocument();
  });
});
