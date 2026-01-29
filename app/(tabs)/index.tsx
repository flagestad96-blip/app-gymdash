// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  Switch,
  Vibration,
  Alert,
  AppState,
  Animated,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { theme } from "../../src/theme";
import { ensureDb, getDb, getSettingAsync, setSettingAsync, computeBodyweightLoad } from "../../src/db";
import {
  displayNameFor,
  defaultIncrementFor,
  tagsFor,
  type ExerciseTag,
  isBodyweight,
  bodyweightFactorFor,
} from "../../src/exerciseLibrary";
import ProgramStore from "../../src/programStore";
import type { Program, ProgramBlock, AlternativesMap } from "../../src/programStore";
import ProgressionStore, {
  buildSuggestion,
  defaultTargetForExercise,
  type ExerciseTarget,
  type NextSuggestion,
} from "../../src/progressionStore";
import AppLoading from "../../components/AppLoading";
import OnboardingModal from "../../components/OnboardingModal";
import { Screen, TopBar, Card, Chip, Btn, IconButton, TextField } from "../../src/ui";

type WorkoutRow = {
  id: string;
  date: string;
  program_mode: string;
  program_id?: string | null;
  day_key: string;
  back_status: string;
  notes?: string | null;
  day_index?: number | null;
  started_at?: string | null;
};

type ProgramMode = "normal" | "back";

type SetRow = {
  id: string;
  workout_id: string;
  exercise_name: string;
  set_index: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  exercise_id?: string | null;
  set_type?: string | null;
  is_warmup?: number | null;
  external_load_kg?: number | null;
  bodyweight_kg_used?: number | null;
  bodyweight_factor?: number | null;
  est_total_load_kg?: number | null;
};

type LastSetInfo = {
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  workout_id?: string | null;
};

type PrType = "heaviest" | "e1rm" | "volume";
type SetType = "normal" | "warmup" | "dropset" | "restpause";

type PrRecord = {
  value: number;
  date?: string | null;
  reps?: number | null;
  weight?: number | null;
  setId?: string | null;
};

type PrMap = Record<string, Partial<Record<PrType, PrRecord>>>;

type InputState = {
  weight: string;
  reps: string;
  rpe: string;
};

type RenderBlock =
  | {
      type: "single";
      exId: string;
      baseExId: string;
      anchorKey: string;
    }
  | {
      type: "superset";
      a: string;
      b: string;
      baseA: string;
      baseB: string;
      anchorKey: string;
    };

function AddSetButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => Promise<void> | void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const runPressAnim = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 90, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={async () => {
          runPressAnim();
          await onPress();
        }}
        style={({ pressed }) => ({
          height: 56,
          borderRadius: theme.radius.lg,
          backgroundColor: theme.accent,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Text style={{ color: "#FFFFFF", fontWeight: theme.fontWeight.semibold }}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function isoDateOnly(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function isoNow() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function mmss(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function parseTimeMs(iso: string | null | undefined) {
  if (!iso) return NaN;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function roundWeight(n: number) {
  return Math.round(n * 10) / 10;
}

function formatWeight(n: number) {
  if (!Number.isFinite(n)) return "";
  const r = roundWeight(n);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function epley1RM(weight: number, reps: number) {
  const r = Math.max(1, reps);
  return weight * (1 + r / 30);
}

function isWarmupType(t?: string | null, flag?: number | null) {
  if (flag === 1) return true;
  return t === "warmup";
}

function shortLabel(name: string) {
  const clean = name.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  if (!clean) return name.slice(0, 6).toUpperCase();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 6).toUpperCase();
  return `${parts[0].slice(0, 3)}${parts[1].slice(0, 3)}`.toUpperCase();
}

function recommendedRestSeconds(tags: ExerciseTag[]) {
  if (tags.includes("compound")) return 150;
  if (tags.includes("isolation")) return 90;
  return 120;
}

function setTypeLabel(setType?: string | null, isWarmup?: number | null) {
  if (isWarmup === 1 || setType === "warmup") return "WU";
  if (setType === "dropset") return "DS";
  if (setType === "restpause") return "RP";
  return "";
}

export default function Logg() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [programMode, setProgramMode] = useState<ProgramMode>("normal");
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
  const [suggestedDayIndex, setSuggestedDayIndex] = useState<number>(0);
  const [dayPickerOpen, setDayPickerOpen] = useState<boolean>(false);
  const [program, setProgram] = useState<Program | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativesMap>({});
  const [selectedAlternatives, setSelectedAlternatives] = useState<Record<string, string>>({});

  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [workoutStartedAt, setWorkoutStartedAt] = useState<string | null>(null);
  const [workoutElapsedSec, setWorkoutElapsedSec] = useState<number>(0);
  const [workoutSets, setWorkoutSets] = useState<SetRow[]>([]);

  const [inputs, setInputs] = useState<Record<string, InputState>>({});
  const [setTypes, setSetTypes] = useState<Record<string, SetType>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [lastSets, setLastSets] = useState<Record<string, LastSetInfo>>({});
  const [targets, setTargets] = useState<Record<string, ExerciseTarget>>({});
  const [nextSuggestions, setNextSuggestions] = useState<Record<string, NextSuggestion>>({});
  const [prRecords, setPrRecords] = useState<PrMap>({});
  const [prBanners, setPrBanners] = useState<Record<string, string>>({});
  const [lastAddedSetId, setLastAddedSetId] = useState<string | null>(null);
  const lastAddedAnim = useRef(new Animated.Value(0)).current;

  const [editSetOpen, setEditSetOpen] = useState(false);
  const [editSet, setEditSet] = useState<SetRow | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editRpe, setEditRpe] = useState("");
  const [editType, setEditType] = useState<SetType>("normal");

  const [restEnabled, setRestEnabled] = useState(true);
  const [restSeconds, setRestSeconds] = useState(120);
  const [restRemaining, setRestRemaining] = useState(120);
  const [restRunning, setRestRunning] = useState(false);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restVibrate, setRestVibrate] = useState(false);
  const [restHaptics, setRestHaptics] = useState(true);
  const [restSettingsOpen, setRestSettingsOpen] = useState(false);

  const [supersetAlternate, setSupersetAlternate] = useState(true);
  const [supersetNext, setSupersetNext] = useState<Record<string, "a" | "b">>({});

  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [altPickerOpen, setAltPickerOpen] = useState(false);
  const [altPickerBase, setAltPickerBase] = useState<string | null>(null);

  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView | null>(null);
  const anchorPositionsRef = useRef<Record<string, number>>({});
  const anchorLayoutRef = useRef<Record<string, { y: number; height: number }>>({});
  const scrollYRef = useRef(0);
  const restDoneRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const scrollViewHeightRef = useRef(0);
  const contentHeightRef = useRef(0);
  const pendingAutoScrollRef = useRef<{ cardBottom: number } | null>(null);

  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);

  async function fetchSuggestedDayIndex(programId: string, mode: ProgramMode, dayCount: number) {
    if (dayCount <= 0) return 0;
    try {
      const row = getDb().getFirstSync<{ day_index?: number | null }>(
        `SELECT day_index FROM workouts
         WHERE day_index IS NOT NULL
         AND (
           program_id = ?
           OR ((program_id IS NULL OR program_id = '') AND program_mode = ?)
         )
         ORDER BY started_at DESC, date DESC
         LIMIT 1`,
        [programId, mode]
      );
      const last = Number.isFinite(row?.day_index ?? NaN) ? Number(row?.day_index) : NaN;
      if (!Number.isFinite(last)) return 0;
      return (Math.trunc(last) + 1) % dayCount;
    } catch {
      return 0;
    }
  }

  const loadSession = useCallback(async () => {
    await ensureDb();
    await ProgramStore.ensurePrograms();

    const pmRaw = await getSettingAsync("programMode");
    const pm: ProgramMode = pmRaw === "back" ? "back" : "normal";

    const reRaw = await getSettingAsync("restEnabled");
    const rsRaw = await getSettingAsync("restSeconds");
    const rvRaw = await getSettingAsync("restVibrate");
    const ssRaw = await getSettingAsync("supersetAlternate");
    const rhRaw = await getSettingAsync("restHaptics");
    const reAtRaw = await getSettingAsync("restEndsAt");
    const onboardingRaw = await getSettingAsync("hasSeenOnboarding");

    setProgramMode(pm);

    setRestEnabled(reRaw === null ? true : reRaw === "1");
    setRestSeconds(clampInt(parseInt(rsRaw ?? "120", 10), 10, 600));
    setRestVibrate(rvRaw === "1");
    setRestHaptics(rhRaw === null ? true : rhRaw === "1");

    setSupersetAlternate(ssRaw === null ? true : ssRaw === "1");
    setShowOnboarding(onboardingRaw !== "1");

    const endsAt = reAtRaw ? Number(reAtRaw) : NaN;
    if (Number.isFinite(endsAt) && endsAt > Date.now()) {
      setRestEndsAt(endsAt);
      setRestRunning(true);
      setRestRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    } else {
      setRestEndsAt(null);
      setRestRunning(false);
      setRestRemaining(clampInt(parseInt(rsRaw ?? "120", 10), 10, 600));
    }

    const activeId = await getSettingAsync("activeWorkoutId");
    let activeRow: WorkoutRow | null = null;
    if (activeId) {
      const row = getDb().getFirstSync<WorkoutRow>(
        `SELECT id, started_at, day_index, day_key, program_id FROM workouts WHERE id = ? LIMIT 1`,
        [activeId]
      );
      if (row?.id) {
        activeRow = row;
        setActiveWorkoutId(row.id);
        setWorkoutStartedAt(row.started_at ?? null);
      } else {
        await setSettingAsync("activeWorkoutId", "");
        setActiveWorkoutId(null);
        setWorkoutStartedAt(null);
      }
    } else {
      setActiveWorkoutId(null);
      setWorkoutStartedAt(null);
    }

    const prog = activeRow?.program_id
      ? (await ProgramStore.getProgram(activeRow.program_id)) ?? (await ProgramStore.getActiveProgram(pm))
      : await ProgramStore.getActiveProgram(pm);
    const dayCount = Math.max(1, prog.days.length);
    const suggested = await fetchSuggestedDayIndex(prog.id, pm, dayCount);
    let day = clampInt(suggested, 0, dayCount - 1);
    if (activeRow) {
      const fromIndex = Number.isFinite(activeRow.day_index ?? NaN) ? Number(activeRow.day_index) : NaN;
      let fromKey = NaN;
      if (!Number.isFinite(fromIndex) && activeRow.day_key) {
        const match = String(activeRow.day_key).match(/day_(\d+)/i);
        if (match) fromKey = Number(match[1]) - 1;
      }
      const lockedDay = Number.isFinite(fromIndex) ? fromIndex : Number.isFinite(fromKey) ? fromKey : day;
      day = clampInt(lockedDay, 0, dayCount - 1);
    }
    const alts = await ProgramStore.getAlternativesForProgram(prog.id);

    setProgram(prog);
    setAlternatives(alts);
    setSuggestedDayIndex(suggested);
    setActiveDayIndex(day);
    setSelectedAlternatives({});
  }, []);

  useEffect(() => {
    loadSession().then(() => setReady(true));
  }, [loadSession]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return () => {};
      let alive = true;
      (async () => {
        await loadSession();
        if (!alive) return;
      })();
      return () => {
        alive = false;
      };
    }, [ready, loadSession])
  );

  const dayPlan = useMemo(() => {
    return program?.days[activeDayIndex] ?? null;
  }, [program, activeDayIndex]);

  const renderBlocks = useMemo<RenderBlock[]>(() => {
    if (!dayPlan) return [];
    return dayPlan.blocks.map((b: ProgramBlock, idx: number) => {
      const anchorKey = b.type === "single" ? `ex_${b.exId}_${idx}` : `ss_${b.a}_${b.b}_${idx}`;
      if (b.type === "single") {
        const selected = resolveSelectedExId(b.exId);
        return {
          type: "single",
          exId: selected,
          baseExId: b.exId,
          anchorKey,
        } as RenderBlock;
      }
      const selectedA = resolveSelectedExId(b.a);
      const selectedB = resolveSelectedExId(b.b);
      return {
        type: "superset",
        a: selectedA,
        b: selectedB,
        baseA: b.a,
        baseB: b.b,
        anchorKey,
      } as RenderBlock;
    });
  }, [dayPlan, alternatives, selectedAlternatives, activeDayIndex]);

  const exerciseIds = useMemo(() => {
    const list: string[] = [];
    for (const b of renderBlocks) {
      if (b.type === "single") list.push(b.exId);
      else {
        list.push(b.a, b.b);
      }
    }
    return Array.from(new Set(list));
  }, [renderBlocks]);

  const anchorItems = useMemo(() => {
    return renderBlocks.map((b) => {
      if (b.type === "single") {
        return { key: b.anchorKey, label: displayNameFor(b.exId) };
      }
      return { key: b.anchorKey, label: `${displayNameFor(b.a)} / ${displayNameFor(b.b)}` };
    });
  }, [renderBlocks]);

  const anchorKeyByExerciseId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of renderBlocks) {
      if (b.type === "single") {
        map[b.exId] = b.anchorKey;
      } else {
        map[b.a] = b.anchorKey;
        map[b.b] = b.anchorKey;
      }
    }
    return map;
  }, [renderBlocks]);

  const blockAnchorKeys = useMemo(() => {
    return renderBlocks.map((b) => b.anchorKey);
  }, [renderBlocks]);

  const setsByExercise = useMemo(() => {
    const map: Record<string, SetRow[]> = {};
    for (const s of workoutSets) {
      const key = (s.exercise_id && String(s.exercise_id)) || s.exercise_name;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.set_index - b.set_index);
    }
    return map;
  }, [workoutSets]);

  const recommendedForFocus = useMemo(() => {
    const exId = focusedExerciseId ?? exerciseIds[0];
    if (!exId) return null;
    const seconds = recommendedRestSeconds(tagsFor(exId));
    return { exId, seconds };
  }, [focusedExerciseId, exerciseIds]);

  function stopRestTimer() {
    setRestRunning(false);
    setRestEndsAt(null);
    restDoneRef.current = false;
    setRestRemaining(restSeconds);
    setSettingAsync("restEndsAt", "").catch(() => {});
  }

  function startRestTimer(seconds = restSeconds) {
    if (!restEnabled) return;
    const end = Date.now() + Math.max(0, Math.floor(seconds)) * 1000;
    setRestEndsAt(end);
    setRestRunning(true);
    restDoneRef.current = false;
    setRestRemaining(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    setSettingAsync("restEndsAt", String(end)).catch(() => {});
  }

  useEffect(() => {
    setSupersetNext({});
  }, [activeDayIndex, program?.id, programMode]);

  useEffect(() => {
    setSelectedAlternatives({});
  }, [activeDayIndex, program?.id]);

  const refreshWorkoutSets = useCallback(() => {
    if (!activeWorkoutId) {
      setWorkoutSets([]);
      return;
    }
    const rows = getDb().getAllSync<SetRow>(
      `SELECT id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id, set_type, is_warmup,
              external_load_kg, bodyweight_kg_used, bodyweight_factor, est_total_load_kg
       FROM sets
       WHERE workout_id = ?
       ORDER BY set_index ASC, created_at ASC`,
      [activeWorkoutId]
    );
    setWorkoutSets(Array.isArray(rows) ? rows : []);
  }, [activeWorkoutId]);

  useEffect(() => {
    if (!ready) return;
    refreshWorkoutSets();
  }, [ready, activeWorkoutId, refreshWorkoutSets]);

  useEffect(() => {
    if (!workoutStartedAt) {
      setWorkoutElapsedSec(0);
      return;
    }
    const start = parseTimeMs(workoutStartedAt);
    if (!Number.isFinite(start)) return;

    const tick = () => {
      const now = Date.now();
      setWorkoutElapsedSec(Math.max(0, Math.floor((now - start) / 1000)));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [workoutStartedAt]);

  const fireHapticLight = useCallback(async () => {
    if (!restHaptics || Platform.OS === "web") return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  }, [restHaptics]);

  const fireHapticDone = useCallback(async () => {
    if (!restHaptics || Platform.OS === "web") return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } catch {}
    }
  }, [restHaptics]);

  useEffect(() => {
    if (!restRunning || !restEndsAt) return;
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      setRestRemaining(remaining);
      if (remaining === 0 && !restDoneRef.current) {
        restDoneRef.current = true;
        setRestRunning(false);
        setRestEndsAt(null);
        setSettingAsync("restEndsAt", "").catch(() => {});
        if (restVibrate && Platform.OS !== "web") {
          Vibration.vibrate(300);
        }
        fireHapticDone();
      }
    }, 500);
    return () => clearInterval(id);
  }, [restRunning, restEndsAt, restVibrate, fireHapticDone]);

  useEffect(() => {
    if (!restRunning) setRestRemaining(restSeconds);
  }, [restSeconds, restRunning]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        if (restEndsAt) {
          const remaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
          setRestRemaining(remaining);
          if (remaining === 0 && !restDoneRef.current) {
            restDoneRef.current = true;
            setRestRunning(false);
            setRestEndsAt(null);
            setSettingAsync("restEndsAt", "").catch(() => {});
          }
        }
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [restEndsAt]);


  const exerciseIdsKey = useMemo(() => exerciseIds.join("|"), [exerciseIds]);

  useEffect(() => {
    if (!program?.id || exerciseIds.length === 0) return;
    let alive = true;
    (async () => {
      await ProgressionStore.ensureTargets(program.id, exerciseIds);
      const targetMap = await ProgressionStore.getTargets(program.id);
      if (!alive) return;
      setTargets(targetMap);
    })();
    return () => {
      alive = false;
    };
  }, [program?.id, exerciseIdsKey, exerciseIds]);

  useEffect(() => {
    if (exerciseIds.length === 0) {
      setExerciseNotes({});
      return;
    }
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        exerciseIds.map(async (exId) => {
          const key = `exercise_note_${exId}`;
          const val = await getSettingAsync(key);
          return [exId, val ?? ""] as const;
        })
      );
      if (!alive) return;
      const map: Record<string, string> = {};
      for (const [exId, note] of entries) {
        map[exId] = note;
      }
      setExerciseNotes(map);
    })();
    return () => {
      alive = false;
    };
  }, [exerciseIdsKey, exerciseIds]);

  useEffect(() => {
    if (!program?.id || exerciseIds.length === 0) {
      setPrRecords({});
      return;
    }
    try {
      const placeholders = exerciseIds.map(() => "?").join(",");
      const params: (string | number)[] = [...exerciseIds, program.id];
      const rows = getDb().getAllSync<{
        exercise_id: string;
        type: string;
        value: number;
        reps?: number | null;
        weight?: number | null;
        set_id?: string | null;
        date?: string | null;
      }>(
        `SELECT exercise_id, type, value, reps, weight, set_id, date
         FROM pr_records
         WHERE exercise_id IN (${placeholders}) AND program_id = ?`,
        params
      );
      const map: PrMap = {};
      for (const r of rows ?? []) {
        const exId = String(r.exercise_id);
        if (!map[exId]) map[exId] = {};
        const t = r.type as PrType;
        map[exId][t] = {
          value: r.value,
          date: r.date ?? null,
          reps: r.reps ?? null,
          weight: r.weight ?? null,
          setId: r.set_id ?? null,
        };
      }
      setPrRecords(map);
    } catch {
      setPrRecords({});
    }
  }, [program?.id, exerciseIdsKey, exerciseIds]);

  useEffect(() => {
    if (!ready || exerciseIds.length === 0) {
      setLastSets({});
      setNextSuggestions({});
      return;
    }

    try {
      const placeholders = exerciseIds.map(() => "?").join(",");
      const params: (string | number)[] = [...exerciseIds];
      const where = `exercise_id IN (${placeholders})`;

      const rows = getDb().getAllSync<SetRow>(
        `SELECT workout_id, exercise_id, exercise_name, weight, reps, rpe, created_at, set_type, is_warmup
         FROM sets
         WHERE ${where}
         ORDER BY created_at DESC`,
        params
      );

      const last: Record<string, LastSetInfo> = {};
      for (const r of rows ?? []) {
        if (isWarmupType(r.set_type ?? null, r.is_warmup ?? null)) continue;
        const key = r.exercise_id ? String(r.exercise_id) : "";
        if (!key || last[key]) continue;
        last[key] = {
          weight: r.weight,
          reps: r.reps,
          rpe: r.rpe ?? null,
          created_at: r.created_at,
          workout_id: r.workout_id,
        };
      }
      setLastSets(last);

      const sugg: Record<string, NextSuggestion> = {};
      for (const [exId, info] of Object.entries(last)) {
        const target = targets[exId] ?? {
          programId: program?.id ?? "",
          exerciseId: exId,
          ...defaultTargetForExercise(exId),
          updatedAt: "",
        };
        const next = buildSuggestion({
          lastSet: { weight: info.weight, reps: info.reps, rpe: info.rpe },
          repMin: target.repMin,
          repMax: target.repMax,
          incrementKg: target.incrementKg,
        });
        if (next) sugg[exId] = next;
      }
      setNextSuggestions(sugg);
    } catch {
      setLastSets({});
      setNextSuggestions({});
    }
  }, [ready, exerciseIdsKey, exerciseIds, targets, program?.id]);

  function buildCoachHint(exId: string) {
    const last = lastSets[exId];
    if (!last) return null;
    const target = getTargetFor(exId);
    const rpe = last.rpe ?? null;
    if (rpe != null && rpe >= 9) return "Hold vekt â€“ prioriter kontroll/reps";
    if (last.reps >= target.repMax) return "Neste økt: øk vekt litt";
    if (last.reps < target.repMin - 1) return "Vurder å redusere vekt";
    if (last.reps < target.repMin) return "Bygg reps innen range";
    return "Fortsett å bygge reps";
  }

  useEffect(() => {
    if (!Object.keys(lastSets).length) return;
    setInputs((prev) => {
      const next = { ...prev };
      for (const [exId, info] of Object.entries(lastSets)) {
        const current = next[exId];
        const empty = !current || (!current.weight && !current.reps && !current.rpe);
        if (!empty) continue;
        next[exId] = {
          weight: formatWeight(info.weight),
          reps: String(info.reps),
          rpe: info.rpe != null ? String(info.rpe) : "",
        };
      }
      return next;
    });
  }, [lastSets]);

  function getTargetFor(exId: string) {
    const target = targets[exId];
    if (target) return target;
    const fallback = defaultTargetForExercise(exId);
    return {
      programId: program?.id ?? "",
      exerciseId: exId,
      repMin: fallback.repMin,
      repMax: fallback.repMax,
      incrementKg: fallback.incrementKg,
      updatedAt: "",
    } as ExerciseTarget;
  }

  function getIncrementForExercise(exId: string) {
    const target = targets[exId];
    if (target && target.incrementKg > 0) return target.incrementKg;
    const inc = defaultIncrementFor(exId);
    return inc > 0 ? inc : 2.5;
  }

  function resolveSelectedExId(baseExId: string) {
    const altList = alternatives[activeDayIndex]?.[baseExId] ?? [];
    const selected = selectedAlternatives[baseExId];
    if (selected && (selected === baseExId || altList.includes(selected))) return selected;
    return baseExId;
  }

  function setInput(exId: string, field: keyof InputState, value: string) {
    setInputs((prev) => {
      const base = prev[exId] ?? { weight: "", reps: "", rpe: "" };
      return {
        ...prev,
        [exId]: {
          ...base,
          [field]: value,
        },
      };
    });
  }

  function applyWeightStep(exId: string, delta: number) {
    const current = parseFloat(inputs[exId]?.weight ?? "");
    const next = Number.isFinite(current) ? current + delta : delta;
    const clamped = Math.max(0, next);
    setInput(exId, "weight", formatWeight(clamped));
  }

  function applyLastSet(exId: string) {
    const last = lastSets[exId];
    if (!last) return;
    setInputs((prev) => ({
      ...prev,
      [exId]: {
        weight: formatWeight(last.weight),
        reps: String(last.reps),
        rpe: last.rpe != null ? String(last.rpe) : "",
      },
    }));
  }

  function applySuggestion(exId: string) {
    const sugg = nextSuggestions[exId];
    if (!sugg) return;
    setInputs((prev) => ({
      ...prev,
      [exId]: {
        weight: formatWeight(sugg.weight),
        reps: String(sugg.reps),
        rpe: "",
      },
    }));
  }

  function setSetType(exId: string, t: SetType) {
    setSetTypes((prev) => ({ ...prev, [exId]: t }));
  }

  function openAltPicker(baseExId: string) {
    const list = alternatives[activeDayIndex]?.[baseExId] ?? [];
    if (!list.length) return;
    setAltPickerBase(baseExId);
    setAltPickerOpen(true);
  }

  function chooseAlternative(baseExId: string, exId: string) {
    setSelectedAlternatives((prev) => {
      const next = { ...prev };
      if (exId === baseExId) {
        delete next[baseExId];
      } else {
        next[baseExId] = exId;
      }
      return next;
    });
    setAltPickerOpen(false);
    setAltPickerBase(null);
  }

  function dayKeyForIndex(idx: number) {
    return `day_${idx + 1}`;
  }

  function getDayKey() {
    return dayKeyForIndex(activeDayIndex);
  }

  function selectDayIndex(i: number) {
    if (activeWorkoutId) {
      Alert.alert("Låst under aktiv økt", "Avslutt økten før du bytter dag.");
      return;
    }
    setActiveDayIndex(i);
  }

  function scrollToAnchorKey(key: string) {
    const y = anchorPositionsRef.current[key];
    if (!Number.isFinite(y)) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  }

  function scrollToExerciseBottom(exId: string) {
    const key = anchorKeyByExerciseId[exId];
    if (!key) return;
    const layout = anchorLayoutRef.current[key];
    const viewport = scrollViewHeightRef.current || 0;
    if (!layout || !Number.isFinite(layout.y) || !Number.isFinite(layout.height) || viewport <= 0) {
      return;
    }
    const target = Math.max(0, layout.y + layout.height - viewport + 16);
    scrollRef.current?.scrollTo({ y: target, animated: true });
  }

  function focusExercise(exId: string, opts?: { scroll?: boolean }) {
    setFocusedExerciseId(exId);
    if (!opts?.scroll) return;
    const key = anchorKeyByExerciseId[exId];
    if (key) scrollToAnchorKey(key);
  }

  function scrollToNextExercise() {
    const positions = anchorPositionsRef.current;
    const list = blockAnchorKeys
      .map((k) => ({ key: k, y: positions[k] ?? 0 }))
      .sort((a, b) => a.y - b.y);

    if (list.length === 0) return;

    const current = scrollYRef.current + 24;
    const next = list.find((item) => item.y > current);
    scrollToAnchorKey((next ?? list[0]).key);
  }

  async function startWorkout() {
    if (activeWorkoutId) return;

    const id = uid("workout");
    const startedAt = isoNow();
    const programId = program?.id ?? null;

    await getDb().runAsync(
      `INSERT INTO workouts(id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, isoDateOnly(), programMode, programId, getDayKey(), "green", "", activeDayIndex, startedAt]
    );

    await setSettingAsync("activeWorkoutId", id);
    setActiveWorkoutId(id);
    setWorkoutStartedAt(startedAt);
    setWorkoutSets([]);
  }

  async function endWorkout() {
    if (!activeWorkoutId) return;
    const programId = program?.id ?? "";
    const dayCount = Math.max(1, program?.days.length ?? 1);
    const nextIdx = (activeDayIndex + 1) % dayCount;
    try {
      await getDb().runAsync(
        `UPDATE workouts SET day_key = ?, day_index = ?, program_id = ? WHERE id = ?`,
        [dayKeyForIndex(activeDayIndex), activeDayIndex, programId || null, activeWorkoutId]
      );
    } catch {}

    if (programId) {
      await setSettingAsync(`lastCompletedDayIndex_${programId}`, String(activeDayIndex));
      await setSettingAsync(`nextSuggestedDayIndex_${programId}`, String(nextIdx));
    }

    await setSettingAsync("activeWorkoutId", "");
    setActiveWorkoutId(null);
    setWorkoutStartedAt(null);
    setWorkoutElapsedSec(0);
    setWorkoutSets([]);
    setSuggestedDayIndex(nextIdx);
    setActiveDayIndex(nextIdx);
  }

  function flashSetRow(id: string) {
    setLastAddedSetId(id);
    lastAddedAnim.stopAnimation();
    lastAddedAnim.setValue(1);
    Animated.timing(lastAddedAnim, {
      toValue: 0,
      duration: 650,
      useNativeDriver: false,
    }).start(() => {
      setLastAddedSetId((prev) => (prev === id ? null : prev));
    });
  }

  async function addSetForExercise(exId: string, forcedIndex?: number) {
    if (!activeWorkoutId) {
      Alert.alert("Start økt", "Du må starte økten for du logger sett.");
      return;
    }

    const input = inputs[exId] ?? { weight: "", reps: "", rpe: "" };
    const isBw = isBodyweight(exId);
    const parsedWeight = parseFloat(input.weight);
    const weight = Number.isFinite(parsedWeight) ? parsedWeight : isBw ? 0 : NaN;
    const reps = parseInt(input.reps, 10);

    if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
      Alert.alert("Mangler data", "Fyll inn vekt og reps forst.");
      return;
    }

    const rpe = parseFloat(input.rpe);
    const setIndex = Number.isFinite(forcedIndex)
      ? Number(forcedIndex)
      : (setsByExercise[exId]?.length ?? 0);

    const setType = setTypes[exId] ?? "normal";
    const isWarmup = setType === "warmup" ? 1 : 0;

    const bwData = await computeBodyweightLoad(exId, isoDateOnly(), weight);
    const row: SetRow = {
      id: uid("set"),
      workout_id: activeWorkoutId,
      exercise_name: displayNameFor(exId),
      set_index: setIndex,
      weight,
      reps,
      rpe: Number.isFinite(rpe) ? rpe : null,
      created_at: isoNow(),
      exercise_id: exId,
      set_type: setType,
      is_warmup: isWarmup,
      external_load_kg: bwData.external_load_kg,
      bodyweight_kg_used: bwData.bodyweight_kg_used,
      bodyweight_factor: bwData.bodyweight_factor,
      est_total_load_kg: bwData.est_total_load_kg,
    };

    await getDb().runAsync(
      `INSERT INTO sets(
         id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id, set_type, is_warmup,
         external_load_kg, bodyweight_kg_used, bodyweight_factor, est_total_load_kg
       )
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.workout_id,
        row.exercise_name,
        row.set_index,
        row.weight,
        row.reps,
        row.rpe ?? null,
        row.created_at,
        row.exercise_id ?? null,
        row.set_type ?? null,
        row.is_warmup ?? 0,
        row.external_load_kg ?? 0,
        row.bodyweight_kg_used ?? null,
        row.bodyweight_factor ?? null,
        row.est_total_load_kg ?? null,
      ]
    );

    const key = anchorKeyByExerciseId[exId];
    if (key) {
      const card = anchorLayoutRef.current[key];
      if (card) pendingAutoScrollRef.current = { cardBottom: card.y + card.height };
    }
    setWorkoutSets((prev) => [...prev, row]);
    flashSetRow(row.id);
    fireHapticLight();
    startRestTimer(restSeconds);
    Keyboard.dismiss();

    if (!isWarmup) {
      const programId = program?.id ?? "";
      const dateOnly = row.created_at ? row.created_at.slice(0, 10) : isoDateOnly();
      const prWeight = isBw && row.est_total_load_kg != null ? row.est_total_load_kg : weight;
      const e1rm = round1(epley1RM(prWeight, reps));
      const volume = round1(prWeight * reps);
      const current = prRecords[exId] ?? {};
      const nextMap: Partial<Record<PrType, PrRecord>> = { ...current };
      const messages: string[] = [];

      if (!current.heaviest || prWeight > (current.heaviest.value ?? 0)) {
        nextMap.heaviest = { value: prWeight, date: dateOnly, reps, weight: prWeight, setId: row.id };
        messages.push(`Ny tungeste: ${formatWeight(prWeight)} kg`);
      }
      if (!current.e1rm || e1rm > (current.e1rm.value ?? 0)) {
        nextMap.e1rm = { value: e1rm, date: dateOnly, reps, weight: prWeight, setId: row.id };
        messages.push(`Ny e1RM PR: ${formatWeight(e1rm)} kg`);
      }
      if (!current.volume || volume > (current.volume.value ?? 0)) {
        nextMap.volume = { value: volume, date: dateOnly, reps, weight: prWeight, setId: row.id };
        messages.push(`Ny volum PR: ${formatWeight(volume)}`);
      }

      if (messages.length) {
        try {
          const db = getDb();
          if (nextMap.heaviest && (!current.heaviest || nextMap.heaviest.value !== current.heaviest.value)) {
            await db.runAsync(
              `INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id)
               VALUES(?, 'heaviest', ?, ?, ?, ?, ?, ?)`,
              [exId, nextMap.heaviest.value, reps, prWeight, row.id, dateOnly, programId]
            );
          }
          if (nextMap.e1rm && (!current.e1rm || nextMap.e1rm.value !== current.e1rm.value)) {
            await db.runAsync(
              `INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id)
               VALUES(?, 'e1rm', ?, ?, ?, ?, ?, ?)`,
              [exId, nextMap.e1rm.value, reps, prWeight, row.id, dateOnly, programId]
            );
          }
          if (nextMap.volume && (!current.volume || nextMap.volume.value !== current.volume.value)) {
            await db.runAsync(
              `INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id)
               VALUES(?, 'volume', ?, ?, ?, ?, ?, ?)`,
              [exId, nextMap.volume.value, reps, prWeight, row.id, dateOnly, programId]
            );
          }
        } catch {}

        setPrRecords((prev) => ({ ...prev, [exId]: nextMap }));
        const bannerText = messages.join(" Â· ");
        setPrBanners((prev) => ({ ...prev, [exId]: bannerText }));
        setTimeout(() => {
          setPrBanners((prev) => {
            const next = { ...prev };
            if (next[exId] === bannerText) delete next[exId];
            return next;
          });
        }, 3500);
      }
    }

    setLastSets((prev) => ({
      ...prev,
      [exId]: {
        weight: row.weight,
        reps: row.reps,
        rpe: row.rpe ?? null,
        created_at: row.created_at,
        workout_id: row.workout_id,
      },
    }));

    const target = getTargetFor(exId);
    const next = buildSuggestion({
      lastSet: { weight: row.weight, reps: row.reps, rpe: row.rpe },
      repMin: target.repMin,
      repMax: target.repMax,
      incrementKg: target.incrementKg,
    });
    setNextSuggestions((prev) => ({
      ...prev,
      ...(next ? { [exId]: next } : {}),
    }));

    if (restEnabled) {
      startRestTimer(restSeconds);
    }
  }

  async function addSetForSuperset(block: Extract<RenderBlock, { type: "superset" }>) {
    const key = block.anchorKey;
    const next = supersetAlternate ? (supersetNext[key] ?? "a") : "a";
    const exId = next === "a" ? block.a : block.b;

    await addSetForExercise(exId);

    if (supersetAlternate) {
      setSupersetNext((prev) => ({
        ...prev,
        [key]: next === "a" ? "b" : "a",
      }));
      const nextExId = next === "a" ? block.b : block.a;
      setTimeout(() => {
        focusExercise(nextExId, { scroll: true });
      }, 50);
    }
  }

  async function addSetMultiple(exId: string, count: number) {
    const base = setsByExercise[exId]?.length ?? 0;
    for (let i = 0; i < count; i += 1) {
      await addSetForExercise(exId, base + i);
    }
  }

  function openEditSet(row: SetRow) {
    setEditSet(row);
    setEditWeight(String(row.weight ?? ""));
    setEditReps(String(row.reps ?? ""));
    setEditRpe(row.rpe != null ? String(row.rpe) : "");
    const type = row.is_warmup === 1 ? "warmup" : (row.set_type as SetType) ?? "normal";
    setEditType(type);
    setEditSetOpen(true);
  }

  async function saveEditSet() {
    if (!editSet) return;
    const isBw = editSet.exercise_id ? isBodyweight(editSet.exercise_id) : false;
    const parsedWeight = parseFloat(editWeight);
    const weight = Number.isFinite(parsedWeight) ? parsedWeight : isBw ? 0 : NaN;
    const reps = parseInt(editReps, 10);
    const rpe = parseFloat(editRpe);
    if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
      Alert.alert("Mangler data", "Fyll inn vekt og reps.");
      return;
    }
    const isWarmup = editType === "warmup" ? 1 : 0;
    try {
      if (isBw && editSet.exercise_id) {
        const dateOnly = editSet.created_at ? editSet.created_at.slice(0, 10) : isoDateOnly();
        const bwData = await computeBodyweightLoad(editSet.exercise_id, dateOnly, weight);
        await getDb().runAsync(
          `UPDATE sets SET weight = ?, reps = ?, rpe = ?, set_type = ?, is_warmup = ?,
            external_load_kg = ?, bodyweight_kg_used = ?, bodyweight_factor = ?, est_total_load_kg = ?
           WHERE id = ?`,
          [
            weight,
            reps,
            Number.isFinite(rpe) ? rpe : null,
            editType,
            isWarmup,
            bwData.external_load_kg ?? 0,
            bwData.bodyweight_kg_used ?? null,
            bwData.bodyweight_factor ?? null,
            bwData.est_total_load_kg ?? null,
            editSet.id,
          ]
        );
      } else {
        await getDb().runAsync(
          `UPDATE sets SET weight = ?, reps = ?, rpe = ?, set_type = ?, is_warmup = ? WHERE id = ?`,
          [
            weight,
            reps,
            Number.isFinite(rpe) ? rpe : null,
            editType,
            isWarmup,
            editSet.id,
          ]
        );
      }
      refreshWorkoutSets();
    } catch {
      Alert.alert("Feil", "Kunne ikke oppdatere sett.");
    } finally {
      setEditSetOpen(false);
      setEditSet(null);
    }
  }

  async function deleteSet(row: SetRow) {
    Alert.alert("Slette sett?", "Dette kan ikke angres.", [
      { text: "Avbryt", style: "cancel" },
      {
        text: "Slett",
        style: "destructive",
        onPress: async () => {
          try {
            await getDb().runAsync(`DELETE FROM sets WHERE id = ?`, [row.id]);
            refreshWorkoutSets();
          } catch {
            Alert.alert("Feil", "Kunne ikke slette sett.");
          }
        },
      },
    ]);
  }

  function renderSetTable(sets: SetRow[]) {
    if (sets.length === 0) {
      return (
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
          Ingen sett enda.
        </Text>
      );
    }

    return (
      <View style={{ gap: theme.space.xs }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: theme.space.sm,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: theme.radius.md,
            backgroundColor: theme.panel2,
            borderWidth: 1,
            borderColor: theme.line,
          }}
        >
          <Text style={{ width: 28, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>#</Text>
          <Text style={{ flex: 1, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>KG</Text>
          <Text style={{ width: 44, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>REPS</Text>
          <Text style={{ width: 48, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>TYPE</Text>
          <View style={{ width: 70 }} />
        </View>
        {sets.map((s) => {
          const badge = setTypeLabel(s.set_type ?? null, s.is_warmup ?? null);
          const isBw = s.exercise_id ? isBodyweight(s.exercise_id) : false;
          const bwFactor = s.bodyweight_factor ?? (s.exercise_id ? bodyweightFactorFor(s.exercise_id) : 1);
          const ext = Number.isFinite(s.external_load_kg ?? NaN) ? (s.external_load_kg as number) : s.weight ?? 0;
          const bwInfo =
            isBw && s.est_total_load_kg != null && s.bodyweight_kg_used != null
              ? `BW ${formatWeight(s.bodyweight_kg_used)}×${bwFactor} + ${formatWeight(ext)} = ${formatWeight(s.est_total_load_kg)}`
              : isBw
                ? "BW: mangler – legg inn i Kropp"
                : null;
          const highlight = s.id === lastAddedSetId;
          const highlightBg = lastAddedAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [theme.panel, "rgba(99,102,241,0.22)"],
          });
          return (
            <Animated.View
              key={s.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: theme.space.sm,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: theme.radius.md,
                borderWidth: 1,
                borderColor: theme.line,
                backgroundColor: highlight ? highlightBg : theme.panel,
              }}
              >
              <Text style={{ width: 28, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
                {s.set_index + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: theme.fontWeight.semibold }}>
                  {formatWeight(s.weight)}
                </Text>
                {bwInfo ? (
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
                    {bwInfo}
                  </Text>
                ) : null}
              </View>
              <View style={{ width: 44 }}>
                <Text style={{ color: theme.text, fontWeight: theme.fontWeight.medium }}>{s.reps}</Text>
                {s.rpe != null ? (
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
                    @{s.rpe}
                  </Text>
                ) : null}
              </View>
              <View style={{ width: 48, alignItems: "flex-start" }}>
                {badge ? (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 3,
                      borderRadius: theme.radius.pill,
                      backgroundColor: "#E0E7FF",
                      borderWidth: 1,
                      borderColor: theme.accent,
                    }}
                  >
                    <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
                      {badge}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>—</Text>
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <IconButton icon="edit" onPress={() => openEditSet(s)} />
                <IconButton icon="delete-outline" onPress={() => deleteSet(s)} tone="danger" />
              </View>
            </Animated.View>
          );
        })}
      </View>
    );
  }

  const restLabel = restEnabled ? mmss(restRemaining) : "REST AV";
  const quickExerciseId = focusedExerciseId ?? exerciseIds[0];

  function completeOnboarding() {
    setSettingAsync("hasSeenOnboarding", "1").catch(() => {});
    setShowOnboarding(false);
  }

  if (!ready || !program || !dayPlan) {
    return <AppLoading />;
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 40 : 0}
      >
        <ScrollView
          ref={scrollRef}
          onLayout={(e) => {
            scrollViewHeightRef.current = e.nativeEvent.layout.height;
          }}
          onContentSizeChange={(_w, h) => {
            const prev = contentHeightRef.current;
            contentHeightRef.current = h;
            const pending = pendingAutoScrollRef.current;
            if (!pending || h <= prev) return;
            const viewport = scrollViewHeightRef.current || 0;
            const visibleBottom = scrollYRef.current + viewport - 16;
            if (pending.cardBottom <= visibleBottom + 8) {
              const delta = h - prev;
              scrollRef.current?.scrollTo({ y: scrollYRef.current + delta, animated: true });
            }
            pendingAutoScrollRef.current = null;
          }}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={{
            padding: theme.space.lg,
            gap: theme.space.md,
            paddingBottom: theme.space.xl,
          }}
        >
          <TopBar
            title="Logg"
            subtitle="Klar for økt"
            left={<IconButton icon="menu" onPress={openDrawer} />}
            right={
              <IconButton icon="settings" onPress={() => setRestSettingsOpen(true)} />
            }
          />

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip text={programMode === "back" ? "Ryggvennlig" : "Standard"} />
            <Chip
              text={`Dag: ${activeDayIndex + 1}`}
              active
              onPress={() => {
                if (activeWorkoutId) {
                  Alert.alert("Låst under aktiv økt", "Avslutt økten før du bytter dag.");
                  return;
                }
                setDayPickerOpen(true);
              }}
            />
            <Chip text={activeWorkoutId ? "Aktiv økt" : "Ingen økt"} />
          </View>

          <Card title="ØKT" style={{ borderColor: theme.accent, backgroundColor: theme.panel2 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>Varighet</Text>
                <Text style={{ color: theme.text, fontSize: 18, fontFamily: theme.mono }}>{mmss(workoutElapsedSec)}</Text>
              </View>
              {activeWorkoutId ? (
                <Btn label="Avslutt økt" onPress={endWorkout} tone="danger" />
              ) : (
                <Btn label="Start økt" onPress={startWorkout} tone="accent" />
              )}
            </View>
            <Text style={{ color: theme.muted }}>
              Start økten for å logge sett. Varighet lagres automatisk.
            </Text>
          </Card>

          <Card title="DAG">
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
              Neste forslag: Dag {suggestedDayIndex + 1}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(program?.days ?? []).map((_, i) => (
                <Chip
                  key={`day_${i}`}
                  text={`Dag ${i + 1}`}
                  active={activeDayIndex === i}
                  onPress={() => selectDayIndex(i)}
                />
              ))}
            </View>
          </Card>

          <Card title="HOPP TIL">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {anchorItems.map((item) => (
                <Chip
                  key={item.key}
                  text={shortLabel(item.label)}
                  onPress={() => scrollToAnchorKey(item.key)}
                />
              ))}
            </ScrollView>
          </Card>

          <View style={{ gap: 12 }}>
            {renderBlocks.map((block, idx) => {
              if (block.type === "single") {
                const exId = block.exId;
                const last = lastSets[exId];
                const sugg = nextSuggestions[exId];
                const inc = getIncrementForExercise(exId);
                const target = getTargetFor(exId);
                const steps = [-inc, inc, inc * 2];
                const current = inputs[exId] ?? { weight: "", reps: "", rpe: "" };
                const sets = setsByExercise[exId] ?? [];
                const prBanner = prBanners[exId];
                const altList = alternatives[activeDayIndex]?.[block.baseExId] ?? [];

                return (
                  <View
                    key={block.anchorKey}
                    onLayout={(e) => {
                      anchorPositionsRef.current[block.anchorKey] = e.nativeEvent.layout.y;
                      anchorLayoutRef.current[block.anchorKey] = {
                        y: e.nativeEvent.layout.y,
                        height: e.nativeEvent.layout.height,
                      };
                    }}
                    style={{
                      borderColor: theme.line,
                      borderWidth: 1,
                      borderRadius: 16,
                      backgroundColor: theme.panel,
                      padding: 14,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ color: theme.text, fontSize: 16 }}>{displayNameFor(exId)}</Text>
                      {altList.length ? (
                        <Pressable
                          onPress={() => openAltPicker(block.baseExId)}
                          style={{
                            borderColor: theme.line,
                            borderWidth: 1,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: theme.panel2,
                          }}
                        >
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>ALT</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {block.baseExId !== exId ? (
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                        Alternativ for {displayNameFor(block.baseExId)}
                      </Text>
                    ) : null}

                    <View style={{ gap: 4 }}>
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                        Mål: {target.targetSets} sett × {target.repMin}-{target.repMax} reps (+{formatWeight(target.incrementKg)}kg)
                      </Text>
                      {last ? (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                          Sist: {formatWeight(last.weight)}x{last.reps} ({last.created_at.slice(0, 10)})
                        </Text>
                      ) : null}
                      {sugg ? (
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                            Forslag: {formatWeight(sugg.weight)}x{sugg.reps}
                          </Text>
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                            {sugg.reason}
                          </Text>
                          <Pressable
                            onPress={() => applySuggestion(exId)}
                            style={{
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: theme.panel2,
                            }}
                          >
                            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }}>
                              Bruk forslag
                            </Text>
                          </Pressable>
                        </View>
                      ) : null}
                      {buildCoachHint(exId) ? (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                          Hint: {buildCoachHint(exId)}
                        </Text>
                      ) : null}
                      {last ? (
                        <Pressable
                          onPress={() => applyLastSet(exId)}
                          style={{
                            borderColor: theme.line,
                            borderWidth: 1,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: theme.panel2,
                            alignSelf: "flex-start",
                          }}
                        >
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                            Bruk sist
                          </Text>
                        </Pressable>
                      ) : null}
                      {prBanner ? (
                        <View
                          style={{
                            borderColor: theme.accent,
                            borderWidth: 1,
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: theme.panel2,
                            alignSelf: "flex-start",
                          }}
                        >
                          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }}>
                            {prBanner}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {(["normal", "warmup", "dropset", "restpause"] as SetType[]).map((t) => (
                        <Pressable
                          key={`${block.anchorKey}_type_${t}`}
                          onPress={() => setSetType(exId, t)}
                          style={{
                            borderColor: setTypes[exId] === t ? theme.accent : theme.line,
                            borderWidth: 1,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: theme.panel2,
                          }}
                        >
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                            {t}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <>
                      <TextField
                        value={exerciseNotes[exId] ?? ""}
                          onChangeText={(v) =>
                            setExerciseNotes((prev) => ({ ...prev, [exId]: v }))
                          }
                          onBlur={() => {
                            const key = `exercise_note_${exId}`;
                            const val = exerciseNotes[exId] ?? "";
                            setSettingAsync(key, val).catch(() => {});
                          }}
                          onFocus={() => {
                            focusExercise(exId);
                          }}
                          placeholder="Notat..."
                          placeholderTextColor={theme.muted}
                          style={{
                            color: theme.text,
                            backgroundColor: theme.panel2,
                            borderColor: theme.line,
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: 10,
                            fontFamily: theme.mono,
                          }}
                        />
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <TextField
                            value={current.weight}
                            onChangeText={(v) => setInput(exId, "weight", v)}
                            onFocus={() => {
                              focusExercise(exId);
                            }}
                            placeholder="kg"
                            placeholderTextColor={theme.muted}
                            keyboardType="numeric"
                            style={{
                              flex: 1,
                              color: theme.text,
                              backgroundColor: theme.panel2,
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 12,
                              padding: 10,
                              fontFamily: theme.mono,
                            }}
                          />
                          <TextField
                            value={current.reps}
                            onChangeText={(v) => setInput(exId, "reps", v)}
                            onFocus={() => {
                              focusExercise(exId);
                            }}
                            placeholder="reps"
                            placeholderTextColor={theme.muted}
                            keyboardType="numeric"
                            style={{
                              flex: 1,
                              color: theme.text,
                              backgroundColor: theme.panel2,
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 12,
                              padding: 10,
                              fontFamily: theme.mono,
                            }}
                          />
                          <TextField
                            value={current.rpe}
                            onChangeText={(v) => setInput(exId, "rpe", v)}
                            onFocus={() => {
                              focusExercise(exId);
                            }}
                            placeholder="rpe"
                            placeholderTextColor={theme.muted}
                            keyboardType="numeric"
                            style={{
                              width: 70,
                              color: theme.text,
                              backgroundColor: theme.panel2,
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 12,
                              padding: 10,
                              fontFamily: theme.mono,
                            }}
                          />
                        </View>
                    </>

                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {steps.map((step) => (
                        <Pressable
                          key={`${block.anchorKey}_${step}`}
                          onPress={() => applyWeightStep(exId, step)}
                          style={{
                            borderColor: theme.line,
                            borderWidth: 1,
                            borderRadius: 12,
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            backgroundColor: theme.panel2,
                          }}
                        >
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                            {step > 0 ? "+" : ""}{formatWeight(step)}
                          </Text>
                        </Pressable>
                      ))}
                      <Btn label="+3" onPress={() => addSetMultiple(exId, 3)} />
                    </View>

                    {quickExerciseId === exId ? (
                      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                        <Pressable
                          onPress={() => {
                            if (!restEnabled) return;
                            if (restRunning) stopRestTimer();
                            else startRestTimer(restSeconds);
                          }}
                          style={{
                            borderColor: restEnabled ? theme.line : theme.danger,
                            borderWidth: 1,
                            borderRadius: theme.radius.lg,
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            backgroundColor: theme.panel2,
                          }}
                        >
                          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                            Pause: {restLabel}
                          </Text>
                        </Pressable>
                        <AddSetButton
                          label="+ Legg til sett"
                          onPress={async () => {
                            await addSetForExercise(exId);
                          }}
                        />
                      </View>
                    ) : null}

                    <View style={{ gap: theme.space.sm }}>
                      {renderSetTable(sets)}
                    </View>
                  </View>
                );
              }

              const nextSide = supersetAlternate ? (supersetNext[block.anchorKey] ?? "a") : "a";
              const nextLabel = nextSide === "a" ? "A" : "B";
              const incA = getIncrementForExercise(block.a);
              const incB = getIncrementForExercise(block.b);
              const targetA = getTargetFor(block.a);
              const targetB = getTargetFor(block.b);
              const stepsA = [-incA, incA, incA * 2];
              const stepsB = [-incB, incB, incB * 2];
              const currentA = inputs[block.a] ?? { weight: "", reps: "", rpe: "" };
              const currentB = inputs[block.b] ?? { weight: "", reps: "", rpe: "" };
              const lastA = lastSets[block.a];
              const lastB = lastSets[block.b];
              const suggA = nextSuggestions[block.a];
              const suggB = nextSuggestions[block.b];
              const setsA = setsByExercise[block.a] ?? [];
              const setsB = setsByExercise[block.b] ?? [];
              const prBannerA = prBanners[block.a];
              const prBannerB = prBanners[block.b];
              const altListA = alternatives[activeDayIndex]?.[block.baseA] ?? [];
              const altListB = alternatives[activeDayIndex]?.[block.baseB] ?? [];

              return (
                <View
                  key={block.anchorKey}
                    onLayout={(e) => {
                      anchorPositionsRef.current[block.anchorKey] = e.nativeEvent.layout.y;
                      anchorLayoutRef.current[block.anchorKey] = {
                        y: e.nativeEvent.layout.y,
                        height: e.nativeEvent.layout.height,
                      };
                    }}
                  style={{
                    borderColor: theme.line,
                    borderWidth: 1,
                    borderRadius: 16,
                    backgroundColor: theme.panel,
                    padding: 14,
                    gap: 12,
                  }}
                >
                  <Text style={{ color: theme.text, fontFamily: theme.mono }}>Superset</Text>

                  <View style={{ gap: 10 }}>
                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <Text style={{ color: theme.text }}>A: {displayNameFor(block.a)}</Text>
                        {altListA.length ? (
                          <Pressable
                            onPress={() => openAltPicker(block.baseA)}
                            style={{
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: theme.panel2,
                            }}
                          >
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>ALT</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {block.baseA !== block.a ? (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                          Alternativ for {displayNameFor(block.baseA)}
                        </Text>
                      ) : null}
                      <View style={{ gap: 4 }}>
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                          Mål: {targetA.targetSets} sett × {targetA.repMin}-{targetA.repMax} reps (+{formatWeight(targetA.incrementKg)}kg)
                        </Text>
                        {lastA ? (
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                            Sist: {formatWeight(lastA.weight)}x{lastA.reps}
                            {lastA.created_at ? ` (${lastA.created_at.slice(0, 10)})` : ""}
                          </Text>
                        ) : null}
                        {suggA ? (
                          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                              Forslag: {formatWeight(suggA.weight)}x{suggA.reps}
                            </Text>
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                              {suggA.reason}
                            </Text>
                            <Pressable
                              onPress={() => applySuggestion(block.a)}
                              style={{
                                borderColor: theme.line,
                                borderWidth: 1,
                                borderRadius: 999,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                backgroundColor: theme.panel2,
                              }}
                            >
                              <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }}>
                                Bruk forslag
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                        {buildCoachHint(block.a) ? (
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                            Hint: {buildCoachHint(block.a)}
                          </Text>
                        ) : null}
                        {lastA ? (
                          <Pressable
                            onPress={() => applyLastSet(block.a)}
                            style={{
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: theme.panel2,
                              alignSelf: "flex-start",
                            }}
                          >
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                              Bruk sist
                            </Text>
                          </Pressable>
                        ) : null}
                        {prBannerA ? (
                          <View
                            style={{
                              borderColor: theme.accent,
                              borderWidth: 1,
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: theme.panel2,
                              alignSelf: "flex-start",
                            }}
                          >
                            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }}>
                              {prBannerA}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      {(["normal", "warmup", "dropset", "restpause"] as SetType[]).map((t) => (
                        <Pressable
                          key={`${block.anchorKey}_type_a_${t}`}
                          onPress={() => setSetType(block.a, t)}
                          style={{
                            borderColor: setTypes[block.a] === t ? theme.accent : theme.line,
                            borderWidth: 1,
                            borderRadius: 999,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            backgroundColor: theme.panel2,
                          }}
                        >
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                            {t}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <TextField
                      value={exerciseNotes[block.a] ?? ""}
                      onChangeText={(v) =>
                        setExerciseNotes((prev) => ({ ...prev, [block.a]: v }))
                      }
                      onBlur={() => {
                        const key = `exercise_note_${block.a}`;
                        const val = exerciseNotes[block.a] ?? "";
                        setSettingAsync(key, val).catch(() => {});
                      }}
                      onFocus={() => {
                        focusExercise(block.a);
                      }}
                      placeholder="Notat..."
                      placeholderTextColor={theme.muted}
                      style={{
                        color: theme.text,
                        backgroundColor: theme.panel2,
                        borderColor: theme.line,
                        borderWidth: 1,
                        borderRadius: 12,
                        padding: 10,
                        fontFamily: theme.mono,
                      }}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextField
                        value={currentA.weight}
                        onChangeText={(v) => setInput(block.a, "weight", v)}
                        onFocus={() => {
                          focusExercise(block.a);
                        }}
                        placeholder="kg"
                        placeholderTextColor={theme.muted}
                        keyboardType="numeric"
                        style={{
                          flex: 1,
                          color: theme.text,
                          backgroundColor: theme.panel2,
                          borderColor: theme.line,
                          borderWidth: 1,
                          borderRadius: 12,
                          padding: 10,
                          fontFamily: theme.mono,
                        }}
                      />
                      <TextField
                        value={currentA.reps}
                        onChangeText={(v) => setInput(block.a, "reps", v)}
                        onFocus={() => {
                          focusExercise(block.a);
                        }}
                        placeholder="reps"
                        placeholderTextColor={theme.muted}
                        keyboardType="numeric"
                        style={{
                          flex: 1,
                          color: theme.text,
                          backgroundColor: theme.panel2,
                          borderColor: theme.line,
                          borderWidth: 1,
                          borderRadius: 12,
                          padding: 10,
                          fontFamily: theme.mono,
                        }}
                      />
                      <TextField
                        value={currentA.rpe}
                        onChangeText={(v) => setInput(block.a, "rpe", v)}
                        onFocus={() => {
                          focusExercise(block.a);
                        }}
                        placeholder="rpe"
                        placeholderTextColor={theme.muted}
                        keyboardType="numeric"
                        style={{
                          width: 70,
                          color: theme.text,
                          backgroundColor: theme.panel2,
                          borderColor: theme.line,
                          borderWidth: 1,
                          borderRadius: 12,
                          padding: 10,
                          fontFamily: theme.mono,
                        }}
                      />
                    </View>

                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {stepsA.map((step) => (
                          <Pressable
                            key={`${block.anchorKey}_a_${step}`}
                            onPress={() => applyWeightStep(block.a, step)}
                            style={{
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 12,
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              backgroundColor: theme.panel2,
                            }}
                          >
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                              {step > 0 ? "+" : ""}{formatWeight(step)}
                            </Text>
                          </Pressable>
                        ))}
                        <Btn label="+3" onPress={() => addSetMultiple(block.a, 3)} />
                      </View>
                      {quickExerciseId === block.a ? (
                        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                          <Pressable
                            onPress={() => {
                              if (!restEnabled) return;
                              if (restRunning) stopRestTimer();
                              else startRestTimer(restSeconds);
                            }}
                            style={{
                              borderColor: restEnabled ? theme.line : theme.danger,
                              borderWidth: 1,
                              borderRadius: theme.radius.lg,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              backgroundColor: theme.panel2,
                            }}
                          >
                            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                              Pause: {restLabel}
                            </Text>
                          </Pressable>
                          <AddSetButton
                            label="+ Legg til sett"
                            onPress={async () => {
                              await addSetForExercise(block.a);
                            }}
                          />
                        </View>
                      ) : null}
                      <View style={{ gap: theme.space.sm }}>
                        {renderSetTable(setsA)}
                      </View>
                    </View>

                    <View style={{ gap: 8 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <Text style={{ color: theme.text }}>B: {displayNameFor(block.b)}</Text>
                        {altListB.length ? (
                          <Pressable
                            onPress={() => openAltPicker(block.baseB)}
                            style={{
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: theme.panel2,
                            }}
                          >
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>ALT</Text>
                          </Pressable>
                        ) : null}
                      </View>
                      {block.baseB !== block.b ? (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                          Alternativ for {displayNameFor(block.baseB)}
                        </Text>
                      ) : null}
                      <View style={{ gap: 4 }}>
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                          Mål: {targetB.targetSets} sett × {targetB.repMin}-{targetB.repMax} reps (+{formatWeight(targetB.incrementKg)}kg)
                        </Text>
                        {lastB ? (
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                            Sist: {formatWeight(lastB.weight)}x{lastB.reps}
                            {lastB.created_at ? ` (${lastB.created_at.slice(0, 10)})` : ""}
                          </Text>
                        ) : null}
                        {suggB ? (
                          <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                              Forslag: {formatWeight(suggB.weight)}x{suggB.reps}
                            </Text>
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                              {suggB.reason}
                            </Text>
                            <Pressable
                              onPress={() => applySuggestion(block.b)}
                              style={{
                                borderColor: theme.line,
                                borderWidth: 1,
                                borderRadius: 999,
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                backgroundColor: theme.panel2,
                              }}
                            >
                              <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }}>
                                Bruk forslag
                              </Text>
                            </Pressable>
                          </View>
                        ) : null}
                        {buildCoachHint(block.b) ? (
                          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                            Hint: {buildCoachHint(block.b)}
                          </Text>
                        ) : null}
                        {lastB ? (
                          <Pressable
                            onPress={() => applyLastSet(block.b)}
                            style={{
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: theme.panel2,
                              alignSelf: "flex-start",
                            }}
                          >
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                              Bruk sist
                            </Text>
                          </Pressable>
                        ) : null}
                        {prBannerB ? (
                          <View
                            style={{
                              borderColor: theme.accent,
                              borderWidth: 1,
                              borderRadius: 10,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: theme.panel2,
                              alignSelf: "flex-start",
                            }}
                          >
                            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }}>
                              {prBannerB}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {(["normal", "warmup", "dropset", "restpause"] as SetType[]).map((t) => (
                          <Pressable
                            key={`${block.anchorKey}_type_b_${t}`}
                            onPress={() => setSetType(block.b, t)}
                            style={{
                              borderColor: setTypes[block.b] === t ? theme.accent : theme.line,
                              borderWidth: 1,
                              borderRadius: 999,
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              backgroundColor: theme.panel2,
                            }}
                          >
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                              {t}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <TextField
                        value={exerciseNotes[block.b] ?? ""}
                        onChangeText={(v) =>
                          setExerciseNotes((prev) => ({ ...prev, [block.b]: v }))
                        }
                        onBlur={() => {
                          const key = `exercise_note_${block.b}`;
                          const val = exerciseNotes[block.b] ?? "";
                          setSettingAsync(key, val).catch(() => {});
                        }}
                        onFocus={() => {
                          focusExercise(block.b);
                        }}
                        placeholder="Notat..."
                        placeholderTextColor={theme.muted}
                        style={{
                          color: theme.text,
                          backgroundColor: theme.panel2,
                          borderColor: theme.line,
                          borderWidth: 1,
                          borderRadius: 12,
                          padding: 10,
                          fontFamily: theme.mono,
                        }}
                      />
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        <TextField
                          value={currentB.weight}
                          onChangeText={(v) => setInput(block.b, "weight", v)}
                          onFocus={() => {
                            focusExercise(block.b);
                          }}
                          placeholder="kg"
                          placeholderTextColor={theme.muted}
                          keyboardType="numeric"
                          style={{
                            flex: 1,
                            color: theme.text,
                            backgroundColor: theme.panel2,
                            borderColor: theme.line,
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: 10,
                            fontFamily: theme.mono,
                          }}
                        />
                        <TextField
                          value={currentB.reps}
                          onChangeText={(v) => setInput(block.b, "reps", v)}
                          onFocus={() => {
                            focusExercise(block.b);
                          }}
                          placeholder="reps"
                          placeholderTextColor={theme.muted}
                          keyboardType="numeric"
                          style={{
                            flex: 1,
                            color: theme.text,
                            backgroundColor: theme.panel2,
                            borderColor: theme.line,
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: 10,
                            fontFamily: theme.mono,
                          }}
                        />
                        <TextField
                          value={currentB.rpe}
                          onChangeText={(v) => setInput(block.b, "rpe", v)}
                          onFocus={() => {
                            focusExercise(block.b);
                          }}
                          placeholder="rpe"
                          placeholderTextColor={theme.muted}
                          keyboardType="numeric"
                          style={{
                            width: 70,
                            color: theme.text,
                            backgroundColor: theme.panel2,
                            borderColor: theme.line,
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: 10,
                            fontFamily: theme.mono,
                          }}
                        />
                      </View>

                      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                        {stepsB.map((step) => (
                          <Pressable
                            key={`${block.anchorKey}_b_${step}`}
                            onPress={() => applyWeightStep(block.b, step)}
                            style={{
                              borderColor: theme.line,
                              borderWidth: 1,
                              borderRadius: 12,
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              backgroundColor: theme.panel2,
                            }}
                          >
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                              {step > 0 ? "+" : ""}{formatWeight(step)}
                            </Text>
                          </Pressable>
                        ))}
                        <Btn label="+3" onPress={() => addSetMultiple(block.b, 3)} />
                      </View>
                      {quickExerciseId === block.b ? (
                        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                          <Pressable
                            onPress={() => {
                              if (!restEnabled) return;
                              if (restRunning) stopRestTimer();
                              else startRestTimer(restSeconds);
                            }}
                            style={{
                              borderColor: restEnabled ? theme.line : theme.danger,
                              borderWidth: 1,
                              borderRadius: theme.radius.lg,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              backgroundColor: theme.panel2,
                            }}
                          >
                            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                              Pause: {restLabel}
                            </Text>
                          </Pressable>
                          <AddSetButton
                            label="+ Legg til sett"
                            onPress={async () => {
                              await addSetForExercise(block.b);
                            }}
                          />
                        </View>
                      ) : null}
                      <View style={{ gap: theme.space.sm }}>
                        {renderSetTable(setsB)}
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                      Neste: {nextLabel}
                    </Text>
                    <Btn label="+" onPress={() => addSetForSuperset(block)} tone="accent" />
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OnboardingModal visible={showOnboarding} onDone={completeOnboarding} onClose={completeOnboarding} />

      <Modal
        visible={altPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setAltPickerOpen(false);
          setAltPickerBase(null);
        }}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
              gap: 12,
              maxHeight: "70%",
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>Velg alternativ</Text>
            {altPickerBase ? (
              <Text style={{ color: theme.muted, fontFamily: theme.mono }}>
                {displayNameFor(altPickerBase)}
              </Text>
            ) : null}
            <ScrollView contentContainerStyle={{ gap: 8 }}>
              {(altPickerBase
                ? [altPickerBase, ...(alternatives[activeDayIndex]?.[altPickerBase] ?? [])]
                : []
              ).map((exId) => {
                const selected = altPickerBase ? resolveSelectedExId(altPickerBase) === exId : false;
                return (
                  <Pressable
                    key={`alt_choose_${exId}`}
                    onPress={() => altPickerBase && chooseAlternative(altPickerBase, exId)}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: selected ? theme.accent : theme.line,
                      backgroundColor: theme.panel,
                    }}
                  >
                    <Text style={{ color: theme.text, fontSize: 16 }}>{displayNameFor(exId)}</Text>
                    {selected ? (
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                        Valgt
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn
                label="Lukk"
                onPress={() => {
                  setAltPickerOpen(false);
                  setAltPickerBase(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={dayPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDayPickerOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
              gap: 12,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>Velg dag</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(program?.days ?? []).map((_, i) => (
                <Chip
                  key={`day_pick_${i}`}
                  text={`Dag ${i + 1}`}
                  active={activeDayIndex === i}
                  onPress={() => {
                    selectDayIndex(i);
                    setDayPickerOpen(false);
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label="Lukk" onPress={() => setDayPickerOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editSetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setEditSetOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
              gap: 12,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>Rediger sett</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {(["normal", "warmup", "dropset", "restpause"] as SetType[]).map((t) => (
                <Pressable
                  key={`edit_set_${t}`}
                  onPress={() => setEditType(t)}
                  style={{
                    borderColor: editType === t ? theme.accent : theme.line,
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    backgroundColor: theme.panel2,
                  }}
                >
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{t}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextField
                value={editWeight}
                onChangeText={setEditWeight}
                placeholder="kg"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                style={{
                  flex: 1,
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  fontFamily: theme.mono,
                }}
              />
              <TextField
                value={editReps}
                onChangeText={setEditReps}
                placeholder="reps"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                style={{
                  flex: 1,
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  fontFamily: theme.mono,
                }}
              />
              <TextField
                value={editRpe}
                onChangeText={setEditRpe}
                placeholder="rpe"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                style={{
                  width: 70,
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 10,
                  fontFamily: theme.mono,
                }}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label="Lagre" onPress={saveEditSet} tone="accent" />
              <Btn label="Avbryt" onPress={() => setEditSetOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={restSettingsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRestSettingsOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: 16,
              padding: 14,
              gap: 12,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>Rest timer</Text>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.text }}>Aktiv</Text>
              <Switch
                value={restEnabled}
                onValueChange={(v) => {
                  setRestEnabled(v);
                  setSettingAsync("restEnabled", v ? "1" : "0").catch(() => {});
                  if (!v) stopRestTimer();
                }}
              />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.text }}>Haptics</Text>
              <Switch
                value={restHaptics}
                onValueChange={(v) => {
                  setRestHaptics(v);
                  setSettingAsync("restHaptics", v ? "1" : "0").catch(() => {});
                }}
              />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.text }}>Vibrer</Text>
              <Switch
                value={restVibrate}
                onValueChange={(v) => {
                  setRestVibrate(v);
                  setSettingAsync("restVibrate", v ? "1" : "0").catch(() => {});
                }}
              />
            </View>

            <Text style={{ color: theme.muted, marginTop: 6 }}>Lengde (sekunder)</Text>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              {[60, 90, 120, 150, 180].map((sec) => (
                <Chip
                  key={`rest_${sec}`}
                  text={`${sec}s`}
                  active={restSeconds === sec}
                  onPress={() => {
                    setRestSeconds(sec);
                    setSettingAsync("restSeconds", String(sec)).catch(() => {});
                  }}
                />
              ))}
            </View>

            {recommendedForFocus ? (
              <Pressable
                onPress={() => {
                  setRestSeconds(recommendedForFocus.seconds);
                  setSettingAsync("restSeconds", String(recommendedForFocus.seconds)).catch(() => {});
                }}
                style={{
                  borderColor: theme.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  backgroundColor: theme.panel2,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                  Bruk anbefalt ({recommendedForFocus.seconds}s)
                </Text>
              </Pressable>
            ) : null}

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label="Lukk" onPress={() => setRestSettingsOpen(false)} />
              <Btn
                label="Reset"
                onPress={() => {
                  stopRestTimer();
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}





