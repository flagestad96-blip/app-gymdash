// src/programStore.ts
import { ensureDb, getDb, getSettingAsync, setSettingAsync } from "./db";
import { defaultIncrementFor } from "./exerciseLibrary";
import type { ProgramMode } from "./db";
import { uid, isoNow } from "./storage";

export type ProgramBlock =
  | { type: "single"; exId: string }
  | { type: "superset"; a: string; b: string; c?: string };

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
  c_id?: string | null;
};

const ACTIVE_KEY_NORMAL = "activeProgramId_normal";
const ACTIVE_KEY_BACK = "activeProgramId_back";

export const TEMPLATE_NORMAL_5_ID = "template_normal_5";
export const TEMPLATE_BACK_5_ID = "template_back_5";
export const LEGACY_STANDARD_PROGRAM_ID = "program_standard_v2";
export const LEGACY_BACK_PROGRAM_ID = "program_back_v2";
export const STANDARD_PROGRAM_ID = TEMPLATE_NORMAL_5_ID;
export const BACK_PROGRAM_ID = TEMPLATE_BACK_5_ID;

function createDay(name: string, blocks: ProgramBlock[]): ProgramDay {
  return { id: uid("day"), name, blocks };
}

function baseProgram(name: string, days: ProgramDay[]): Program {
  const now = isoNow();
  return { id: uid("program"), name, days, createdAt: now, updatedAt: now };
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

// Renamed from "PPL 5-dagers (Brystfokus)" (ensurePrograms migrates old installs).
export const PPL5_BRYSTFOKUS_LEGACY_NAME = "PPL 5-dagers (Brystfokus)";

export const PPL5_BRYSTFOKUS_PROGRAM: Program = {
  id: PPL5_BRYSTFOKUS_ID,
  name: "Marius sin muskeloppskrift",
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

// ── Flere ferdige programmer (ulike mål) ───────────────────────────────────

export const NYBEGYNNER3_ID = "nybegynner3_fullkropp_v1";

const NYBEGYNNER3_DESCRIPTION =
  "FOR DEG SOM ER NY:\n" +
  "- 3 økter i uka med en hviledag mellom.\n" +
  "- Lær teknikken først — vekten kommer av seg selv.\n" +
  "- Stopp 2–3 reps før utmattelse (RPE 7–8).\n\n" +
  "PROGRESJON:\n" +
  "- Treffer du øvre reps på alle sett → øk litt neste gang.\n\n" +
  "PAUSER:\n" +
  "- 1,5–2 min mellom settene.";

export const NYBEGYNNER3_PROGRAM: Program = {
  id: NYBEGYNNER3_ID,
  name: "Nybegynner 3-dagers (Fullkropp)",
  description: NYBEGYNNER3_DESCRIPTION,
  createdAt: isoNow(),
  updatedAt: isoNow(),
  days: [
    createDay("Dag 1 – Fullkropp A", [
      { type: "single", exId: "leg_press" },
      { type: "single", exId: "machine_chest_press" },
      { type: "single", exId: "lat_pulldown" },
      { type: "single", exId: "lateral_raise" },
      { type: "single", exId: "plank" },
    ]),
    createDay("Dag 2 – Fullkropp B", [
      { type: "single", exId: "goblet_squat" },
      { type: "single", exId: "db_shoulder_press" },
      { type: "single", exId: "cable_row" },
      { type: "single", exId: "lying_leg_curl" },
      { type: "single", exId: "cable_crunch" },
    ]),
    createDay("Dag 3 – Fullkropp C", [
      { type: "single", exId: "leg_extension" },
      { type: "single", exId: "flat_db_press" },
      { type: "single", exId: "machine_row" },
      { type: "single", exId: "face_pull" },
      { type: "superset", a: "db_curl", b: "triceps_pushdown" },
    ]),
  ],
};

const NYBEGYNNER3_ALTERNATIVES: AlternativesMap = {
  0: {
    leg_press: ["goblet_squat", "hack_squat"],
    machine_chest_press: ["flat_db_press", "push_up"],
  },
  1: {
    goblet_squat: ["leg_press"],
    cable_row: ["machine_row", "lat_pulldown"],
  },
};

const NYBEGYNNER3_TARGETS: Record<
  string,
  { repMin: number; repMax: number; targetSets: number }
> = {
  leg_press: { repMin: 10, repMax: 15, targetSets: 3 },
  machine_chest_press: { repMin: 8, repMax: 12, targetSets: 3 },
  lat_pulldown: { repMin: 8, repMax: 12, targetSets: 3 },
  lateral_raise: { repMin: 12, repMax: 15, targetSets: 2 },
  plank: { repMin: 1, repMax: 1, targetSets: 3 },
  goblet_squat: { repMin: 8, repMax: 12, targetSets: 3 },
  db_shoulder_press: { repMin: 8, repMax: 12, targetSets: 3 },
  cable_row: { repMin: 8, repMax: 12, targetSets: 3 },
  lying_leg_curl: { repMin: 10, repMax: 15, targetSets: 3 },
  cable_crunch: { repMin: 10, repMax: 15, targetSets: 3 },
  leg_extension: { repMin: 12, repMax: 15, targetSets: 3 },
  flat_db_press: { repMin: 8, repMax: 12, targetSets: 3 },
  machine_row: { repMin: 8, repMax: 12, targetSets: 3 },
  face_pull: { repMin: 12, repMax: 15, targetSets: 2 },
  db_curl: { repMin: 10, repMax: 12, targetSets: 2 },
  triceps_pushdown: { repMin: 10, repMax: 12, targetSets: 2 },
};

export const STYRKE4_ID = "styrke4_ou_v1";

const STYRKE4_DESCRIPTION =
  "STYRKEFOKUS:\n" +
  "- Baseløftene (knebøy, benk, markløft, press) kjøres tungt: 3–5 reps, RPE 8.\n" +
  "- Assistanse støtter baseløftene: 6–10 reps.\n\n" +
  "PROGRESJON:\n" +
  "- Klarer du alle sett på øvre reps → øk 2,5 kg (overkropp) / 5 kg (underkropp).\n\n" +
  "PAUSER:\n" +
  "- Baseløft: 3–5 min. Assistanse: 2 min.\n\n" +
  "RESTITUSJON:\n" +
  "- Deload hver 5–8 uke: samme øvelser, −20 % vekt.";

export const STYRKE4_PROGRAM: Program = {
  id: STYRKE4_ID,
  name: "Styrke 4-dagers (Over/Under)",
  description: STYRKE4_DESCRIPTION,
  createdAt: isoNow(),
  updatedAt: isoNow(),
  days: [
    createDay("Dag 1 – Underkropp A", [
      { type: "single", exId: "back_squat" },
      { type: "single", exId: "romanian_deadlift" },
      { type: "single", exId: "leg_press" },
      { type: "single", exId: "standing_calf_raise" },
      { type: "single", exId: "plank" },
    ]),
    createDay("Dag 2 – Overkropp A", [
      { type: "single", exId: "bench_press" },
      { type: "single", exId: "barbell_row" },
      { type: "single", exId: "overhead_press" },
      { type: "single", exId: "lat_pulldown" },
      { type: "superset", a: "triceps_pushdown", b: "db_curl" },
    ]),
    createDay("Dag 3 – Underkropp B", [
      { type: "single", exId: "deadlift" },
      { type: "single", exId: "front_squat" },
      { type: "single", exId: "lying_leg_curl" },
      { type: "single", exId: "cable_crunch" },
    ]),
    createDay("Dag 4 – Overkropp B", [
      { type: "single", exId: "incline_barbell_press" },
      { type: "single", exId: "pull_up" },
      { type: "single", exId: "close_grip_bench" },
      { type: "single", exId: "face_pull" },
      { type: "single", exId: "ez_bar_curl" },
    ]),
  ],
};

const STYRKE4_ALTERNATIVES: AlternativesMap = {
  0: {
    back_squat: ["hack_squat", "leg_press"],
  },
  2: {
    deadlift: ["rack_pull", "romanian_deadlift"],
    front_squat: ["hack_squat", "goblet_squat"],
  },
  3: {
    incline_barbell_press: ["incline_db_press"],
    pull_up: ["lat_pulldown"],
  },
};

const STYRKE4_TARGETS: Record<
  string,
  { repMin: number; repMax: number; targetSets: number }
> = {
  back_squat: { repMin: 3, repMax: 5, targetSets: 4 },
  romanian_deadlift: { repMin: 6, repMax: 8, targetSets: 3 },
  leg_press: { repMin: 8, repMax: 10, targetSets: 3 },
  standing_calf_raise: { repMin: 8, repMax: 12, targetSets: 3 },
  plank: { repMin: 1, repMax: 1, targetSets: 3 },
  bench_press: { repMin: 3, repMax: 5, targetSets: 4 },
  barbell_row: { repMin: 5, repMax: 8, targetSets: 4 },
  overhead_press: { repMin: 6, repMax: 8, targetSets: 3 },
  lat_pulldown: { repMin: 8, repMax: 10, targetSets: 3 },
  triceps_pushdown: { repMin: 8, repMax: 12, targetSets: 2 },
  db_curl: { repMin: 8, repMax: 12, targetSets: 2 },
  deadlift: { repMin: 3, repMax: 5, targetSets: 3 },
  front_squat: { repMin: 5, repMax: 8, targetSets: 3 },
  lying_leg_curl: { repMin: 8, repMax: 10, targetSets: 3 },
  cable_crunch: { repMin: 10, repMax: 15, targetSets: 3 },
  incline_barbell_press: { repMin: 5, repMax: 8, targetSets: 4 },
  pull_up: { repMin: 5, repMax: 8, targetSets: 4 },
  close_grip_bench: { repMin: 6, repMax: 10, targetSets: 3 },
  face_pull: { repMin: 12, repMax: 15, targetSets: 3 },
  ez_bar_curl: { repMin: 8, repMax: 12, targetSets: 3 },
};

export const HYPERTROFI4_ID = "hypertrofi4_ou_v1";

const HYPERTROFI4_DESCRIPTION =
  "MUSKELVEKST:\n" +
  "- 8–15 reps, kontrollert senking, nær utmattelse på siste sett.\n" +
  "- Maskiner og kabler kan kjøres til failure; frivekter stopp ved RPE 8–9.\n\n" +
  "PROGRESJON:\n" +
  "- Flere reps først, så mer vekt når du treffer øvre reps.\n\n" +
  "PAUSER:\n" +
  "- Store løft: 2–3 min. Isolasjon: 60–90 sek.\n\n" +
  "RESTITUSJON:\n" +
  "- Deload hver 6–10 uke ved behov.";

export const HYPERTROFI4_PROGRAM: Program = {
  id: HYPERTROFI4_ID,
  name: "Hypertrofi 4-dagers (Over/Under)",
  description: HYPERTROFI4_DESCRIPTION,
  createdAt: isoNow(),
  updatedAt: isoNow(),
  days: [
    createDay("Dag 1 – Overkropp (Push-fokus)", [
      { type: "single", exId: "incline_db_press" },
      { type: "single", exId: "machine_chest_press" },
      { type: "single", exId: "cable_fly" },
      { type: "single", exId: "lateral_raise" },
      { type: "superset", a: "overhead_triceps_ext", b: "rope_pushdown" },
    ]),
    createDay("Dag 2 – Underkropp (Framside-fokus)", [
      { type: "single", exId: "hack_squat" },
      { type: "single", exId: "leg_press" },
      { type: "single", exId: "bulgarian_split_squat" },
      { type: "single", exId: "leg_extension" },
      { type: "single", exId: "standing_calf_raise" },
      { type: "single", exId: "cable_crunch" },
    ]),
    createDay("Dag 3 – Overkropp (Pull-fokus)", [
      { type: "single", exId: "lat_pulldown" },
      { type: "single", exId: "chest_supported_row" },
      { type: "single", exId: "one_arm_db_row" },
      { type: "superset", a: "rear_delt_fly", b: "face_pull" },
      { type: "superset", a: "ez_bar_curl", b: "hammer_curl" },
    ]),
    createDay("Dag 4 – Underkropp (Bakside-fokus)", [
      { type: "single", exId: "romanian_deadlift" },
      { type: "single", exId: "hip_thrust_barbell" },
      { type: "single", exId: "seated_leg_curl" },
      { type: "single", exId: "walking_lunge" },
      { type: "single", exId: "seated_calf_raise" },
      { type: "single", exId: "plank" },
    ]),
  ],
};

const HYPERTROFI4_ALTERNATIVES: AlternativesMap = {
  0: {
    incline_db_press: ["incline_barbell_press", "flat_db_press"],
    cable_fly: ["pec_deck", "db_fly"],
  },
  1: {
    hack_squat: ["back_squat", "goblet_squat"],
  },
  2: {
    lat_pulldown: ["pull_up"],
    chest_supported_row: ["cable_row", "barbell_row"],
  },
  3: {
    hip_thrust_barbell: ["hip_thrust_machine"],
    walking_lunge: ["reverse_lunge", "bulgarian_split_squat"],
  },
};

const HYPERTROFI4_TARGETS: Record<
  string,
  { repMin: number; repMax: number; targetSets: number }
> = {
  incline_db_press: { repMin: 8, repMax: 12, targetSets: 4 },
  machine_chest_press: { repMin: 10, repMax: 12, targetSets: 3 },
  cable_fly: { repMin: 12, repMax: 15, targetSets: 3 },
  lateral_raise: { repMin: 12, repMax: 15, targetSets: 4 },
  overhead_triceps_ext: { repMin: 10, repMax: 12, targetSets: 3 },
  rope_pushdown: { repMin: 12, repMax: 15, targetSets: 3 },
  hack_squat: { repMin: 8, repMax: 12, targetSets: 4 },
  leg_press: { repMin: 10, repMax: 15, targetSets: 3 },
  bulgarian_split_squat: { repMin: 8, repMax: 12, targetSets: 3 },
  leg_extension: { repMin: 12, repMax: 15, targetSets: 3 },
  standing_calf_raise: { repMin: 12, repMax: 20, targetSets: 4 },
  cable_crunch: { repMin: 10, repMax: 15, targetSets: 3 },
  lat_pulldown: { repMin: 8, repMax: 12, targetSets: 4 },
  chest_supported_row: { repMin: 8, repMax: 12, targetSets: 4 },
  one_arm_db_row: { repMin: 10, repMax: 12, targetSets: 3 },
  rear_delt_fly: { repMin: 12, repMax: 15, targetSets: 3 },
  face_pull: { repMin: 12, repMax: 15, targetSets: 3 },
  ez_bar_curl: { repMin: 8, repMax: 12, targetSets: 3 },
  hammer_curl: { repMin: 10, repMax: 12, targetSets: 3 },
  romanian_deadlift: { repMin: 8, repMax: 12, targetSets: 4 },
  hip_thrust_barbell: { repMin: 6, repMax: 10, targetSets: 4 },
  seated_leg_curl: { repMin: 10, repMax: 15, targetSets: 3 },
  walking_lunge: { repMin: 10, repMax: 12, targetSets: 3 },
  seated_calf_raise: { repMin: 12, repMax: 20, targetSets: 4 },
  plank: { repMin: 1, repMax: 1, targetSets: 3 },
};

export const HJEMME3_ID = "hjemme3_manualer_v1";

const HJEMME3_DESCRIPTION =
  "HJEMMETRENING:\n" +
  "- Alt du trenger er manualer (og helst en benk).\n" +
  "- Justerbare manualer? Sett vekten så øvre reps så vidt ryker.\n\n" +
  "PROGRESJON:\n" +
  "- Flere reps først. Når settene blir lette: tyngre manual,\n" +
  "  saktere senking eller kortere pause.\n\n" +
  "PAUSER:\n" +
  "- 60–120 sek mellom settene.";

export const HJEMME3_PROGRAM: Program = {
  id: HJEMME3_ID,
  name: "Hjemme 3-dagers (Manualer)",
  description: HJEMME3_DESCRIPTION,
  createdAt: isoNow(),
  updatedAt: isoNow(),
  days: [
    createDay("Dag 1 – Press", [
      { type: "single", exId: "flat_db_press" },
      { type: "single", exId: "db_shoulder_press" },
      { type: "single", exId: "db_fly" },
      { type: "single", exId: "lateral_raise" },
      { type: "single", exId: "overhead_db_extension" },
      { type: "single", exId: "push_up" },
    ]),
    createDay("Dag 2 – Bein", [
      { type: "single", exId: "goblet_squat" },
      { type: "single", exId: "bulgarian_split_squat" },
      { type: "single", exId: "single_leg_rdl" },
      { type: "single", exId: "reverse_lunge" },
      { type: "single", exId: "plank" },
    ]),
    createDay("Dag 3 – Rygg & armer", [
      { type: "single", exId: "one_arm_db_row" },
      { type: "single", exId: "db_pullover" },
      { type: "superset", a: "db_curl", b: "overhead_db_extension" },
      { type: "single", exId: "hammer_curl" },
    ]),
  ],
};

const HJEMME3_ALTERNATIVES: AlternativesMap = {
  0: {
    flat_db_press: ["push_up"],
  },
  1: {
    goblet_squat: ["reverse_lunge"],
    bulgarian_split_squat: ["walking_lunge"],
  },
};

const HJEMME3_TARGETS: Record<
  string,
  { repMin: number; repMax: number; targetSets: number }
> = {
  flat_db_press: { repMin: 8, repMax: 12, targetSets: 4 },
  db_shoulder_press: { repMin: 8, repMax: 12, targetSets: 3 },
  db_fly: { repMin: 12, repMax: 15, targetSets: 3 },
  lateral_raise: { repMin: 12, repMax: 15, targetSets: 3 },
  overhead_db_extension: { repMin: 10, repMax: 12, targetSets: 3 },
  push_up: { repMin: 8, repMax: 20, targetSets: 3 },
  goblet_squat: { repMin: 8, repMax: 12, targetSets: 4 },
  bulgarian_split_squat: { repMin: 8, repMax: 12, targetSets: 3 },
  single_leg_rdl: { repMin: 10, repMax: 12, targetSets: 3 },
  reverse_lunge: { repMin: 10, repMax: 12, targetSets: 3 },
  plank: { repMin: 1, repMax: 1, targetSets: 3 },
  one_arm_db_row: { repMin: 8, repMax: 12, targetSets: 4 },
  db_pullover: { repMin: 10, repMax: 15, targetSets: 3 },
  db_curl: { repMin: 8, repMax: 12, targetSets: 3 },
  hammer_curl: { repMin: 10, repMax: 12, targetSets: 3 },
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
          [uid("alt"), programId, dayIndex, exerciseId, altId, i]
        );
      }
    }
  }
}

