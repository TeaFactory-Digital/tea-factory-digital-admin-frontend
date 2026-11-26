/**
 * A tile that sits behind whichever element is chosen and slides to the next one
 * (26 November 2026): the sidebar's open row, the chosen segment of a `Segmented`.
 *
 * The tile finds its container through its own `parentElement` rather than a ref handed down:
 * a parent's ref is attached after a child's layout effect has run on first mount, so the
 * tile would look before the container existed. It looks again whenever `watch` changes and
 * does nothing unless the chosen element is a different one; an element that only changes
 * size (density, a longer label in Sinhala) is the ResizeObserver's job.
 *
 * It never slides on first paint, or from nothing: it appears where it belongs, because a
 * tile flying in from a corner says nothing. The movement is a CSS transition, so the
 * Animations switch and reduced motion stop it with everything else (`theme.css`).
 */

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { MOTION_MS } from './motion';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useSlidingTile<T extends HTMLElement>(selector: string, watch: unknown) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [slide, setSlide] = useState(false);
  const current = useRef<HTMLElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  useLayoutEffect(() => {
    const root = ref.current?.parentElement;
    if (!root) return;
    const chosen = root.querySelector<HTMLElement>(selector);
    if (chosen === current.current) return;

    setSlide(current.current !== null && chosen !== null);
    current.current = chosen;
    observer.current?.disconnect();
    observer.current = null;
    if (!chosen) {
      setBox(null);
      return;
    }

    const measure = () =>
      setBox({ x: chosen.offsetLeft, y: chosen.offsetTop, w: chosen.offsetWidth, h: chosen.offsetHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    observer.current = new ResizeObserver(measure);
    observer.current.observe(root);
    observer.current.observe(chosen);
  }, [selector, watch]);

  useLayoutEffect(() => () => observer.current?.disconnect(), []);

  const style: CSSProperties | undefined = box
    ? {
        transform: `translate(${box.x}px, ${box.y}px)`,
        width: box.w,
        height: box.h,
        transitionDuration: slide ? `${MOTION_MS.base}ms` : undefined,
      }
    : undefined;

  /** For `className`: the transition, only while a slide is wanted. */
  const motion = slide ? 'transition-[transform,width,height] ease-move' : undefined;

  return { ref, shown: box !== null, style, motion };
}
