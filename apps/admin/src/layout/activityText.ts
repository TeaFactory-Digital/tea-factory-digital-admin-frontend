/**
 * Where an activity item opens and the words it is told in, shared by the bell and the
 * desktop alerts (23 November 2026) so the two never disagree.
 */

import type { TFunction } from 'i18next';
import type { ActivityItem } from '@tfd/domain';
import { formatAmount } from '@/lib/format';

/** Tea packets have no detail screen; an account event opens the supplier. */
export function activityPath(item: ActivityItem): string {
  switch (item.kind) {
    case 'creditRequest.created':
    case 'creditRequest.cancelled':
      return `/credit/${item.entityId}`;
    case 'teaPacket.created':
    case 'teaPacket.cancelled':
      return '/tea-packets';
    case 'changeRequest.created':
      return `/change-requests/${item.entityId}`;
    case 'inquiry.created':
    case 'inquiry.replied':
      return `/inquiries/${item.entityId}`;
    case 'supplier.appDeletionRequested':
      return `/suppliers/${item.supplierId}`;
  }
}

export function activitySentence(item: ActivityItem, t: TFunction): string {
  return t(`bell.kind.${item.kind}`, {
    name: item.supplierName,
    code: item.supplierCode,
    facility: item.facility ? t(`credit.facility.${item.facility}`) : '',
    amount: item.amount !== undefined ? formatAmount(item.amount) : '',
    change: item.changeType ? t(`changeRequests.type.${item.changeType}`) : '',
    subject: item.subject ?? '',
  });
}
