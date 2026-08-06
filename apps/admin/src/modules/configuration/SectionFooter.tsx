/**
 * The save/revert/consequences footer every M14 section ends with.
 *
 * Its own file because the payout-file section is large enough to live apart from the other
 * five, and two copies of this would eventually be two different answers to *"may this be
 * saved?"* — which is the one question in M14 that must have exactly one answer.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import type { ConfigPatch, ConfigUsage, RuntimeConfig } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { adminConfigRepository } from '@/services/repositories/adminConfigRepository';
import { ImpactList } from './ImpactList';
import { RevertButton } from './StringListEditor';

/** What every section receives. `save` returns a promise so the footer can show progress. */
export interface SectionProps {
  config: RuntimeConfig;
  usage: ConfigUsage;
  readOnly: boolean;
  saving: boolean;
  save: (patch: ConfigPatch) => Promise<unknown>;
}

/**
 * Save, revert, and the consequences of what is currently drafted.
 *
 * The button is disabled by **either** nothing having changed or the change being blocked,
 * and the two are said differently: "nothing to save" and "this would hide records the
 * factory owes" are not the same message, and collapsing them into a greyed-out button
 * with no explanation is how a screen becomes a support call.
 */
export function SectionFooter({
  patch,
  config,
  usage,
  dirty,
  readOnly,
  saving,
  save,
  onRevert,
}: SectionProps & { patch: ConfigPatch; dirty: boolean; onRevert: () => void }) {
  const { t } = useTranslation();

  // Computed locally from the shared rule, so the consequence appears while the toggle is
  // being considered rather than after it is pressed.
  const impacts = useMemo(
    () => (dirty ? adminConfigRepository.impactOf(patch, config, usage) : []),
    [patch, config, usage, dirty],
  );
  const blocked = impacts.some((impact) => impact.severity === 'blocks');

  if (readOnly) {
    return (
      <p className="border-t border-divider pt-md text-caption text-text-secondary">
        {t('config.readOnly')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-sm border-t border-divider pt-md">
      <ImpactList impacts={impacts} />

      <div className="flex flex-wrap items-center gap-sm">
        <Button
          variant="primary"
          disabled={!dirty || blocked}
          loading={saving}
          iconLeft={<Save className="size-icon-sm" aria-hidden />}
          onClick={() => void save(patch)}
        >
          {t('config.save')}
        </Button>
        <RevertButton onRevert={onRevert} disabled={!dirty} />

        <p className="text-caption text-text-secondary">
          {blocked
            ? t('config.blockedHint')
            : dirty
              ? t('config.unsavedHint')
              : t('config.nothingToSave')}
        </p>
      </div>
    </div>
  );
}
