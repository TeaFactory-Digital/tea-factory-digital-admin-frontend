/**
 * A signed change against a named period: `↗ 4 pts vs last month`.
 *
 * The tone is **direction × whether up is good**, not direction alone. More requests from
 * the app is good news; more items past target is not, and painting both green because
 * both went up would teach the office to stop reading the colour.
 *
 * Never colour alone: the arrow and the sign carry the direction for a reader who cannot
 * tell the two tints apart, and in a greyscale screenshot pasted into an email.
 */

import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';

const TONES = {
  good: 'bg-success-muted text-success',
  bad: 'bg-error-muted text-error',
  flat: 'bg-surface-variant text-text-secondary',
} as const;

export function DeltaPill({
  delta,
  children,
  upIsGood = true,
  className,
}: {
  /** The signed change. Zero renders as flat. */
  delta: number;
  /** The formatted magnitude, without a sign. */
  children: ReactNode;
  upIsGood?: boolean;
  className?: string;
}) {
  const tone = delta === 0 ? 'flat' : delta > 0 === upIsGood ? 'good' : 'bad';
  const Icon = delta === 0 ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        'numeric inline-flex w-fit items-center gap-xxs rounded-sm px-xs py-xxs text-caption font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      <Icon className="size-icon-xs shrink-0" aria-hidden />
      <span>
        {delta > 0 ? '+' : delta < 0 ? '−' : ''}
        {children}
      </span>
    </span>
  );
}
