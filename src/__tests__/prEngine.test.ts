// Mock DB before imports
const mockGetAllSync = jest.fn((): any[] => []);
const mockGetFirstSync = jest.fn((): any => null);
const mockRunAsync = jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 }));
const mockRunSync = jest.fn(() => ({ changes: 0, lastInsertRowId: 0 }));

jest.mock("../db", () => ({
  getDb: () => ({
    getAllSync: mockGetAllSync,
    getFirstSync: mockGetFirstSync,
    runAsync: mockRunAsync,
    runSync: mockRunSync,
  }),
}));

jest.mock("../exerciseLibrary", () => ({
  isBodyweight: (id: string) => id === "pull_up",
  isPerSideExercise: (id: string) => id === "dumbbell_curl",
}));

import { checkSetPRs, checkSessionVolumePRs, recomputePRForExercise } from "../prEngine";

beforeEach(() => {
  mockGetAllSync.mockReset().mockReturnValue([]);
  mockGetFirstSync.mockReset().mockReturnValue(null);
  mockRunAsync.mockReset().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
  mockRunSync.mockReset().mockReturnValue({ changes: 0, lastInsertRowId: 0 });
});

describe("checkSetPRs", () => {
  const baseParams = {
    exerciseId: "bench_press",
    weight: 100,
    reps: 5,
    setId: "set_1",
    workoutId: "w_1",
    programId: "prog_1",
    currentVolumeRecord: undefined,
    isBw: false,
    estTotalLoadKg: null as number | null | undefined,
  };

  it("detects new heaviest when weight exceeds current record", async () => {
    // DB returns existing PR of 90kg
    mockGetAllSync.mockReturnValue([
      { type: "heaviest", value: 90, reps: 5, weight: 90, set_id: "old", date: "2026-01-01" },
      { type: "e1rm", value: 100, reps: 5, weight: 90, set_id: "old", date: "2026-01-01" },
    ]);
    // Prior sets exist (not baseline)
    mockGetFirstSync.mockReturnValue({ c: 5 });

    const result = await checkSetPRs({ ...baseParams, weight: 100, reps: 5 });

    expect(result.messages.some((m) => m.startsWith("heaviest:"))).toBe(true);
    expect(result.updatedRecords.heaviest?.value).toBe(100);
  });

  it("does not produce PR when weight is equal to current record", async () => {
    mockGetAllSync.mockReturnValue([
      { type: "heaviest", value: 100, reps: 5, weight: 100, set_id: "old", date: "2026-01-01" },
      { type: "e1rm", value: 120, reps: 5, weight: 100, set_id: "old", date: "2026-01-01" },
    ]);
    mockGetFirstSync.mockReturnValue({ c: 5 });

    const result = await checkSetPRs({ ...baseParams, weight: 100, reps: 5 });

    expect(result.messages.filter((m) => m.startsWith("heaviest:"))).toHaveLength(0);
  });

  it("does not produce PR when weight is below current record", async () => {
    mockGetAllSync.mockReturnValue([
      { type: "heaviest", value: 120, reps: 3, weight: 120, set_id: "old", date: "2026-01-01" },
      { type: "e1rm", value: 140, reps: 3, weight: 120, set_id: "old", date: "2026-01-01" },
    ]);
    mockGetFirstSync.mockReturnValue({ c: 5 });

    const result = await checkSetPRs({ ...baseParams, weight: 100, reps: 5 });

    expect(result.messages.filter((m) => m.startsWith("heaviest:"))).toHaveLength(0);
  });

  it("detects baseline (no banner) when first session for exercise", async () => {
    // No existing PRs in DB
    mockGetAllSync.mockReturnValue([]);
    // No prior sets outside this workout
    mockGetFirstSync.mockReturnValue({ c: 0 });

    const result = await checkSetPRs(baseParams);

    // Records are updated (heaviest + e1rm set)
    expect(result.updatedRecords.heaviest).toBeDefined();
    expect(result.updatedRecords.e1rm).toBeDefined();
    // But messages should be empty (baseline — no banner)
    expect(result.messages).toHaveLength(0);
  });

  it("calculates e1rm correctly using Epley formula", async () => {
    mockGetAllSync.mockReturnValue([]);
    mockGetFirstSync.mockReturnValue({ c: 3 }); // Not baseline

    // 80kg x 8 reps → e1RM = 80 * (1 + 8/30) = 80 * 1.2667 ≈ 101.3
    const result = await checkSetPRs({ ...baseParams, weight: 80, reps: 8 });

    expect(result.updatedRecords.e1rm?.value).toBeCloseTo(101.3, 0);
    expect(result.messages.some((m) => m.startsWith("e1rm:"))).toBe(true);
  });

  it("uses estTotalLoadKg for bodyweight exercises", async () => {
    mockGetAllSync.mockReturnValue([]);
    mockGetFirstSync.mockReturnValue({ c: 3 });

    const result = await checkSetPRs({
      ...baseParams,
      exerciseId: "pull_up",
      weight: 10, // external load
      isBw: true,
      estTotalLoadKg: 90, // total: bodyweight + external
      reps: 5,
    });

    // Should use 90 (estTotalLoadKg), not 10 (weight)
    expect(result.updatedRecords.heaviest?.value).toBe(90);
  });

  it("writes PRs to database via runAsync", async () => {
    mockGetAllSync.mockReturnValue([]);
    mockGetFirstSync.mockReturnValue({ c: 3 });

    await checkSetPRs(baseParams);

    // Should have called runAsync for heaviest and e1rm inserts
    expect(mockRunAsync).toHaveBeenCalled();
    const calls = mockRunAsync.mock.calls;
    const sqlStatements = calls.map((c: any[]) => c[0] as string);
    expect(sqlStatements.some((s) => s.includes("'heaviest'"))).toBe(true);
    expect(sqlStatements.some((s) => s.includes("'e1rm'"))).toBe(true);
  });
});

