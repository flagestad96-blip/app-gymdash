import {
  DEFAULT_REMINDER_SCHEDULE,
  LEGACY_REMINDER_SCHEDULE,
  formatReminderTime,
  parseReminderSchedule,
  serializeReminderDays,
  toExpoWeekday,
  toggleReminderDay,
} from "../reminderSchedule";

describe("parseReminderSchedule", () => {
  it("reads stored days and time", () => {
    expect(parseReminderSchedule("2,4,6", "06:30")).toEqual({ days: [2, 4, 6], hour: 6, minute: 30 });
  });

  it("sorts, de-duplicates and drops invalid days", () => {
    expect(parseReminderSchedule("5, 1,1,9,0,x", "17:00").days).toEqual([1, 5]);
  });

  it("falls back per field when something is missing or malformed", () => {
    expect(parseReminderSchedule(null, null)).toEqual(DEFAULT_REMINDER_SCHEDULE);
    expect(parseReminderSchedule("", "25:00")).toEqual(DEFAULT_REMINDER_SCHEDULE);
    expect(parseReminderSchedule("3", "7:5")).toEqual({ days: [3], hour: 17, minute: 0 });
    expect(parseReminderSchedule(undefined, "08:15", LEGACY_REMINDER_SCHEDULE)).toEqual({ days: [1], hour: 8, minute: 15 });
  });

  it("does not hand out the fallback's own array", () => {
    const parsed = parseReminderSchedule(null, null);
    parsed.days.push(7);
    expect(DEFAULT_REMINDER_SCHEDULE.days).toEqual([1, 3, 5]);
  });
});

describe("reminder helpers", () => {
  it("serializes days and formats time", () => {
    expect(serializeReminderDays([5, 1, 3, 3])).toBe("1,3,5");
    expect(formatReminderTime(7, 5)).toBe("07:05");
  });

  it("toggles days but keeps at least one", () => {
    expect(toggleReminderDay([1, 3], 5)).toEqual([1, 3, 5]);
    expect(toggleReminderDay([1, 3], 3)).toEqual([1]);
    expect(toggleReminderDay([1], 1)).toEqual([1]);
  });

  it("maps ISO weekdays to expo's Sunday-first numbering", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(toExpoWeekday)).toEqual([2, 3, 4, 5, 6, 7, 1]);
  });
});
