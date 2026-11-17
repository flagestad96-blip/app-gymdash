/* eslint-disable @typescript-eslint/no-require-imports -- modules are re-required for every test after jest.resetModules() */
/**
 * End-to-end checks of the data layer against a REAL SQLite engine (Node's
 * built-in `node:sqlite`) instead of mocks: schema + migrations, program
 * import/share round trip, duplicating, pruning, alternative targets, backup
 * export → import, and the PR rules.
 *
 * The app talks to expo-sqlite; here that module is replaced by a thin adapter
 * over an in-memory database, so every SQL statement in the stores really runs.
 *
 * Skipped automatically where `node:sqlite` does not exist (Node < 22.5).
 */

type Row = Record<string, unknown>;

// Jest's own `require` cannot load prefix-only builtins like node:sqlite, so
// ask the process for it directly.
const nodeSqlite: { DatabaseSync: new (path: string) => any } | undefined = (() => {
  try {
    return (process as unknown as { getBuiltinModule?: (id: string) => any }).getBuiltinModule?.("node:sqlite");
  } catch {
    return undefined;
  }
})();

let currentDb: any = null;

function adapt(db: any) {
  const norm = (rest: unknown[]) => {
    const params = rest.length === 1 && Array.isArray(rest[0]) ? (rest[0] as unknown[]) : rest;
    return params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
  };
  const all = (sql: string, ...rest: unknown[]) => (db.prepare(sql).all(...norm(rest)) as Row[]).map((r) => ({ ...r }));
  const first = (sql: string, ...rest: unknown[]) => {
    const row = db.prepare(sql).get(...norm(rest)) as Row | undefined;
    return row ? { ...row } : null;
  };
  const run = (sql: string, ...rest: unknown[]) => {
    const r = db.prepare(sql).run(...norm(rest));
    return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
  };
  return {
    execSync: (sql: string) => db.exec(sql),
    runSync: run,
    getAllSync: all,
    getFirstSync: first,
    execAsync: async (sql: string) => db.exec(sql),
    runAsync: async (sql: string, ...rest: unknown[]) => run(sql, ...rest),
    getAllAsync: async (sql: string, ...rest: unknown[]) => all(sql, ...rest),
    getFirstAsync: async (sql: string, ...rest: unknown[]) => first(sql, ...rest),
    closeAsync: async () => db.close(),
  };
}

jest.mock("expo-sqlite", () => ({
  openDatabaseSync: () => {
    if (!nodeSqlite) throw new Error("node:sqlite unavailable");
    currentDb = new nodeSqlite.DatabaseSync(":memory:");
    return adapt(currentDb);
  },
}));

// Translations pull in expo-localization (native); the stores only need t().
jest.mock("../i18n", () => ({ t: (key: string) => key }));

const describeDb = nodeSqlite ? describe : describe.skip;

/** A fresh in-memory database and freshly loaded modules for every test. */
async function boot() {
  jest.resetModules();
  delete (globalThis as { __gymdash_db_state__?: unknown }).__gymdash_db_state__;
  const dbMod = require("../db") as typeof import("../db");
  await dbMod.initDb();
  return {
    db: dbMod.getDb(),
    dbMod,
    programStore: require("../programStore") as typeof import("../programStore"),
    progression: require("../progressionStore") as typeof import("../progressionStore"),
    programImport: require("../programImport") as typeof import("../programImport"),
    programExercises: require("../programExercises") as typeof import("../programExercises"),
    sharing: require("../sharing") as typeof import("../sharing"),
    backup: require("../backup") as typeof import("../backup"),
    prEngine: require("../prEngine") as typeof import("../prEngine"),
    periodization: require("../periodization") as typeof import("../periodization"),
    library: require("../exerciseLibrary") as typeof import("../exerciseLibrary"),
  };
}

