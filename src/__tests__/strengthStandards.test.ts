import {
  getStandard,
  getThresholds,
  getTargetWeights,
  hasStandard,
  getStandardExerciseIds,
} from "../strengthStandards";

describe("strengthStandards lookup", () => {
  it("knows which exercises have standards", () => {
    expect(hasStandard("bench_press")).toBe(true);
    expect(hasStandard("not_a_lift")).toBe(false);
    expect(getStandardExerciseIds()).toContain("squat");
  });
});

describe("getStandard (male bench_press: 0.5/0.75/1.0/1.25/1.5)", () => {
  it("maps ratio to the highest level met", () => {
    expect(getStandard("bench_press", 100, 100)).toBe("intermediate"); // ratio 1.0
    expect(getStandard("bench_press", 50, 100)).toBe("beginner"); // ratio 0.5
    expect(getStandard("bench_press", 200, 100)).toBe("elite"); // ratio 2.0
  });

  it("floors at beginner even below the beginner threshold", () => {
    expect(getStandard("bench_press", 30, 100)).toBe("beginner"); // ratio 0.3
  });

  it("uses the female table when requested", () => {
    // female bench: 0.25/0.40/0.60/0.80/1.00 — ratio 0.6 -> intermediate
    expect(getStandard("bench_press", 36, 60, "female")).toBe("intermediate");
  });

  it("returns null for unknown exercise / invalid inputs", () => {
    expect(getStandard("not_a_lift", 100, 100)).toBeNull();
    expect(getStandard("bench_press", 100, 0)).toBeNull();
    expect(getStandard("bench_press", 0, 100)).toBeNull();
  });
});

describe("getThresholds / getTargetWeights", () => {
  it("returns 5 ordered thresholds", () => {
    const th = getThresholds("squat");
    expect(th).not.toBeNull();
    expect(th!.map((x) => x.level)).toEqual(["beginner", "novice", "intermediate", "advanced", "elite"]);
    expect(th!.map((x) => x.multiplier)).toEqual([0.75, 1.0, 1.5, 2.0, 2.5]);
  });

  it("computes target weights rounded to 0.5kg", () => {
    const w = getTargetWeights("bench_press", 70);
    expect(w!.map((x) => x.weight)).toEqual([35, 52.5, 70, 87.5, 105]);
  });

  it("returns null for unknown exercise / missing bodyweight", () => {
    expect(getThresholds("not_a_lift")).toBeNull();
    expect(getTargetWeights("bench_press", 0)).toBeNull();
  });
});
