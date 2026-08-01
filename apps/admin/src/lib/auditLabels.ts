/**
 * Audit actions → the copy that describes them.
 *
 * A dotted verb like `changeRequest.approve` is precise and unreadable. This maps
 * the ones the console produces; anything else falls through to the raw verb,
 * because an unlabelled action is far better than a hidden one — a new backend
 * action must show up in the log the day it ships, not the day someone adds a
 * string for it.
 */

const ACTION_KEYS: Record<string, string> = {
  'changeRequest.approve': 'audit.action.changeRequestApprove',
  'changeRequest.reject': 'audit.action.changeRequestReject',
  'supplier.update': 'audit.action.supplierUpdate',
  'supplier.suspend': 'audit.action.supplierSuspend',
  'supplier.reactivate': 'audit.action.supplierReactivate',
  'supplier.bankDetails.reveal': 'audit.action.supplierReveal',
  'delivery.batch.commit': 'audit.action.deliveryBatchCommit',
  'delivery.void': 'audit.action.deliveryVoid',
  'month.rate.enter': 'audit.action.rateSet',
  'month.exception.resolve': 'audit.action.monthExceptionResolve',
  'month.publish': 'audit.action.monthPublish',
};

export function auditActionLabel(action: string, t: (key: string) => string): string {
  const key = ACTION_KEYS[action];
  return key ? t(key) : action;
}
