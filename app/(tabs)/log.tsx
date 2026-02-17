// app/(tabs)/index.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
  Switch,
  Alert,
  Animated,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme";
import { ensureDb, getDb, getSettingAsync, setSettingAsync, computeBodyweightLoad } from "../../src/db";
import {
  displayNameFor,
  defaultIncrementFor,
  tagsFor,
  alternativesFor,
  getExercise,
  createCustomExercise,
  type ExerciseTag,
  type Equipment,
  isBodyweight,
  bodyweightFactorFor,
} from "../../src/exerciseLibrary";
import ProgramStore from "../../src/programStore";
import type { Program, ProgramBlock, AlternativesMap } from "../../src/programStore";
import ProgressionStore, {
  defaultTargetForExercise,
  type ExerciseTarget,
} from "../../src/progressionStore";
import { SkeletonExerciseCard } from "../../src/components/Skeleton";
import OnboardingModal from "../../components/OnboardingModal";
import { Screen, TopBar, Card, Chip, Btn, IconButton, TextField } from "../../src/ui";
import { setupNotificationHandler, cancelAllRestNotifications } from "../../src/notifications";
import { useRestTimer, mmss, recommendedRestSeconds } from "../../src/restTimerContext";
import { checkAndUnlockAchievements, type Achievement } from "../../src/achievements";
import { loadPrRecords, checkSetPRs, checkSessionVolumePRs, type PrMap } from "../../src/prEngine";
import { getAllNotes, setNote, deleteNote } from "../../src/exerciseNotes";
import { AchievementToast, UndoToast } from "../../src/ui/modern";
import { useI18n } from "../../src/i18n";
import { useWeightUnit } from "../../src/units";
import { calculatePlates } from "../../src/plateCalculator";

// Extracted components
import { SingleExerciseCard, SupersetCard } from "../../src/components/workout/ExerciseCard";
import type { InputState, LastSetInfo } from "../../src/components/workout/ExerciseCard";
import type { SetRow } from "../../src/components/workout/SetEntryRow";
import PlateCalcModal from "../../src/components/modals/PlateCalcModal";
import ExerciseSwapModal from "../../src/components/modals/ExerciseSwapModal";
import { advanceWeek, getPeriodization, isDeloadWeek, deloadWeight, type Periodization } from "../../src/periodization";
import { saveWorkoutAsTemplate } from "../../src/templates";
import TemplatePickerModal from "../../src/components/modals/TemplatePickerModal";
import { shareWorkoutSummary } from "../../src/sharing";
import { uid, isoDateOnly, isoNow } from "../../src/storage";
import { epley1RM, round1 } from "../../src/metrics";
import { formatWeight, shortLabel, parseTimeMs, clampInt } from "../../src/format";

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

