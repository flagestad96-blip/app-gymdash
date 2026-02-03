// src/db.ts
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";
// Lazy-imported to avoid require cycle: db -> exerciseLibrary -> db
function getExerciseLibrary() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("./exerciseLibrary") as typeof import("./exerciseLibrary");
}

type WebDbInfo = {
  persistent: boolean;
  note: string;
};

type DbState = {
  db: SQLite.SQLiteDatabase | null;
  initPromise: Promise<void> | null;
  inited: boolean;
  webInfo: WebDbInfo | null;
};

const globalState: DbState = (() => {
  const g = globalThis as unknown as { __gymdash_db_state__?: DbState };
  if (!g.__gymdash_db_state__) {
    g.__gymdash_db_state__ = { db: null, initPromise: null, inited: false, webInfo: null };
  }
  return g.__gymdash_db_state__;
})();

let db: SQLite.SQLiteDatabase | null = globalState.db;

export type BackStatus = "green" | "yellow" | "red";
export type ProgramMode = "normal" | "back";
export type BodyMetricRow = { date: string; weight_kg: number; note?: string | null; photo_uri?: string | null };

let _inited = globalState.inited;

function parseDayIndexFromKey(key?: string | null): number | null {
  if (!key) return null;
  const match = String(key).match(/day_(\d+)/i);
  if (!match) return null;
  const n = Number(match[1]) - 1;
  return Number.isFinite(n) ? n : null;
}

