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
 *
 * ## No native file input on screen
 *
 * The browser's own control says *"No file chosen"* next to an image that is plainly
 * attached, because it only knows about files picked in this visit. So the input is
 * visually hidden and the field shows one of three states the editor can read: an empty
 * drop area, the picture with Replace and Remove, or the picture uploading.
 */

import { useId, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ImageOff, ImagePlus, Info, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Spinner } from './states';
import { InfoTip } from './Tooltip';
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
  /**
   * Keep the label for screen readers only, when a card header above already names the
   * field and saying it twice would just be noise.
   */
  hideLabel?: boolean;
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

const MAX_MB = Math.round(MAX_IMAGE_BYTES / 1024 / 1024);

export function ImageField({
  label,
  hideLabel,
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
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [broken, setBroken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const locked = Boolean(disabled) || busy || unavailable;

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const uploaded = await uploadRepository.uploadImage(file, entity, entityId);
      setPreview(uploaded.previewUrl);
      setBroken(false);
      onChange({ attachmentId: uploaded.attachmentId, aspectRatio: uploaded.aspectRatio });
    } catch (cause) {
      const code = isApiError(cause) ? cause.code : 'upload-failed';
      // A server with no store is not a bad file: the picker is disabled and the message
      // says so, rather than colouring it red as though the editor chose wrongly.
      if (code === 'upload-not-configured') setUnavailable(true);
      else setError(t(`uploads.error.${code}`, { max: MAX_MB }));
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
    setBroken(false);
    setError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrag(event: DragEvent<HTMLElement>, over: boolean) {
    event.preventDefault();
    if (!locked) setDragging(over);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragging(false);
    if (!locked) void choose(event.dataTransfer.files?.[0]);
  }

  const dropHandlers = {
    onDragOver: (event: DragEvent<HTMLElement>) => onDrag(event, true),
    onDragEnter: (event: DragEvent<HTMLElement>) => onDrag(event, true),
    onDragLeave: (event: DragEvent<HTMLElement>) => onDrag(event, false),
    onDrop,
  };

  return (
    <div className="relative flex flex-col gap-xs">
      {/* The hint waits behind an "i" beside the label rather than sitting under the
          picker on every visit. With the label hidden (a card header names the field),
          the caller shows the hint in that header instead. */}
      <div className={cn('flex items-center gap-xxs', hideLabel && 'sr-only')}>
        <label htmlFor={inputId} className="text-label text-text-primary">
          {label}
        </label>
        {hint && !hideLabel ? <InfoTip label={t('tip.moreInfo')} compact>{hint}</InfoTip> : null}
      </div>

      {/* Visually hidden, still focusable: the drop area below is its label, and a
          keyboard user tabs to this and presses Space exactly as before. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={IMAGE_ACCEPT}
        disabled={locked}
        aria-describedby={hint ? hintId : undefined}
        className="peer sr-only"
        onChange={(event) => void choose(event.target.files?.[0])}
      />

      {preview ? (
        <div className="flex flex-col gap-sm">
          <div
            {...dropHandlers}
            className={cn(
              'relative overflow-hidden rounded-md border bg-surface-variant',
              dragging ? 'border-2 border-dashed border-primary' : 'border-border',
              previewClassName,
            )}
          >
            {broken ? (
              // A signed URL that has expired, or a bucket having a bad day. Said in
              // words, rather than a browser's broken-image glyph in an empty frame.
              <div className="flex h-full w-full flex-col items-center justify-center gap-xs px-md text-center text-text-secondary">
                <ImageOff className="size-icon-lg" aria-hidden />
                <p className="text-caption">{t('uploads.broken')}</p>
              </div>
            ) : (
              // `contain`, not `cover`: an editor is checking what the picture IS, and a
              // crop that hides half of it is the opposite of a preview. The app crops.
              <img
                src={preview}
                alt={label}
                className="h-full w-full object-contain"
                onError={() => setBroken(true)}
              />
            )}

            {busy ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-xs bg-surface/80">
                <Spinner />
                <p className="text-caption text-text-secondary">{t('uploads.uploading')}</p>
              </div>
            ) : null}
          </div>

          {!disabled ? (
            <div className="flex flex-wrap gap-sm">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                iconLeft={<RefreshCw className="size-icon-sm" aria-hidden />}
                onClick={() => inputRef.current?.click()}
                disabled={locked}
              >
                {t('uploads.replace')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                iconLeft={<Trash2 className="size-icon-sm" aria-hidden />}
                onClick={remove}
                disabled={locked}
              >
                {t('uploads.remove')}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          {...dropHandlers}
          className={cn(
            'flex min-h-40 flex-col items-center justify-center gap-xs rounded-md border-2 border-dashed px-md py-lg text-center transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary',
            locked
              ? 'cursor-not-allowed border-border bg-surface-variant opacity-70'
              : dragging
                ? 'cursor-copy border-primary bg-primary-muted'
                : 'cursor-pointer border-border hover:border-primary hover:bg-primary-muted',
          )}
        >
          {busy ? (
            <>
              <Spinner />
              <span className="text-body-small text-text-secondary">{t('uploads.uploading')}</span>
            </>
          ) : (
            <>
              <span className="flex size-12 items-center justify-center rounded-full bg-surface text-primary">
                <ImagePlus className="size-icon-md" aria-hidden />
              </span>
              <span className="text-body-small text-text-primary">
                <span className="font-semibold text-primary">{t('uploads.choose')}</span>{' '}
                {t('uploads.orDrag')}
              </span>
              <span className="text-caption text-text-secondary">
                {t('uploads.formats', { max: MAX_MB })}
              </span>
            </>
          )}
        </label>
      )}

      {unavailable ? (
        <p className="flex items-start gap-xs text-caption text-text-secondary">
          <Info className="mt-px size-icon-xs shrink-0" aria-hidden />
          {t('uploads.unavailable')}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="flex items-start gap-xs text-caption text-error">
          <AlertCircle className="mt-px size-icon-xs shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}

      {/* Kept for screen readers: the input is still described by it. */}
      {hint ? (
        <p id={hintId} className="sr-only">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
