// src/exerciseLibrary.ts
export type ExerciseTag =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "full"
  | "upper"
  | "lower"
  | "compound"
  | "isolation";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "smith"
  | "trapbar"
  | "other";

export type ExerciseDef = {
  id: string;
  displayName: string;
  equipment: Equipment;
  tags: ExerciseTag[];
  defaultIncrementKg: number;
  isBodyweight?: boolean;
  bodyweightFactor?: number;
  aliases?: string[];
};

export const EXERCISES: ExerciseDef[] = [
  // Chest / pressing
  {
    id: "bench_press",
    displayName: "Bench Press",
    equipment: "barbell",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["bp"],
  },
  {
    id: "incline_db_press",
    displayName: "Incline DB Press",
    equipment: "dumbbell",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "flat_db_press",
    displayName: "Flat DB Press",
    equipment: "dumbbell",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["flat dumbbell press", "db bench press", "dumbbell bench press"],
  },
  {
    id: "smith_bench_press",
    displayName: "Smith Bench Press",
    equipment: "smith",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["smith bench"],
  },
  {
    id: "smith_incline_press",
    displayName: "Smith Incline Press",
    equipment: "smith",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["smith incline bench"],
  },
  {
    id: "machine_chest_press",
    displayName: "Machine Chest Press",
    equipment: "machine",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "cable_fly",
    displayName: "Cable Fly",
    equipment: "cable",
    tags: ["chest", "isolation"],
    defaultIncrementKg: 2.5,
  },

  // Shoulders
  {
    id: "overhead_press",
    displayName: "Overhead Press",
    equipment: "barbell",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["ohp"],
  },
  {
    id: "db_shoulder_press",
    displayName: "DB Shoulder Press",
    equipment: "dumbbell",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "machine_shoulder_press",
    displayName: "Machine Shoulder Press",
    equipment: "machine",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "lateral_raise",
    displayName: "Lateral Raise",
    equipment: "dumbbell",
    tags: ["shoulders", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "machine_lateral_raise",
    displayName: "Machine Lateral Raise",
    equipment: "machine",
    tags: ["shoulders", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "rear_delt_fly",
    displayName: "Rear Delt Fly",
    equipment: "machine",
    tags: ["shoulders", "back", "isolation"],
    defaultIncrementKg: 2.5,
  },

  // Triceps
  {
    id: "triceps_pushdown",
    displayName: "Triceps Pushdown",
    equipment: "cable",
    tags: ["triceps", "upper", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "cable_triceps_ext",
    displayName: "Cable Triceps Extension",
    equipment: "cable",
    tags: ["triceps", "upper", "isolation"],
    defaultIncrementKg: 2.5,
    aliases: ["triceps extension cable"],
  },
  {
    id: "overhead_triceps_ext",
    displayName: "Overhead Triceps Extension",
    equipment: "cable",
    tags: ["triceps", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "overhead_cable_triceps_ext",
    displayName: "Overhead Cable Triceps Extension",
    equipment: "cable",
    tags: ["triceps", "upper", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "skullcrushers",
    displayName: "Skullcrushers",
    equipment: "barbell",
    tags: ["triceps", "isolation"],
    defaultIncrementKg: 2.5,
  },

  // Back / pulling
  {
    id: "lat_pulldown",
    displayName: "Lat Pulldown",
    equipment: "cable",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["lat pulldown", "latpulldown"],
  },
  {
    id: "pull_up",
    displayName: "Pull-Up",
    equipment: "bodyweight",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 1.0,
    aliases: ["chinup", "chin-up"],
  },
  {
    id: "chest_supported_row",
    displayName: "Chest-Supported Row",
    equipment: "machine",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "cable_row",
    displayName: "Cable Row",
    equipment: "cable",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "machine_row",
    displayName: "Machine Row",
    equipment: "machine",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["seated row", "row machine"],
  },
  {
    id: "one_arm_db_row",
    displayName: "One-Arm DB Row",
    equipment: "dumbbell",
    tags: ["back", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "face_pull",
    displayName: "Face Pull",
    equipment: "cable",
    tags: ["shoulders", "back", "isolation"],
    defaultIncrementKg: 2.5,
  },

  // Biceps
  {
    id: "db_curl",
    displayName: "DB Curl",
    equipment: "dumbbell",
    tags: ["biceps", "upper", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "cable_curl",
    displayName: "Cable Curl",
    equipment: "cable",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "hammer_curl",
    displayName: "Hammer Curl",
    equipment: "dumbbell",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 2.5,
  },

  // Legs / lower
  {
    id: "leg_press",
    displayName: "Leg Press",
    equipment: "machine",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "leg_press_45",
    displayName: "Leg Press 45°",
    equipment: "machine",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 5,
    aliases: ["45 leg press"],
  },
  {
    id: "hack_squat",
    displayName: "Hack Squat",
    equipment: "machine",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "smith_squat",
    displayName: "Smith Squat",
    equipment: "smith",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "leg_extension",
    displayName: "Leg Extension",
    equipment: "machine",
    tags: ["quads", "isolation"],
    defaultIncrementKg: 2.5,
    aliases: ["leg_ext", "legext"],
  },
  {
    id: "lying_leg_curl",
    displayName: "Lying Leg Curl",
    equipment: "machine",
    tags: ["hamstrings", "isolation"],
    defaultIncrementKg: 2.5,
    aliases: ["leg_curl"],
  },
  {
    id: "seated_leg_curl",
    displayName: "Seated Leg Curl",
    equipment: "machine",
    tags: ["hamstrings", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "hip_thrust_machine",
    displayName: "Hip Thrust (Machine)",
    equipment: "machine",
    tags: ["glutes", "lower", "compound"],
    defaultIncrementKg: 5,
    aliases: ["booty_builder"],
  },
  {
    id: "glute_kickback_cable",
    displayName: "Cable Glute Kickback",
    equipment: "cable",
    tags: ["glutes", "lower", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "glute_bridge",
    displayName: "Glute Bridge",
    equipment: "other",
    tags: ["glutes", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "back_extension",
    displayName: "Back Extension",
    equipment: "bodyweight",
    tags: ["hamstrings", "glutes", "lower", "isolation"],
    defaultIncrementKg: 2.5,
    aliases: ["rygghev"],
  },
  {
    id: "standing_calf_raise",
    displayName: "Standing Calf Raise",
    equipment: "machine",
    tags: ["calves", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "seated_calf_raise",
    displayName: "Seated Calf Raise",
    equipment: "machine",
    tags: ["calves", "isolation"],
    defaultIncrementKg: 2.5,
    aliases: ["legg"],
  },

  // Hips / accessories
  {
    id: "abductor",
    displayName: "Hip Abductor",
    equipment: "machine",
    tags: ["glutes", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "adductor",
    displayName: "Hip Adductor",
    equipment: "machine",
    tags: ["glutes", "isolation"],
    defaultIncrementKg: 2.5,
  },

  // Core
  {
    id: "cable_crunch",
    displayName: "Cable Crunch",
    equipment: "cable",
    tags: ["core", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "plank",
    displayName: "Plank",
    equipment: "bodyweight",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
  },

  // Expanded library (v1 polish)
  {
    id: "incline_barbell_press",
    displayName: "Incline Barbell Press",
    equipment: "barbell",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["incline bench"],
  },
  {
    id: "decline_bench_press",
    displayName: "Decline Bench Press",
    equipment: "barbell",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "db_fly",
    displayName: "DB Fly",
    equipment: "dumbbell",
    tags: ["chest", "isolation"],
    defaultIncrementKg: 2.5,
    aliases: ["dumbbell fly"],
  },
  {
    id: "pec_deck",
    displayName: "Pec Deck",
    equipment: "machine",
    tags: ["chest", "isolation"],
    defaultIncrementKg: 2.5,
    aliases: ["pec fly"],
  },
  {
    id: "push_up",
    displayName: "Push-Up",
    equipment: "bodyweight",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.64,
    aliases: ["pushup"],
  },
  {
    id: "dip",
    displayName: "Dip",
    equipment: "bodyweight",
    tags: ["chest", "triceps", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 1.0,
    aliases: ["dips"],
  },
  {
    id: "arnold_press",
    displayName: "Arnold Press",
    equipment: "dumbbell",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "front_raise",
    displayName: "Front Raise",
    equipment: "dumbbell",
    tags: ["shoulders", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "cable_lateral_raise",
    displayName: "Cable Lateral Raise",
    equipment: "cable",
    tags: ["shoulders", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "reverse_pec_deck",
    displayName: "Reverse Pec Deck",
    equipment: "machine",
    tags: ["shoulders", "back", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "upright_row",
    displayName: "Upright Row",
    equipment: "barbell",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "landmine_press",
    displayName: "Landmine Press",
    equipment: "other",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "barbell_row",
    displayName: "Barbell Row",
    equipment: "barbell",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["bent over row"],
  },
  {
    id: "t_bar_row",
    displayName: "T-Bar Row",
    equipment: "machine",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "neutral_grip_pulldown",
    displayName: "Neutral-Grip Pulldown",
    equipment: "cable",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "wide_grip_pulldown",
    displayName: "Wide-Grip Pulldown",
    equipment: "cable",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "straight_arm_pulldown",
    displayName: "Straight-Arm Pulldown",
    equipment: "cable",
    tags: ["back", "isolation"],
    defaultIncrementKg: 2.5,
    aliases: ["pullover", "lat pullover"],
  },
  {
    id: "single_arm_cable_row",
    displayName: "Single-Arm Cable Row",
    equipment: "cable",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "inverted_row",
    displayName: "Inverted Row",
    equipment: "bodyweight",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.7,
    aliases: ["bodyweight row"],
  },
  {
    id: "db_pullover",
    displayName: "DB Pullover",
    equipment: "dumbbell",
    tags: ["back", "chest", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "deadlift",
    displayName: "Deadlift",
    equipment: "barbell",
    tags: ["back", "lower", "compound"],
    defaultIncrementKg: 5,
    aliases: ["dl", "dead lift"],
  },
  {
    id: "trap_bar_deadlift",
    displayName: "Trap Bar Deadlift",
    equipment: "trapbar",
    tags: ["back", "lower", "compound"],
    defaultIncrementKg: 5,
    aliases: ["hex bar deadlift"],
  },
  {
    id: "rack_pull",
    displayName: "Rack Pull",
    equipment: "barbell",
    tags: ["back", "lower", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "ez_bar_curl",
    displayName: "EZ-Bar Curl",
    equipment: "barbell",
    tags: ["biceps", "upper", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "preacher_curl",
    displayName: "Preacher Curl",
    equipment: "machine",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "incline_db_curl",
    displayName: "Incline DB Curl",
    equipment: "dumbbell",
    tags: ["biceps", "upper", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "spider_curl",
    displayName: "Spider Curl",
    equipment: "barbell",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "concentration_curl",
    displayName: "Concentration Curl",
    equipment: "dumbbell",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 1,
  },
  {
    id: "rope_pushdown",
    displayName: "Rope Pushdown",
    equipment: "cable",
    tags: ["triceps", "upper", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "triceps_kickback",
    displayName: "Triceps Kickback",
    equipment: "dumbbell",
    tags: ["triceps", "isolation"],
    defaultIncrementKg: 1,
  },
  {
    id: "overhead_db_extension",
    displayName: "Overhead DB Extension",
    equipment: "dumbbell",
    tags: ["triceps", "isolation"],
    defaultIncrementKg: 1,
  },
  {
    id: "close_grip_bench",
    displayName: "Close-Grip Bench Press",
    equipment: "barbell",
    tags: ["triceps", "chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "bench_dip",
    displayName: "Bench Dip",
    equipment: "bodyweight",
    tags: ["triceps", "upper", "isolation"],
    defaultIncrementKg: 0,
  },
  {
    id: "back_squat",
    displayName: "Back Squat",
    equipment: "barbell",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 5,
    aliases: ["squat"],
  },
  {
    id: "front_squat",
    displayName: "Front Squat",
    equipment: "barbell",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "goblet_squat",
    displayName: "Goblet Squat",
    equipment: "dumbbell",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "bulgarian_split_squat",
    displayName: "Bulgarian Split Squat",
    equipment: "dumbbell",
    tags: ["quads", "glutes", "lower", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["bss"],
  },
  {
    id: "walking_lunge",
    displayName: "Walking Lunge",
    equipment: "dumbbell",
    tags: ["quads", "glutes", "lower", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "step_up",
    displayName: "Step-Up",
    equipment: "dumbbell",
    tags: ["quads", "glutes", "lower", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "belt_squat",
    displayName: "Belt Squat",
    equipment: "machine",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "leg_press_single_leg",
    displayName: "Single-Leg Press",
    equipment: "machine",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "sissy_squat",
    displayName: "Sissy Squat",
    equipment: "bodyweight",
    tags: ["quads", "isolation"],
    defaultIncrementKg: 0,
  },
  {
    id: "bodyweight_squat",
    displayName: "Bodyweight Squat",
    equipment: "bodyweight",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 1.0,
    aliases: ["bw squat"],
  },
  {
    id: "romanian_deadlift",
    displayName: "Romanian Deadlift",
    equipment: "barbell",
    tags: ["hamstrings", "glutes", "lower", "compound"],
    defaultIncrementKg: 5,
    aliases: ["rdl"],
  },
  {
    id: "good_morning",
    displayName: "Good Morning",
    equipment: "barbell",
    tags: ["hamstrings", "lower", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "glute_ham_raise",
    displayName: "Glute-Ham Raise",
    equipment: "bodyweight",
    tags: ["hamstrings", "isolation"],
    defaultIncrementKg: 0,
    aliases: ["ghr"],
  },
  {
    id: "pike_push_up",
    displayName: "Pike Push-Up",
    equipment: "bodyweight",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.7,
    aliases: ["pike pushup"],
  },
  {
    id: "nordic_curl",
    displayName: "Nordic Curl",
    equipment: "bodyweight",
    tags: ["hamstrings", "isolation"],
    defaultIncrementKg: 0,
  },
  {
    id: "hip_thrust_barbell",
    displayName: "Hip Thrust (Barbell)",
    equipment: "barbell",
    tags: ["glutes", "lower", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "cable_pull_through",
    displayName: "Cable Pull-Through",
    equipment: "cable",
    tags: ["glutes", "hamstrings", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "single_leg_rdl",
    displayName: "Single-Leg RDL",
    equipment: "dumbbell",
    tags: ["hamstrings", "glutes", "lower", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "standing_leg_curl",
    displayName: "Standing Leg Curl",
    equipment: "machine",
    tags: ["hamstrings", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "donkey_calf_raise",
    displayName: "Donkey Calf Raise",
    equipment: "machine",
    tags: ["calves", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "leg_press_calf_raise",
    displayName: "Leg Press Calf Raise",
    equipment: "machine",
    tags: ["calves", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "hanging_leg_raise",
    displayName: "Hanging Leg Raise",
    equipment: "bodyweight",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
  },
  {
    id: "reverse_crunch",
    displayName: "Reverse Crunch",
    equipment: "bodyweight",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
  },
  {
    id: "ab_wheel",
    displayName: "Ab Wheel",
    equipment: "bodyweight",
    tags: ["core", "compound"],
    defaultIncrementKg: 0,
    aliases: ["ab wheel rollout"],
  },
  {
    id: "pallof_press",
    displayName: "Pallof Press",
    equipment: "cable",
    tags: ["core", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "russian_twist",
    displayName: "Russian Twist",
    equipment: "bodyweight",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
  },
  {
    id: "side_plank",
    displayName: "Side Plank",
    equipment: "bodyweight",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
  },
  {
    id: "cable_woodchop",
    displayName: "Cable Woodchop",
    equipment: "cable",
    tags: ["core", "isolation"],
    defaultIncrementKg: 2.5,
  },
];

const byId: Record<string, ExerciseDef> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
export const EXERCISE_TAGS: ExerciseTag[] = Array.from(
  new Set(EXERCISES.flatMap((e) => e.tags))
);

export function getExercise(id: string): ExerciseDef | null {
  return byId[id] ?? null;
}

export function displayNameFor(id: string): string {
  return byId[id]?.displayName ?? id;
}

export function defaultIncrementFor(id: string): number {
  return byId[id]?.defaultIncrementKg ?? 2.5;
}

export function tagsFor(id: string): ExerciseTag[] {
  return byId[id]?.tags ?? [];
}

export function isBodyweight(id: string): boolean {
  return !!byId[id]?.isBodyweight;
}

export function bodyweightFactorFor(id: string): number {
  if (!byId[id]?.isBodyweight) return 1.0;
  return byId[id]?.bodyweightFactor ?? 1.0;
}

export function suggestedAlternates(id: string, limit = 12): ExerciseDef[] {
  const base = byId[id];
  if (!base) return [];
  const baseTags = new Set(base.tags);

  const scored = EXERCISES.filter((e) => e.id !== id)
    .map((e) => {
      const shared = e.tags.filter((t) => baseTags.has(t)).length;
      const equipmentMatch = e.equipment === base.equipment ? 1 : 0;
      return { ex: e, score: shared * 10 + equipmentMatch };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.ex);
}

export function searchExercises(query: string): ExerciseDef[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return EXERCISES;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\s_-]+/g, "")
      .replace(/[^a-z0-9]/g, "");

  const nq = normalize(q);

  return EXERCISES.filter((e) => {
    const name = e.displayName.toLowerCase();
    const exId = e.id.toLowerCase();
    if (name.includes(q) || exId.includes(q)) return true;

    const nName = normalize(e.displayName);
    const nId = normalize(e.id);
    if (nName.includes(nq) || nId.includes(nq)) return true;

    return (e.aliases ?? []).some((a) => {
      const al = a.toLowerCase();
      return al.includes(q) || normalize(al).includes(nq);
    });
  });
}

export function resolveExerciseId(input: string): string | null {
  if (!input) return null;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\s_-]+/g, "")
      .replace(/[^a-z0-9]/g, "");

  const n = normalize(input);
  if (!n) return null;

  if (byId[input]) return input;

  for (const ex of EXERCISES) {
    if (normalize(ex.id) === n) return ex.id;
    if (normalize(ex.displayName) === n) return ex.id;
    if ((ex.aliases ?? []).some((a) => normalize(a) === n)) return ex.id;
  }

  return null;
}
