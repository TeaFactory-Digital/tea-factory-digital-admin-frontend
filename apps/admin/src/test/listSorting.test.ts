/**
 * Sorting is **server-side**, and this is where that claim is checked.
 *
 * It matters more than it looks: the grids are server-paged, so a sort the client
 * applied would sort the fifty rows it happens to be holding. A clerk sorting 84
 * suppliers by code would see 5301 at the top of page 2 and reasonably conclude
 * the console is lying to them (admin-console.md §18.2).
 *
 * The tests go through the repositories rather than the screens: what is under
 * test is the request the console sends and the order the API answers with, and a
 * rendered grid would only add a way for the assertion to be about the DOM.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { auditRepository } from '@/services/repositories/auditRepository';
import { changeRequestRepository } from '@/services/repositories/changeRequestRepository';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';

const codes = (rows: { supplierCode: string }[]) => rows.map((r) => r.supplierCode);

describe('server-side sorting', () => {
  beforeEach(() => {
    signOut();
  });

  it('sorts the supplier registry by code, both ways', async () => {
    await signInAs(CLERK);

    const asc = await supplierRepository.list({ page: 0, pageSize: 50, sort: 'supplierCode', dir: 'asc' });
    const desc = await supplierRepository.list({ page: 0, pageSize: 50, sort: 'supplierCode', dir: 'desc' });

    expect(codes(asc.items)).toEqual([...codes(asc.items)].sort((a, b) => a.localeCompare(b)));
    expect(codes(desc.items)[0]).not.toBe(codes(asc.items)[0]);
    // The two ends of the same list: descending starts where ascending finishes.
    expect(codes(desc.items)[0]).toBe(
      [...codes(asc.items), ...codes(desc.items)].sort((a, b) => b.localeCompare(a))[0],
    );
  });

  it('sorts across pages, not within one', async () => {
    await signInAs(CLERK);

    const page1 = await supplierRepository.list({ page: 0, pageSize: 10, sort: 'supplierCode', dir: 'asc' });
    const page2 = await supplierRepository.list({ page: 1, pageSize: 10, sort: 'supplierCode', dir: 'asc' });

    // Every code on page 2 sorts after every code on page 1. This is the assertion
    // that fails if sorting ever moves back into the browser.
    const lastOfFirst = codes(page1.items).at(-1)!;
    expect(codes(page2.items).every((code) => code.localeCompare(lastOfFirst) > 0)).toBe(true);
  });

  it('keeps the change-request queue oldest-first when nothing is sorted', async () => {
    await signInAs(CLERK);

    const queue = await changeRequestRepository.list({ status: 'pending', page: 0, pageSize: 25 });
    const ages = queue.items.map((r) => r.ageHours);

    // Oldest first means the age counts down, never up.
    expect(ages).toEqual([...ages].sort((a, b) => b - a));
  });

  it('sorts the change-request queue by supplier code when asked', async () => {
    await signInAs(CLERK);

    const sorted = await changeRequestRepository.list({
      status: 'pending',
      page: 0,
      pageSize: 25,
      sort: 'supplierCode',
      dir: 'asc',
    });

    expect(codes(sorted.items)).toEqual([...codes(sorted.items)].sort((a, b) => a.localeCompare(b)));
  });

  it('reads the audit log newest-first by default and oldest-first on request', async () => {
    await signInWithMfaAs(MANAGER);

    // No `sort` at all: the repository's own default has to be newest-first, and
    // it has to arrive that way from the API rather than be re-sorted here.
    const fallback = await auditRepository.list({ page: 0, pageSize: 50 });
    const oldestFirst = await auditRepository.list({ page: 0, pageSize: 50, sort: 'at', dir: 'asc' });

    expect(fallback.items.length).toBeGreaterThan(1);
    expect(fallback.items.map((e) => e.at)).toEqual(
      [...fallback.items.map((e) => e.at)].sort((a, b) => b.localeCompare(a)),
    );
    expect(oldestFirst.items.map((e) => e.at)).toEqual(
      [...oldestFirst.items.map((e) => e.at)].sort((a, b) => a.localeCompare(b)),
    );
    // Same entries, opposite ends.
    expect(oldestFirst.items[0]!.id).toBe(fallback.items.at(-1)!.id);
  });
});
