/**
 * Alerts for new requests (23 November 2026): a chime, and a desktop notification while the
 * console is in a background tab. Part of the profile's preferences, so they are drafted
 * and land with "Save preferences" like the rest. The browser asks for notification
 * permission when they are saved, which is a click it accepts as the person's own.
 */

import { useTranslation } from 'react-i18next';
import { BellRing, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Label } from '@/components/ui/Label';
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

  return (
    <div className="flex flex-col gap-sm">
      <span className="text-label text-text-primary">{t('alerts.title')}</span>
      <span className="text-caption text-text-secondary">{t('alerts.description')}</span>

      <div className="flex flex-wrap items-center gap-sm">
        <Checkbox
          id="alert-sound"
          checked={value.sound}
          onCheckedChange={(checked) => onChange({ ...value, sound: checked === true })}
        />
        <Label htmlFor="alert-sound" className="flex items-center gap-xs">
          <Volume2 className="size-icon-sm text-text-secondary" aria-hidden />
          {t('alerts.sound')}
        </Label>
        {/* A preview, so it plays now: hearing it is how the choice is made. */}
        <Button size="sm" variant="ghost" onClick={playChime}>
          {t('alerts.test')}
        </Button>
      </div>

      <div className="flex flex-col gap-xxs">
        <div className="flex items-center gap-sm">
          <Checkbox
            id="alert-desktop"
            checked={value.desktop}
            disabled={!supported || permission === 'denied'}
            onCheckedChange={(checked) => onChange({ ...value, desktop: checked === true })}
          />
          <Label htmlFor="alert-desktop" className="flex items-center gap-xs">
            <BellRing className="size-icon-sm text-text-secondary" aria-hidden />
            {t('alerts.desktop')}
          </Label>
        </div>
        <span className="text-caption text-text-secondary">
          {permission === 'unsupported'
            ? t('alerts.unsupported')
            : permission === 'denied'
              ? t('alerts.denied')
              : t('alerts.desktopHint')}
        </span>
      </div>
    </div>
  );
}
