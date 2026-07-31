/**
 * Semantic colour tokens — a verbatim port of the mobile app's
 * `src/theme/colors.ts`, so the console and the app cannot disagree about what
 * `primary` means.
 *
 * Rules (architecture.md §4):
 *  - **Never hardcode a colour in a component.** Consume a semantic token.
 *  - Tokens are semantic (what the colour is FOR), not literal (what it IS).
 *    That is what lets a factory re-map the palette without touching a screen.
 *
 * The console adds a small number of tokens the app has no need for, marked
 * below — a data grid has surfaces a phone screen does not (sticky headers, row
 * hover, zebra striping). They default off the existing palette so a client
 * that overrides nothing still gets a coherent grid.
 */

export type ColorSchemeName = 'light' | 'dark';

export interface ColorTokens {
  /** Brand / call-to-action colour. */
  primary: string;
  /** Foreground placed on top of `primary`. */
  primaryContrast: string;
  /** Muted/tinted variant of primary for backgrounds, chips, etc. */
  primaryMuted: string;

  secondary: string;
  secondaryContrast: string;

  /** Page background (behind all surfaces). */
  background: string;
  /** Card / panel / elevated surface. */
  surface: string;
  /** Alternate surface (inputs, subtle fills). */
  surfaceVariant: string;

  textPrimary: string;
  textSecondary: string;
  textInverse: string;

  border: string;
  divider: string;

  success: string;
  warning: string;
  error: string;
  info: string;

  successMuted: string;
  warningMuted: string;
  errorMuted: string;
  infoMuted: string;

  /** Foreground for content placed on a status colour. */
  onStatus: string;

  overlay: string;
  disabled: string;
  disabledContrast: string;

  /* ── Console-only: the data grid. ─────────────────────────────────────── */
  /** Sticky table header fill. */
  tableHeader: string;
  /** Row hover — the console is keyboard-driven, so this doubles as focus. */
  tableRowHover: string;
  /** Zebra striping on dense grids. */
  tableRowAlt: string;
  /** Keyboard focus ring. Contrast against both `surface` and `primary`. */
  focusRing: string;
}

export type ColorPalette = Record<ColorSchemeName, ColorTokens>;

export const baseColors: ColorPalette = {
  light: {
    primary: '#128C7E',
    primaryContrast: '#FFFFFF',
    primaryMuted: '#D6ECE8',

    secondary: '#25D366',
    secondaryContrast: '#04231F',

    background: '#F2F5F4',
    surface: '#FFFFFF',
    surfaceVariant: '#E9EEEC',

    textPrimary: '#0B1F1C',
    textSecondary: '#5A6B67',
    textInverse: '#FFFFFF',

    border: '#D8E0DD',
    divider: '#E4EAE8',

    success: '#2E7D32',
    warning: '#ED6C02',
    error: '#D32F2F',
    info: '#0288D1',

    successMuted: '#DCF0DD',
    warningMuted: '#FCEBD5',
    errorMuted: '#FADBDB',
    infoMuted: '#D6ECF8',

    onStatus: '#FFFFFF',

    overlay: 'rgba(11, 31, 28, 0.5)',
    disabled: '#C2CCC9',
    disabledContrast: '#7C8783',

    tableHeader: '#EDF2F0',
    tableRowHover: '#F5F9F8',
    tableRowAlt: '#FAFCFB',
    focusRing: '#0F766E',
  },
  dark: {
    primary: '#1FB5A3',
    primaryContrast: '#04231F',
    primaryMuted: '#123330',

    secondary: '#25D366',
    secondaryContrast: '#04231F',

    background: '#0B1414',
    surface: '#121D1B',
    surfaceVariant: '#1B2A27',

    textPrimary: '#ECF3F1',
    textSecondary: '#9BB0AB',
    textInverse: '#0B1414',

    border: '#26332F',
    divider: '#1E2C29',

    success: '#66BB6A',
    warning: '#FFA726',
    error: '#EF5350',
    info: '#29B6F6',

    successMuted: '#173A22',
    warningMuted: '#3A2A12',
    errorMuted: '#3A1B1B',
    infoMuted: '#11303F',

    onStatus: '#04231F',

    overlay: 'rgba(0, 0, 0, 0.6)',
    disabled: '#3A4744',
    disabledContrast: '#75827E',

    tableHeader: '#172422',
    tableRowHover: '#1A2826',
    tableRowAlt: '#141F1E',
    focusRing: '#5EEAD4',
  },
};

export const COLOR_TOKEN_NAMES = Object.keys(baseColors.light) as Array<keyof ColorTokens>;
