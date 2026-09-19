/**
 * Pick an image, upload it, and show what was chosen.
 *
 * One component for both content types, because a cover image and a banner artwork are
 * the same interaction with a different aspect ratio: choose a file, watch it go, see it,
 * or take it off again.
 *
 * ## What it hands back, and why it is not a URL
 *
 * `onChange` reports an **attachment id**, not an address. The server mints a short-lived
 * signed URL per read (`attachments` has no `url` column on purpose), so a URL held in
 * form state is a URL that expires while the editor is still typing. The preview shown
 * here is that short-lived URL and it is deliberately not the value.
 *
 * ## The failure that is not a failure
 *
 * `uploads-unavailable` means the server has not built the endpoint yet, which is the
 * state today. It renders as its own message rather than a red error, because there is
 * nothing the editor can do about it and nothing they did wrong.
 */

import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { isApiError } from '@/services/api/errors';
import {
  uploadRepository,
  IMAGE_ACCEPT,
  MAX_IMAGE_BYTES,
  type UploadEntity,
} from '@/services/repositories/uploadRepository';
import { cn } from '@/lib/cn';

interface ImageFieldProps {
  label: string;
  /** Which record this belongs to. Decides the storage prefix on the server. */
  entity: UploadEntity;
  /** Absent while the record is still being created, which is normal. */
  entityId?: string;
  /** A signed URL the server sent with the record, for an image already attached. */
  currentUrl?: string | null;
  /**
   * The chosen attachment, or `null` when the editor takes the image off.
   *
   * `aspectRatio` travels because banners send it on, so the app can reserve the space
   * before the artwork loads rather than shoving the screen down when it arrives.
   */
  onChange: (next: { attachmentId: string; aspectRatio: number } | null) => void;
  disabled?: boolean;
  hint?: string;
  /** Tailwind aspect class for the preview frame, so a banner reads as a banner. */
  previewClassName?: string;
}

export function ImageField({
  label,
  entity,
  entityId,
  currentUrl,
  onChange,
  disabled,
  hint,
  previewClassName = 'aspect-video',
}: ImageFieldProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadRepository.uploadImage(file, entity, entityId);
      setPreview(uploaded.previewUrl);
      onChange({ attachmentId: uploaded.attachmentId, aspectRatio: uploaded.aspectRatio });
    } catch (cause) {
      const code = isApiError(cause) ? cause.code : 'upload-failed';
      if (code === 'uploads-unavailable') setUnavailable(true);
      else setError(t(`uploads.error.${code}`, { max: Math.round(MAX_IMAGE_BYTES / 1024 / 1024) }));
    } finally {
      setBusy(false);
      // Clear the input, so choosing the SAME file again after a failure still fires
      // `change`. A native file input does not when the value is unchanged, and an
      // editor retrying the file they just fixed would get nothing.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function remove() {
    setPreview(null);
    setError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor={inputId} className="text-label text-text-primary">
        {label}
      </label>

      {preview ? (
        <div
          className={cn(
            'relative overflow-hidden rounded-md border border-border bg-surface-variant',
            previewClassName,
          )}
        >
          {/* `contain`, not `cover`: an editor is checking what the picture IS, and a
              crop that hides half of it is the opposite of a preview. The app crops. */}
          <img src={preview} alt="" className="h-full w-full object-contain" />
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        disabled={disabled || busy || unavailable}
        className="text-body-small file:mr-md file:rounded-md file:border-0 file:bg-surface-variant file:px-md file:py-xs file:text-label"
        onChange={(event) => void choose(event.target.files?.[0])}
      />

      {busy ? <p className="text-caption text-text-secondary">{t('uploads.uploading')}</p> : null}

      {preview && !busy ? (
        <div>
          <Button type="button" variant="ghost" onClick={remove} disabled={disabled}>
            {t('uploads.remove')}
          </Button>
        </div>
      ) : null}

      {unavailable ? (
        <p className="text-caption text-text-secondary">{t('uploads.unavailable')}</p>
      ) : null}

      {error ? (
        <p role="alert" className="text-caption text-error">
          {error}
        </p>
      ) : null}

      {hint && !error && !unavailable ? (
        <p className="text-caption text-text-secondary">{hint}</p>
      ) : null}
    </div>
  );
}