/** The share payload a friend's program arrives as (trimmed from a real one). */
const SHARED = {
  schemaVersion: 1,
  exportedAt: "2026-11-16T13:42:30.207Z",
  program: { name: "Over/Under", daysCount: 2 },
  days: [
    {
      dayIndex: 0,
      name: "Overkropp A",
      blocks: [
        { type: "single", exerciseId: "bench_press", sortIndex: 0 },
        { type: "single", exerciseId: "pull_up", sortIndex: 1 },
        { type: "superset", a: "lateral_raise", b: "triceps_pushdown", sortIndex: 2 },
        { type: "single", exerciseId: "db_curl", sortIndex: 3 },
      ],
    },
    {
      dayIndex: 1,
      name: "Underkropp A",
      blocks: [
        { type: "single", exerciseId: "back_squat", sortIndex: 0 },
        { type: "superset", a: "standing_calf_raise", b: "hanging_leg_raise", sortIndex: 1 },
      ],
    },
  ],
  alternatives: [
    { dayIndex: 0, exerciseId: "pull_up", alternatives: ["lat_pulldown"] },
    { dayIndex: 0, exerciseId: "db_curl", alternatives: ["ez_bar_curl", "cable_curl"] },
  ],
  targets: [
    { exerciseId: "bench_press", dayIndex: 0, repMin: 5, repMax: 8, targetSets: 3, incrementKg: 2.5 },
    { exerciseId: "pull_up", dayIndex: 0, repMin: 6, repMax: 10, targetSets: 3, incrementKg: 2.5 },
    { exerciseId: "lateral_raise", dayIndex: 0, repMin: 12, repMax: 20, targetSets: 2, incrementKg: 2.5 },
    { exerciseId: "triceps_pushdown", dayIndex: 0, repMin: 10, repMax: 15, targetSets: 2, incrementKg: 2.5 },
    { exerciseId: "db_curl", dayIndex: 0, repMin: 8, repMax: 12, targetSets: 2, incrementKg: 2.5 },
    { exerciseId: "back_squat", dayIndex: 1, repMin: 5, repMax: 8, targetSets: 3, incrementKg: 5 },
    { exerciseId: "standing_calf_raise", dayIndex: 1, repMin: 10, repMax: 15, targetSets: 3, incrementKg: 2.5 },
    { exerciseId: "hanging_leg_raise", dayIndex: 1, repMin: 10, repMax: 15, targetSets: 2, incrementKg: 2.5 },
  ],
};

type Ctx = Awaited<ReturnType<typeof boot>>;

/** What the Program screen does with a parsed import, minus the React state. */
async function importShared(ctx: Ctx, payload: unknown, id: string) {
  const res = ctx.programImport.parseProgramImport(payload);
  if (!res.ok) throw new Error("import rejected: " + res.errorKey);
  const program = {
    id,
    name: res.program.name,
    createdAt: "2026-11-17T00:00:00.000Z",
    updatedAt: "2026-11-17T00:00:00.000Z",
    days: res.program.days.map((d, i) => ({
      id: `${id}_day_${i}`,
      name: d.name,
      blocks: d.blocks.map((b) =>
        b.type === "single"
          ? { type: "single" as const, exId: (b.exId ?? b.ex) as string }
          : { type: "superset" as const, a: b.a as string, b: b.b as string, ...(b.c ? { c: b.c } : {}) }
      ),
    })),
  };
  await ctx.programStore.saveProgram("normal", program as any);
  for (const alt of res.alternatives) await ctx.programStore.setAlternatives({ programId: id, ...alt });
  await ctx.progression.applySharedTargets(id, res.targets);
  // What loadAll() does next: make sure every exercise (and alternative) has a target.
  const stored = (await ctx.programStore.getProgram(id))!;
  const alts = await ctx.programStore.getAlternativesForProgram(id);
  await ctx.progression.ensureTargets(id, ctx.programExercises.collectDayExercisePairs(stored, alts));
  return stored;
}

function plan(t: { targetSets: number; repMin: number; repMax: number } | undefined) {
  return t ? `${t.targetSets}x${t.repMin}-${t.repMax}` : "none";
}

