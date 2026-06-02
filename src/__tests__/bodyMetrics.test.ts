import { computeBmi, computeWeightTrend } from "../bodyMetrics";

describe("computeBmi", () => {
  it("computes BMI to 1 decimal", () => {
    expect(computeBmi(80, 180)).toBeCloseTo(24.7, 1);
    expect(computeBmi(100, 200)).toBe(25);
  });

  it("returns null for invalid input", () => {
    expect(computeBmi(80, 0)).toBeNull();
    expect(computeBmi(80, NaN)).toBeNull();
    expect(computeBmi(null, 180)).toBeNull();
    expect(computeBmi(undefined, 180)).toBeNull();
  });
});

describe("computeWeightTrend", () => {
  it("returns null for fewer than 2 metrics", () => {
    expect(computeWeightTrend([])).toBeNull();
    expect(computeWeightTrend([{ date: "2026-06-01", weight_kg: 80 }])).toBeNull();
  });

  it("tags a rising trend as bulk and a falling trend as cut", () => {
    const rising = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, "0")}`,
      weight_kg: 80 + i * 0.3,
    }));
    expect(computeWeightTrend(rising)?.phase).toBe("bulk");

    const falling = rising.map((m, i) => ({ date: m.date, weight_kg: 90 - i * 0.3 }));
    expect(computeWeightTrend(falling)?.phase).toBe("cut");
  });

  it("tags a flat trend as maintenance and sorts by date", () => {
    const flat = [
      { date: "2026-06-03", weight_kg: 80 },
      { date: "2026-06-01", weight_kg: 80 },
      { date: "2026-06-02", weight_kg: 80.1 },
    ];
    const trend = computeWeightTrend(flat);
    expect(trend?.phase).toBe("maintenance");
    expect(trend?.rawValues[0]).toBe(80); // 06-01 first after sort
  });
});
