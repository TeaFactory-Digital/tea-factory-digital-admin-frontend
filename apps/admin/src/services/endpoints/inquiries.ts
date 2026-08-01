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

import type { AdminInquiry, CloseInquiryBody, InquiryQuery, InquiryReplyBody, Paged } from '@tfd/domain';
import { apiClient } from '../api/client';
import { toParams } from './params';

export const inquiryEndpoints = {
  list: (query: InquiryQuery) =>
    apiClient
      .get<Paged<AdminInquiry>>('/admin/inquiries', { params: toParams(query) })
      .then((response) => response.data),

  get: (id: string) =>
    apiClient.get<AdminInquiry>(`/admin/inquiries/${id}`).then((response) => response.data),

  /**
   * `409 already-decided` when the message has already been answered or closed —
   * two clerks working one inbox is the normal case. `422 note-required` when the
   * reply is too short to be one.
   */
  reply: (id: string, body: InquiryReplyBody) =>
    apiClient
      .post<AdminInquiry>(`/admin/inquiries/${id}/reply`, body)
      .then((response) => response.data),

  close: (id: string, body: CloseInquiryBody) =>
    apiClient
      .post<AdminInquiry>(`/admin/inquiries/${id}/close`, body)
      .then((response) => response.data),
};
