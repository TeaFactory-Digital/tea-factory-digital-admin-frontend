/**
 * The signed-in person's own screen: who the console thinks they are, and how they want
 * to read it.
 *
 * **Every other screen in this console is about the factory.** This is the only one about
 * the reader, and it is now the **only** place the language, the scheme and the text size
 * are changed: a menu is a fine shortcut for a setting somebody already knows about and a
 * poor place to discover that text size is adjustable at all, and two homes for one value
 * is two places to look when it is wrong.
 *
 * ## What is deliberately not here
 *
 * No password change. The auth surface is `login`, `refresh`, `logout` and `me`; there is
 * no self-service endpoint for one, and the supplier password reset in M2 is the office
 * issuing a *supplier's* app password, not a console user changing their own. A form posting
 * to an endpoint that does not exist would look like the feature until somebody needed it.
 * The sentence that used to say where a password is changed was taken off the screen on
 * 26 November 2026, at the office's request; a factory administrator resets it from Users.
 *
 * There is no two-factor enrolment either, and now for a different reason: the factory has
 * withdrawn the requirement outright rather than left it unbuilt.
 *
 * The **sign-in screen keeps its own language switcher**, and that is the one copy worth
 * having: somebody who cannot read the console changes the language before signing in,
 * which is also the moment they are most likely to be stuck. Once inside, this is it.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
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
import { InfoTip } from '@/components/ui/Tooltip';
import { SettingRow } from '@/components/ui/SettingRow';
import { cn } from '@/lib/cn';
import { RequestAlertsSection } from './RequestAlertsSection';
import { InterfaceSoundSection } from './InterfaceSoundSection';
import { setUiSound, useUiSound } from '@/lib/sound/uiSound';
import { notificationsSupported, setAlerts, type RequestAlerts } from '@/lib/requestAlerts';
import { useRequestAlertSettings } from '@/layout/useRequestAlerts';

/** A label above its value, the shape M2's supplier detail already reads in. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-xxs">
      <dt className="text-caption text-text-secondary">{label}</dt>
      <dd className="text-body-small text-text-primary">{children}</dd>
    </div>
  );
}

/** Two letters for the avatar: first and last name, as the account menu draws them. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

export function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const user = useCurrentUser();
  const { appearance, updateAppearance } = useAppearance();
  const alerts = useRequestAlertSettings();
  const uiSound = useUiSound();

  const savedLanguage: LanguageCode = isLanguageCode(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : 'en';

  /**
   * Drafted rather than applied on press, so all three land behind one confirmation:
   * the same draft-then-save shape every M14 section uses.
   *
   * The cost is real and worth naming: appearance and text size are judged by **looking**
   * at them, and a draft cannot be looked at. Somebody picking "Larger" sees nothing change
   * until they have confirmed, which is the opposite of how those two are normally chosen.
   */
  const [draftLanguage, setDraftLanguage] = useState<LanguageCode>(savedLanguage);
  const [draftAppearance, setDraftAppearance] = useState<Appearance>(appearance);
  const [draftAlerts, setDraftAlerts] = useState<RequestAlerts>(alerts);
  const [draftSound, setDraftSound] = useState(uiSound);
  const [confirming, setConfirming] = useState(false);

  // Re-seeded when the stored values move underneath: a second tab, or the sign-in
  // screen's switcher on the way in.
  useEffect(() => setDraftLanguage(savedLanguage), [savedLanguage]);
  useEffect(() => setDraftAppearance(appearance), [appearance]);
  useEffect(() => setDraftAlerts(alerts), [alerts]);
  useEffect(() => setDraftSound(uiSound), [uiSound]);

  const dirty =
    draftLanguage !== savedLanguage ||
    (Object.keys(appearance) as (keyof Appearance)[]).some(
      (key) => draftAppearance[key] !== appearance[key],
    ) ||
    draftAlerts.sound !== alerts.sound ||
    draftAlerts.desktop !== alerts.desktop ||
    draftSound !== uiSound;

  function revert() {
    setDraftLanguage(savedLanguage);
    setDraftAppearance(appearance);
    setDraftAlerts(alerts);
    setDraftSound(uiSound);
  }

  async function apply() {
    // Appearance first: the language swap re-renders every label, and applying it last
    // means the toast below is already written in the language that was chosen.
    updateAppearance(draftAppearance);

    // A desktop notification needs the browser's permission, asked now, in answer to this
    // click. Refused, the rest is still saved and the person is told why that one was not.
    let desktop = draftAlerts.desktop;
    let refused = false;
    if (
      desktop &&
      !alerts.desktop &&
      notificationsSupported() &&
      Notification.permission !== 'granted'
    ) {
      const answer = await Notification.requestPermission();
      desktop = answer === 'granted';
      refused = !desktop;
    }
    setAlerts({ sound: draftAlerts.sound, desktop });
    setUiSound(draftSound);

    if (draftLanguage !== savedLanguage) await setLanguage(draftLanguage);

    setConfirming(false);
    toast.success(t('profile.saved'), t('profile.savedHint'));
    if (refused)
      toast.show({ tone: 'info', title: t('alerts.notAllowed'), body: t('alerts.denied') });
  }

  /**
   * `RequireAuth` guarantees a user by the time this renders, so the guard is for the
   * type rather than for a state anybody reaches, and returning `null` beats a spinner
   * that would never resolve.
   */
  if (!user) return null;

  return (
    <>
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />

      {/* Its own box, as tall as what is in it: the save bar sticks to the bottom of the
          window only within its parent, and the page frame is only the window's height. */}
      <div className="flex flex-col gap-lg">
        {/* Who is signed in, in one band (26 November 2026). */}
        <Card>
          <CardBody className="flex flex-wrap items-center gap-x-xl gap-y-md">
            <div className="flex min-w-0 flex-1 basis-72 items-center gap-md">
              <span
                aria-hidden
                className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-muted text-title font-semibold text-primary"
              >
                {initials(user.name)}
              </span>
              <div className="flex min-w-0 flex-col gap-xxs">
                <h2 className="truncate text-title font-semibold text-text-primary">{user.name}</h2>
                <span className="truncate text-body-small text-text-secondary">{user.email}</span>
                {/* Every role, not the "highest": §12.1 grants are a union, and a person
                    holding two roles is doing two jobs rather than the senior one. */}
                <span className="mt-xxs flex flex-wrap gap-xxs">
                  {user.roles.map((role) => (
                    <Badge key={role} tone="neutral">
                      {t(`users.role.${role}`)}
                    </Badge>
                  ))}
                </span>
              </div>
            </div>

            <dl className="flex flex-wrap gap-x-xl gap-y-sm">
              <Fact label={t('profile.lastSignIn')}>
                {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : t('profile.firstSignIn')}
              </Fact>
            </dl>
          </CardBody>
        </Card>

        {/* The preferences in four groups, each a list of rows with the control on the right. */}
        <div className="grid gap-lg lg:grid-cols-2">
          <Card>
            <CardHeader title={t('profile.group.reading')} description={t('profile.group.readingHint')} />
            <CardBody className="divide-y divide-divider">
              <SettingRow label={t('profile.language')} hint={t('profile.languageHint')}>
                <LanguageSwitcher value={draftLanguage} onChange={setDraftLanguage} className="w-64" />
              </SettingRow>
              <AppearanceControls
                value={draftAppearance}
                onChange={setDraftAppearance}
                rows={['textSize', 'contrast']}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('profile.group.look')} description={t('profile.group.lookHint')} />
            <CardBody className="divide-y divide-divider">
              <AppearanceControls value={draftAppearance} onChange={setDraftAppearance} rows={['scheme', 'density', 'glass']} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('profile.group.motion')} description={t('profile.group.motionHint')} />
            <CardBody className="divide-y divide-divider">
              <AppearanceControls value={draftAppearance} onChange={setDraftAppearance} rows={['motion']} />
              <InterfaceSoundSection value={draftSound} onChange={setDraftSound} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('alerts.title')} description={t('alerts.description')} />
            <CardBody className="divide-y divide-divider">
              <RequestAlertsSection value={draftAlerts} onChange={setDraftAlerts} />
            </CardBody>
          </Card>
        </div>

        {/* Always in view (26 November 2026): it used to sit under the last card, so a
            change near the top was made with the only way to keep it off the screen. Quiet
            while there is nothing to save, raised and marked once there is. */}
        <div
          className={cn(
            'sticky bottom-md z-10 flex flex-wrap items-center gap-sm rounded-lg border bg-surface px-lg py-sm transition-shadow',
            dirty ? 'border-primary/40 shadow-raised' : 'border-border shadow-card',
          )}
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-md gap-y-xxs">
            {dirty ? (
              <span className="flex items-center gap-xs text-body-small font-medium text-text-primary">
                <span aria-hidden className="size-2 shrink-0 rounded-full bg-warning" />
                {t('profile.unsavedHint')}
              </span>
            ) : (
              <span className="text-body-small text-text-secondary">{t('profile.nothingToSave')}</span>
            )}
            {/* The honest scope of all of them: this machine, not this account. They are in
                `localStorage` because they have to work on the sign-in screen, which has no
                session to read a preference from. */}
            <InfoTip label={t('tip.savedHere')} text={t('tip.savedHere')}>
              {t('profile.preferencesScope')}
            </InfoTip>
          </div>
          <RevertButton onRevert={revert} disabled={!dirty} />
          <Button
            variant="primary"
            disabled={!dirty}
            iconLeft={<Save className="size-icon-sm" aria-hidden />}
            onClick={() => setConfirming(true)}
          >
            {t('profile.save')}
          </Button>
        </div>
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
