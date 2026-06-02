import { isDeloadWeek, deloadWeight, getDefaultPeriodization, type Periodization } from "../periodization";

const cfg = (over: Partial<Periodization> = {}): Periodization => ({
  enabled: true,
  cycleWeeks: 4,
  deloadEvery: 4,
  deloadPercent: 60,
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

describe("deloadWeight", () => {
  it("returns the weight unchanged outside a deload week", () => {
    expect(deloadWeight(100, cfg({ currentWeek: 2 }))).toBe(100);
  });
  it("applies the deload percent rounded to 0.5 on a deload week", () => {
    const dc = cfg({ currentWeek: 4, deloadEvery: 4, deloadPercent: 60 });
    expect(deloadWeight(100, dc)).toBe(60);
    expect(deloadWeight(85, dc)).toBe(51);
    expect(deloadWeight(102.5, dc)).toBe(61.5);
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
