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
import {
  Contrast as ContrastIcon,
  Image,
  Moon,
  Mountain,
  Palette,
  Pause,
  Play,
  Rows3,
  Rows4,
  Sparkles,
  Square,
  Sun,
  SunMoon,
} from 'lucide-react';
import {
  CONTRASTS,
  DENSITIES,
  GLASS_BACKDROPS,
  TEXT_SIZES,
  type Appearance,
  type ConsoleScheme,
  type Contrast,
  type Density,
  type GlassBackdrop,
  type TextSize,
} from './appearance';
import { BackdropPhotoError, prepareBackdropPhoto } from '@/lib/backdropPhoto';
import { prefersReducedMotion } from '@/lib/motion';
import { useAppearance } from './useAppearance';
import { cn } from '@/lib/cn';
import { LabelWithTip } from '@/components/ui/LabelWithTip';

const SCHEMES: Array<{ value: ConsoleScheme; Icon: typeof Sun }> = [
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
  { value: 'auto', Icon: SunMoon },
];

/** Glass for the sidebar, the top bar and dialogs (22 November 2026); off by default. */
const GLASS: Array<{ value: boolean; Icon: typeof Sun }> = [
  { value: false, Icon: Square },
  { value: true, Icon: Sparkles },
];

const DENSITY_ICON: Record<Density, typeof Sun> = { comfortable: Rows3, compact: Rows4 };

/** Animations (26 November 2026), off first like every other on/off row here. */
const MOTION: Array<{ value: 'off' | 'on'; Icon: typeof Sun }> = [
  { value: 'off', Icon: Pause },
  { value: 'on', Icon: Play },
];
const CONTRAST_ICON: Record<Contrast, typeof Sun> = { normal: Square, high: ContrastIcon };

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

  const set = (change: Partial<Appearance>) =>
    onChange ? onChange({ ...appearance, ...change }) : store.updateAppearance(change);

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
        <LabelWithTip label={t('appearance.scheme')} tip={t('appearance.schemeHint')} />
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

      <Segments
        label={t('appearance.density')}
        options={DENSITIES.map((value) => ({
          value,
          Icon: DENSITY_ICON[value],
          label: t(`appearance.density.${value}`),
        }))}
        value={appearance.density}
        onSelect={(density) => set({ density })}
        hint={t('appearance.densityHint')}
      />

      <Segments
        label={t('appearance.contrast')}
        options={CONTRASTS.map((value) => ({
          value,
          Icon: CONTRAST_ICON[value],
          label: t(`appearance.contrast.${value}`),
        }))}
        value={appearance.contrast}
        onSelect={(contrast) => set({ contrast })}
        hint={t('appearance.contrastHint')}
      />

      <div className="flex flex-col gap-xxs">
        <LabelWithTip label={t('appearance.glass')} tip={t('appearance.glassHint')} />
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
      </div>

      {appearance.glass ? (
        <div className="flex flex-col gap-xxs">
          <LabelWithTip label={t('appearance.backdrop')} tip={t('appearance.backdrop.hint')} />
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
              <img
                src={appearance.photo}
                alt={t('appearance.backdrop.preview')}
                className="h-10 w-16 rounded-sm object-cover"
              />
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
          {preparing ? (
            <span className="text-caption text-text-secondary">
              {t('appearance.backdrop.preparing')}
            </span>
          ) : null}
          {photoError ? (
            <span role="alert" className="text-caption text-error">
              {photoError}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-xxs">
        <Segments
          label={t('appearance.motion')}
          options={MOTION.map(({ value, Icon }) => ({
            value,
            Icon,
            label: t(`appearance.motion.${value}`),
          }))}
          value={appearance.motion ? 'on' : 'off'}
          onSelect={(value) => set({ motion: value === 'on' })}
          hint={t('appearance.motionHint')}
        />
        {/* Why "On" may still look still: the reason stays on the page, not behind the "i". */}
        {appearance.motion && prefersReducedMotion() ? (
          <span className="text-caption text-text-secondary">{t('appearance.motionReduced')}</span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One row of segments: a radiogroup, so a screen reader hears "1 of 2". Exported for the
 * profile's other on/off rows (interface sounds), so every row in that card looks alike.
 */
export function Segments<T extends string>({
  label,
  options,
  value,
  onSelect,
  hint,
}: {
  label: string;
  options: Array<{ value: T; Icon: typeof Sun; label: string }>;
  value: T;
  onSelect: (value: T) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-xxs">
      {hint ? (
        <LabelWithTip label={label} tip={hint} />
      ) : (
        <span className="text-caption text-text-secondary">{label}</span>
      )}
      <div role="radiogroup" aria-label={label} className="flex gap-xxs">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelect(option.value)}
              className={cn(
                SEGMENT,
                'text-body-small',
                active
                  ? 'bg-primary text-primary-contrast'
                  : 'text-text-primary hover:bg-surface-variant',
              )}
            >
              <option.Icon className="size-icon-sm" aria-hidden />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
