/**
 * A choice of one from a few, drawn like the tab tray: a language, a range, a view.
 *
 * Not `Tabs`, which it looks like, because there is no tab panel behind it: a tab tells a
 * screen reader "this controls the panel below" (`aria-controls`), and here the screen
 * simply redraws. So it is a **radio group**: one stop on Tab, the arrow keys move and
 * choose, and each option says whether it is the chosen one. The axe audit found the tab
 * version pointing at panels that do not exist (`aria-valid-attr-value`).
 *
 * The chosen option's pill slides to the next choice (26 November 2026, `useSlidingTile`), and
 * a change plays `toggle` for anyone with interface sounds on: a click or an arrow key, never
 * the value changing underneath (a URL, a reset).
 */

import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { playSound } from '@/lib/sound/uiSound';
import { useSlidingTile } from '@/lib/useSlidingTile';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: ReadonlyArray<SegmentedOption<T>>;
  /** What is being chosen, for a screen reader: the group's name. */
  label: string;
  className?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.filter((option) => !option.disabled);
  const pill = useSlidingTile<HTMLSpanElement>('[role="radio"][data-state="active"]', value);

  /** The person's own choice: the only change that makes a sound. */
  function choose(next: T) {
    if (next === value) return;
    playSound('toggle');
    onValueChange(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    if (!forward && !back) return;
    event.preventDefault();
    const at = enabled.findIndex((option) => option.value === value);
    const next = enabled[(at + (forward ? 1 : -1) + enabled.length) % enabled.length];
    if (!next) return;
    choose(next.value);
    refs.current[options.indexOf(next)]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'relative inline-flex w-fit flex-wrap gap-xxs rounded-md border border-border bg-surface p-xxs shadow-card',
        className,
      )}
    >
      <span
        ref={pill.ref}
        aria-hidden
        hidden={!pill.shown}
        className={cn(
          'pointer-events-none absolute top-0 left-0 rounded-sm bg-primary-muted ring-1 ring-primary/30 ring-inset',
          pill.motion,
        )}
        style={pill.style}
      />
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={option.disabled}
            // One stop on Tab: the chosen option; the arrows do the rest.
            tabIndex={checked ? 0 : -1}
            data-state={checked ? 'active' : 'inactive'}
            onClick={() => choose(option.value)}
            onKeyDown={onKeyDown}
            className={cn(
              // `relative`, so the label paints above the pill sliding behind it.
              'relative inline-flex items-center justify-center gap-xs rounded-sm px-md py-xs text-label outline-none transition-colors duration-150',
              'text-text-secondary hover:bg-surface-variant hover:text-text-primary',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
              'data-[state=active]:font-semibold data-[state=active]:text-text-primary data-[state=active]:hover:bg-transparent',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
