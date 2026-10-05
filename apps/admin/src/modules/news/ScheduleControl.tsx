/**
 * Publish a draft at a chosen time instead of now (BACKEND-TODO #36): an announcement
 * written on Friday for Monday morning, without anybody at the console on Monday.
 *
 * The time is picked in **Colombo time** and sent as an instant, so a browser in another
 * timezone schedules the same moment the factory means. Banners need none of this: their
 * Starts / Ends window already is their schedule.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, X } from 'lucide-react';
import type { AdminNewsArticle } from '@tfd/domain';
import { Button } from '@/components/ui/Button';
import { DateTimePicker } from '@/components/ui/DatePicker';
import { useToast } from '@/components/ui/Toast';
import { errorMessageKey } from '@/lib/errorMessage';
import { formatDateTime } from '@/lib/format';
import { useScheduleNews } from '@/modules/content/hooks';
import { colomboLocalToInstant } from '@/lib/colombo';

export function ScheduleControl({ article }: { article: AdminNewsArticle }) {
  const { t } = useTranslation();
  const toast = useToast();
  const schedule = useScheduleNews(article.id);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const scheduledAt = article.scheduledPublishAt ?? null;
  const inFuture = value !== '' && new Date(colomboLocalToInstant(value)).getTime() > Date.now();

  if (article.status === 'published') return null;

  if (scheduledAt) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-sm rounded-md bg-info-muted px-md py-sm">
        <span className="flex items-center gap-xs text-body-small text-info">
          <CalendarClock className="size-icon-sm" aria-hidden />
          {t('news.schedule.scheduledFor', { when: formatDateTime(scheduledAt) })}
        </span>
        <Button
          size="sm"
          variant="ghost"
          loading={schedule.isPending}
          iconLeft={<X className="size-icon-sm" aria-hidden />}
          onClick={() =>
            schedule.mutate(null, {
              onSuccess: () => toast.success(t('news.schedule.cancelled')),
              onError: (cause) => toast.error(t('news.schedule.failed'), t(errorMessageKey(cause))),
            })
          }
        >
          {t('news.schedule.cancel')}
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        iconLeft={<CalendarClock className="size-icon-sm" aria-hidden />}
        onClick={() => setOpen(true)}
      >
        {t('news.schedule.open')}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-sm rounded-md border border-border p-md">
      <span className="text-body-small font-medium text-text-primary">
        {t('news.schedule.label')}
      </span>
      <DateTimePicker
        value={value}
        onChange={setValue}
        aria-label={t('news.schedule.label')}
        invalid={value !== '' && !inFuture}
      />
      {value !== '' && !inFuture ? (
        <span className="text-caption text-error">{t('news.schedule.past')}</span>
      ) : null}
      <div className="flex justify-end gap-sm">
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!inFuture}
          loading={schedule.isPending}
          onClick={() =>
            schedule.mutate(colomboLocalToInstant(value), {
              onSuccess: () => {
                toast.success(t('news.schedule.saved'));
                setOpen(false);
              },
              onError: (cause) => toast.error(t('news.schedule.failed'), t(errorMessageKey(cause))),
            })
          }
        >
          {t('news.schedule.save')}
        </Button>
      </div>
    </div>
  );
}
