/**
 * Does the screen come up at all.
 *
 * Two screens shipped an identifier that was used and never imported —
 * `emailSchema` in M14's factory section, `Label` and `Checkbox` in M11's credit
 * queue — and both threw on their first render, so the route boundary replaced the
 * console with "This screen could not be shown". The suites for both modules were
 * thorough about the repository and the refusals, and neither ever mounted the
 * component.
 *
 * `tsc` names this class of mistake in one line, and now runs again (see
 * `tsconfig.json`, where an invalid `ignoreDeprecations` value had been aborting it
 * before it checked a single file). This file is the belt to that braces: for a
 * screen an office opens daily, "it renders" is worth one cheap assertion that does
 * not depend on the typechecker being wired up correctly on the day.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { CreditScreen } from '@/modules/credit/CreditScreen';
import { renderWithProviders, signInAs, signOut } from './render';

const ACCOUNTANT = 'accountant@galabodatea.lk';

beforeEach(() => {
  signOut();
});

describe('the credit queue', () => {
  it('renders its filters and its rows', async () => {
    await signInAs(ACCOUNTANT);

    renderWithProviders(
      <Routes>
        <Route path="/credit" element={<CreditScreen />} />
      </Routes>,
      { route: '/credit' },
    );

    // The over-ceiling filter is the part that was crashing: a `Label` wrapping a
    // `Checkbox`, neither of them imported.
    expect(await screen.findByRole('checkbox')).toBeInTheDocument();
    // Awaited too: the grid shows a skeleton until the first page lands.
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
