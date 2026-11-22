/**
 * The refraction behind the Liquid Glass effect (22 November 2026): an SVG filter that bends
 * what is behind a glass pane, the way a thick lens bends the light at its edges. The CSS
 * applies it through `backdrop-filter: url(#tfd-liquid-glass)`, only in Chromium browsers
 * (Chrome, Edge: what the office uses), because elsewhere that value drops the blur with it.
 *
 * Rendered only while the effect is on. Hidden from assistive technology and takes no space.
 */

export function LiquidGlassFilter() {
  return (
    <svg aria-hidden focusable="false" width="0" height="0" className="pointer-events-none absolute">
      <filter id="tfd-liquid-glass" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        {/* A slow, smooth field: large gentle bends rather than ripples. */}
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves={2} seed={11} result="noise" />
        <feGaussianBlur in="noise" stdDeviation="3" result="field" />
        <feDisplacementMap in="SourceGraphic" in2="field" scale={42} xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}
