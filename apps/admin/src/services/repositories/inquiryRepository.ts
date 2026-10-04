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

/**
 * The served inquiry into the console's.
 *
 * The API sends the answer **flat** (`replyBody`, `repliedByName`, `repliedAt`) where the
 * console reads one `reply` object, and leaves out `createdById`, `createdByName` and
 * `closedByName`. Passed through as it was, `inquiry.reply` was always undefined: a
 * message that had been answered showed no answer, and offered nothing to explain why.
 * The nested shape is still accepted, for an API that starts sending it.
 */
type ServedInquiry = AdminInquiry & {
  replyBody?: string | null;
  repliedById?: string | null;
  repliedByName?: string | null;
  repliedAt?: string | null;
};

function toAdminInquiry(served: ServedInquiry): AdminInquiry {
  const reply =
    served.reply ??
    (served.replyBody
      ? {
          body: served.replyBody,
          repliedById: served.repliedById ?? '',
          repliedByName: served.repliedByName ?? '',
          repliedAt: served.repliedAt ?? '',
        }
      : null);
  return {
    ...served,
    reply,
    createdById: served.createdById ?? null,
    createdByName: served.createdByName ?? null,
    closedAt: served.closedAt ?? null,
    closedByName: served.closedByName ?? null,
    closureNote: served.closureNote ?? null,
  };
}

export const inquiryRepository = {
  /** Open first and oldest first — the message that has waited longest is the one to answer. */
  list: async (query: InquiryQuery = {}): Promise<Paged<AdminInquiry>> => {
    const page = await inquiryEndpoints.list({ page: 0, pageSize: 25, status: 'open', ...query });
    return { ...page, items: page.items.map((row) => toAdminInquiry(row as ServedInquiry)) };
  },

  /** One inquiry, by id. The list sweep this used to need is gone — **G-06** is closed. */
  get: async (id: string): Promise<AdminInquiry> =>
    toAdminInquiry((await inquiryEndpoints.get(id)) as ServedInquiry),

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
