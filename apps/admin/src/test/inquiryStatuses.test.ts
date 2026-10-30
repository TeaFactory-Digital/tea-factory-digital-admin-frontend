/**
 * The two inquiry states added on 30 October 2026 (§21.18): escalated to the manager, and
 * waiting for the supplier's answer. Both are still open; only open and escalated count
 * against the two-day target.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  QUEUE_SLA_HOURS,
  inquiryAwaitsSupplier,
  inquiryCountsTowardsSla,
  inquiryStatusForApp,
  isInquiryClosed,
} from '@tfd/domain';
import { inquiryRepository } from '@/services/repositories/inquiryRepository';
import { signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const REPLY = 'Please send a photo of the slip for the 14th, and we will check the weight.';

beforeEach(() => signOut());

describe('the rules', () => {
  it('keeps both new states open, and the app reads them as waiting', () => {
    for (const status of ['open', 'escalated', 'awaitingSupplier'] as const) {
      expect(isInquiryClosed(status)).toBe(false);
      expect(inquiryStatusForApp(status)).toBe('pending');
    }
    expect(inquiryStatusForApp('resolved')).toBe('approved');
    expect(inquiryStatusForApp('closed')).toBe('rejected');
  });

  it('counts the office keeping the supplier waiting, not the other way round', () => {
    expect(inquiryCountsTowardsSla('open')).toBe(true);
    expect(inquiryCountsTowardsSla('escalated')).toBe(true);
    expect(inquiryCountsTowardsSla('awaitingSupplier')).toBe(false);
    expect(inquiryAwaitsSupplier('awaitingSupplier')).toBe(true);
    // Two days, the factory's answer.
    expect(QUEUE_SLA_HOURS.inquiries).toBe(48);
    expect(QUEUE_SLA_HOURS.advanceRequests).toBe(24);
  });
});

describe('the office', () => {
  it('passes a message to the manager with a reason, and it stays answerable', async () => {
    await signInAs(CLERK);
    await expect(inquiryRepository.escalate('inq-1', { note: 'short' })).rejects.toMatchObject({ code: 'note-required' });
    const ack = await inquiryRepository.escalate('inq-1', { note: 'The weight dispute needs the manager to check.' });
    expect(ack.status).toBe('escalated');
    const after = await inquiryRepository.get('inq-1');
    expect(after).toMatchObject({ status: 'escalated', escalationNote: 'The weight dispute needs the manager to check.' });
    // Still open: it can be answered.
    expect((await inquiryRepository.reply('inq-1', { body: REPLY })).status).toBe('resolved');
  });

  it('asks the supplier something and waits for the answer', async () => {
    await signInAs(CLERK);
    const ack = await inquiryRepository.reply('inq-1', { body: REPLY, awaitSupplier: true });
    expect(ack.status).toBe('awaitingSupplier');
    expect((await inquiryRepository.get('inq-1')).status).toBe('awaitingSupplier');
  });
});
