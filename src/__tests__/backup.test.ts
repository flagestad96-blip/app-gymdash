// Mock DB before imports
const mockGetAllAsync = jest.fn(async (): Promise<any[]> => []);
const mockGetFirstAsync = jest.fn(async (): Promise<any> => null);
const mockRunAsync = jest.fn(async () => ({ changes: 0, lastInsertRowId: 0 }));
const mockExecAsync = jest.fn(async () => {});

jest.mock("../db", () => ({
  getDb: () => ({
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
    execAsync: mockExecAsync,
  }),
  ensureDb: async () => {},
}));

jest.mock("../exerciseLibrary", () => ({
  displayNameFor: (id: string) => id,
  resolveExerciseId: (name: string) => name,
}));

import { exportFullBackup, importBackup, CURRENT_SCHEMA_VERSION } from "../backup";

beforeEach(() => {
  mockGetAllAsync.mockReset().mockResolvedValue([]);
  mockGetFirstAsync.mockReset().mockResolvedValue(null);
  mockRunAsync.mockReset().mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
  mockExecAsync.mockReset().mockResolvedValue(undefined);
});

describe("exportFullBackup", () => {
  it("returns valid JSON with all expected table keys", async () => {
    const result = await exportFullBackup();
    const parsed = JSON.parse(result);

    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.data).toBeDefined();

    const expectedTables = [
      "workouts",
      "sets",
      "settings",
      "programs",
      "program_days",
      "program_day_exercises",
      "program_exercise_alternatives",
      "program_replacements",
      "exercise_targets",
      "pr_records",
      "body_metrics",
      "achievements",
      "user_achievements",
      "exercise_goals",
      "custom_exercises",
      "progression_log",
      "workout_templates",
      "day_marks",
      "exercise_notes",
    ];

    for (const table of expectedTables) {
      expect(parsed.data).toHaveProperty(table);
      expect(Array.isArray(parsed.data[table])).toBe(true);
    }
  });

  it("includes data arrays even when tables are empty", async () => {
    const result = await exportFullBackup();
    const parsed = JSON.parse(result);

    expect(parsed.data.workouts).toEqual([]);
    expect(parsed.data.sets).toEqual([]);
  });
});

describe("importBackup", () => {
  it("returns invalid_json error for malformed JSON", async () => {
    const result = await importBackup("not valid json {{{", "merge");

    expect(result.success).toBe(false);
    expect(result.error).toBe("invalid_json");
  });

  it("returns invalid_json error for empty string", async () => {
    const result = await importBackup("", "merge");

    expect(result.success).toBe(false);
    expect(result.error).toBe("invalid_json");
  });

  it("returns backup_too_new error when schema version exceeds current", async () => {
    const backup = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION + 1,
      data: { workouts: [{ id: "w1" }] },
    });

    const result = await importBackup(backup, "merge");

    expect(result.success).toBe(false);
    expect(result.error).toBe("backup_too_new");
  });

  it("returns backup_empty error when all data arrays are empty", async () => {
    const backup = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: {
        workouts: [],
        sets: [],
        settings: [],
        programs: [],
      },
    });

    const result = await importBackup(backup, "merge");

    expect(result.success).toBe(false);
    expect(result.error).toBe("backup_empty");
  });

  it("returns success for valid backup with data", async () => {
    const backup = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: {
        workouts: [
          {
            id: "w_1",
            date: "2026-01-15",
            program_mode: "normal",
            day_key: "day_0",
            back_status: null,
          },
        ],
        sets: [],
      },
    });

    const result = await importBackup(backup, "merge");

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts backup at current schema version", async () => {
    const backup = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: {
        settings: [{ key: "locale", value: "en" }],
      },
    });

    const result = await importBackup(backup, "merge");

    expect(result.success).toBe(true);
  });

  it("accepts backup at older schema version", async () => {
    const backup = JSON.stringify({
      schemaVersion: 1,
      data: {
        workouts: [{ id: "w_old", date: "2025-01-01", program_mode: "normal", day_key: "day_0" }],
      },
    });

    const result = await importBackup(backup, "merge");

    expect(result.success).toBe(true);
  });

  it("returns invalid_format for non-object data", async () => {
    const result = await importBackup(JSON.stringify("just a string"), "merge");

    expect(result.success).toBe(false);
    expect(result.error).toBe("invalid_format");
  });

  it("calls execAsync with BEGIN and COMMIT for valid imports", async () => {
    const backup = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: {
        settings: [{ key: "test", value: "value" }],
      },
    });

    await importBackup(backup, "merge");

    const execCalls = mockExecAsync.mock.calls.map((c: any[]) => c[0] as string);
    expect(execCalls).toContain("BEGIN");
    expect(execCalls).toContain("COMMIT");
  });

  it("uses DELETE statements in fresh mode", async () => {
    const backup = JSON.stringify({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      data: {
        settings: [{ key: "test", value: "value" }],
      },
    });

    await importBackup(backup, "fresh");

    const execCalls = mockExecAsync.mock.calls.map((c: any[]) => c[0] as string);
    const deleteCalls = execCalls.filter((s) => s.startsWith("DELETE"));
    expect(deleteCalls.length).toBeGreaterThan(0);
  });
});
