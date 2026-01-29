import { bodyweightFactorFor, isBodyweight } from "../exerciseLibrary";
import { calcBodyweightTotal, pickLatestBodyMetricBeforeOrOn } from "../db";

describe("bodyweight flags", () => {
  it("marks pull-ups as bodyweight", () => {
    expect(isBodyweight("pull_up")).toBe(true);
  });

  it("returns factor for push-up", () => {
    expect(bodyweightFactorFor("push_up")).toBeCloseTo(0.64, 2);
  });

  it("non-bodyweight returns false", () => {
    expect(isBodyweight("bench_press")).toBe(false);
  });
});

describe("bodyweight calculations", () => {
  it("calcBodyweightTotal combines BW and external load", () => {
    const total = calcBodyweightTotal(80, 0.7, 10);
    expect(total).toBeCloseTo(66, 2);
  });

  it("pickLatestBodyMetricBeforeOrOn returns same-day or latest before", () => {
    const rows = [
      { date: "2026-01-01", weight_kg: 80 },
      { date: "2026-01-05", weight_kg: 82 },
      { date: "2026-01-10", weight_kg: 83 },
    ];
    const same = pickLatestBodyMetricBeforeOrOn(rows as any, "2026-01-05");
    const before = pickLatestBodyMetricBeforeOrOn(rows as any, "2026-01-07");
    expect(same?.weight_kg).toBe(82);
    expect(before?.weight_kg).toBe(82);
  });
});
