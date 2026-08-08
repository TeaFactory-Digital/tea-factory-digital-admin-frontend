/**
 * M9's fourth request type — **an address change**, against the mock API.
 *
 * It corrects an asymmetry rather than adding a feature. Bank details, the payment
 * method and the savings rate have always come through this queue because they decide
 * where money goes; an address decided nothing visible, so the app's `PATCH /profile`
 * wrote it straight to the record and **the office never heard about it**.
 *
 * That is wrong twice over. The estate address is *where the leaf comes from* — it ties
 * a supplier to a collection point and to land — and the home address is where every
 * printed Green Leaf Account is posted. A wrong one is a slip delivered nowhere.
 *
 * The case that carries the most here is `leaves the untouched field alone`: a request
 * that changes only the home address must not blank the estate address, and a handler
 * spreading the whole `requestedAddress` block would do exactly that.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { changeRequestRepository } from '@/services/repositories/changeRequestRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { isApiError } from '@/services/api/errors';
import { signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

/** The seeded address request. See `seed.ts` for why it is appended rather than rotated. */
const ADDRESS_REQUEST = 'chg-15';
const NOTE = 'Verified against the electricity bill brought to the office.';

describe('M9 · an address change is a request, not a save', () => {
  beforeEach(() => {
    signOut();
  });

  it('sits in the queue like any other type', async () => {
    await signInAs(CLERK);
    const request = await changeRequestRepository.get(ADDRESS_REQUEST);

    expect(request.type).toBe('address');
    expect(request.status).toBe('pending');
    // Raised in the app, which is the whole point — this is a supplier telling the
    // office something rather than the office recording it.
    expect(request.channel).toBe('app');
    expect(request.requestedAddress?.homeAddress).toBeTruthy();
  });

  it('is filterable, so the office can work one kind at a time', async () => {
    await signInAs(CLERK);
    const page = await changeRequestRepository.list({ type: 'address', pageSize: 25 });

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((one) => one.type === 'address')).toBe(true);
  });

  it('leaves the supplier’s record untouched while it is pending (AC-02)', async () => {
    await signInAs(CLERK);
    const request = await changeRequestRepository.get(ADDRESS_REQUEST);
    const before = await supplierRepository.get(request.supplierId);

    // The app shows the supplier their **active** address for the same reason. A
    // record that moved on submission would tell them the change had happened.
    expect(before.homeAddress).not.toBe(request.requestedAddress?.homeAddress);
  });

  it('applies the address on approval (AC-02)', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await changeRequestRepository.get(ADDRESS_REQUEST);

    await changeRequestRepository.approve(ADDRESS_REQUEST, { note: NOTE });

    const after = await supplierRepository.get(request.supplierId);
    expect(after.homeAddress).toBe(request.requestedAddress!.homeAddress);
  });

  it('leaves the untouched field alone — the case a block-spread would break', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await changeRequestRepository.get(ADDRESS_REQUEST);
    const before = await supplierRepository.get(request.supplierId);

    /**
     * The seeded request changes the **home** address only, which is a normal thing to
     * ask for — people move house without their land moving. Applying
     * `{ ...supplier, ...requestedAddress }` would set `estateAddress` to `undefined`
     * and orphan the leaf filed against it.
     */
    expect(request.requestedAddress?.estateAddress).toBeUndefined();
    expect(before.estateAddress).toBeTruthy();

    await changeRequestRepository.approve(ADDRESS_REQUEST, { note: NOTE });

    const after = await supplierRepository.get(request.supplierId);
    expect(after.estateAddress).toBe(before.estateAddress);
  });

  it('leaves the record untouched on rejection (AC-02’s other half)', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await changeRequestRepository.get(ADDRESS_REQUEST);
    const before = await supplierRepository.get(request.supplierId);

    await changeRequestRepository.reject(ADDRESS_REQUEST, {
      note: 'The address given does not match the division on the supplier code.',
    });

    const after = await supplierRepository.get(request.supplierId);
    expect(after.homeAddress).toBe(before.homeAddress);
    expect(after.estateAddress).toBe(before.estateAddress);
  });

  it('refuses a decision without a note, like every other type (AC-06)', async () => {
    await signInWithMfaAs(MANAGER);
    const refused = await changeRequestRepository
      .approve(ADDRESS_REQUEST, { note: 'ok' })
      .catch((cause: unknown) => cause);

    expect(isApiError(refused) && refused.code).toBe('note-required');
  });

  it('drops the supplier’s pending count when it is decided', async () => {
    await signInWithMfaAs(MANAGER);
    const request = await changeRequestRepository.get(ADDRESS_REQUEST);
    const before = await supplierRepository.get(request.supplierId);

    await changeRequestRepository.approve(ADDRESS_REQUEST, { note: NOTE });

    const after = await supplierRepository.get(request.supplierId);
    expect(after.pendingRequests).toBe(Math.max(0, before.pendingRequests - 1));
  });
});
