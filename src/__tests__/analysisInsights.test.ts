import { generateExerciseInsight } from "../analysisInsights";

const k = (e1rmPctChange: number | null, rpeDelta: number | null, sessionCount = 5) =>
  generateExerciseInsight({ e1rmPctChange, rpeDelta, sessionCount }).key;

describe("generateExerciseInsight", () => {
  it("notEnoughData when <2 sessions or null e1RM, with remaining count", () => {
    expect(generateExerciseInsight({ e1rmPctChange: 5, rpeDelta: 0, sessionCount: 0 })).toEqual({
      key: "analysis.insight.notEnoughData",
      params: { n: 2 },
    });
    expect(generateExerciseInsight({ e1rmPctChange: 5, rpeDelta: 0, sessionCount: 1 })).toEqual({
      key: "analysis.insight.notEnoughData",
      params: { n: 1 },
    });
    expect(k(null, 0, 9)).toBe("analysis.insight.notEnoughData");
  });

  it("declining when e1RM drops > 2% (regardless of RPE)", () => {
    expect(k(-3, -5)).toBe("analysis.insight.decliningFatigued");
    expect(k(-3, 5)).toBe("analysis.insight.decliningFatigued");
  });

  it("e1RM up branches", () => {
    expect(k(5, -1)).toBe("analysis.insight.strongAndEasy");
    expect(k(5, 1)).toBe("analysis.insight.strongButHarder");
    expect(k(5, 0)).toBe("analysis.insight.strongStableRpe");
    expect(k(5, null)).toBe("analysis.insight.strongStableRpe");
  });

  it("e1RM flat branches", () => {
    expect(k(0, -1)).toBe("analysis.insight.flatButEasier");
    expect(k(0, 1)).toBe("analysis.insight.flatAndHard");
    expect(k(0, 0)).toBe("analysis.insight.plateau");
    expect(k(0, null)).toBe("analysis.insight.plateau");
  });

  it("respects exact thresholds (strict comparisons)", () => {
    expect(k(2.0, 0)).toBe("analysis.insight.plateau"); // not > 2.0 -> flat
    expect(k(-2.0, 0)).toBe("analysis.insight.plateau"); // not < -2.0 -> flat
    expect(k(5, 0.3)).toBe("analysis.insight.strongStableRpe"); // rpe not > 0.3 -> flat
    expect(k(0, -0.3)).toBe("analysis.insight.plateau"); // rpe not < -0.3 -> flat
  });
});
