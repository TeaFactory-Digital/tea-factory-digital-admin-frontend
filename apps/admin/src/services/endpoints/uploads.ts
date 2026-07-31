/**
 * Evidence attachments for a decision (M9, and later M5 adjustments).
 *
 * Two-step, presigned. The console asks the API to sign an upload, then PUTs the
 * bytes straight to object storage. The file never passes through the API, which
 * matters because a scan of a passbook is megabytes and the API is sized for
 * JSON on a rural connection.
 *
 * The API decides what may be uploaded — content type, size ceiling — and the
 * signature encodes that decision. A console-side check is a courtesy that stops
 * a clerk waiting for a 12 MB upload to be rejected; it is not the control.
 */

import type { Attachment } from '@tfd/domain';
import { apiClient } from '../api/client';

export interface SignUploadBody {
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** What this file is evidence for, so the API can scope the signature. */
  entity: 'changeRequest' | 'creditRequest' | 'bill' | 'supplier';
  entityId: string;
}

export interface SignedUpload {
  /** Presigned PUT target. Short-lived. */
  uploadUrl: string;
  /** Headers the PUT must send verbatim, or the signature will not match. */
  headers: Record<string, string>;
  /** The attachment record, already created and pending the bytes. */
  attachment: Attachment;
}

export const uploadEndpoints = {
  sign: (body: SignUploadBody) =>
    apiClient
      .post<SignedUpload>('/admin/uploads/sign', body)
      .then((response) => response.data),

  /**
   * The direct PUT. Uses `fetch` rather than `apiClient` on purpose: the axios
   * instance attaches `Authorization`, `X-Tenant` and an idempotency key, and
   * any header not covered by the presignature makes object storage reject the
   * request.
   */
  put: async (signed: SignedUpload, file: Blob): Promise<void> => {
    const response = await fetch(signed.uploadUrl, {
      method: 'PUT',
      headers: signed.headers,
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}`);
    }
  },
};
