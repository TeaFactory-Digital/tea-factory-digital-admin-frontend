/**
 * M10 Inquiries — the queue gateway.
 *
 * Both writes validate before they leave, and both refusals the server answers are
 * `note-required`: a reply too short to be an answer, and a closure with no reason.
 * The console checks so the clerk is told in the dialog; the server checks because
 * that is the authority (§9.3).
 */

import {
  closeInquirySchema,
  inquiryReplySchema,
  type AdminInquiry,
  type CloseInquiryBody,
  type InquiryQuery,
  type InquiryReplyBody,
  type InquiryStatus,
  type Paged,
} from '@tfd/domain';
import { inquiryEndpoints } from '../endpoints/inquiries';
import type { StatusAck } from '../api/adapters';
import { ApiError } from '../api/errors';

function refuse(details: unknown): never {
  throw new ApiError({
    code: 'note-required',
    message: 'A reply is required.',
    details,
  });
}

export const inquiryRepository = {
  /** Open first and oldest first — the message that has waited longest is the one to answer. */
  list: (query: InquiryQuery = {}): Promise<Paged<AdminInquiry>> =>
    inquiryEndpoints.list({ page: 0, pageSize: 25, status: 'open', ...query }),

  /** One inquiry, by id. The list sweep this used to need is gone — **G-06** is closed. */
  get: (id: string): Promise<AdminInquiry> => inquiryEndpoints.get(id),

  reply: async (id: string, body: InquiryReplyBody): Promise<StatusAck<InquiryStatus>> => {
    const parsed = inquiryReplySchema.safeParse(body);
    if (!parsed.success) refuse(parsed.error.flatten());
    return inquiryEndpoints.reply(id, body);
  },

  close: async (id: string, body: CloseInquiryBody): Promise<StatusAck<InquiryStatus>> => {
    const parsed = closeInquirySchema.safeParse(body);
    if (!parsed.success) refuse(parsed.error.flatten());
    return inquiryEndpoints.close(id, body);
  },
};
