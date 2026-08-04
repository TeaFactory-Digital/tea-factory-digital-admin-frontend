/**
 * The bundled brand artwork.
 *
 * One file, served from `public/`, referenced by URL rather than imported: the
 * favicon link in `index.html` and the static boot splash both need it *before*
 * any module has been evaluated, and neither can reach a Vite import. Keeping the
 * app's own references on the same URL means there is exactly one copy of the
 * mark in the bundle and one entry in the browser's cache.
 *
 * This does not weaken the white-label rule. It is a **default**, not a source of
 * truth: a factory that uploads its own artwork sets `branding.logoUrl` in M14,
 * `GET /config` serves it, and the served value wins everywhere (see `Logo`).
 * What the default buys is that a console with no artwork configured — every
 * console on its first day — draws a tea mark instead of two grey letters.
 */

/** The mark: two tea leaves over a cup. Sharp from 16 px to a splash screen. */
export const BUNDLED_LOGO_URL = '/brand/logo.svg';