function parseIsoMs(iso?: string | null): number {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function hasColumn(table: string, column: string): boolean {
  try {
    const cols = db?.getAllSync<{ name: string }>(`PRAGMA table_info(${table});`);
    return (cols ?? []).some((c) => c.name === column);
  } catch {
    return false;
  }
}

function runSplitWorkoutRepairOnce() {
  try {
    const flag = getSetting("repair_split_workouts_v1");
    if (flag === "1") return;
  } catch {
    // continue
  }

  try {
    if (!db) return;
    const latest = db.getFirstSync<{ date: string }>(
      `SELECT date FROM workouts ORDER BY started_at DESC, date DESC LIMIT 1`
    );
    if (!latest?.date) {
      setSetting("repair_split_workouts_v1", "1");
      return;
    }

    const rows = db.getAllSync<{
      id: string;
      date: string;
      started_at?: string | null;
      day_key?: string | null;
      day_index?: number | null;
      notes?: string | null;
    }>(
      `SELECT id, date, started_at, day_key, day_index, notes
       FROM workouts
       WHERE date = ?
       ORDER BY started_at DESC, id DESC
       LIMIT 3`,
      [latest.date]
    );

    if (!rows || rows.length < 2) {
      setSetting("repair_split_workouts_v1", "1");
      return;
    }

    let primary = rows[0];
    let primaryMs = parseIsoMs(primary.started_at);
    for (const r of rows) {
      const ms = parseIsoMs(r.started_at);
      if (!Number.isFinite(primaryMs) || (Number.isFinite(ms) && ms < primaryMs)) {
        primary = r;
        primaryMs = ms;
      }
    }

    const others = rows.filter((r) => r.id !== primary.id);
    if (others.length === 0) {
      setSetting("repair_split_workouts_v1", "1");
      return;
    }

    const dayKey = "day_2";
    const dayIndex = 1;
    const noteText = "Rear delt fly ikke gjort (maskin ødelagt)";
    const mergedNote = primary.notes ? `${primary.notes}\n${noteText}` : noteText;

    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    let latestEnd: string | null = null;
    if (hasColumn("workouts", "ended_at")) {
      const last = db.getFirstSync<{ last: string | null }>(
        `SELECT MAX(created_at) as last FROM sets WHERE workout_id IN (${placeholders})`,
        ids
      );
      if (last?.last) latestEnd = String(last.last);
    }

    db.execSync("BEGIN");
    for (const r of others) {
      db.runSync(`UPDATE sets SET workout_id = ? WHERE workout_id = ?`, [primary.id, r.id]);
    }
    if (hasColumn("workouts", "ended_at") && latestEnd) {
      db.runSync(
        `UPDATE workouts SET day_key = ?, day_index = ?, notes = ?, started_at = COALESCE(?, started_at), ended_at = ? WHERE id = ?`,
        [dayKey, dayIndex, mergedNote, primary.started_at ?? null, latestEnd, primary.id]
      );
    } else {
      db.runSync(
        `UPDATE workouts SET day_key = ?, day_index = ?, notes = ?, started_at = COALESCE(?, started_at) WHERE id = ?`,
        [dayKey, dayIndex, mergedNote, primary.started_at ?? null, primary.id]
      );
    }

    for (const r of others) {
      db.runSync(
        `UPDATE workouts SET day_key = ?, day_index = ?, notes = ? WHERE id = ?`,
        [dayKey, dayIndex, `Merged into ${primary.id}`, r.id]
      );
    }

    db.execSync("COMMIT");
    setSetting("repair_split_workouts_v1", "1");
    console.log(`[db] repair_split_workouts_v1 merged ${others.length} workouts into ${primary.id}`);
  } catch (err) {
    try {
      db?.execSync("ROLLBACK");
    } catch {}
    try {
      setSetting("repair_split_workouts_v1", "1");
    } catch {}
    console.warn("[db] repair_split_workouts_v1 failed", err);
  }
}

function setWebInfo(persistent: boolean, note: string) {
  globalState.webInfo = { persistent, note };
}

function disableOpfs(note: string) {
  (globalState as unknown as { __gymdash_opfs_disabled__?: boolean }).__gymdash_opfs_disabled__ = true;
  setWebInfo(false, note);
}

function createNoopDb(): SQLite.SQLiteDatabase {
  const noop = {
    execAsync: async () => {},
    runAsync: async () => ({ changes: 0, lastInsertRowId: 0 }),
    getAllAsync: async <T,>() => [] as T[],
    getFirstAsync: async <T,>() => null as T | null,
    closeAsync: async () => {},
    execSync: () => {},
    runSync: () => ({ changes: 0, lastInsertRowId: 0 }),
    getAllSync: <T,>() => [] as T[],
    getFirstSync: <T,>() => null as T | null,
  };
  return noop as unknown as SQLite.SQLiteDatabase;
}

function disableWebDb(note: string) {
  setWebInfo(false, note);
  db = createNoopDb();
  globalState.db = db;
  _inited = true;
  globalState.inited = true;
}

export function getDbInfo(): WebDbInfo {
  if (Platform.OS !== "web") return { persistent: true, note: "native" };
  return globalState.webInfo ?? { persistent: false, note: "unknown" };
}

export async function initDb() {
  if (globalState.initPromise) {
    await globalState.initPromise;
    return;
  }

  globalState.initPromise = (async () => {
    if (db === null) {
      // On web, use async openDatabaseAsync. On native, use openDatabaseSync.
      if (Platform.OS === "web") {
        disableWebDb("Web DB disabled; using in-memory no-op store");
      } else {
        db = SQLite.openDatabaseSync("gymdash.db");
      }
      globalState.db = db;
    }
    if (_inited) return;

    const isWeb = Platform.OS === "web";

    if (isWeb) {
      // No-op database on web; skip schema and migrations.
      _inited = true;
      globalState.inited = true;
      return;
    }
    if (!db) {
      throw new Error("Database not initialized");
    }
    {
      db.execSync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS workouts (
        id TEXT PRIMARY KEY NOT NULL,
        date TEXT NOT NULL,
        program_mode TEXT NOT NULL,
        program_id TEXT,
        day_key TEXT NOT NULL,
        back_status TEXT NOT NULL,
        notes TEXT,
        day_index INTEGER,
        started_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sets (
        id TEXT PRIMARY KEY NOT NULL,
        workout_id TEXT NOT NULL,
        exercise_name TEXT NOT NULL,
        set_index INTEGER NOT NULL,
        weight REAL NOT NULL,
        reps INTEGER NOT NULL,
        rpe REAL,
        created_at TEXT NOT NULL,
        exercise_id TEXT,
        set_type TEXT,
        is_warmup INTEGER,
        external_load_kg REAL DEFAULT 0,
        bodyweight_kg_used REAL,
        bodyweight_factor REAL,
        est_total_load_kg REAL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS programs (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        mode TEXT,
        json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS program_days (
        id TEXT PRIMARY KEY NOT NULL,
        program_id TEXT NOT NULL,
        day_index INTEGER NOT NULL,
        name TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS program_day_exercises (
        id TEXT PRIMARY KEY NOT NULL,
        program_id TEXT NOT NULL,
        day_index INTEGER NOT NULL,
        sort_index INTEGER NOT NULL,
        type TEXT NOT NULL,
        ex_id TEXT,
        a_id TEXT,
        b_id TEXT
      );

      CREATE TABLE IF NOT EXISTS program_exercise_alternatives (
        id TEXT PRIMARY KEY NOT NULL,
        program_id TEXT NOT NULL,
        day_index INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        alt_exercise_id TEXT NOT NULL,
        sort_index INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS program_replacements (
        id TEXT PRIMARY KEY NOT NULL,
        program_id TEXT NOT NULL,
        day_index INTEGER NOT NULL,
        original_ex_id TEXT NOT NULL,
        replaced_ex_id TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS exercise_targets (
        id TEXT PRIMARY KEY NOT NULL,
        program_id TEXT NOT NULL,
        exercise_id TEXT NOT NULL,
        rep_min INTEGER NOT NULL,
        rep_max INTEGER NOT NULL,
        target_sets INTEGER,
        increment_kg REAL NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS pr_records (
        exercise_id TEXT NOT NULL,
        type TEXT NOT NULL,
        value REAL NOT NULL,
        reps INTEGER,
        weight REAL,
        set_id TEXT,
        date TEXT,
        program_id TEXT NOT NULL,
        PRIMARY KEY (exercise_id, type, program_id)
      );

      CREATE TABLE IF NOT EXISTS body_metrics (
        date TEXT PRIMARY KEY NOT NULL,
        weight_kg REAL NOT NULL,
        note TEXT
      );

      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY NOT NULL,
        category TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT NOT NULL,
        requirement_type TEXT NOT NULL,
        requirement_value REAL NOT NULL,
        requirement_exercise_id TEXT,
        tier TEXT NOT NULL,
        points INTEGER NOT NULL DEFAULT 10,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_achievements (
        id TEXT PRIMARY KEY NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        workout_id TEXT,
        set_id TEXT,
        value_achieved REAL,
        FOREIGN KEY (achievement_id) REFERENCES achievements(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sets_workout ON sets(workout_id);
      CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise_id);
      CREATE INDEX IF NOT EXISTS idx_workouts_date ON workouts(date);
      CREATE INDEX IF NOT EXISTS idx_program_days_program ON program_days(program_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_program_days_unique ON program_days(program_id, day_index);
      CREATE INDEX IF NOT EXISTS idx_program_day_exercises_program ON program_day_exercises(program_id);
      CREATE INDEX IF NOT EXISTS idx_program_day_exercises_day ON program_day_exercises(program_id, day_index);
      CREATE INDEX IF NOT EXISTS idx_program_alternatives_program ON program_exercise_alternatives(program_id);
      CREATE INDEX IF NOT EXISTS idx_program_alternatives_day ON program_exercise_alternatives(program_id, day_index);
      CREATE INDEX IF NOT EXISTS idx_program_replacements_program ON program_replacements(program_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_program_replacements_unique ON program_replacements(program_id, day_index, original_ex_id);
      CREATE INDEX IF NOT EXISTS idx_exercise_targets_program ON exercise_targets(program_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_targets_unique ON exercise_targets(program_id, exercise_id);
      CREATE INDEX IF NOT EXISTS idx_pr_records_exercise ON pr_records(exercise_id);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
      CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(unlocked_at DESC);
    `);

      // Migrations on native
      try {
        db.execSync(`ALTER TABLE sets ADD COLUMN exercise_id TEXT;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE sets ADD COLUMN set_type TEXT;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE sets ADD COLUMN is_warmup INTEGER;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE sets ADD COLUMN external_load_kg REAL DEFAULT 0;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE sets ADD COLUMN bodyweight_kg_used REAL;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE sets ADD COLUMN bodyweight_factor REAL;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE sets ADD COLUMN est_total_load_kg REAL;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE sets ADD COLUMN notes TEXT;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE workouts ADD COLUMN day_index INTEGER;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE workouts ADD COLUMN started_at TEXT;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE workouts ADD COLUMN program_id TEXT;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE workouts ADD COLUMN ended_at TEXT;`);
      } catch {}
      try {
        db.execSync(`CREATE INDEX IF NOT EXISTS idx_workouts_program ON workouts(program_id);`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE programs ADD COLUMN created_at TEXT;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE programs ADD COLUMN updated_at TEXT;`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE programs ADD COLUMN mode TEXT;`);
      } catch {}
      try {
        const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(programs);`);
        const hasMode = (cols ?? []).some((col) => col.name === "mode");
        if (hasMode) {
          db.execSync(`CREATE INDEX IF NOT EXISTS idx_programs_mode ON programs(mode);`);
        }
      } catch {}
      try {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS exercise_targets (
            id TEXT PRIMARY KEY NOT NULL,
            program_id TEXT NOT NULL,
            exercise_id TEXT NOT NULL,
            rep_min INTEGER NOT NULL,
            rep_max INTEGER NOT NULL,
            target_sets INTEGER,
            increment_kg REAL NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);
        db.execSync(`CREATE INDEX IF NOT EXISTS idx_exercise_targets_program ON exercise_targets(program_id);`);
        db.execSync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_targets_unique ON exercise_targets(program_id, exercise_id);`);
      } catch {}
      try {
        db.execSync(`ALTER TABLE exercise_targets ADD COLUMN target_sets INTEGER;`);
      } catch {}
      try {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS pr_records (
            exercise_id TEXT NOT NULL,
            type TEXT NOT NULL,
            value REAL NOT NULL,
            reps INTEGER,
            weight REAL,
            set_id TEXT,
            date TEXT,
            program_id TEXT NOT NULL,
            PRIMARY KEY (exercise_id, type, program_id)
          );
        `);
        db.execSync(`CREATE INDEX IF NOT EXISTS idx_pr_records_exercise ON pr_records(exercise_id);`);
      } catch {}
      try {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS body_metrics (
            date TEXT PRIMARY KEY NOT NULL,
            weight_kg REAL NOT NULL,
            note TEXT
          );
        `);
      } catch {}

      try {
        const rows = db.getAllSync<{ id: string; exercise_name: string }>(
          `SELECT id, exercise_name FROM sets WHERE (exercise_id IS NULL OR exercise_id = '') AND exercise_name IS NOT NULL`
        );
        for (const row of rows ?? []) {
          const exId = getExerciseLibrary().resolveExerciseId(row.exercise_name);
          if (!exId) continue;
          db.runSync(`UPDATE sets SET exercise_id = ? WHERE id = ?`, [exId, row.id]);
        }
      } catch {}

      // Exercise goals table
      try {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS exercise_goals (
            id TEXT PRIMARY KEY NOT NULL,
            exercise_id TEXT NOT NULL,
            goal_type TEXT NOT NULL,
            target_value REAL NOT NULL,
            created_at TEXT NOT NULL,
            achieved_at TEXT,
            program_id TEXT NOT NULL
          );
        `);
        db.execSync(`CREATE INDEX IF NOT EXISTS idx_exercise_goals_exercise ON exercise_goals(exercise_id);`);
        db.execSync(`CREATE INDEX IF NOT EXISTS idx_exercise_goals_program ON exercise_goals(program_id);`);
      } catch {}

      // Custom exercises table
      try {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS custom_exercises (
            id TEXT PRIMARY KEY NOT NULL,
            display_name TEXT NOT NULL,
            equipment TEXT NOT NULL,
            tags TEXT NOT NULL,
            default_increment_kg REAL NOT NULL DEFAULT 2.5,
            is_bodyweight INTEGER DEFAULT 0,
            bodyweight_factor REAL,
            created_at TEXT NOT NULL
          );
        `);
      } catch {}

      // One-time repair for split workouts due to day switching
      try {
        runSplitWorkoutRepairOnce();
      } catch {}

      // Seed achievements
      try {
        const { seedAchievements } = await import("./achievements");
        await seedAchievements({ skipEnsure: true });
      } catch {}

      // Load custom exercises into in-memory cache
      // IMPORTANT: We use _loadCustomExercisesFromDb(db) instead of loadCustomExercises()
      // because loadCustomExercises calls ensureDb() which deadlocks (we're inside initDb's promise).
      try {
        const { _loadCustomExercisesFromDb } = await import("./exerciseLibrary");
        await _loadCustomExercisesFromDb(db);
      } catch {}

      // Auto-progression: add auto_progress column to exercise_targets
      try {
        db.execSync(`ALTER TABLE exercise_targets ADD COLUMN auto_progress INTEGER DEFAULT 1`);
      } catch {}

      // Progression log table
      try {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS progression_log (
            id TEXT PRIMARY KEY NOT NULL,
            program_id TEXT NOT NULL,
            exercise_id TEXT NOT NULL,
            old_weight_kg REAL NOT NULL,
            new_weight_kg REAL NOT NULL,
            reason TEXT,
            created_at TEXT NOT NULL,
            applied INTEGER DEFAULT 0,
            dismissed INTEGER DEFAULT 0
          );
        `);
        db.execSync(`CREATE INDEX IF NOT EXISTS idx_progression_log_program ON progression_log(program_id, exercise_id);`);
      } catch {}

      // Tier 4: Progress photos — add photo_uri to body_metrics
      try {
        db.execSync(`ALTER TABLE body_metrics ADD COLUMN photo_uri TEXT;`);
      } catch {}

      // Tier 5: Workout templates table
      try {
        db.execSync(`
          CREATE TABLE IF NOT EXISTS workout_templates (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            exercises_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_used_at TEXT
          );
        `);
      } catch {}

      // Tier 5: Periodization — add periodization_json to programs
      try {
        db.execSync(`ALTER TABLE programs ADD COLUMN periodization_json TEXT;`);
      } catch {}
    }

    _inited = true;
    globalState.inited = true;
  })();

  try {
    await globalState.initPromise;
  } finally {
    globalState.initPromise = null;
  }
}

export function getDb(): SQLite.SQLiteDatabase {
  if (db === null) {
    throw new Error("Database not initialized. Call initDb() first.");
  }
  return db;
}

export async function ensureDb() {
  if (_inited) return;
  await initDb();
}

export function getSetting(key: string): string | null {
  try {
    const database = getDb();
    const row = database.getFirstSync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ? LIMIT 1`,
      [key]
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export function setSetting(key: string, value: string) {
  try {
    const database = getDb();
    database.runSync(
      `INSERT INTO settings(key, value) VALUES(?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, value]
    );
  } catch {
    // Database not yet initialized, silently fail
  }
}

export async function getSettingAsync(key: string): Promise<string | null> {
  try {
    await ensureDb();
    const database = getDb();
    const row = await database.getFirstAsync<{ value: string }>(
      `SELECT value FROM settings WHERE key = ? LIMIT 1`,
      [key]
    );
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSettingAsync(key: string, value: string): Promise<void> {
  try {
    await ensureDb();
    const database = getDb();
    await database.runAsync(
      `INSERT INTO settings(key, value) VALUES(?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
      [key, value]
    );
  } catch {
    // Silently fail
  }
}

export async function upsertBodyMetric(date: string, weightKg: number, note?: string | null, photoUri?: string | null): Promise<void> {
  await ensureDb();
  const database = getDb();
  await database.runAsync(
    `INSERT INTO body_metrics(date, weight_kg, note, photo_uri) VALUES(?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight_kg=excluded.weight_kg, note=excluded.note, photo_uri=excluded.photo_uri`,
    [date, weightKg, note ?? null, photoUri ?? null]
  );
}

export async function deleteBodyMetric(date: string): Promise<void> {
  await ensureDb();
  const database = getDb();
  await database.runAsync(`DELETE FROM body_metrics WHERE date = ?`, [date]);
}

export async function listBodyMetrics(limit?: number): Promise<BodyMetricRow[]> {
  await ensureDb();
  const database = getDb();
  if (limit && Number.isFinite(limit)) {
    const rows = await database.getAllAsync<BodyMetricRow>(
      `SELECT date, weight_kg, note, photo_uri FROM body_metrics ORDER BY date DESC LIMIT ?`,
      [Math.max(1, Math.trunc(limit))]
    );
    return rows ?? [];
  }
  const rows = await database.getAllAsync<BodyMetricRow>(
    `SELECT date, weight_kg, note, photo_uri FROM body_metrics ORDER BY date DESC`
  );
  return rows ?? [];
}

export async function getLatestBodyMetricBeforeOrOn(date: string): Promise<BodyMetricRow | null> {
  await ensureDb();
  const database = getDb();
  const row = await database.getFirstAsync<BodyMetricRow>(
    `SELECT date, weight_kg, note FROM body_metrics WHERE date <= ? ORDER BY date DESC LIMIT 1`,
    [date]
  );
  return row ?? null;
}

export function pickLatestBodyMetricBeforeOrOn(rows: BodyMetricRow[], date: string): BodyMetricRow | null {
  if (!rows?.length) return null;
  const filtered = rows.filter((r) => r.date <= date);
  if (!filtered.length) return null;
  return filtered.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
}

export function calcBodyweightTotal(bodyweightKg: number, factor: number, externalLoadKg: number): number {
  return bodyweightKg * factor + externalLoadKg;
}

export async function computeBodyweightLoad(
  exerciseId: string,
  date: string,
  externalLoadKg: number
): Promise<{
  external_load_kg: number;
  bodyweight_kg_used: number | null;
  bodyweight_factor: number | null;
  est_total_load_kg: number | null;
}> {
  const ext = Number.isFinite(externalLoadKg) ? externalLoadKg : 0;
  if (!getExerciseLibrary().isBodyweight(exerciseId)) {
    return {
      external_load_kg: ext,
      bodyweight_kg_used: null,
      bodyweight_factor: null,
      est_total_load_kg: null,
    };
  }
  const metric = await getLatestBodyMetricBeforeOrOn(date);
  const factor = getExerciseLibrary().bodyweightFactorFor(exerciseId);
  if (!metric) {
    return {
      external_load_kg: ext,
      bodyweight_kg_used: null,
      bodyweight_factor: factor,
      est_total_load_kg: null,
    };
  }
  const total = calcBodyweightTotal(metric.weight_kg, factor, ext);
  return {
    external_load_kg: ext,
    bodyweight_kg_used: metric.weight_kg,
    bodyweight_factor: factor,
    est_total_load_kg: total,
  };
}

/** Format duration between two ISO timestamps → "45 min" or "1h 12m" */
export function formatDuration(startedAt: string | null | undefined, endedAt: string | null | undefined): string {
  if (!startedAt) return "";
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (isNaN(start) || isNaN(end)) return "";
  const diffMin = Math.round((end - start) / 60000);
  if (diffMin < 1) return "< 1 min";
  if (diffMin < 60) return `${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
