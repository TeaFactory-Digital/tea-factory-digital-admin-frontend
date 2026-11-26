/**
 * Interface sounds (26 November 2026): a quiet blip when the person moves between screens,
 * opens an item, sends a reply or confirms. Off by default; part of the profile's
 * preferences, so it is drafted and lands with "Save preferences" like the rest.
 */

import { useTranslation } from 'react-i18next';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { SettingRow } from '@/components/ui/SettingRow';
import { sounds } from '@/lib/sound/engine';

export function InterfaceSoundSection({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <SettingRow label={t('uiSound.title')} hint={t('uiSound.hint')}>
      {/* A preview, so it plays whatever the switch says: hearing it is how the choice is made. */}
      <Button
        size="sm"
        variant="ghost"
        iconLeft={<Play className="size-icon-xs" aria-hidden />}
        onClick={sounds.sent}
      >
        {t('alerts.test')}
      </Button>
      <Segmented
        label={t('uiSound.title')}
        value={value ? 'on' : 'off'}
        onValueChange={(next) => onChange(next === 'on')}
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
  );
}
