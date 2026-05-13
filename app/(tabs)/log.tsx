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
  isPerSideExercise,
} from "../../src/exerciseLibrary";
import ProgramStore from "../../src/programStore";
import type { Program, ProgramBlock, AlternativesMap } from "../../src/programStore";
import ProgressionStore, {
  defaultTargetForExercise,
  type ExerciseTarget,
  type TargetsByDay,
} from "../../src/progressionStore";
import { SkeletonExerciseCard } from "../../src/components/Skeleton";
import OnboardingModal from "../../components/OnboardingModal";
import HintBanner from "../../src/components/HintBanner";
import { Screen, TopBar, Card, Chip, Btn, IconButton, TextField } from "../../src/ui";
import { setupNotificationHandler, cancelAllRestNotifications } from "../../src/notifications";
import { useRestTimer, mmss, recommendedRestSeconds } from "../../src/restTimerContext";
import { checkAndUnlockAchievements, type Achievement } from "../../src/achievements";
import { loadPrRecords, checkSetPRs, checkSessionVolumePRs, recomputePRForExercise, type PrMap } from "../../src/prEngine";
import { getAllNotes, setNote, deleteNote } from "../../src/exerciseNotes";
import { AchievementToast, UndoToast } from "../../src/ui/modern";
import { listGyms, getActiveGymId, setActiveGymId as setActiveGymIdStore, getActiveGym, getGymEquipmentSet, isEquipmentAvailable } from "../../src/gymStore";
import type { GymLocation } from "../../src/gymStore";
import GymPickerModal from "../../src/components/modals/GymPickerModal";
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
import ExerciseAddModal from "../../src/components/modals/ExerciseAddModal";
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
      c?: string;
      baseA: string;
      baseB: string;
      baseC?: string;
      anchorKey: string;
    };

