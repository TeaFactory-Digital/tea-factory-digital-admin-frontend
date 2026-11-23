/**
 * A setting's label with its explanation behind an "i" (24 November 2026): the sentence that
 * used to sit under every setting on the profile screen now shows on hover or keyboard focus,
 * so the page reads as a list of choices. The icon is named after the setting it explains, and
 * is the full 32 px target: the compact one fails the 24 px minimum for something clicked.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { InfoTip } from './Tooltip';

export function LabelWithTip({
  label,
  tip,
  className = 'text-caption text-text-secondary',
}: {
  label: string;
  tip: ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span className={cn('flex items-center gap-xs', className)}>
      {label}
      <InfoTip label={`${t('tip.moreInfo')}: ${label}`}>
        {tip}
      </InfoTip>
    </span>
  );
}
