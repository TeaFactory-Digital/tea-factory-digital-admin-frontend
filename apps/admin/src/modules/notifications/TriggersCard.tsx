/**
 * What this factory sends without anybody pressing anything.
 *
 * **This card is the console's answer to §21.24**, and it is deliberately an answer the
 * factory can change rather than one the code assumed. The question — does the office
 * compose every send, or does "your bill is ready" fire off the publish step? — has not
 * been answered, so both paths exist and this is where the choice lives. When the factory
 * decides, somebody flips a switch; nobody opens an editor.
 *
 * Each row names **the event it fires from**, because that is the only thing that makes
 * the toggle comprehensible. "Bill published — on" is a setting; "Bill published — fires
 * when a month is published in Rates & month close" is a decision somebody can take.
 *
 * A category the tenant has not configured is shown **disabled with a reason**, not
 * hidden: `hillcountry` has push turned on and no categories at all, and a factory that
 * cannot see the row would assume the notification is simply off rather than that nobody
 * has set the module up (M14's job).
 */

import { useTranslation } from 'react-i18next';
import { Zap } from 'lucide-react';
import type { NotificationTrigger } from '@tfd/domain';
import { useCan } from '@/auth/authStore';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { ErrorState, Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useNotificationTriggers, useSetNotificationTrigger } from './hooks';

export function TriggersCard() {
  const { t } = useTranslation();
  const toast = useToast();
  // §12.1's `content: A` — deciding that every supplier's phone buzzes when a month
  // closes is a factory-administrator decision, not an editor's.
  const canChange = useCan('content', 'approve');

  const triggers = useNotificationTriggers();
  const set = useSetNotificationTrigger();

  async function toggle(trigger: NotificationTrigger, enabled: boolean) {
    try {
      await set.mutateAsync({ category: trigger.category, enabled });
      toast.success(
        enabled
          ? t('notifications.triggerOn', { category: t(`notifications.category.${trigger.category}`) })
          : t('notifications.triggerOff', {
              category: t(`notifications.category.${trigger.category}`),
            }),
      );
    } catch (cause) {
      toast.error(t('notifications.triggerFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <Card>
      <CardHeader
        title={t('notifications.triggersTitle')}
        description={t('notifications.triggersDescription')}
      />
      <CardBody className="flex flex-col gap-md">
        {triggers.isPending ? (
          <div className="flex justify-center py-lg">
            <Spinner />
          </div>
        ) : triggers.error ? (
          <ErrorState error={triggers.error} onRetry={() => void triggers.refetch()} compact />
        ) : (
          <ul className="flex flex-col divide-y divide-divider">
            {(triggers.data ?? []).map((trigger) => (
              <li key={trigger.category} className="flex flex-wrap items-start gap-sm py-sm">
                <Zap
                  className={
                    trigger.enabled && trigger.available
                      ? 'mt-xxs size-icon-sm shrink-0 text-primary'
                      : 'mt-xxs size-icon-sm shrink-0 text-text-secondary'
                  }
                  aria-hidden
                />

                <span className="flex min-w-0 flex-1 flex-col gap-xxs">
                  <span className="text-body-small font-medium text-text-primary">
                    {t(`notifications.category.${trigger.category}`)}
                  </span>
                  {/* The event, in words. A toggle whose trigger is unnamed is a setting
                      nobody can reason about. */}
                  <span className="text-caption text-text-secondary">
                    {t(`notifications.event.${trigger.category}`)}
                  </span>
                  {trigger.updatedAt ? (
                    <span className="text-caption text-text-secondary">
                      {t('notifications.triggerChanged', {
                        name: trigger.updatedByName ?? '—',
                        when: formatDateTime(trigger.updatedAt),
                      })}
                    </span>
                  ) : null}
                </span>

                {!trigger.available ? (
                  // Shown, not hidden: "this factory has not configured push" and "the
                  // factory turned it off" are different answers.
                  <Badge tone="neutral">{t('notifications.notConfigured')}</Badge>
                ) : canChange ? (
                  <label className="flex shrink-0 items-center gap-xs text-label text-text-primary">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={trigger.enabled}
                      disabled={set.isPending}
                      onChange={(event) => void toggle(trigger, event.target.checked)}
                    />
                    {trigger.enabled ? t('notifications.on') : t('notifications.off')}
                  </label>
                ) : (
                  <Badge tone={trigger.enabled ? 'success' : 'neutral'}>
                    {trigger.enabled ? t('notifications.on') : t('notifications.off')}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}

        {!canChange ? (
          <p className="border-t border-divider pt-md text-caption text-text-secondary">
            {t('notifications.triggersNeedAdmin')}
          </p>
        ) : null}

        {/* §21.24 stated where the decision is made, rather than only in the docs. */}
        <p className="rounded-md bg-surface-variant px-md py-sm text-caption text-text-secondary">
          {t('notifications.openQuestion')}
        </p>
      </CardBody>
    </Card>
  );
}
