/**
 * The signed-in person's own screen: who the console thinks they are, and how they want
 * to read it.
 *
 * **Every other screen in this console is about the factory.** This is the only one about
 * the reader, and it is now the **only** place the language, the scheme and the text size
 * are changed — a menu is a fine shortcut for a setting somebody already knows about and a
 * poor place to discover that text size is adjustable at all, and two homes for one value
 * is two places to look when it is wrong.
 *
 * ## What is deliberately not here
 *
 * No password change and no two-factor enrolment. The auth surface is `login`,
 * `verifyMfa`, `refresh`, `logout` and `me` — there is no self-service endpoint for either,
 * and the supplier password reset in M2 is the office issuing a *supplier's* app password,
 * not a console user changing their own. A form posting to an endpoint that does not exist
 * would look like the feature until somebody needed it, so the security card states where
 * those changes actually happen instead.
 *
 * The **sign-in screen keeps its own language switcher**, and that is the one copy worth
 * having: somebody who cannot read the console changes the language before signing in,
 * which is also the moment they are most likely to be stuck. Once inside, this is it.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save, ShieldCheck, ShieldAlert } from 'lucide-react';
import { requiresMfa } from '@tfd/domain';
import { useCurrentUser } from '@/auth/authStore';
import { AppearanceControls } from '@/brand/AppearanceControls';
import { useAppearance } from '@/brand/useAppearance';
import type { Appearance } from '@/brand/appearance';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';
import { setLanguage } from '@/i18n';
import { isLanguageCode, type LanguageCode } from '@/i18n/languages';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { RevertButton } from '@/modules/configuration/StringListEditor';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime } from '@/lib/format';

/** A label above its value, the shape M2's supplier detail already reads in. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-xxs">
      <span className="text-caption text-text-secondary">{label}</span>
      <span className="text-body-small text-text-primary">{children}</span>
    </div>
  );
}

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const user = useCurrentUser();
  const { appearance, setScheme, setTextSize } = useAppearance();

  const savedLanguage: LanguageCode = isLanguageCode(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : 'en';

  /**
   * Drafted rather than applied on press, so all three land behind one confirmation —
   * the same draft-then-save shape every M14 section uses.
   *
   * The cost is real and worth naming: appearance and text size are judged by **looking**
   * at them, and a draft cannot be looked at. Somebody picking "Larger" sees nothing change
   * until they have confirmed, which is the opposite of how those two are normally chosen.
   */
  const [draftLanguage, setDraftLanguage] = useState<LanguageCode>(savedLanguage);
  const [draftAppearance, setDraftAppearance] = useState<Appearance>(appearance);
  const [confirming, setConfirming] = useState(false);

  // Re-seeded when the stored values move underneath — a second tab, or the sign-in
  // screen's switcher on the way in.
  useEffect(() => setDraftLanguage(savedLanguage), [savedLanguage]);
  useEffect(() => setDraftAppearance(appearance), [appearance]);

  const dirty =
    draftLanguage !== savedLanguage ||
    draftAppearance.scheme !== appearance.scheme ||
    draftAppearance.textSize !== appearance.textSize;

  function revert() {
    setDraftLanguage(savedLanguage);
    setDraftAppearance(appearance);
  }

  async function apply() {
    // Appearance first: the language swap re-renders every label, and applying it last
    // means the toast below is already written in the language that was chosen.
    if (draftAppearance.scheme !== appearance.scheme) setScheme(draftAppearance.scheme);
    if (draftAppearance.textSize !== appearance.textSize) setTextSize(draftAppearance.textSize);
    if (draftLanguage !== savedLanguage) await setLanguage(draftLanguage);

    setConfirming(false);
    toast.success(t('profile.saved'), t('profile.savedHint'));
  }

  /**
   * `RequireAuth` guarantees a user by the time this renders, so the guard is for the
   * type rather than for a state anybody reaches — and returning `null` beats a spinner
   * that would never resolve.
   */
  if (!user) return null;

  /**
   * The obligation, not merely the fact.
   *
   * Two-factor is mandatory for manager and above (§ Auth and roles), so "not set up"
   * means something different depending on the role: a clerk without it is fine, a manager
   * without it is a gap somebody has to close.
   *
   * **`requiresMfa`, not a list of the roles it does not apply to.** This read
   * `role !== 'clerk' && role !== 'weigher'`, which had already drifted — an editor holds
   * `content: W` and nothing else, and was being told it owed a second factor. Inverting a
   * membership test means every role added or removed has to be remembered in two places,
   * and `MFA_REQUIRED_ROLES` is the one that decides.
   */
  const mfaRequired = requiresMfa(user.roles);
  const mfaOwed = mfaRequired && !user.mfaEnrolled;

  return (
    <>
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />

      <div className="grid gap-lg lg:grid-cols-2">
        <Card>
          <CardHeader title={t('profile.youTitle')} description={t('profile.youDescription')} />
          <CardBody className="grid gap-md sm:grid-cols-2">
            <Fact label={t('profile.name')}>{user.name}</Fact>
            <Fact label={t('profile.email')}>{user.email}</Fact>

            <Fact label={t('profile.roles')}>
              {/* Every role, not the "highest": §12.1 grants are a union, and a person
                  holding two roles is doing two jobs rather than the senior one. */}
              <span className="flex flex-wrap gap-xxs">
                {user.roles.map((role) => (
                  <Badge key={role} tone="neutral">
                    {t(`users.role.${role}`)}
                  </Badge>
                ))}
              </span>
            </Fact>

            <Fact label={t('profile.lastSignIn')}>
              {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : t('profile.firstSignIn')}
            </Fact>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('profile.securityTitle')}
            description={t('profile.securityDescription')}
          />
          <CardBody className="flex flex-col gap-md">
            <div className="flex items-start gap-sm">
              {user.mfaEnrolled ? (
                <ShieldCheck className="mt-xxs size-icon-sm shrink-0 text-success" aria-hidden />
              ) : (
                <ShieldAlert
                  className={mfaOwed ? 'mt-xxs size-icon-sm shrink-0 text-warning' : 'mt-xxs size-icon-sm shrink-0 text-text-secondary'}
                  aria-hidden
                />
              )}
              <div className="flex flex-col gap-xxs">
                <span className="text-body-small text-text-primary">
                  {user.mfaEnrolled ? t('profile.mfaOn') : t('profile.mfaOff')}
                </span>
                <span className="text-caption text-text-secondary">
                  {mfaOwed ? t('profile.mfaOwed') : t('profile.mfaOptional')}
                </span>
              </div>
            </div>

            {/* Said rather than shown as a disabled form. There is no self-service endpoint
                for either of these, and a control that cannot work is worse than a sentence
                naming the person who can do it. */}
            <p className="border-t border-divider pt-md text-caption text-text-secondary">
              {t('profile.securityHint')}
            </p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title={t('profile.preferencesTitle')}
            description={t('profile.preferencesDescription')}
          />
          <CardBody className="flex flex-col gap-lg">
            <div className="flex flex-col gap-xs">
              <span className="text-label text-text-primary">{t('profile.language')}</span>
              <span className="text-caption text-text-secondary">{t('profile.languageHint')}</span>
              <LanguageSwitcher value={draftLanguage} onChange={setDraftLanguage} />
            </div>

            <div className="border-t border-divider pt-lg">
              <AppearanceControls value={draftAppearance} onChange={setDraftAppearance} />
            </div>

            {/* The honest scope of all three: this machine, not this account. They are in
                `localStorage` because they have to work on the sign-in screen, which has no
                session to read a preference from. */}
            <p className="border-t border-divider pt-md text-caption text-text-secondary">
              {t('profile.preferencesScope')}
            </p>

            <div className="flex flex-wrap items-center gap-sm border-t border-divider pt-md">
              <Button
                variant="primary"
                disabled={!dirty}
                iconLeft={<Save className="size-icon-sm" aria-hidden />}
                onClick={() => setConfirming(true)}
              >
                {t('profile.save')}
              </Button>
              <RevertButton onRevert={revert} disabled={!dirty} />
              <p className="text-caption text-text-secondary">
                {dirty ? t('profile.unsavedHint') : t('profile.nothingToSave')}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/*
        * The confirmation these three now sit behind.
        *
        * Nothing here is destructive and all of it is one click to undo, so this is a
        * consistency decision rather than a safety one: every other settings surface in the
        * console drafts, saves and confirms, and one that applied on press would be the
        * exception a reader has to learn.
        */}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t('profile.confirmTitle')}
        description={t('profile.confirmBody')}
        confirmLabel={t('profile.save')}
        confirmVariant="primary"
        onConfirm={() => void apply()}
      />
    </>
  );
}
