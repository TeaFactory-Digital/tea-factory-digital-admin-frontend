/**
 * What a pending change would cost, shown **before** it is saved.
 *
 * The whole difficulty of M14 is that its edits reach across every other module, and the
 * person making them cannot see any of those modules from here. So a toggle is not the
 * control — the sentence next to it is: *"9 suppliers hold LKR 412,000 in savings"* is what
 * makes "turn savings off" a decision rather than a click.
 *
 * Two severities, and the difference is money.
 *
 *  - **Blocks** — the change would hide records the factory still owes suppliers, so the
 *    save is refused here and by the API (`flag-has-records`, `point-in-use`). A liability
 *    disappearing from the only screen that reports it is not a preference.
 *  - **Warns** — a surface disappears end to end (AC-07), or a content language stops
 *    being counted as a gap. Real consequences a factory is entitled to choose.
 *
 * Rendered from the **shared** `configImpact`, which is also what the server refuses with,
 * so the warning and the refusal can never name different things. A console that warned
 * about one problem while the API refused on another would teach the office to stop
 * reading the warnings.
 */

import { useTranslation } from 'react-i18next';
import { Ban, TriangleAlert } from 'lucide-react';
import type { ConfigImpact } from '@tfd/domain';

export function ImpactList({ impacts }: { impacts: ConfigImpact[] }) {
  const { t } = useTranslation();
  if (impacts.length === 0) return null;

  return (
    // `role="alert"` so a blocked save is announced, not only shown — the button next to
    // this list goes disabled at the same moment and the reason has to reach a reader who
    // is not looking at it.
    <ul role="alert" className="flex flex-col gap-xs">
      {impacts.map((impact, index) => (
        <li
          key={`${impact.field}-${index}`}
          className={
            impact.severity === 'blocks'
              ? 'flex items-start gap-xs rounded-md bg-error-muted px-md py-sm text-body-small text-error'
              : 'flex items-start gap-xs rounded-md bg-warning-muted px-md py-sm text-body-small text-warning'
          }
        >
          {impact.severity === 'blocks' ? (
            <Ban className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          ) : (
            <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
          )}
          {/* The server sends a key and its parameters, never a sentence — the console
              localizes (BR-110) and this payload is shared with an API that has no string
              table at all. */}
          <span>{t(impact.messageKey, impact.params)}</span>
        </li>
      ))}
    </ul>
  );
}
