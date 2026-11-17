// src/reminderSchedule.ts — which days and what time the workout reminder
// fires. Pure (no DB, no notifications) so it can be unit-tested.

/** ISO weekdays: 1 = Monday … 7 = Sunday. */
export type ReminderSchedule = {
  days: number[];
  hour: number;
  minute: number;
};

/** Offered when reminders are switched on for the first time. */
export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = { days: [1, 3, 5], hour: 17, minute: 0 };

/**
 * What the app scheduled before days and time could be chosen: Mondays at
 * 17:00 only. Shown for installs that had reminders on at that point, so the
 * settings match what the phone actually does.
 */
export const LEGACY_REMINDER_SCHEDULE: ReminderSchedule = { days: [1], hour: 17, minute: 0 };

function cleanDays(days: number[]): number[] {
  return [...new Set(days.filter((d) => Number.isInteger(d) && d >= 1 && d <= 7))].sort((a, b) => a - b);
}

/** "1,3,5" — sorted, unique, valid days only. */
export function serializeReminderDays(days: number[]): string {
  return cleanDays(days).join(",");
}

/** "17:00" */
export function formatReminderTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Read a stored schedule. Anything missing or malformed falls back to
 * `fallback` field by field — an empty day list is malformed (a schedule with
 * no days is "reminders off", which is a separate setting).
 */
export function parseReminderSchedule(
  daysRaw: string | null | undefined,
  timeRaw: string | null | undefined,
  fallback: ReminderSchedule = DEFAULT_REMINDER_SCHEDULE,
): ReminderSchedule {
  const days = cleanDays(
    String(daysRaw ?? "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10)),
  );
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(timeRaw ?? "").trim());
  const hour = m ? parseInt(m[1], 10) : NaN;
  const minute = m ? parseInt(m[2], 10) : NaN;
  const timeOk = Number.isInteger(hour) && hour >= 0 && hour <= 23 && Number.isInteger(minute) && minute >= 0 && minute <= 59;
  return {
    days: days.length > 0 ? days : [...fallback.days],
    hour: timeOk ? hour : fallback.hour,
    minute: timeOk ? minute : fallback.minute,
  };
}

/** Turn a day on or off; the last remaining day cannot be removed. */
export function toggleReminderDay(days: number[], day: number): number[] {
  const current = cleanDays(days);
  if (!current.includes(day)) return cleanDays([...current, day]);
  return current.length > 1 ? current.filter((d) => d !== day) : current;
}

/** expo-notifications weekly triggers count from Sunday: 1 = Sunday … 7 = Saturday. */
export function toExpoWeekday(isoDay: number): number {
  return isoDay === 7 ? 1 : isoDay + 1;
}
