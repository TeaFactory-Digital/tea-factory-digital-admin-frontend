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
 * ## The reload, which used to be the hole
 *
 * The console bootstraps from a rotation on every page load, and `POST /admin/auth/refresh`
 * did not report the flag. A clerk who reloaded while owing a change came back without it:
 * the console let them in and the API then refused everything, with nothing on screen
 * saying why. That was G-33, and the API reports it on refresh now.
 *
 * **Both halves are tested, and the second is deliberately kept.** The rotation carrying
 * the flag is the design; `noteOwesPasswordChange`, driven from the transport whenever any
 * response carries `password-change-required`, is the belt. A recovery that only works
 * while the primary path is broken is a recovery nobody notices has rotted, so it is
 * driven from a refusal directly rather than from a reload.
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

  it('carries the flag through a rotation, so a reload does not lose it', async () => {
    setOwesPasswordChange(CLERK, true);
    await signInAs(CLERK);
    expect(useAuthStore.getState().owesPasswordChange).toBe(true);

    // What a page reload does: the access token is gone and the session is rebuilt from
    // the refresh cookie alone.
    await useAuthStore.getState().bootstrap();

    /**
     * **G-33.** While the rotation dropped the flag, this came back `false`: the console
     * rendered a dashboard and the API refused every panel on it.
     */
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().owesPasswordChange).toBe(true);
  });

  it('still recovers the flag from a refusal, as a belt', async () => {
    await signInAs(CLERK);
    expect(useAuthStore.getState().owesPasswordChange).toBe(false);

    const refused = await apiClient
      .get('/admin/__password-change-probe')
      .catch((cause: unknown) => cause);

    expect(isApiError(refused) && refused.code).toBe('password-change-required');
    /**
     * Driven from a refusal rather than from a reload **on purpose**. The rotation
     * carries the flag now, so a reload-shaped test would pass through the primary path
     * and prove nothing about this one, and the belt would rot unnoticed.
     */
    expect(useAuthStore.getState().owesPasswordChange).toBe(true);
  });
});
