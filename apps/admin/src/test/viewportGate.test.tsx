/**
 * The viewport floor.
 *
 * Four things worth a test, because each of them fails silently in the direction
 * that matters:
 *
 *  - a phone reaching the console rather than the notice
 *  - the office's own 1366×768 laptop being told its screen is too small, which is
 *    the regression that would take the whole console down
 *  - a landscape phone slipping through a width-only check
 *  - the notice outliving the window that caused it — a desktop window dragged
 *    narrow and back has to return the console, not need a reload
 */

import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeConfig } from '@tfd/domain';
import { bundledConfig } from '@/config/defaults';

/** The mark is the only thing the notice reads from the config. */
const mocks = vi.hoisted(() => ({ config: null as unknown as RuntimeConfig }));

vi.mock('@/config/RuntimeConfigProvider', () => ({
  useRuntimeConfig: () => ({ config: mocks.config, loading: false, degraded: false }),
  useFactory: () => mocks.config.factory,
}));

const { ViewportGate, MIN_VIEWPORT_WIDTH, MIN_VIEWPORT_HEIGHT } = await import(
  '@/layout/ViewportGate'
);

const TOO_SMALL_TITLE = 'This screen is too small';
const CONSOLE_TEXT = 'the console';

/**
 * jsdom has no window manager, so the size is set directly and the event the real
 * browser would fire is dispatched by hand.
 */
function resizeTo(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

beforeEach(() => {
  mocks.config = bundledConfig;
  resizeTo(1366, 768);
});

describe('ViewportGate', () => {
  it('renders the console on the office laptop', () => {
    resizeTo(1366, 768);
    render(<ViewportGate>{CONSOLE_TEXT}</ViewportGate>);

    expect(screen.getByText(CONSOLE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(TOO_SMALL_TITLE)).not.toBeInTheDocument();
  });

  it('renders the console on a tablet in portrait, which is the floor itself', () => {
    resizeTo(MIN_VIEWPORT_WIDTH, 1024);
    render(<ViewportGate>{CONSOLE_TEXT}</ViewportGate>);

    expect(screen.getByText(CONSOLE_TEXT)).toBeInTheDocument();
  });

  it('blocks a phone, and does not mount what it is gating', () => {
    resizeTo(390, 844);
    render(<ViewportGate>{CONSOLE_TEXT}</ViewportGate>);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(TOO_SMALL_TITLE)).toBeInTheDocument();
    expect(screen.queryByText(CONSOLE_TEXT)).not.toBeInTheDocument();
  });

  it('blocks a landscape phone, which clears the width floor but not the height', () => {
    resizeTo(844, MIN_VIEWPORT_HEIGHT - 1);
    render(<ViewportGate>{CONSOLE_TEXT}</ViewportGate>);

    expect(screen.getByText(TOO_SMALL_TITLE)).toBeInTheDocument();
  });

  it('reports the measured size, so the office can read it back to support', () => {
    resizeTo(390, 844);
    render(<ViewportGate>{CONSOLE_TEXT}</ViewportGate>);

    expect(screen.getByText(/390 × 844/)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`${MIN_VIEWPORT_WIDTH} × ${MIN_VIEWPORT_HEIGHT}`)),
    ).toBeInTheDocument();
  });

  it('follows the window back over the floor without a reload', () => {
    resizeTo(600, 900);
    render(<ViewportGate>{CONSOLE_TEXT}</ViewportGate>);
    expect(screen.getByText(TOO_SMALL_TITLE)).toBeInTheDocument();

    resizeTo(1024, 900);
    expect(screen.getByText(CONSOLE_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(TOO_SMALL_TITLE)).not.toBeInTheDocument();
  });
});
