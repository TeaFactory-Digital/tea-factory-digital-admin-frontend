/**
 * Where the console's figures come from, and how current they are.
 *
 * This used to be a full-width banner across the top of every screen. It was right to
 * exist and wrong to be permanent: on a deployment that has not synced yet it sat over
 * every page for weeks, and a banner that never changes is a banner nobody reads. The
 * shell now carries a small chip in the top bar (`SyncStatusChip`) while something is
 * wrong, and the full explanation lives here, one click away.
 *
 * No capability gate: anyone who can see a figure may ask where it came from.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, PlugZap } from 'lucide-react';
import type { FactorySyncState } from '@tfd/domain';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatDate, formatDateTime } from '@/lib/format';
import { cn } from '@/lib/cn';
import { useFactorySync } from '@/layout/useFactorySync';

/** The sync's three states, plus `direct`: no sync configured, nothing to be behind. */
type View = FactorySyncState | 'direct';

const TONES: Record<View, BadgeTone> = {
  direct: 'success',
  fresh: 'success',
  stale: 'warning',
  never: 'error',
};

const ICONS = {
  direct: CheckCircle2,
  fresh: CheckCircle2,
  stale: AlertTriangle,
  never: PlugZap,
} satisfies Record<View, unknown>;

const ICON_COLOURS: Record<View, string> = {
  direct: 'bg-success-muted text-success',
  fresh: 'bg-success-muted text-success',
  stale: 'bg-warning-muted text-warning',
  never: 'bg-error-muted text-error',
};

export function DataStatusScreen() {
  const { t } = useTranslation();
  const { status, state, configured } = useFactorySync();
  const view: View = configured ? state : 'direct';
  const Icon = ICONS[view];

  const when = formatDateTime(status?.lastSucceededAt);
  const covers = formatDate(status?.coversUpTo);
  const body = !configured
    ? t('dataStatus.directBody')
    : state === 'never'
      ? t('shell.syncNever')
      : state === 'stale'
        ? t('shell.syncStale', { when, covers })
        : t('sync.freshAsOf', { when, covers });

  const rows: Array<[string, string | null | undefined, (value: string) => string]> = [
    [t('dataStatus.lastSucceeded'), status?.lastSucceededAt, formatDateTime],
    [t('dataStatus.lastAttempted'), status?.lastAttemptedAt, formatDateTime],
    [t('dataStatus.coversUpTo'), status?.coversUpTo, formatDate],
  ];

  return (
    <>
      <PageHeader title={t('dataStatus.title')} description={t('dataStatus.subtitle')} />

      <div className="flex max-w-dialog-wide flex-col gap-lg">
        <Card>
          <CardBody className="flex items-start gap-md">
            <span
              className={cn(
                'flex size-12 shrink-0 items-center justify-center rounded-full',
                ICON_COLOURS[view],
              )}
            >
              <Icon className="size-icon-md" aria-hidden />
            </span>
            <div className="flex flex-col gap-xs">
              <div className="flex flex-wrap items-center gap-sm">
                <h2 className="text-subtitle text-text-primary">
                  {t(`dataStatus.heading.${view}`)}
                </h2>
                <Badge tone={TONES[view]}>{t(`dataStatus.state.${view}`)}</Badge>
              </div>
              <p className="text-body-small text-text-secondary">{body}</p>
            </div>
          </CardBody>
        </Card>

        {configured ? (
          <Card>
            <CardHeader title={t('dataStatus.detailsTitle')} />
            <CardBody>
              <dl className="grid grid-cols-1 gap-md sm:grid-cols-3">
                {rows.map(([label, value, format]) => (
                  <div key={label} className="flex flex-col gap-xxs">
                    <dt className="text-caption text-text-secondary">{label}</dt>
                    <dd className="numeric text-body-small text-text-primary">
                      {value ? format(value) : t('dataStatus.notYet')}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardBody>
          </Card>
        ) : null}

        <Card>
          <CardHeader title={t('dataStatus.howTitle')} />
          <CardBody>
            <p className="text-body-small text-text-secondary">{t('dataStatus.howBody')}</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