describeDb("database: schema and migrations", () => {
  it("a fresh install ends up fully migrated, and a restart changes nothing", async () => {
    const ctx = await boot();
    const versions = ctx.db.getAllSync<{ version: number }>(`SELECT version FROM schema_migrations ORDER BY version`).map((r) => r.version);
    expect(versions).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));

    const tables = ctx.db.getAllSync<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`).map((r) => r.name);
    for (const t of ["workouts", "sets", "programs", "exercise_targets", "skipped_exercises", "gym_locations", "pr_records"]) {
      expect(tables).toContain(t);
    }
    const setCols = ctx.db.getAllSync<{ name: string }>(`PRAGMA table_info(sets);`).map((c) => c.name);
    expect(setCols).toEqual(expect.arrayContaining(["rest_seconds", "is_warmup", "est_total_load_kg", "notes"]));
  });

  it("a migration that was skipped earlier is picked up on the next start", async () => {
    const ctx = await boot();
    // A migration that failed used to be skipped for good once a later one
    // had run. Recreate that state (18 missing, 27 present) and start again.
    ctx.db.runSync(`DELETE FROM schema_migrations WHERE version = 18`);
    const state = (globalThis as any).__gymdash_db_state__;
    state.inited = false;
    state.initPromise = null;
    jest.resetModules();
    const dbMod = require("../db") as typeof import("../db");
    await dbMod.initDb();
    const row = dbMod.getDb().getFirstSync<{ c: number }>(`SELECT COUNT(1) AS c FROM schema_migrations WHERE version = 18`);
    expect(row?.c).toBe(1);
  });
});

describeDb("database: sharing a program", () => {
  it("an imported program keeps sets x reps, supersets and alternatives", async () => {
    const ctx = await boot();
    const program = await importShared(ctx, SHARED, "imp1");

    expect(program.days.map((d) => d.name)).toEqual(["Overkropp A", "Underkropp A"]);
    expect(program.days[0].blocks[2]).toEqual({ type: "superset", a: "lateral_raise", b: "triceps_pushdown" });

    const targets = await ctx.progression.getTargets("imp1");
    expect(plan(targets[0].bench_press)).toBe("3x5-8");
    expect(plan(targets[0].lateral_raise)).toBe("2x12-20");
    expect(plan(targets[1].hanging_leg_raise)).toBe("2x10-15");
    expect(plan(targets[1].standing_calf_raise)).toBe("3x10-15");

    const alts = await ctx.programStore.getAlternativesForProgram("imp1");
    expect(alts[0].pull_up).toEqual(["lat_pulldown"]);
    expect(alts[0].db_curl).toEqual(["ez_bar_curl", "cable_curl"]);
  });

  it("an alternative starts from the plan of the exercise it replaces", async () => {
    const ctx = await boot();
    await importShared(ctx, SHARED, "imp1");
    const targets = await ctx.progression.getTargets("imp1");
    // db_curl is 2 x 8-12 in the plan; the library default for a curl is 3 x 10-15.
    expect(plan(targets[0].ez_bar_curl)).toBe("2x8-12");
    expect(plan(targets[0].cable_curl)).toBe("2x8-12");
    expect(plan(targets[0].lat_pulldown)).toBe("3x6-10");
  });

  it("export → import gives the same program back (copy text, share file, Settings)", async () => {
    const ctx = await boot();
    await importShared(ctx, SHARED, "imp1");
    const text = await ctx.sharing.getShareableProgramJson("imp1");
    expect(text).toBeTruthy();

    const again = await importShared(ctx, JSON.parse(text as string), "imp2");
    const first = (await ctx.programStore.getProgram("imp1"))!;
    expect(again.days.map((d) => ({ name: d.name, blocks: d.blocks }))).toEqual(
      first.days.map((d) => ({ name: d.name, blocks: d.blocks }))
    );

    const strip = (byDay: Awaited<ReturnType<typeof ctx.progression.getTargets>>) =>
      Object.values(byDay)
        .flatMap((byEx) => Object.values(byEx))
        .map((t) => `${t.dayIndex}:${t.exerciseId}:${plan(t)}:${t.incrementKg}:${t.autoProgress}`)
        .sort();
    expect(strip(await ctx.progression.getTargets("imp2"))).toEqual(strip(await ctx.progression.getTargets("imp1")));
    expect(await ctx.programStore.getAlternativesForProgram("imp2")).toEqual(await ctx.programStore.getAlternativesForProgram("imp1"));
  });

  it("builds a file name that survives a slash in the program name", async () => {
    const ctx = await boot();
    expect(ctx.sharing.programShareFileName("Over/Under 4 dager")).toBe("gymdash_program_Over-Under_4_dager.json");
    expect(ctx.sharing.programShareFileName("///")).toBe("gymdash_program_program.json");
  });
});

describeDb("database: editing programs", () => {
  it("duplicating a program copies targets and alternatives", async () => {
    const ctx = await boot();
    await importShared(ctx, SHARED, "imp1");
    const original = (await ctx.programStore.getProgram("imp1"))!;
    const clone = ctx.programStore.cloneProgram(original, "Kopi");
    await ctx.programStore.saveProgram("normal", clone);
    await ctx.programStore.copyProgramExtras("imp1", clone.id);

    const targets = await ctx.progression.getTargets(clone.id);
    expect(plan(targets[0].lateral_raise)).toBe("2x12-20");
    expect(plan(targets[1].back_squat)).toBe("3x5-8");
    expect((await ctx.programStore.getAlternativesForProgram(clone.id))[0].pull_up).toEqual(["lat_pulldown"]);
    // …and the original is untouched.
    expect(plan((await ctx.progression.getTargets("imp1"))[0].lateral_raise)).toBe("2x12-20");
  });

  it("removing an exercise or a day takes its targets and alternatives with it", async () => {
    const ctx = await boot();
    await importShared(ctx, SHARED, "imp1");
    const program = (await ctx.programStore.getProgram("imp1"))!;

    // Take db_curl out of day 1 and drop day 2 entirely.
    const next = {
      ...program,
      days: [{ ...program.days[0], blocks: program.days[0].blocks.filter((b) => !(b.type === "single" && b.exId === "db_curl")) }],
    };
    await ctx.programStore.saveProgram("normal", next);
    await ctx.programStore.pruneProgramExtras(next);

    const targets = await ctx.progression.getTargets("imp1");
    expect(targets[0].db_curl).toBeUndefined();
    expect(targets[0].ez_bar_curl).toBeUndefined(); // only there as db_curl's alternative
    expect(targets[1]).toBeUndefined();
    expect(plan(targets[0].bench_press)).toBe("3x5-8");
    expect(plan(targets[0].lat_pulldown)).toBe("3x6-10"); // pull_up is still there
    const alts = await ctx.programStore.getAlternativesForProgram("imp1");
    expect(alts[0].db_curl).toBeUndefined();
    expect(alts[0].pull_up).toEqual(["lat_pulldown"]);

    // Adding the exercise back starts from the default, not the old 2 x 8-12.
    await ctx.progression.ensureTargets("imp1", [{ dayIndex: 0, exerciseId: "db_curl" }]);
    expect(plan((await ctx.progression.getTargets("imp1"))[0].db_curl)).toBe("3x10-15");
  });

  it("a custom exercise in use cannot be deleted — third superset slot and alternatives included", async () => {
    const ctx = await boot();
    const made = await ctx.library.createCustomExercise({
      displayName: "Min øvelse",
      equipment: "machine",
      tags: ["chest"],
      defaultIncrementKg: 2.5,
    } as any);
    const customId = typeof made === "string" ? made : (made as { id: string }).id;
    expect(customId).toBeTruthy();

    const program = ctx.programStore.createBlankProgram("Med egen", 1, "Dag");
    program.days[0].blocks = [{ type: "superset", a: "bench_press", b: "db_curl", c: customId } as any];
    await ctx.programStore.saveProgram("normal", program);
    expect((await ctx.library.deleteCustomExercise(customId)).ok).toBe(false);

    program.days[0].blocks = [{ type: "single", exId: "bench_press" } as any];
    await ctx.programStore.saveProgram("normal", program);
    await ctx.programStore.setAlternatives({ programId: program.id, dayIndex: 0, exerciseId: "bench_press", alternatives: [customId] });
    expect((await ctx.library.deleteCustomExercise(customId)).ok).toBe(false);

    await ctx.programStore.setAlternatives({ programId: program.id, dayIndex: 0, exerciseId: "bench_press", alternatives: [] });
    expect((await ctx.library.deleteCustomExercise(customId)).ok).toBe(true);
  });

  it("periodization round-trips without the removed deload percentage", async () => {
    const ctx = await boot();
    await importShared(ctx, SHARED, "imp1");
    await ctx.periodization.savePeriodization("imp1", { enabled: true, cycleWeeks: 4, deloadEvery: 4, currentWeek: 3, manualDeload: false });
    expect(await ctx.periodization.advanceWeek("imp1")).toMatchObject({ currentWeek: 4 });
    expect(ctx.periodization.isDeloadWeek((await ctx.periodization.getPeriodization("imp1"))!)).toBe(true);
    expect(await ctx.periodization.advanceWeek("imp1")).toMatchObject({ currentWeek: 1 });
  });
});

describeDb("database: backup", () => {
  async function seedHistory(ctx: Ctx) {
    await importShared(ctx, SHARED, "imp1");
    ctx.db.runSync(
      `INSERT INTO workouts(id, date, program_mode, program_id, day_key, back_status, day_index, started_at, ended_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["w1", "2026-11-10", "normal", "imp1", "day_1", "green", 0, "2026-11-10T17:00:00.000Z", null]
    );
    ctx.db.runSync(
      `INSERT INTO sets(id, workout_id, exercise_name, set_index, weight, reps, created_at, exercise_id, is_warmup) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["s1", "w1", "Bench Press", 0, 80, 6, "2026-11-10T17:05:00.000Z", "bench_press", 0]
    );
    ctx.db.runSync(`INSERT INTO skipped_exercises(id, workout_id, exercise_id, reason, created_at) VALUES(?, ?, ?, ?, ?)`, [
      "sk1", "w1", "pull_up", "apparat opptatt", "2026-11-10T17:20:00.000Z",
    ]);
    ctx.db.runSync(`INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)`, ["autoBackupDirUri", "content://old-phone/folder"]);
    ctx.db.runSync(`INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)`, ["autoBackupEnabled", "1"]);
    ctx.db.runSync(`INSERT OR REPLACE INTO settings(key, value) VALUES(?, ?)`, ["weightUnit", "kg"]);
  }

  it("export does not claim a backup was taken", async () => {
    const ctx = await boot();
    await seedHistory(ctx);
    await ctx.backup.exportFullBackup();
    expect(ctx.db.getFirstSync(`SELECT value FROM settings WHERE key = 'last_backup_at'`)).toBeNull();
    await ctx.backup.markBackupDone();
    expect(ctx.db.getFirstSync(`SELECT value FROM settings WHERE key = 'last_backup_at'`)).not.toBeNull();
  });

  it("a full restore brings everything back except settings tied to the old phone", async () => {
    const ctx = await boot();
    await seedHistory(ctx);
    const json = await ctx.backup.exportFullBackup();
    expect(JSON.parse(json).data.skipped_exercises).toHaveLength(1);

    const result = await ctx.backup.importBackup(json, "fresh");
    expect(result).toEqual({ success: true });

    expect(ctx.db.getAllSync(`SELECT id FROM sets`)).toEqual([{ id: "s1" }]);
    expect(ctx.db.getAllSync(`SELECT exercise_id, reason FROM skipped_exercises`)).toEqual([
      { exercise_id: "pull_up", reason: "apparat opptatt" },
    ]);
    expect(plan((await ctx.progression.getTargets("imp1"))[0].lateral_raise)).toBe("2x12-20");
    expect(ctx.db.getFirstSync(`SELECT value FROM settings WHERE key = 'weightUnit'`)).toEqual({ value: "kg" });
    expect(ctx.db.getFirstSync(`SELECT value FROM settings WHERE key = 'autoBackupDirUri'`)).toBeNull();
    expect(ctx.db.getFirstSync(`SELECT value FROM settings WHERE key = 'autoBackupEnabled'`)).toBeNull();
    // The restored workout had no ended_at (an old backup): History needs one.
    expect(ctx.db.getFirstSync<{ ended_at: string | null }>(`SELECT ended_at FROM workouts WHERE id = 'w1'`)?.ended_at).toBe(
      "2026-11-10T17:05:00.000Z"
    );
  });

  it("a merge import adds to what is there and never wipes", async () => {
    const ctx = await boot();
    await seedHistory(ctx);
    const json = await ctx.backup.exportFullBackup();
    ctx.db.runSync(
      `INSERT INTO workouts(id, date, program_mode, day_key, back_status, started_at) VALUES('w2', '2026-11-12', 'normal', 'day_2', 'green', '2026-11-12T17:00:00.000Z')`
    );
    expect(await ctx.backup.importBackup(json, "merge")).toEqual({ success: true });
    expect(ctx.db.getAllSync<{ id: string }>(`SELECT id FROM workouts ORDER BY id`).map((r) => r.id)).toEqual(["w1", "w2"]);
  });
});

describeDb("database: personal records", () => {
  function addWorkout(ctx: Ctx, id: string, programId: string, date: string) {
    ctx.db.runSync(
      `INSERT INTO workouts(id, date, program_mode, program_id, day_key, back_status, day_index, started_at) VALUES(?, ?, 'normal', ?, 'day_1', 'green', 0, ?)`,
      [id, date, programId, `${date}T17:00:00.000Z`]
    );
  }
  function addSet(ctx: Ctx, id: string, workoutId: string, weight: number, reps: number) {
    ctx.db.runSync(
      `INSERT INTO sets(id, workout_id, exercise_name, set_index, weight, reps, created_at, exercise_id, is_warmup) VALUES(?, ?, 'Bench Press', 0, ?, ?, ?, 'bench_press', 0)`,
      [id, workoutId, weight, reps, new Date().toISOString()]
    );
  }
  const base = { exerciseId: "bench_press", currentVolumeRecord: undefined, isBw: false, estTotalLoadKg: null };

  it("a new program only announces a PR that beats the old program too", async () => {
    const ctx = await boot();
    addWorkout(ctx, "w_old", "prog_old", "2026-10-01");
    addSet(ctx, "s_old", "w_old", 100, 5);
    await ctx.prEngine.checkSetPRs({ ...base, weight: 100, reps: 5, setId: "s_old", workoutId: "w_old", programId: "prog_old" });

    addWorkout(ctx, "w_new", "prog_new", "2026-11-17");
    addSet(ctx, "s_new1", "w_new", 80, 5);
    const lower = await ctx.prEngine.checkSetPRs({ ...base, weight: 80, reps: 5, setId: "s_new1", workoutId: "w_new", programId: "prog_new" });
    expect(lower.messages).toEqual([]);

    addSet(ctx, "s_new2", "w_new", 105, 5);
    const higher = await ctx.prEngine.checkSetPRs({ ...base, weight: 105, reps: 5, setId: "s_new2", workoutId: "w_new", programId: "prog_new" });
    expect(higher.messages.some((m) => m.startsWith("heaviest:105"))).toBe(true);
  });

  it("undoing a PR set brings the previous record back", async () => {
    const ctx = await boot();
    addWorkout(ctx, "w1", "prog", "2026-11-10");
    addSet(ctx, "s1", "w1", 100, 5);
    await ctx.prEngine.checkSetPRs({ ...base, weight: 100, reps: 5, setId: "s1", workoutId: "w1", programId: "prog" });
    addWorkout(ctx, "w2", "prog", "2026-11-17");
    addSet(ctx, "s2", "w2", 105, 5);
    await ctx.prEngine.checkSetPRs({ ...base, weight: 105, reps: 5, setId: "s2", workoutId: "w2", programId: "prog" });
    expect(ctx.prEngine.loadPrRecords("prog", ["bench_press"]).bench_press.heaviest?.value).toBe(105);

    // Undo: the set goes, and the record is rebuilt from what is left.
    ctx.db.runSync(`DELETE FROM sets WHERE id = 's2'`);
    const rebuilt = ctx.prEngine.recomputePRForExercise("bench_press", "prog");
    expect(rebuilt.heaviest?.value).toBe(100);
    expect(ctx.prEngine.loadPrRecords("prog", ["bench_press"]).bench_press.heaviest?.value).toBe(100);
  });
});
