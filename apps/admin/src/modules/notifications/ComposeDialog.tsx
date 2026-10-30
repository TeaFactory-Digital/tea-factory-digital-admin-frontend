/**
 * Writing a notification by hand: the act §21.24's second half is about.
 *
 * **A push cannot be recalled and reports nothing when it fails.** No phone tells the
 * console it discarded the message; no supplier tells it they had the category off. So
 * every safeguard in this dialog is a *pre*-check, and the reach panel is the important
 * one: it is the server's answer about consent the console does not hold, and it turns
 * "send to everybody" into a number somebody can argue with.
 *
 * The two figures beside each other are the point. *Reaches 61 devices, 6 opted out* is a
 * different decision from *reaches 3, 11 opted out* (the second belongs on the
 * noticeboard), and there is no way to learn which one happened after the fact.
 *
 * The category is a **required choice, not a default**, because the app routes on it: a
 * `newsArticle` push opens the feed and a `requestDecided` one opens the request. Picking
 * for the office would send suppliers to the wrong screen, and picking *wrong* sends them
 * nowhere at all: the app drops a category it does not recognize.
 *
 * **One message, in each of the factory's languages** (the language strip, as on news and
 * banners). The fallback language is required; the others are optional, and a supplier
 * whose app is in a language left empty gets the fallback, which the strip marks on its tab
 * and the confirmation says before the send.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, TriangleAlert, Users } from 'lucide-react';
import {
  EDITORIAL_FALLBACK_LANGUAGE,
  MAX_PUSH_BODY_CHARS,
  MAX_PUSH_TITLE_CHARS,
  halfWrittenNotificationLanguages,
  missingNotificationLanguages,
  type LanguageCode,
  type NotificationAudience,
  type NotificationCopy,
  type NotificationCategory,
  type NotificationTrigger,
  NOTIFICATION_CATEGORIES,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Notice, Spinner } from '@/components/ui/states';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/Toast';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatCount } from '@/lib/format';
import { useNotificationReach, useSendNotification } from './hooks';
import { InfoTip } from '@/components/ui/Tooltip';
import { LanguageStrip } from '@/modules/content/LanguageStrip';
import { useContentLanguages } from '@/modules/content/hooks';

/** Categories only the system sends; the office cannot compose one. */
const AUTOMATIC_ONLY = new Set<NotificationCategory>(['leafWeighed']);

