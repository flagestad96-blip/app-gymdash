import {
  workingCount,
  SLOT_LABELS,
  SLOT_COLORS,
  mergeManualSupersets,
  splitProgramSupersets,
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

describe("splitProgramSupersets", () => {
  const single = (exId: string, key: string): MergeableBlock => ({
    type: "single", exId, baseExId: exId, anchorKey: key,
  });
  const ss: MergeableBlock = {
    type: "superset", a: "ohp", b: "row", baseA: "ohp", baseB: "row", anchorKey: "ss_ohp_row_1",
  };
  const ss3: MergeableBlock = {
    type: "superset", a: "ohp", b: "row", c: "curl",
    baseA: "ohp", baseB: "row", baseC: "curl", anchorKey: "ss_ohp_row_curl_2",
  };

  it("is a no-op without split keys", () => {
    const blocks = [single("squat", "ex_squat_0"), ss];
    expect(splitProgramSupersets(blocks, [])).toBe(blocks);
  });

  it("splits a 2-way program superset into singles in place", () => {
    const blocks = [single("squat", "ex_squat_0"), ss, single("dips", "ex_dips_2")];
    expect(splitProgramSupersets(blocks, ["ss_ohp_row_1"])).toEqual([
      single("squat", "ex_squat_0"),
      { type: "single", exId: "ohp", baseExId: "ohp", anchorKey: "ss_ohp_row_1_a" },
      { type: "single", exId: "row", baseExId: "row", anchorKey: "ss_ohp_row_1_b" },
      single("dips", "ex_dips_2"),
    ]);
  });

  it("splits all three slots of a 3-way superset", () => {
    const out = splitProgramSupersets([ss3], ["ss_ohp_row_curl_2"]);
    expect(out.map((b) => (b.type === "single" ? b.exId : "?"))).toEqual(["ohp", "row", "curl"]);
    expect(out.map((b) => b.anchorKey)).toEqual([
      "ss_ohp_row_curl_2_a", "ss_ohp_row_curl_2_b", "ss_ohp_row_curl_2_c",
    ]);
  });

  it("keeps slot-level ALT swaps: exId differs from baseExId", () => {
    const swapped: MergeableBlock = {
      type: "superset", a: "ohp_smith", b: "row", baseA: "ohp", baseB: "row", anchorKey: "ss_ohp_row_1",
    };
    const out = splitProgramSupersets([swapped], ["ss_ohp_row_1"]);
    expect(out[0]).toEqual({ type: "single", exId: "ohp_smith", baseExId: "ohp", anchorKey: "ss_ohp_row_1_a" });
  });

  it("never splits manual supersets (ungroup handles those)", () => {
    const manual: MergeableBlock = {
      type: "superset", a: "ohp", b: "row", baseA: "ohp", baseB: "row",
      anchorKey: manualSupersetAnchorKey(["ohp", "row"]), manual: true,
    };
    expect(splitProgramSupersets([manual], [manual.anchorKey])).toEqual([manual]);
  });

  it("split singles can be re-merged manually afterwards", () => {
    const split = splitProgramSupersets([ss], ["ss_ohp_row_1"]);
    const merged = mergeManualSupersets(split, [["ohp", "row"]]);
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe("superset");
    expect((merged[0] as Extract<MergeableBlock, { type: "superset" }>).manual).toBe(true);
  });
});
