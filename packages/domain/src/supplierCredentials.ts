/**
 * A supplier's app password — **§21.15 and §21.16, as the factory answered them.**
 *
 * *The password is generated at random and handed to the supplier by the office. If they
 * ask for a reset, the console offers to generate a new one.*
 *
 * That is the right flow for this factory and the alternatives are worse: about a fifth of
 * suppliers have no email, there is no SMS gateway, and the office knows these people by
 * face — a counter handover with the supplier's own book is stronger identity proof than an
 * OTP. But it has one dangerous property, and everything here exists because of it:
 *
 * > **The office knows the password.** Whoever generated it can sign in as that supplier —
 * > read their bills and bank details, and raise a change request *as them*. A bank-details
 * > change approved later would be indistinguishable from the real supplier asking.
 *
 * Three rules turn that from an account-takeover path into a safe flow:
 *
 *  1. **The password is one-time.** `owesPasswordChange` is set the moment it is issued, and
 *     the app must force a change at first sign-in. The credential the office knows is dead
 *     the moment the supplier uses it. **This is the load-bearing one** — without it, every
 *     password the office ever issued stays valid for ever.
 *  2. **How identity was checked is recorded**, mandatory and audited. "A supplier asked for
 *     a reset" is fine at the counter and dangerous on the telephone, where anyone who knows
 *     a supplier code can ring up.
 *  3. **Existing sessions end.** Otherwise a reset does not lock out whoever had the
 *     account, which is the only reason to reset it.
 *
 * **Generation is the server's, never the console's.** A client that minted credentials
 * would be a client whose randomness and whose rules nobody can audit — so this file holds
 * the *shape* and the API holds the generator.
 */

/**
 * The alphabet a password is drawn from.
 *
 * No `O/0`, `I/1/l`, `S/5` or `B/8`: this is read off a slip of paper by somebody typing on
 * a phone keypad, and a character they cannot distinguish is a support call — or worse, a
 * supplier who concludes the app is broken and stops using it. Upper case only for the same
 * reason, since case is invisible when a clerk writes it by hand.
 */
export const SUPPLIER_PASSWORD_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';

/** Nine characters, shown as three groups. ~41 bits — a one-time credential, not a secret. */
export const SUPPLIER_PASSWORD_LENGTH = 9;

/** `K7M2XPQR4` → `K7M-2XP-QR4`. Grouping is what makes it transcribable without errors. */
export function formatSupplierPassword(raw: string): string {
  return (raw.match(/.{1,3}/g) ?? [raw]).join('-');
}

export function isWellFormedSupplierPassword(raw: string): boolean {
  return (
    raw.length === SUPPLIER_PASSWORD_LENGTH &&
    [...raw].every((character) => SUPPLIER_PASSWORD_ALPHABET.includes(character))
  );
}

/** Recording *how the office knew it was them* is the whole of rule 2. */
export const IDENTITY_CHECK_MIN = 15;

export function identityCheckProblem(reason: string): 'too-short' | null {
  return reason.trim().length < IDENTITY_CHECK_MIN ? 'too-short' : null;
}

/**
 * What a reset answers with — **once**.
 *
 * The password is in this payload and nowhere else: not stored in a readable form, not
 * re-fetchable, not in a list. A clerk who closes the dialog generates another one, which is
 * correct and which the screen has to say plainly before they close it.
 *
 * `auditId` comes back for the same reason M2's bank reveal returns one: it is the
 * difference between "we log this" as a policy statement and as something the person doing
 * it can see happening.
 */
export interface SupplierCredentialReset {
  supplierId: string;
  supplierCode: string;
  /** Plain text, this once. Show it, do not persist it, do not log it. */
  password: string;
  /** Always `true` on a fresh issue — the app must force a change at first sign-in. */
  owesPasswordChange: boolean;
  issuedAt: string;
  issuedByName: string;
  /** Sessions the reset ended. `0` means the supplier was not signed in anywhere. */
  sessionsEnded: number;
  auditId: string;
}
