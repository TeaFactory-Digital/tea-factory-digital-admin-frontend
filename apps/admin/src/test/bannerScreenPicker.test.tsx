/**
 * The banner's "App screen" is chosen from the app's own screens, and "News" can point
 * at one published article (`news/<id>`), so a banner cannot be given a path the app
 * will not open.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { BannerAction } from '@tfd/domain';
import { BannerActionField } from '@/modules/banners/BannerActionField';
import { newsRepository } from '@/services/repositories/contentRepository';
import { renderWithProviders, signInAs, signOut } from './render';

describe('the banner screen picker', () => {
  beforeEach(async () => {
    signOut();
    await signInAs('factoryadmin@galabodatea.lk');
  });

  it('offers the app’s screens and saves the chosen one as the path', async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <BannerActionField value={{ type: 'screen', path: '' }} onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole('combobox', { name: 'App screen' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Savings' }));
    expect(onChange).toHaveBeenCalledWith({ type: 'screen', path: 'savings' });
  });

  it('lets News point at one published article', async () => {
    const published = (await newsRepository.list({ status: 'published', pageSize: 5 })).items[0]!;
    const onChange = vi.fn();
    const value: BannerAction = { type: 'screen', path: 'news' };
    renderWithProviders(<BannerActionField value={value} onChange={onChange} />);

    await userEvent.click(await screen.findByRole('combobox', { name: /Article/ }));
    await userEvent.click(await screen.findByRole('option', { name: published.title }));
    expect(onChange).toHaveBeenCalledWith({ type: 'screen', path: `news/${published.id}` });
  });

  it('keeps an older typed path that is not in the list', () => {
    renderWithProviders(
      <BannerActionField value={{ type: 'screen', path: 'bill/2026-07' }} onChange={() => {}} />,
    );
    expect(screen.getByRole('combobox', { name: 'App screen' })).toHaveTextContent(
      'Other: bill/2026-07',
    );
  });
});
