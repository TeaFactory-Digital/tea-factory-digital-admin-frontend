/**
 * Light or dark, and how large the text is.
 *
 * A preference and not configuration: §12.1 makes `flagsAndBranding` writable by the
 * factory admin alone, so in M14 a clerk on a bright counter — or a weigher who needs
 * larger type — could not change their own screen. Same reasoning as the language
 * switcher, which is already per-machine for the same reason.
 *
 * **One home: M15.** It rendered in the account menu as well for a while, on the argument
 * that a shortcut is worth having once somebody knows the setting exists. That was dropped
 * deliberately — two places to change one value is two places to look when it is wrong,
 * and the profile screen is where somebody *discovers* text size is adjustable at all.
 *
 * Still takes a `className` so a caller decides its padding, which is what let it sit in a
 * dropdown before and would again.
 *
 * Two rows of segments rather than a submenu, because both settings are things people try,
 * look at, and try again — a submenu that closed on every choice would make comparing
 * light against dark a four-click job.
 */

import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { TEXT_SIZES, type Appearance, type ConsoleScheme, type TextSize } from './appearance';
import { useAppearance } from './useAppearance';
import { cn } from '@/lib/cn';

const SCHEMES: Array<{ value: ConsoleScheme; Icon: typeof Sun }> = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
];

/** The step's own size, so the control shows what it does rather than describing it. */
const SIZE_PREVIEW: Record<TextSize, string> = {
  normal: 'text-caption',
  large: 'text-body-small',
  larger: 'text-subtitle',
};

const SEGMENT =
  'flex flex-1 items-center justify-center gap-xxs rounded-sm px-sm py-xxs ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

export interface AppearanceControlsProps {
  className?: string;
  /**
   * Drive it from a draft instead of from the stored preference.
   *
   * Omitted, a press applies immediately. Supplied, the caller owns the value — M15 holds
   * all three preferences as a draft so they land together behind one confirmation.
   */
  value?: Appearance;
  onChange?: (next: Appearance) => void;
}

export function AppearanceControls({ className, value, onChange }: AppearanceControlsProps) {
  const { t } = useTranslation();
  const store = useAppearance();

  const appearance = value ?? store.appearance;
  const setScheme = (scheme: ConsoleScheme) =>
    onChange ? onChange({ ...appearance, scheme }) : store.setScheme(scheme);
  const setTextSize = (textSize: TextSize) =>
    onChange ? onChange({ ...appearance, textSize }) : store.setTextSize(textSize);

  return (
    <div className={cn('flex flex-col gap-sm', className)}>
      <div className="flex flex-col gap-xxs">
        <span className="text-caption text-text-secondary">{t('appearance.scheme')}</span>
        {/*
         * `radiogroup`, not a row of buttons: these are one choice with two answers, so a
         * screen reader should hear "1 of 2" rather than two unrelated controls.
         */}
        <div role="radiogroup" aria-label={t('appearance.scheme')} className="flex gap-xxs">
          {SCHEMES.map(({ value, Icon }) => {
            const active = appearance.scheme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setScheme(value)}
                className={cn(
                  SEGMENT,
                  'text-body-small',
                  active
                    ? 'bg-primary text-primary-contrast'
                    : 'text-text-primary hover:bg-surface-variant',
                )}
              >
                <Icon className="size-icon-sm" aria-hidden />
                {t(`appearance.scheme.${value}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-xxs">
        <span className="text-caption text-text-secondary">{t('appearance.textSize')}</span>
        <div role="radiogroup" aria-label={t('appearance.textSize')} className="flex gap-xxs">
          {TEXT_SIZES.map((size) => {
            const active = appearance.textSize === size;
            return (
              <button
                key={size}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTextSize(size)}
                // Labelled, because the visible glyph is a letter "A" at three sizes and
                // "A" is not a name anybody can act on.
                aria-label={t(`appearance.textSize.${size}`)}
                title={t(`appearance.textSize.${size}`)}
                className={cn(
                  SEGMENT,
                  SIZE_PREVIEW[size],
                  active
                    ? 'bg-primary text-primary-contrast'
                    : 'text-text-primary hover:bg-surface-variant',
                )}
              >
                A
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
