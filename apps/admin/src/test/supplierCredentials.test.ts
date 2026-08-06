/**
 * §21.15 and §21.16, as the factory answered them.
 *
 * *Generate a random password and hand it over at the counter.* Right for this factory — but
 * it means **the office learns the password**, and every test here is about one of the three
 * rules that turn that from an account-takeover path into a safe flow: the credential is
 * one-time, the identity check is recorded, and existing sessions end.
 *
 * The one worth reading first is the last: the password is in the response and **nowhere
 * else** — not in the supplier record, not in the audit entry. An audit trail carrying
 * passwords would be a list of live logins.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  IDENTITY_CHECK_MIN,
  SUPPLIER_PASSWORD_ALPHABET,
  SUPPLIER_PASSWORD_LENGTH,
  formatSupplierPassword,
  identityCheckProblem,
  isWellFormedSupplierPassword,
} from '@tfd/domain';
import { supplierRepository } from '@/services/repositories/supplierRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { isApiError } from '@/services/api/errors';
import { signInAs, signInWithMfaAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';
const MANAGER = 'manager@galabodatea.lk';
const WEIGHER = 'weigher@galabodatea.lk';
const CHECK = 'Came to the counter with supplier book, recognised by the clerk';

describe('the password itself', () => {
  it('is drawn only from characters somebody can read off paper', () => {
    // No O/0, I/1/l, S/5 or B/8 — this is transcribed by hand and typed on a phone.
    for (const confusable of ['O', '0', 'I', '1', 'L', 'S', '5', 'B', '8', '2']) {
      expect(SUPPLIER_PASSWORD_ALPHABET.includes(confusable), confusable).toBe(false);
    }
    expect(SUPPLIER_PASSWORD_ALPHABET.length).toBeGreaterThan(20);
  });

  it('groups for transcription', () => {
    expect(formatSupplierPassword('K7M4XPQR3')).toBe('K7M-4XP-QR3');
    expect(isWellFormedSupplierPassword('K7M4XPQR3')).toBe(true);
    // Lower case, a confusable, and the wrong length are all refused.
    expect(isWellFormedSupplierPassword('k7m4xpqr3')).toBe(false);
    expect(isWellFormedSupplierPassword('K7M2XPQR3')).toBe(false);
    expect(isWellFormedSupplierPassword('K7M4XPQR')).toBe(false);
  });

  it('treats a non-answer as no identity check', () => {
    expect(identityCheckProblem('reset')).toBe('too-short');
    expect(identityCheckProblem('   ')).toBe('too-short');
    expect(identityCheckProblem(CHECK)).toBeNull();
  });
});

describe('issuing one against the mock API', () => {
  beforeEach(() => {
    signOut();
  });

  async function anySupplier() {
    const page = await supplierRepository.list({ status: 'active', pageSize: 5 });
    return page.items[0]!;
  }

  it('issues a well-formed password and marks it as owed', async () => {
    await signInAs(CLERK);
    const supplier = await anySupplier();

    const issued = await supplierRepository.resetCredentials(supplier.id, CHECK);

    expect(isWellFormedSupplierPassword(issued.password)).toBe(true);
    expect(issued.password).toHaveLength(SUPPLIER_PASSWORD_LENGTH);
    /**
     * **The rule that makes the whole flow safe.** The office knows this password, so it has
     * to die the moment the supplier uses it — the app forces a change while this is true.
     */
    expect(issued.owesPasswordChange).toBe(true);

    const detail = await supplierRepository.get(supplier.id);
    expect(detail.owesPasswordChange).toBe(true);
    expect(detail.lastPasswordResetAt).toBeTruthy();
  }, 20_000);

  it('never issues the same password twice', async () => {
    await signInAs(CLERK);
    const supplier = await anySupplier();

    const seen = new Set<string>();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      seen.add((await supplierRepository.resetCredentials(supplier.id, CHECK)).password);
    }
    // The rest of this fixture is seeded and deterministic. A credential must not be.
    expect(seen.size).toBe(5);
  }, 30_000);

  it('refuses without a real identity check, on the client and the server', async () => {
    await signInAs(CLERK);
    const supplier = await anySupplier();

    await expect(supplierRepository.resetCredentials(supplier.id, 'reset')).rejects.toMatchObject({
      code: 'note-required',
    });

    // And past the repository, the way a scripted client would arrive.
    const response = await fetch(
      `http://localhost/admin/suppliers/${supplier.id}/credentials/reset`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await import('@/auth/authStore')).useAuthStore.getState().accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'ok' }),
      },
    );
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ code: 'note-required', details: { min: IDENTITY_CHECK_MIN } });
  }, 20_000);

  /**
   * **The password is in the response and nowhere else.**
   *
   * Not on the supplier record and not in the audit entry — an audit trail that carried
   * credentials would be a list of live logins, readable by everyone who may read the log.
   */
  it('records the identity check and never the password (AC-09)', async () => {
    await signInAs(CLERK);
    const supplier = await anySupplier();
    const issued = await supplierRepository.resetCredentials(supplier.id, CHECK);

    // The clerk may issue a credential and not read the log (§12.1) — so the entry is read
    // by somebody who may, which is also how it would be read in practice.
    signOut();
    await signInWithMfaAs(MANAGER);
    const audit = await auditRepository.list({ entity: 'supplier', entityId: supplier.id });
    const entry = audit.items.find((one) => one.action === 'supplier.credentials.reset')!;

    expect(entry).toBeTruthy();
    expect(entry.id).toBe(issued.auditId);
    expect((entry.after as { reason: string }).reason).toBe(CHECK);

    // The password appears nowhere in the entry, however it were serialised.
    expect(JSON.stringify(entry)).not.toContain(issued.password);

    const detail = await supplierRepository.get(supplier.id);
    expect(JSON.stringify(detail)).not.toContain(issued.password);
  }, 20_000);

  it('refuses a supplier who has left', async () => {
    await signInAs(CLERK);
    const closed = (await supplierRepository.list({ status: 'closed', pageSize: 5 })).items[0];
    if (!closed) throw new Error('fixture has no closed supplier — this test would assert nothing');

    // Issuing a login to somebody who no longer supplies is issuing a way in.
    await expect(supplierRepository.resetCredentials(closed.id, CHECK)).rejects.toMatchObject({
      code: 'supplier-closed',
    });
  }, 20_000);

  it('refuses a role that may read the registry but not write it (§12.1)', async () => {
    await signInAs(WEIGHER);
    const supplier = await anySupplier();
    // The weigher holds `suppliers: read`. Issuing a credential is not a read.
    const refused = await supplierRepository
      .resetCredentials(supplier.id, CHECK)
      .catch((cause: unknown) => cause);
    expect(isApiError(refused) && refused.code).toBe('forbidden');
  }, 20_000);
});
