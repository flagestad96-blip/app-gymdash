// src/programStore.ts
import { ensureDb, getDb, getSettingAsync, setSettingAsync } from "./db";
import { defaultIncrementFor } from "./exerciseLibrary";
import type { ProgramMode } from "./db";

export type ProgramBlock =
  | { type: "single"; exId: string }
  | { type: "superset"; a: string; b: string };

export type ProgramDay = {
  id: string;
  name: string;
  blocks: ProgramBlock[];
};

export type Program = {
  id: string;
  name: string;
  description?: string;
  days: ProgramDay[];
  createdAt: string;
  updatedAt: string;
};

type ReplacementMap = Record<number, Record<string, string>>;
export type AlternativesMap = Record<number, Record<string, string[]>>;

type ProgramRow = {
  id: string;
  name: string;
  mode: string | null;
  json: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type DayRow = {
  id: string;
  day_index: number;
  name: string;
};

type BlockRow = {
  day_index: number;
  sort_index: number;
  type: string;
  ex_id?: string | null;
  a_id?: string | null;
  b_id?: string | null;
};

function isoNow() {
  return new Date().toISOString();
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const ACTIVE_KEY_NORMAL = "activeProgramId_normal";
const ACTIVE_KEY_BACK = "activeProgramId_back";

export const TEMPLATE_NORMAL_5_ID = "template_normal_5";
export const TEMPLATE_BACK_5_ID = "template_back_5";
export const LEGACY_STANDARD_PROGRAM_ID = "program_standard_v2";
export const LEGACY_BACK_PROGRAM_ID = "program_back_v2";
export const STANDARD_PROGRAM_ID = TEMPLATE_NORMAL_5_ID;
export const BACK_PROGRAM_ID = TEMPLATE_BACK_5_ID;

function createDay(name: string, blocks: ProgramBlock[]): ProgramDay {
  return { id: newId("day"), name, blocks };
}

function baseProgram(name: string, days: ProgramDay[]): Program {
  const now = isoNow();
  return { id: newId("program"), name, days, createdAt: now, updatedAt: now };
}

export const DEFAULT_STANDARD_PROGRAM: Program = {
  id: TEMPLATE_NORMAL_5_ID,
  name: "5-dagers – Normal",
  createdAt: isoNow(),
  updatedAt: isoNow(),
  days: [
    createDay("Dag 1", [
      { type: "single", exId: "bench_press" },
      { type: "single", exId: "lat_pulldown" },
      { type: "single", exId: "overhead_press" },
      { type: "single", exId: "cable_row" },
      { type: "superset", a: "triceps_pushdown", b: "db_curl" },
    ]),
    createDay("Dag 2", [
      { type: "single", exId: "leg_press" },
      { type: "single", exId: "lying_leg_curl" },
      { type: "single", exId: "leg_extension" },
      { type: "single", exId: "standing_calf_raise" },
      { type: "single", exId: "cable_crunch" },
    ]),
    createDay("Dag 3", [
      { type: "single", exId: "incline_db_press" },
      { type: "single", exId: "chest_supported_row" },
      { type: "single", exId: "lateral_raise" },
      { type: "single", exId: "face_pull" },
      { type: "superset", a: "overhead_triceps_ext", b: "hammer_curl" },
    ]),
    createDay("Dag 4", [
      { type: "single", exId: "hack_squat" },
      { type: "single", exId: "seated_leg_curl" },
      { type: "single", exId: "hip_thrust_machine" },
      { type: "single", exId: "seated_calf_raise" },
      { type: "single", exId: "plank" },
    ]),
    createDay("Dag 5", [
      { type: "single", exId: "machine_chest_press" },
      { type: "single", exId: "one_arm_db_row" },
      { type: "single", exId: "rear_delt_fly" },
      { type: "superset", a: "cable_fly", b: "cable_curl" },
      { type: "single", exId: "skullcrushers" },
    ]),
  ],
};

export const DEFAULT_BACK_PROGRAM: Program = {
  id: TEMPLATE_BACK_5_ID,
  name: "5-dagers – Ryggvennlig",
  createdAt: isoNow(),
  updatedAt: isoNow(),
  days: [
    createDay("Dag 1", [
      { type: "single", exId: "machine_chest_press" },
      { type: "single", exId: "lat_pulldown" },
      { type: "single", exId: "lateral_raise" },
      { type: "single", exId: "cable_row" },
      { type: "superset", a: "triceps_pushdown", b: "db_curl" },
    ]),
    createDay("Dag 2", [
      { type: "single", exId: "leg_press" },
      { type: "single", exId: "seated_leg_curl" },
      { type: "single", exId: "leg_extension" },
      { type: "single", exId: "seated_calf_raise" },
      { type: "single", exId: "cable_crunch" },
    ]),
    createDay("Dag 3", [
      { type: "single", exId: "incline_db_press" },
      { type: "single", exId: "chest_supported_row" },
      { type: "single", exId: "rear_delt_fly" },
      { type: "single", exId: "face_pull" },
      { type: "superset", a: "overhead_triceps_ext", b: "hammer_curl" },
    ]),
    createDay("Dag 4", [
      { type: "single", exId: "leg_press" },
      { type: "single", exId: "lying_leg_curl" },
      { type: "single", exId: "hip_thrust_machine" },
      { type: "single", exId: "seated_calf_raise" },
      { type: "single", exId: "plank" },
    ]),
    createDay("Dag 5", [
      { type: "single", exId: "machine_chest_press" },
      { type: "single", exId: "one_arm_db_row" },
      { type: "single", exId: "cable_fly" },
      { type: "superset", a: "skullcrushers", b: "cable_curl" },
      { type: "single", exId: "lateral_raise" },
    ]),
  ],
};

export const PPL5_BRYSTFOKUS_ID = "ppl5_brystfokus_v1";

const PPL5_BRYSTFOKUS_DESCRIPTION =
  "PROGRESJON:\n" +
  "- Start midt i repområdet. Når du treffer øvre reps → øk 2,5–5 kg.\n" +
  "- Store løft: RPE ca 8. Maskiner kan kjøres nær failure.\n\n" +
  "PAUSER:\n" +
  "- Store løft: 2–3 min.\n" +
  "- Isolasjon: 60–90 sek.\n\n" +
  "RESTITUSJON:\n" +
  "- Deload hver 6–10 uke ved behov.";

export const PPL5_BRYSTFOKUS_PROGRAM: Program = {
  id: PPL5_BRYSTFOKUS_ID,
  name: "PPL 5-dagers (Brystfokus)",
  description: PPL5_BRYSTFOKUS_DESCRIPTION,
  createdAt: isoNow(),
  updatedAt: isoNow(),
  days: [
    createDay("Dag 1 – Push (Brystfokus)", [
      { type: "single", exId: "bench_press" },
      { type: "single", exId: "incline_db_press" },
      { type: "single", exId: "pec_deck" },
      { type: "single", exId: "db_shoulder_press" },
      { type: "single", exId: "lateral_raise" },
      { type: "single", exId: "triceps_pushdown" },
      { type: "single", exId: "overhead_triceps_ext" },
    ]),
    createDay("Dag 2 – Pull (Rygg & Bakside skulder)", [
      { type: "single", exId: "back_extension" },
      { type: "single", exId: "pull_up" },
      { type: "single", exId: "cable_row" },
      { type: "single", exId: "face_pull" },
      { type: "single", exId: "rear_delt_fly" },
      { type: "single", exId: "ez_bar_curl" },
      { type: "single", exId: "hammer_curl" },
    ]),
    createDay("Dag 3 – Bein", [
      { type: "single", exId: "back_squat" },
      { type: "single", exId: "bulgarian_split_squat" },
      { type: "single", exId: "leg_press" },
      { type: "single", exId: "hip_thrust_barbell" },
      { type: "single", exId: "lying_leg_curl" },
      { type: "single", exId: "leg_extension" },
      { type: "single", exId: "standing_calf_raise" },
    ]),
    createDay("Dag 4 – Skuldre + Armer", [
      { type: "single", exId: "overhead_press" },
      { type: "single", exId: "lateral_raise" },
      { type: "single", exId: "rear_delt_fly" },
      { type: "single", exId: "dip" },
      { type: "single", exId: "rope_pushdown" },
      { type: "single", exId: "ez_bar_curl" },
      { type: "single", exId: "preacher_curl" },
    ]),
    createDay("Dag 5 – Full body / Weak points", [
      { type: "single", exId: "incline_db_press" },
      { type: "single", exId: "pull_up" },
      { type: "single", exId: "one_arm_db_row" },
      { type: "single", exId: "hip_thrust_barbell" },
      { type: "single", exId: "leg_press" },
      { type: "single", exId: "lateral_raise" },
      { type: "single", exId: "cable_curl" },
    ]),
  ],
};

const PPL5_BRYSTFOKUS_ALTERNATIVES: AlternativesMap = {
  1: {
    back_extension: ["deadlift", "rack_pull"],
    pull_up: ["lat_pulldown"],
    cable_row: ["barbell_row", "t_bar_row"],
  },
  3: {
    dip: ["close_grip_bench"],
  },
  4: {
    incline_db_press: ["flat_db_press"],
    pull_up: ["lat_pulldown"],
    hip_thrust_barbell: ["romanian_deadlift"],
    leg_press: ["hack_squat", "walking_lunge"],
    cable_curl: ["cable_fly", "triceps_pushdown", "cable_row"],
  },
};

const PPL5_BRYSTFOKUS_TARGETS: Record<
  string,
  { repMin: number; repMax: number; targetSets: number }
> = {
  bench_press: { repMin: 5, repMax: 8, targetSets: 4 },
  incline_db_press: { repMin: 8, repMax: 12, targetSets: 4 },
  pec_deck: { repMin: 10, repMax: 15, targetSets: 3 },
  db_shoulder_press: { repMin: 8, repMax: 12, targetSets: 3 },
  lateral_raise: { repMin: 12, repMax: 15, targetSets: 4 },
  triceps_pushdown: { repMin: 10, repMax: 12, targetSets: 4 },
  overhead_triceps_ext: { repMin: 10, repMax: 12, targetSets: 3 },
  back_extension: { repMin: 3, repMax: 6, targetSets: 4 },
  pull_up: { repMin: 8, repMax: 12, targetSets: 4 },
  cable_row: { repMin: 8, repMax: 12, targetSets: 4 },
  face_pull: { repMin: 12, repMax: 15, targetSets: 4 },
  rear_delt_fly: { repMin: 12, repMax: 15, targetSets: 3 },
  ez_bar_curl: { repMin: 8, repMax: 12, targetSets: 4 },
  hammer_curl: { repMin: 10, repMax: 12, targetSets: 3 },
  back_squat: { repMin: 5, repMax: 8, targetSets: 4 },
  bulgarian_split_squat: { repMin: 8, repMax: 12, targetSets: 3 },
  leg_press: { repMin: 10, repMax: 15, targetSets: 4 },
  hip_thrust_barbell: { repMin: 6, repMax: 10, targetSets: 4 },
  lying_leg_curl: { repMin: 10, repMax: 15, targetSets: 3 },
  leg_extension: { repMin: 12, repMax: 15, targetSets: 3 },
  standing_calf_raise: { repMin: 12, repMax: 20, targetSets: 4 },
  overhead_press: { repMin: 6, repMax: 10, targetSets: 4 },
  dip: { repMin: 6, repMax: 10, targetSets: 4 },
  rope_pushdown: { repMin: 10, repMax: 12, targetSets: 3 },
  preacher_curl: { repMin: 10, repMax: 12, targetSets: 3 },
  one_arm_db_row: { repMin: 10, repMax: 12, targetSets: 3 },
  romanian_deadlift: { repMin: 8, repMax: 12, targetSets: 3 },
  hack_squat: { repMin: 10, repMax: 12, targetSets: 3 },
  walking_lunge: { repMin: 10, repMax: 12, targetSets: 3 },
  cable_curl: { repMin: 12, repMax: 15, targetSets: 3 },
  cable_fly: { repMin: 10, repMax: 15, targetSets: 3 },
  close_grip_bench: { repMin: 6, repMax: 10, targetSets: 4 },
  flat_db_press: { repMin: 8, repMax: 12, targetSets: 4 },
  lat_pulldown: { repMin: 8, repMax: 12, targetSets: 4 },
};

async function seedProgramAlternativesIfMissing(programId: string, alts: AlternativesMap) {
  const count = await getDb().getFirstAsync<{ c: number }>(
    `SELECT COUNT(1) as c FROM program_exercise_alternatives WHERE program_id = ?`,
    [programId]
  );
  if ((count?.c ?? 0) > 0) return;
  for (const [dayIndexRaw, map] of Object.entries(alts)) {
    const dayIndex = Number(dayIndexRaw);
    for (const [exerciseId, alternatives] of Object.entries(map)) {
      for (let i = 0; i < alternatives.length; i += 1) {
        const altId = alternatives[i];
        await getDb().runAsync(
          `INSERT INTO program_exercise_alternatives(id, program_id, day_index, exercise_id, alt_exercise_id, sort_index)
           VALUES(?, ?, ?, ?, ?, ?)`,
          [newId("alt"), programId, dayIndex, exerciseId, altId, i]
        );
      }
    }
  }
}

async function seedProgramTargetsIfMissing(
  programId: string,
  targets: Record<string, { repMin: number; repMax: number; targetSets: number }>
) {
  const count = await getDb().getFirstAsync<{ c: number }>(
    `SELECT COUNT(1) as c FROM exercise_targets WHERE program_id = ?`,
    [programId]
  );
  if ((count?.c ?? 0) > 0) return;
  const now = isoNow();
  for (const [exerciseId, t] of Object.entries(targets)) {
    const incRaw = defaultIncrementFor(exerciseId);
    const incrementKg = incRaw > 0 ? incRaw : 2.5;
    await getDb().runAsync(
      `INSERT OR IGNORE INTO exercise_targets(id, program_id, exercise_id, rep_min, rep_max, target_sets, increment_kg, updated_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `target_${programId}_${exerciseId}`,
        programId,
        exerciseId,
        t.repMin,
        t.repMax,
        t.targetSets,
        incrementKg,
        now,
      ]
    );
  }
}

function normalizeProgram(raw: Program): Program {
  const createdAt = raw.createdAt ?? isoNow();
  const updatedAt = raw.updatedAt ?? createdAt;
  const days = (raw.days ?? []).map((d: any, idx: number) => ({
    id: d.id ?? newId("day"),
    name: d.name ?? `Dag ${idx + 1}`,
    blocks: (d.blocks ?? []).map((b: any) => {
      if (b.type === "single") {
        const exId = b.exId ?? b.ex;
        return { type: "single", exId: String(exId) } as ProgramBlock;
      }
      if (b.type === "superset") {
        return { type: "superset", a: String(b.a), b: String(b.b) } as ProgramBlock;
      }
      return b as ProgramBlock;
    }),
  }));
  return { ...raw, createdAt, updatedAt, days };
}

function serializeProgram(program: Program): string {
  return JSON.stringify(program);
}

async function insertDefaultIfMissing(mode: ProgramMode, program: Program) {
  await getDb().runAsync(
    `INSERT OR IGNORE INTO programs(id, name, mode, json, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?)`,
    [program.id, program.name, mode, serializeProgram(program), program.createdAt, program.updatedAt]
  );
}

async function migrateActiveKeys() {
  const oldNormal = await getSettingAsync("activeProgramIdNormal");
  const oldBack = await getSettingAsync("activeProgramIdBack");
  const currentNormal = await getSettingAsync(ACTIVE_KEY_NORMAL);
  const currentBack = await getSettingAsync(ACTIVE_KEY_BACK);

  if (!currentNormal && oldNormal) {
    await setSettingAsync(ACTIVE_KEY_NORMAL, oldNormal);
  }
  if (!currentBack && oldBack) {
    await setSettingAsync(ACTIVE_KEY_BACK, oldBack);
  }
}

async function migrateProgramModes() {
  try {
    await getDb().runAsync(
      `UPDATE programs SET mode = 'normal' WHERE mode IS NULL AND id = ?`,
      [TEMPLATE_NORMAL_5_ID]
    );
    await getDb().runAsync(
      `UPDATE programs SET mode = 'normal' WHERE mode IS NULL AND id = ?`,
      ["program_standard_v1"]
    );
    await getDb().runAsync(
      `UPDATE programs SET mode = 'back' WHERE mode IS NULL AND id = ?`,
      [TEMPLATE_BACK_5_ID]
    );
    await getDb().runAsync(
      `UPDATE programs SET mode = 'back' WHERE mode IS NULL AND id = ?`,
      ["program_back_v1"]
    );
    await getDb().runAsync(
      `UPDATE programs SET mode = 'normal' WHERE mode IS NULL AND id = ?`,
      [LEGACY_STANDARD_PROGRAM_ID]
    );
    await getDb().runAsync(
      `UPDATE programs SET mode = 'back' WHERE mode IS NULL AND id = ?`,
      [LEGACY_BACK_PROGRAM_ID]
    );
  } catch {
    // column may not exist yet
  }
}

async function renameLegacyPrograms() {
  try {
    await getDb().runAsync(
      `UPDATE programs
       SET name = '4-dagers – Legacy'
       WHERE id = ? AND name IN ('Standard 5-dagers (v1)', 'Standard 5 dager (v1)')`,
      ["program_standard_v1"]
    );
  } catch {
    // ignore
  }
}

async function writeProgramTables(program: Program): Promise<void> {
  const database = getDb();
  await database.runAsync(`DELETE FROM program_days WHERE program_id = ?`, [program.id]);
  await database.runAsync(`DELETE FROM program_day_exercises WHERE program_id = ?`, [program.id]);

  for (let di = 0; di < program.days.length; di += 1) {
    const day = program.days[di];
    const dayId = day.id || newId("day");
    await database.runAsync(
      `INSERT INTO program_days(id, program_id, day_index, name)
       VALUES(?, ?, ?, ?)` ,
      [dayId, program.id, di, day.name || `Dag ${di + 1}`]
    );
    for (let bi = 0; bi < day.blocks.length; bi += 1) {
      const block = day.blocks[bi];
      if (block.type === "single") {
        await database.runAsync(
          `INSERT INTO program_day_exercises(id, program_id, day_index, sort_index, type, ex_id, a_id, b_id)
           VALUES(?, ?, ?, ?, ?, ?, NULL, NULL)`,
          [newId("pde"), program.id, di, bi, "single", block.exId]
        );
      } else {
        await database.runAsync(
          `INSERT INTO program_day_exercises(id, program_id, day_index, sort_index, type, ex_id, a_id, b_id)
           VALUES(?, ?, ?, ?, ?, NULL, ?, ?)`,
          [newId("pde"), program.id, di, bi, "superset", block.a, block.b]
        );
      }
    }
  }
}

async function loadProgramFromTables(programId: string, row?: ProgramRow): Promise<Program | null> {
  const database = getDb();
  const programRow = row ?? (await database.getFirstAsync<ProgramRow>(
    `SELECT id, name, mode, json, created_at, updated_at FROM programs WHERE id = ? LIMIT 1`,
    [programId]
  ));
  if (!programRow) return null;

  const dayRows = await database.getAllAsync<DayRow>(
    `SELECT id, day_index, name FROM program_days WHERE program_id = ? ORDER BY day_index ASC`,
    [programId]
  );
  if (!dayRows || dayRows.length === 0) return null;

  const blockRows = await database.getAllAsync<BlockRow>(
    `SELECT day_index, sort_index, type, ex_id, a_id, b_id
     FROM program_day_exercises
     WHERE program_id = ?
     ORDER BY day_index ASC, sort_index ASC`,
    [programId]
  );

  const blocksByDay: Record<number, ProgramBlock[]> = {};
  for (const rowBlock of blockRows ?? []) {
    const di = rowBlock.day_index ?? 0;
    if (!blocksByDay[di]) blocksByDay[di] = [];
    if (rowBlock.type === "single") {
      if (rowBlock.ex_id) blocksByDay[di].push({ type: "single", exId: String(rowBlock.ex_id) });
    } else {
      if (rowBlock.a_id && rowBlock.b_id) {
        blocksByDay[di].push({ type: "superset", a: String(rowBlock.a_id), b: String(rowBlock.b_id) });
      }
    }
  }

  const days: ProgramDay[] = dayRows
    .sort((a, b) => (a.day_index ?? 0) - (b.day_index ?? 0))
    .map((d) => ({
      id: d.id,
      name: d.name,
      blocks: blocksByDay[d.day_index ?? 0] ?? [],
    }));

  return {
    id: programRow.id,
    name: programRow.name,
    days,
    createdAt: programRow.created_at ?? isoNow(),
    updatedAt: programRow.updated_at ?? programRow.created_at ?? isoNow(),
  };
}

async function ensureProgramTablesFromJson(row: ProgramRow): Promise<void> {
  if (!row.json) return;
  try {
    const parsed = JSON.parse(row.json) as Program;
    const normalized = normalizeProgram({ ...parsed, id: row.id, name: row.name });
    await writeProgramTables(normalized);
  } catch {
    // ignore invalid json
  }
}

async function ensureProgramTablesForAll(): Promise<void> {
  const rows = await getDb().getAllAsync<ProgramRow>(
    `SELECT id, name, mode, json, created_at, updated_at FROM programs`
  );
  for (const row of rows ?? []) {
    const countRow = await getDb().getFirstAsync<{ c: number }>(
      `SELECT COUNT(1) as c FROM program_days WHERE program_id = ?`,
      [row.id]
    );
    if ((countRow?.c ?? 0) > 0) continue;

    if (row.json) {
      await ensureProgramTablesFromJson(row);
      continue;
    }

    if (row.id === STANDARD_PROGRAM_ID) {
      await writeProgramTables(DEFAULT_STANDARD_PROGRAM);
    } else if (row.id === BACK_PROGRAM_ID) {
      await writeProgramTables(DEFAULT_BACK_PROGRAM);
    } else {
      const fallback = createBlankProgram(row.name || "Program", 5);
      await writeProgramTables({ ...fallback, id: row.id, name: row.name || fallback.name });
    }
  }
}

export async function ensurePrograms() {
  await ensureDb();
  await migrateActiveKeys();
  await migrateProgramModes();
  await renameLegacyPrograms();

  await insertDefaultIfMissing("normal", DEFAULT_STANDARD_PROGRAM);
  await insertDefaultIfMissing("back", DEFAULT_BACK_PROGRAM);
  await insertDefaultIfMissing("normal", PPL5_BRYSTFOKUS_PROGRAM);

  await seedProgramAlternativesIfMissing(PPL5_BRYSTFOKUS_ID, PPL5_BRYSTFOKUS_ALTERNATIVES);
  await seedProgramTargetsIfMissing(PPL5_BRYSTFOKUS_ID, PPL5_BRYSTFOKUS_TARGETS);

  await ensureProgramTablesForAll();

  const activeNormal = await getSettingAsync(ACTIVE_KEY_NORMAL);
  if (!activeNormal) await setSettingAsync(ACTIVE_KEY_NORMAL, DEFAULT_STANDARD_PROGRAM.id);

  const activeBack = await getSettingAsync(ACTIVE_KEY_BACK);
  if (!activeBack) await setSettingAsync(ACTIVE_KEY_BACK, DEFAULT_BACK_PROGRAM.id);
}

export async function listPrograms(mode: ProgramMode): Promise<Program[]> {
  await ensurePrograms();
  const rows = await getDb().getAllAsync<ProgramRow>(
    `SELECT id, name, mode, json, created_at, updated_at FROM programs
     WHERE mode = ? OR mode IS NULL
     ORDER BY updated_at DESC, created_at DESC`,
    [mode]
  );

  const programs: Program[] = [];
  for (const row of rows ?? []) {
    const loaded = await loadProgramFromTables(row.id, row);
    if (loaded) {
      programs.push(loaded);
      continue;
    }
    if (row.json) {
      try {
        programs.push(normalizeProgram(JSON.parse(row.json) as Program));
      } catch {
        // skip invalid
      }
    }
  }
  return programs;
}

export async function getProgram(programId: string): Promise<Program | null> {
  await ensureDb();
  const row = await getDb().getFirstAsync<ProgramRow>(
    `SELECT id, name, mode, json, created_at, updated_at FROM programs WHERE id = ? LIMIT 1`,
    [programId]
  );
  if (!row) return null;

  const fromTables = await loadProgramFromTables(programId, row);
  if (fromTables) return fromTables;

  if (row.json) {
    try {
      const parsed = normalizeProgram(JSON.parse(row.json) as Program);
      await writeProgramTables(parsed);
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

export async function saveProgram(mode: ProgramMode, program: Program): Promise<void> {
  await ensureDb();
  const now = isoNow();
  const nextDays = (program.days ?? []).map((d, idx) => ({
    id: d.id ?? newId("day"),
    name: d.name ?? `Dag ${idx + 1}`,
    blocks: d.blocks ?? [],
  }));
  const next: Program = {
    ...program,
    days: nextDays,
    createdAt: program.createdAt ?? now,
    updatedAt: now,
  };
  await getDb().runAsync(
    `INSERT INTO programs(id, name, mode, json, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, mode=excluded.mode, json=excluded.json, updated_at=excluded.updated_at`,
    [next.id, next.name, mode, serializeProgram(next), next.createdAt, next.updatedAt]
  );
  await writeProgramTables(next);
}

export async function deleteProgram(programId: string): Promise<void> {
  await ensureDb();
  await getDb().runAsync(`DELETE FROM programs WHERE id = ?`, [programId]);
  await getDb().runAsync(`DELETE FROM program_days WHERE program_id = ?`, [programId]);
  await getDb().runAsync(`DELETE FROM program_day_exercises WHERE program_id = ?`, [programId]);
  await getDb().runAsync(`DELETE FROM program_exercise_alternatives WHERE program_id = ?`, [programId]);
  await getDb().runAsync(`DELETE FROM program_replacements WHERE program_id = ?`, [programId]);
  await getDb().runAsync(`DELETE FROM exercise_targets WHERE program_id = ?`, [programId]);
}

export async function getActiveProgramIdForMode(mode: ProgramMode): Promise<string> {
  const key = mode === "back" ? ACTIVE_KEY_BACK : ACTIVE_KEY_NORMAL;
  const value = await getSettingAsync(key);
  if (value) return value;
  return mode === "back" ? BACK_PROGRAM_ID : STANDARD_PROGRAM_ID;
}

export async function setActiveProgram(mode: ProgramMode, programId: string): Promise<void> {
  const key = mode === "back" ? ACTIVE_KEY_BACK : ACTIVE_KEY_NORMAL;
  await setSettingAsync(key, programId);
}

export async function getActiveProgram(mode: ProgramMode): Promise<Program> {
  const id = await getActiveProgramIdForMode(mode);
  return (await getProgram(id)) ?? (mode === "back" ? DEFAULT_BACK_PROGRAM : DEFAULT_STANDARD_PROGRAM);
}

export async function applyReplacements(
  programId: string,
  dayIndex: number,
  blocks: ProgramBlock[]
): Promise<ProgramBlock[]> {
  const rows = await getDb().getAllAsync<{
    original_ex_id: string;
    replaced_ex_id: string;
  }>(
    `SELECT original_ex_id, replaced_ex_id
     FROM program_replacements
     WHERE program_id = ? AND day_index = ?`,
    [programId, dayIndex]
  );
  const map = new Map<string, string>();
  for (const r of rows ?? []) map.set(r.original_ex_id, r.replaced_ex_id);

  return blocks.map((b) => {
    if (b.type === "single") {
      return { type: "single", exId: map.get(b.exId) ?? b.exId };
    }
    return {
      type: "superset",
      a: map.get(b.a) ?? b.a,
      b: map.get(b.b) ?? b.b,
    };
  });
}

export async function getReplacementsForProgram(programId: string): Promise<ReplacementMap> {
  await ensureDb();
  const rows = await getDb().getAllAsync<{
    day_index: number;
    original_ex_id: string;
    replaced_ex_id: string;
  }>(
    `SELECT day_index, original_ex_id, replaced_ex_id
     FROM program_replacements
     WHERE program_id = ?`,
    [programId]
  );

  const map: ReplacementMap = {};
  for (const r of rows ?? []) {
    const di = r.day_index ?? 0;
    if (!map[di]) map[di] = {};
    map[di][r.original_ex_id] = r.replaced_ex_id;
  }
  return map;
}

export async function setReplacement(args: {
  programId: string;
  dayIndex: number;
  originalExId: string;
  replacedExId: string;
}): Promise<void> {
  await ensureDb();
  const id = newId("repl");
  const now = isoNow();
  await getDb().runAsync(
    `INSERT INTO program_replacements(id, program_id, day_index, original_ex_id, replaced_ex_id, updated_at)
     VALUES(?, ?, ?, ?, ?, ?)
     ON CONFLICT(program_id, day_index, original_ex_id)
     DO UPDATE SET replaced_ex_id=excluded.replaced_ex_id, updated_at=excluded.updated_at`,
    [id, args.programId, args.dayIndex, args.originalExId, args.replacedExId, now]
  );
}

export async function clearReplacement(args: {
  programId: string;
  dayIndex: number;
  originalExId: string;
}): Promise<void> {
  await ensureDb();
  await getDb().runAsync(
    `DELETE FROM program_replacements WHERE program_id = ? AND day_index = ? AND original_ex_id = ?`,
    [args.programId, args.dayIndex, args.originalExId]
  );
}

export async function getAlternativesForProgram(programId: string): Promise<AlternativesMap> {
  await ensureDb();
  const rows = await getDb().getAllAsync<{
    day_index: number;
    exercise_id: string;
    alt_exercise_id: string;
    sort_index: number;
  }>(
    `SELECT day_index, exercise_id, alt_exercise_id, sort_index
     FROM program_exercise_alternatives
     WHERE program_id = ?
     ORDER BY day_index ASC, sort_index ASC`,
    [programId]
  );

  const map: AlternativesMap = {};
  for (const r of rows ?? []) {
    const di = r.day_index ?? 0;
    if (!map[di]) map[di] = {};
    if (!map[di][r.exercise_id]) map[di][r.exercise_id] = [];
    map[di][r.exercise_id].push(r.alt_exercise_id);
  }
  return map;
}

export async function setAlternatives(args: {
  programId: string;
  dayIndex: number;
  exerciseId: string;
  alternatives: string[];
}): Promise<void> {
  await ensureDb();
  const database = getDb();
  await database.runAsync(
    `DELETE FROM program_exercise_alternatives WHERE program_id = ? AND day_index = ? AND exercise_id = ?`,
    [args.programId, args.dayIndex, args.exerciseId]
  );
  for (let i = 0; i < args.alternatives.length; i += 1) {
    const altId = args.alternatives[i];
    await database.runAsync(
      `INSERT INTO program_exercise_alternatives(id, program_id, day_index, exercise_id, alt_exercise_id, sort_index)
       VALUES(?, ?, ?, ?, ?, ?)`,
      [newId("alt"), args.programId, args.dayIndex, args.exerciseId, altId, i]
    );
  }
}

export function createBlankProgram(name: string, daysCount = 5): Program {
  const days: ProgramDay[] = [];
  const count = Math.max(1, daysCount);
  for (let i = 0; i < count; i += 1) {
    days.push(createDay(`Dag ${i + 1}`, []));
  }
  return baseProgram(name, days);
}

export function cloneProgram(program: Program, name: string): Program {
  const now = isoNow();
  return {
    ...program,
    id: newId("program"),
    name,
    createdAt: now,
    updatedAt: now,
    days: program.days.map((d, idx) => ({
      id: newId("day"),
      name: d.name || `Dag ${idx + 1}`,
      blocks: d.blocks.map((b) => ({ ...b })),
    })),
  };
}

const ProgramStore = {
  ensurePrograms,
  listPrograms,
  getProgram,
  saveProgram,
  deleteProgram,
  getActiveProgramIdForMode,
  setActiveProgram,
  getActiveProgram,
  applyReplacements,
  getReplacementsForProgram,
  setReplacement,
  clearReplacement,
  getAlternativesForProgram,
  setAlternatives,
  createBlankProgram,
  cloneProgram,
  DEFAULT_STANDARD_PROGRAM,
  DEFAULT_BACK_PROGRAM,
  STANDARD_PROGRAM_ID,
  BACK_PROGRAM_ID,
  LEGACY_STANDARD_PROGRAM_ID,
  LEGACY_BACK_PROGRAM_ID,
  TEMPLATE_NORMAL_5_ID,
  TEMPLATE_BACK_5_ID,
};

export default ProgramStore;
