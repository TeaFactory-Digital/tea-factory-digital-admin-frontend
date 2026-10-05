import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportCsvButton } from '@/components/ExportCsvButton';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

describe('Download CSV', () => {
  it('fetches every page the filters match, not just the one on screen', async () => {
    let written = '';
    const OriginalBlob = globalThis.Blob;
    vi.stubGlobal(
      'Blob',
      class extends OriginalBlob {
        constructor(parts: BlobPart[], options?: BlobPropertyBag) {
          super(parts, options);
          written = String(parts[0]);
        }
      },
    );
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const fetchPage = vi.fn(async (page: number) => ({
      items: [{ code: `A${page}` }, { code: `B${page}` }],
      page,
      pageSize: 100,
      total: 4,
      nextPage: page === 0 ? 1 : null,
    }));

    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(
      <ExportCsvButton
        name="test"
        fetchPage={fetchPage}
        columns={[{ header: 'Code', value: (r: { code: string }) => r.code }]}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: /download csv/i }));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(written).toContain('"A1"'));
    expect(written.split('\r\n')).toHaveLength(5); // header + 4 rows
    vi.unstubAllGlobals();
  });
});
