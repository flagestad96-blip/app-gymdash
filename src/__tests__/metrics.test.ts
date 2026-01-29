import { e1rmEpley, suggestNextWeight } from "../metrics";

describe("metrics", () => {
  it("e1rmEpley calculates expected value", () => {
    const v = e1rmEpley(100, 5);
    expect(v).toBeCloseTo(116.6667, 3);
  });

  it("suggestNextWeight holds when RPE is high", () => {
    const next = suggestNextWeight({
      lastWeight: 80,
      lastReps: 8,
      targetRepMin: 6,
      targetRepMax: 10,
      lastRpe: 9.5,
      incrementKg: 2.5,
    });
    expect(next).toBe(80);
  });

  it("suggestNextWeight increases on top reps", () => {
    const next = suggestNextWeight({
      lastWeight: 80,
      lastReps: 10,
      targetRepMin: 6,
      targetRepMax: 10,
      incrementKg: 2.5,
    });
    expect(next).toBe(82.5);
  });
});
