import { calculatePlates, plateColor } from "../plateCalculator";

describe("calculatePlates", () => {
  it("returns 20kg per side for 60kg target with 20kg bar", () => {
    const result = calculatePlates(60, 20);
    expect(result.achievable).toBe(true);
    expect(result.totalWeight).toBe(60);
    expect(result.barWeight).toBe(20);
    expect(result.plates).toEqual([{ weight: 20, count: 1 }]);
  });

  it("returns empty plates when target equals bar weight", () => {
    const result = calculatePlates(20, 20);
    expect(result.achievable).toBe(true);
    expect(result.plates).toEqual([]);
    expect(result.totalWeight).toBe(20);
  });

  it("returns 2.5kg per side for 25kg target with 20kg bar", () => {
    const result = calculatePlates(25, 20);
    expect(result.achievable).toBe(true);
    expect(result.plates).toEqual([{ weight: 2.5, count: 1 }]);
    expect(result.totalWeight).toBe(25);
  });

  it("marks as not achievable when remainder cannot be made with available plates", () => {
    // 21kg target - 20kg bar = 1kg total = 0.5kg per side — not available
    const result = calculatePlates(21, 20);
    expect(result.achievable).toBe(false);
  });

  it("calculates correctly with women's bar (15kg)", () => {
    // 100kg target - 15kg bar = 85kg / 2 = 42.5kg per side
    // 25 + 15 + 2.5 = 42.5
    const result = calculatePlates(100, 15);
    expect(result.achievable).toBe(true);
    expect(result.totalWeight).toBe(100);
    expect(result.barWeight).toBe(15);
    expect(result.plates).toEqual([
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
      { weight: 2.5, count: 1 },
    ]);
  });

  it("handles target less than bar weight", () => {
    const result = calculatePlates(10, 20);
    expect(result.achievable).toBe(false);
    expect(result.plates).toEqual([]);
    expect(result.totalWeight).toBe(20);
  });

  it("handles complex plate combinations", () => {
    // 182.5kg: bar 20 + 81.25 per side
    // Greedy: 25×3 = 75, remaining 6.25 → 5×1 = 5, remaining 1.25 → 1.25×1
    const result = calculatePlates(182.5, 20);
    expect(result.achievable).toBe(true);
    expect(result.totalWeight).toBe(182.5);
    expect(result.plates).toEqual([
      { weight: 25, count: 3 },
      { weight: 5, count: 1 },
      { weight: 1.25, count: 1 },
    ]);
  });

  it("uses default 20kg bar when no bar weight specified", () => {
    const result = calculatePlates(60);
    expect(result.barWeight).toBe(20);
    expect(result.achievable).toBe(true);
  });
});

describe("plateColor", () => {
  it("returns red for 25kg plates", () => {
    expect(plateColor(25)).toBe("#E53935");
  });

  it("returns blue for 20kg plates", () => {
    expect(plateColor(20)).toBe("#1E88E5");
  });

  it("returns green for 10kg plates", () => {
    expect(plateColor(10)).toBe("#43A047");
  });

  it("returns yellow for 15kg plates", () => {
    expect(plateColor(15)).toBe("#FDD835");
  });

  it("returns white for 5kg plates", () => {
    expect(plateColor(5)).toBe("#FFFFFF");
  });

  it("returns red for 2.5kg plates", () => {
    expect(plateColor(2.5)).toBe("#E53935");
  });

  it("returns grey for 1.25kg plates", () => {
    expect(plateColor(1.25)).toBe("#757575");
  });
});