function roundWeight(n: number) {
  return Math.round(n * 10) / 10;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[loadSession] ${label} timed out after ${ms}ms`);
      resolve(null);
    }, ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result as T | null;
  } catch (err) {
    console.warn(`[loadSession] ${label} failed`, err);
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Module-level flag - persists across component remounts (tab switches)
let _logTabInitialized = false;

export default function Logg() {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const [ready, setReady] = useState(_logTabInitialized);
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
  const [workoutNotes, setWorkoutNotes] = useState<string>("");

  const [inputs, setInputs] = useState<Record<string, InputState>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [lastSets, setLastSets] = useState<Record<string, LastSetInfo>>({});
  const [targets, setTargets] = useState<Record<string, ExerciseTarget>>({});
  const [prRecords, setPrRecords] = useState<PrMap>({});
  const [prBanners, setPrBanners] = useState<Record<string, string>>({});
  const [lastAddedSetId, setLastAddedSetId] = useState<string | null>(null);
  const lastAddedAnim = useRef(new Animated.Value(0)).current;

  const [finishSummary, setFinishSummary] = useState<{
    duration: string;
    totalSets: number;
    totalVolume: number;
    exercises: number;
    topE1rm: { name: string; value: number } | null;
    prs: string[];
    volumePrs: string[];
  } | null>(null);

  const [undoSet, setUndoSet] = useState<{ row: SetRow; exerciseId: string; prSetId?: string } | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [plateCalcExId, setPlateCalcExId] = useState<string | null>(null);

  const [editSetOpen, setEditSetOpen] = useState(false);
  const [editSet, setEditSet] = useState<SetRow | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editRpe, setEditRpe] = useState("");

  // Rest timer state comes from useRestTimer context
  const restTimer = useRestTimer();

  const [supersetAlternate, setSupersetAlternate] = useState(true);
  const [supersetNext, setSupersetNext] = useState<Record<string, "a" | "b">>({});

  const [focusedExerciseId, setFocusedExerciseId] = useState<string | null>(null);
  const [altPickerOpen, setAltPickerOpen] = useState(false);
  const [altPickerBase, setAltPickerBase] = useState<string | null>(null);

  const [achievementToast, setAchievementToast] = useState<{
    visible: boolean;
    achievement: Achievement | null;
  }>({ visible: false, achievement: null });

  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [periodization, setPeriodization] = useState<Periodization | null>(null);

  const navigation = useNavigation();
  const router = useRouter();
  const scrollRef = useRef<ScrollView | null>(null);
  const anchorPositionsRef = useRef<Record<string, number>>({});
  const anchorLayoutRef = useRef<Record<string, { y: number; height: number }>>({});
  const scrollYRef = useRef(0);
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
    try {
      const dbOk = await withTimeout(ensureDb(), 4000, "ensureDb");
      if (dbOk === null) throw new Error("ensureDb timeout");
      const programsOk = await withTimeout(ProgramStore.ensurePrograms(), 4000, "ensurePrograms");
      if (programsOk === null) throw new Error("ensurePrograms timeout");

      const pmRaw = await getSettingAsync("programMode");
      const pm: ProgramMode = pmRaw === "back" ? "back" : "normal";

      const ssRaw = await getSettingAsync("supersetAlternate");
      const onboardingRaw = await getSettingAsync("hasSeenOnboarding");

      setProgramMode(pm);
      setSupersetAlternate(ssRaw === null ? true : ssRaw === "1");
      setShowOnboarding(onboardingRaw !== "1");

      // Rest timer settings are now loaded by RestTimerContext

      const activeId = await getSettingAsync("activeWorkoutId");
      let activeRow: WorkoutRow | null = null;
      if (activeId) {
        const row = getDb().getFirstSync<WorkoutRow>(
          `SELECT id, started_at, day_index, day_key, program_id, notes FROM workouts WHERE id = ? LIMIT 1`,
          [activeId]
        );
        if (row?.id) {
          activeRow = row;
          setActiveWorkoutId(row.id);
          setWorkoutStartedAt(row.started_at ?? null);
          setWorkoutNotes(row.notes ?? "");
        } else {
          await setSettingAsync("activeWorkoutId", "");
          setActiveWorkoutId(null);
          setWorkoutStartedAt(null);
        }
      } else {
        setActiveWorkoutId(null);
        setWorkoutStartedAt(null);
      }
      // Note: restTimer.setActiveWorkoutId is handled by the context loading from settings

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
      const programAlts = await ProgramStore.getAlternativesForProgram(prog.id);

      // Merge program alternatives with library alternatives
      const mergedAlts: AlternativesMap = {};
      prog.days.forEach((dayData, dayIndex) => {
        mergedAlts[dayIndex] = {};
        dayData.blocks.forEach((block) => {
          if (block.type === "single") {
            const exId = block.exId;
            const libraryAlts = alternativesFor(exId);
            const programAltsForEx = programAlts[dayIndex]?.[exId] ?? [];
            const combined = Array.from(new Set([...libraryAlts, ...programAltsForEx]));
            if (combined.length > 0) {
              mergedAlts[dayIndex][exId] = combined;
            }
          } else if (block.type === "superset") {
            const exIdA = block.a;
            const libraryAltsA = alternativesFor(exIdA);
            const programAltsForA = programAlts[dayIndex]?.[exIdA] ?? [];
            const combinedA = Array.from(new Set([...libraryAltsA, ...programAltsForA]));
            if (combinedA.length > 0) {
              mergedAlts[dayIndex][exIdA] = combinedA;
            }
            const exIdB = block.b;
            const libraryAltsB = alternativesFor(exIdB);
            const programAltsForB = programAlts[dayIndex]?.[exIdB] ?? [];
            const combinedB = Array.from(new Set([...libraryAltsB, ...programAltsForB]));
            if (combinedB.length > 0) {
              mergedAlts[dayIndex][exIdB] = combinedB;
            }
          }
        });
      });

      // Read persisted exercise swaps BEFORE setting state so all updates batch together
      let restoredAlts: Record<string, string> = {};
      if (activeRow) {
        try {
          const savedAlts = await getSettingAsync("selectedAlternatives");
          if (savedAlts) {
            const parsed = JSON.parse(savedAlts);
            if (parsed && typeof parsed === "object") restoredAlts = parsed;
          }
        } catch {}
      }

      // Batch all state updates together to avoid intermediate renders with stale selectedAlternatives
      setProgram(prog);
      setAlternatives(mergedAlts);
      setSuggestedDayIndex(suggested);
      setActiveDayIndex(day);
      setSelectedAlternatives(restoredAlts);

      // Load periodization
      try {
        const periodCfg = await getPeriodization(prog.id);
        setPeriodization(periodCfg);
      } catch {
        setPeriodization(null);
      }
    } catch (err) {
      console.warn("[loadSession] failed, using fallback program", err);
      setProgramMode("normal");
      setProgram(ProgramStore.DEFAULT_STANDARD_PROGRAM);
      setAlternatives({});
      setSelectedAlternatives({});
      setSuggestedDayIndex(0);
      setActiveDayIndex(0);
      setPeriodization(null);
    }
  }, []);

  useEffect(() => {
    setupNotificationHandler();
    // Skip loading screen if already initialized (tab re-focus)
    if (_logTabInitialized) {
      setReady(true);
      loadSession().catch(() => {}); // Silent refresh
      return;
    }
    loadSession()
      .catch((err) => console.warn("[loadSession] unhandled", err))
      .finally(() => {
        setReady(true);
        _logTabInitialized = true;
      });
  }, [loadSession]);

  useFocusEffect(
    useCallback(() => {
      // Skip if not ready yet (initial load handles it)
      if (!ready) return () => {};
      // Silently refresh data on tab re-focus without resetting ready state
      let alive = true;
      loadSession().catch(() => {});
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
        return { type: "single", exId: selected, baseExId: b.exId, anchorKey } as RenderBlock;
      }
      const selectedA = resolveSelectedExId(b.a);
      const selectedB = resolveSelectedExId(b.b);
      return { type: "superset", a: selectedA, b: selectedB, baseA: b.a, baseB: b.b, anchorKey } as RenderBlock;
    });
  }, [dayPlan, alternatives, selectedAlternatives, activeDayIndex]);

  const exerciseIds = useMemo(() => {
    const list: string[] = [];
    for (const b of renderBlocks) {
      if (b.type === "single") list.push(b.exId);
      else { list.push(b.a, b.b); }
    }
    return Array.from(new Set(list));
  }, [renderBlocks]);

  const anchorItems = useMemo(() => {
    return renderBlocks.map((b) => {
      if (b.type === "single") return { key: b.anchorKey, label: displayNameFor(b.exId) };
      return { key: b.anchorKey, label: `${displayNameFor(b.a)} / ${displayNameFor(b.b)}` };
    });
  }, [renderBlocks]);

  const anchorKeyByExerciseId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of renderBlocks) {
      if (b.type === "single") { map[b.exId] = b.anchorKey; }
      else { map[b.a] = b.anchorKey; map[b.b] = b.anchorKey; }
    }
    return map;
  }, [renderBlocks]);

  const blockAnchorKeys = useMemo(() => renderBlocks.map((b) => b.anchorKey), [renderBlocks]);

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

  // Rest timer functions (getRestForExercise, startRestTimer, stopRestTimer) are now in restTimerContext

  useEffect(() => { setSupersetNext({}); }, [activeDayIndex, program?.id, programMode]);
  // Only clear alternatives when NOT in an active workout - during a session, alternatives should persist
  const prevDayRef = useRef<{ day: number; prog: string | null }>({ day: activeDayIndex, prog: program?.id ?? null });
  useEffect(() => {
    // Skip during initial load — loadSession handles restoring selectedAlternatives
    if (!ready) return;
    const prevDay = prevDayRef.current.day;
    const prevProg = prevDayRef.current.prog;
    prevDayRef.current = { day: activeDayIndex, prog: program?.id ?? null };
    // Skip if same values or if there's an active workout
    if ((prevDay === activeDayIndex && prevProg === (program?.id ?? null)) || activeWorkoutId) return;
    setSelectedAlternatives({});
    setSettingAsync("selectedAlternatives", "").catch(() => {});
  }, [activeDayIndex, program?.id, activeWorkoutId, ready]);

  const refreshWorkoutSets = useCallback(() => {
    if (!activeWorkoutId) { setWorkoutSets([]); return; }
    const rows = getDb().getAllSync<SetRow>(
      `SELECT id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id, set_type, is_warmup,
              external_load_kg, bodyweight_kg_used, bodyweight_factor, est_total_load_kg
       FROM sets WHERE workout_id = ? ORDER BY set_index ASC, created_at ASC`,
      [activeWorkoutId]
    );
    setWorkoutSets(Array.isArray(rows) ? rows : []);
  }, [activeWorkoutId]);

  useEffect(() => { if (!ready) return; refreshWorkoutSets(); }, [ready, activeWorkoutId, refreshWorkoutSets]);

  useEffect(() => {
    if (!workoutStartedAt) { setWorkoutElapsedSec(0); return; }
    const start = parseTimeMs(workoutStartedAt);
    if (!Number.isFinite(start)) return;
    const tick = () => { setWorkoutElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000))); };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [workoutStartedAt]);

  // Rest timer effects (countdown, app state, haptics) are now in restTimerContext

  const fireHapticLight = useCallback(async () => {
    if (!restTimer.restHaptics || Platform.OS === "web") return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch {}
  }, [restTimer.restHaptics]);

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
    return () => { alive = false; };
  }, [program?.id, exerciseIdsKey, exerciseIds]);

  useEffect(() => {
    if (exerciseIds.length === 0) { setExerciseNotes({}); return; }
    setExerciseNotes(getAllNotes());
  }, [exerciseIdsKey, exerciseIds]);

  useEffect(() => {
    if (!program?.id || exerciseIds.length === 0) { setPrRecords({}); return; }
    setPrRecords(loadPrRecords(program.id, exerciseIds));
  }, [program?.id, exerciseIdsKey, exerciseIds]);

  useEffect(() => {
    if (!ready || exerciseIds.length === 0) { setLastSets({}); return; }
    try {
      const placeholders = exerciseIds.map(() => "?").join(",");
      const rows = getDb().getAllSync<SetRow>(
        `SELECT workout_id, exercise_id, exercise_name, weight, reps, rpe, created_at
         FROM sets WHERE exercise_id IN (${placeholders}) ORDER BY created_at DESC`,
        [...exerciseIds]
      );
      const last: Record<string, LastSetInfo> = {};
      for (const r of rows ?? []) {
        const key = r.exercise_id ? String(r.exercise_id) : "";
        if (!key || last[key]) continue;
        last[key] = { weight: r.weight, reps: r.reps, rpe: r.rpe ?? null, created_at: r.created_at, workout_id: r.workout_id };
      }
      setLastSets(last);
    } catch { setLastSets({}); }
  }, [ready, exerciseIdsKey, exerciseIds, program?.id]);

  function buildCoachHint(exId: string) {
    const last = lastSets[exId];
    if (!last) return null;
    const target = getTargetFor(exId);
    const rpe = last.rpe ?? null;
    if (rpe != null && rpe >= 9) return t("log.progression.hold");
    if (last.reps >= target.repMax) return t("log.progression.nextIncrease");
    if (last.reps < target.repMin - 1) return t("log.progression.reduceWeight");
    if (last.reps < target.repMin) return t("log.progression.buildReps");
    return t("log.progression.keepBuilding");
  }

  useEffect(() => {
    if (!Object.keys(lastSets).length) return;
    setInputs((prev) => {
      const next = { ...prev };
      for (const [exId, info] of Object.entries(lastSets)) {
        const current = next[exId];
        const empty = !current || (!current.weight && !current.reps && !current.rpe);
        if (!empty) continue;
        next[exId] = { weight: formatWeight(info.weight), reps: String(info.reps), rpe: info.rpe != null ? String(info.rpe) : "" };
      }
      return next;
    });
  }, [lastSets]);

  const isDeload = periodization ? isDeloadWeek(periodization) : false;

  function getTargetFor(exId: string) {
    const target = targets[exId];
    const base = target ?? { programId: program?.id ?? "", exerciseId: exId, repMin: defaultTargetForExercise(exId).repMin, repMax: defaultTargetForExercise(exId).repMax, targetSets: defaultTargetForExercise(exId).targetSets, incrementKg: defaultTargetForExercise(exId).incrementKg, updatedAt: "", autoProgress: false } as ExerciseTarget;
    if (isDeload) {
      return { ...base, targetSets: Math.max(1, base.targetSets - 1) };
    }
    return base;
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
      return { ...prev, [exId]: { ...base, [field]: value } };
    });
  }

  function applyWeightStep(exId: string, delta: number) {
    const current = parseFloat(inputs[exId]?.weight ?? "");
    const next = Number.isFinite(current) ? current + delta : delta;
    setInput(exId, "weight", formatWeight(Math.max(0, next)));
  }

  function applyLastSet(exId: string) {
    const last = lastSets[exId];
    if (!last) return;
    setInputs((prev) => ({
      ...prev,
      [exId]: { weight: formatWeight(wu.toDisplay(last.weight)), reps: String(last.reps), rpe: last.rpe != null ? String(last.rpe) : "" },
    }));
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
      if (exId === baseExId) delete next[baseExId];
      else next[baseExId] = exId;
      // Persist so swaps survive tab navigation
      setSettingAsync("selectedAlternatives", JSON.stringify(next)).catch(() => {});
      return next;
    });
    setAltPickerOpen(false);
    setAltPickerBase(null);
  }

  async function handleCreateCustomFromAlt(baseExId: string, name: string, equipment: Equipment, tags: ExerciseTag[]) {
    if (!program?.id) return;
    const base = getExercise(baseExId);
    const newId = await createCustomExercise({
      displayName: name,
      equipment,
      tags: tags.length > 0 ? tags : tagsFor(baseExId),
      defaultIncrementKg: base?.defaultIncrementKg ?? 2.5,
    });

    // Add as a permanent alternative for this exercise on this day
    const currentAlts = alternatives[activeDayIndex]?.[baseExId] ?? [];
    await ProgramStore.setAlternatives({
      programId: program.id,
      dayIndex: activeDayIndex,
      exerciseId: baseExId,
      alternatives: [...currentAlts, newId],
    });

    // Reload alternatives
    const reloaded = await ProgramStore.getAlternativesForProgram(program.id);
    setAlternatives(reloaded);

    // Auto-select the new exercise
    chooseAlternative(baseExId, newId);
  }

  async function handleSetAlternativeAsDefault(baseExId: string, newDefaultExId: string) {
    if (!program || !program.id) return;
    const programId = program.id;
    const dayIdx = activeDayIndex;

    // Close modal immediately for better UX
    setAltPickerOpen(false);
    setAltPickerBase(null);

    try {
      const currentDay = program.days[dayIdx];
      if (!currentDay) return;

      // Find and update the block with this exercise
      const updatedBlocks = currentDay.blocks.map((block) => {
        if (block.type === "single" && block.exId === baseExId) {
          return { ...block, exId: newDefaultExId };
        }
        if (block.type === "superset") {
          if (block.a === baseExId) return { ...block, a: newDefaultExId };
          if (block.b === baseExId) return { ...block, b: newDefaultExId };
        }
        return block;
      });

      // Update the program
      const updatedProgram: Program = {
        ...program,
        days: program.days.map((day, i) =>
          i === dayIdx ? { ...day, blocks: updatedBlocks } : day
        ),
      };

      // Update alternatives: add old base, remove new default
      const currentAlts = alternatives[dayIdx]?.[baseExId] ?? [];
      const newAlts = [baseExId, ...currentAlts.filter((id) => id !== newDefaultExId)];

      // Save program first
      await ProgramStore.saveProgram(programMode, updatedProgram);

      // Update alternatives for the new default exercise
      if (newAlts.length > 0) {
        await ProgramStore.setAlternatives({
          programId,
          dayIndex: dayIdx,
          exerciseId: newDefaultExId,
          alternatives: newAlts,
        });
      }

      // Clear old alternatives entry (just delete, don't insert)
      const db = getDb();
      await db.runAsync(
        `DELETE FROM program_exercise_alternatives WHERE program_id = ? AND day_index = ? AND exercise_id = ?`,
        [programId, dayIdx, baseExId]
      );

      // Reload program and alternatives
      const reloaded = await ProgramStore.getProgram(programId);
      if (reloaded) setProgram(reloaded);
      const reloadedAlts = await ProgramStore.getAlternativesForProgram(programId);
      setAlternatives(reloadedAlts);

      // Clear selection since base changed
      setSelectedAlternatives((prev) => {
        const next = { ...prev };
        delete next[baseExId];
        return next;
      });

      Alert.alert(t("log.setAsDefaultDone"));
    } catch (err) {
      console.error("Failed to set alternative as default:", err);
      Alert.alert("Error", String(err));
    }
  }

  function dayKeyForIndex(idx: number) { return `day_${idx + 1}`; }
  function getDayKey() { return dayKeyForIndex(activeDayIndex); }

  function selectDayIndex(i: number) {
    if (activeWorkoutId) { Alert.alert(t("log.lockedAlert"), t("log.lockedSwitchDay")); return; }
    setActiveDayIndex(i);
  }

  function scrollToAnchorKey(key: string) {
    const y = anchorPositionsRef.current[key];
    if (!Number.isFinite(y)) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
  }

  function focusExercise(exId: string, opts?: { scroll?: boolean }) {
    setFocusedExerciseId(exId);
    if (!opts?.scroll) return;
    const key = anchorKeyByExerciseId[exId];
    if (key) scrollToAnchorKey(key);
  }

  async function startWorkout() {
    if (activeWorkoutId) return;
    const id = uid("workout");
    const startedAt = isoNow();
    const programId = program?.id ?? null;
    await getDb().runAsync(
      `INSERT INTO workouts(id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, isoDateOnly(), programMode, programId, getDayKey(), "green", "", activeDayIndex, startedAt]
    );
    await setSettingAsync("activeWorkoutId", id);
    setActiveWorkoutId(id);
    restTimer.setActiveWorkoutId(id); // Show floating timer
    setWorkoutStartedAt(startedAt);
    setWorkoutSets([]);
    setWorkoutNotes("");
  }

  async function endWorkout() {
    if (!activeWorkoutId) return;
    const programId = program?.id ?? "";
    const dayCount = Math.max(1, program?.days.length ?? 1);
    const nextIdx = (activeDayIndex + 1) % dayCount;

    // Build summary before clearing state
    const totalVolume = workoutSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
    const exerciseIds = new Set(workoutSets.map((s) => s.exercise_id ?? s.exercise_name));
    let topE1rm: { name: string; value: number } | null = null;
    for (const s of workoutSets) {
      if (s.weight > 0 && s.reps > 0) {
        const e = round1(epley1RM(s.weight, s.reps));
        if (!topE1rm || e > topE1rm.value) {
          topE1rm = { name: displayNameFor(s.exercise_id ?? s.exercise_name), value: e };
        }
      }
    }
    // ── Volume PRs (session-total per exercise) ──
    const { dbPrMap, volumePrs: rawVolumePrs } = await checkSessionVolumePRs({
      workoutId: activeWorkoutId ?? "",
      programId,
      sets: workoutSets,
    });
    const volumePrs = rawVolumePrs.map((msg) => {
      const [, exId, vol] = msg.split(":");
      return `${displayNameFor(exId)}: ${formatWeight(wu.toDisplay(Number(vol)))} ${wu.unitLabel()}`;
    });
    // Merge DB records into React state
    setPrRecords((prev) => {
      const merged = { ...prev };
      for (const [eid, rec] of Object.entries(dbPrMap)) merged[eid] = { ...merged[eid], ...rec };
      return merged;
    });

    const prs: string[] = [];
    for (const [exId, rec] of Object.entries(dbPrMap)) {
      if (rec.heaviest) prs.push(`${displayNameFor(exId)}: ${formatWeight(wu.toDisplay(rec.heaviest.value))} ${wu.unitLabel()}`);
    }

    setFinishSummary({
      duration: mmss(workoutElapsedSec),
      totalSets: workoutSets.length,
      totalVolume: round1(wu.toDisplay(totalVolume)),
      exercises: exerciseIds.size,
      topE1rm: topE1rm ? { name: topE1rm.name, value: round1(wu.toDisplay(topE1rm.value)) } : null,
      prs,
      volumePrs,
    });

    try {
      await getDb().runAsync(
        `UPDATE workouts SET day_key = ?, day_index = ?, program_id = ?, ended_at = ? WHERE id = ?`,
        [dayKeyForIndex(activeDayIndex), activeDayIndex, programId || null, isoNow(), activeWorkoutId]
      );
    } catch {}
    if (programId) {
      await setSettingAsync(`lastCompletedDayIndex_${programId}`, String(activeDayIndex));
      await setSettingAsync(`nextSuggestedDayIndex_${programId}`, String(nextIdx));
    }
    try {
      const { analyzeWorkoutForProgression } = await import("../../src/progressionStore");
      if (programId) await analyzeWorkoutForProgression(activeWorkoutId, programId);
    } catch {}
    // Advance periodization week
    if (programId) {
      try {
        const updated = await advanceWeek(programId);
        setPeriodization(updated);
      } catch {}
    }
    await setSettingAsync("activeWorkoutId", "");
    await setSettingAsync("selectedAlternatives", "").catch(() => {});
    setActiveWorkoutId(null);
    restTimer.setActiveWorkoutId(null); // Hide floating timer
    setWorkoutStartedAt(null);
    setWorkoutElapsedSec(0);
    setWorkoutSets([]);
    setSuggestedDayIndex(nextIdx);
    setActiveDayIndex(nextIdx);
  }

  async function handleSaveTemplate() {
    if (!activeWorkoutId) return;
    const name = templateName.trim();
    if (!name) return;
    try {
      await saveWorkoutAsTemplate(activeWorkoutId, name);
      setSaveTemplateOpen(false);
      setTemplateName("");
      Alert.alert(t("templates.saved"), t("templates.savedMsg"));
    } catch {
      Alert.alert(t("common.error"), t("templates.saveFailed"));
    }
  }

  async function handleShareWorkout() {
    if (!activeWorkoutId) return;
    try {
      await shareWorkoutSummary(activeWorkoutId);
    } catch {}
  }

  function handleTemplateSelect(template: import("../../src/templates").WorkoutTemplate) {
    setTemplatePickerOpen(false);
    // Template exercises are used to inform the user which exercises to do
    // For now we just close the picker - the template data is available via template.exercises
    // The exercises in the template match the program blocks already loaded
    Alert.alert(
      t("templates.loaded"),
      `${template.name}: ${template.exercises.length} ${t("templates.exercises", { count: template.exercises.length })}`
    );
  }

  function flashSetRow(id: string) {
    setLastAddedSetId(id);
    lastAddedAnim.stopAnimation();
    lastAddedAnim.setValue(1);
    Animated.timing(lastAddedAnim, { toValue: 0, duration: 650, useNativeDriver: false }).start(() => {
      setLastAddedSetId((prev) => (prev === id ? null : prev));
    });
  }

  async function addSetForExercise(exId: string, forcedIndex?: number) {
    if (!activeWorkoutId) { Alert.alert(t("log.startWorkoutAlert"), t("log.startWorkoutMsg")); return; }

    const input = inputs[exId] ?? { weight: "", reps: "", rpe: "" };
    const isBw = isBodyweight(exId);
    const parsedWeight = parseFloat(input.weight);
    const weight = Number.isFinite(parsedWeight) ? wu.toKg(parsedWeight) : isBw ? 0 : NaN;
    const reps = parseInt(input.reps, 10);

    if (!Number.isFinite(weight) || !Number.isFinite(reps)) { Alert.alert(t("log.missingData"), t("log.missingDataMsg")); return; }

    const rpe = parseFloat(input.rpe);
    const setIndex = Number.isFinite(forcedIndex) ? Number(forcedIndex) : (setsByExercise[exId]?.length ?? 0);
    const bwData = await computeBodyweightLoad(exId, isoDateOnly(), weight);

    // Compute rest_seconds: actual time since last set of this exercise in this session
    const exerciseSetsForRest = setsByExercise[exId];
    let restSeconds: number | null = null;
    if (exerciseSetsForRest && exerciseSetsForRest.length > 0) {
      const lastSet = exerciseSetsForRest[exerciseSetsForRest.length - 1];
      const elapsed = Math.round((Date.now() - Date.parse(lastSet.created_at)) / 1000);
      if (Number.isFinite(elapsed) && elapsed > 0) restSeconds = elapsed;
    }

    const row: SetRow = {
      id: uid("set"), workout_id: activeWorkoutId, exercise_name: displayNameFor(exId),
      set_index: setIndex, weight, reps, rpe: Number.isFinite(rpe) ? rpe : null,
      created_at: isoNow(), exercise_id: exId, set_type: "normal", is_warmup: 0,
      external_load_kg: bwData.external_load_kg, bodyweight_kg_used: bwData.bodyweight_kg_used,
      bodyweight_factor: bwData.bodyweight_factor, est_total_load_kg: bwData.est_total_load_kg,
      rest_seconds: restSeconds,
    };

    await getDb().runAsync(
      `INSERT INTO sets(id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id, set_type, is_warmup, external_load_kg, bodyweight_kg_used, bodyweight_factor, est_total_load_kg, rest_seconds) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.workout_id, row.exercise_name, row.set_index, row.weight, row.reps, row.rpe ?? null, row.created_at, row.exercise_id ?? null, row.set_type ?? null, row.is_warmup ?? 0, row.external_load_kg ?? 0, row.bodyweight_kg_used ?? null, row.bodyweight_factor ?? null, row.est_total_load_kg ?? null, row.rest_seconds ?? null]
    );

    const key = anchorKeyByExerciseId[exId];
    if (key) {
      const card = anchorLayoutRef.current[key];
      if (card) pendingAutoScrollRef.current = { cardBottom: card.y + card.height };
    }
    setWorkoutSets((prev) => [...prev, row]);
    flashSetRow(row.id);
    fireHapticLight();
    restTimer.startRestTimer(restTimer.getRestForExercise(exId));
    Keyboard.dismiss();

    const programId = program?.id ?? "";
    const { updatedRecords, messages: rawMsgs } = await checkSetPRs({
      exerciseId: exId,
      weight,
      reps,
      setId: row.id,
      workoutId: activeWorkoutId ?? "",
      programId,
      currentVolumeRecord: prRecords[exId]?.volume,
      isBw,
      estTotalLoadKg: row.est_total_load_kg,
    });

    setPrRecords((prev) => ({ ...prev, [exId]: updatedRecords }));

    // Convert coded messages to display strings
    const messages: string[] = rawMsgs.map((msg) => {
      const [type, val] = msg.split(":");
      const num = Number(val);
      if (type === "heaviest") return t("log.newHeaviest", { weight: formatWeight(wu.toDisplay(num)) });
      return t("log.newE1rm", { weight: formatWeight(wu.toDisplay(num)) });
    });

    if (messages.length) {
      const bannerText = messages.join(" \u00B7 ");
      setPrBanners((prev) => ({ ...prev, [exId]: bannerText }));
      setTimeout(() => {
        setPrBanners((prev) => { const next = { ...prev }; if (next[exId] === bannerText) delete next[exId]; return next; });
      }, 3500);
    }

    setLastSets((prev) => ({
      ...prev,
      [exId]: { weight: row.weight, reps: row.reps, rpe: row.rpe ?? null, created_at: row.created_at, workout_id: row.workout_id },
    }));

    try {
      const unlockedAchievements = await checkAndUnlockAchievements({ workoutId: activeWorkoutId, setId: row.id, exerciseId: exId, weight, reps });
      if (unlockedAchievements.length > 0) setAchievementToast({ visible: true, achievement: unlockedAchievements[0] });
    } catch (error) { console.error("Failed to check achievements:", error); }

    try {
      const { autoCheckGoals } = await import("../../src/goals");
      const programId = program?.id;
      if (programId) await autoCheckGoals(programId);
    } catch {}

    setUndoSet({ row, exerciseId: exId, prSetId: row.id });
    setUndoVisible(true);

    if (restTimer.restEnabled) restTimer.startRestTimer(restTimer.getRestForExercise(exId));
  }

  async function addSetForSuperset(block: Extract<RenderBlock, { type: "superset" }>) {
    const key = block.anchorKey;
    const next = supersetAlternate ? (supersetNext[key] ?? "a") : "a";
    const exId = next === "a" ? block.a : block.b;
    await addSetForExercise(exId);
    if (supersetAlternate) {
      setSupersetNext((prev) => ({ ...prev, [key]: next === "a" ? "b" : "a" }));
      const nextExId = next === "a" ? block.b : block.a;
      setTimeout(() => { focusExercise(nextExId, { scroll: true }); }, 50);
    }
  }

  async function addSetMultiple(exId: string, count: number) {
    const base = setsByExercise[exId]?.length ?? 0;
    for (let i = 0; i < count; i += 1) await addSetForExercise(exId, base + i);
  }

  async function handleUndo() {
    if (!undoSet) return;
    const { row, exerciseId, prSetId } = undoSet;
    try {
      const db = getDb();
      await db.runAsync(`DELETE FROM sets WHERE id = ?`, [row.id]);
      if (prSetId) await db.runAsync(`DELETE FROM pr_records WHERE set_id = ?`, [prSetId]);
      setWorkoutSets((prev) => prev.filter((s) => s.id !== row.id));
      // Reload PR records from DB for this exercise instead of wiping state
      const programId = program?.id ?? "";
      if (programId) {
        const reloaded = loadPrRecords(programId, [exerciseId]);
        setPrRecords((prev) => ({ ...prev, [exerciseId]: reloaded[exerciseId] ?? {} }));
      } else {
        setPrRecords((prev) => { const next = { ...prev }; delete next[exerciseId]; return next; });
      }
      setPrBanners((prev) => { const next = { ...prev }; delete next[exerciseId]; return next; });
    } catch {}
    setUndoSet(null);
    setUndoVisible(false);
  }

  function openEditSet(row: SetRow) {
    setEditSet(row);
    setEditWeight(row.weight != null ? String(wu.toDisplay(row.weight)) : "");
    setEditReps(String(row.reps ?? ""));
    setEditRpe(row.rpe != null ? String(row.rpe) : "");
    setEditSetOpen(true);
  }

  async function saveEditSet() {
    if (!editSet) return;
    const isBw = editSet.exercise_id ? isBodyweight(editSet.exercise_id) : false;
    const parsedWeight = parseFloat(editWeight);
    const weight = Number.isFinite(parsedWeight) ? wu.toKg(parsedWeight) : isBw ? 0 : NaN;
    const reps = parseInt(editReps, 10);
    const rpe = parseFloat(editRpe);
    if (!Number.isFinite(weight) || !Number.isFinite(reps)) { Alert.alert(t("log.missingData"), t("log.missingDataMsg")); return; }
    try {
      if (isBw && editSet.exercise_id) {
        const dateOnly = editSet.created_at ? editSet.created_at.slice(0, 10) : isoDateOnly();
        const bwData = await computeBodyweightLoad(editSet.exercise_id, dateOnly, weight);
        await getDb().runAsync(
          `UPDATE sets SET weight = ?, reps = ?, rpe = ?, external_load_kg = ?, bodyweight_kg_used = ?, bodyweight_factor = ?, est_total_load_kg = ? WHERE id = ?`,
          [weight, reps, Number.isFinite(rpe) ? rpe : null, bwData.external_load_kg ?? 0, bwData.bodyweight_kg_used ?? null, bwData.bodyweight_factor ?? null, bwData.est_total_load_kg ?? null, editSet.id]
        );
      } else {
        await getDb().runAsync(`UPDATE sets SET weight = ?, reps = ?, rpe = ? WHERE id = ?`, [weight, reps, Number.isFinite(rpe) ? rpe : null, editSet.id]);
      }
      refreshWorkoutSets();
    } catch { Alert.alert(t("common.error"), t("log.couldNotUpdate")); }
    finally { setEditSetOpen(false); setEditSet(null); }
  }

  async function deleteSet(row: SetRow) {
    Alert.alert(t("log.deleteSetTitle"), t("log.deleteSetMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: async () => {
        try { await getDb().runAsync(`DELETE FROM sets WHERE id = ?`, [row.id]); refreshWorkoutSets(); }
        catch { Alert.alert(t("common.error"), t("log.couldNotDelete")); }
      }},
    ]);
  }

  const quickExerciseId = focusedExerciseId ?? exerciseIds[0];

  function completeOnboarding() {
    setSettingAsync("hasSeenOnboarding", "1").catch(() => {});
    setShowOnboarding(false);
  }

  // ── Shared callbacks for exercise cards ──
  const cardCallbacks = {
    onSetInput: setInput,
    onApplyWeightStep: applyWeightStep,
    onApplyLastSet: applyLastSet,
    onAddSet: addSetForExercise,
    onAddSetMultiple: addSetMultiple,
    onEditSet: openEditSet,
    onDeleteSet: deleteSet,
    onFocusExercise: (exId: string) => {
      focusExercise(exId);
      restTimer.setFocusedExerciseId(exId);
    },
    onOpenAltPicker: openAltPicker,
    onSetAsDefault: handleSetAlternativeAsDefault,
    onActivateExercise: (exId: string) => {
      focusExercise(exId);
      restTimer.setFocusedExerciseId(exId);
    },
    onExerciseNoteChange: (exId: string, note: string) => {
      setExerciseNotes((prev) => ({ ...prev, [exId]: note }));
    },
    onExerciseNoteBlur: (exId: string) => {
      const val = (exerciseNotes[exId] ?? "").trim();
      if (val) setNote(exId, val).catch(() => {});
      else deleteNote(exId).catch(() => {});
    },
    onOpenPlateCalc: (exId: string) => setPlateCalcExId(exId),
  };

  if (!ready || !program || !dayPlan) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md }}>
          <TopBar
            title={t("log.title")}
            subtitle={t("log.readyForWorkout")}
            left={<IconButton icon="menu" onPress={openDrawer} />}
          />
          <SkeletonExerciseCard />
          <SkeletonExerciseCard />
          <SkeletonExerciseCard />
        </ScrollView>
      </Screen>
    );
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
          onLayout={(e) => { scrollViewHeightRef.current = e.nativeEvent.layout.height; }}
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
          onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: theme.space.xl }}
        >
          <TopBar
            title={t("log.title")}
            subtitle={t("log.readyForWorkout")}
            left={<IconButton icon="menu" onPress={openDrawer} />}
            right={
              <View style={{ flexDirection: "row", gap: 4 }}>
                {activeWorkoutId ? (
                  <IconButton icon="share" onPress={handleShareWorkout} />
                ) : null}
                <IconButton icon="settings" onPress={() => restTimer.setRestSettingsOpen(true)} />
              </View>
            }
          />

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Chip text={programMode === "back" ? t("log.backFriendly") : t("log.standard")} />
            <Chip
              text={t("log.dayChip", { n: activeDayIndex + 1 })}
              active
              onPress={() => {
                if (activeWorkoutId) { Alert.alert(t("log.lockedAlert"), t("log.lockedSwitchDay")); return; }
                setDayPickerOpen(true);
              }}
            />
            <Chip text={activeWorkoutId ? t("log.activeWorkout") : t("log.noWorkout")} />
          </View>

          {periodization && isDeload ? (
            <View style={{
              backgroundColor: theme.warn + "22",
              borderColor: theme.warn,
              borderWidth: 1,
              borderRadius: 14,
              padding: 12,
              alignItems: "center",
            }}>
              <Text style={{ color: theme.warn, fontFamily: theme.mono, fontSize: 14, fontWeight: "600" }}>
                {t("periodization.deloadBannerSets")}
              </Text>
            </View>
          ) : null}

          <Card title={t("log.sessionCard")} style={{ borderColor: theme.accent, backgroundColor: theme.isDark ? "rgba(182, 104, 245, 0.12)" : "rgba(124, 58, 237, 0.06)" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("log.duration")}</Text>
                <Text style={{ color: theme.text, fontSize: 18, fontFamily: theme.mono }}>{mmss(workoutElapsedSec)}</Text>
              </View>
            </View>
            <View style={{ marginTop: 12 }}>
              {activeWorkoutId ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn label={t("log.endWorkout")} onPress={endWorkout} tone="danger" />
                  <Btn label={t("templates.save")} onPress={() => { setTemplateName(""); setSaveTemplateOpen(true); }} />
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn label={t("log.startWorkout")} onPress={startWorkout} tone="accent" />
                  <Btn label={t("templates.title")} onPress={() => setTemplatePickerOpen(true)} />
                </View>
              )}
            </View>
            <Text style={{ color: theme.muted }}>{t("log.sessionHint")}</Text>
            {activeWorkoutId ? (
              <TextInput
                value={workoutNotes}
                onChangeText={(v) => {
                  setWorkoutNotes(v);
                  getDb().runAsync(`UPDATE workouts SET notes = ? WHERE id = ?`, [v, activeWorkoutId]).catch(() => {});
                }}
                placeholder={t("log.sessionNotePlaceholder")}
                placeholderTextColor={theme.muted}
                multiline
                style={{
                  color: theme.text, backgroundColor: theme.glass, borderColor: theme.glassBorder,
                  borderWidth: 1, borderRadius: theme.radius.md, padding: 10,
                  fontFamily: theme.mono, fontSize: theme.fontSize.sm, minHeight: 40, maxHeight: 100,
                }}
              />
            ) : null}
          </Card>

          <Card title={t("log.dayCard")}>
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
              {t("log.nextSuggestion", { n: suggestedDayIndex + 1 })}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(program?.days ?? []).map((_, i) => (
                <Chip key={`day_${i}`} text={t("log.dayLabel", { n: i + 1 })} active={activeDayIndex === i} onPress={() => selectDayIndex(i)} />
              ))}
            </View>
          </Card>

          <Card title={t("log.jumpTo")}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {anchorItems.map((item) => (
                <Chip key={item.key} text={shortLabel(item.label)} onPress={() => scrollToAnchorKey(item.key)} />
              ))}
            </ScrollView>
          </Card>

          <View style={{ gap: 12 }}>
            {renderBlocks.map((block, blockIdx) => {
              if (block.type === "single") {
                const exId = block.exId;
                return (
                  <SingleExerciseCard
                    key={block.anchorKey}
                    exId={exId}
                    baseExId={block.baseExId}
                    anchorKey={block.anchorKey}
                    input={inputs[exId] ?? { weight: "", reps: "", rpe: "" }}
                    sets={setsByExercise[exId] ?? []}
                    target={getTargetFor(exId)}
                    lastSet={lastSets[exId]}
                    prBanner={prBanners[exId]}
                    coachHint={buildCoachHint(exId)}
                    altList={alternatives[activeDayIndex]?.[block.baseExId] ?? []}
                    exerciseNote={exerciseNotes[exId] ?? ""}
                    isFocused={quickExerciseId === exId}
                    lastAddedSetId={lastAddedSetId}
                    lastAddedAnim={lastAddedAnim}
                    workoutId={activeWorkoutId}
                    exerciseIndex={blockIdx}
                    onLayout={(e) => {
                      anchorPositionsRef.current[block.anchorKey] = e.nativeEvent.layout.y;
                      anchorLayoutRef.current[block.anchorKey] = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
                    }}
                    {...cardCallbacks}
                  />
                );
              }

              const nextSide = supersetAlternate ? (supersetNext[block.anchorKey] ?? "a") : "a";
              const nextLabel = nextSide === "a" ? "A" : "B";

              return (
                <SupersetCard
                  key={block.anchorKey}
                  anchorKey={block.anchorKey}
                  exIdA={block.a}
                  exIdB={block.b}
                  baseA={block.baseA}
                  baseB={block.baseB}
                  inputA={inputs[block.a] ?? { weight: "", reps: "", rpe: "" }}
                  inputB={inputs[block.b] ?? { weight: "", reps: "", rpe: "" }}
                  setsA={setsByExercise[block.a] ?? []}
                  setsB={setsByExercise[block.b] ?? []}
                  targetA={getTargetFor(block.a)}
                  targetB={getTargetFor(block.b)}
                  lastSetA={lastSets[block.a]}
                  lastSetB={lastSets[block.b]}
                  prBannerA={prBanners[block.a]}
                  prBannerB={prBanners[block.b]}
                  coachHintA={buildCoachHint(block.a)}
                  coachHintB={buildCoachHint(block.b)}
                  altListA={alternatives[activeDayIndex]?.[block.baseA] ?? []}
                  altListB={alternatives[activeDayIndex]?.[block.baseB] ?? []}
                  exerciseNoteA={exerciseNotes[block.a] ?? ""}
                  exerciseNoteB={exerciseNotes[block.b] ?? ""}
                  focusedExerciseId={quickExerciseId}
                  lastAddedSetId={lastAddedSetId}
                  lastAddedAnim={lastAddedAnim}
                  workoutId={activeWorkoutId}
                  exerciseIndex={blockIdx}
                  nextLabel={nextLabel}
                  onLayout={(e) => {
                    anchorPositionsRef.current[block.anchorKey] = e.nativeEvent.layout.y;
                    anchorLayoutRef.current[block.anchorKey] = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
                  }}
                  onAddSuperset={() => addSetForSuperset(block)}
                  {...cardCallbacks}
                />
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OnboardingModal visible={showOnboarding} onDone={completeOnboarding} onClose={completeOnboarding} />

      {/* Exercise Swap Modal */}
      <ExerciseSwapModal
        visible={altPickerOpen}
        onClose={() => { setAltPickerOpen(false); setAltPickerBase(null); }}
        baseExId={altPickerBase}
        alternativeIds={altPickerBase ? [altPickerBase, ...(alternatives[activeDayIndex]?.[altPickerBase] ?? [])] : []}
        resolvedExId={altPickerBase ? resolveSelectedExId(altPickerBase) : null}
        onChoose={chooseAlternative}
        onSetDefault={handleSetAlternativeAsDefault}
        onCreateCustom={handleCreateCustomFromAlt}
        lastSets={lastSets}
        exerciseNotes={exerciseNotes}
      />

      {/* Day Picker Modal */}
      <Modal visible={dayPickerOpen} transparent animationType="fade" onRequestClose={() => setDayPickerOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }} onPress={() => setDayPickerOpen(false)}>
          <View onStartShouldSetResponder={() => true} style={{
            backgroundColor: theme.modalGlass, borderColor: theme.glassBorder, borderWidth: 1,
            borderRadius: theme.radius.xl, padding: 18, gap: 14,
            shadowColor: theme.shadow.lg.color, shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius, shadowOffset: theme.shadow.lg.offset, elevation: theme.shadow.lg.elevation,
          }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>{t("log.chooseDay")}</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {(program?.days ?? []).map((_, i) => (
                <Chip key={`day_pick_${i}`} text={t("log.dayLabel", { n: i + 1 })} active={activeDayIndex === i}
                  onPress={() => { selectDayIndex(i); setDayPickerOpen(false); }} />
              ))}
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label={t("common.close")} onPress={() => setDayPickerOpen(false)} />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Set Modal */}
      <Modal visible={editSetOpen} transparent animationType="fade" onRequestClose={() => setEditSetOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }} onPress={() => setEditSetOpen(false)}>
          <View onStartShouldSetResponder={() => true} style={{
            backgroundColor: theme.modalGlass, borderColor: theme.glassBorder, borderWidth: 1,
            borderRadius: theme.radius.xl, padding: 18, gap: 14,
            shadowColor: theme.shadow.lg.color, shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius, shadowOffset: theme.shadow.lg.offset, elevation: theme.shadow.lg.elevation,
          }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>{t("log.editSet")}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextField value={editWeight} onChangeText={setEditWeight} placeholder={wu.unitLabel().toLowerCase()} placeholderTextColor={theme.muted} keyboardType="numeric"
                style={{ flex: 1, minHeight: 48, color: theme.text, backgroundColor: theme.panel, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 }} />
              <TextField value={editReps} onChangeText={setEditReps} placeholder="reps" placeholderTextColor={theme.muted} keyboardType="numeric"
                style={{ flex: 1, minHeight: 48, color: theme.text, backgroundColor: theme.panel, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 }} />
              <TextField value={editRpe} onChangeText={setEditRpe} placeholder="rpe" placeholderTextColor={theme.muted} keyboardType="numeric"
                style={{ width: 80, minHeight: 48, color: theme.text, backgroundColor: theme.panel, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: theme.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 17 }} />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label={t("common.save")} onPress={saveEditSet} tone="accent" />
              <Btn label={t("common.cancel")} onPress={() => setEditSetOpen(false)} />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Rest Settings Modal is now rendered by FloatingRestTimer in _layout.tsx */}

      {/* Plate Calculator Modal */}
      <PlateCalcModal
        visible={plateCalcExId !== null}
        onClose={() => setPlateCalcExId(null)}
        weightStr={plateCalcExId ? (inputs[plateCalcExId]?.weight ?? "") : ""}
        exerciseId={plateCalcExId}
      />

      {/* Undo Toast */}
      <UndoToast
        visible={undoVisible}
        message={t("log.setAdded")}
        undoLabel={t("log.undo")}
        onUndo={handleUndo}
        onDismiss={() => { setUndoVisible(false); setUndoSet(null); }}
      />

      {/* Achievement Toast */}
      {achievementToast.achievement && (
        <AchievementToast
          visible={achievementToast.visible}
          achievementName={achievementToast.achievement.name}
          achievementIcon={achievementToast.achievement.icon}
          points={achievementToast.achievement.points}
          tier={achievementToast.achievement.tier}
          onDismiss={() => setAchievementToast({ visible: false, achievement: null })}
          onTap={() => {
            const achId = achievementToast.achievement?.id;
            router.push({ pathname: "/achievements", params: achId ? { scrollTo: achId } : {} });
          }}
        />
      )}

      {/* Template Picker Modal */}
      <TemplatePickerModal
        visible={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onSelect={handleTemplateSelect}
      />

      {/* Save as Template Modal */}
      <Modal visible={saveTemplateOpen} transparent animationType="fade" onRequestClose={() => setSaveTemplateOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }} onPress={() => setSaveTemplateOpen(false)}>
          <View onStartShouldSetResponder={() => true} style={{
            backgroundColor: theme.modalGlass, borderColor: theme.glassBorder, borderWidth: 1,
            borderRadius: theme.radius.xl, padding: 18, gap: 14,
            shadowColor: theme.shadow.lg.color, shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius, shadowOffset: theme.shadow.lg.offset, elevation: theme.shadow.lg.elevation,
          }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
              {t("templates.save")}
            </Text>
            <TextField
              value={templateName}
              onChangeText={setTemplateName}
              placeholder={t("templates.namePlaceholder")}
              placeholderTextColor={theme.muted}
              style={{
                color: theme.text,
                backgroundColor: theme.glass,
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.md,
                padding: 12,
                fontFamily: theme.mono,
              }}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label={t("common.save")} onPress={handleSaveTemplate} tone="accent" />
              <Btn label={t("common.cancel")} onPress={() => setSaveTemplateOpen(false)} />
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Finish Workout Summary Modal */}
      <Modal visible={!!finishSummary} transparent animationType="fade" onRequestClose={() => setFinishSummary(null)}>
        <Pressable
          onPress={() => setFinishSummary(null)}
          style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", alignItems: "center", padding: 16 }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 340,
              backgroundColor: theme.modalGlass,
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: theme.radius.xl,
              padding: 24,
              gap: 16,
              shadowColor: theme.shadow.lg.color,
              shadowOpacity: theme.shadow.lg.opacity,
              shadowRadius: theme.shadow.lg.radius,
              shadowOffset: theme.shadow.lg.offset,
              elevation: theme.shadow.lg.elevation,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.fontFamily.bold, fontSize: 20, textAlign: "center" }}>
              {t("log.workoutComplete")}
            </Text>

            <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 22 }}>{finishSummary?.duration}</Text>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{t("common.duration")}</Text>
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 22 }}>{finishSummary?.totalSets}</Text>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{t("common.sets")}</Text>
              </View>
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 22 }}>{finishSummary?.exercises}</Text>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{t("common.exercises")}</Text>
              </View>
            </View>

            <View style={{ borderTopWidth: 1, borderTopColor: theme.glassBorder, paddingTop: 12, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("common.volume")}</Text>
                <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 14 }}>
                  {formatWeight(finishSummary?.totalVolume ?? 0)} {wu.unitLabel()}
                </Text>
              </View>
              {finishSummary?.topE1rm ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("log.topE1rm")}</Text>
                  <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 14 }}>
                    {finishSummary.topE1rm.name}: {formatWeight(finishSummary.topE1rm.value)} {wu.unitLabel()}
                  </Text>
                </View>
              ) : null}
            </View>

            {finishSummary?.prs.length ? (
              <View style={{
                borderWidth: 1,
                borderColor: theme.accent,
                borderRadius: theme.radius.lg,
                backgroundColor: theme.isDark ? "rgba(182, 104, 245, 0.1)" : "rgba(124, 58, 237, 0.06)",
                padding: 12,
                gap: 4,
              }}>
                <Text style={{ color: theme.accent, fontFamily: theme.fontFamily.semibold, fontSize: 13 }}>
                  {t("log.prsThisSession")}
                </Text>
                {finishSummary.prs.map((pr, i) => (
                  <Text key={i} style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                    {pr}
                  </Text>
                ))}
              </View>
            ) : null}

            {finishSummary?.volumePrs.length ? (
              <View style={{
                borderWidth: 1,
                borderColor: theme.warn ?? "#F97316",
                borderRadius: theme.radius.lg,
                backgroundColor: theme.isDark ? "rgba(249, 115, 22, 0.1)" : "rgba(249, 115, 22, 0.06)",
                padding: 12,
                gap: 4,
              }}>
                <Text style={{ color: theme.warn ?? "#F97316", fontFamily: theme.fontFamily.semibold, fontSize: 13 }}>
                  {t("log.volumePrsThisSession")}
                </Text>
                {finishSummary.volumePrs.map((pr, i) => (
                  <Text key={i} style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                    {pr}
                  </Text>
                ))}
              </View>
            ) : null}

            <Btn label={t("common.done")} onPress={() => setFinishSummary(null)} tone="accent" />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
