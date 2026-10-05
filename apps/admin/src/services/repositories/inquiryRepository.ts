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
  type InquiryMessage,
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
  messages?: InquiryMessage[];
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
  /*
   * The conversation. Served as `messages` by an API that keeps one (BACKEND-TODO #25);
   * otherwise built from the one question and the one answer, so the screen draws a
   * thread either way and only the ability to reply again depends on the API.
   */
  const threaded = Array.isArray(served.messages);
  const messages: InquiryMessage[] = threaded
    ? served.messages!
    : [
        {
          id: `${served.id}-question`,
          author: 'supplier',
          authorName: served.supplierName,
          body: served.message,
          createdAt: served.createdAt,
        },
        ...(reply
          ? [
              {
                id: `${served.id}-answer`,
                author: 'office' as const,
                authorName: reply.repliedByName || null,
                body: reply.body,
                createdAt: reply.repliedAt,
              },
            ]
          : []),
      ];

  return {
    ...served,
    reply,
    messages,
    threaded,
    createdById: served.createdById ?? null,
    createdByName: served.createdByName ?? null,
    closedAt: served.closedAt ?? null,
    closedByName: served.closedByName ?? null,
    closureNote: served.closureNote ?? null,
    assignedToId: served.assignedToId ?? null,
    assignedToName: served.assignedToName ?? null,
    notes: Array.isArray(served.notes) ? served.notes : [],
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

  assign: (id: string, assignToMe: boolean) => inquiryEndpoints.assign(id, assignToMe),

  addNote: async (id: string, body: string) => {
    const trimmed = body.trim();
    if (trimmed.length < 2) refuse({ field: 'body' });
    return inquiryEndpoints.addNote(id, trimmed);
  },

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
