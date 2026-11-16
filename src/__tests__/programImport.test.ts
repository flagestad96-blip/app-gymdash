import { parseShareTargets, validateImport } from "../programImport";

const validProgram = {
  name: "PPL",
  days: [
    { name: "Push", blocks: [{ type: "single", exId: "bench" }] },
    { name: "Pull", blocks: [{ type: "superset", a: "row", b: "curl" }] },
  ],
};

describe("validateImport", () => {
  it("accepts a well-formed program", () => {
    const res = validateImport(validProgram);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.program.name).toBe("PPL");
  });

  it("accepts a three-way superset and the legacy `ex` key", () => {
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "superset", a: "a", b: "b", c: "c" }] }] }).ok).toBe(true);
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "single", ex: "legacy" }] }] }).ok).toBe(true);
  });

  it("rejects non-objects and missing name", () => {
    expect(validateImport(null)).toEqual({ ok: false, errorKey: "program.invalidJson" });
    expect(validateImport("nope")).toEqual({ ok: false, errorKey: "program.invalidJson" });
    expect(validateImport({ days: [] })).toEqual({ ok: false, errorKey: "program.mustHaveName" });
  });

  it("enforces 1..10 days", () => {
    expect(validateImport({ name: "X", days: [] })).toEqual({ ok: false, errorKey: "program.mustHave1to10Days" });
    const eleven = { name: "X", days: Array.from({ length: 11 }, () => ({ name: "D", blocks: [] })) };
    expect(validateImport(eleven)).toEqual({ ok: false, errorKey: "program.mustHave1to10Days" });
  });

  it("rejects malformed blocks", () => {
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "single" }] }] })).toEqual({ ok: false, errorKey: "program.singleMissingExId" });
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "superset", a: "a" }] }] })).toEqual({ ok: false, errorKey: "program.supersetMissingAB" });
    expect(validateImport({ name: "X", days: [{ name: "D", blocks: [{ type: "triset" }] }] })).toEqual({ ok: false, errorKey: "program.unknownBlockType" });
  });
});

describe("parseShareTargets", () => {
  it("carries sets, increment and auto-progress through", () => {
    expect(
      parseShareTargets([
        { exerciseId: "bench_press", dayIndex: 2, repMin: 6, repMax: 10, targetSets: 4, incrementKg: 2.5, autoProgress: false },
      ])
    ).toEqual([
      { exerciseId: "bench_press", dayIndex: 2, repMin: 6, repMax: 10, targetSets: 4, incrementKg: 2.5, autoProgress: false },
    ]);
  });

  it("leaves sets and increment undefined for exports made before they were shared", () => {
    const [target] = parseShareTargets([{ exerciseId: "bench_press", repMin: 8, repMax: 12 }]);
    expect(target).toEqual({ exerciseId: "bench_press", dayIndex: 0, repMin: 8, repMax: 12 });
    expect(target.targetSets).toBeUndefined();
    expect(target.incrementKg).toBeUndefined();
  });

  it("clamps to the same limits as the target editor", () => {
    const [target] = parseShareTargets([
      { exerciseId: "x", dayIndex: -3, repMin: 0, repMax: 99, targetSets: 25, incrementKg: 0 },
    ]);
    expect(target).toEqual({ exerciseId: "x", dayIndex: 0, repMin: 1, repMax: 40, targetSets: 10 });
    expect(parseShareTargets([{ exerciseId: "x", repMin: 12, repMax: 8, targetSets: 0 }])[0]).toMatchObject({
      repMin: 12,
      repMax: 12,
      targetSets: 1,
    });
  });

  it("drops entries without an exercise id or a numeric rep range", () => {
    expect(parseShareTargets(null)).toEqual([]);
    expect(parseShareTargets({})).toEqual([]);
    expect(
      parseShareTargets([
        null,
        "nope",
        { repMin: 8, repMax: 12 },
        { exerciseId: "", repMin: 8, repMax: 12 },
        { exerciseId: "x", repMin: "8", repMax: 12 },
        { exerciseId: "x", repMin: 8 },
      ])
    ).toEqual([]);
  });
});
