/**
 * The chrome's language control: a three-segment pill, one segment per language.
 *
 * A two-state toggle is the usual shape for this and it does not survive a third
 * option — "off" stops meaning anything once there are three answers. So the knob
 * stays (it is what makes the control read as *one setting* rather than three
 * buttons) and slides across thirds instead of ends.
 *
 * Two things it must get right, both of which a plain row of buttons gets wrong:
 *
 *  1. **Every option is in its own script, always.** See `./languages.ts` — the
 *     labels do not go through `t()`. A clerk who cannot read the active language is
 *     precisely the person using this control.
 *  2. **It is one stop, not three.** `radiogroup` semantics with a roving tabindex,
 *     so Tab passes over it in one press and the arrow keys move within it. Three
 *     `aria-pressed` buttons would announce as three unrelated controls and eat
 *     three tab stops in a topbar that already has several.
 */

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { setLanguage } from '@/i18n';
import { isLanguageCode, LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { cn } from '@/lib/cn';

export interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /**
   * `resolvedLanguage` rather than `language`: the latter can hold a regional tag
   * (`si-LK`) that matches no segment, which would leave the knob homeless and every
   * segment unchecked.
   */
  const active: LanguageCode = isLanguageCode(i18n.resolvedLanguage) ? i18n.resolvedLanguage : 'en';
  const activeIndex = Math.max(
    0,
    LANGUAGES.findIndex((language) => language.code === active),
  );

  function select(index: number): void {
    const next = LANGUAGES[index];
    if (!next) return;
    void setLanguage(next.code);
    // Focus follows selection so the arrow keys keep working from the new position;
    // `radiogroup` convention is that moving the selection moves focus with it.
    segmentRefs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const delta =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;

    event.preventDefault();
    // Wraps, because a three-option control where Right does nothing on the last
    // segment reads as broken rather than as bounded.
    select((activeIndex + delta + LANGUAGES.length) % LANGUAGES.length);
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('shell.language')}
      onKeyDown={onKeyDown}
      className={cn(
        'relative inline-grid grid-cols-3 items-center rounded-pill border border-border bg-surface-variant p-0.5',
        className,
      )}
    >
      {/*
        The knob. One element that slides rather than a background on each segment,
        so the movement reads as a single setting changing position — and so only one
        thing animates, which is what keeps it smooth on the office's older laptops.

        Positioned with a transform over a third of the track. `aria-hidden` because
        the checked state is already on the segments; announcing it again would have a
        screen reader read the control twice.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-pill bg-surface shadow transition-transform duration-150 motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.25rem) / ${LANGUAGES.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {LANGUAGES.map((language, index) => {
        const checked = language.code === active;
        return (
          <button
            key={language.code}
            ref={(node) => {
              segmentRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            // The endonym is the accessible name: a screen reader spelling out "සිං"
            // is not a language name. `title` gives the same thing to a mouse.
            aria-label={language.name}
            title={language.name}
            // Roving tabindex — only the checked segment is reachable by Tab.
            tabIndex={checked ? 0 : -1}
            onClick={() => select(index)}
            /*
             * `lang` per segment so the browser resolves each label out of the right
             * face in the font stack. Without it a Sinhala label inside a `lang="ta"`
             * document is laid out by whichever font claimed the run first, and
             * conjuncts are exactly where that goes visibly wrong.
             */
            lang={language.code}
            className={cn(
              /*
               * `text-label` (14px) rather than the 12px the surrounding chrome
               * captions use, and the extra vertical padding with it.
               *
               * Both are for the same reason: at 12px, සිං and தமிழ் are cramped in a
               * way EN is not — Indic scripts carry their meaning in diacritics and
               * conjunct forms that Latin puts in letter outlines, so the same pixel
               * height buys materially less legibility. It also lifts the control to
               * roughly the height of the tenant `Select` beside it, which is the
               * touch target the office's tablets already hit.
               */
              'relative z-10 rounded-pill px-sm py-1.5 text-center text-label transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
              checked
                ? 'font-semibold text-text-primary'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {language.label}
          </button>
        );
      })}
    </div>
  );
}
