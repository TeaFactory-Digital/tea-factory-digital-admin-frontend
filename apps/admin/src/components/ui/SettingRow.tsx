/**
 * One setting as a row (26 November 2026): what it is on the left, the control on the right,
 * the way a phone's or a computer's own settings read.
 *
 * The control keeps its own width instead of stretching across the card: a three-way choice
 * drawn a thousand pixels wide put the chosen option at one edge and the others at the far
 * side, and the eye had to cross the screen to compare them. On a narrow card the control
 * drops under the label rather than squeezing it.
 *
 * The explanation sits behind the "i" (`LabelWithTip`), as everywhere in the console. A
 * reason the setting cannot be used, or does not apply on this computer, is `note`: printed
 * under the label, because it has to be seen rather than found.
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { LabelWithTip } from './LabelWithTip';

export function SettingRow({
  label,
  hint,
  note,
  noteTone = 'muted',
  noteAlert = false,
  children,
}: {
  label: string;
  hint?: ReactNode;
  note?: ReactNode;
  noteTone?: 'muted' | 'warning';
  /** An error that has just happened, read out as it appears (`role="alert"`). */
  noteAlert?: boolean;
  children: ReactNode;
}) {
  return (
    <div data-setting-row className="flex flex-wrap items-center justify-between gap-x-lg gap-y-sm py-md first:pt-0 last:pb-0">
      <div className="flex min-w-0 flex-1 basis-48 flex-col gap-xxs">
        {hint ? (
          <LabelWithTip label={label} tip={hint} className="text-body-small font-medium text-text-primary" />
        ) : (
          <span className="text-body-small font-medium text-text-primary">{label}</span>
        )}
        {note ? (
          <span
            role={noteAlert ? 'alert' : undefined}
            className={cn('text-caption', noteTone === 'warning' ? 'text-warning' : 'text-text-secondary')}
          >
            {note}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-xs">{children}</div>
    </div>
  );
}
