/**
 * The upload flow, and **mostly its refusals**.
 *
 * The happy path is three calls in order and there is not much to get wrong about it.
 * What this suite is really for is the four ways it fails, because each one has to reach
 * an editor as something they can act on rather than as a stack trace over a form:
 *
 *  - a file that is not an image, refused **before** signing;
 *  - a file that is too large, also before signing, because the point of a client-side
 *    size check is not to duplicate the server but to avoid spending a rural connection
 *    on bytes that were never going to be accepted;
 *  - storage refusing the `PUT`, which the office cannot read (S3 answers XML);
 *  - and the one that matters today: **the endpoint does not exist yet**.
 *
 * That last case is the whole reason `uploads-unavailable` has its own code. The
 * `Attachment` table is in the backend's schema and nothing implements it, so a `404` is
 * the expected answer on every server we can reach right now. Reported as "not found" it
 * reads as though the article were missing; reported as its own code the editor is told
 * uploads are not available yet and that the article saves fine without one.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  uploadRepository,
  MAX_IMAGE_BYTES,
  ACCEPTED_IMAGE_TYPES,
} from '@/services/repositories/uploadRepository';
import { uploadEndpoints } from '@/services/endpoints/uploads';
import { ApiError, isApiError } from '@/services/api/errors';

/**
 * jsdom does not decode images, so `Image.onload` never fires and the real
 * `readDimensions` would hang for ever. Stubbed to resolve immediately with a known size,
 * which is also what lets the aspect-ratio assertion below be an exact number.
 */
function stubImageDecoding(ok = true, width = 1200, height = 400) {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = width;
    naturalHeight = height;
    set src(_value: string) {
      queueMicrotask(() => (ok ? this.onload?.() : this.onerror?.()));
    }
  }
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
}

const file = (type = 'image/png', size = 1024, name = 'cover.png') =>
  new File([new Uint8Array(size)], name, { type });

beforeEach(() => stubImageDecoding());
afterEach(() => vi.unstubAllGlobals());

describe('uploading an image', () => {
  it('signs, PUTs the bytes and confirms, in that order', async () => {
    const calls: string[] = [];
    vi.spyOn(uploadEndpoints, 'sign').mockImplementation(async () => {
      calls.push('sign');
      return {
        attachmentId: 'att-1',
        uploadUrl: 'https://store.example/put',
        expiresAt: '2026-01-01T00:00:00.000Z',
      };
    });
    vi.spyOn(uploadEndpoints, 'confirm').mockImplementation(async () => {
      calls.push('confirm');
      return { id: 'att-1', url: 'https://store.example/get', contentType: 'image/png', sizeBytes: 1024 };
    });
    vi.stubGlobal('fetch', async () => {
      calls.push('put');
      return { ok: true, status: 200 } as Response;
    });

    const result = await uploadRepository.uploadImage(file(), 'newsArticle');

    expect(calls).toEqual(['sign', 'put', 'confirm']);
    // The ATTACHMENT ID is what a draft carries, never the URL: the URL is a short-lived
    // signed GET and would expire while the editor was still typing.
    expect(result.attachmentId).toBe('att-1');
    expect(result.aspectRatio).toBe(3); // 1200 / 400
  });

  it('sends no Authorization header to the object store', async () => {
    vi.spyOn(uploadEndpoints, 'sign').mockResolvedValue({
      attachmentId: 'att-1',
      uploadUrl: 'https://store.example/put',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    vi.spyOn(uploadEndpoints, 'confirm').mockResolvedValue({
      id: 'att-1', url: 'u', contentType: 'image/png', sizeBytes: 1024,
    });

    let sent: RequestInit | undefined;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      sent = init;
      return { ok: true, status: 200 } as Response;
    });

    await uploadRepository.uploadImage(file(), 'banner');

    /**
     * **The assertion this test exists for.** The console's axios client attaches a bearer
     * token, a tenant header, an idempotency key and a CSRF header. Sending this factory's
     * access token to a third-party storage host would be a credential leak, and the
     * signature in the URL is the whole of the authorisation anyway.
     */
    const headers = (sent?.headers ?? {}) as Record<string, string>;
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('authorization');
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain('x-tenant');
  });

  it('refuses a file that is not an accepted image, before signing', async () => {
    const sign = vi.spyOn(uploadEndpoints, 'sign');

    const refused = await uploadRepository
      .uploadImage(file('application/pdf', 10, 'notes.pdf'), 'newsArticle')
      .catch((cause) => cause);

    expect(isApiError(refused) && refused.code).toBe('upload-type');
    // Before signing: a file that was never going to be accepted must not reserve a row.
    expect(sign).not.toHaveBeenCalled();
    expect(ACCEPTED_IMAGE_TYPES).not.toContain('application/pdf');
  });

  it('refuses an oversized file, before signing', async () => {
    const sign = vi.spyOn(uploadEndpoints, 'sign');

    const refused = await uploadRepository
      .uploadImage(file('image/png', MAX_IMAGE_BYTES + 1), 'newsArticle')
      .catch((cause) => cause);

    expect(isApiError(refused) && refused.code).toBe('upload-too-large');
    expect(sign).not.toHaveBeenCalled();
  });

  it('reports a file the browser cannot decode rather than uploading it', async () => {
    stubImageDecoding(false);
    const sign = vi.spyOn(uploadEndpoints, 'sign');

    const refused = await uploadRepository
      .uploadImage(file('image/png', 10, 'lying.png'), 'newsArticle')
      .catch((cause) => cause);

    /**
     * A `.png` that is not a PNG would otherwise upload successfully and render as a
     * broken image in the app, where nobody in the office would ever see it.
     */
    expect(isApiError(refused) && refused.code).toBe('upload-unreadable');
    expect(sign).not.toHaveBeenCalled();
  });

  it('reports storage refusing the PUT without leaking its XML', async () => {
    vi.spyOn(uploadEndpoints, 'sign').mockResolvedValue({
      attachmentId: 'att-1',
      uploadUrl: 'https://store.example/put',
      expiresAt: '2026-01-01T00:00:00.000Z',
    });
    const confirm = vi.spyOn(uploadEndpoints, 'confirm');
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 403 }) as Response);

    const refused = await uploadRepository
      .uploadImage(file(), 'newsArticle')
      .catch((cause) => cause);

    expect(isApiError(refused) && refused.code).toBe('upload-failed');
    // Never confirmed, so the row stays unconfirmed and is a reservation nobody has to
    // clean up by guessing. That is what `confirmedAt` is for.
    expect(confirm).not.toHaveBeenCalled();
  });

  it('translates a 404 on the signing endpoint into "not available yet"', async () => {
    vi.spyOn(uploadEndpoints, 'sign').mockRejectedValue(
      new ApiError({ code: 'not-found', message: 'Not found.', status: 404 }),
    );

    const refused = await uploadRepository
      .uploadImage(file(), 'newsArticle')
      .catch((cause) => cause);

    /**
     * **The state every server is in today.** Reported as `not-found` this reads as though
     * the article were missing, which sends an editor looking for the wrong problem.
     */
    expect(isApiError(refused) && refused.code).toBe('uploads-unavailable');
  });
});
