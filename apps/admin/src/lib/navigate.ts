/**
 * `useNavigate` with a smooth change of screen (23 November 2026): the page area fades and
 * slides as a row opens its record, through the browser's View Transitions, which React
 * Router starts for us. The sidebar and top bar stay still (`theme.css` names only `main`).
 * Off for anyone whose system asks for reduced motion, and simply instant in a browser
 * without View Transitions.
 */

import { useCallback } from 'react';
import { useNavigate as useRouterNavigate, type NavigateOptions, type To } from 'react-router-dom';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function useNavigate(): (to: To | number, options?: NavigateOptions) => void {
  const navigate = useRouterNavigate();
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      if (typeof to === 'number') {
        void navigate(to);
        return;
      }
      void navigate(to, { viewTransition: !prefersReducedMotion(), ...options });
    },
    [navigate],
  );
}