describe("checkSessionVolumePRs", () => {
  it("sums volume per exercise correctly", async () => {
    // 3 sets of bench_press: 80x10, 80x8, 80x6 = 80*10 + 80*8 + 80*6 = 800 + 640 + 480 = 1920
    const sets = [
      { exercise_id: "bench_press", exercise_name: "Bench Press", weight: 80, reps: 10 },
      { exercise_id: "bench_press", exercise_name: "Bench Press", weight: 80, reps: 8 },
      { exercise_id: "bench_press", exercise_name: "Bench Press", weight: 80, reps: 6 },
    ];

    mockGetFirstSync.mockReturnValue({ c: 3 }); // Not baseline

    const result = await checkSessionVolumePRs({
      workoutId: "w_1",
      programId: "prog_1",
      sets,
    });

    expect(result.volumePrs.length).toBeGreaterThan(0);
    expect(result.volumePrs[0]).toContain("1920");
  });

  it("applies per-side multiplier (x2) for per-side exercises", async () => {
    // dumbbell_curl is mocked as isPerSide
    // 20kg x 10 reps per side → volume = 20 * 10 * 2 = 400
    const sets = [
      { exercise_id: "dumbbell_curl", exercise_name: "DB Curl", weight: 20, reps: 10 },
    ];

    mockGetFirstSync.mockReturnValue({ c: 3 }); // Not baseline

    const result = await checkSessionVolumePRs({
      workoutId: "w_1",
      programId: "prog_1",
      sets,
    });

    expect(result.volumePrs.length).toBeGreaterThan(0);
    expect(result.volumePrs[0]).toContain("400");
  });

  it("uses est_total_load_kg for bodyweight exercises", async () => {
    // pull_up is mocked as isBodyweight
    // est_total_load_kg = 90, reps = 5 → volume = 90 * 5 = 450
    const sets = [
      { exercise_id: "pull_up", exercise_name: "Pull Up", weight: 10, reps: 5, est_total_load_kg: 90 },
    ];

    mockGetFirstSync.mockReturnValue({ c: 3 });

    const result = await checkSessionVolumePRs({
      workoutId: "w_1",
      programId: "prog_1",
      sets,
    });

    expect(result.volumePrs[0]).toContain("450");
  });

  it("includes all sets in volume calculation", async () => {
    const sets = [
      { exercise_id: "bench_press", exercise_name: "Bench", weight: 60, reps: 10 },
      { exercise_id: "bench_press", exercise_name: "Bench", weight: 100, reps: 5 },
    ];

    mockGetFirstSync.mockReturnValue({ c: 3 });

    const result = await checkSessionVolumePRs({
      workoutId: "w_1",
      programId: "prog_1",
      sets,
    });

    // 60*10 + 100*5 = 1100
    expect(result.volumePrs[0]).toContain("1100");
  });

  it("returns empty volumePrs for baseline (first session)", async () => {
    const sets = [
      { exercise_id: "bench_press", exercise_name: "Bench", weight: 80, reps: 10 },
    ];

    // No existing PRs
    mockGetAllSync.mockReturnValue([]);
    // No prior sets (baseline)
    mockGetFirstSync.mockReturnValue({ c: 0 });

    const result = await checkSessionVolumePRs({
      workoutId: "w_1",
      programId: "prog_1",
      sets,
    });

    // Volume record still gets stored, but messages empty (baseline)
    expect(result.volumePrs).toHaveLength(0);
    expect(result.dbPrMap["bench_press"]?.volume).toBeDefined();
  });

  it("returns non-empty messages array for new volume PR", async () => {
    const sets = [
      { exercise_id: "bench_press", exercise_name: "Bench", weight: 100, reps: 10 },
    ];

    // Existing volume PR of 500
    mockGetAllSync.mockReturnValue([
      { exercise_id: "bench_press", type: "volume", value: 500, reps: null, weight: null, set_id: null, date: "2026-01-01" },
      { exercise_id: "bench_press", type: "heaviest", value: 100, reps: 5, weight: 100, set_id: "s1", date: "2026-01-01" },
    ]);
    mockGetFirstSync.mockReturnValue({ c: 5 });

    const result = await checkSessionVolumePRs({
      workoutId: "w_1",
      programId: "prog_1",
      sets,
    });

    // 100*10 = 1000 > 500 → new PR
    expect(result.volumePrs.length).toBeGreaterThan(0);
    expect(result.volumePrs[0]).toContain("volume:");
  });
});

