/**
 * Alerts for new requests (23 November 2026): a chime, and a desktop notification while the
 * console is in a background tab. Part of the profile's preferences, so they are drafted
 * and land with "Save preferences" like the rest. The browser asks for notification
 * permission when they are saved, which is a click it accepts as the person's own.
 *
 * Two setting rows with the same Off / On control as every other row on the profile
 * (26 November 2026); they were checkboxes, the one place on the screen that switched
 * something on a different way.
 */

import { useTranslation } from 'react-i18next';
import { BellOff, BellRing, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { SettingRow } from '@/components/ui/SettingRow';
import { notificationsSupported, playChime, type RequestAlerts } from '@/lib/requestAlerts';

export function RequestAlertsSection({
  value,
  onChange,
}: {
  value: RequestAlerts;
  onChange: (next: RequestAlerts) => void;
}) {
  const { t } = useTranslation();
  const supported = notificationsSupported();
  const permission = supported ? Notification.permission : 'unsupported';
  const blocked = permission === 'unsupported' || permission === 'denied';

  return (
    <>
      <SettingRow label={t('alerts.sound')}>
        {/* A preview, so it plays now: hearing it is how the choice is made. */}
        <Button size="sm" variant="ghost" iconLeft={<Play className="size-icon-xs" aria-hidden />} onClick={playChime}>
          {t('alerts.test')}
        </Button>
        <Segmented
          label={t('alerts.sound')}
          value={value.sound ? 'on' : 'off'}
          onValueChange={(next) => onChange({ ...value, sound: next === 'on' })}
          options={[
            {
              value: 'off',
              label: (
                <>
                  <VolumeX className="size-icon-sm" aria-hidden />
                  {t('uiSound.off')}
                </>
              ),
            },
            {
              value: 'on',
              label: (
                <>
                  <Volume2 className="size-icon-sm" aria-hidden />
                  {t('uiSound.on')}
                </>
              ),
            },
          ]}
        />
      </SettingRow>

      <SettingRow
        label={t('alerts.desktop')}
        hint={t('alerts.desktopHint')}
        // A reason it cannot be switched on stays on the page: it must be seen, not found.
        note={blocked ? (permission === 'unsupported' ? t('alerts.unsupported') : t('alerts.denied')) : undefined}
        noteTone="warning"
      >
        <Segmented
          label={t('alerts.desktop')}
          value={value.desktop ? 'on' : 'off'}
          onValueChange={(next) => onChange({ ...value, desktop: next === 'on' })}
          options={[
            {
              value: 'off',
              label: (
                <>
                  <BellOff className="size-icon-sm" aria-hidden />
                  {t('uiSound.off')}
                </>
              ),
            },
            {
              value: 'on',
              disabled: blocked,
              label: (
                <>
                  <BellRing className="size-icon-sm" aria-hidden />
                  {t('uiSound.on')}
                </>
              ),
            },
          ]}
        />
      </SettingRow>
    </>
  );
}
