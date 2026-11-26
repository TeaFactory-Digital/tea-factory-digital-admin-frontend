/**
 * Interface sounds (26 November 2026): a quiet blip when the person moves between screens,
 * opens an item, sends a reply or confirms. Off by default; part of the profile's
 * preferences, so it is drafted and lands with "Save preferences" like the rest.
 */

import { useTranslation } from 'react-i18next';
import { Volume2, VolumeX } from 'lucide-react';
import { Segments } from '@/brand/AppearanceControls';
import { Button } from '@/components/ui/Button';
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
    <div className="flex flex-wrap items-end gap-sm">
      <div className="min-w-0 flex-1">
        <Segments
          label={t('uiSound.title')}
          hint={t('uiSound.hint')}
          options={[
            { value: 'off', Icon: VolumeX, label: t('uiSound.off') },
            { value: 'on', Icon: Volume2, label: t('uiSound.on') },
          ]}
          value={value ? 'on' : 'off'}
          onSelect={(next) => onChange(next === 'on')}
        />
      </div>
      {/* A preview, so it plays whatever the switch says: hearing it is how the choice is made. */}
      <Button size="sm" variant="ghost" onClick={sounds.sent}>
        {t('alerts.test')}
      </Button>
    </div>
  );
}
