import { formatWeight, mmss, shortLabel, parseTimeMs, clampInt } from "../format";

describe("formatWeight", () => {
  it("trims trailing zeros and rounds to 1 decimal", () => {
    expect(formatWeight(80)).toBe("80");
    expect(formatWeight(80.5)).toBe("80.5");
    expect(formatWeight(80.04)).toBe("80");
    expect(formatWeight(80.05)).toBe("80.1");
  });
  it("returns empty for non-finite", () => {
    expect(formatWeight(NaN)).toBe("");
    expect(formatWeight(Infinity)).toBe("");
  });
});

describe("mmss", () => {
  it("formats seconds as mm:ss, clamped at 0", () => {
    expect(mmss(0)).toBe("00:00");
    expect(mmss(65)).toBe("01:05");
    expect(mmss(600)).toBe("10:00");
    expect(mmss(-5)).toBe("00:00");
    expect(mmss(59.9)).toBe("00:59");
  });
});

describe("shortLabel", () => {
  it("abbreviates two-word names to 3+3 upper", () => {
    expect(shortLabel("Bench Press")).toBe("BENPRE");
    expect(shortLabel("Romanian Deadlift")).toBe("ROMDEA");
  });
  it("uses first 6 chars for single words", () => {
    expect(shortLabel("Deadlift")).toBe("DEADLI");
    expect(shortLabel("Squat")).toBe("SQUAT");
  });
});

describe("parseTimeMs", () => {
  it("returns NaN for empty / invalid, number for valid iso", () => {
    expect(Number.isNaN(parseTimeMs(null))).toBe(true);
    expect(Number.isNaN(parseTimeMs(undefined))).toBe(true);
    expect(Number.isNaN(parseTimeMs("not-a-date"))).toBe(true);
    expect(parseTimeMs("2026-06-02T00:00:00.000Z")).toBe(Date.parse("2026-06-02T00:00:00.000Z"));
  });
});

describe("clampInt", () => {
  it("clamps, truncates, and defaults non-finite to min", () => {
    expect(clampInt(5, 0, 10)).toBe(5);
    expect(clampInt(-3, 0, 10)).toBe(0);
    expect(clampInt(15, 0, 10)).toBe(10);
    expect(clampInt(5.9, 0, 10)).toBe(5);
    expect(clampInt(NaN, 2, 10)).toBe(2);
  });
});
