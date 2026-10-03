/**
 * Office hours: a week of opening times ⇄ the one line of text the app shows.
 *
 * `factory.supportHours` is a plain string that the mobile app prints as it is ("Office
 * hours: …"). The console edits it as a week, one row per day, and writes it back as text
 * with consecutive days that share the same hours grouped:
 *
 *     Mon–Fri 08:00–17:00; Sat 08:00–12:00
 *
 * 24-hour times and three-letter day names, so the line reads the same to a Sinhala, Tamil
 * or English reader. Anything that is not in this format cannot be turned back into a week
 * (`parseOfficeHours` returns `null`) and stays editable as free text.
 */

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];

export interface DayHours {
  open: boolean;
  from: string; // HH:MM
  to: string; // HH:MM
}

export type WeekHours = Record<WeekDay, DayHours>;

export function defaultWeek(): WeekHours {
  const day = (open: boolean, to = '17:00'): DayHours => ({ open, from: '08:00', to });
  return {
    Mon: day(true),
    Tue: day(true),
    Wed: day(true),
    Thu: day(true),
    Fri: day(true),
    Sat: day(true, '12:00'),
    Sun: day(false),
  };
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The week as one line, consecutive days with the same hours grouped. `''` when closed all week. */
export function formatOfficeHours(week: WeekHours): string {
  const parts: string[] = [];
  let start = 0;
  while (start < WEEK_DAYS.length) {
    const first = week[WEEK_DAYS[start]!];
    let end = start;
    while (end + 1 < WEEK_DAYS.length && sameHours(first, week[WEEK_DAYS[end + 1]!])) {
      end += 1;
    }
    if (first.open) {
      const days = start === end ? WEEK_DAYS[start] : `${WEEK_DAYS[start]}–${WEEK_DAYS[end]}`;
      parts.push(`${days} ${first.from}–${first.to}`);
    }
    start = end + 1;
  }
  return parts.join('; ');
}

function sameHours(a: DayHours, b: DayHours): boolean {
  if (!a.open && !b.open) return true;
  return a.open === b.open && a.from === b.from && a.to === b.to;
}

/**
 * The line back into a week, or `null` when it is not in `formatOfficeHours`'s format (an
 * older free-text value such as "Mon–Sat, 8am–5pm"). Days not mentioned are closed.
 */
export function parseOfficeHours(text: string): WeekHours | null {
  const week = defaultWeek();
  for (const day of WEEK_DAYS) week[day] = { ...week[day], open: false };
  const trimmed = text.trim();
  if (!trimmed) return null;

  for (const part of trimmed.split(';')) {
    const match =
      /^\s*(\w{3})(?:\s*[–-]\s*(\w{3}))?\s+(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})\s*$/.exec(part);
    if (!match) return null;
    const [, fromDay, toDay, from, to] = match;
    const a = WEEK_DAYS.indexOf(fromDay as WeekDay);
    const b = toDay ? WEEK_DAYS.indexOf(toDay as WeekDay) : a;
    if (a < 0 || b < a || !TIME.test(from!) || !TIME.test(to!)) return null;
    for (let i = a; i <= b; i += 1) week[WEEK_DAYS[i]!] = { open: true, from: from!, to: to! };
  }
  return week;
}

/** Days whose closing time is not after their opening time. */
export function officeHoursProblems(week: WeekHours): WeekDay[] {
  return WEEK_DAYS.filter((day) => week[day].open && week[day].to <= week[day].from);
}
