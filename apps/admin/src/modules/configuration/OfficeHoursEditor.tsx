/**
 * Office hours as a week: one row per day, a switch for open or closed, and the times.
 *
 * Written back as the one line of text the app prints (`lib/officeHours.ts`), so nothing
 * on the server or in the app changes. An older value that is not in that format cannot
 * be turned into a week without guessing, so it is kept and edited as text until the
 * administrator chooses to set it up as a week.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { TimePicker } from '@/components/ui/TimePicker';
import {
  WEEK_DAYS,
  defaultWeek,
  formatOfficeHours,
  officeHoursProblems,
  parseOfficeHours,
  type WeekHours,
} from '@/lib/officeHours';

export function OfficeHoursEditor({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const parsed = parseOfficeHours(value);
  // Free text only for a value that is set and cannot be read as a week.
  const [asText, setAsText] = useState(Boolean(value.trim()) && parsed === null);
  const [week, setWeek] = useState<WeekHours>(parsed ?? defaultWeek());

  const update = (next: WeekHours) => {
    setWeek(next);
    onChange(formatOfficeHours(next));
  };
  const problems = officeHoursProblems(week);

  if (asText) {
    return (
      <div className="flex flex-col gap-xs">
        <Input
          aria-label={t('config.factory.supportHours')}
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {!disabled ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setAsText(false);
                update(week);
              }}
            >
              {t('config.hours.useWeek')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-sm">
      <ul className="flex flex-col divide-y divide-divider rounded-md border border-border">
        {WEEK_DAYS.map((day) => {
          const hours = week[day];
          const set = (patch: Partial<typeof hours>) =>
            update({ ...week, [day]: { ...hours, ...patch } });
          return (
            <li key={day} className="flex flex-wrap items-center gap-sm px-md py-xs">
              <label className="flex w-36 items-center gap-xs text-body-small text-text-primary">
                <Checkbox
                  checked={hours.open}
                  disabled={disabled}
                  onCheckedChange={(checked) => set({ open: checked === true })}
                />
                {t(`config.hours.day.${day}`)}
              </label>
              {hours.open ? (
                <span className="flex items-center gap-xs">
                  <TimePicker
                    value={hours.from}
                    onChange={(from) => set({ from })}
                    disabled={disabled}
                    aria-label={t('config.hours.opens', { day: t(`config.hours.day.${day}`) })}
                  />
                  <span className="text-text-secondary">–</span>
                  <TimePicker
                    value={hours.to}
                    onChange={(to) => set({ to })}
                    disabled={disabled}
                    invalid={problems.includes(day)}
                    aria-label={t('config.hours.closes', { day: t(`config.hours.day.${day}`) })}
                  />
                </span>
              ) : (
                <span className="text-caption text-text-secondary">{t('config.hours.closed')}</span>
              )}
            </li>
          );
        })}
      </ul>

      {problems.length > 0 ? (
        <p role="alert" className="text-caption text-error">
          {t('config.hours.backwards')}
        </p>
      ) : null}

      {!disabled ? (
        <div className="flex flex-wrap items-center gap-sm">
          {/* The common case is five identical weekdays: set Monday, copy it. */}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            iconLeft={<Copy className="size-icon-sm" aria-hidden />}
            onClick={() =>
              update({
                ...week,
                Tue: { ...week.Mon },
                Wed: { ...week.Mon },
                Thu: { ...week.Mon },
                Fri: { ...week.Mon },
              })
            }
          >
            {t('config.hours.copyMonday')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAsText(true)}>
            {t('config.hours.writeText')}
          </Button>
        </div>
      ) : null}

      {/* Exactly what the app will print, so nobody has to guess. */}
      <p className="text-caption text-text-secondary">
        {t('config.hours.preview')}{' '}
        <span className="numeric text-text-primary">
          {formatOfficeHours(week) || t('config.hours.allClosed')}
        </span>
      </p>
    </div>
  );
}
