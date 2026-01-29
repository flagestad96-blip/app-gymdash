// src/programs.ts
import { getSetting, setSetting } from "./db";
import { displayNameFor } from "./exerciseLibrary";

export type ProgramMode = "normal" | "back";

export type DayExercise = {
  exerciseId: string;
  target: string; // e.g. "3x6–10"
  alternatives?: string[]; // exerciseIds
};

export type ProgramDay = {
  title: string;
  exercises: DayExercise[];
};

export type ProgramDef = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  normal: ProgramDay[];
  back: ProgramDay[];
};

type ProgramPackV1 = {
  version: 1;
  activeProgramId: string;
  programs: ProgramDef[];
};

const KEY = "userPrograms_v1";

function nowIso() {
  return new Date().toISOString();
}

function defaultProgram(): ProgramDef {
  const createdAt = nowIso();
  const updatedAt = createdAt;

  // 5-dagers (PPL + upper-ish) men med mindre “skulder-kræsj” og ryggvennlig alt klart.
  const normal: ProgramDay[] = [
    {
      title: "Push (Bryst + Triceps)",
      exercises: [
        { exerciseId: "bench_press", target: "4x6–10", alternatives: ["machine_chest_press", "incline_db_press"] },
        { exerciseId: "incline_db_press", target: "3x8–12", alternatives: ["machine_chest_press"] },
        { exerciseId: "cable_fly", target: "3x12–15", alternatives: [] },
        { exerciseId: "triceps_pushdown", target: "3x10–15", alternatives: ["overhead_triceps_ext"] },
        { exerciseId: "overhead_triceps_ext", target: "2x12–15", alternatives: ["skullcrushers"] },
      ],
    },
    {
      title: "Pull (Rygg + Biceps)",
      exercises: [
        { exerciseId: "lat_pulldown", target: "4x6–10", alternatives: ["pull_up"] },
        { exerciseId: "chest_supported_row", target: "4x8–12", alternatives: ["cable_row", "one_arm_db_row"] },
        { exerciseId: "face_pull", target: "3x12–15", alternatives: ["rear_delt_fly"] },
        { exerciseId: "cable_curl", target: "3x10–15", alternatives: ["db_curl", "hammer_curl"] },
      ],
    },
    {
      title: "Legs (Quads + Hamstrings)",
      exercises: [
        { exerciseId: "leg_press", target: "4x8–12", alternatives: ["hack_squat", "smith_squat"] },
        { exerciseId: "leg_extension", target: "3x10–15", alternatives: [] },
        { exerciseId: "lying_leg_curl", target: "4x8–12", alternatives: ["seated_leg_curl"] },
        { exerciseId: "hip_thrust_machine", target: "3x8–12", alternatives: ["glute_bridge"] },
        { exerciseId: "seated_calf_raise", target: "4x10–15", alternatives: ["standing_calf_raise"] },
      ],
    },
    {
      title: "Upper (Skulder-light)",
      exercises: [
        { exerciseId: "machine_chest_press", target: "3x8–12", alternatives: ["bench_press", "incline_db_press"] },
        { exerciseId: "cable_row", target: "3x8–12", alternatives: ["chest_supported_row"] },
        { exerciseId: "lateral_raise", target: "3x12–20", alternatives: [] },
        { exerciseId: "triceps_pushdown", target: "2x10–15", alternatives: ["overhead_triceps_ext"] },
        { exerciseId: "hammer_curl", target: "2x10–15", alternatives: ["db_curl"] },
      ],
    },
    {
      title: "Lower (Glutes + Core + Hips)",
      exercises: [
        { exerciseId: "hip_thrust_machine", target: "4x6–10", alternatives: ["glute_bridge"] },
        { exerciseId: "back_extension", target: "3x10–15", alternatives: [] },
        { exerciseId: "adductor", target: "3x12–20", alternatives: [] },
        { exerciseId: "abductor", target: "3x12–20", alternatives: [] },
        { exerciseId: "cable_crunch", target: "3x10–15", alternatives: ["plank"] },
      ],
    },
  ];

  // Back-variant: samme struktur men enda “snillere” i valg
  const back: ProgramDay[] = [
    {
      title: "Push (Ryggvennlig)",
      exercises: [
        { exerciseId: "machine_chest_press", target: "4x8–12", alternatives: ["bench_press", "incline_db_press"] },
        { exerciseId: "incline_db_press", target: "3x10–12", alternatives: ["machine_chest_press"] },
        { exerciseId: "cable_fly", target: "3x12–15", alternatives: [] },
        { exerciseId: "triceps_pushdown", target: "3x10–15", alternatives: ["overhead_triceps_ext"] },
      ],
    },
    {
      title: "Pull (Ryggvennlig)",
      exercises: [
        { exerciseId: "lat_pulldown", target: "4x8–12", alternatives: ["pull_up"] },
        { exerciseId: "chest_supported_row", target: "4x10–12", alternatives: ["cable_row"] },
        { exerciseId: "rear_delt_fly", target: "3x12–15", alternatives: ["face_pull"] },
        { exerciseId: "cable_curl", target: "3x10–15", alternatives: ["db_curl", "hammer_curl"] },
      ],
    },
    {
      title: "Legs (Ryggvennlig)",
      exercises: [
        { exerciseId: "leg_press", target: "4x10–12", alternatives: ["hack_squat"] },
        { exerciseId: "leg_extension", target: "3x12–15", alternatives: [] },
        { exerciseId: "seated_leg_curl", target: "4x10–12", alternatives: ["lying_leg_curl"] },
        { exerciseId: "hip_thrust_machine", target: "3x8–12", alternatives: ["glute_bridge"] },
        { exerciseId: "seated_calf_raise", target: "4x12–15", alternatives: ["standing_calf_raise"] },
      ],
    },
    {
      title: "Upper (Ryggvennlig)",
      exercises: [
        { exerciseId: "machine_chest_press", target: "3x10–12", alternatives: ["incline_db_press"] },
        { exerciseId: "cable_row", target: "3x10–12", alternatives: ["chest_supported_row"] },
        { exerciseId: "lateral_raise", target: "3x12–20", alternatives: [] },
        { exerciseId: "triceps_pushdown", target: "2x12–15", alternatives: [] },
        { exerciseId: "db_curl", target: "2x10–15", alternatives: ["hammer_curl"] },
      ],
    },
    {
      title: "Lower (Ryggvennlig)",
      exercises: [
        { exerciseId: "hip_thrust_machine", target: "4x8–12", alternatives: ["glute_bridge"] },
        { exerciseId: "back_extension", target: "3x10–15", alternatives: [] },
        { exerciseId: "adductor", target: "3x12–20", alternatives: [] },
        { exerciseId: "abductor", target: "3x12–20", alternatives: [] },
        { exerciseId: "cable_crunch", target: "3x10–15", alternatives: ["plank"] },
      ],
    },
  ];

  return {
    id: "default_v1",
    name: "Gymdash Standard (5 dager)",
    createdAt,
    updatedAt,
    normal,
    back,
  };
}

