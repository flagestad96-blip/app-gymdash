import { areAllPlannedSetsDone, type CompletionBlock } from "../workoutCompletion";

function target(targetSets: number) { return { targetSets }; }

const noTargets = () => ({ targetSets: 0 });

describe("areAllPlannedSetsDone", () => {
  it("returns false for empty blocks", () => {
    expect(areAllPlannedSetsDone({
      blocks: [],
      setsByExercise: {},
      adHocSet: new Set(),
      getTarget: noTargets,
    })).toBe(false);
  });

  it("returns false when no exercise has a target", () => {
    expect(areAllPlannedSetsDone({
      blocks: [{ type: "single", exId: "squat" }],
      setsByExercise: { squat: [{ is_warmup: 0 }, { is_warmup: 0 }] },
      adHocSet: new Set(),
      getTarget: () => target(0),
    })).toBe(false);
  });

  it("returns true when single exercise hits target_sets", () => {
    expect(areAllPlannedSetsDone({
      blocks: [{ type: "single", exId: "squat" }],
      setsByExercise: { squat: [{ is_warmup: 0 }, { is_warmup: 0 }, { is_warmup: 0 }] },
      adHocSet: new Set(),
      getTarget: () => target(3),
    })).toBe(true);
  });

  it("returns false when single exercise is one set short", () => {
    expect(areAllPlannedSetsDone({
      blocks: [{ type: "single", exId: "squat" }],
      setsByExercise: { squat: [{ is_warmup: 0 }, { is_warmup: 0 }] },
      adHocSet: new Set(),
      getTarget: () => target(3),
    })).toBe(false);
  });

  it("ignores warmup sets in the count", () => {
    expect(areAllPlannedSetsDone({
      blocks: [{ type: "single", exId: "squat" }],
      setsByExercise: {
        squat: [
          { is_warmup: 1 },
          { is_warmup: 1 },
          { is_warmup: 0 },
          { is_warmup: 0 },
        ],
      },
      adHocSet: new Set(),
      getTarget: () => target(3),
    })).toBe(false);
  });

  it("accepts both numeric and boolean warmup flags", () => {
    expect(areAllPlannedSetsDone({
      blocks: [{ type: "single", exId: "squat" }],
      setsByExercise: { squat: [{ is_warmup: true }, { is_warmup: 0 }, { is_warmup: 0 }] },
      adHocSet: new Set(),
      getTarget: () => target(2),
    })).toBe(true);
  });

  it("returns true when both legs of a 2-way superset hit target", () => {
    const blocks: CompletionBlock[] = [{ type: "superset", a: "press", b: "row" }];
    expect(areAllPlannedSetsDone({
      blocks,
      setsByExercise: {
        press: [{ is_warmup: 0 }, { is_warmup: 0 }],
        row: [{ is_warmup: 0 }, { is_warmup: 0 }],
      },
      adHocSet: new Set(),
      getTarget: () => target(2),
    })).toBe(true);
  });

  it("returns false when one leg of a superset is short", () => {
    const blocks: CompletionBlock[] = [{ type: "superset", a: "press", b: "row" }];
    expect(areAllPlannedSetsDone({
      blocks,
      setsByExercise: {
        press: [{ is_warmup: 0 }, { is_warmup: 0 }],
        row: [{ is_warmup: 0 }], // one short
      },
      adHocSet: new Set(),
      getTarget: () => target(2),
    })).toBe(false);
  });

  it("checks all three slots of a 3-way superset", () => {
    const blocks: CompletionBlock[] = [{ type: "superset", a: "press", b: "row", c: "curl" }];
    const setsByExercise = {
      press: [{ is_warmup: 0 }, { is_warmup: 0 }],
      row: [{ is_warmup: 0 }, { is_warmup: 0 }],
      curl: [{ is_warmup: 0 }], // short
    };
    expect(areAllPlannedSetsDone({
      blocks,
      setsByExercise,
      adHocSet: new Set(),
      getTarget: () => target(2),
    })).toBe(false);
  });

  it("skips ad-hoc exercises from the completion check", () => {
    expect(areAllPlannedSetsDone({
      blocks: [
        { type: "single", exId: "squat" },
        { type: "single", exId: "abs_wheel" }, // ad-hoc, no target
      ],
      setsByExercise: {
        squat: [{ is_warmup: 0 }, { is_warmup: 0 }, { is_warmup: 0 }],
        abs_wheel: [], // empty — would otherwise block completion
      },
      adHocSet: new Set(["abs_wheel"]),
      getTarget: (id) => id === "squat" ? target(3) : target(3),
    })).toBe(true);
  });

  it("returns false when all targets exist but exercise with target hasn't started", () => {
    expect(areAllPlannedSetsDone({
      blocks: [
        { type: "single", exId: "squat" },
        { type: "single", exId: "bench" },
      ],
      setsByExercise: { squat: [{ is_warmup: 0 }, { is_warmup: 0 }, { is_warmup: 0 }] },
      adHocSet: new Set(),
      getTarget: () => target(3),
    })).toBe(false);
  });

  it("ignores exercises with no target (targetSets <= 0) inside a superset", () => {
    const blocks: CompletionBlock[] = [{ type: "superset", a: "press", b: "row" }];
    // press has target, row doesn't — only press gates completion
    expect(areAllPlannedSetsDone({
      blocks,
      setsByExercise: { press: [{ is_warmup: 0 }, { is_warmup: 0 }], row: [] },
      adHocSet: new Set(),
      getTarget: (id) => id === "press" ? target(2) : target(0),
    })).toBe(true);
  });
});
