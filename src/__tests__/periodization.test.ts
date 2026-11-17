import { isDeloadWeek, getDefaultPeriodization, type Periodization } from "../periodization";

const cfg = (over: Partial<Periodization> = {}): Periodization => ({
  enabled: true,
  cycleWeeks: 4,
  deloadEvery: 4,
  currentWeek: 1,
  ...over,
});

describe("isDeloadWeek", () => {
  it("manual override always wins", () => {
    expect(isDeloadWeek(cfg({ enabled: false, manualDeload: true }))).toBe(true);
  });
  it("is false when disabled and no manual override", () => {
    expect(isDeloadWeek(cfg({ enabled: false }))).toBe(false);
  });
  it("is true only on the configured deload week", () => {
    expect(isDeloadWeek(cfg({ currentWeek: 4, deloadEvery: 4 }))).toBe(true);
    expect(isDeloadWeek(cfg({ currentWeek: 2, deloadEvery: 4 }))).toBe(false);
  });
});

describe("getDefaultPeriodization", () => {
  it("returns a disabled default copy", () => {
    const a = getDefaultPeriodization();
    expect(a.enabled).toBe(false);
    expect(a.cycleWeeks).toBe(4);
    a.enabled = true; // mutate the copy
    expect(getDefaultPeriodization().enabled).toBe(false); // original untouched
  });
});
