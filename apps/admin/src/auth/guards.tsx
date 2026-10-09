/**
 * Route guards.
 *
 * Both of these are **courtesies**. Permissions are enforced server-side per
 * endpoint (admin-console.md → Auth and roles), and a guard that were the only
 * check would be bypassed by anyone who can edit JavaScript. What they buy is a
 * clerk not being shown a screen whose every request will 403.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { AccessLevel, Capability } from '@tfd/domain';
import type { PropsWithChildren } from 'react';
import { useAuthStatus, useCan, useOwesPasswordChange } from './authStore';
import { InitialPasswordScreen } from './InitialPasswordScreen';
import { Spinner } from '@/components/ui/states';
import { EmptyState } from '@/components/ui/states';
import { useFeatureFlags, useKeepsFactoryRecords } from '@/config/RuntimeConfigProvider';
import type { FeatureFlagName } from '@tfd/domain';

/** Signed in, or sent to the sign-in screen with somewhere to come back to. */
export function RequireAuth({ children }: PropsWithChildren) {
  const status = useAuthStatus();
  const owesPasswordChange = useOwesPasswordChange();
  const location = useLocation();

  // `bootstrapping` is not `anonymous`. Redirecting during the refresh round trip
  // would bounce every reload through the login screen.
  if (status === 'bootstrapping') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (status !== 'authenticated') {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  /*
   * BR-008, and it sits INSIDE the authenticated branch deliberately.
   *
   * Owing a password change is a signed-in state, not a refused one: the API issues a
   * token and then blocks every path except the handful that clear the flag. Treating it
   * as "not authenticated" would bounce the clerk to sign-in, where the only thing they
   * can do is present the same password again and arrive back here.
   *
   * Rendered in place rather than redirected to a route, so there is no URL a clerk can
   * navigate away from and no console behind it to glimpse. Every screen behind this
   * would be a spinner over a refusal.
   */
  if (owesPasswordChange) {
    return <InitialPasswordScreen />;
  }

  return <>{children}</>;
}

/**
 * Capability gate.
 *
 * Renders an explanation rather than redirecting. A clerk who followed a link
 * from an email should be told their role does not allow it, not silently
 * returned to the dashboard wondering whether the link was broken.
 */
export function RequireCapability({
  capability,
  level = 'read',
  children,
}: PropsWithChildren<{ capability: Capability; level?: Exclude<AccessLevel, 'none'> }>) {
  const { t } = useTranslation();
  const allowed = useCan(capability, level);

  if (!allowed) {
    return <EmptyState title={t('error.forbidden')} />;
  }
  return <>{children}</>;
}

/**
 * Feature-flag gate.
 *
 * A flag turns a surface off end to end. This is the console half; the API
 * answers `403 feature-disabled` for the same call (AC-07), so a bookmarked URL
 * fails the same way whichever layer catches it first.
 */
export function RequireFlag({ flag, children }: PropsWithChildren<{ flag: FeatureFlagName }>) {
  const { t } = useTranslation();
  const flags = useFeatureFlags();

  if (!flags[flag]) {
    return <EmptyState title={t('error.featureDisabled')} />;
  }
  return <>{children}</>;
}

/**
 * Open when **any** of the flags is on.
 *
 * For M7, which is one screen over three independently-sold facilities. A factory
 * that lends against leaf but not against income history must still reach the
 * credit queue — and `RequireFlag` on `enableAdvances` would have shut the door on
 * the factory that does it the other way round. The rows themselves are filtered
 * per facility by the API (AC-07), so opening the screen never leaks a facility
 * that is off.
 */
export function RequireAnyFlag({
  flags: needed,
  children,
}: PropsWithChildren<{ flags: FeatureFlagName[] }>) {
  const { t } = useTranslation();
  const flags = useFeatureFlags();

  if (!needed.some((flag) => flags[flag])) {
    return <EmptyState title={t('error.featureDisabled')} />;
  }
  return <>{children}</>;
}

/**
 * Open only while the factory-system sync is off.
 *
 * With the sync on, these records come from the factory's own system and an entry screen
 * here would be a second source for the same weighing or bill. A bookmarked URL is told
 * why rather than shown a form whose saves the API would refuse.
 */
export function RequireFactoryRecords({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  if (!useKeepsFactoryRecords()) {
    return (
      <EmptyState title={t('records.syncOnTitle')} body={t('records.syncOnBody')} />
    );
  }
  return <>{children}</>;
}