export function ComposeDialog({
  open,
  onClose,
  triggers,
}: {
  open: boolean;
  onClose: () => void;
  /** Only categories this tenant has configured can be sent. */
  triggers: NotificationTrigger[] | undefined;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { config } = useRuntimeConfig();
  const send = useSendNotification();

  /**
   * **The kinds this factory offers**: `push.categories`, set under Configuration →
   * Notifications. A manual send needs nothing else on the server.
   *
   * This used to be the *trigger* rows instead, which are about automatic sends: a factory
   * with none (no seed creates them) or with `push` unset got an empty Kind list and no way
   * to explain why. The triggers still count when the config is not loaded yet.
   */
  const pushConfigured = Boolean(config.push);
  const available = useMemo(() => {
    const offered = config.push?.categories ?? [];
    const kinds =
      offered.length > 0
        ? NOTIFICATION_CATEGORIES.filter((category) => offered.includes(category))
        : (triggers ?? [])
            .filter((trigger) => trigger.available)
            .map((trigger) => trigger.category);
    // The day's leaf weight is one supplier's own number, sent by the factory sync. A
    // message the office writes by hand is never that.
    return kinds.filter((category) => !AUTOMATIC_ONLY.has(category));
  }, [config.push, triggers]);

  const [category, setCategory] = useState<NotificationCategory | ''>('');
  const [kind, setKind] = useState<NotificationAudience['kind']>('allSuppliers');
  const [point, setPoint] = useState('');
  // The fallback first, then the factory's other languages, in its own order.
  const contentLanguages = useContentLanguages();
  const languages = useMemo<LanguageCode[]>(
    () => [EDITORIAL_FALLBACK_LANGUAGE, ...contentLanguages.filter((lang) => lang !== EDITORIAL_FALLBACK_LANGUAGE)],
    [contentLanguages],
  );
  const [lang, setLang] = useState<LanguageCode>(EDITORIAL_FALLBACK_LANGUAGE);
  const [copy, setCopy] = useState<Partial<Record<LanguageCode, NotificationCopy>>>({});
  const [confirmingSend, setConfirmingSend] = useState(false);
  const title = copy[EDITORIAL_FALLBACK_LANGUAGE]?.title ?? '';
  const body = copy[EDITORIAL_FALLBACK_LANGUAGE]?.body ?? '';
  const current = copy[lang] ?? { title: '', body: '' };
  const setCurrent = (patch: Partial<NotificationCopy>) =>
    setCopy((before) => ({ ...before, [lang]: { ...(before[lang] ?? { title: '', body: '' }), ...patch } }));
  const others = useMemo(
    () => Object.fromEntries(Object.entries(copy).filter(([one]) => one !== EDITORIAL_FALLBACK_LANGUAGE)),
    [copy],
  ) as Partial<Record<LanguageCode, NotificationCopy>>;
  const missing = missingNotificationLanguages(others, languages);
  const half = halfWrittenNotificationLanguages(others);
  // The strip marks the fallback too while it is still empty: nothing can be sent without it.
  const missingOnStrip = title.trim() && body.trim() ? missing : [EDITORIAL_FALLBACK_LANGUAGE, ...missing];

  // Reset on open, not on mount: a dialog reopened with the last message still in it is
  // one keystroke away from sending it twice.
  useEffect(() => {
    if (!open) return;
    setCategory('');
    setKind('allSuppliers');
    setPoint('');
    setLang(EDITORIAL_FALLBACK_LANGUAGE);
    setCopy({});
  }, [open]);

  const audience = useMemo<NotificationAudience>(
    () =>
      kind === 'collectionPoint'
        ? {
            kind,
            collectionPoint: point,
            collectionPointId: config.collectionPoints.find((cp) => cp.name === point)?.id,
          }
        : { kind: 'allSuppliers' },
    [kind, point, config.collectionPoints],
  );

  // Asked only once the audience is complete; see `useNotificationReach`.
  const audienceReady = kind === 'allSuppliers' || Boolean(point);
  const reach = useNotificationReach(
    (category || 'billPublished') as NotificationCategory,
    audience,
    open && Boolean(category) && audienceReady,
  );

  const complete =
    Boolean(category) && audienceReady && title.trim() && body.trim() && half.length === 0;
  const nobody = reach.data?.reachableDevices === 0;

  async function submit() {
    if (!category) return;
    setConfirmingSend(true);
  }

  async function confirmSend() {
    if (!category) return;
    try {
      const result = await send.mutateAsync({
        category,
        title: title.trim(),
        body: body.trim(),
        translations: others,
        audience,
      });
      setConfirmingSend(false);
      toast.success(
        t('notifications.sent', { count: result.reachableDevices }),
        result.suppressedDevices > 0
          ? t('notifications.sentSuppressed', { count: result.suppressedDevices })
          : undefined,
      );
      onClose();
    } catch (cause) {
      // The dialog stays open: `no-recipients` is information about what to do instead,
      // and the message the office just wrote must not be thrown away with the dialog.
      toast.error(t('notifications.sendFailed'), t(errorMessageKey(cause)));
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        size="md"
        title={t('notifications.composeTitle')}
        description={t('notifications.composeDescription')}
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={!complete || nobody}
              loading={send.isPending}
              iconLeft={<Send className="size-icon-sm" aria-hidden />}
              onClick={() => void submit()}
            >
              {reach.data
                ? t('notifications.sendToCount', { count: reach.data.reachableDevices })
                : t('notifications.send')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-md">
          {/* Said, not left as an empty list: nothing can be sent until the factory has
              chosen which kinds it offers, and the fix is on another screen. */}
          {available.length === 0 ? (
            <Notice tone="warning">
              <span className="flex flex-col gap-xxs">
                <span>
                  {pushConfigured
                    ? t('notifications.noKindsOffered')
                    : t('notifications.pushNotConfigured')}
                </span>
                <Link
                  to="/configuration?section=push"
                  className="font-medium underline underline-offset-2"
                >
                  {t('notifications.openPushSettings')}
                </Link>
              </span>
            </Notice>
          ) : null}
          <Field
            label={t('notifications.field.category')}
            required
            hint={t('notifications.field.categoryHint')}
          >
            {({ id, describedBy, required }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                required={required}
                value={category}
                onChange={(event) => setCategory(event.target.value as NotificationCategory)}
              >
                <option value="">{t('notifications.field.categoryPlaceholder')}</option>
                {available.map((one) => (
                  <option key={one} value={one}>
                    {t(`notifications.category.${one}`)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <div className="flex flex-wrap gap-sm">
            <Field label={t('notifications.field.audience')} className="flex-1">
              {({ id, describedBy }) => (
                <Select
                  id={id}
                  aria-describedby={describedBy}
                  value={kind}
                  onChange={(event) => setKind(event.target.value as NotificationAudience['kind'])}
                >
                  <option value="allSuppliers">
                    {t('notifications.audienceKind.allSuppliers')}
                  </option>
                  <option value="collectionPoint">
                    {t('notifications.audienceKind.collectionPoint')}
                  </option>
                </Select>
              )}
            </Field>

            {kind === 'collectionPoint' ? (
              <Field label={t('deliveries.point')} required className="flex-1">
                {({ id, describedBy, required }) => (
                  <Select
                    id={id}
                    aria-describedby={describedBy}
                    required={required}
                    value={point}
                    onChange={(event) => setPoint(event.target.value)}
                  >
                    <option value="">{t('notifications.field.pickPoint')}</option>
                    {config.collectionPoints.map((cp) => (
                      <option key={cp.id} value={cp.name}>
                        {cp.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : null}
          </div>

          {/**
           * The reach panel: the whole reason this dialog is not just a form.
           *
           * `suppressed` and `no device` are stated separately because they are different
           * problems with different fixes: one is a supplier who turned this category off,
           * the other is a supplier who never installed the app. A single "not reached"
           * figure would hide which.
           */}
          {category && audienceReady ? (
            <div className="flex flex-col gap-xs rounded-md bg-surface-variant px-md py-sm">
              {reach.isPending && !reach.data ? (
                <span className="flex items-center gap-xs text-body-small text-text-secondary">
                  <Spinner size="sm" />
                  {t('notifications.reachLoading')}
                </span>
              ) : reach.data ? (
                <>
                  <p className="flex items-start gap-xs text-body-small text-text-primary">
                    <Users
                      className="mt-xxs size-icon-sm shrink-0 text-text-secondary"
                      aria-hidden
                    />
                    {t('notifications.reachSummary', {
                      devices: formatCount(reach.data.reachableDevices),
                      suppliers: formatCount(reach.data.targetedSuppliers),
                    })}
                  </p>
                  {reach.data.suppressedDevices > 0 ? (
                    <p className="text-caption text-text-secondary">
                      {t('notifications.reachSuppressed', {
                        count: reach.data.suppressedDevices,
                        category: t(`notifications.category.${category}`),
                      })}
                    </p>
                  ) : null}
                  {reach.data.suppliersWithoutDevice > 0 ? (
                    <p className="text-caption text-text-secondary">
                      {t('notifications.reachNoDevice', {
                        count: reach.data.suppliersWithoutDevice,
                      })}
                    </p>
                  ) : null}
                  {nobody ? (
                    <p className="flex items-start gap-xs text-body-small text-warning">
                      <TriangleAlert className="mt-xxs size-icon-sm shrink-0" aria-hidden />
                      {t('notifications.reachNobody')}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {/* One tab per language the factory writes in; a gap is marked on its tab. */}
          {languages.length > 1 ? (
            <div className="flex flex-col gap-xs">
              <LanguageStrip languages={languages} active={lang} onSelect={setLang} missing={missingOnStrip} stale={[]} />
              <p className="text-caption text-text-secondary">
                {lang === EDITORIAL_FALLBACK_LANGUAGE
                  ? t('notifications.languageFallbackHint')
                  : t('notifications.languageOptionalHint', { language: t(`content.language.${lang}`) })}
              </p>
            </div>
          ) : null}

          <Field
            key={`title-${lang}`}
            label={t('notifications.field.title')}
            required={lang === EDITORIAL_FALLBACK_LANGUAGE}
            hint={t('notifications.field.titleHint', { max: MAX_PUSH_TITLE_CHARS })}
            error={half.includes(lang) && !current.title.trim() ? t('notifications.halfWritten') : undefined}
          >
            {({ id, describedBy, required }) => (
              <Input
                id={id}
                lang={lang}
                aria-describedby={describedBy}
                required={required}
                maxLength={MAX_PUSH_TITLE_CHARS}
                value={current.title}
                onChange={(event) => setCurrent({ title: event.target.value })}
              />
            )}
          </Field>

          <Field
            key={`body-${lang}`}
            label={t('notifications.field.body')}
            required={lang === EDITORIAL_FALLBACK_LANGUAGE}
            hint={t('notifications.field.bodyHint', { max: MAX_PUSH_BODY_CHARS })}
            error={half.includes(lang) && !current.body.trim() ? t('notifications.halfWritten') : undefined}
          >
            {({ id, describedBy, required }) => (
              <Textarea
                id={id}
                lang={lang}
                aria-describedby={describedBy}
                required={required}
                rows={3}
                maxLength={MAX_PUSH_BODY_CHARS}
                value={current.body}
                onChange={(event) => setCurrent({ body: event.target.value })}
              />
            )}
          </Field>

          {/* Said before the button, not after: this is the one act in the console with no
              undo and no delivery report. */}
          <InfoTip label={t('tip.noRecall')} text={t('tip.noRecall')}>
            {t('notifications.noRecallHint')}
          </InfoTip>
        </div>
      </Dialog>

      <ConfirmDialog
        open={confirmingSend}
        onOpenChange={setConfirmingSend}
        title={t('notifications.composeTitle')}
        description={t('notifications.confirmSendBody', {
          count: reach.data?.reachableDevices ?? 0,
        })}
        confirmLabel={t('notifications.send')}
        confirmVariant="primary"
        onConfirm={() => void confirmSend()}
        loading={send.isPending}
      >
        <p className="text-body-small text-text-secondary">{t('notifications.confirmSendHint')}</p>
        {/* Said before the send: who will read the fallback instead of their own language. */}
        {missing.length > 0 ? (
          <p className="mt-sm text-body-small text-warning">
            {t('notifications.confirmFallback', {
              languages: missing.map((one) => t(`content.language.${one}`)).join(', '),
              fallback: t(`content.language.${EDITORIAL_FALLBACK_LANGUAGE}`),
            })}
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
