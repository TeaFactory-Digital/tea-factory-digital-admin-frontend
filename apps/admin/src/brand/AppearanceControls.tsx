/**
 * Light or dark, and how large the text is.
 *
 * A preference and not configuration: §12.1 makes `flagsAndBranding` writable by the
 * factory admin alone, so in M14 a clerk on a bright counter, or a weigher who needs
 * larger type, could not change their own screen. Same reasoning as the language
 * switcher, which is already per-machine for the same reason.
 *
 * **One home: M15.** It rendered in the account menu as well for a while, on the argument
 * that a shortcut is worth having once somebody knows the setting exists. That was dropped
 * deliberately: two places to change one value is two places to look when it is wrong,
 * and the profile screen is where somebody *discovers* text size is adjustable at all.
 *
 * Still takes a `className` so a caller decides its padding, which is what let it sit in a
 * dropdown before and would again.
 *
 * Two rows of segments rather than a submenu, because both settings are things people try,
 * look at, and try again: a submenu that closed on every choice would make comparing
 * light against dark a four-click job.
 */

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Moon, Mountain, Palette, Sparkles, Square, Sun } from 'lucide-react';
import { GLASS_BACKDROPS, TEXT_SIZES, type Appearance, type ConsoleScheme, type GlassBackdrop, type TextSize } from './appearance';
import { BackdropPhotoError, prepareBackdropPhoto } from '@/lib/backdropPhoto';
import { useAppearance } from './useAppearance';
import { cn } from '@/lib/cn';

const SCHEMES: Array<{ value: ConsoleScheme; Icon: typeof Sun }> = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
];

/** Glass for the sidebar, the top bar and dialogs (22 November 2026); off by default. */
const GLASS: Array<{ value: boolean; Icon: typeof Sun }> = [
  { value: false, Icon: Square },
  { value: true, Icon: Sparkles },
];

/** What the glass sits on (22 November 2026). */
const BACKDROP_ICON: Record<GlassBackdrop, typeof Sun> = {
  colours: Palette,
  estate: Mountain,
  photo: Image,
};

/** The step's own size, so the control shows what it does rather than describing it. */
const SIZE_PREVIEW: Record<TextSize, string> = {
  normal: 'text-caption',
  large: 'text-body-small',
  larger: 'text-subtitle',
};

const SEGMENT =
  'flex flex-1 items-center justify-center gap-xxs rounded-sm px-sm py-xxs ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring';

interface AppearanceControlsProps {
  className?: string;
  /**
   * Drive it from a draft instead of from the stored preference.
   *
   * Omitted, a press applies immediately. Supplied, the caller owns the value: M15 holds
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
  const setGlass = (glass: boolean) =>
    onChange ? onChange({ ...appearance, glass }) : store.setGlass(glass);
  const setBackdrop = (backdrop: GlassBackdrop, photo?: string | null) =>
    onChange
      ? onChange({ ...appearance, backdrop, ...(photo === undefined ? {} : { photo }) })
      : store.setBackdrop(backdrop, photo);

  const fileInput = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setPreparing(true);
    try {
      setBackdrop('photo', await prepareBackdropPhoto(file));
    } catch (error) {
      const code = error instanceof BackdropPhotoError ? error.code : 'unreadable';
      setPhotoError(t(`appearance.backdrop.error.${code}`));
    } finally {
      setPreparing(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

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

      <div className="flex flex-col gap-xxs">
        <span className="text-caption text-text-secondary">{t('appearance.glass')}</span>
        <div role="radiogroup" aria-label={t('appearance.glass')} className="flex gap-xxs">
          {GLASS.map(({ value, Icon }) => {
            const active = appearance.glass === value;
            return (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setGlass(value)}
                className={cn(
                  SEGMENT,
                  'text-body-small',
                  active
                    ? 'bg-primary text-primary-contrast'
                    : 'text-text-primary hover:bg-surface-variant',
                )}
              >
                <Icon className="size-icon-sm" aria-hidden />
                {t(value ? 'appearance.glass.on' : 'appearance.glass.off')}
              </button>
            );
          })}
        </div>
        <span className="text-caption text-text-secondary">{t('appearance.glassHint')}</span>
      </div>

      {appearance.glass ? (
        <div className="flex flex-col gap-xxs">
          <span className="text-caption text-text-secondary">{t('appearance.backdrop')}</span>
          <div role="radiogroup" aria-label={t('appearance.backdrop')} className="flex gap-xxs">
            {GLASS_BACKDROPS.map((backdrop) => {
              const active = appearance.backdrop === backdrop;
              const Icon = BACKDROP_ICON[backdrop];
              return (
                <button
                  key={backdrop}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={preparing}
                  onClick={() => {
                    // "Your photo" with none chosen yet asks for one first.
                    if (backdrop === 'photo' && !appearance.photo) fileInput.current?.click();
                    else setBackdrop(backdrop);
                  }}
                  className={cn(
                    SEGMENT,
                    'text-body-small',
                    active
                      ? 'bg-primary text-primary-contrast'
                      : 'text-text-primary hover:bg-surface-variant',
                  )}
                >
                  <Icon className="size-icon-sm" aria-hidden />
                  {t(`appearance.backdrop.${backdrop}`)}
                </button>
              );
            })}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('appearance.backdrop.choose')}
            onChange={(event) => void choosePhoto(event.target.files?.[0])}
          />
          {appearance.photo && appearance.backdrop === 'photo' ? (
            <div className="flex items-center gap-sm">
              <img src={appearance.photo} alt={t('appearance.backdrop.preview')} className="h-10 w-16 rounded-sm object-cover" />
              <button
                type="button"
                className="text-caption font-medium text-primary hover:underline"
                onClick={() => fileInput.current?.click()}
              >
                {t('appearance.backdrop.change')}
              </button>
              <button
                type="button"
                className="text-caption font-medium text-error hover:underline"
                onClick={() => setBackdrop('colours', null)}
              >
                {t('appearance.backdrop.remove')}
              </button>
            </div>
          ) : null}
          {preparing ? <span className="text-caption text-text-secondary">{t('appearance.backdrop.preparing')}</span> : null}
          {photoError ? (
            <span role="alert" className="text-caption text-error">
              {photoError}
            </span>
          ) : null}
          <span className="text-caption text-text-secondary">{t('appearance.backdrop.hint')}</span>
        </div>
      ) : null}
    </div>
  );
}
