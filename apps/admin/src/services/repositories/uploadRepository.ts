/**
 * Attachment gateway: sign, then PUT, then hand back the record.
 *
 * The two-step is hidden here so a component sees one call. It also means the
 * failure modes collapse into one place — a signature that expires between the
 * sign and the PUT is a retry, not a lost file the clerk has to find again.
 */

import type { Attachment } from '@tfd/domain';
import { uploadEndpoints, type SignUploadBody } from '../endpoints/uploads';

/** Kept modest: this is a phone photo of a passbook, not a scan archive. */
export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

export const ACCEPTED_ATTACHMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const uploadRepository = {
  upload: async (
    file: File,
    target: Pick<SignUploadBody, 'entity' | 'entityId'>,
  ): Promise<Attachment> => {
    const signed = await uploadEndpoints.sign({
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      ...target,
    });
    await uploadEndpoints.put(signed, file);
    return signed.attachment;
  },

  /** Client-side pre-check. The signature is the real gate; this saves a wait. */
  validate: (file: File): { ok: true } | { ok: false; reason: string } => {
    if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, reason: 'attachment.tooLarge' };
    if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type as never)) {
      return { ok: false, reason: 'attachment.badType' };
    }
    return { ok: true };
  },
};
