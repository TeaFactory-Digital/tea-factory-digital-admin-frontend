/**
 * Writing a notification by hand — the act §21.24's second half is about.
 *
 * **A push cannot be recalled and reports nothing when it fails.** No phone tells the
 * console it discarded the message; no supplier tells it they had the category off. So
 * every safeguard in this dialog is a *pre*-check, and the reach panel is the important
 * one: it is the server's answer about consent the console does not hold, and it turns
 * "send to everybody" into a number somebody can argue with.
 *
 * The two figures beside each other are the point. *Reaches 61 devices, 6 opted out* is a
 * different decision from *reaches 3, 11 opted out* — the second belongs on the
 * noticeboard — and there is no way to learn which one happened after the fact.
 *
 * The category is a **required choice, not a default**, because the app routes on it: a
 * `newsArticle` push opens the feed and a `requestDecided` one opens the request. Picking
 * for the office would send suppliers to the wrong screen, and picking *wrong* sends them
 * nowhere at all — the app drops a category it does not recognize.
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, TriangleAlert, Users } from 'lucide-react';
import {
  MAX_PUSH_BODY_CHARS,
  MAX_PUSH_TITLE_CHARS,
  type NotificationAudience,
  type NotificationCategory,
  type NotificationTrigger,
} from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Textarea } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/states';
import { useToast } from '@/components/ui/Toast';
import { useRuntimeConfig } from '@/config/RuntimeConfigProvider';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatCount } from '@/lib/format';
import { useNotificationReach, useSendNotification } from './hooks';

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

  const available = useMemo(
    () => (triggers ?? []).filter((trigger) => trigger.available),
    [triggers],
  );

  const [category, setCategory] = useState<NotificationCategory | ''>('');
  const [kind, setKind] = useState<NotificationAudience['kind']>('allSuppliers');
  const [point, setPoint] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirmingSend, setConfirmingSend] = useState(false);

  // Reset on open, not on mount: a dialog reopened with the last message still in it is
  // one keystroke away from sending it twice.
  useEffect(() => {
    if (!open) return;
    setCategory('');
    setKind('allSuppliers');
    setPoint('');
    setTitle('');
    setBody('');
  }, [open]);

  const audience = useMemo<NotificationAudience>(
    () => (kind === 'collectionPoint' ? { kind, collectionPoint: point } : { kind: 'allSuppliers' }),
    [kind, point],
  );

  // Asked only once the audience is complete — see `useNotificationReach`.
  const audienceReady = kind === 'allSuppliers' || Boolean(point);
  const reach = useNotificationReach(
    (category || 'billPublished') as NotificationCategory,
    audience,
    open && Boolean(category) && audienceReady,
  );

  const complete = Boolean(category) && audienceReady && title.trim() && body.trim();
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
          <Field label={t('notifications.field.category')} required hint={t('notifications.field.categoryHint')}>
            {({ id, describedBy, required }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                required={required}
                value={category}
                onChange={(event) => setCategory(event.target.value as NotificationCategory)}
              >
                <option value="">{t('notifications.field.categoryPlaceholder')}</option>
                {available.map((trigger) => (
                  <option key={trigger.category} value={trigger.category}>
                    {t(`notifications.category.${trigger.category}`)}
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
                  <option value="allSuppliers">{t('notifications.audienceKind.allSuppliers')}</option>
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
           * The reach panel — the whole reason this dialog is not just a form.
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
                    <Users className="mt-xxs size-icon-sm shrink-0 text-text-secondary" aria-hidden />
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

          <Field
            label={t('notifications.field.title')}
            required
            hint={t('notifications.field.titleHint', { max: MAX_PUSH_TITLE_CHARS })}
          >
            {({ id, describedBy, required }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                required={required}
                maxLength={MAX_PUSH_TITLE_CHARS}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            )}
          </Field>

          <Field
            label={t('notifications.field.body')}
            required
            hint={t('notifications.field.bodyHint', { max: MAX_PUSH_BODY_CHARS })}
          >
            {({ id, describedBy, required }) => (
              <Textarea
                id={id}
                aria-describedby={describedBy}
                required={required}
                rows={3}
                maxLength={MAX_PUSH_BODY_CHARS}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            )}
          </Field>

          {/* Said before the button, not after: this is the one act in the console with no
              undo and no delivery report. */}
          <p className="text-caption text-text-secondary">{t('notifications.noRecallHint')}</p>
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
      </ConfirmDialog>
    </>
  );
}
