/**
 * M10 hooks.
 *
 * The narrowest invalidation in the console, and deliberately so. Answering a
 * message changes the message, the queue it was in and the dashboard badge — and
 * nothing else. An inquiry carries no money, touches no supplier record, and moves
 * no ceiling, so a wider sweep here would just refetch screens that cannot have
 * changed.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CloseInquiryBody, InquiryQuery, InquiryReplyBody } from '@tfd/domain';
import { inquiryRepository } from '@/services/repositories/inquiryRepository';
import { auditRepository } from '@/services/repositories/auditRepository';
import { qk } from '@/query/queryKeys';

export function useInquiries(query: InquiryQuery) {
  return useQuery({
    queryKey: qk.inquiries.list(query),
    queryFn: () => inquiryRepository.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useInquiry(id: string | undefined) {
  return useQuery({
    queryKey: qk.inquiries.detail(id ?? ''),
    queryFn: () => inquiryRepository.get(id!),
    enabled: Boolean(id),
  });
}

export function useInquiryAudit(id: string | undefined) {
  return useQuery({
    queryKey: qk.audit.forEntity('inquiry', id ?? ''),
    queryFn: () => auditRepository.forEntity('inquiry', id!),
    enabled: Boolean(id),
    throwOnError: false,
    retry: false,
  });
}

export type InquiryVerb = 'reply' | 'close';

export function useAnswerInquiry(id: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (variables: { verb: 'reply'; body: InquiryReplyBody } | { verb: 'close'; body: CloseInquiryBody }) =>
      variables.verb === 'reply'
        ? inquiryRepository.reply(id, variables.body)
        : inquiryRepository.close(id, variables.body),

    onSuccess: () => {
      void client.invalidateQueries({ queryKey: qk.inquiries.detail(id) });
      void client.invalidateQueries({ queryKey: qk.inquiries.all });
      void client.invalidateQueries({ queryKey: qk.audit.forEntity('inquiry', id) });
      void client.invalidateQueries({ queryKey: qk.dashboard });
    },

    onError: (error: unknown) => {
      // Someone else answered it while this was open. Pull their answer in, so the
      // clerk reads what the supplier was actually told rather than a stale form.
      if (error && typeof error === 'object' && 'code' in error && error.code === 'already-decided') {
        void client.invalidateQueries({ queryKey: qk.inquiries.detail(id) });
        void client.invalidateQueries({ queryKey: qk.inquiries.all });
      }
    },
  });
}
