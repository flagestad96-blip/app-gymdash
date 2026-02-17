import { e1rmEpley, epley1RM, round1, suggestNextWeight } from "../metrics";
import { formatWeight, mmss } from "../format";

describe("epley1RM", () => {
  it("applies formula even for 1 rep (clamps to min 1)", () => {
    // epley1RM: weight * (1 + max(1,reps)/30) → 100 * (1 + 1/30) ≈ 103.33
    expect(epley1RM(100, 1)).toBeCloseTo(103.333, 1);
  });

  it("calculates 100kg x 10 ≈ 133.3", () => {
    expect(epley1RM(100, 10)).toBeCloseTo(133.333, 1);
  });

  it("returns 0 for 0kg", () => {
    expect(epley1RM(0, 10)).toBe(0);
  });

  it("clamps reps to minimum 1 so 0 reps equals 1 rep", () => {
    // reps = 0 → max(1, 0) = 1 → same as 1 rep
    expect(epley1RM(80, 0)).toBeCloseTo(epley1RM(80, 1), 5);
  });
});

describe("e1rmEpley (original)", () => {
  it("calculates expected value for 5 reps", () => {
    const v = e1rmEpley(100, 5);
    expect(v).toBeCloseTo(116.6667, 3);
  });

  it("returns weight for 1 rep", () => {
    expect(e1rmEpley(100, 1)).toBe(100);
  });
});

describe("round1", () => {
  it("rounds to 1 decimal place", () => {
    expect(round1(1.25)).toBe(1.3);
    expect(round1(1.24)).toBe(1.2);
    expect(round1(10.05)).toBe(10.1);
  });

  it("keeps integers as integers", () => {
    expect(round1(5)).toBe(5);
    expect(round1(100)).toBe(100);
  });

  it("handles negative numbers", () => {
    expect(round1(-1.25)).toBe(-1.2);
  });
});

describe("formatWeight", () => {
  it("returns integer without decimal for whole numbers", () => {
    expect(formatWeight(100)).toBe("100");
    expect(formatWeight(0)).toBe("0");
    expect(formatWeight(50)).toBe("50");
  });

  it("returns 1 decimal for fractional weights", () => {
    expect(formatWeight(82.5)).toBe("82.5");
    expect(formatWeight(1.1)).toBe("1.1");
  });

  it("rounds to nearest tenth", () => {
    expect(formatWeight(100.06)).toBe("100.1");
    expect(formatWeight(99.94)).toBe("99.9");
  });

  it("returns empty string for non-finite values", () => {
    expect(formatWeight(NaN)).toBe("");
    expect(formatWeight(Infinity)).toBe("");
    expect(formatWeight(-Infinity)).toBe("");
  });
});

describe("mmss", () => {
  it("formats 0 seconds as 00:00", () => {
    expect(mmss(0)).toBe("00:00");
  });

  it("formats 90 seconds as 01:30", () => {
    expect(mmss(90)).toBe("01:30");
  });

  it("formats 3661 seconds as 61:01", () => {
    expect(mmss(3661)).toBe("61:01");
  });

  it("clamps negative values to 00:00", () => {
    expect(mmss(-5)).toBe("00:00");
    expect(mmss(-100)).toBe("00:00");
  });

  it("floors fractional seconds", () => {
    expect(mmss(90.9)).toBe("01:30");
  });
});

describe("suggestNextWeight", () => {
  it("holds weight when RPE is high", () => {
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

  it("increases weight when reps hit top of range", () => {
    const next = suggestNextWeight({
      lastWeight: 80,
      lastReps: 10,
      targetRepMin: 6,
      targetRepMax: 10,
      incrementKg: 2.5,
    });
    expect(next).toBe(82.5);
  });

  it("decreases weight when reps below range", () => {
    const next = suggestNextWeight({
      lastWeight: 80,
      lastReps: 4,
      targetRepMin: 6,
      targetRepMax: 10,
      incrementKg: 2.5,
    });
    expect(next).toBe(77.5);
  });

  it("holds weight when reps within range", () => {
    const next = suggestNextWeight({
      lastWeight: 80,
      lastReps: 8,
      targetRepMin: 6,
      targetRepMax: 10,
    });
    expect(next).toBe(80);
  });
});
