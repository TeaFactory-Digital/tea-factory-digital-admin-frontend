/**
 * "Enter this in the factory system too", inside an approval dialog.
 *
 * **Every factory runs its own system**, whatever this console's mode: with the sync on it
 * feeds us; with the sync off it still runs the factory but cannot be connected (no sync,
 * or no export at all). Nothing here writes to it, so what is approved here reaches that
 * system only when the office enters it there. Shown in every approval, always.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '@/components/ui/states';

export function FactorySystemReminder({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Notice tone="warning">
      <span>
        <strong className="font-semibold">{t('factoryReminder.title')}</strong> {children}
      </span>
    </Notice>
  );
}
