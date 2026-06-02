import { mondayOf, previousMondayOf } from "../weekRange";

describe("weekRange", () => {
  it("returns the same Monday for any weekday in that week", () => {
    // 2026-06-02 is a Tuesday; that week's Monday is 2026-06-01.
    expect(mondayOf(new Date(2026, 5, 2))).toBe("2026-06-01");
    expect(mondayOf(new Date(2026, 5, 1))).toBe("2026-06-01"); // Monday itself
    expect(mondayOf(new Date(2026, 5, 6))).toBe("2026-06-01"); // Saturday
  });

  it("treats Sunday as belonging to the prior week", () => {
    // 2026-06-07 is a Sunday -> Monday 2026-06-01.
    expect(mondayOf(new Date(2026, 5, 7))).toBe("2026-06-01");
  });

  it("previousMondayOf is exactly one week before", () => {
    expect(previousMondayOf(new Date(2026, 5, 2))).toBe("2026-05-25");
    expect(previousMondayOf(new Date(2026, 5, 7))).toBe("2026-05-25");
  });

  it("does not mutate the input date", () => {
    const input = new Date(2026, 5, 2);
    const snapshot = input.getTime();
    mondayOf(input);
    previousMondayOf(input);
    expect(input.getTime()).toBe(snapshot);
  });
});
