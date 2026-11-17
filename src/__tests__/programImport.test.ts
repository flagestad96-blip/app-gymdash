import { parseProgramImport, parseShareTargets, validateImport } from "../programImport";

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

describe("parseProgramImport", () => {
  const sharePayload = {
    schemaVersion: 1,
    exportedAt: "2026-11-16T13:42:30.207Z",
    program: { name: "Over/Under", daysCount: 2 },
    days: [
      {
        dayIndex: 0,
        name: "Overkropp A",
        blocks: [
          { type: "single", exerciseId: "bench_press", sortIndex: 0 },
          { type: "superset", a: "lateral_raise", b: "triceps_pushdown", sortIndex: 1 },
        ],
      },
      { dayIndex: 1, name: "Underkropp A", blocks: [{ type: "single", exerciseId: "back_squat", sortIndex: 0 }] },
    ],
    alternatives: [{ dayIndex: 0, exerciseId: "bench_press", alternatives: ["flat_db_press", 7, "a", "b", "c"] }],
    targets: [{ exerciseId: "bench_press", dayIndex: 0, repMin: 5, repMax: 8, targetSets: 3, incrementKg: 2.5 }],
  };

  it("reads the full format from Settings → Share program", () => {
    const res = parseProgramImport(sharePayload);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.program.name).toBe("Over/Under");
    expect(res.program.days.map((d) => d.name)).toEqual(["Overkropp A", "Underkropp A"]);
    expect(res.program.days[0].blocks).toEqual([
      { type: "single", exId: "bench_press" },
      { type: "superset", a: "lateral_raise", b: "triceps_pushdown", sortIndex: 1 },
    ]);
    expect(res.targets).toEqual([
      { exerciseId: "bench_press", dayIndex: 0, repMin: 5, repMax: 8, targetSets: 3, incrementKg: 2.5 },
    ]);
    expect(res.alternatives).toEqual([
      { dayIndex: 0, exerciseId: "bench_press", alternatives: ["flat_db_press", "a", "b"] },
    ]);
  });

  it("still reads the simple Program-screen format, without targets or alternatives", () => {
    const res = parseProgramImport(validProgram);
    expect(res).toEqual({ ok: true, program: validProgram, targets: [], alternatives: [] });
  });

  it("honours daysCount and rejects an unknown schemaVersion", () => {
    const oneDay = parseProgramImport({ ...sharePayload, program: { name: "X", daysCount: 1 } });
    expect(oneDay.ok && oneDay.program.days.length).toBe(1);
    expect(parseProgramImport({ ...sharePayload, schemaVersion: 2 })).toEqual({ ok: false, errorKey: "settings.schemaError" });
  });

  it("reports the same errors as the simple format for a broken share payload", () => {
    expect(parseProgramImport({ ...sharePayload, program: { daysCount: 2 } })).toEqual({ ok: false, errorKey: "program.mustHaveName" });
    expect(parseProgramImport({ ...sharePayload, days: [] })).toEqual({ ok: false, errorKey: "program.mustHave1to10Days" });
    expect(
      parseProgramImport({ ...sharePayload, days: [{ name: "D", blocks: [{ type: "single", sortIndex: 0 }] }] })
    ).toEqual({ ok: false, errorKey: "program.singleMissingExId" });
    expect(parseProgramImport(null)).toEqual({ ok: false, errorKey: "program.invalidJson" });
  });
});
