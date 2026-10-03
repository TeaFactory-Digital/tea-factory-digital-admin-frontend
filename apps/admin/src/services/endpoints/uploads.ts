/**
 * Image and file uploads, as **two calls and a direct PUT**.
 *
 * ## Why the browser talks to the object store, not to the API
 *
 * The alternative is posting the bytes to the API and letting it forward them, which
 * needs no signing dance and is worse in every way that matters here: it puts a
 * multi-megabyte body through a Node process sized for JSON, it doubles the bandwidth
 * bill, and it turns a slow rural upload into a held-open API connection. A presigned
 * `PUT` sends the bytes to the store and leaves the API handling two small JSON calls.
 *
 * ## The three steps, and why there is a third
 *
 * 1. `POST /admin/uploads/sign` reserves an `Attachment` row and hands back a URL the
 *    browser may `PUT` to, for a few minutes.
 * 2. The browser `PUT`s the bytes **straight to the store**, with no `Authorization`
 *    header: the signature in the URL is the whole of the authorisation.
 * 3. `POST /admin/uploads/{id}/confirm` says the bytes arrived.
 *
 * Step 3 is what makes step 1 safe to fail. A signed upload that the supplier's
 * connection dropped halfway leaves a row with `confirmedAt` null, which is a reservation
 * nobody has to clean up by guessing. The server's own schema comment already anticipates
 * this: *"Distinguishes a signed-but-never-uploaded row."*
 *
 * ## The URL is short-lived, and that shapes the whole contract
 *
 * `attachments` has **no `url` column**, by design: *"`attachment.url` is a SHORT-LIVED
 * SIGNED GET generated per read, not a public object."* So a console cannot store the URL
 * it receives and put it on a draft, because it would be storing something that expires.
 *
 * What travels on a draft is therefore the **attachment id**, and what comes back on a
 * read is a freshly signed `coverImageUrl` or `imageUrl` the server mints per response.
 * That is why `attachmentId` below is the value the editors keep.
 *
 * ⚠️ **None of these endpoints exists yet.** The `Attachment` table is in the schema and
 * nothing implements it (the backend's O1). The flow is written against the contract
 * recorded in `docs/v2/BACKEND-API-GAPS.md`, and `uploadRepository` turns the resulting
 * `404` into a coded refusal the editors render as *"uploads are not available yet"*
 * rather than a stack trace over a form.
 */

import { apiClient } from '../api/client';

/** What kind of record the file belongs to. Decides the storage prefix and who may read. */
export type UploadEntity = 'newsArticle' | 'banner' | 'changeRequest' | 'creditRequest';

export interface UploadSignRequest {
  filename: string;
  contentType: string;
  sizeBytes: number;
  entity: UploadEntity;
  /**
   * Absent when the record does not exist yet, which is the ordinary case for a cover
   * image chosen in a create dialog. The server links the attachment when the record
   * that references it is written.
   */
  entityId?: string;
}

export interface UploadSignResponse {
  /** The `Attachment` row's id. **This is what goes on a draft**, not the URL. */
  attachmentId: string;
  /** Presigned, short-lived, and the only authorisation the `PUT` carries. */
  uploadUrl: string;
  /**
   * Headers the signature covers, which the `PUT` must therefore reproduce exactly.
   *
   * Sent by the server rather than assumed by the console: S3 and MinIO disagree about
   * which headers are part of a signature, and a client guessing wrong gets a `403` from
   * the store with nothing in it to read.
   */
  headers?: Record<string, string>;
  expiresAt: string;
}

/** What a confirmed attachment looks like on the way back. */
export interface ConfirmedUpload {
  id: string;
  /** Short-lived signed GET, for an immediate preview. Not to be stored. */
  url: string;
  contentType: string;
  sizeBytes: number;
}

export const uploadEndpoints = {
  /**
   * `422 upload-too-large` and `422 upload-type` are the two refusals worth having
   * separately: the office can act on both, and a generic `invalid` on a file picker
   * tells an editor nothing about which file to choose instead.
   */
  sign: (body: UploadSignRequest) =>
    apiClient.post<UploadSignResponse>('/admin/uploads/sign', body).then((r) => r.data),

  confirm: (attachmentId: string) =>
    apiClient
      .post<ConfirmedUpload>(`/admin/uploads/${attachmentId}/confirm`)
      .then((r) => r.data),
};
