import { computeStreak } from "../streak";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysAgo(now: Date, n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return ymd(d);
}

describe("computeStreak", () => {
  const now = new Date(2026, 5, 2); // 2026-06-02

  it("returns 0 with no workouts", () => {
    expect(computeStreak([], now)).toBe(0);
  });

  it("counts consecutive days including today", () => {
    const dates = [daysAgo(now, 0), daysAgo(now, 1), daysAgo(now, 2)];
    expect(computeStreak(dates, now)).toBe(3);
  });

  it("allows today to be missing and counts from yesterday", () => {
    const dates = [daysAgo(now, 1), daysAgo(now, 2)];
    expect(computeStreak(dates, now)).toBe(2);
  });

  it("stops at the first gap", () => {
    const dates = [daysAgo(now, 0), daysAgo(now, 1), daysAgo(now, 3)];
    expect(computeStreak(dates, now)).toBe(2);
  });

  it("returns 0 when neither today nor yesterday has a workout", () => {
    const dates = [daysAgo(now, 3), daysAgo(now, 4)];
    expect(computeStreak(dates, now)).toBe(0);
  });

  it("ignores duplicate dates", () => {
    const dates = [daysAgo(now, 0), daysAgo(now, 0), daysAgo(now, 1)];
    expect(computeStreak(dates, now)).toBe(2);
  });
});
