import { pad2, addDays, parseLocalDate, weekStartKey, monthKey, fmtRest } from "../analysisHelpers";

describe("analysisHelpers", () => {
  it("pad2 zero-pads single digits", () => {
    expect(pad2(3)).toBe("03");
    expect(pad2(12)).toBe("12");
  });

  it("addDays shifts without mutating the input", () => {
    const base = new Date(2026, 5, 2);
    const out = addDays(base, 5);
    expect(out.getDate()).toBe(7);
    expect(base.getDate()).toBe(2);
    expect(addDays(base, -2).getDate()).toBe(31); // crosses into May
  });

  it("parseLocalDate parses YYYY-MM-DD as local", () => {
    const d = parseLocalDate("2026-06-02");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5);
    expect(d.getDate()).toBe(2);
  });

  it("weekStartKey returns Monday of the week", () => {
    expect(weekStartKey(new Date(2026, 5, 2))).toBe("2026-06-01"); // Tue -> Mon
    expect(weekStartKey(new Date(2026, 5, 7))).toBe("2026-06-01"); // Sun -> Mon
  });

  it("monthKey returns YYYY-MM", () => {
    expect(monthKey(new Date(2026, 0, 9))).toBe("2026-01");
  });

  it("fmtRest formats m:ss", () => {
    expect(fmtRest(0)).toBe("0:00");
    expect(fmtRest(65)).toBe("1:05");
    expect(fmtRest(600)).toBe("10:00");
  });
});
