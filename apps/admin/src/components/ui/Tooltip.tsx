/**
 * shadcn/ui's Tooltip, on `@radix-ui/react-tooltip`, themed with the console's tokens.
 *
 * `InfoTip` is the one most screens want: a small "i" that explains something on hover
 * or keyboard focus, so a sentence of guidance does not sit permanently on the page.
 * Each `InfoTip` carries its own provider, so no app-level wrapper is needed.
 */

import * as RadixTooltip from '@radix-ui/react-tooltip';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';

export const TooltipProvider = RadixTooltip.Provider;
export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof RadixTooltip.Content>,
  ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, sideOffset = 6, children, ...props }, ref) => (
  <RadixTooltip.Portal>
    <RadixTooltip.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-card rounded-md border border-border bg-surface px-md py-sm text-caption text-text-primary shadow-raised',
        className,
      )}
      {...props}
    >
      {children}
      <RadixTooltip.Arrow className="fill-surface" />
    </RadixTooltip.Content>
  </RadixTooltip.Portal>
));
TooltipContent.displayName = 'TooltipContent';

/**
 * An "i" button that shows `children` on hover or focus.
 *
 * A real `<button>`, so a keyboard user can tab to it and a screen reader reads `label`;
 * the explanation is then announced as the tooltip opens.
 */
export function InfoTip({
  label,
  text,
  children,
  side = 'bottom',
  compact = false,
}: {
  /** The accessible name of the icon, e.g. "Why can't I do this?". */
  label: string;
  /**
   * A few words shown beside the icon, e.g. "Read only", where a lone "i" would leave
   * the reader guessing what it is about. The full sentence stays in the tooltip.
   */
  text?: string;
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /**
   * No taller than a line of label text. Beside a form label the full 32px target made
   * that label's row taller than its neighbours', so two fields side by side (Starts /
   * Ends) no longer lined up. The negative margin keeps a comfortable hover area.
   */
  compact?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-xxs rounded-full text-text-secondary transition-colors',
              'hover:bg-surface-variant hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              text ? 'h-8 self-start px-sm text-caption' : compact ? '-my-xs size-5' : 'size-8',
            )}
          >
            {text ? <span>{text}</span> : null}
            <Info className="size-icon-sm" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side}>{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
