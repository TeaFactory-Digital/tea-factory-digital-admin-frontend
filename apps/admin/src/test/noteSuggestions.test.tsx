import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/services/mocks/server';
import { useNoteSuggestions } from '@/components/useNoteSuggestions';
import { renderWithProviders, signInAs, signOut } from './render';

const BUILT_IN = [{ label: 'Built-in', text: 'The built-in sentence.' }];

function Chips() {
  const chips = useNoteSuggestions('inquiries.reply', BUILT_IN);
  return (
    <ul>
      {chips.map((chip) => (
        <li key={chip.label}>{`${chip.label}: ${chip.text}`}</li>
      ))}
    </ul>
  );
}

beforeEach(() => signOut());

describe('common notes from the configuration', () => {
  it('uses the factory’s own chips when it has saved some', async () => {
    server.use(
      http.get('*/admin/config', () =>
        HttpResponse.json({
          version: '1',
          config: {
            tenantId: 'galaboda',
            noteSuggestions: {
              'inquiries.reply': [
                { label: { en: 'On the way' }, text: { en: 'Your payment is on its way.' } },
              ],
            },
          },
          usage: {},
        }),
      ),
    );
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(<Chips />);
    expect(await screen.findByText('On the way: Your payment is on its way.')).toBeInTheDocument();
    expect(screen.queryByText(/built-in/i)).not.toBeInTheDocument();
  });

  it('keeps the built-in chips when nothing is saved', async () => {
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(<Chips />);
    expect(await screen.findByText('Built-in: The built-in sentence.')).toBeInTheDocument();
  });
});
