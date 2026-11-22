/**
 * Keys for working a queue item by item (22 November 2026): A approve, R reject, J the next
 * item, K the previous one. Ignored while typing in a field, while a dialog is open, and
 * with Ctrl, Cmd or Alt held, so it never takes a letter meant for something else.
 */

import { useEffect, useRef } from 'react';

export interface QueueKeyActions {
  onApprove?: () => void;
  onReject?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useQueueKeys(actions: QueueKeyActions, enabled = true): void {
  // The latest handlers, without re-binding the listener on every render.
  const latest = useRef(actions);
  latest.current = actions;

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      const handler = {
        a: latest.current.onApprove,
        r: latest.current.onReject,
        j: latest.current.onNext,
        k: latest.current.onPrevious,
      }[event.key.toLowerCase()];
      if (!handler) return;
      event.preventDefault();
      handler();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