async function seedProgramTargetsIfMissing(
  program: Program,
  targets: Record<string, { repMin: number; repMax: number; targetSets: number }>
) {
  const count = await getDb().getFirstAsync<{ c: number }>(
    `SELECT COUNT(1) as c FROM exercise_targets WHERE program_id = ?`,
    [program.id]
  );
  if ((count?.c ?? 0) > 0) return;
  const now = isoNow();
  // Seed one row per (day_index, exerciseId) so each day's rep range is independent.
  for (let di = 0; di < program.days.length; di += 1) {
    const day = program.days[di];
    const seenInDay = new Set<string>();
    const exerciseIds: string[] = [];
    for (const block of day.blocks) {
      if (block.type === "single") exerciseIds.push(block.exId);
      else {
        exerciseIds.push(block.a);
        exerciseIds.push(block.b);
        if (block.c) exerciseIds.push(block.c);
      }
    }
    for (const exerciseId of exerciseIds) {
      if (!exerciseId || seenInDay.has(exerciseId)) continue;
      seenInDay.add(exerciseId);
      const tpl = targets[exerciseId];
      if (!tpl) continue;
      const incRaw = defaultIncrementFor(exerciseId);
      const incrementKg = incRaw > 0 ? incRaw : 2.5;
      await getDb().runAsync(
        `INSERT OR IGNORE INTO exercise_targets(id, program_id, exercise_id, day_index, rep_min, rep_max, target_sets, increment_kg, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `target_${program.id}_${exerciseId}_d${di}`,
          program.id,
          exerciseId,
          di,
          tpl.repMin,
          tpl.repMax,
          tpl.targetSets,
          incrementKg,
          now,
        ]
      );
    }
  }
}

function normalizeProgram(raw: Program): Program {
  const createdAt = raw.createdAt ?? isoNow();
  const updatedAt = raw.updatedAt ?? createdAt;
  const days = (raw.days ?? []).map((d: any, idx: number) => ({
    id: d.id ?? uid("day"),
    name: d.name ?? `Dag ${idx + 1}`,
    blocks: (d.blocks ?? []).map((b: any) => {
      if (b.type === "single") {
        const exId = b.exId ?? b.ex;
        return { type: "single", exId: String(exId) } as ProgramBlock;
      }
      if (b.type === "superset") {
        const block: ProgramBlock = { type: "superset", a: String(b.a), b: String(b.b) };
        if (b.c) block.c = String(b.c);
        return block;
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

async function writeProgramTables(program: Program): Promise<void> {
  const database = getDb();
  await database.runAsync(`DELETE FROM program_days WHERE program_id = ?`, [program.id]);
  await database.runAsync(`DELETE FROM program_day_exercises WHERE program_id = ?`, [program.id]);

  for (let di = 0; di < program.days.length; di += 1) {
    const day = program.days[di];
    const dayId = day.id || uid("day");
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
          [uid("pde"), program.id, di, bi, "single", block.exId]
        );
      } else {
        await database.runAsync(
          `INSERT INTO program_day_exercises(id, program_id, day_index, sort_index, type, ex_id, a_id, b_id, c_id)
           VALUES(?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
          [uid("pde"), program.id, di, bi, "superset", block.a, block.b, block.c ?? null]
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
    `SELECT day_index, sort_index, type, ex_id, a_id, b_id, c_id
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
        const block: ProgramBlock = { type: "superset", a: String(rowBlock.a_id), b: String(rowBlock.b_id) };
        if (rowBlock.c_id) block.c = String(rowBlock.c_id);
        blocksByDay[di].push(block);
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

  // The description lives only in the json blob (guidance text on templates).
  let description: string | undefined;
  if (programRow.json) {
    try {
      const parsed = JSON.parse(programRow.json) as { description?: string };
      if (typeof parsed.description === "string" && parsed.description) description = parsed.description;
    } catch {}
  }

  return {
    id: programRow.id,
    name: programRow.name,
    description,
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

  await insertDefaultIfMissing("normal", DEFAULT_STANDARD_PROGRAM);
  await insertDefaultIfMissing("back", DEFAULT_BACK_PROGRAM);
  await insertDefaultIfMissing("normal", PPL5_BRYSTFOKUS_PROGRAM);
  await insertDefaultIfMissing("normal", NYBEGYNNER3_PROGRAM);
  await insertDefaultIfMissing("normal", STYRKE4_PROGRAM);
  await insertDefaultIfMissing("normal", HYPERTROFI4_PROGRAM);
  await insertDefaultIfMissing("normal", HJEMME3_PROGRAM);

  // One-time rename on installs seeded before the rename; a user-chosen name
  // (anything other than the old default) is left alone.
  await getDb().runAsync(
    `UPDATE programs SET name = ? WHERE id = ? AND name = ?`,
    [PPL5_BRYSTFOKUS_PROGRAM.name, PPL5_BRYSTFOKUS_ID, PPL5_BRYSTFOKUS_LEGACY_NAME]
  );

  await seedProgramAlternativesIfMissing(PPL5_BRYSTFOKUS_ID, PPL5_BRYSTFOKUS_ALTERNATIVES);
  await seedProgramTargetsIfMissing(PPL5_BRYSTFOKUS_PROGRAM, PPL5_BRYSTFOKUS_TARGETS);
  await seedProgramAlternativesIfMissing(NYBEGYNNER3_ID, NYBEGYNNER3_ALTERNATIVES);
  await seedProgramTargetsIfMissing(NYBEGYNNER3_PROGRAM, NYBEGYNNER3_TARGETS);
  await seedProgramAlternativesIfMissing(STYRKE4_ID, STYRKE4_ALTERNATIVES);
  await seedProgramTargetsIfMissing(STYRKE4_PROGRAM, STYRKE4_TARGETS);
  await seedProgramAlternativesIfMissing(HYPERTROFI4_ID, HYPERTROFI4_ALTERNATIVES);
  await seedProgramTargetsIfMissing(HYPERTROFI4_PROGRAM, HYPERTROFI4_TARGETS);
  await seedProgramAlternativesIfMissing(HJEMME3_ID, HJEMME3_ALTERNATIVES);
  await seedProgramTargetsIfMissing(HJEMME3_PROGRAM, HJEMME3_TARGETS);

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
    id: d.id ?? uid("day"),
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
    const next: ProgramBlock = {
      type: "superset",
      a: map.get(b.a) ?? b.a,
      b: map.get(b.b) ?? b.b,
    };
    if (b.c) next.c = map.get(b.c) ?? b.c;
    return next;
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
  const id = uid("repl");
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
      [uid("alt"), args.programId, args.dayIndex, args.exerciseId, altId, i]
    );
  }
}

export function createBlankProgram(name: string, daysCount = 5, dayLabel = "Day"): Program {
  const days: ProgramDay[] = [];
  const count = Math.max(1, daysCount);
  for (let i = 0; i < count; i += 1) {
    days.push(createDay(`${dayLabel} ${i + 1}`, []));
  }
  return baseProgram(name, days);
}

export function cloneProgram(program: Program, name: string): Program {
  const now = isoNow();
  return {
    ...program,
    id: uid("program"),
    name,
    createdAt: now,
    updatedAt: now,
    days: program.days.map((d, idx) => ({
      id: uid("day"),
      name: d.name || `Dag ${idx + 1}`,
      blocks: d.blocks.map((b) => ({ ...b })),
    })),
  };
}

/**
 * Copy what belongs to a program besides its days: per-day targets (sets,
 * rep range, increment, auto-progress) and alternatives. Used when a program
 * is duplicated, so the copy is the same plan and not just the same exercises.
 */
export async function copyProgramExtras(fromProgramId: string, toProgramId: string): Promise<void> {
  if (!fromProgramId || !toProgramId || fromProgramId === toProgramId) return;
  await ensureDb();
  const db = getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO exercise_targets(id, program_id, exercise_id, day_index, rep_min, rep_max, target_sets, increment_kg, updated_at, auto_progress)
     SELECT 'target_' || ? || '_' || exercise_id || '_d' || day_index, ?, exercise_id, day_index, rep_min, rep_max, target_sets, increment_kg, ?, auto_progress
     FROM exercise_targets WHERE program_id = ?`,
    [toProgramId, toProgramId, isoNow(), fromProgramId]
  );
  const alts = await db.getAllAsync<{ day_index: number; exercise_id: string; alt_exercise_id: string; sort_index: number }>(
    `SELECT day_index, exercise_id, alt_exercise_id, sort_index FROM program_exercise_alternatives WHERE program_id = ?`,
    [fromProgramId]
  );
  for (const a of alts ?? []) {
    await db.runAsync(
      `INSERT INTO program_exercise_alternatives(id, program_id, day_index, exercise_id, alt_exercise_id, sort_index)
       VALUES(?, ?, ?, ?, ?, ?)`,
      [uid("alt"), toProgramId, a.day_index, a.exercise_id, a.alt_exercise_id, a.sort_index]
    );
  }
}

/**
 * Drop targets and alternatives that no longer belong to the program: days
 * that were removed, and exercises taken out of a day. Left behind, they come
 * back silently when a day or exercise is added again later (an empty new day
 * showing the removed day's rep ranges).
 */
export async function pruneProgramExtras(program: Program): Promise<void> {
  if (!program?.id) return;
  await ensureDb();
  const db = getDb();
  const dayCount = program.days.length;
  await db.runAsync(`DELETE FROM exercise_targets WHERE program_id = ? AND day_index >= ?`, [program.id, dayCount]);
  await db.runAsync(`DELETE FROM program_exercise_alternatives WHERE program_id = ? AND day_index >= ?`, [program.id, dayCount]);

  for (let di = 0; di < dayCount; di += 1) {
    const primaries = new Set<string>();
    for (const block of program.days[di].blocks) {
      if (block.type === "single") primaries.add(block.exId);
      else {
        primaries.add(block.a);
        primaries.add(block.b);
        if (block.c) primaries.add(block.c);
      }
    }

    // Alternatives of an exercise that left the day go with it.
    const altRows = await db.getAllAsync<{ exercise_id: string; alt_exercise_id: string }>(
      `SELECT exercise_id, alt_exercise_id FROM program_exercise_alternatives WHERE program_id = ? AND day_index = ?`,
      [program.id, di]
    );
    const keep = new Set(primaries);
    const orphanBases = new Set<string>();
    for (const row of altRows ?? []) {
      if (primaries.has(row.exercise_id)) keep.add(row.alt_exercise_id);
      else orphanBases.add(row.exercise_id);
    }
    for (const base of orphanBases) {
      await db.runAsync(
        `DELETE FROM program_exercise_alternatives WHERE program_id = ? AND day_index = ? AND exercise_id = ?`,
        [program.id, di, base]
      );
    }

    // Targets for anything that is neither in the day nor an alternative there.
    const targetRows = await db.getAllAsync<{ exercise_id: string }>(
      `SELECT exercise_id FROM exercise_targets WHERE program_id = ? AND day_index = ?`,
      [program.id, di]
    );
    for (const row of targetRows ?? []) {
      if (keep.has(row.exercise_id)) continue;
      await db.runAsync(
        `DELETE FROM exercise_targets WHERE program_id = ? AND day_index = ? AND exercise_id = ?`,
        [program.id, di, row.exercise_id]
      );
    }
  }
}

/** Ids of the programs that ship with the app and are re-seeded at startup. */
export const BUILT_IN_PROGRAM_IDS: readonly string[] = [
  STANDARD_PROGRAM_ID,
  BACK_PROGRAM_ID,
  LEGACY_STANDARD_PROGRAM_ID,
  LEGACY_BACK_PROGRAM_ID,
  PPL5_BRYSTFOKUS_ID,
  NYBEGYNNER3_ID,
  STYRKE4_ID,
  HYPERTROFI4_ID,
  HJEMME3_ID,
];

/** Get preview data for the next workout day */
export async function getNextWorkoutPreview(
  programId: string,
  nextDayIndex: number
): Promise<{ dayName: string; exercises: string[] } | null> {
  if (!programId) return null;
  await ensureDb();
  const program = await getProgram(programId);
  if (!program || !program.days[nextDayIndex]) return null;
  const day = program.days[nextDayIndex];
  const exercises: string[] = [];
  for (const block of day.blocks) {
    if (block.type === "single") {
      exercises.push(block.exId);
    } else {
      exercises.push(block.a);
      exercises.push(block.b);
      if (block.c) exercises.push(block.c);
    }
  }
  return { dayName: day.name, exercises };
}

// ── Workout duration estimate ─────────────────────────────────────────────
//
// Median (not mean) so a single forgotten-to-end session can't drag the
// estimate up to «3h 47m» and ruin every future estimate. Also drops
// implausible sessions (<5 min, >3h) before computing — those rows are
// almost certainly bad data (forgot-to-end, mis-tap, etc).
//
// Exported separately so the math can be unit-tested without spinning up
// a SQLite mock.

const DURATION_MIN_PLAUSIBLE_MIN = 5;
const DURATION_MAX_PLAUSIBLE_MIN = 3 * 60;
const DURATION_MIN_SAMPLE_SIZE = 2;

export function estimateDurationFromSessions(
  sessions: { started_at: string | null; ended_at: string | null }[],
): string | null {
  const minutes: number[] = [];
  for (const r of sessions) {
    if (!r.started_at || !r.ended_at) continue;
    const start = new Date(r.started_at).getTime();
    const end = new Date(r.ended_at).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    const m = (end - start) / 60000;
    if (m < DURATION_MIN_PLAUSIBLE_MIN || m > DURATION_MAX_PLAUSIBLE_MIN) continue;
    minutes.push(m);
  }
  if (minutes.length < DURATION_MIN_SAMPLE_SIZE) return null;

  minutes.sort((a, b) => a - b);
  const mid = Math.floor(minutes.length / 2);
  const medianMin =
    minutes.length % 2 === 0 ? (minutes[mid - 1] + minutes[mid]) / 2 : minutes[mid];
  const rounded = Math.round(medianMin);

  if (rounded < 1) return "< 1 min";
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const mins = rounded % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Get estimated workout duration for a specific day. Samples up to 10
 * most recent completed sessions and uses median (see
 * `estimateDurationFromSessions` for the math).
 */
export async function getEstimatedDuration(programId: string, dayIndex: number): Promise<string | null> {
  if (!programId) return null;
  await ensureDb();
  const rows = await getDb().getAllAsync<{ started_at: string; ended_at: string }>(
    `SELECT started_at, ended_at FROM workouts
     WHERE program_id = ? AND day_index = ? AND ended_at IS NOT NULL
       AND started_at IS NOT NULL
     ORDER BY date DESC LIMIT 10`,
    [programId, dayIndex]
  );
  if (!rows || rows.length === 0) return null;
  return estimateDurationFromSessions(rows);
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
  getNextWorkoutPreview,
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
