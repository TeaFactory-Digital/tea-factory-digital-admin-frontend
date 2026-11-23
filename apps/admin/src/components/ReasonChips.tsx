/**
 * Reason chips for every reason or note box outside the decision dialogs (22 November 2026):
 * a void, a hold, other deductions, a counter request, an exception, a publish note, a
 * correction, opening balances, a transport rate, seeing a bank account, deduction rates,
 * a user's status or password, an office note on an inquiry, passing an inquiry up to the
 * manager or closing one unanswered. Each list is the factory's own
 * when it has saved one (Configuration, Common notes), else the built-in sentences here.
 */

import { useTranslation } from 'react-i18next';
import type { NoteSuggestionKey } from '@tfd/domain';
import { SuggestionGrid, type NoteSuggestion } from './SuggestionGrid';
import { useNoteSuggestions } from './useNoteSuggestions';

/** The built-in chips of each list, by slug; their words are `reasonChip.<list>.<slug>`. */
export const REASON_CHIPS = {
  'deliveries.void': ['wrongKgs', 'twice', 'wrongSupplier', 'wrongPoint'],
  'bills.hold': ['slipLine', 'approval', 'leaf', 'rate'],
  'bills.otherDeductions': ['society', 'canteen', 'seedlings', 'welfare'],
  'credit.walkIn': ['counter', 'phone', 'school', 'medical'],
  'months.exception': ['checked', 'bankForm', 'weighing', 'cash'],
  'months.publish': ['checked', 'late', 'manager'],
  'suppliers.correction': ['missedWeighing', 'wrongRate', 'writeOff', 'counter'],
  'suppliers.openingBalances': ['ledger', 'lastSlip', 'corrected'],
  'suppliers.transportRate': ['distance', 'ownVehicle', 'agreed'],
  'suppliers.revealBank': ['payment', 'supplierAsked', 'changeRequest'],
  'rates.proposal': ['management', 'costs', 'correction'],
  'rates.decision': ['checked', 'mismatch'],
  'users.status': ['left', 'leave', 'back', 'roleChange'],
  'users.resetPassword': ['forgot', 'locked', 'shared'],
  'inquiries.note': ['called', 'checking', 'manager'],
  'inquiries.escalate': ['money', 'records', 'complaint', 'rules'],
  'inquiries.close': ['duplicate', 'byPhone', 'noReply', 'notFactory'],
} as const satisfies Partial<Record<NoteSuggestionKey, readonly string[]>>;

export type ReasonList = keyof typeof REASON_CHIPS;

export function ReasonChips({
  list,
  value,
  onChange,
}: {
  list: ReasonList;
  value: string;
  onChange: (next: string) => void;
}) {
  const { t } = useTranslation();
  const builtIn: NoteSuggestion[] = REASON_CHIPS[list].map((slug) => ({
    label: t(`reasonChip.${list}.${slug}`),
    text: t(`reasonChip.${list}.${slug}.text`),
  }));
  const suggestions = useNoteSuggestions(list, builtIn);
  return <SuggestionGrid value={value} onChange={onChange} suggestions={suggestions} label={t('common.noteSuggestions')} />;
}