function roundWeight(n: number) {
  return Math.round(n * 10) / 10;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      resolve(null);
    }, ms);
  });
  try {
    const result = await Promise.race([promise, timeout]);
    return result as T | null;
  } catch (err) {
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
  const [activeGymId, setActiveGymId] = useState<string | null>(null);
  const [gyms, setGyms] = useState<GymLocation[]>([]);
  const [gymPickerOpen, setGymPickerOpen] = useState(false);
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
  const [targets, setTargets] = useState<TargetsByDay>({});
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
    plannedSets: number;
    doneSets: number;
    bonusSets: number;
    adHocExerciseNames: string[];
  } | null>(null);

  const [undoSet, setUndoSet] = useState<{ row: SetRow; exerciseId: string; prSetId?: string } | null>(null);
  const [undoVisible, setUndoVisible] = useState(false);
  const [plateCalcExId, setPlateCalcExId] = useState<string | null>(null);
  const [goalExId, setGoalExId] = useState<string | null>(null);
  const [goalType, setGoalType] = useState<"weight" | "volume" | "reps">("weight");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalExGoals, setGoalExGoals] = useState<{ id: string; goalType: string; targetValue: number; currentValue: number; achievedAt: string | null }[]>([]);
  const [goalLabels, setGoalLabels] = useState<Record<string, string>>({});

  const [adHocExercises, setAdHocExercises] = useState<string[]>([]);
  const [addExerciseModalOpen, setAddExerciseModalOpen] = useState(false);

  const [editSetOpen, setEditSetOpen] = useState(false);
  const [editSet, setEditSet] = useState<SetRow | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [editReps, setEditReps] = useState("");
  const [editRpe, setEditRpe] = useState("");

  // Rest timer state comes from useRestTimer context
  const restTimer = useRestTimer();

  // Note: prior `supersetAlternate` toggle and `supersetNext` map were retired with the round-card refactor.
  // Setting still exists for backwards compatibility but the round-card always alternates within a round.

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
  // Y-offset of the exercise-cards wrapper inside the ScrollView content.
  // Card onLayout reports y relative to this wrapper, so we add this offset
  // when computing the scroll target for "Jump to" / focusExercise.
  const blocksWrapperOffsetRef = useRef(0);
  // Track which active workout we've already shown the auto-end prompt for
  // so we don't pester the user every time they add an extra set after.
  const endPromptShownForRef = useRef<string | null>(null);

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

      const onboardingRaw = await getSettingAsync("hasSeenOnboarding");

      setProgramMode(pm);
      setShowOnboarding(onboardingRaw !== "1");

      // Load gym data
      const gymList = listGyms();
      const savedGymId = getActiveGymId();
      setGyms(gymList);
      setActiveGymId(savedGymId);

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
          await setSettingAsync("adHocExercises", "").catch(() => {});
          setActiveWorkoutId(null);
          setWorkoutStartedAt(null);
          setAdHocExercises([]);
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
            const supersetIds = block.c ? [block.a, block.b, block.c] : [block.a, block.b];
            for (const exIdSlot of supersetIds) {
              const libraryAltsSlot = alternativesFor(exIdSlot);
              const programAltsForSlot = programAlts[dayIndex]?.[exIdSlot] ?? [];
              const combinedSlot = Array.from(new Set([...libraryAltsSlot, ...programAltsForSlot]));
              if (combinedSlot.length > 0) {
                mergedAlts[dayIndex][exIdSlot] = combinedSlot;
              }
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

      // Load ad-hoc exercises
      let restoredAdHoc: string[] = [];
      if (activeRow) {
        try {
          const savedAdHoc = await getSettingAsync("adHocExercises");
          if (savedAdHoc) {
            const parsed = JSON.parse(savedAdHoc);
            if (Array.isArray(parsed)) restoredAdHoc = parsed;
          }
        } catch {}
      }

      // Batch all state updates together to avoid intermediate renders with stale selectedAlternatives
      setProgram(prog);
      setAlternatives(mergedAlts);
      setSuggestedDayIndex(suggested);
      setActiveDayIndex(day);
      setSelectedAlternatives(restoredAlts);
      setAdHocExercises(restoredAdHoc);

      // Load periodization
      try {
        const periodCfg = await getPeriodization(prog.id);
        setPeriodization(periodCfg);
      } catch {
        setPeriodization(null);
      }
    } catch (err) {
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
      .catch(() => {})
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
    const blocks: RenderBlock[] = [];
    if (dayPlan) {
      for (let idx = 0; idx < dayPlan.blocks.length; idx++) {
        const b = dayPlan.blocks[idx];
        const anchorKey = b.type === "single"
          ? `ex_${b.exId}_${idx}`
          : `ss_${b.a}_${b.b}${b.c ? `_${b.c}` : ""}_${idx}`;
        if (b.type === "single") {
          const selected = resolveSelectedExId(b.exId);
          blocks.push({ type: "single", exId: selected, baseExId: b.exId, anchorKey });
        } else {
          const selectedA = resolveSelectedExId(b.a);
          const selectedB = resolveSelectedExId(b.b);
          if (b.c) {
            const selectedC = resolveSelectedExId(b.c);
            blocks.push({ type: "superset", a: selectedA, b: selectedB, c: selectedC, baseA: b.a, baseB: b.b, baseC: b.c, anchorKey });
          } else {
            blocks.push({ type: "superset", a: selectedA, b: selectedB, baseA: b.a, baseB: b.b, anchorKey });
          }
        }
      }
    }
    // Append ad-hoc exercises
    for (const exId of adHocExercises) {
      blocks.push({ type: "single", exId, baseExId: exId, anchorKey: `adhoc_${exId}` });
    }
    return blocks;
  }, [dayPlan, alternatives, selectedAlternatives, activeDayIndex, adHocExercises]);

  const exerciseIds = useMemo(() => {
    const list: string[] = [];
    for (const b of renderBlocks) {
      if (b.type === "single") list.push(b.exId);
      else {
        list.push(b.a, b.b);
        if (b.c) list.push(b.c);
      }
    }
    return Array.from(new Set(list));
  }, [renderBlocks]);

  const adHocSet = useMemo(() => new Set(adHocExercises), [adHocExercises]);

  function addAdHocExercise(exId: string) {
    if (adHocExercises.includes(exId) || exerciseIds.includes(exId)) return;
    const next = [...adHocExercises, exId];
    setAdHocExercises(next);
    setSettingAsync("adHocExercises", JSON.stringify(next)).catch(() => {});
    setAddExerciseModalOpen(false);
  }

  const anchorItems = useMemo(() => {
    return renderBlocks.map((b) => {
      if (b.type === "single") return { key: b.anchorKey, label: displayNameFor(b.exId) };
      const label = b.c
        ? `${displayNameFor(b.a)} / ${displayNameFor(b.b)} / ${displayNameFor(b.c)}`
        : `${displayNameFor(b.a)} / ${displayNameFor(b.b)}`;
      return { key: b.anchorKey, label };
    });
  }, [renderBlocks]);

  const anchorKeyByExerciseId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const b of renderBlocks) {
      if (b.type === "single") { map[b.exId] = b.anchorKey; }
      else {
        map[b.a] = b.anchorKey;
        map[b.b] = b.anchorKey;
        if (b.c) map[b.c] = b.anchorKey;
      }
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

  // Reset the "auto-end prompt shown" flag when a new workout starts.
  useEffect(() => {
    if (!activeWorkoutId) endPromptShownForRef.current = null;
  }, [activeWorkoutId]);

  // Auto-prompt: when every planned (non-ad-hoc) exercise has hit its
  // target_sets, ask the user whether to wrap up the session. Fires once per
  // workout, never for programs without explicit set targets, and never if
  // the user already dismissed it in this session.
  useEffect(() => {
    if (!activeWorkoutId) return;
    if (endPromptShownForRef.current === activeWorkoutId) return;
    if (renderBlocks.length === 0) return;

    let anyTargetDefined = false;
    let allTargetsHit = true;
    for (const block of renderBlocks) {
      const exIds = block.type === "single"
        ? [block.exId]
        : [block.a, block.b, ...(block.c ? [block.c] : [])];
      for (const eid of exIds) {
        if (adHocSet.has(eid)) continue;
        const tgt = getTargetFor(eid);
        if (tgt.targetSets > 0) {
          anyTargetDefined = true;
          const working = (setsByExercise[eid] ?? []).filter((s) => !s.is_warmup).length;
          if (working < tgt.targetSets) {
            allTargetsHit = false;
            break;
          }
        }
      }
      if (!allTargetsHit) break;
    }

    if (anyTargetDefined && allTargetsHit) {
      endPromptShownForRef.current = activeWorkoutId;
      Alert.alert(
        t("log.allSetsDone"),
        t("log.endNowPrompt"),
        [
          { text: t("log.keepGoing"), style: "cancel" },
          { text: t("log.endWorkout"), style: "default", onPress: () => {
            Alert.alert(t("log.confirmEnd"), t("log.confirmEndMsg"), [
              { text: t("common.cancel"), style: "cancel" },
              { text: t("log.endWorkout"), style: "destructive", onPress: endWorkout },
            ]);
          } },
        ],
      );
    }
    // We intentionally exclude `getTargetFor` and `endWorkout` from deps —
    // both are recreated on every render and would re-fire this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setsByExercise, renderBlocks, activeWorkoutId, adHocSet]);

  // Rest timer functions (getRestForExercise, startRestTimer, stopRestTimer) are now in restTimerContext

  // Load goal labels for exercises in current day
  useEffect(() => {
    const pid = program?.id;
    if (!pid || exerciseIds.length === 0) { setGoalLabels({}); return; }
    let cancelled = false;
    import("../../src/goals").then(async ({ getGoalsForExercise }) => {
      const labels: Record<string, string> = {};
      for (const exId of exerciseIds) {
        try {
          const goals = await getGoalsForExercise(exId, pid);
          const active = goals.filter(g => !g.achievedAt);
          if (active.length > 0) {
            const g = active[0];
            labels[exId] = `${g.goalType}: ${g.targetValue}`;
          }
        } catch {}
      }
      if (!cancelled) setGoalLabels(labels);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [program?.id, exerciseIds]);

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

  const fireHapticSetConfirmed = useCallback(async () => {
    if (!restTimer.restHaptics || Platform.OS === "web") return;
    try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch {}
  }, [restTimer.restHaptics]);

  const exerciseIdsKey = useMemo(() => exerciseIds.join("|"), [exerciseIds]);

  useEffect(() => {
    if (!program?.id || exerciseIds.length === 0) return;
    let alive = true;
    (async () => {
      const pairs = exerciseIds.map((exerciseId) => ({ dayIndex: activeDayIndex, exerciseId }));
      await ProgressionStore.ensureTargets(program.id, pairs);
      const targetMap = await ProgressionStore.getTargets(program.id);
      if (!alive) return;
      setTargets(targetMap);
    })();
    return () => { alive = false; };
  }, [program?.id, exerciseIdsKey, exerciseIds, activeDayIndex]);

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
      const last: Record<string, LastSetInfo> = {};
      const db = getDb();

      // Per-exercise lookup: a single LIMIT across all exercises drops history
      // for ad-hoc exercises whose last log is older than the program rotation.
      for (const exId of exerciseIds) {
        if (activeGymId) {
          const gymRow = db.getFirstSync<SetRow>(
            `SELECT s.workout_id, s.exercise_id, s.exercise_name, s.weight, s.reps, s.rpe, s.created_at
             FROM sets s
             JOIN workouts w ON s.workout_id = w.id
             WHERE s.exercise_id = ? AND w.gym_id = ?
             ORDER BY s.created_at DESC
             LIMIT 1`,
            [exId, activeGymId]
          );
          if (gymRow) {
            last[exId] = { weight: gymRow.weight, reps: gymRow.reps, rpe: gymRow.rpe ?? null, created_at: gymRow.created_at, workout_id: gymRow.workout_id };
            continue;
          }
          const fallback = db.getFirstSync<SetRow>(
            `SELECT workout_id, exercise_id, exercise_name, weight, reps, rpe, created_at
             FROM sets WHERE exercise_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [exId]
          );
          if (fallback) {
            last[exId] = { weight: fallback.weight, reps: fallback.reps, rpe: fallback.rpe ?? null, created_at: fallback.created_at, workout_id: fallback.workout_id, fromOtherGym: true };
          }
        } else {
          const row = db.getFirstSync<SetRow>(
            `SELECT workout_id, exercise_id, exercise_name, weight, reps, rpe, created_at
             FROM sets WHERE exercise_id = ?
             ORDER BY created_at DESC
             LIMIT 1`,
            [exId]
          );
          if (row) {
            last[exId] = { weight: row.weight, reps: row.reps, rpe: row.rpe ?? null, created_at: row.created_at, workout_id: row.workout_id };
          }
        }
      }

      setLastSets(last);
    } catch { setLastSets({}); }
  }, [ready, exerciseIdsKey, exerciseIds, program?.id, activeGymId]);

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
        next[exId] = { weight: formatWeight(wu.toDisplay(info.weight)), reps: String(info.reps), rpe: info.rpe != null ? String(info.rpe) : "" };
      }
      return next;
    });
  }, [lastSets]);

  const isDeload = periodization ? isDeloadWeek(periodization) : false;

  function getTargetFor(exId: string) {
    const target = targets[activeDayIndex]?.[exId];
    const base = target ?? { programId: program?.id ?? "", exerciseId: exId, dayIndex: activeDayIndex, repMin: defaultTargetForExercise(exId).repMin, repMax: defaultTargetForExercise(exId).repMax, targetSets: defaultTargetForExercise(exId).targetSets, incrementKg: defaultTargetForExercise(exId).incrementKg, updatedAt: "", autoProgress: false } as ExerciseTarget;
    if (isDeload) {
      return { ...base, targetSets: Math.max(1, base.targetSets - 1) };
    }
    return base;
  }

  function getIncrementForExercise(exId: string) {
    const target = targets[activeDayIndex]?.[exId];
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

  async function handleCreateCustomFromAlt(baseExId: string, name: string, equipment: Equipment, tags: ExerciseTag[], isPerSide: boolean = false) {
    if (!program?.id) return;
    const base = getExercise(baseExId);
    const newId = await createCustomExercise({
      displayName: name,
      equipment,
      tags: tags.length > 0 ? tags : tagsFor(baseExId),
      defaultIncrementKg: base?.defaultIncrementKg ?? 2.5,
      isPerSide,
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
          if (block.c === baseExId) return { ...block, c: newDefaultExId };
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
      Alert.alert(t("common.error"), String(err));
    }
  }

  function dayKeyForIndex(idx: number) { return `day_${idx + 1}`; }
  function getDayKey() { return dayKeyForIndex(activeDayIndex); }

  function selectDayIndex(i: number) {
    if (activeWorkoutId) {
      Alert.alert(t("log.lockedAlert"), t("log.lockedSwitchDay"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("log.endAndSwitch"),
          style: "destructive",
          onPress: async () => {
            await endWorkout();
            setActiveDayIndex(i);
          },
        },
      ]);
      return;
    }
    setActiveDayIndex(i);
  }

  function scrollToAnchorKey(key: string) {
    const y = anchorPositionsRef.current[key];
    if (!Number.isFinite(y)) return;
    // Card y is relative to the blocks wrapper, so add the wrapper's own
    // offset from the top of the ScrollView content. 16px breathing room
    // keeps the card top just below the screen edge.
    const absoluteY = y + blocksWrapperOffsetRef.current - 16;
    scrollRef.current?.scrollTo({ y: Math.max(0, absoluteY), animated: true });
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
      `INSERT INTO workouts(id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at, gym_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, isoDateOnly(), programMode, programId, getDayKey(), "green", "", activeDayIndex, startedAt, activeGymId ?? null]
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
    const totalVolume = workoutSets.reduce((sum, s) => {
      const multiplier = isPerSideExercise(s.exercise_id ?? "") ? 2 : 1;
      return sum + (s.weight ?? 0) * (s.reps ?? 0) * multiplier;
    }, 0);
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

    // Compute set tracking stats (exclude ad-hoc exercises from planned ratio)
    let totalPlannedSets = 0;
    let totalDoneSets = 0;
    let totalBonusSets = 0;
    for (const block of renderBlocks) {
      const exIdsInBlock = block.type === "single" ? [block.exId] : [block.a, block.b];
      for (const eid of exIdsInBlock) {
        if (adHocSet.has(eid)) continue;
        const tgt = getTargetFor(eid);
        const workingSets = (setsByExercise[eid] ?? []).filter(s => !s.is_warmup).length;
        if (tgt.targetSets > 0) {
          totalPlannedSets += tgt.targetSets;
          totalDoneSets += Math.min(workingSets, tgt.targetSets);
          totalBonusSets += Math.max(0, workingSets - tgt.targetSets);
        } else {
          totalDoneSets += workingSets;
        }
      }
    }

    setFinishSummary({
      duration: mmss(workoutElapsedSec),
      totalSets: workoutSets.length,
      totalVolume: round1(wu.toDisplay(totalVolume)),
      exercises: exerciseIds.size,
      topE1rm: topE1rm ? { name: topE1rm.name, value: round1(wu.toDisplay(topE1rm.value)) } : null,
      prs,
      volumePrs,
      plannedSets: totalPlannedSets,
      doneSets: totalDoneSets,
      bonusSets: totalBonusSets,
      adHocExerciseNames: adHocExercises.map((exId) => displayNameFor(exId)),
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
    await setSettingAsync("adHocExercises", "").catch(() => {});
    setAdHocExercises([]);
    setActiveWorkoutId(null);
    restTimer.stopRestTimer(); // Cancel any running rest timer + clear scheduled notification
    restTimer.setActiveWorkoutId(null); // Hide floating timer
    restTimer.setFocusedExerciseId(null);
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
    Animated.timing(lastAddedAnim, { toValue: 0, duration: 1100, useNativeDriver: false }).start(() => {
      setLastAddedSetId((prev) => (prev === id ? null : prev));
    });
  }

  async function addSetForExercise(exId: string, forcedIndex?: number, opts?: { skipRestTimer?: boolean }) {
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
    fireHapticSetConfirmed();
    Keyboard.dismiss();

    // Haptic feedback when target sets are completed
    if (!row.is_warmup) {
      const target = getTargetFor(exId);
      const currentWorkingSets = (setsByExercise[exId] ?? []).filter(s => !s.is_warmup).length + 1;
      if (target.targetSets > 0 && currentWorkingSets === target.targetSets) {
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      }
    }

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
    const eaSuffix = isPerSideExercise(exId) ? ` (${t("log.each")})` : "";
    const messages: string[] = rawMsgs.map((msg) => {
      const [type, val] = msg.split(":");
      const num = Number(val);
      if (type === "heaviest") return t("log.newHeaviest", { weight: formatWeight(wu.toDisplay(num)) + eaSuffix });
      return t("log.newE1rm", { weight: formatWeight(wu.toDisplay(num)) + eaSuffix });
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

    if (!opts?.skipRestTimer && restTimer.restEnabled) {
      restTimer.startRestTimer(restTimer.getRestForExercise(exId));
    }
    return row;
  }

  async function logSupersetSet(
    block: Extract<RenderBlock, { type: "superset" }>,
    args: { slot: "a" | "b" | "c"; exId: string; phase: "transition" | "round" | "final"; roundNum: number; totalRounds: number; isBonus: boolean },
  ) {
    const row = await addSetForExercise(args.exId, undefined, { skipRestTimer: true });
    if (!row) return;

    if (!restTimer.restEnabled) return;

    // Determine rest seconds for the upcoming pause.
    if (args.isBonus) {
      // Bonus = treat as single-exercise rest for the slot.
      restTimer.startRestTimer(restTimer.getRestForExercise(args.exId));
      return;
    }

    if (args.phase === "transition") {
      const seconds = restTimer.transitionRestSeconds;
      if (seconds <= 0) {
        // Don't start a timer if user disabled transition rest.
        restTimer.stopRestTimer();
        return;
      }
      restTimer.startRestTimer(seconds, {
        phase: "transition",
        phaseLabel: t("log.restPhaseTransition"),
      });
      return;
    }

    if (args.phase === "round" || args.phase === "final") {
      // Use max rest across non-dropped slots in the block (per spec).
      const slotIds: string[] = [block.a, block.b, ...(block.c ? [block.c] : [])];
      const restCandidates = slotIds.map((id) => restTimer.getRestForExercise(id)).filter((n) => Number.isFinite(n) && n > 0);
      const seconds = restCandidates.length > 0 ? Math.max(...restCandidates) : restTimer.getRestForExercise(args.exId);
      const phaseLabel = args.phase === "final"
        ? t("log.restPhaseRoundFinal")
        : t("log.restPhaseRound", { n: String(args.roundNum + 1) });
      restTimer.startRestTimer(seconds, { phase: "round", phaseLabel });
      return;
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
    let estTotalLoadKgForCheck: number | null = null;
    try {
      if (isBw && editSet.exercise_id) {
        const dateOnly = editSet.created_at ? editSet.created_at.slice(0, 10) : isoDateOnly();
        const bwData = await computeBodyweightLoad(editSet.exercise_id, dateOnly, weight);
        estTotalLoadKgForCheck = bwData.est_total_load_kg ?? null;
        await getDb().runAsync(
          `UPDATE sets SET weight = ?, reps = ?, rpe = ?, external_load_kg = ?, bodyweight_kg_used = ?, bodyweight_factor = ?, est_total_load_kg = ? WHERE id = ?`,
          [weight, reps, Number.isFinite(rpe) ? rpe : null, bwData.external_load_kg ?? 0, bwData.bodyweight_kg_used ?? null, bwData.bodyweight_factor ?? null, bwData.est_total_load_kg ?? null, editSet.id]
        );
      } else {
        await getDb().runAsync(`UPDATE sets SET weight = ?, reps = ?, rpe = ? WHERE id = ?`, [weight, reps, Number.isFinite(rpe) ? rpe : null, editSet.id]);
      }
      refreshWorkoutSets();

      // PR recalculation after edit
      const exId = editSet.exercise_id ?? editSet.exercise_name;
      const pid = program?.id ?? "";
      if (exId && pid) {
        // 1) Forward check — fires banner if edited values beat the current record
        const { messages: rawMsgs } = await checkSetPRs({
          exerciseId: exId, weight, reps, setId: editSet.id,
          workoutId: activeWorkoutId ?? "", programId: pid,
          currentVolumeRecord: prRecords[exId]?.volume,
          isBw, estTotalLoadKg: estTotalLoadKgForCheck,
        });
        // 2) Full historical recompute — fixes ghost PRs if edited down
        const recomputed = recomputePRForExercise(exId, pid);
        setPrRecords((prev) => ({ ...prev, [exId]: { ...prev[exId], ...recomputed } }));

        // Show banner if forward check found a new PR
        const eaSuffix = isPerSideExercise(exId) ? ` (${t("log.each")})` : "";
        const messages: string[] = rawMsgs.map((msg) => {
          const [type, val] = msg.split(":");
          const num = Number(val);
          if (type === "heaviest") return t("log.newHeaviest", { weight: formatWeight(wu.toDisplay(num)) + eaSuffix });
          return t("log.newE1rm", { weight: formatWeight(wu.toDisplay(num)) + eaSuffix });
        });
        if (messages.length) {
          const bannerText = messages.join(" \u00B7 ");
          setPrBanners((prev) => ({ ...prev, [exId]: bannerText }));
          setTimeout(() => {
            setPrBanners((prev) => { const next = { ...prev }; if (next[exId] === bannerText) delete next[exId]; return next; });
          }, 3500);
        }
      }
    } catch { Alert.alert(t("common.error"), t("log.couldNotUpdate")); }
    finally { setEditSetOpen(false); setEditSet(null); }
  }

  async function deleteSet(row: SetRow) {
    Alert.alert(t("log.deleteSetTitle"), t("log.deleteSetMsg"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("common.delete"), style: "destructive", onPress: async () => {
        try {
          await getDb().runAsync(`DELETE FROM sets WHERE id = ?`, [row.id]);
          refreshWorkoutSets();
          // Recompute PRs for the affected exercise
          const exId = row.exercise_id ?? row.exercise_name;
          const pid = program?.id ?? "";
          if (exId && pid) {
            const recomputed = recomputePRForExercise(exId, pid);
            setPrRecords((prev) => ({ ...prev, [exId]: { ...prev[exId], ...recomputed } }));
            // Clear any lingering banner for this exercise
            setPrBanners((prev) => { const next = { ...prev }; delete next[exId]; return next; });
          }
        }
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
  const cardCallbacks = useMemo(() => ({
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
    onSetGoal: (exId: string) => {
      setGoalExId(exId);
      setGoalType("weight");
      setGoalTarget("");
      setGoalExGoals([]); // Clear stale data before loading
      // Lazy-load existing goals for this exercise
      const pid = program?.id;
      if (pid) {
        import("../../src/goals").then(async ({ getGoalsForExercise, getCurrentValueForGoal }) => {
          try {
            const goals = await getGoalsForExercise(exId, pid);
            const active = goals.filter(g => !g.achievedAt);
            const withProgress = await Promise.all(
              active.map(async (g) => ({
                id: g.id,
                goalType: g.goalType,
                targetValue: g.targetValue,
                currentValue: await getCurrentValueForGoal(g),
                achievedAt: g.achievedAt,
              }))
            );
            setGoalExGoals(withProgress);
          } catch { setGoalExGoals([]); }
        });
      } else { setGoalExGoals([]); }
    },
  }), [setInput, applyWeightStep, applyLastSet, addSetForExercise, addSetMultiple,
       openEditSet, deleteSet, focusExercise, restTimer, openAltPicker,
       handleSetAlternativeAsDefault, exerciseNotes, program?.id]);

  const activeGymEquipment = useMemo(() => {
    if (!activeGymId) return null;
    const gym = gyms.find((g) => g.id === activeGymId);
    return gym ? getGymEquipmentSet(gym) : null;
  }, [activeGymId, gyms]);

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
            {gyms.length > 0 ? (
              <Chip
                text={activeGymId ? (gyms.find((g) => g.id === activeGymId)?.name ?? t("gym.noGym")) : t("gym.noGym")}
                active={!!activeGymId}
                onPress={() => setGymPickerOpen(true)}
              />
            ) : null}
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
            {activeWorkoutId && activeGymId ? (
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                {gyms.find((g) => g.id === activeGymId)?.name ?? ""}
              </Text>
            ) : null}
            <View style={{ marginTop: 12 }}>
              {activeWorkoutId ? (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Btn label={t("log.endWorkout")} onPress={() => {
                    Alert.alert(t("log.confirmEnd"), t("log.confirmEndMsg"), [
                      { text: t("common.cancel"), style: "cancel" },
                      { text: t("log.endWorkout"), style: "destructive", onPress: endWorkout },
                    ]);
                  }} tone="danger" />
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

          {!activeWorkoutId && (
            <HintBanner hintKey="log_first_set" icon="play-circle-outline">
              {t("hint.logFirstSet")}
            </HintBanner>
          )}
          {activeWorkoutId && (
            <HintBanner hintKey="rest_timer" icon="timer">
              {t("hint.restTimer")}
            </HintBanner>
          )}

          <View
            style={{ gap: 12 }}
            onLayout={(e) => {
              blocksWrapperOffsetRef.current = e.nativeEvent.layout.y;
            }}
          >
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
                    altList={adHocSet.has(exId) ? [] : (alternatives[activeDayIndex]?.[block.baseExId] ?? [])}
                    exerciseNote={exerciseNotes[exId] ?? ""}
                    isFocused={quickExerciseId === exId}
                    lastAddedSetId={lastAddedSetId}
                    lastAddedAnim={lastAddedAnim}
                    workoutId={activeWorkoutId}
                    exerciseIndex={blockIdx}
                    gymId={activeGymId}
                    gymEquipment={activeGymEquipment}
                    activeGoalLabel={goalLabels[exId]}
                    isAdHoc={adHocSet.has(exId)}
                    onLayout={(e) => {
                      anchorPositionsRef.current[block.anchorKey] = e.nativeEvent.layout.y;
                      anchorLayoutRef.current[block.anchorKey] = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
                    }}
                    {...cardCallbacks}
                  />
                );
              }

              return (
                <SupersetCard
                  key={block.anchorKey}
                  anchorKey={block.anchorKey}
                  exIdA={block.a}
                  exIdB={block.b}
                  exIdC={block.c}
                  baseA={block.baseA}
                  baseB={block.baseB}
                  baseC={block.baseC}
                  inputA={inputs[block.a] ?? { weight: "", reps: "", rpe: "" }}
                  inputB={inputs[block.b] ?? { weight: "", reps: "", rpe: "" }}
                  inputC={block.c ? (inputs[block.c] ?? { weight: "", reps: "", rpe: "" }) : undefined}
                  setsA={setsByExercise[block.a] ?? []}
                  setsB={setsByExercise[block.b] ?? []}
                  setsC={block.c ? (setsByExercise[block.c] ?? []) : undefined}
                  targetA={getTargetFor(block.a)}
                  targetB={getTargetFor(block.b)}
                  targetC={block.c ? getTargetFor(block.c) : undefined}
                  lastSetA={lastSets[block.a]}
                  lastSetB={lastSets[block.b]}
                  lastSetC={block.c ? lastSets[block.c] : undefined}
                  prBannerA={prBanners[block.a]}
                  prBannerB={prBanners[block.b]}
                  prBannerC={block.c ? prBanners[block.c] : undefined}
                  coachHintA={buildCoachHint(block.a)}
                  coachHintB={buildCoachHint(block.b)}
                  coachHintC={block.c ? buildCoachHint(block.c) : null}
                  altListA={alternatives[activeDayIndex]?.[block.baseA] ?? []}
                  altListB={alternatives[activeDayIndex]?.[block.baseB] ?? []}
                  altListC={block.baseC ? (alternatives[activeDayIndex]?.[block.baseC] ?? []) : []}
                  exerciseNoteA={exerciseNotes[block.a] ?? ""}
                  exerciseNoteB={exerciseNotes[block.b] ?? ""}
                  exerciseNoteC={block.c ? (exerciseNotes[block.c] ?? "") : ""}
                  focusedExerciseId={quickExerciseId}
                  lastAddedSetId={lastAddedSetId}
                  lastAddedAnim={lastAddedAnim}
                  workoutId={activeWorkoutId}
                  exerciseIndex={blockIdx}
                  gymId={activeGymId}
                  gymEquipment={activeGymEquipment}
                  activeGoalLabelA={goalLabels[block.a]}
                  activeGoalLabelB={goalLabels[block.b]}
                  activeGoalLabelC={block.c ? goalLabels[block.c] : undefined}
                  onLayout={(e) => {
                    anchorPositionsRef.current[block.anchorKey] = e.nativeEvent.layout.y;
                    anchorLayoutRef.current[block.anchorKey] = { y: e.nativeEvent.layout.y, height: e.nativeEvent.layout.height };
                  }}
                  onLogRoundSet={(args) => logSupersetSet(block, args)}
                  {...cardCallbacks}
                />
              );
            })}

            {activeWorkoutId ? (
              <Pressable
                onPress={() => setAddExerciseModalOpen(true)}
                style={({ pressed }) => ({
                  borderWidth: 2,
                  borderColor: theme.glassBorder,
                  borderStyle: "dashed",
                  borderRadius: theme.radius.xl,
                  padding: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <MaterialIcons name="add-circle-outline" size={28} color={theme.muted} />
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 13 }}>
                  {t("log.addExercise")}
                </Text>
              </Pressable>
            ) : null}

            {/* End-of-program "Avslutt økt"-knapp — explicit way to finish
                without scrolling back up to the session card */}
            {activeWorkoutId ? (
              <Pressable
                onPress={() => {
                  Alert.alert(t("log.confirmEnd"), t("log.confirmEndMsg"), [
                    { text: t("common.cancel"), style: "cancel" },
                    { text: t("log.endWorkout"), style: "destructive", onPress: endWorkout },
                  ]);
                }}
                accessibilityRole="button"
                accessibilityLabel={t("log.endWorkout")}
                style={({ pressed }) => ({
                  marginTop: 4,
                  borderWidth: 1,
                  borderColor: theme.danger,
                  borderRadius: theme.radius.xl,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  backgroundColor: pressed
                    ? (theme.isDark ? "rgba(251, 113, 133, 0.18)" : "#FEE2E2")
                    : (theme.isDark ? "rgba(251, 113, 133, 0.08)" : "rgba(220, 38, 38, 0.05)"),
                })}
              >
                <Text style={{ color: theme.danger, fontFamily: theme.fontFamily.semibold, fontSize: 14 }}>
                  {t("log.endWorkout")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <OnboardingModal visible={showOnboarding} onDone={completeOnboarding} onClose={completeOnboarding} />

      {/* Exercise Swap Modal */}
      <ExerciseSwapModal
        visible={altPickerOpen}
        onClose={() => { setAltPickerOpen(false); setAltPickerBase(null); }}
        baseExId={altPickerBase}
        alternativeIds={(() => {
          if (!altPickerBase) return [];
          const fullList = [altPickerBase, ...(alternatives[activeDayIndex]?.[altPickerBase] ?? [])];
          const activeGym = getActiveGym();
          const gymEquipment = activeGym ? getGymEquipmentSet(activeGym) : null;
          if (!gymEquipment) return fullList;
          return fullList.filter((exId) => {
            const eq = getExercise(exId)?.equipment;
            if (!eq) return true;
            return isEquipmentAvailable(eq, activeGym);
          });
        })()}
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

      <GymPickerModal
        visible={gymPickerOpen}
        onClose={() => setGymPickerOpen(false)}
        gyms={gyms}
        activeGymId={activeGymId}
        onSelect={(gymId) => {
          setActiveGymIdStore(gymId);
          setActiveGymId(gymId);
          setGymPickerOpen(false);
        }}
        disabled={!!activeWorkoutId}
      />

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
        gymId={activeGymId}
      />

      {/* Goal Modal */}
      <Modal visible={goalExId !== null} animationType="fade" transparent onRequestClose={() => { setGoalExId(null); setGoalExGoals([]); }}>
        <Pressable
          onPress={() => { setGoalExId(null); setGoalTarget(""); setGoalExGoals([]); }}
          style={{ flex: 1, backgroundColor: theme.modalOverlay, padding: 14, justifyContent: "center" }}
        >
          <View
            onStartShouldSetResponder={() => true}
            style={{
              backgroundColor: theme.modalGlass,
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: theme.radius.xl,
              padding: 20,
              gap: 16,
              shadowColor: theme.shadow.lg.color,
              shadowOpacity: theme.shadow.lg.opacity,
              shadowRadius: theme.shadow.lg.radius,
              shadowOffset: theme.shadow.lg.offset,
            }}
          >
            <Text style={{ color: theme.text, fontSize: theme.fontSize.xl, fontWeight: theme.fontWeight.bold }}>
              {t("log.goalTitle")}
            </Text>
            <Text style={{ color: theme.text, fontSize: theme.fontSize.md }}>{goalExId ? displayNameFor(goalExId) : ""}</Text>

            {/* Existing goals */}
            {(() => {
              const activeGoals = goalExGoals.filter(g => !g.achievedAt);
              if (activeGoals.length === 0) return (
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("log.noActiveGoals")}</Text>
              );
              return (
                <View style={{ gap: 8 }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("log.activeGoals")}</Text>
                  {activeGoals.map((goal) => {
                    const progress = goal.targetValue > 0 ? Math.min(100, (goal.currentValue / goal.targetValue) * 100) : 0;
                    const isReps = goal.goalType === "reps";
                    return (
                      <View key={goal.id} style={{ gap: 4 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 13 }}>
                            {t(`analysis.goalType.${goal.goalType}`)}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                              {isReps ? `${goal.currentValue}` : formatWeight(wu.toDisplay(goal.currentValue))} / {isReps ? `${goal.targetValue}` : formatWeight(wu.toDisplay(goal.targetValue))}
                            </Text>
                            <Pressable onPress={async () => {
                              try {
                                const { deleteGoal } = await import("../../src/goals");
                                await deleteGoal(goal.id);
                                setGoalExGoals((prev) => prev.filter((g) => g.id !== goal.id));
                                if (goalExId) setGoalLabels((prev) => { const next = { ...prev }; delete next[goalExId]; return next; });
                              } catch {
                                Alert.alert(t("common.error"), t("log.couldNotDelete"));
                              }
                            }}>
                              <MaterialIcons name="close" size={16} color={theme.muted} />
                            </Pressable>
                          </View>
                        </View>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: theme.glass, overflow: "hidden" }}>
                          <View style={{ height: 4, borderRadius: 2, width: `${Math.round(progress)}%` as any, backgroundColor: progress >= 100 ? theme.success : theme.accent }} />
                        </View>
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                          {progress >= 100 ? t("analysis.goalAchieved") : `${Math.round(progress)}%`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {/* Add new goal */}
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("log.addNewGoal")}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(["weight", "volume", "reps"] as const).map((gt) => (
                  <Pressable
                    key={gt}
                    onPress={() => setGoalType(gt)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: "center",
                      borderRadius: theme.radius.lg,
                      borderWidth: 1,
                      borderColor: goalType === gt ? theme.accent : theme.glassBorder,
                      backgroundColor: goalType === gt
                        ? (theme.isDark ? "rgba(182,104,245,0.15)" : "rgba(124,58,237,0.10)")
                        : theme.glass,
                    }}
                  >
                    <Text style={{ color: goalType === gt ? theme.accent : theme.text, fontFamily: theme.fontFamily.medium, fontSize: 13 }}>
                      {t(`analysis.goalType.${gt}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("analysis.targetValue")}</Text>
              <TextField
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="numeric"
                placeholder={goalType === "reps" ? "12" : "100"}
                placeholderTextColor={theme.muted}
                style={{
                  color: theme.text,
                  backgroundColor: theme.glass,
                  borderColor: theme.glassBorder,
                  borderWidth: 1,
                  borderRadius: theme.radius.lg,
                  padding: 16,
                  fontSize: 28,
                  fontFamily: theme.mono,
                  textAlign: "center",
                }}
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={() => { setGoalExId(null); setGoalTarget(""); setGoalExGoals([]); }}
                style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.glassBorder, backgroundColor: theme.glass }}
              >
                <Text style={{ color: theme.text, fontFamily: theme.fontFamily.medium }}>{t("common.cancel")}</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  const target = parseFloat(goalTarget);
                  if (!target || target <= 0) { Alert.alert(t("common.error"), t("analysis.invalidGoalValue")); return; }
                  const programId = program?.id;
                  if (!programId || !goalExId) return;
                  try {
                    const { createGoal } = await import("../../src/goals");
                    const targetStore = goalType !== "reps" ? wu.toKg(target) : target;
                    await createGoal(goalExId, goalType, targetStore, programId);
                    setGoalLabels((prev) => ({ ...prev, [goalExId]: `${goalType}: ${targetStore}` }));
                    setGoalExId(null);
                    setGoalTarget("");
                    setGoalExGoals([]);
                  } catch {
                    Alert.alert(t("common.error"), t("analysis.invalidGoalValue"));
                  }
                }}
                style={{ flex: 1, paddingVertical: 14, alignItems: "center", borderRadius: theme.radius.lg, backgroundColor: theme.accent }}
              >
                <Text style={{ color: "#fff", fontFamily: theme.fontFamily.bold }}>{t("common.save")}</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

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

      {/* Add Exercise Modal (ad-hoc) */}
      <ExerciseAddModal
        visible={addExerciseModalOpen}
        onClose={() => setAddExerciseModalOpen(false)}
        onSelect={addAdHocExercise}
        existingExerciseIds={exerciseIds}
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

            {(finishSummary?.plannedSets ?? 0) > 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
                <View style={{ alignItems: "center", gap: 4 }}>
                  <Text style={{ color: theme.success, fontFamily: theme.mono, fontSize: 22 }}>
                    {finishSummary!.doneSets}/{finishSummary!.plannedSets}
                  </Text>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{t("log.setsPlannedDone")}</Text>
                </View>
                {(finishSummary?.bonusSets ?? 0) > 0 ? (
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <Text style={{ color: theme.warn, fontFamily: theme.mono, fontSize: 22 }}>+{finishSummary!.bonusSets}</Text>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{t("log.bonusSet")}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

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

            {finishSummary?.adHocExerciseNames.length ? (
              <View style={{
                borderWidth: 1,
                borderColor: theme.glassBorder,
                borderRadius: theme.radius.lg,
                padding: 12,
                gap: 4,
              }}>
                <Text style={{ color: theme.muted, fontFamily: theme.fontFamily.semibold, fontSize: 13 }}>
                  {t("log.extraExercises")}
                </Text>
                {finishSummary.adHocExerciseNames.map((name, i) => (
                  <Text key={i} style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                    {name}
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