function readPack(): ProgramPackV1 {
  try {
    const raw = getSetting(KEY);
    if (!raw) throw new Error("no pack");
    const parsed = JSON.parse(raw) as ProgramPackV1;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.programs) || !parsed.activeProgramId) throw new Error("bad");
    return parsed;
  } catch {
    const p = defaultProgram();
    const seeded: ProgramPackV1 = { version: 1, activeProgramId: p.id, programs: [p] };
    setSetting(KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function writePack(pack: ProgramPackV1) {
  setSetting(KEY, JSON.stringify(pack));
}

export function getAllPrograms(): ProgramDef[] {
  return readPack().programs;
}

export function getActiveProgramId(): string {
  return readPack().activeProgramId;
}

export function setActiveProgramId(id: string) {
  const pack = readPack();
  if (!pack.programs.some((p) => p.id === id)) return;
  pack.activeProgramId = id;
  writePack(pack);
}

export function upsertProgram(program: ProgramDef) {
  const pack = readPack();
  const idx = pack.programs.findIndex((p) => p.id === program.id);
  if (idx >= 0) pack.programs[idx] = program;
  else pack.programs.unshift(program);
  writePack(pack);
}

export function cloneActiveProgram(newName: string): ProgramDef {
  const pack = readPack();
  const active = pack.programs.find((p) => p.id === pack.activeProgramId) ?? defaultProgram();
  const createdAt = nowIso();
  const cloned: ProgramDef = {
    ...active,
    id: `prog_${Math.random().toString(16).slice(2)}`,
    name: newName,
    createdAt,
    updatedAt: createdAt,
    // deep copy days
    normal: active.normal.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, alternatives: [...(e.alternatives ?? [])] })) })),
    back: active.back.map((d) => ({ ...d, exercises: d.exercises.map((e) => ({ ...e, alternatives: [...(e.alternatives ?? [])] })) })),
  };
  pack.programs.unshift(cloned);
  pack.activeProgramId = cloned.id;
  writePack(pack);
  return cloned;
}

export function updateActiveProgramDayExercise(mode: ProgramMode, dayIndex: number, exIndex: number, newExerciseId: string) {
  const pack = readPack();
  const activeIdx = pack.programs.findIndex((p) => p.id === pack.activeProgramId);
  if (activeIdx < 0) return;

  const active = pack.programs[activeIdx];
  const days = mode === "normal" ? active.normal : active.back;
  const day = days[dayIndex];
  if (!day) return;
  const ex = day.exercises[exIndex];
  if (!ex) return;

  day.exercises[exIndex] = { ...ex, exerciseId: newExerciseId };
  active.updatedAt = nowIso();
  pack.programs[activeIdx] = { ...active };
  writePack(pack);
}

export function displayExerciseName(id: string) {
  return displayNameFor(id);
}

// IMPORTANT: programs is a Proxy so Logg-fanen alltid leser “fersk” aktivt program fra settings.
export const programs = new Proxy(
  {},
  {
    get(_t, prop: string) {
      const pack = readPack();
      const active = pack.programs.find((p) => p.id === pack.activeProgramId) ?? defaultProgram();
      if (prop === "normal") return active.normal;
      if (prop === "back") return active.back;
      return undefined;
    },
  }
) as unknown as { normal: ProgramDay[]; back: ProgramDay[] };
