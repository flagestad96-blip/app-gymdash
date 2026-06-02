import { workingCount, SLOT_LABELS, SLOT_COLORS } from "../components/workout/superset";
import type { SetRow } from "../components/workout/SetEntryRow";

function set(is_warmup: boolean): SetRow {
  return { is_warmup } as unknown as SetRow;
}

describe("superset helpers", () => {
  it("workingCount excludes warmup sets", () => {
    expect(workingCount([])).toBe(0);
    expect(workingCount([set(false), set(false), set(true)])).toBe(2);
    expect(workingCount([set(true), set(true)])).toBe(0);
  });

  it("has A/B/C labels and colors", () => {
    expect(SLOT_LABELS).toEqual({ a: "A", b: "B", c: "C" });
    expect(Object.keys(SLOT_COLORS)).toEqual(["a", "b", "c"]);
  });
});
