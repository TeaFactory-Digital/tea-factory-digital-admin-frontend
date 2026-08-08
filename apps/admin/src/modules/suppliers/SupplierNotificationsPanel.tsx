/**
 * Why a push would or would not reach **this** supplier.
 *
 * **The answer to the most common support call there is**, and v1 could not give it.
 * *"Nobody told me my account was ready."* There are four possible reasons and the
 * console held every fact needed for all four — the device registry, the tenant's
 * category list, each device's consent list and the send log — while exposing them only
 * in aggregate. M13's reach panel can say *"reaches 61 devices, 6 opted out"* and cannot
 * name one of the six.
 *
 * So the panel is built as a **diagnosis, not a dump**. Each category gets one line
 * saying whether it reaches this supplier, and when it does not, which of the reasons it
 * is — because the reasons have different fixes and different conversations:
 *
 * | Reason | What the office does |
 * | --- | --- |
 * | No device at all | Help them install it. Nothing else here matters |
 * | The factory does not send this category | M14. Not the supplier's doing, and telling them to check their phone would waste both their time |
 * | Every device opted out | Their setting, on their phone. The office can explain it and cannot change it |
 * | Reachable, but nothing was sent | The send log below. A perfectly reachable supplier is still not told if nobody told them |
 *
 * That last row is why `recentSends` is on the panel rather than being left to M13: a
 * clean diagnosis and an empty log is a complete answer, and the two halves have to be
 * on one screen to be read as one.
 *
 * **No push token anywhere.** It is a credential, nothing in the office can act on one,
 * and §20.4's argument about account numbers applies unchanged.
 */

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { BellOff, Check, Smartphone, X } from 'lucide-react';
import type { SupplierCategoryReach } from '@tfd/domain';
import { Badge } from '@/components/ui/Badge';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, Notice, Skeleton } from '@/components/ui/states';
import { formatDate, formatDateTime } from '@/lib/format';
import { useSupplierNotifications } from './hooks';

/**
 * The reason a category does not reach, as a key — or `null` when it does.
 *
 * Ordered, and the order is the diagnosis: no device makes every other question moot,
 * and a category the factory does not send is not the supplier's doing. Asking them in
 * the other order sends a clerk to the supplier's phone settings for a problem that is
 * in M14.
 */
function reasonKeyFor(reach: SupplierCategoryReach, hasApp: boolean): string | null {
  if (reach.reachable) return null;
  if (!hasApp) return 'suppliers.push.reason.noDevice';
  if (!reach.offeredByFactory) return 'suppliers.push.reason.notOffered';
  return 'suppliers.push.reason.optedOut';
}

export function SupplierNotificationsPanel({ supplierId }: { supplierId: string }) {
  const { t } = useTranslation();
  const query = useSupplierNotifications(supplierId);

  // Silent on a 403, like `AuditPanel`: a role that may read a supplier but not their
  // device registry should get no panel rather than an error across the record.
  if (query.error) return null;

  return (
    <Card>
      <CardHeader
        title={t('suppliers.push.title')}
        description={t('suppliers.push.subtitle')}
      />
      <CardBody className="flex flex-col gap-md">
        {query.isPending || !query.data ? (
          <div className="flex flex-col gap-xs">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : !query.data.hasApp ? (
          /**
           * The commonest answer, and it ends the enquiry — so it is said on its own
           * rather than as four "not reachable" rows the reader has to interpret.
           */
          <Notice tone="info">
            <span className="inline-flex items-center gap-xs">
              <BellOff className="size-icon-sm shrink-0" aria-hidden />
              {t('suppliers.push.noApp')}
            </span>
          </Notice>
        ) : (
          <>
            <div className="flex flex-col gap-xs">
              <p className="text-overline uppercase text-text-secondary">
                {t('suppliers.push.devices')}
              </p>
              <ul className="flex flex-wrap gap-sm">
                {query.data.devices.map((device) => (
                  <li
                    key={device.id}
                    className="inline-flex items-center gap-xs rounded-md border border-border px-sm py-xxs"
                  >
                    <Smartphone className="size-icon-xs text-text-secondary" aria-hidden />
                    <span className="text-caption text-text-primary">
                      {t(`suppliers.push.platform.${device.platform}`)}
                    </span>
                    {/* Registered, not last-seen — the platform does not track the
                        second, and approximating it would invite the office to
                        conclude a supplier had abandoned the app. */}
                    <span className="numeric text-caption text-text-secondary">
                      {t('suppliers.push.registered', { when: formatDate(device.registeredAt) })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="flex flex-col divide-y divide-divider">
              {query.data.categories.map((reach) => {
                const reasonKey = reasonKeyFor(reach, query.data!.hasApp);
                return (
                  <li key={reach.category} className="flex items-center gap-sm py-sm">
                    {reach.reachable ? (
                      <Check className="size-icon-sm shrink-0 text-success" aria-hidden />
                    ) : (
                      <X className="size-icon-sm shrink-0 text-text-secondary" aria-hidden />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body-small text-text-primary">
                        {t(`notifications.category.${reach.category}`)}
                      </span>
                      {/* The *reason*, not just the verdict. "Not reachable" sends a
                          clerk looking; the reason tells them where. */}
                      {reasonKey ? (
                        <span className="text-caption text-text-secondary">{t(reasonKey)}</span>
                      ) : (
                        <span className="text-caption text-text-secondary">
                          {t('suppliers.push.onDevices', { count: reach.deviceCount })}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-col gap-xs">
              <p className="text-overline uppercase text-text-secondary">
                {t('suppliers.push.recent')}
              </p>
              {query.data.recentSends.length === 0 ? (
                /**
                 * A clean diagnosis above and nothing here is a **complete** answer:
                 * everything works and the supplier was never told. Without this the
                 * panel would show four green ticks and leave the office insisting the
                 * message must have arrived.
                 */
                <EmptyState
                  title={t('suppliers.push.noSends')}
                  body={t('suppliers.push.noSendsHint')}
                />
              ) : (
                <ul className="flex flex-col divide-y divide-divider">
                  {query.data.recentSends.map((send) => (
                    <li key={send.id} className="flex items-start gap-sm py-sm">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-body-small text-text-primary">{send.title}</span>
                        <span className="numeric text-caption text-text-secondary">
                          {formatDateTime(send.sentAt)} ·{' '}
                          {t(`notifications.category.${send.category}`)}
                        </span>
                      </span>
                      {send.deliveredToDevices > 0 ? (
                        <Badge tone="success">
                          {t('suppliers.push.delivered', { count: send.deliveredToDevices })}
                        </Badge>
                      ) : (
                        // The row that matters: a send that reached hundreds and reached
                        // *this* supplier's phone not at all. An aggregate log cannot
                        // show it, which is why the field is per-supplier on the wire.
                        <Badge tone="warning">
                          {t(
                            send.suppressedReason === 'noDevice'
                              ? 'suppliers.push.notDeliveredNoDevice'
                              : 'suppliers.push.notDeliveredOptedOut',
                          )}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <p className="text-caption text-text-secondary">
              <Link to="/notifications" className="text-primary underline-offset-2 hover:underline">
                {t('suppliers.push.openModule')}
              </Link>
            </p>
          </>
        )}
      </CardBody>
    </Card>
  );
}
