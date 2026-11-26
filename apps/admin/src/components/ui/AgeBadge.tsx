/**
 * How long a request has waited, against the time the factory promises to answer it in
 * (26 November 2026): grey while there is time, amber from half the target, red past it.
 *
 * The red step was already on every queue; amber is new, so the request that is about to be
 * late is seen before it is. The target is on the badge's tooltip, so "why is this amber" has
 * an answer without opening anything.
 */

import { useTranslation } from 'react-i18next';
import { formatAge } from '@/lib/format';
import { Badge, type BadgeTone } from './Badge';

function ageTone(hours: number, targetHours: number): BadgeTone {
  if (hours > targetHours) return 'error';
  if (hours >= targetHours / 2) return 'warning';
  return 'neutral';
}

export function AgeBadge({ hours, targetHours }: { hours: number; targetHours: number }) {
  const { t } = useTranslation();
  return (
    <Badge tone={ageTone(hours, targetHours)} title={t('queue.ageTarget', { target: formatAge(targetHours) })}>
      {formatAge(hours)}
    </Badge>
  );
}
