import { warmupRamp, barWeightForEquipment } from "../warmupRamp";

describe("barWeightForEquipment", () => {
  it("maps barbell and trapbar, nothing else", () => {
    expect(barWeightForEquipment("barbell")).toBe(20);
    expect(barWeightForEquipment("trapbar")).toBe(25);
    expect(barWeightForEquipment("smith")).toBeNull();
    expect(barWeightForEquipment("machine")).toBeNull();
    expect(barWeightForEquipment(undefined)).toBeNull();
  });
});

describe("warmupRamp", () => {
  it("returns empty for invalid working weights", () => {
    expect(warmupRamp(0, { incrementKg: 2.5 })).toEqual([]);
    expect(warmupRamp(-10, { incrementKg: 2.5 })).toEqual([]);
    expect(warmupRamp(NaN, { incrementKg: 2.5 })).toEqual([]);
  });

  it("builds the classic bar + 40/60/80 ramp for a barbell lift", () => {
    expect(warmupRamp(60, { incrementKg: 2.5, barWeightKg: 20 })).toEqual([
      { weightKg: 20, reps: 10, isBar: true },
      { weightKg: 25, reps: 5, isBar: false },
      { weightKg: 35, reps: 3, isBar: false },
      { weightKg: 47.5, reps: 1, isBar: false },
    ]);
  });

  it("drops percentage steps that land at or below the bar", () => {
    expect(warmupRamp(40, { incrementKg: 2.5, barWeightKg: 20 })).toEqual([
      { weightKg: 20, reps: 10, isBar: true },
      { weightKg: 25, reps: 3, isBar: false }, // 40% (15) ≤ bar, dropped
      { weightKg: 32.5, reps: 1, isBar: false },
    ]);
  });

  it("collapses to just the bar for very light barbell work", () => {
    expect(warmupRamp(25, { incrementKg: 2.5, barWeightKg: 20 })).toEqual([
      { weightKg: 20, reps: 10, isBar: true },
    ]);
  });

  it("skips the bar step when the working weight is not above the bar", () => {
    expect(warmupRamp(20, { incrementKg: 2.5, barWeightKg: 20 })).toEqual([]);
  });

  it("ramps on percentages only without a bar", () => {
    expect(warmupRamp(30, { incrementKg: 2.5 })).toEqual([
      { weightKg: 12.5, reps: 5, isBar: false },
      { weightKg: 17.5, reps: 3, isBar: false },
      { weightKg: 25, reps: 1, isBar: false },
    ]);
  });

  it("dedupes steps that round to the same weight on light dumbbell work", () => {
    expect(warmupRamp(10, { incrementKg: 2.5 })).toEqual([
      { weightKg: 5, reps: 5, isBar: false }, // 40% and 60% both round to 5; keep the first
      { weightKg: 7.5, reps: 1, isBar: false },
    ]);
  });

  it("respects a finer increment", () => {
    expect(warmupRamp(50, { incrementKg: 1.25, barWeightKg: 20 })).toEqual([
      { weightKg: 20, reps: 10, isBar: true },
      // 40% of 50 rounds to exactly the bar weight, so that step is dropped.
      { weightKg: 30, reps: 3, isBar: false },
      { weightKg: 40, reps: 1, isBar: false },
    ]);
  });

  it("falls back to a 2.5 increment when the given one is invalid", () => {
    expect(warmupRamp(60, { incrementKg: 0 })).toEqual([
      { weightKg: 25, reps: 5, isBar: false },
      { weightKg: 35, reps: 3, isBar: false },
      { weightKg: 47.5, reps: 1, isBar: false },
    ]);
  });
});
