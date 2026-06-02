// src/streak.ts — workout streak calculation (pure, testable).

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Count the current daily workout streak.
 *
 * `workoutDates` is the list of distinct YYYY-MM-DD dates that have a workout
 * (order doesn't matter). Walks backwards from `now`: a day with a workout
 * extends the streak; the first day (today) is allowed to be missing (the user
 * may not have trained yet today); any other gap ends the streak.
 *
 * The walk is capped at 366 days for safety. (The old inline version capped at
 * the number of distinct workout dates, which undercounted the streak by one
 * whenever today had no workout yet — fixed here.)
 */
export function computeStreak(workoutDates: string[], now: Date = new Date()): number {
  const set = new Set(workoutDates);
  let count = 0;
  const MAX_DAYS = 366;
  for (let i = 0; i < MAX_DAYS; i++) {
    const check = new Date(now);
    check.setDate(check.getDate() - i);
    if (set.has(ymd(check))) {
      count++;
    } else if (i === 0) {
      continue; // today may not have a workout yet
    } else {
      break;
    }
  }
  return count;
}