describe("recomputePRForExercise", () => {
  it("returns empty and deletes pr_records when no sets exist", () => {
    mockGetAllSync.mockReturnValue([]);

    const result = recomputePRForExercise("bench_press", "prog_1");

    expect(result).toEqual({});
    // Should DELETE existing pr_records for this exercise
    expect(mockRunSync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM pr_records"),
      ["bench_press", "prog_1"]
    );
  });

  it("finds heaviest weight from historical sets", () => {
    mockGetAllSync.mockReturnValue([
      { set_id: "s1", weight: 80, reps: 5, est_total_load_kg: null, date: "2026-01-01" },
      { set_id: "s2", weight: 100, reps: 3, est_total_load_kg: null, date: "2026-01-15" },
      { set_id: "s3", weight: 90, reps: 8, est_total_load_kg: null, date: "2026-02-01" },
    ]);

    const result = recomputePRForExercise("bench_press", "prog_1");

    expect(result.heaviest?.value).toBe(100);
    expect(result.heaviest?.setId).toBe("s2");
    expect(result.heaviest?.date).toBe("2026-01-15");
  });

  it("finds best e1RM from historical sets", () => {
    // 90kg x 8 reps → e1RM = 90 * (1 + 8/30) = 90 * 1.2667 ≈ 114
    // 100kg x 3 reps → e1RM = 100 * (1 + 3/30) = 100 * 1.1 = 110
    mockGetAllSync.mockReturnValue([
      { set_id: "s1", weight: 100, reps: 3, est_total_load_kg: null, date: "2026-01-15" },
      { set_id: "s2", weight: 90, reps: 8, est_total_load_kg: null, date: "2026-02-01" },
    ]);

    const result = recomputePRForExercise("bench_press", "prog_1");

    // s2 should win on e1RM despite lower weight
    expect(result.e1rm?.value).toBeCloseTo(114, 0);
    expect(result.e1rm?.setId).toBe("s2");
  });

  it("uses est_total_load_kg for bodyweight exercises", () => {
    // pull_up is mocked as isBodyweight
    mockGetAllSync.mockReturnValue([
      { set_id: "s1", weight: 10, reps: 5, est_total_load_kg: 90, date: "2026-01-01" },
      { set_id: "s2", weight: 20, reps: 5, est_total_load_kg: 100, date: "2026-02-01" },
    ]);

    const result = recomputePRForExercise("pull_up", "prog_1");

    // Should use est_total_load_kg (100), not raw weight (20)
    expect(result.heaviest?.value).toBe(100);
    expect(result.heaviest?.setId).toBe("s2");
  });

  it("writes results to pr_records via runSync", () => {
    mockGetAllSync.mockReturnValue([
      { set_id: "s1", weight: 100, reps: 5, est_total_load_kg: null, date: "2026-01-01" },
    ]);

    recomputePRForExercise("bench_press", "prog_1");

    // Should call runSync for heaviest and e1rm INSERT OR REPLACE
    const calls = mockRunSync.mock.calls;
    const sqlStatements = calls.map((c: any[]) => c[0] as string);
    expect(sqlStatements.some((s) => s.includes("'heaviest'"))).toBe(true);
    expect(sqlStatements.some((s) => s.includes("'e1rm'"))).toBe(true);
  });

  it("returns empty for empty exerciseId or programId", () => {
    expect(recomputePRForExercise("", "prog_1")).toEqual({});
    expect(recomputePRForExercise("bench_press", "")).toEqual({});
    expect(mockGetAllSync).not.toHaveBeenCalled();
  });
});
