/**
 * An audit entry's `before` / `after` → lines an office clerk can read.
 *
 * The server records whatever fields the action touched, as JSON. Shown raw that is
 * `{"status":"published","missingLanguages":["si","ta"]}`, which is precise and means
 * nothing to the people the panel is for. This turns each field into a label and a
 * value in the console's language: *Status: Live*, *Missing languages: Sinhala, Tamil*.
 *
 * Like `auditActionLabel`, anything unknown **falls through rather than disappearing**:
 * an unmapped key is shown with its name spelled out. A field the backend starts recording tomorrow must show up today, unlabelled,
 * not be hidden until someone adds a string for it. Nested values are read the same
 * way, field by field, so no JSON ever reaches the screen.
 */

import i18next from 'i18next';
import { formatDateTime } from '@/lib/format';

type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface AuditDetailLine {
  key: string;
  label: string;
  /** Absent when the entry has no `before` for this field (or no `after`). */
  before?: string;
  after?: string;
}

const FIELD_KEYS: Record<string, string> = {
  status: 'audit.field.status',
  title: 'audit.field.title',
  headline: 'audit.field.headline',
  body: 'audit.field.body',
  excerpt: 'audit.field.excerpt',
  buttonLabel: 'audit.field.buttonLabel',
  slug: 'audit.field.slug',
  lang: 'audit.field.lang',
  missingLanguages: 'audit.field.missingLanguages',
  staleLanguages: 'audit.field.staleLanguages',
  coverImageAttachmentId: 'audit.field.coverImage',
  coverImageUrl: 'audit.field.coverImage',
  imageAttachmentId: 'audit.field.image',
  imageUrl: 'audit.field.image',
  startsAt: 'audit.field.startsAt',
  endsAt: 'audit.field.endsAt',
  action: 'audit.field.buttonAction',
  name: 'audit.field.name',
  email: 'audit.field.email',
  roles: 'audit.field.roles',
  reason: 'audit.field.reason',
  note: 'audit.field.note',
  closureNote: 'audit.field.note',
  identityCheckNote: 'audit.field.identityCheckNote',
  amount: 'audit.field.amount',
  supplierCode: 'audit.field.supplierCode',
  subject: 'audit.field.subject',
  categories: 'audit.field.categories',
  enabled: 'audit.field.enabled',
  deliveryMethod: 'audit.field.deliveryMethod',
  filename: 'audit.field.filename',
  sizeBytes: 'audit.field.sizeBytes',
  decision: 'audit.field.decision',
};

/** Statuses with their own wording; anything else is spelled out from the raw value. */
const STATUSES = new Set([
  'draft',
  'published',
  'archived',
  'pending',
  'approved',
  'rejected',
  'active',
  'suspended',
  'open',
  'answered',
  'closed',
  'paid',
  'failed',
  'sent',
  'cancelled',
]);

const LANGUAGES = new Set(['si', 'en', 'ta']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** `missingLanguages` → `Missing languages`. Only for keys nobody has labelled yet. */
function spellOut(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function fieldLabel(key: string, t: Translate): string {
  const mapped = FIELD_KEYS[key];
  return mapped ? t(mapped) : spellOut(key);
}

function languageName(code: string, t: Translate): string {
  return LANGUAGES.has(code) ? t(`content.language.${code}`) : code;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatValue(key: string, value: unknown, t: Translate): string {
  if (value === null || value === undefined || value === '') return t('audit.value.empty');
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');

  if (Array.isArray(value)) {
    if (value.length === 0) return t('audit.value.none');
    const separator = value.some((item) => asRecord(item)) ? '; ' : ', ';
    return value.map((item) => formatValue(key, item, t)).join(separator);
  }

  if (typeof value === 'number') {
    return key === 'sizeBytes' ? formatBytes(value) : value.toLocaleString();
  }

  if (typeof value === 'string') {
    if (key === 'status') {
      return STATUSES.has(value) ? t(`audit.status.${value}`) : spellOut(value);
    }
    if (/lang/i.test(key) && LANGUAGES.has(value)) return languageName(value, t);
    if (ISO_DATE.test(value)) return formatDateTime(value);
    return value;
  }

  // A nested object, e.g. a banner's `{ type, path }`: read field by field, never as JSON.
  const record = asRecord(value);
  if (record) {
    return Object.entries(record)
      .filter(([inner, innerValue]) => !isHidden(inner, innerValue) && !isEmpty(innerValue))
      .map(([inner, innerValue]) => `${fieldLabel(inner, t)}: ${formatValue(inner, innerValue, t)}`)
      .join(', ');
  }

  return String(value);
}

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * An attachment id is a UUID nobody can read, so the line says **what happened to the
 * file**: added, replaced or removed. One phrase, not a before and an after, because
 * "New image uploaded → New image uploaded" says nothing.
 */
function attachmentChange(
  was: Record<string, unknown>,
  now: Record<string, unknown>,
  key: string,
  t: Translate,
): string | null {
  const previous = was[key];
  const next = now[key];
  if (!(key in now)) return null;
  if (isEmpty(next)) return isEmpty(previous) ? null : t('audit.value.removed');
  if (isEmpty(previous)) return t('audit.value.fileUploaded');
  return previous === next ? null : t('audit.value.fileReplaced');
}

/** Ids name the record, not the change; the panel already belongs to that record. */
function isHidden(key: string, value: unknown): boolean {
  if (key.endsWith('AttachmentId')) return false;
  return (key === 'id' || key.endsWith('Id')) && typeof value === 'string';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * One line per field, `before` and `after` side by side when both were recorded.
 *
 * Returns `[]` when neither side is an object, and the caller shows nothing rather
 * than an empty box.
 */
export function auditDetailLines(
  before: unknown,
  after: unknown,
  t: Translate = i18next.t.bind(i18next) as Translate,
): AuditDetailLine[] {
  const was = asRecord(before) ?? {};
  const now = asRecord(after) ?? {};
  const keys = [...new Set([...Object.keys(was), ...Object.keys(now)])];

  // `coverImageUrl` and `coverImageAttachmentId` are one picture. When the attachment
  // is there it is the one that says what happened, and the URL would be a second
  // "Cover image" line, usually empty.
  const shadowed = (key: string) =>
    key.endsWith('Url') && `${key.slice(0, -3)}AttachmentId` in { ...was, ...now };

  return keys.flatMap((key): AuditDetailLine[] => {
    const value = key in now ? now[key] : was[key];
    if (isHidden(key, value) || shadowed(key)) return [];
    const label = fieldLabel(key, t);

    if (key.endsWith('AttachmentId')) {
      const change = attachmentChange(was, now, key, t);
      return change ? [{ key, label, after: change }] : [];
    }

    const hasBefore = key in was && !isEmpty(was[key]);
    const hasAfter = key in now && !(isEmpty(now[key]) && !hasBefore);
    // Only one side, and that side empty: nothing happened worth a line.
    if (!hasBefore && !hasAfter) return [];

    const formattedBefore = hasBefore ? formatValue(key, was[key], t) : undefined;
    const formattedAfter = hasAfter ? formatValue(key, now[key], t) : undefined;
    return [
      {
        key,
        label,
        before: formattedBefore === formattedAfter ? undefined : formattedBefore,
        after: formattedAfter,
      },
    ];
  });
}
