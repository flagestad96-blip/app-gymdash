import { estimateDurationFromSessions } from "../programStore";

// Helper: turn minute-counts into the (started_at, ended_at) shape the
// real function expects.
function sessions(...minuteValues: number[]) {
  const base = Date.now();
  return minuteValues.map((m, i) => {
    const start = new Date(base + i * 24 * 3600 * 1000); // distinct day per row
    const end = new Date(start.getTime() + m * 60 * 1000);
    return { started_at: start.toISOString(), ended_at: end.toISOString() };
  });
}

describe("estimateDurationFromSessions", () => {
  it("returns null for fewer than 2 plausible sessions", () => {
    expect(estimateDurationFromSessions([])).toBeNull();
    expect(estimateDurationFromSessions(sessions(45))).toBeNull();
  });

  it("returns median, not mean, so a single huge outlier can't dominate", () => {
    // 220-min session is dropped by sanity window → samples [45, 50, 55]
    // → median = 50.  (Mean of all four would be 92 min ≈ «1h 32m».)
    expect(estimateDurationFromSessions(sessions(45, 50, 55, 220))).toBe("50 min");
  });

  it("returns median when no outliers are dropped (true median test)", () => {
    // Mean of (45, 50, 55, 150) is 75. Median of plausible window-filtered
    // samples (all within 5–180) is (50+55)/2 = 52.5 → 53 min.
    expect(estimateDurationFromSessions(sessions(45, 50, 55, 150))).toBe("53 min");
  });

  it("drops sessions outside the 5–180 min sanity window before medianing", () => {
    // 1-min and 240-min sessions are dropped → median of [50, 60, 70] = 60
    // 60 min formats as «1h» (since 60 is not < 60 the «min» branch is skipped).
    expect(estimateDurationFromSessions(sessions(1, 50, 60, 70, 240))).toBe("1h");
  });

  it("formats hours+minutes correctly", () => {
    expect(estimateDurationFromSessions(sessions(60, 60))).toBe("1h");
    expect(estimateDurationFromSessions(sessions(75, 75))).toBe("1h 15m");
  });

  it("returns null when all sessions are implausible", () => {
    // All sessions outside sanity window → no valid samples → null
    expect(estimateDurationFromSessions(sessions(1, 2, 240, 300))).toBeNull();
  });

  it("ignores sessions with null timestamps or end-before-start", () => {
    const bad = [
      { started_at: null, ended_at: "2026-01-01T10:00:00Z" },
      { started_at: "2026-01-01T10:00:00Z", ended_at: null },
      { started_at: "2026-01-01T11:00:00Z", ended_at: "2026-01-01T10:00:00Z" }, // backwards
      { started_at: "invalid", ended_at: "2026-01-01T10:00:00Z" },
    ];
    const good = sessions(50, 60);
    expect(estimateDurationFromSessions([...bad, ...good])).toBe("55 min");
  });

  it("handles even-length samples with averaged middle pair", () => {
    // [40, 50, 60, 70] → median = (50+60)/2 = 55
    expect(estimateDurationFromSessions(sessions(40, 50, 60, 70))).toBe("55 min");
  });

  it("handles odd-length samples with the middle element", () => {
    // [40, 50, 60, 70, 80] → median = 60 → formatted as «1h».
    expect(estimateDurationFromSessions(sessions(40, 50, 60, 70, 80))).toBe("1h");
  });
});
