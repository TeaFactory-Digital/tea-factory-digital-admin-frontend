/**
 * A link inside a sentence, a notice or a figure (27 November 2026): "Open requests: 3"
 * that goes to them, "12 suppliers have no bank details" that shows them.
 *
 * It takes the colour of what it sits in (a warning notice stays amber), underlines on hover,
 * and carries the console's own navigation: the screen change and, for anyone with interface
 * sounds on, the `tick` the sidebar plays.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { motionAllowed } from '@/lib/motion';
import { playSound } from '@/lib/sound/uiSound';

export function InlineLink({
  to,
  children,
  className,
  arrow = true,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  arrow?: boolean;
}) {
  return (
    <Link
      to={to}
      viewTransition={motionAllowed()}
      onClick={() => playSound('tick')}
      className={cn(
        'group inline-flex items-center gap-xxs font-medium underline-offset-2 hover:underline',
        'focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
    >
      {children}
      {arrow ? (
        <ArrowRight aria-hidden className="size-icon-xs shrink-0 transition-transform group-hover:translate-x-0.5" />
      ) : null}
    </Link>
  );
}
