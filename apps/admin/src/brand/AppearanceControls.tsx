/**
 * How the console looks to this reader: theme, text size, density, contrast, glass and
 * animations.
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
 * Each setting is a `SettingRow` with a `Segmented` beside it (26 November 2026), rather than
 * a submenu, because these are things people try, look at, and try again. `rows` picks which
 * ones and in what order, so the profile can group them into cards; without it, all of them.
 * The rows come back as siblings, so the caller's divider runs between them.
 */

import { Fragment, useRef, useState } from 'react';
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
import { Segmented } from '@/components/ui/Segmented';
import { SettingRow } from '@/components/ui/SettingRow';

export type AppearanceRow = 'scheme' | 'textSize' | 'density' | 'contrast' | 'glass' | 'motion';

const ALL_ROWS: readonly AppearanceRow[] = ['scheme', 'textSize', 'density', 'contrast', 'glass', 'motion'];

const SCHEME_ICON: Record<ConsoleScheme, typeof Sun> = { light: Sun, dark: Moon, auto: SunMoon };
const DENSITY_ICON: Record<Density, typeof Sun> = { comfortable: Rows3, compact: Rows4 };
const CONTRAST_ICON: Record<Contrast, typeof Sun> = { normal: Square, high: ContrastIcon };
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

/** An option's face: its icon, then its word. */
function face(Icon: typeof Sun, label: string) {
  return (
    <>
      <Icon className="size-icon-sm" aria-hidden />
      {label}
    </>
  );
}

interface AppearanceControlsProps {
  /**
   * Drive it from a draft instead of from the stored preference.
   *
   * Omitted, a press applies immediately. Supplied, the caller owns the value: M15 holds
   * all its preferences as a draft so they land together behind one confirmation.
   */
  value?: Appearance;
  onChange?: (next: Appearance) => void;
  rows?: readonly AppearanceRow[];
}

export function AppearanceControls({ value, onChange, rows = ALL_ROWS }: AppearanceControlsProps) {
  const { t } = useTranslation();
  const store = useAppearance();

  const appearance = value ?? store.appearance;
  const set = (change: Partial<Appearance>) =>
    onChange ? onChange({ ...appearance, ...change }) : store.updateAppearance(change);
  const setBackdrop = (backdrop: GlassBackdrop, photo?: string | null) =>
    set(photo === undefined ? { backdrop } : { backdrop, photo });

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

  /** An on/off setting: Off first, like every other on/off row in the console. */
  const onOff = (
    key: 'appearance.glass' | 'appearance.motion',
    on: boolean,
    icons: [typeof Sun, typeof Sun],
    choose: (on: boolean) => void,
  ) => (
    <Segmented
      label={t(key)}
      value={on ? 'on' : 'off'}
      onValueChange={(next) => choose(next === 'on')}
      options={[
        { value: 'off', label: face(icons[0], t(`${key}.off`)) },
        { value: 'on', label: face(icons[1], t(`${key}.on`)) },
      ]}
    />
  );

  const render: Record<AppearanceRow, () => React.ReactNode> = {
    scheme: () => (
      <SettingRow label={t('appearance.scheme')} hint={t('appearance.schemeHint')}>
        <Segmented
          label={t('appearance.scheme')}
          value={appearance.scheme}
          onValueChange={(scheme) => set({ scheme })}
          options={(['light', 'dark', 'auto'] as const).map((scheme) => ({
            value: scheme,
            label: face(SCHEME_ICON[scheme], t(`appearance.scheme.${scheme}`)),
          }))}
        />
      </SettingRow>
    ),

    textSize: () => (
      <SettingRow label={t('appearance.textSize')}>
        <Segmented
          label={t('appearance.textSize')}
          value={appearance.textSize}
          onValueChange={(textSize) => set({ textSize })}
          options={TEXT_SIZES.map((size) => ({
            value: size,
            // Labelled, because the visible glyph is a letter "A" at three sizes and "A" is
            // not a name anybody can act on.
            label: 'A',
            ariaLabel: t(`appearance.textSize.${size}`),
            title: t(`appearance.textSize.${size}`),
            className: `min-w-10 ${SIZE_PREVIEW[size]}`,
          }))}
        />
      </SettingRow>
    ),

    density: () => (
      <SettingRow label={t('appearance.density')} hint={t('appearance.densityHint')}>
        <Segmented
          label={t('appearance.density')}
          value={appearance.density}
          onValueChange={(density) => set({ density })}
          options={DENSITIES.map((density) => ({
            value: density,
            label: face(DENSITY_ICON[density], t(`appearance.density.${density}`)),
          }))}
        />
      </SettingRow>
    ),

    contrast: () => (
      <SettingRow label={t('appearance.contrast')} hint={t('appearance.contrastHint')}>
        <Segmented
          label={t('appearance.contrast')}
          value={appearance.contrast}
          onValueChange={(contrast) => set({ contrast })}
          options={CONTRASTS.map((contrast) => ({
            value: contrast,
            label: face(CONTRAST_ICON[contrast], t(`appearance.contrast.${contrast}`)),
          }))}
        />
      </SettingRow>
    ),

    glass: () => (
      <>
        <SettingRow label={t('appearance.glass')} hint={t('appearance.glassHint')}>
          {onOff('appearance.glass', appearance.glass, [Square, Sparkles], (glass) => set({ glass }))}
        </SettingRow>

        {/* What the glass sits on: only while the glass is on. */}
        {appearance.glass ? (
          <SettingRow
            label={t('appearance.backdrop')}
            hint={t('appearance.backdrop.hint')}
            note={photoError ?? (preparing ? t('appearance.backdrop.preparing') : undefined)}
            noteTone={photoError ? 'warning' : 'muted'}
            noteAlert={photoError !== null}
          >
            <Segmented
              label={t('appearance.backdrop')}
              value={appearance.backdrop}
              onValueChange={(backdrop) => {
                // "Your photo" with none chosen yet asks for one first.
                if (backdrop === 'photo' && !appearance.photo) fileInput.current?.click();
                else setBackdrop(backdrop);
              }}
              options={GLASS_BACKDROPS.map((backdrop) => ({
                value: backdrop,
                label: face(BACKDROP_ICON[backdrop], t(`appearance.backdrop.${backdrop}`)),
                disabled: preparing,
              }))}
            />
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
              <span className="flex basis-full items-center justify-end gap-sm">
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
              </span>
            ) : null}
          </SettingRow>
        ) : null}
      </>
    ),

    motion: () => (
      <SettingRow
        label={t('appearance.motion')}
        hint={t('appearance.motionHint')}
        // Why "On" may still look still: the reason stays on the page, not behind the "i".
        note={appearance.motion && prefersReducedMotion() ? t('appearance.motionReduced') : undefined}
      >
        {onOff('appearance.motion', appearance.motion, [Pause, Play], (motion) => set({ motion }))}
      </SettingRow>
    ),
  };

  return (
    <>
      {rows.map((row) => (
        <Fragment key={row}>{render[row]()}</Fragment>
      ))}
    </>
  );
}
