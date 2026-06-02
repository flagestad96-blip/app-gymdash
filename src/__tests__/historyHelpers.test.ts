import { periodCutoffIso, durationMinutes } from "../historyHelpers";

describe("periodCutoffIso", () => {
  const now = new Date(2026, 5, 2); // 2026-06-02

  it("returns null for all-time", () => {
    expect(periodCutoffIso("all", now)).toBeNull();
  });

  it("subtracts the right number of days", () => {
    expect(periodCutoffIso("week", now)).toBe("2026-05-26");
    expect(periodCutoffIso("month", now)).toBe("2026-05-03");
    expect(periodCutoffIso("3mo", now)).toBe("2026-03-04");
  });
});

describe("durationMinutes", () => {
  it("returns null for missing or invalid input", () => {
    expect(durationMinutes(null, "x")).toBeNull();
    expect(durationMinutes("x", null)).toBeNull();
    expect(durationMinutes("not-a-date", "also-not")).toBeNull();
  });

  it("returns null when end is not after start", () => {
    const t = "2026-06-02T10:00:00.000Z";
    expect(durationMinutes(t, t)).toBeNull();
    expect(durationMinutes("2026-06-02T11:00:00.000Z", "2026-06-02T10:00:00.000Z")).toBeNull();
  });

  it("rounds elapsed minutes", () => {
    expect(durationMinutes("2026-06-02T10:00:00.000Z", "2026-06-02T11:30:00.000Z")).toBe(90);
    expect(durationMinutes("2026-06-02T10:00:00.000Z", "2026-06-02T10:00:40.000Z")).toBe(1);
  });
});
