/**
 * M10 Inquiries — the supplier's messages to the office.
 *
 * The module that completes the promise the rest of the console makes: every
 * `pending` in the app is a queue here. An inquiry is the one that carries no
 * money, which is why it has no four-eyes rule and no ceiling — and why the whole
 * module is two verbs.
 *
 * **Reply and close are different acts, not one with a flag.** Replying answers the
 * supplier; closing files a message that needed no answer. Collapsing them would
 * make "how many did we actually answer" unanswerable, and that is the number
 * §19.3's channel-shift KPI is about.
 */

import type {
  AdminInquiry,
  CloseInquiryBody,
  InquiryQuery,
  InquiryReplyBody,
  InquiryStatus,
  Paged,
} from '@tfd/domain';
import { apiClient } from '../api/client';
import type { StatusAck } from '../api/adapters';
import { toParams } from './params';

export const inquiryEndpoints = {
  /** One inquiry, decided or not — a bookmarked link must open (**G-06**, now served). */
  get: (id: string) =>
    apiClient.get<AdminInquiry>(`/admin/inquiries/${id}`).then((response) => response.data),

  list: (query: InquiryQuery) =>
    apiClient
      .get<Paged<AdminInquiry>>('/admin/inquiries', { params: toParams(query) })
      .then((response) => response.data),

  /** One inquiry, by id. Absent for a while (gap **G-06**), so the repository swept the list. */

  /**
   * `409 already-decided` when the message has already been answered or closed —
   * two clerks working one inbox is the normal case. `422 note-required` when the
   * reply is too short to be one.
   */
  reply: (id: string, body: InquiryReplyBody) =>
    apiClient
      .post<StatusAck<InquiryStatus>>(`/admin/inquiries/${id}/reply`, body)
      .then((response) => response.data),

  /**
   * `note`, as the shared `CloseInquiryBody` always said (gap **G-19**, now closed).
   *
   * This briefly sent `closureNote`, because the API read that and zod **stripped** the
   * `{ note }` the console sent — so an inquiry was filed closed with no record of why,
   * with no error on either side. The API has since taken the field back to `note` and
   * marked the schema `.strict()`, so the same mistake is now a `422` on the first call
   * rather than a silent loss. Sending `closureNote` today is refused, which is the
   * behaviour worth having.
   */
  close: (id: string, body: CloseInquiryBody) =>
    apiClient
      .post<StatusAck<InquiryStatus>>(`/admin/inquiries/${id}/close`, body)
      .then((response) => response.data),
};
