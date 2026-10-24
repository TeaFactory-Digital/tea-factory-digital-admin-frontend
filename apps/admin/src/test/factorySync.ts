/**
 * Switch the factory-system sync for a test, in both copies: the API's, and the bundled one
 * the screens fall back to under jsdom. Off is the default (a factory with no setting keeps
 * its records here), so a test of a **synced** factory says so with `setFactorySync(true)`.
 * Leaves the factory administrator signed in.
 */

import { bundledConfig } from '@/config/defaults';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { signInAs } from './render';

export async function setFactorySync(enabled: boolean): Promise<void> {
  bundledConfig.factorySync = { enabled };
  await signInAs('factoryadmin@galabodatea.lk');
  const { config, usage } = await adminConfigRepository.get();
  await adminConfigRepository.patch({ factorySync: { enabled } }, config, usage);
}

/** Put the bundled copy back; the API's is reset with the mock state. */
export function clearFactorySync(): void {
  delete bundledConfig.factorySync;
}
