// src/exerciseLibrary.ts
import { ensureDb, getDb } from "./db";

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
  | "isolation"
  | "lower_back_demanding"
  | "lower_back_friendly";

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
  alternatives?: string[]; // Array of exercise IDs that can substitute this exercise
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
    alternatives: ["incline_barbell_press", "flat_db_press", "machine_chest_press", "decline_bench_press", "dip"],
  },
  {
    id: "incline_db_press",
    displayName: "Incline DB Press",
    equipment: "dumbbell",
    tags: ["chest", "upper", "compound", "lower_back_friendly"],
    defaultIncrementKg: 2.5,
    alternatives: ["incline_barbell_press", "flat_db_press", "machine_chest_press", "bench_press"],
  },
  {
    id: "flat_db_press",
    displayName: "Flat DB Press",
    equipment: "dumbbell",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 2.5,
    aliases: ["flat dumbbell press", "db bench press", "dumbbell bench press"],
    alternatives: ["bench_press", "incline_db_press", "machine_chest_press", "dip"],
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
    tags: ["chest", "upper", "compound", "lower_back_friendly"],
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
    tags: ["shoulders", "upper", "compound", "lower_back_demanding"],
    defaultIncrementKg: 2.5,
    aliases: ["ohp"],
    alternatives: ["db_shoulder_press", "machine_shoulder_press", "landmine_press"],
  },
  {
    id: "db_shoulder_press",
    displayName: "DB Shoulder Press",
    equipment: "dumbbell",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
    alternatives: ["overhead_press", "machine_shoulder_press"],
  },
  {
    id: "machine_shoulder_press",
    displayName: "Machine Shoulder Press",
    equipment: "machine",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
    alternatives: ["overhead_press", "db_shoulder_press"],
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
    alternatives: ["overhead_triceps_extension", "skullcrushers", "dip", "close_grip_bench", "cable_triceps_ext"],
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
    alternatives: ["triceps_pushdown", "overhead_triceps_extension", "dip", "close_grip_bench"],
  },

  // Back / pulling
  {
    id: "lat_pulldown",
    displayName: "Lat Pulldown",
    equipment: "cable",
    tags: ["back", "upper", "compound", "lower_back_friendly"],
    defaultIncrementKg: 2.5,
    aliases: ["lat pulldown", "latpulldown"],
    alternatives: ["pull_up", "neutral_grip_pulldown", "assisted_pullup", "inverted_row"],
  },
  {
    id: "pull_up",
    displayName: "Pull-Up",
    equipment: "bodyweight",
    tags: ["back", "upper", "compound", "lower_back_friendly"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 1.0,
    aliases: ["chinup", "chin-up"],
    alternatives: ["lat_pulldown", "assisted_pullup", "neutral_grip_pulldown", "inverted_row"],
  },
  {
    id: "chest_supported_row",
    displayName: "Chest-Supported Row",
    equipment: "machine",
    tags: ["back", "upper", "compound", "lower_back_friendly"],
    defaultIncrementKg: 2.5,
    alternatives: ["seal_row", "cable_row", "machine_row", "one_arm_db_row", "t_bar_row"],
  },
  {
    id: "cable_row",
    displayName: "Cable Row",
    equipment: "cable",
    tags: ["back", "upper", "compound", "lower_back_friendly"],
    defaultIncrementKg: 2.5,
    alternatives: ["machine_row", "chest_supported_row", "barbell_row", "one_arm_db_row", "t_bar_row"],
  },
  {
    id: "machine_row",
    displayName: "Machine Row",
    equipment: "machine",
    tags: ["back", "upper", "compound", "lower_back_friendly"],
    defaultIncrementKg: 2.5,
    aliases: ["seated row", "row machine"],
    alternatives: ["cable_row", "chest_supported_row", "one_arm_db_row", "t_bar_row"],
  },
  {
    id: "one_arm_db_row",
    displayName: "One-Arm DB Row",
    equipment: "dumbbell",
    tags: ["back", "compound"],
    defaultIncrementKg: 2.5,
    alternatives: ["cable_row", "machine_row", "chest_supported_row", "barbell_row"],
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
    alternatives: ["ez_bar_curl", "cable_curl", "hammer_curl", "preacher_curl", "incline_db_curl"],
  },
  {
    id: "cable_curl",
    displayName: "Cable Curl",
    equipment: "cable",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 2.5,
    alternatives: ["db_curl", "ez_bar_curl", "hammer_curl", "preacher_curl"],
  },
  {
    id: "hammer_curl",
    displayName: "Hammer Curl",
    equipment: "dumbbell",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 2.5,
    alternatives: ["db_curl", "cable_curl", "ez_bar_curl", "zottman_curl"],
  },

  // Legs / lower
  {
    id: "leg_press",
    displayName: "Leg Press",
    equipment: "machine",
    tags: ["quads", "lower", "compound", "lower_back_friendly"],
    defaultIncrementKg: 5,
    alternatives: ["hack_squat", "back_squat", "front_squat", "leg_press_45", "belt_squat"],
  },
  {
    id: "leg_press_45",
    displayName: "Leg Press 45°",
    equipment: "machine",
    tags: ["quads", "lower", "compound", "lower_back_friendly"],
    defaultIncrementKg: 5,
    aliases: ["45 leg press"],
  },
  {
    id: "hack_squat",
    displayName: "Hack Squat",
    equipment: "machine",
    tags: ["quads", "lower", "compound", "lower_back_friendly"],
    defaultIncrementKg: 5,
    alternatives: ["leg_press", "leg_press_45", "back_squat", "front_squat", "belt_squat"],
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
    tags: ["chest", "upper", "compound", "lower_back_friendly"],
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
    alternatives: ["assisted_dip", "bench_dip", "close_grip_bench", "triceps_pushdown", "decline_bench_press"],
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
    tags: ["back", "upper", "compound", "lower_back_demanding"],
    defaultIncrementKg: 2.5,
    aliases: ["bent over row"],
    alternatives: ["cable_row", "t_bar_row", "one_arm_db_row", "machine_row", "chest_supported_row", "pendlay_row"],
  },
  {
    id: "t_bar_row",
    displayName: "T-Bar Row",
    equipment: "machine",
    tags: ["back", "upper", "compound", "lower_back_demanding"],
    defaultIncrementKg: 2.5,
    alternatives: ["barbell_row", "cable_row", "chest_supported_row", "machine_row", "landmine_row"],
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
    tags: ["back", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
    aliases: ["dl", "dead lift"],
    alternatives: ["romanian_deadlift", "trap_bar_deadlift", "rack_pull", "stiff_leg_deadlift", "deficit_deadlift"],
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
    tags: ["back", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "ez_bar_curl",
    displayName: "EZ-Bar Curl",
    equipment: "barbell",
    tags: ["biceps", "upper", "isolation"],
    defaultIncrementKg: 2.5,
    alternatives: ["db_curl", "cable_curl", "preacher_curl", "spider_curl", "incline_db_curl"],
  },
  {
    id: "preacher_curl",
    displayName: "Preacher Curl",
    equipment: "machine",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 2.5,
    alternatives: ["ez_bar_curl", "spider_curl", "cable_curl", "db_curl"],
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
    alternatives: ["dip", "triceps_pushdown", "skullcrushers", "overhead_triceps_ext", "diamond_push_up"],
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
    tags: ["quads", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
    aliases: ["squat"],
    alternatives: ["front_squat", "leg_press", "hack_squat", "belt_squat", "goblet_squat", "safety_bar_squat"],
  },
  {
    id: "front_squat",
    displayName: "Front Squat",
    equipment: "barbell",
    tags: ["quads", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
    alternatives: ["back_squat", "leg_press", "hack_squat", "goblet_squat", "safety_bar_squat"],
  },
  {
    id: "goblet_squat",
    displayName: "Goblet Squat",
    equipment: "dumbbell",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 2.5,
    alternatives: ["front_squat", "back_squat", "leg_press", "hack_squat"],
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
    tags: ["quads", "lower", "compound", "lower_back_friendly"],
    defaultIncrementKg: 5,
    alternatives: ["leg_press", "hack_squat", "back_squat", "front_squat", "leg_press_45"],
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
    tags: ["hamstrings", "glutes", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
    aliases: ["rdl"],
    alternatives: ["deadlift", "good_morning", "lying_leg_curl", "glute_ham_raise", "single_leg_rdl", "stiff_leg_deadlift"],
  },
  {
    id: "good_morning",
    displayName: "Good Morning",
    equipment: "barbell",
    tags: ["hamstrings", "lower", "compound", "lower_back_demanding"],
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

  // Olympic / Power Lifts
  {
    id: "power_clean",
    displayName: "Power Clean",
    equipment: "barbell",
    tags: ["full", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "clean_and_jerk",
    displayName: "Clean & Jerk",
    equipment: "barbell",
    tags: ["full", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "snatch",
    displayName: "Snatch",
    equipment: "barbell",
    tags: ["full", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "hang_clean",
    displayName: "Hang Clean",
    equipment: "barbell",
    tags: ["full", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "hang_snatch",
    displayName: "Hang Snatch",
    equipment: "barbell",
    tags: ["full", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "box_squat",
    displayName: "Box Squat",
    equipment: "barbell",
    tags: ["quads", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "pause_squat",
    displayName: "Pause Squat",
    equipment: "barbell",
    tags: ["quads", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "tempo_squat",
    displayName: "Tempo Squat",
    equipment: "barbell",
    tags: ["quads", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "power_shrug",
    displayName: "Power Shrug",
    equipment: "barbell",
    tags: ["back", "upper", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "high_pull",
    displayName: "High Pull",
    equipment: "barbell",
    tags: ["back", "shoulders", "upper", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "clean_pull",
    displayName: "Clean Pull",
    equipment: "barbell",
    tags: ["back", "full", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },

  // Strongman
  {
    id: "farmers_walk",
    displayName: "Farmer's Walk",
    equipment: "other",
    tags: ["full", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "sled_push",
    displayName: "Sled Push",
    equipment: "other",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 10,
  },
  {
    id: "sled_pull",
    displayName: "Sled Pull",
    equipment: "other",
    tags: ["quads", "back", "compound"],
    defaultIncrementKg: 10,
  },
  {
    id: "tire_flip",
    displayName: "Tire Flip",
    equipment: "other",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "yoke_walk",
    displayName: "Yoke Walk",
    equipment: "other",
    tags: ["full", "compound"],
    defaultIncrementKg: 10,
  },
  {
    id: "log_press",
    displayName: "Log Press",
    equipment: "other",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "atlas_stone",
    displayName: "Atlas Stone",
    equipment: "other",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "sandbag_carry",
    displayName: "Sandbag Carry",
    equipment: "other",
    tags: ["full", "compound"],
    defaultIncrementKg: 5,
  },

  // Calisthenics
  {
    id: "muscle_up",
    displayName: "Muscle-Up",
    equipment: "bodyweight",
    tags: ["back", "chest", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 1.0,
  },
  {
    id: "handstand_push_up",
    displayName: "Handstand Push-Up",
    equipment: "bodyweight",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 1.0,
    aliases: ["hspu"],
  },
  {
    id: "archer_push_up",
    displayName: "Archer Push-Up",
    equipment: "bodyweight",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.7,
  },
  {
    id: "one_arm_push_up",
    displayName: "One-Arm Push-Up",
    equipment: "bodyweight",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.5,
  },
  {
    id: "diamond_push_up",
    displayName: "Diamond Push-Up",
    equipment: "bodyweight",
    tags: ["chest", "triceps", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.64,
  },
  {
    id: "decline_push_up",
    displayName: "Decline Push-Up",
    equipment: "bodyweight",
    tags: ["chest", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.7,
  },
  {
    id: "pistol_squat",
    displayName: "Pistol Squat",
    equipment: "bodyweight",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.5,
  },
  {
    id: "l_sit",
    displayName: "L-Sit",
    equipment: "bodyweight",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
    isBodyweight: true,
  },
  {
    id: "dragon_flag",
    displayName: "Dragon Flag",
    equipment: "bodyweight",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
    isBodyweight: true,
  },
  // Machines & Cables
  {
    id: "cable_crossover",
    displayName: "Cable Crossover",
    equipment: "cable",
    tags: ["chest", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "low_cable_fly",
    displayName: "Low Cable Fly",
    equipment: "cable",
    tags: ["chest", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "high_cable_fly",
    displayName: "High Cable Fly",
    equipment: "cable",
    tags: ["chest", "isolation"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "seated_cable_row",
    displayName: "Seated Cable Row",
    equipment: "cable",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "hip_abduction",
    displayName: "Hip Abduction",
    equipment: "machine",
    tags: ["glutes", "isolation"],
    defaultIncrementKg: 5,
  },
  {
    id: "hip_adduction",
    displayName: "Hip Adduction",
    equipment: "machine",
    tags: ["lower", "isolation"],
    defaultIncrementKg: 5,
  },
  {
    id: "smith_row",
    displayName: "Smith Row",
    equipment: "smith",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "smith_overhead_press",
    displayName: "Smith Overhead Press",
    equipment: "smith",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "assisted_pullup",
    displayName: "Assisted Pull-Up",
    equipment: "machine",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 5,
  },
  {
    id: "assisted_dip",
    displayName: "Assisted Dip",
    equipment: "machine",
    tags: ["chest", "triceps", "upper", "compound"],
    defaultIncrementKg: 5,
  },

  // Dumbbell Variations
  {
    id: "cuban_press",
    displayName: "Cuban Press",
    equipment: "dumbbell",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 1,
  },
  {
    id: "z_press",
    displayName: "Z-Press",
    equipment: "dumbbell",
    tags: ["shoulders", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "zottman_curl",
    displayName: "Zottman Curl",
    equipment: "dumbbell",
    tags: ["biceps", "isolation"],
    defaultIncrementKg: 1,
  },
  {
    id: "reverse_lunge",
    displayName: "Reverse Lunge",
    equipment: "dumbbell",
    tags: ["quads", "glutes", "lower", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "lateral_lunge",
    displayName: "Lateral Lunge",
    equipment: "dumbbell",
    tags: ["quads", "glutes", "lower", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "decline_db_press",
    displayName: "Decline DB Press",
    equipment: "dumbbell",
    tags: ["chest", "upper", "compound", "lower_back_friendly"],
    defaultIncrementKg: 2.5,
  },

  // Stretching / Mobility
  {
    id: "dead_hang",
    displayName: "Dead Hang",
    equipment: "bodyweight",
    tags: ["back", "upper"],
    defaultIncrementKg: 0,
  },
  {
    id: "cat_cow",
    displayName: "Cat-Cow",
    equipment: "bodyweight",
    tags: ["core", "lower"],
    defaultIncrementKg: 0,
  },
  {
    id: "pigeon_pose",
    displayName: "Pigeon Pose",
    equipment: "bodyweight",
    tags: ["glutes", "lower"],
    defaultIncrementKg: 0,
  },
  {
    id: "couch_stretch",
    displayName: "Couch Stretch",
    equipment: "bodyweight",
    tags: ["quads", "lower"],
    defaultIncrementKg: 0,
  },
  {
    id: "band_pull_apart",
    displayName: "Band Pull-Apart",
    equipment: "other",
    tags: ["back", "shoulders", "upper"],
    defaultIncrementKg: 0,
  },
  {
    id: "shoulder_dislocations",
    displayName: "Shoulder Dislocations",
    equipment: "other",
    tags: ["shoulders", "upper"],
    defaultIncrementKg: 0,
  },
  {
    id: "hip_circles",
    displayName: "Hip Circles",
    equipment: "bodyweight",
    tags: ["glutes", "lower"],
    defaultIncrementKg: 0,
  },
  {
    id: "ninety_ninety_stretch",
    displayName: "90/90 Stretch",
    equipment: "bodyweight",
    tags: ["glutes", "lower"],
    defaultIncrementKg: 0,
  },

  // Cardio / Conditioning
  {
    id: "rowing_machine",
    displayName: "Rowing Machine",
    equipment: "machine",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "assault_bike",
    displayName: "Assault Bike",
    equipment: "machine",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "battle_ropes",
    displayName: "Battle Ropes",
    equipment: "other",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "jump_rope",
    displayName: "Jump Rope",
    equipment: "other",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "treadmill",
    displayName: "Treadmill",
    equipment: "machine",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "stair_climber",
    displayName: "Stair Climber",
    equipment: "machine",
    tags: ["lower", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "elliptical",
    displayName: "Elliptical",
    equipment: "machine",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "sled_drag",
    displayName: "Sled Drag",
    equipment: "other",
    tags: ["lower", "compound"],
    defaultIncrementKg: 10,
  },
  {
    id: "prowler_push",
    displayName: "Prowler Push",
    equipment: "other",
    tags: ["lower", "compound"],
    defaultIncrementKg: 10,
  },
  {
    id: "ski_erg",
    displayName: "Ski Erg",
    equipment: "machine",
    tags: ["full", "compound"],
    defaultIncrementKg: 0,
  },

  // Specialty
  {
    id: "landmine_row",
    displayName: "Landmine Row",
    equipment: "other",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "landmine_rotation",
    displayName: "Landmine Rotation",
    equipment: "other",
    tags: ["core", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "safety_bar_squat",
    displayName: "Safety Bar Squat",
    equipment: "other",
    tags: ["quads", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "banded_good_morning",
    displayName: "Banded Good Morning",
    equipment: "other",
    tags: ["hamstrings", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 0,
  },
  {
    id: "banded_squat",
    displayName: "Banded Squat",
    equipment: "other",
    tags: ["quads", "lower", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "trx_row",
    displayName: "TRX Row",
    equipment: "other",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 0,
    isBodyweight: true,
    bodyweightFactor: 0.6,
  },
  {
    id: "trx_pike",
    displayName: "TRX Pike",
    equipment: "other",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
    isBodyweight: true,
  },
  {
    id: "trx_fallout",
    displayName: "TRX Fallout",
    equipment: "other",
    tags: ["core", "isolation"],
    defaultIncrementKg: 0,
    isBodyweight: true,
  },
  {
    id: "reverse_hyper",
    displayName: "Reverse Hyper",
    equipment: "machine",
    tags: ["hamstrings", "glutes", "lower", "isolation"],
    defaultIncrementKg: 5,
  },
  {
    id: "forty_five_back_extension",
    displayName: "45-Degree Back Extension",
    equipment: "machine",
    tags: ["hamstrings", "glutes", "lower", "compound"],
    defaultIncrementKg: 0,
  },
  {
    id: "seal_row",
    displayName: "Seal Row",
    equipment: "other",
    tags: ["back", "upper", "compound"],
    defaultIncrementKg: 2.5,
  },
  {
    id: "pendlay_row",
    displayName: "Pendlay Row",
    equipment: "barbell",
    tags: ["back", "upper", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "deficit_deadlift",
    displayName: "Deficit Deadlift",
    equipment: "barbell",
    tags: ["hamstrings", "glutes", "back", "full", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
  },
  {
    id: "stiff_leg_deadlift",
    displayName: "Stiff-Leg Deadlift",
    equipment: "barbell",
    tags: ["hamstrings", "lower", "compound", "lower_back_demanding"],
    defaultIncrementKg: 5,
    aliases: ["sldl"],
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

/**
 * Get the hardcoded alternatives for an exercise from the library.
 * Returns an array of exercise IDs that can substitute this exercise.
 */
export function alternativesFor(id: string): string[] {
  return byId[id]?.alternatives ?? [];
}

export function suggestedAlternates(id: string, limit = 12): ExerciseDef[] {
  const base = byId[id];
  if (!base) return [];
  const baseTags = new Set(base.tags);

  const scored = allExercises().filter((e) => e.id !== id)
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
  const all = allExercises();
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return all;

  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\s_-]+/g, "")
      .replace(/[^a-z0-9]/g, "");

  const nq = normalize(q);

  return all.filter((e) => {
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

  for (const ex of allExercises()) {
    if (normalize(ex.id) === n) return ex.id;
    if (normalize(ex.displayName) === n) return ex.id;
    if ((ex.aliases ?? []).some((a) => normalize(a) === n)) return ex.id;
  }

  return null;
}

// ── Custom exercises ────────────────────────────────────────────────

let customExercises: ExerciseDef[] = [];

export function isCustomExercise(id: string): boolean {
  return id.startsWith("custom_");
}

export function getCustomExercises(): ExerciseDef[] {
  return customExercises;
}

type CustomExRow = {
  id: string;
  display_name: string;
  equipment: string;
  tags: string;
  default_increment_kg: number;
  is_bodyweight: number;
  bodyweight_factor: number | null;
  created_at: string;
};

function rowToExerciseDef(row: CustomExRow): ExerciseDef {
  let tags: ExerciseTag[] = [];
  try { tags = JSON.parse(row.tags || "[]"); } catch {}
  return {
    id: row.id,
    displayName: row.display_name,
    equipment: row.equipment as Equipment,
    tags,
    defaultIncrementKg: row.default_increment_kg,
    isBodyweight: !!row.is_bodyweight,
    bodyweightFactor: row.bodyweight_factor ?? undefined,
  };
}

export async function loadCustomExercises(): Promise<void> {
  await ensureDb();
  const rows = await getDb().getAllAsync<CustomExRow>(
    `SELECT * FROM custom_exercises ORDER BY created_at DESC`
  );
  // Remove old custom entries from byId
  for (const ex of customExercises) {
    delete byId[ex.id];
  }
  customExercises = (rows ?? []).map(rowToExerciseDef);
  // Merge into byId for sync lookup
  for (const ex of customExercises) {
    byId[ex.id] = ex;
  }
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function createCustomExercise(args: {
  displayName: string;
  equipment: Equipment;
  tags: ExerciseTag[];
  defaultIncrementKg: number;
  isBodyweight?: boolean;
  bodyweightFactor?: number;
}): Promise<string> {
  await ensureDb();
  const id = uid("custom");
  await getDb().runAsync(
    `INSERT INTO custom_exercises (id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      args.displayName,
      args.equipment,
      JSON.stringify(args.tags),
      args.defaultIncrementKg,
      args.isBodyweight ? 1 : 0,
      args.bodyweightFactor ?? null,
      new Date().toISOString(),
    ]
  );
  await loadCustomExercises();
  return id;
}

export async function updateCustomExercise(
  id: string,
  args: {
    displayName: string;
    equipment: Equipment;
    tags: ExerciseTag[];
    defaultIncrementKg: number;
    isBodyweight?: boolean;
    bodyweightFactor?: number;
  }
): Promise<void> {
  await ensureDb();
  await getDb().runAsync(
    `UPDATE custom_exercises SET display_name=?, equipment=?, tags=?, default_increment_kg=?, is_bodyweight=?, bodyweight_factor=? WHERE id=?`,
    [
      args.displayName,
      args.equipment,
      JSON.stringify(args.tags),
      args.defaultIncrementKg,
      args.isBodyweight ? 1 : 0,
      args.bodyweightFactor ?? null,
      id,
    ]
  );
  await loadCustomExercises();
}

export async function deleteCustomExercise(id: string): Promise<{ ok: boolean; reason?: string }> {
  await ensureDb();
  const db = getDb();
  // Check usage in programs
  const used = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(1) as c FROM program_day_exercises WHERE ex_id=? OR a_id=? OR b_id=?`,
    [id, id, id]
  );
  if (used && used.c > 0) {
    return { ok: false, reason: "in_use" };
  }
  await db.runAsync(`DELETE FROM custom_exercises WHERE id=?`, [id]);
  await loadCustomExercises();
  return { ok: true };
}

/** Combined list: built-in + custom. Used by search when returning all. */
function allExercises(): ExerciseDef[] {
  return [...EXERCISES, ...customExercises];
}
