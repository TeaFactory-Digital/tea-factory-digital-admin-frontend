/**
 * Domain gateway for uploading a file and getting an attachment id back.
 *
 * The three-step presigned flow lives here rather than in a component, so that every
 * editor that grows a picture field does the same thing: sign, `PUT`, confirm. A second
 * copy of this in a dialog is a second chance to skip the confirm and leave orphaned
 * reservations behind.
 */

import { ApiError, isApiError } from '../api/errors';
import { uploadEndpoints, type UploadEntity } from '../endpoints/uploads';

/**
 * Re-exported so a component can name the entity it is uploading for without importing
 * an endpoint module. Screens and hooks reach the API through a repository, and a type
 * is not an exception worth carving out of that rule.
 */
export type { UploadEntity };

/**
 * What the office may actually put on an article or a banner.
 *
 * Checked **here as well as on the server**, and the duplication is deliberate: the
 * server's refusal arrives after the bytes have crossed a rural connection, which is the
 * one place a client-side check earns its keep. The server's answer is still the
 * authority, and this never permits anything it refuses.
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * 5 MB, and the number is about the reader, not the bucket.
 *
 * A cover image is rendered a few hundred pixels wide on a phone, often over a connection
 * that charges by the megabyte. A 12 MB photograph straight off a camera costs a supplier
 * real money to receive and looks identical to a 300 KB one. Storage is the cheapest thing
 * in this system; a farmer's data is not.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** The `accept` attribute, kept beside the list it has to agree with. */
export const IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(',');

export interface UploadedImage {
  /** Goes on the draft. The URL does not: it expires. */
  attachmentId: string;
  /** Short-lived signed GET, for the preview in the form the editor is looking at. */
  previewUrl: string;
  width: number;
  height: number;
  /** `width / height`, which banners send so the app can reserve space before it loads. */
  aspectRatio: number;
}

/**
 * Read the pixel dimensions before uploading.
 *
 * Needed for `imageAspectRatio`, which the app uses to reserve space so a banner does not
 * shove the screen down when the artwork arrives. Read from an object URL rather than
 * asked of the server, because the server would have to decode the image to answer and
 * the browser has already done it.
 *
 * Rejects on a file the browser cannot decode. That is a **useful** failure: a `.png` that
 * is not a PNG would otherwise upload successfully and render as a broken image in the
 * app, where nobody in the office would ever see it.
 */
function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new ApiError({
          code: 'upload-unreadable',
          message: 'That file is not an image the browser can read.',
        }),
      );
    };
    image.src = url;
  });
}

/**
 * `404` on the signing endpoint means **the feature is not built yet**, not that the
 * article is missing.
 *
 * The `Attachment` table exists and nothing implements it (the backend's O1), so this is
 * the state the console will be in until that lands. Translating it into its own code
 * lets the editors say *"uploads are not available yet"*, which is true and actionable,
 * instead of *"not found"* over a file the editor can plainly see on their desktop.
 */
function asUploadRefusal(cause: unknown): never {
  if (isApiError(cause) && (cause.status === 404 || cause.code === 'not-found')) {
    throw new ApiError({
      code: 'uploads-unavailable',
      message: 'Image uploads are not available on this server yet.',
      status: cause.status,
    });
  }
  throw cause;
}

export const uploadRepository = {
  /**
   * Sign, `PUT`, confirm, and hand back the id the draft should carry.
   *
   * Refuses **before signing** on type and size, so a file that was never going to be
   * accepted does not reserve a row and does not spend an editor's bandwidth on its way
   * to a `422`.
   */
  async uploadImage(file: File, entity: UploadEntity, entityId?: string): Promise<UploadedImage> {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      throw new ApiError({
        code: 'upload-type',
        message: 'That file type cannot be used as an image.',
        details: { accepted: ACCEPTED_IMAGE_TYPES, received: file.type },
      });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new ApiError({
        code: 'upload-too-large',
        message: 'That image is too large.',
        details: { max: MAX_IMAGE_BYTES, received: file.size },
      });
    }

    const { width, height } = await readDimensions(file);

    const signed = await uploadEndpoints
      .sign({
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        entity,
        entityId,
      })
      .catch(asUploadRefusal);

    /*
     * `fetch`, not the console's axios client, and this is the one place that is correct.
     *
     * The interceptors exist to attach a bearer token, a tenant header, an idempotency key
     * and a CSRF header. Sending any of those to an object store is at best ignored and at
     * worst breaks the signature, and sending this factory's access token to a third-party
     * host is a credential leak. The signature in the URL is the whole of the
     * authorisation here.
     */
    const response = await fetch(signed.uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type, ...(signed.headers ?? {}) },
    }).catch(() => {
      throw new ApiError({
        code: 'upload-failed',
        message: 'The image could not be sent to storage.',
      });
    });

    if (!response.ok) {
      // The store answers XML the office cannot read, so the status is all that travels.
      throw new ApiError({
        code: 'upload-failed',
        message: 'Storage refused the image.',
        status: response.status,
      });
    }

    const confirmed = await uploadEndpoints.confirm(signed.attachmentId).catch(asUploadRefusal);

    return {
      attachmentId: confirmed.id,
      previewUrl: confirmed.url,
      width,
      height,
      // Two decimals: this is a layout hint, and a ratio carried to sixteen digits
      // invites a reader to think it is a measurement.
      aspectRatio: Math.round((width / height) * 100) / 100,
    };
  },
};
