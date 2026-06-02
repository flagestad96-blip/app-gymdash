// expo-localization has native bindings; stub it so importing units.ts works in node.
jest.mock("expo-localization", () => ({ getLocales: () => [{ regionCode: "NO" }] }));

import { toDisplay, toKg, formatWeight, unitLabel } from "../units";

describe("weight unit conversion", () => {
  it("toDisplay keeps kg and converts to lbs (1 decimal)", () => {
    expect(toDisplay(80, "kg")).toBe(80);
    expect(toDisplay(80, "lbs")).toBeCloseTo(176.4, 1);
  });

  it("toKg passes through kg and converts lbs back", () => {
    expect(toKg(100, "kg")).toBe(100);
    expect(toKg(220.462, "lbs")).toBeCloseTo(100, 1);
  });

  it("formatWeight appends the unit", () => {
    expect(formatWeight(80, "kg")).toBe("80 kg");
    expect(formatWeight(80, "lbs")).toBe("176.4 lbs");
  });

  it("unitLabel is upper-cased", () => {
    expect(unitLabel("kg")).toBe("KG");
    expect(unitLabel("lbs")).toBe("LBS");
  });

  it("kg -> lbs -> kg round-trips within rounding tolerance", () => {
    const lbs = toDisplay(100, "lbs");
    expect(toKg(lbs, "lbs")).toBeCloseTo(100, 0);
  });
});
