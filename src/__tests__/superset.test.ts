import {
  workingCount,
  SLOT_LABELS,
  SLOT_COLORS,
  mergeManualSupersets,
  manualSupersetAnchorKey,
  type MergeableBlock,
} from "../components/workout/superset";
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

describe("mergeManualSupersets", () => {
  function single(baseExId: string, exId = baseExId): MergeableBlock {
    return { type: "single", exId, baseExId, anchorKey: `ex_${exId}_x` };
  }
  function programSuperset(a: string, b: string): MergeableBlock {
    return { type: "superset", a, b, baseA: a, baseB: b, anchorKey: `ss_${a}_${b}_x` };
  }

  it("merges two singles at the first member's position, in group order", () => {
    const blocks = [single("bench"), single("row"), single("curl")];
    const out = mergeManualSupersets(blocks, [["row", "curl"]]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual(single("bench"));
    expect(out[1]).toMatchObject({
      type: "superset",
      a: "row",
      b: "curl",
      baseA: "row",
      baseB: "curl",
      manual: true,
      anchorKey: manualSupersetAnchorKey(["row", "curl"]),
    });
    expect((out[1] as Extract<MergeableBlock, { type: "superset" }>).c).toBeUndefined();
  });

  it("supports 3-way groups", () => {
    const blocks = [single("bench"), single("row"), single("curl"), single("fly")];
    const out = mergeManualSupersets(blocks, [["bench", "curl", "fly"]]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: "superset", a: "bench", b: "curl", c: "fly", manual: true });
    expect(out[1]).toEqual(single("row"));
  });

  it("uses resolved exIds for slots but base ids for identity", () => {
    const blocks = [single("bench", "db_bench"), single("row")];
    const out = mergeManualSupersets(blocks, [["bench", "row"]]);
    expect(out[0]).toMatchObject({ type: "superset", a: "db_bench", baseA: "bench", b: "row", baseB: "row" });
  });

  it("skips a group when fewer than 2 members are present", () => {
    const blocks = [single("bench"), single("row")];
    expect(mergeManualSupersets(blocks, [["bench", "gone"]])).toEqual(blocks);
    expect(mergeManualSupersets(blocks, [["gone1", "gone2"]])).toEqual(blocks);
    expect(mergeManualSupersets(blocks, [["bench"]])).toEqual(blocks);
  });

  it("merges the present subset of a 3-way group", () => {
    const blocks = [single("bench"), single("row")];
    const out = mergeManualSupersets(blocks, [["bench", "gone", "row"]]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "superset", a: "bench", b: "row", manual: true });
  });

  it("never touches exercises inside existing program supersets", () => {
    const blocks = [programSuperset("bench", "row"), single("curl"), single("fly")];
    const out = mergeManualSupersets(blocks, [["bench", "curl"]]);
    expect(out).toEqual(blocks);
    const out2 = mergeManualSupersets(blocks, [["curl", "fly"]]);
    expect(out2).toHaveLength(2);
    expect(out2[0]).toEqual(programSuperset("bench", "row"));
    expect(out2[1]).toMatchObject({ type: "superset", a: "curl", b: "fly", manual: true });
  });

  it("applies multiple groups independently", () => {
    const blocks = [single("a1"), single("a2"), single("b1"), single("b2")];
    const out = mergeManualSupersets(blocks, [["a1", "a2"], ["b1", "b2"]]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ type: "superset", a: "a1", b: "a2" });
    expect(out[1]).toMatchObject({ type: "superset", a: "b1", b: "b2" });
  });

  it("ignores duplicate base ids within a group", () => {
    const blocks = [single("bench"), single("row")];
    const out = mergeManualSupersets(blocks, [["bench", "bench", "row"]]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ type: "superset", a: "bench", b: "row" });
    expect((out[0] as Extract<MergeableBlock, { type: "superset" }>).c).toBeUndefined();
  });

  it("returns blocks untouched with no groups", () => {
    const blocks = [single("bench"), single("row")];
    expect(mergeManualSupersets(blocks, [])).toEqual(blocks);
  });
});
