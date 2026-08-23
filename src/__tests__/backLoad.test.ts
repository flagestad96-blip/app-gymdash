import { computeBackLoad, backLoadTrend, BACK_IMPACT_WEIGHTS } from "../backLoad";
import type { BackImpact } from "../exerciseLibrary";

const IMPACTS: Record<string, BackImpact | undefined> = {
  deadlift: "red",
  row: "yellow",
  legpress: "green",
  curl: undefined,
};
const impactFor = (id: string) => IMPACTS[id];

describe("computeBackLoad", () => {
  it("weights volume by back impact level", () => {
    const result = computeBackLoad(
      [
        { exerciseId: "deadlift", volumeKg: 1000 }, // ×1.0 = 1000
        { exerciseId: "row", volumeKg: 1000 }, // ×0.5 = 500
        { exerciseId: "legpress", volumeKg: 1000 }, // ×0.15 = 150
      ],
      impactFor
    );
    expect(result.scoreKg).toBe(1650);
    expect(result.flaggedVolumeKg).toBe(3000);
  });

  it("ignores exercises without a back impact level and empty rows", () => {
    const result = computeBackLoad(
      [
        { exerciseId: "curl", volumeKg: 5000 },
        { exerciseId: null, volumeKg: 800 },
        { exerciseId: "deadlift", volumeKg: 0 },
      ],
      impactFor
    );
    expect(result.scoreKg).toBe(0);
    expect(result.flaggedVolumeKg).toBe(0);
  });

  it("returns zeros for empty input", () => {
    expect(computeBackLoad([], impactFor)).toEqual({ scoreKg: 0, flaggedVolumeKg: 0 });
  });

  it("red counts fully, green barely", () => {
    expect(BACK_IMPACT_WEIGHTS.red).toBe(1);
    expect(BACK_IMPACT_WEIGHTS.green).toBeLessThan(BACK_IMPACT_WEIGHTS.yellow);
  });
});

describe("backLoadTrend", () => {
  it("computes direction with a ±5% dead zone", () => {
    expect(backLoadTrend(1100, 1000)).toEqual({ pct: 10, dir: "up" });
    expect(backLoadTrend(850, 1000)).toEqual({ pct: 15, dir: "down" });
    expect(backLoadTrend(1030, 1000)).toEqual({ pct: 3, dir: "flat" });
  });

  it("returns null without a previous week", () => {
    expect(backLoadTrend(500, 0)).toBeNull();
  });
});
