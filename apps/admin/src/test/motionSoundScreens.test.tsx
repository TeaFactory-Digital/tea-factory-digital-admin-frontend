/**
 * Interface sounds and movement on the screens that have them (26 November 2026): the
 * segmented control, the reply box and conversation, and deciding several requests at once.
 *
 * Each case checks the rule that matters for that place: one sound per action, a sound only
 * for the person's own click or key, and movement only for what is new.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Segmented } from '@/components/ui/Segmented';
import { EmptyState } from '@/components/ui/states';
import { BulkBar, BulkDecisionDialog } from '@/components/BulkDecision';
import { InquiryDetailScreen } from '@/modules/inquiries/InquiryDetailScreen';
import { inquiryRepository } from '@/services/repositories/inquiryRepository';
import { sounds } from '@/lib/sound/engine';
import { setUiSound } from '@/lib/sound/uiSound';
import { en } from '@/i18n/locales/en';
import { installLocalStorage } from './localStorage';
import { renderWithProviders, signInAs, signOut } from './render';

beforeEach(() => {
  installLocalStorage();
  setUiSound(true);
});

afterEach(() => {
  setUiSound(false);
  vi.restoreAllMocks();
});

/** Every sound replaced by a spy, so a case can count exactly which ones played. */
function spySounds() {
  return Object.fromEntries(
    (Object.keys(sounds) as Array<keyof typeof sounds>).map((id) => [
      id,
      vi.spyOn(sounds, id).mockImplementation(() => {}),
    ]),
  ) as Record<keyof typeof sounds, ReturnType<typeof vi.fn>>;
}

describe('the segmented control', () => {
  function Range() {
    const [value, setValue] = useState<'6' | '12'>('6');
    return (
      <Segmented
        label="Range"
        value={value}
        onValueChange={setValue}
        options={[
          { value: '6', label: '6 months' },
          { value: '12', label: '12 months' },
        ]}
      />
    );
  }

  it('slides a pill behind the choice and plays toggle once per change, by click or arrow', async () => {
    const user = userEvent.setup();
    const played = spySounds();
    renderWithProviders(<Range />);
    const group = screen.getByRole('radiogroup', { name: 'Range' });
    expect(group.querySelector('span[aria-hidden]:not([hidden])')).not.toBeNull();

    await user.click(within(group).getByRole('radio', { name: '12 months' }));
    expect(within(group).getByRole('radio', { name: '12 months' })).toHaveAttribute('aria-checked', 'true');
    expect(played.toggle).toHaveBeenCalledTimes(1);

    // The chosen one again changes nothing, so it says nothing.
    await user.click(within(group).getByRole('radio', { name: '12 months' }));
    expect(played.toggle).toHaveBeenCalledTimes(1);

    await user.keyboard('{ArrowLeft}');
    expect(within(group).getByRole('radio', { name: '6 months' })).toHaveAttribute('aria-checked', 'true');
    expect(played.toggle).toHaveBeenCalledTimes(2);
  });
});

describe('the reply box and the conversation', () => {
  const REPLY =
    'We checked the 12th and found a second weighing of 96 kg that had not been entered. It is on your account now.';

  async function openInquiry() {
    signOut();
    await signInAs('clerk@galabodatea.lk');
    const inquiry = await inquiryRepository.get('inq-1');
    renderWithProviders(
      <Routes>
        <Route path="/inquiries/:id" element={<InquiryDetailScreen />} />
      </Routes>,
      { route: '/inquiries/inq-1' },
    );
    await screen.findByText(inquiry.message);
    return inquiry;
  }

  it('plays insert when a suggestion goes in, and nothing when it comes out', async () => {
    const user = userEvent.setup();
    const played = spySounds();
    await openInquiry();
    const chip = screen.getByRole('button', { name: en['inquiries.suggest.checking'] });

    await user.click(chip);
    expect(played.insert).toHaveBeenCalledTimes(1);
    await user.click(chip);
    expect(played.insert).toHaveBeenCalledTimes(1);
  });

  it('plays sent once the reply has gone, and only the new bubble rises in', async () => {
    const user = userEvent.setup();
    const played = spySounds();
    const inquiry = await openInquiry();

    await user.type(screen.getByRole('textbox', { name: /your answer/i }), REPLY);
    await user.click(screen.getByRole('button', { name: /send reply/i }));

    await waitFor(() => expect(played.sent).toHaveBeenCalledTimes(1));
    const reply = await screen.findByText(REPLY, { selector: 'li p' });
    expect(reply.closest('li')).toHaveClass('tfd-bubble-in');
    // The message the thread opened on stays where it was.
    expect(screen.getByText(inquiry.message).closest('li')).not.toHaveClass('tfd-bubble-in');
  });
});

describe('deciding several at once', () => {
  it('plays open from the bar that opens the dialog', async () => {
    const user = userEvent.setup();
    const played = spySounds();
    const onApprove = vi.fn();
    renderWithProviders(<BulkBar count={2} onApprove={onApprove} onReject={() => {}} onClear={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Approve selected' }));
    expect(played.open).toHaveBeenCalledTimes(1);
    expect(onApprove).toHaveBeenCalled();
  });

  it('plays confirm on the decision, then counts the items through as they go', async () => {
    const user = userEvent.setup();
    const played = spySounds();
    let release: () => void = () => {};
    const decide = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));

    renderWithProviders(
      <BulkDecisionDialog
        verb="approve"
        items={[
          { id: 'a', label: '5708 Saman Kumara' },
          { id: 'b', label: '5711 Nimal Perera' },
        ]}
        noteList="credit.approve"
        builtIn={[]}
        decide={decide}
        onClose={() => {}}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: /note/i }), 'Checked against the ledger.');
    await user.click(screen.getByRole('button', { name: 'Approve 2' }));
    expect(played.confirm).toHaveBeenCalledTimes(1);

    // The first went through; the second is still out.
    expect(await screen.findByText('Deciding 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');

    release();
    await waitFor(() => expect(screen.queryByText(/^Deciding/)).not.toBeInTheDocument());
    expect(played.confirm).toHaveBeenCalledTimes(1);
  });
});

describe('an empty list', () => {
  it('says what kind of empty it is: a clear queue gets the tick, a search does not', () => {
    const { container, rerender } = renderWithProviders(<EmptyState kind="clear" title="Nothing waiting" />);
    expect(screen.getByText('Nothing waiting')).toBeInTheDocument();
    // The picture is decoration: hidden from assistive technology, the title is what is read.
    const picture = container.querySelector('.tfd-empty [aria-hidden]')!;
    expect(picture).not.toBeNull();
    expect(picture.querySelector('.tfd-empty-pop')).not.toBeNull();
    // Every stroke normalised to length 1, so short and long lines draw in together.
    const strokes = picture.querySelectorAll('.tfd-empty-draw svg *');
    expect(strokes.length).toBeGreaterThan(0);
    strokes.forEach((stroke) => expect(stroke).toHaveAttribute('pathLength', '1'));

    rerender(<EmptyState kind="search" title="Nothing to show" />);
    expect(container.querySelector('.tfd-empty-pop')).toBeNull();
  });
});
