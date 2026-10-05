import { beforeEach, describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandMenu } from '@/layout/CommandMenu';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => signOut());

describe('search from anywhere', () => {
  it('opens on Ctrl+K and offers only the pages this role can open', async () => {
    const user = userEvent.setup();
    await signInAs('editor@galabodatea.lk');
    renderWithProviders(<CommandMenu />);

    await user.keyboard('{Control>}k{/Control}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    // An editor works on content and has no supplier access.
    expect(screen.getByRole('option', { name: /news/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^suppliers/i })).not.toBeInTheDocument();
  });

  it('finds a supplier by name for a clerk', async () => {
    const user = userEvent.setup();
    await signInAs('clerk@galabodatea.lk');
    renderWithProviders(<CommandMenu />);

    await user.keyboard('{Control>}k{/Control}');
    const box = await screen.findByRole('textbox', { name: /search/i });
    await user.type(box, 'a');
    await user.type(box, 'n');
    expect((await screen.findAllByRole('option', { name: /·/ })).length).toBeGreaterThan(0);
  });
});
