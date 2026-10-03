/**
 * BR-008 for the office, and **the reload that would otherwise lock somebody out.**
 *
 * The factory settled that the office sets a console user's first password rather than an
 * invitation email going out, so a new account's credential is the one case BR-008 exists
 * for: a password its holder did not choose and may never change.
 *
 * The API issues a session and then refuses every path except the handful that clear the
 * flag. That makes the state *signed in with one screen available*, not *refused*, and
 * the three cases below are the ones where getting that wrong costs somebody their
 * morning.
 *
 * ## The gap this suite is really guarding
 *
 * `POST /admin/auth/refresh` does **not** report the flag, checked against staging rather
 * than assumed. The console bootstraps from a rotation on every page load, so a clerk who
 * reloads while owing a change comes back with the flag lost: the console would let them
 * in and the API would then refuse everything, with nothing on screen saying why.
 *
 * `noteOwesPasswordChange`, driven from the transport whenever a response carries
 * `password-change-required`, is what turns that dead end back into the screen that
 * resolves it. The last test is that recovery, and it should outlive the gap: if the
 * backend starts reporting the flag on refresh, this still passes and simply stops being
 * the only thing standing between a clerk and a locked console.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/auth/authStore';
import { setOwesPasswordChange } from '@/services/mocks/handlers';
import { apiClient } from '@/services/api/client';
import { isApiError } from '@/services/api/errors';
import { signInAs, signOut } from './render';

const CLERK = 'clerk@galabodatea.lk';

beforeEach(() => {
  // `signOut` is synchronous: it clears the store rather than calling the API.
  signOut();
});

describe('BR-008 for a console user', () => {
  it('signs in and raises the flag rather than refusing', async () => {
    setOwesPasswordChange(CLERK, true);

    await signInAs(CLERK);

    /**
     * **Authenticated, not anonymous.** Treating this as a refusal would bounce the clerk
     * to sign-in, where the only thing they can do is present the same password again and
     * arrive straight back here.
     */
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().owesPasswordChange).toBe(true);
  });

  it('leaves the flag down for an account that does not owe one', async () => {
    await signInAs(CLERK);

    expect(useAuthStore.getState().owesPasswordChange).toBe(false);
  });

  it('drops the flag with the session on sign-out', async () => {
    setOwesPasswordChange(CLERK, true);
    await signInAs(CLERK);
    expect(useAuthStore.getState().owesPasswordChange).toBe(true);

    signOut();

    /**
     * The flag belongs to the account somebody was signed in as. Left raised it would
     * greet the next person at a shared office machine with a password screen for an
     * account they are not using.
     */
    expect(useAuthStore.getState().owesPasswordChange).toBe(false);
  });

  it('recovers the flag from a refusal when the session was restored without it', async () => {
    await signInAs(CLERK);
    // The post-reload state: a rotation restored the session and told us nothing about
    // BR-008, because the API does not put it on the refresh response.
    expect(useAuthStore.getState().owesPasswordChange).toBe(false);

    const refused = await apiClient
      .get('/admin/__password-change-probe')
      .catch((cause: unknown) => cause);

    expect(isApiError(refused) && refused.code).toBe('password-change-required');
    /**
     * **The recovery.** Without this the console is signed in, shows a dashboard, and
     * every panel on it fails with a refusal nobody has translated into an instruction.
     */
    expect(useAuthStore.getState().owesPasswordChange).toBe(true);
  });
});
