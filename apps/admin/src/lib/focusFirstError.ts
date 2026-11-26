/**
 * After a save the form refused (26 November 2026): the first field with a problem, focused
 * and scrolled to the middle of the view.
 *
 * A long form (a new supplier, with bank details below the fold) used to mark its errors and
 * leave the clerk where they were, looking at a button that did nothing. Each `Field` tags
 * its error with the control it belongs to (`data-field-error`), so this finds the first one
 * in the open dialog, or on the page, whatever kind of control it is.
 *
 * Called from the submit handler after the errors are shown; a frame later, once React has
 * drawn them.
 */

import { motionAllowed } from './motion';

export function focusFirstError(): void {
  requestAnimationFrame(() => {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"]');
    const scope: ParentNode = dialogs[dialogs.length - 1] ?? document;
    const error = scope.querySelector<HTMLElement>('[data-field-error]');
    const control =
      (error?.dataset.fieldError ? document.getElementById(error.dataset.fieldError) : null) ??
      scope.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!control) return;
    control.focus({ preventScroll: true });
    control.scrollIntoView({ block: 'center', behavior: motionAllowed() ? 'smooth' : 'auto' });
  });
}
