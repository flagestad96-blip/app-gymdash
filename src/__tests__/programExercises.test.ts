import { collectDayExercisePairs } from "../programExercises";
import type { Program, AlternativesMap } from "../programStore";

function prog(days: { blocks: any[] }[]): Program {
  return { id: "p1", name: "P", days } as unknown as Program;
}

describe("collectDayExercisePairs", () => {
  it("collects single + superset slots across days", () => {
    const p = prog([
      { blocks: [{ type: "single", exId: "bench" }] },
      { blocks: [{ type: "superset", a: "row", b: "curl", c: "fly" }] },
    ]);
    expect(collectDayExercisePairs(p, {})).toEqual([
      { dayIndex: 0, exerciseId: "bench" },
      { dayIndex: 1, exerciseId: "row" },
      { dayIndex: 1, exerciseId: "curl" },
      { dayIndex: 1, exerciseId: "fly" },
    ]);
  });

  it("includes alternatives for that day", () => {
    const p = prog([{ blocks: [{ type: "single", exId: "bench" }] }]);
    const alts: AlternativesMap = { 0: { bench: ["db-bench", "machine-press"] } } as unknown as AlternativesMap;
    expect(collectDayExercisePairs(p, alts)).toEqual([
      { dayIndex: 0, exerciseId: "bench" },
      { dayIndex: 0, exerciseId: "db-bench", inheritFrom: "bench" },
      { dayIndex: 0, exerciseId: "machine-press", inheritFrom: "bench" },
    ]);
  });

  it("an exercise that is both a primary and an alternative keeps its own target", () => {
    const p = prog([{ blocks: [{ type: "single", exId: "bench" }, { type: "single", exId: "db-bench" }] }]);
    const alts: AlternativesMap = { 0: { bench: ["db-bench"] } } as unknown as AlternativesMap;
    expect(collectDayExercisePairs(p, alts)).toEqual([
      { dayIndex: 0, exerciseId: "bench" },
      { dayIndex: 0, exerciseId: "db-bench" },
    ]);
  });

  it("de-duplicates repeated exercises within a day", () => {
    const p = prog([{ blocks: [{ type: "single", exId: "bench" }, { type: "single", exId: "bench" }] }]);
    expect(collectDayExercisePairs(p, {})).toEqual([{ dayIndex: 0, exerciseId: "bench" }]);
  });

  it("keeps the same exercise separate across different days", () => {
    const p = prog([
      { blocks: [{ type: "single", exId: "squat" }] },
      { blocks: [{ type: "single", exId: "squat" }] },
    ]);
    expect(collectDayExercisePairs(p, {})).toEqual([
      { dayIndex: 0, exerciseId: "squat" },
      { dayIndex: 1, exerciseId: "squat" },
    ]);
  });
});
