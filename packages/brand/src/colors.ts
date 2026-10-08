/**
 * Semantic colour tokens — the same names as the mobile app's
 * `src/theme/colors.ts`, so the console and the app cannot disagree about what
 * `primary` means.
 *
 * The **neutrals and status steps** are the console's own: a cool grey canvas
 * with white cards, so the factory's brand colour is the only saturated thing on
 * a screen of grids. The brand tokens (`primary`, `secondary`) are untouched, and
 * a tenant still overrides any of them per scheme.
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

  /* ── Console-only: charts. ────────────────────────────────────────────── */
  /**
   * Categorical series colours, **assigned in this order and never cycled**.
   *
   * Not the brand: a donut of five queues needs five hues that stay apart for a
   * colour-blind reader, and a factory's primary/secondary pair was never chosen
   * for that. The order is the safety mechanism, validated as a set (adjacent CVD
   * ΔE ≥ 8 in both schemes), so a tenant overriding one slot should re-validate
   * the five rather than swap a single hue. A single-series chart uses `primary`.
   *
   * Three light slots sit under 3:1 against `surface`, so a chart drawn with them
   * always carries a labelled legend with the figures beside it.
   */
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export type ColorPalette = Record<ColorSchemeName, ColorTokens>;

export const baseColors: ColorPalette = {
  light: {
    primary: '#128C7E',
    primaryContrast: '#FFFFFF',
    primaryMuted: '#D6ECE8',

    secondary: '#25D366',
    secondaryContrast: '#04231F',

    background: '#F5F6F8',
    surface: '#FFFFFF',
    surfaceVariant: '#F2F4F7',

    textPrimary: '#0B0D12',
    textSecondary: '#667085',
    textInverse: '#FFFFFF',

    border: '#E7E9EE',
    divider: '#EEF0F3',

    success: '#067647',
    warning: '#B54708',
    error: '#C01F14',
    info: '#175CD3',

    successMuted: '#E7F8EF',
    warningMuted: '#FEF4E6',
    errorMuted: '#FEEDEC',
    infoMuted: '#EAF3FE',

    onStatus: '#FFFFFF',

    overlay: 'rgba(11, 13, 18, 0.45)',
    disabled: '#D0D5DD',
    disabledContrast: '#98A2B3',

    tableHeader: '#FAFBFC',
    tableRowHover: '#F7F8FA',
    tableRowAlt: '#FCFCFD',
    focusRing: '#0F766E',

    chart1: '#2A78D6',
    chart2: '#EB6834',
    chart3: '#1BAF7A',
    chart4: '#EDA100',
    chart5: '#E87BA4',
  },
  dark: {
    primary: '#1FB5A3',
    primaryContrast: '#04231F',
    primaryMuted: '#123330',

    secondary: '#25D366',
    secondaryContrast: '#04231F',

    background: '#0B0D12',
    surface: '#13161D',
    surfaceVariant: '#1B1F27',

    textPrimary: '#F2F4F7',
    textSecondary: '#98A2B3',
    textInverse: '#0B0D12',

    border: '#262B35',
    divider: '#1F232C',

    success: '#47CD89',
    warning: '#FDB022',
    error: '#F97066',
    info: '#53B1FD',

    successMuted: '#0E2A1D',
    warningMuted: '#2E2210',
    errorMuted: '#361614',
    infoMuted: '#0F2440',

    onStatus: '#0B0D12',

    overlay: 'rgba(0, 0, 0, 0.6)',
    disabled: '#344054',
    disabledContrast: '#7D8899',

    tableHeader: '#161A21',
    tableRowHover: '#1A1E26',
    tableRowAlt: '#15181F',
    focusRing: '#5EEAD4',

    chart1: '#3987E5',
    chart2: '#D95926',
    chart3: '#199E70',
    chart4: '#C98500',
    chart5: '#D55181',
  },
};

export const COLOR_TOKEN_NAMES = Object.keys(baseColors.light) as Array<keyof ColorTokens>;
