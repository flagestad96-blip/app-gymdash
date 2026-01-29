// app/(tabs)/settings.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { theme, setThemeMode, getThemeMode, type ThemeMode as ThemeModeSetting } from "../../src/theme";
import { ensureDb, getDb, getSettingAsync, setSettingAsync } from "../../src/db";
import ProgramStore from "../../src/programStore";
import { displayNameFor, resolveExerciseId } from "../../src/exerciseLibrary";
import AppLoading from "../../components/AppLoading";
import OnboardingModal from "../../components/OnboardingModal";
import { Screen, TopBar, Card, Chip, Btn, IconButton, TextField } from "../../src/ui";

type ProgramMode = "normal" | "back";
type ImportMode = "merge" | "fresh";
type ExerciseHistoryRow = {
  exercise_id: string;
  setCount: number;
  lastDate: string | null;
};
type CsvRow = {
  set_id: string;
  exercise_id?: string | null;
  exercise_name: string;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
  created_at?: string | null;
  workout_date?: string | null;
  day_index?: number | null;
  program_id?: string | null;
  program_name?: string | null;
};

const CURRENT_SCHEMA_VERSION = 2;
const APP_VERSION = "unknown";

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function newId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isoDateOnly(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

export default function Settings() {
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [programMode, setProgramMode] = useState<ProgramMode>("normal");
  const [defaultDayIndex, setDefaultDayIndex] = useState<number>(0);
  const [themeMode, setThemeModeState] = useState<ThemeModeSetting>("system");
  const [workoutLocked, setWorkoutLocked] = useState(false);
  const [lockedDayLabel, setLockedDayLabel] = useState<string | null>(null);

  const navigation = useNavigation();
  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);

  const [restEnabled, setRestEnabled] = useState<boolean>(true);
  const [restSeconds, setRestSeconds] = useState<number>(120);
  const [restVibrate, setRestVibrate] = useState<boolean>(false);

  const [supersetAlternate, setSupersetAlternate] = useState<boolean>(true);

  const [backupOpen, setBackupOpen] = useState<"export" | "import" | "csv" | null>(null);
  const [backupText, setBackupText] = useState("");
  const [backupCsvText, setBackupCsvText] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>("merge");

  const [shareOpen, setShareOpen] = useState<"export" | "import" | null>(null);
  const [shareText, setShareText] = useState("");
  const [shareImportText, setShareImportText] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareSetActive, setShareSetActive] = useState(true);

  const [dataToolsOpen, setDataToolsOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<ExerciseHistoryRow[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historySelection, setHistorySelection] = useState<Record<string, boolean>>({});
  const [dataToolsBusy, setDataToolsBusy] = useState(false);

  async function loadSettings() {
    await ensureDb();
    const pmRaw = await getSettingAsync("programMode");
    const pm: ProgramMode = pmRaw === "back" ? "back" : "normal";

    const tmRaw = await getSettingAsync("themeMode");
    const tm: ThemeModeSetting =
      tmRaw === "light" || tmRaw === "dark" || tmRaw === "system" ? tmRaw : getThemeMode();

    const ddiRaw = await getSettingAsync("defaultDayIndex");
    const day = clampInt(parseInt(ddiRaw ?? "0", 10), 0, 4);

    const reRaw = await getSettingAsync("restEnabled");
    const rsRaw = await getSettingAsync("restSeconds");
    const rvRaw = await getSettingAsync("restVibrate");
    const ssRaw = await getSettingAsync("supersetAlternate");

    setProgramMode(pm);
    setDefaultDayIndex(day);

    setRestEnabled(reRaw === null ? true : reRaw === "1");
    setRestSeconds(clampInt(parseInt(rsRaw ?? "120", 10), 10, 600));
    setRestVibrate(rvRaw === "1");

    setSupersetAlternate(ssRaw === null ? true : ssRaw === "1");
    setThemeModeState(tm);
    setThemeMode(tm);

    const activeWorkoutId = await getSettingAsync("activeWorkoutId");
    if (activeWorkoutId) {
      const row = getDb().getFirstSync<{ day_index?: number | null; day_key?: string | null }>(
        `SELECT day_index, day_key FROM workouts WHERE id = ? LIMIT 1`,
        [activeWorkoutId]
      );
      let dayIndex = Number.isFinite(row?.day_index ?? NaN) ? Number(row?.day_index) : NaN;
      if (!Number.isFinite(dayIndex) && row?.day_key) {
        const match = String(row.day_key).match(/day_(\d+)/i);
        if (match) dayIndex = Number(match[1]) - 1;
      }
      if (Number.isFinite(dayIndex)) {
        setLockedDayLabel(`Dag ${Math.max(0, dayIndex) + 1}`);
      } else {
        setLockedDayLabel(null);
      }
      setWorkoutLocked(true);
    } else {
      setWorkoutLocked(false);
      setLockedDayLabel(null);
    }
  }

  useEffect(() => {
    loadSettings().then(() => setReady(true));
  }, []);

  async function copyText(text: string) {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      Alert.alert("Kopiert", "JSON kopiert til utklippstavlen.");
      return;
    }
    Alert.alert("Kopier manuelt", "Marker teksten og kopier manuelt.");
  }

  async function openExport() {
    setBackupBusy(true);
    setImportError(null);
    try {
      await ensureDb();
      const db = getDb();
      const workouts = await db.getAllAsync(
        `SELECT id, date, program_mode, day_key, back_status, notes, day_index, started_at FROM workouts`
      );
      const sets = await db.getAllAsync(
        `SELECT id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id FROM sets`
      );
      const settings = await db.getAllAsync(`SELECT key, value FROM settings`);
      const programs = await db.getAllAsync(
        `SELECT id, name, mode, json, created_at, updated_at FROM programs`
      );
      const programDays = await db.getAllAsync(
        `SELECT id, program_id, day_index, name FROM program_days`
      );
      const programDayExercises = await db.getAllAsync(
        `SELECT id, program_id, day_index, sort_index, type, ex_id, a_id, b_id FROM program_day_exercises`
      );
      const programAlternatives = await db.getAllAsync(
        `SELECT id, program_id, day_index, exercise_id, alt_exercise_id, sort_index FROM program_exercise_alternatives`
      );
      const programReplacements = await db.getAllAsync(
        `SELECT id, program_id, day_index, original_ex_id, replaced_ex_id, updated_at FROM program_replacements`
      );
      const exerciseTargets = await db.getAllAsync(
        `SELECT id, program_id, exercise_id, rep_min, rep_max, increment_kg, updated_at FROM exercise_targets`
      );
      const prRecords = await db.getAllAsync(
        `SELECT exercise_id, type, value, reps, weight, set_id, date, program_id FROM pr_records`
      );

      const payload = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        data: {
          workouts,
          sets,
          settings,
          programs,
          program_days: programDays,
          program_day_exercises: programDayExercises,
          program_exercise_alternatives: programAlternatives,
          program_replacements: programReplacements,
          exercise_targets: exerciseTargets,
          pr_records: prRecords,
        },
      };

      setBackupText(JSON.stringify(payload, null, 2));
      setBackupOpen("export");
    } catch (err) {
      Alert.alert("Feil", "Kunne ikke generere backup.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function openProgramExport() {
    setShareBusy(true);
    setShareError(null);
    try {
      await ensureDb();
      const program = await ProgramStore.getActiveProgram(programMode);
      const alternatives = await ProgramStore.getAlternativesForProgram(program.id);
      const db = getDb();
      const targets = await db.getAllAsync(
        `SELECT exercise_id, rep_min, rep_max, increment_kg
         FROM exercise_targets
         WHERE program_id = ?`,
        [program.id]
      );

      const altList: Array<{ dayIndex: number; exerciseId: string; alternatives: string[] }> = [];
      for (const dayKey of Object.keys(alternatives)) {
        const di = parseInt(dayKey, 10);
        const byExercise = alternatives[di] ?? {};
        for (const exId of Object.keys(byExercise)) {
          altList.push({ dayIndex: di, exerciseId: exId, alternatives: byExercise[exId] ?? [] });
        }
      }

      const payload = {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        program: {
          name: program.name,
          createdAt: program.createdAt,
          daysCount: program.days.length,
        },
        days: program.days.map((d, dayIndex) => ({
          dayIndex,
          name: d.name,
          blocks: d.blocks.map((b, sortIndex) => {
            if (b.type === "single") {
              return { type: "single", exerciseId: b.exId, sortIndex };
            }
            return { type: "superset", a: b.a, b: b.b, sortIndex };
          }),
        })),
        alternatives: altList,
        targets: (targets ?? []).map((t: any) => ({
          exerciseId: t.exercise_id,
          repMin: t.rep_min,
          repMax: t.rep_max,
          incrementKg: t.increment_kg,
        })),
      };

      setShareText(JSON.stringify(payload, null, 2));
      setShareOpen("export");
    } catch {
      Alert.alert("Feil", "Kunne ikke eksportere program.");
    } finally {
      setShareBusy(false);
    }
  }

  async function handleProgramImport() {
    setShareBusy(true);
    setShareError(null);
    let parsed: any = null;
    try {
      parsed = JSON.parse(shareImportText);
    } catch {
      setShareError("Ugyldig JSON");
      setShareBusy(false);
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      setShareError("Ugyldig format");
      setShareBusy(false);
      return;
    }

    if (parsed.schemaVersion !== 1) {
      setShareError("Ugyldig schemaVersion");
      setShareBusy(false);
      return;
    }

    const program = parsed.program && typeof parsed.program === "object" ? parsed.program : null;
    const days = Array.isArray(parsed.days) ? parsed.days : [];
    if (!program || typeof program.name !== "string" || days.length === 0) {
      setShareError("Mangler programdata");
      setShareBusy(false);
      return;
    }

    const daysCount = typeof program.daysCount === "number" ? program.daysCount : days.length;
    const name = String(program.name || "Program");

    try {
      await ensureDb();
      const base = ProgramStore.createBlankProgram(name, daysCount);
      const mappedDays = days
        .slice(0, daysCount)
        .map((d: any, idx: number) => ({
          id: base.days[idx]?.id ?? newId("day"),
          name: typeof d.name === "string" ? d.name : `Dag ${idx + 1}`,
          blocks: Array.isArray(d.blocks)
            ? d.blocks.map((b: any) => {
                if (b.type === "single" && typeof b.exerciseId === "string") {
                  return { type: "single", exId: b.exerciseId };
                }
                if (b.type === "superset" && typeof b.a === "string" && typeof b.b === "string") {
                  return { type: "superset", a: b.a, b: b.b };
                }
                return null;
              }).filter(Boolean)
            : [],
        }));

      const nextProgram = {
        ...base,
        name,
        createdAt: typeof program.createdAt === "string" ? program.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        days: mappedDays,
      };

      await ProgramStore.saveProgram(programMode, nextProgram);

      const altEntries = Array.isArray(parsed.alternatives) ? parsed.alternatives : [];
      for (const entry of altEntries) {
        if (
          !entry ||
          typeof entry.dayIndex !== "number" ||
          typeof entry.exerciseId !== "string" ||
          !Array.isArray(entry.alternatives)
        ) {
          continue;
        }
        const alternatives = entry.alternatives.filter((x: any) => typeof x === "string").slice(0, 3);
        await ProgramStore.setAlternatives({
          programId: nextProgram.id,
          dayIndex: entry.dayIndex,
          exerciseId: entry.exerciseId,
          alternatives,
        });
      }

      const targets = Array.isArray(parsed.targets) ? parsed.targets : [];
      const db = getDb();
      for (const t of targets) {
        if (
          !t ||
          typeof t.exerciseId !== "string" ||
          typeof t.repMin !== "number" ||
          typeof t.repMax !== "number" ||
          typeof t.incrementKg !== "number"
        ) {
          continue;
        }
        await db.runAsync(
          `INSERT OR REPLACE INTO exercise_targets(id, program_id, exercise_id, rep_min, rep_max, increment_kg, updated_at)
           VALUES(?, ?, ?, ?, ?, ?, ?)` ,
          [newId("target"), nextProgram.id, t.exerciseId, t.repMin, t.repMax, t.incrementKg, new Date().toISOString()]
        );
      }

      if (shareSetActive) {
        await ProgramStore.setActiveProgram(programMode, nextProgram.id);
      }

      setShareOpen(null);
      setShareImportText("");
      setShareSetActive(true);
      Alert.alert("Import ferdig", "Program er importert.");
    } catch {
      setShareError("Import feilet. Sjekk formatet.");
    } finally {
      setShareBusy(false);
    }
  }

  async function openCsvExport() {
    setBackupBusy(true);
    try {
      await ensureDb();
      const db = getDb();
      const rows = await db.getAllAsync<CsvRow>(
        `SELECT s.id as set_id, s.exercise_id, s.exercise_name, s.weight, s.reps, s.rpe, s.created_at,
                w.date as workout_date, w.day_index, w.program_id, p.name as program_name
         FROM sets s
         LEFT JOIN workouts w ON s.workout_id = w.id
         LEFT JOIN programs p ON w.program_id = p.id
         ORDER BY s.created_at ASC`
      );

      const header = [
        "date",
        "program",
        "day",
        "exerciseId",
        "displayName",
        "weight",
        "reps",
        "rpe",
        "setType",
        "warmup",
        "notes",
      ];

      const escape = (v: string | number | null | undefined) => {
        const s = v == null ? "" : String(v);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const lines = [header.join(",")];
      for (const r of rows ?? []) {
        const exId = r.exercise_id ? String(r.exercise_id) : resolveExerciseId(r.exercise_name);
        const display = exId ? displayNameFor(exId) : r.exercise_name;
        const day = Number.isFinite(r.day_index) ? Number(r.day_index) + 1 : "";
        const programLabel = r.program_name ?? r.program_id ?? "";
        lines.push(
          [
            r.workout_date ?? r.created_at?.slice(0, 10) ?? "",
            programLabel,
            day,
            exId ?? "",
            display,
            r.weight ?? "",
            r.reps ?? "",
            r.rpe ?? "",
            "",
            "",
            "",
          ]
            .map(escape)
            .join(",")
        );
      }

      setBackupCsvText(lines.join("\n"));
      setBackupOpen("csv");
    } catch {
      Alert.alert("Feil", "Kunne ikke eksportere CSV.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function runHealthCheck() {
    try {
      await ensureDb();
      const db = getDb();
      const row = await db.getFirstAsync<{ c: number }>(
        `SELECT COUNT(1) as c
         FROM sets s
         LEFT JOIN workouts w ON s.workout_id = w.id
         WHERE w.id IS NULL`
      );
      const count = row?.c ?? 0;
      if (count === 0) {
        Alert.alert("Health check", "Ingen orphan sets funnet.");
        return;
      }

      Alert.alert(
        "Health check",
        `Fant ${count} orphan sets. Vil du rydde?`,
        [
          { text: "Ignorer", style: "cancel" },
          {
            text: "Slett",
            style: "destructive",
            onPress: async () => {
              try {
                await db.execAsync(
                  `DELETE FROM sets WHERE workout_id NOT IN (SELECT id FROM workouts)`
                );
                Alert.alert("Ryddet", "Orphan sets slettet.");
              } catch {
                Alert.alert("Feil", "Kunne ikke rydde orphan sets.");
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert("Feil", "Health check feilet.");
    }
  }

  async function runSanityCheck() {
    try {
      await ensureDb();
      await ProgramStore.ensurePrograms();
      const db = getDb();
      const workoutId = `__test_workout_${Date.now()}`;
      const setId = `__test_set_${Date.now()}`;
      await db.runAsync(
        `INSERT INTO workouts(id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [workoutId, isoDateOnly(), "normal", null, "day_1", "green", "__test__", 0, new Date().toISOString()]
      );
      await db.runAsync(
        `INSERT INTO sets(id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id, set_type, is_warmup)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [setId, workoutId, "__test__", 0, 1, 1, null, new Date().toISOString(), null, "normal", 0]
      );
      await db.runAsync(`DELETE FROM sets WHERE id = ?`, [setId]);
      await db.runAsync(`DELETE FROM workouts WHERE id = ?`, [workoutId]);
      Alert.alert("Sanity check", "OK");
    } catch (err) {
      Alert.alert("Sanity check feilet", String(err));
    }
  }

  function isLikelyTestExercise(exId: string, name: string) {
    const hay = `${exId} ${name}`.toLowerCase();
    return hay.includes("test") || hay.includes("tmp") || hay.includes("demo");
  }

  async function loadExerciseHistory(preselectTests = false) {
    setDataToolsBusy(true);
    try {
      await ensureDb();
      const db = getDb();
      const rows = await db.getAllAsync<ExerciseHistoryRow>(
        `SELECT exercise_id, COUNT(*) as setCount, MAX(created_at) as lastDate
         FROM sets
         WHERE exercise_id IS NOT NULL AND exercise_id != ''
         GROUP BY exercise_id
         ORDER BY lastDate DESC`
      );
      const nextSelection: Record<string, boolean> = {};
      if (preselectTests) {
        for (const r of rows ?? []) {
          const name = displayNameFor(r.exercise_id);
          if (isLikelyTestExercise(r.exercise_id, name)) nextSelection[r.exercise_id] = true;
        }
      }
      setHistoryRows(rows ?? []);
      setHistorySelection(preselectTests ? nextSelection : {});
    } catch {
      Alert.alert("Feil", "Kunne ikke hente øvelsesliste.");
    } finally {
      setDataToolsBusy(false);
    }
  }

  async function openDataTools(preselectTests = false) {
    setHistorySearch("");
    setDataToolsOpen(true);
    await loadExerciseHistory(preselectTests);
  }

  function toggleHistorySelection(exId: string) {
    setHistorySelection((prev) => ({ ...prev, [exId]: !prev[exId] }));
  }

  function clearHistorySelection() {
    setHistorySelection({});
  }

  async function deleteSelectedExercises() {
    const ids = Object.keys(historySelection).filter((k) => historySelection[k]);
    if (ids.length === 0) {
      Alert.alert("Ingen valgt", "Velg én eller flere øvelser først.");
      return;
    }
    try {
      await ensureDb();
      const db = getDb();
      const placeholders = ids.map(() => "?").join(",");
      const countRow = await db.getFirstAsync<{ c: number }>(
        `SELECT COUNT(1) as c FROM sets WHERE exercise_id IN (${placeholders})`,
        ids
      );
      const count = countRow?.c ?? 0;
      Alert.alert(
        "Bekreft sletting",
        `Slette ${count} sett fra ${ids.length} øvelse(r)?`,
        [
          { text: "Avbryt", style: "cancel" },
          {
            text: "Slett",
            style: "destructive",
            onPress: async () => {
              try {
                await db.execAsync("BEGIN");
                await db.runAsync(
                  `DELETE FROM sets WHERE exercise_id IN (${placeholders})`,
                  ids
                );
                await db.runAsync(
                  `DELETE FROM pr_records WHERE exercise_id IN (${placeholders})`,
                  ids
                );
                await db.runAsync(
                  `DELETE FROM exercise_targets WHERE exercise_id IN (${placeholders})`,
                  ids
                );
                await db.execAsync("COMMIT");
                await loadExerciseHistory(false);
                clearHistorySelection();
                Alert.alert("Ferdig", "Historikk slettet.");
              } catch {
                try {
                  await db.execAsync("ROLLBACK");
                } catch {}
                Alert.alert("Feil", "Kunne ikke slette historikk.");
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert("Feil", "Kunne ikke beregne sletting.");
    }
  }

  async function deleteEmptyWorkouts() {
    try {
      await ensureDb();
      const db = getDb();
      const countRow = await db.getFirstAsync<{ c: number }>(
        `SELECT COUNT(1) as c
         FROM workouts
         WHERE id NOT IN (SELECT DISTINCT workout_id FROM sets WHERE workout_id IS NOT NULL)`
      );
      const count = countRow?.c ?? 0;
      if (count === 0) {
        Alert.alert("Ingen tomme økter", "Fant ingen økter uten sett.");
        return;
      }
      Alert.alert("Slett tomme økter?", `Slette ${count} tomme økter?`, [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Slett",
          style: "destructive",
          onPress: async () => {
            try {
              await db.execAsync(
                `DELETE FROM workouts
                 WHERE id NOT IN (SELECT DISTINCT workout_id FROM sets WHERE workout_id IS NOT NULL)`
              );
              Alert.alert("Ferdig", "Tomme økter slettet.");
            } catch {
              Alert.alert("Feil", "Kunne ikke slette tomme økter.");
            }
          },
        },
      ]);
    } catch {
      Alert.alert("Feil", "Kunne ikke sjekke tomme økter.");
    }
  }

  async function resetAllData() {
    Alert.alert(
      "Nullstill alt?",
      "Dette sletter all lokal data (økter, sett, programmer, targets, PR). Fortsette?",
      [
        { text: "Avbryt", style: "cancel" },
        {
          text: "Slett alt",
          style: "destructive",
          onPress: async () => {
            try {
              await ensureDb();
              const db = getDb();
              await db.execAsync("BEGIN");
              await db.execAsync("DELETE FROM sets");
              await db.execAsync("DELETE FROM workouts");
              await db.execAsync("DELETE FROM program_exercise_alternatives");
              await db.execAsync("DELETE FROM program_day_exercises");
              await db.execAsync("DELETE FROM program_days");
              await db.execAsync("DELETE FROM program_replacements");
              await db.execAsync("DELETE FROM exercise_targets");
              await db.execAsync("DELETE FROM pr_records");
              await db.execAsync("DELETE FROM programs");
              await db.execAsync("DELETE FROM settings");
              await db.execAsync("COMMIT");
              await ProgramStore.ensurePrograms();
              await loadSettings();
              setDataToolsOpen(false);
              Alert.alert("Nullstilt", "Alt er slettet. Standardprogram er lagt tilbake.");
            } catch {
              try {
                const db = getDb();
                await db.execAsync("ROLLBACK");
              } catch {}
              Alert.alert("Feil", "Kunne ikke nullstille data.");
            }
          },
        },
      ]
    );
  }

  async function handleImport() {
    setBackupBusy(true);
    setImportError(null);
    let parsed: any = null;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError("Ugyldig JSON");
      setBackupBusy(false);
      return;
    }

    const rawData =
      parsed && typeof parsed === "object"
        ? parsed.data && typeof parsed.data === "object"
          ? parsed.data
          : parsed
        : null;
    if (!rawData || typeof rawData !== "object") {
      setImportError("Ugyldig backup-format");
      setBackupBusy(false);
      return;
    }

    const schemaVersion = parsed?.schemaVersion ?? parsed?.version ?? 1;
    if (schemaVersion > CURRENT_SCHEMA_VERSION) {
      setImportError("Backup er nyere enn appen. Oppdater appen for å importere.");
      setBackupBusy(false);
      return;
    }

    const data = rawData as Record<string, unknown>;
    const workouts = Array.isArray(data.workouts) ? data.workouts : [];
    const sets = Array.isArray(data.sets) ? data.sets : [];
    const settings = Array.isArray(data.settings) ? data.settings : [];
    const programs = Array.isArray(data.programs) ? data.programs : [];
    const programDays = Array.isArray(data.program_days) ? data.program_days : [];
    const programDayExercises = Array.isArray(data.program_day_exercises) ? data.program_day_exercises : [];
    const programAlternatives = Array.isArray(data.program_exercise_alternatives) ? data.program_exercise_alternatives : [];
    const programReplacements = Array.isArray(data.program_replacements) ? data.program_replacements : [];
    const exerciseTargets = Array.isArray(data.exercise_targets) ? data.exercise_targets : [];
    const prRecords = Array.isArray(data.pr_records) ? data.pr_records : [];

    if (
      workouts.length === 0 &&
      sets.length === 0 &&
      settings.length === 0 &&
      programs.length === 0 &&
      programDays.length === 0 &&
      programDayExercises.length === 0 &&
      programAlternatives.length === 0 &&
      programReplacements.length === 0 &&
      exerciseTargets.length === 0 &&
      prRecords.length === 0
    ) {
      setImportError("Backup er tom eller mangler data.");
      setBackupBusy(false);
      return;
    }

    try {
      await ensureDb();
      const db = getDb();
      const verb = importMode === "fresh" ? "INSERT INTO" : "INSERT OR IGNORE INTO";

      await db.execAsync("BEGIN");
      if (importMode === "fresh") {
        await db.execAsync("DELETE FROM sets");
        await db.execAsync("DELETE FROM workouts");
        await db.execAsync("DELETE FROM program_exercise_alternatives");
        await db.execAsync("DELETE FROM program_day_exercises");
        await db.execAsync("DELETE FROM program_days");
        await db.execAsync("DELETE FROM program_replacements");
        await db.execAsync("DELETE FROM exercise_targets");
        await db.execAsync("DELETE FROM pr_records");
        await db.execAsync("DELETE FROM programs");
        await db.execAsync("DELETE FROM settings");
      }

      for (const w of workouts) {
        await db.runAsync(
          `${verb} workouts(id, date, program_mode, day_key, back_status, notes, day_index, started_at)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            w.id,
            w.date,
            w.program_mode,
            w.day_key,
            w.back_status,
            w.notes ?? null,
            w.day_index ?? null,
            w.started_at ?? null,
          ]
        );
      }

      for (const s of sets) {
        await db.runAsync(
          `${verb} sets(id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            s.id,
            s.workout_id,
            s.exercise_name,
            s.set_index,
            s.weight,
            s.reps,
            s.rpe ?? null,
            s.created_at,
            s.exercise_id ?? null,
          ]
        );
      }

      for (const s of settings) {
        await db.runAsync(`${verb} settings(key, value) VALUES(?, ?)`, [s.key, s.value]);
      }

      for (const p of programs) {
        await db.runAsync(
          `${verb} programs(id, name, mode, json, created_at, updated_at)
           VALUES(?, ?, ?, ?, ?, ?)`,
          [p.id, p.name, p.mode ?? null, p.json, p.created_at, p.updated_at]
        );
      }

      for (const d of programDays) {
        await db.runAsync(
          `${verb} program_days(id, program_id, day_index, name)
           VALUES(?, ?, ?, ?)`,
          [d.id, d.program_id, d.day_index, d.name]
        );
      }

      for (const b of programDayExercises) {
        await db.runAsync(
          `${verb} program_day_exercises(id, program_id, day_index, sort_index, type, ex_id, a_id, b_id)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [b.id, b.program_id, b.day_index, b.sort_index, b.type, b.ex_id ?? null, b.a_id ?? null, b.b_id ?? null]
        );
      }

      for (const a of programAlternatives) {
        await db.runAsync(
          `${verb} program_exercise_alternatives(id, program_id, day_index, exercise_id, alt_exercise_id, sort_index)
           VALUES(?, ?, ?, ?, ?, ?)`,
          [a.id, a.program_id, a.day_index, a.exercise_id, a.alt_exercise_id, a.sort_index]
        );
      }

      for (const r of programReplacements) {
        await db.runAsync(
          `${verb} program_replacements(id, program_id, day_index, original_ex_id, replaced_ex_id, updated_at)
           VALUES(?, ?, ?, ?, ?, ?)`,
          [r.id, r.program_id, r.day_index, r.original_ex_id, r.replaced_ex_id, r.updated_at]
        );
      }

      for (const t of exerciseTargets) {
        await db.runAsync(
          `${verb} exercise_targets(id, program_id, exercise_id, rep_min, rep_max, increment_kg, updated_at)
           VALUES(?, ?, ?, ?, ?, ?, ?)`,
          [t.id, t.program_id, t.exercise_id, t.rep_min, t.rep_max, t.increment_kg, t.updated_at]
        );
      }

      for (const pr of prRecords) {
        await db.runAsync(
          `${verb} pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id)
           VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pr.exercise_id,
            pr.type,
            pr.value,
            pr.reps ?? null,
            pr.weight ?? null,
            pr.set_id ?? null,
            pr.date ?? null,
            pr.program_id ?? "",
          ]
        );
      }

      await db.execAsync("COMMIT");
      await loadSettings();
      setBackupOpen(null);
      setImportText("");
      setImportMode("merge");
      Alert.alert(
        "Import ferdig",
        "Data er importert. Vil du rydde bort testdata nå?",
        [
          { text: "Senere", style: "cancel" },
          { text: "Rydd nå", onPress: () => openDataTools(true) },
        ]
      );
    } catch (err) {
      try {
        const db = getDb();
        await db.execAsync("ROLLBACK");
      } catch {}
      setImportError("Import feilet. Sjekk formatet.");
    } finally {
      setBackupBusy(false);
    }
  }

  const filteredHistoryRows = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return historyRows;
    return historyRows.filter((r) => {
      const name = displayNameFor(r.exercise_id).toLowerCase();
      return name.includes(q) || r.exercise_id.toLowerCase().includes(q);
    });
  }, [historyRows, historySearch]);

  if (!ready) {
    return <AppLoading />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: 80 }}>
        <TopBar title="Innstillinger" subtitle="System og backup" left={<IconButton icon="menu" onPress={openDrawer} />} />
        <Text style={{ color: theme.muted }}>
          Her styrer du standardvalg. (Logg har også timer-innstillinger via gear ved rest-chipen.)
        </Text>

        {workoutLocked ? (
          <Card style={{ borderColor: theme.warn }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono }}>
              Økt pågår{lockedDayLabel ? ` (${lockedDayLabel})` : ""} – endringer låst.
            </Text>
          </Card>
        ) : null}

        <Card title="PROGRAMMODE">
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Chip
              text="Standard"
              active={programMode === "normal"}
              onPress={() => {
                if (workoutLocked) {
                  Alert.alert("Låst under aktiv økt", "Avslutt økten før du bytter program.");
                  return;
                }
                setProgramMode("normal");
                setSettingAsync("programMode", "normal").catch(() => {});
              }}
            />
            <Chip
              text="Ryggvennlig"
              active={programMode === "back"}
              onPress={() => {
                if (workoutLocked) {
                  Alert.alert("Låst under aktiv økt", "Avslutt økten før du bytter program.");
                  return;
                }
                setProgramMode("back");
                setSettingAsync("programMode", "back").catch(() => {});
              }}
            />
          </View>

          <Text style={{ color: theme.muted }}>
            Dette bestemmer hvilket program som er default når du starter en økt.
          </Text>
        </Card>

        <Card title="TEMA">
          <Text style={{ color: theme.muted, marginBottom: 8 }}>
            Velg lyst, mørkt eller følg systemet.
          </Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {(["system", "light", "dark"] as ThemeModeSetting[]).map((mode) => (
              <Chip
                key={`theme_${mode}`}
                text={mode === "system" ? "System" : mode === "light" ? "Lys" : "Mørk"}
                active={themeMode === mode}
                onPress={() => {
                  setThemeModeState(mode);
                  setThemeMode(mode);
                  setSettingAsync("themeMode", mode).catch(() => {});
                }}
              />
            ))}
          </View>
        </Card>

        <Card title="STANDARD DAG">
          <Text style={{ color: theme.muted, marginBottom: 8 }}>
            Velg hvilken dag som er «default» når du åpner Logg.
          </Text>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Chip
                key={`ddi_${i}`}
                text={`Dag ${i + 1}`}
                active={defaultDayIndex === i}
                onPress={() => {
                  if (workoutLocked) {
                    Alert.alert("Låst under aktiv økt", "Avslutt økten før du bytter standard dag.");
                    return;
                  }
                  setDefaultDayIndex(i);
                  setSettingAsync("defaultDayIndex", String(i)).catch(() => {});
                }}
              />
            ))}
          </View>
        </Card>

        <Card title="REST TIMER (DEFAULT)">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>Aktiv som standard</Text>
            <Switch
              value={restEnabled}
              onValueChange={(v) => {
                setRestEnabled(v);
                setSettingAsync("restEnabled", v ? "1" : "0").catch(() => {});
              }}
            />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>Vibrer (kun i app)</Text>
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
            {[90, 120, 150, 180].map((sec) => (
              <Chip
                key={`rs_${sec}`}
                text={`${sec}s`}
                active={restSeconds === sec}
                onPress={() => {
                  setRestSeconds(sec);
                  setSettingAsync("restSeconds", String(sec)).catch(() => {});
                }}
              />
            ))}
          </View>

          <Text style={{ color: theme.muted }}>
            (Expo Go: ingen «sikker» vibrering i bakgrunn/locked. Det tar vi i dev build senere.)
          </Text>
        </Card>

        <Card title="SUPERSET">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: theme.text }}>Auto annethvert sett</Text>
              <Text style={{ color: theme.muted }}>
                Når aktiv: + i supersett logger A, så B, så A, osv.
              </Text>
            </View>
            <Switch
              value={supersetAlternate}
              onValueChange={(v) => {
                setSupersetAlternate(v);
                setSettingAsync("supersetAlternate", v ? "1" : "0").catch(() => {});
              }}
            />
          </View>
        </Card>

        <Card title="BACKUP">
          <Text style={{ color: theme.muted }}>
            Eksporter eller importer alt lokalt. Ingen data sendes noen steder.
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label="Eksporter JSON" onPress={openExport} tone="accent" />
            <Btn label="Importer JSON" onPress={() => setBackupOpen("import")} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Btn label="Eksporter CSV" onPress={openCsvExport} />
            <Btn label="Health check" onPress={runHealthCheck} />
          </View>
          {backupBusy ? <Text style={{ color: theme.muted }}>Jobber...</Text> : null}
        </Card>

        <Card title="DEL PROGRAM">
          <Text style={{ color: theme.muted }}>
            Eksporter eller importer kun aktivt program (ingen historikk).
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label="Eksporter program" onPress={openProgramExport} tone="accent" />
            <Btn label="Importer program" onPress={() => setShareOpen("import")} />
          </View>
          {shareBusy ? <Text style={{ color: theme.muted }}>Jobber...</Text> : null}
        </Card>

        <Card title="DATA & RYDDING">
          <Text style={{ color: theme.muted }}>
            Rydd testdata og tomme økter. Brukes etter import eller ved opprydding.
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label="Åpne" onPress={() => openDataTools(false)} tone="accent" />
            <Btn label="Slett tomme økter" onPress={deleteEmptyWorkouts} />
          </View>
          {dataToolsBusy ? <Text style={{ color: theme.muted }}>Henter historikk...</Text> : null}
        </Card>

        <Card title="VERKTOY">
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Btn
              label="Nullstill aktiv økt"
              tone="danger"
              onPress={() => {
                Alert.alert(
                  "Nullstill aktiv økt?",
                  'Dette fjerner kun "activeWorkoutId" så du slipper å være låst i en økt. Data i DB slettes ikke.',
                  [
                    { text: "Avbryt", style: "cancel" },
                    {
                      text: "Nullstill",
                      style: "destructive",
                      onPress: () => {
                        setSettingAsync("activeWorkoutId", "").catch(() => {});
                        Alert.alert("OK", "Active workout er nullstilt.");
                      },
                    },
                  ]
                );
              }}
            />
            <Btn
              label="Vis introduksjon igjen"
              onPress={() => setShowOnboarding(true)}
            />
          </View>

          <Text style={{ color: theme.muted }}>
            Bruk backup-funksjonen for eksport/import av hele databasen.
          </Text>
          {__DEV__ ? (
            <View style={{ marginTop: 8 }}>
              <Btn label="Sanity check (dev)" onPress={runSanityCheck} />
            </View>
          ) : null}
        </Card>
      </ScrollView>

      <OnboardingModal
        visible={showOnboarding}
        onDone={() => {
          setSettingAsync("hasSeenOnboarding", "1").catch(() => {});
          setShowOnboarding(false);
        }}
        onClose={() => setShowOnboarding(false)}
      />

      <Modal visible={backupOpen !== null} transparent animationType="fade" onRequestClose={() => setBackupOpen(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
              {backupOpen === "export" ? "Backup eksport" : backupOpen === "csv" ? "CSV eksport" : "Backup import"}
            </Text>

            {backupOpen === "export" ? (
              <>
                <TextField
                  value={backupText}
                  editable={false}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.panel,
                    borderColor: theme.line,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label="Kopier" onPress={() => copyText(backupText)} tone="accent" />
                  <Btn label="Lukk" onPress={() => setBackupOpen(null)} />
                </View>
              </>
            ) : backupOpen === "csv" ? (
              <>
                <TextField
                  value={backupCsvText}
                  editable={false}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.panel,
                    borderColor: theme.line,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label="Kopier" onPress={() => copyText(backupCsvText)} tone="accent" />
                  <Btn label="Lukk" onPress={() => setBackupOpen(null)} />
                </View>
              </>
            ) : (
              <>
                <TextField
                  value={importText}
                  onChangeText={setImportText}
                  placeholder="Lim inn JSON"
                  placeholderTextColor={theme.muted}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.panel,
                    borderColor: theme.line,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                {importError ? <Text style={{ color: theme.danger }}>{importError}</Text> : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.text }}>Ny profil (slett lokalt)</Text>
                  <Switch
                    value={importMode === "fresh"}
                    onValueChange={(v) => setImportMode(v ? "fresh" : "merge")}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn
                    label="Importer"
                    onPress={() => {
                      if (importMode !== "fresh") {
                        handleImport();
                        return;
                      }
                      Alert.alert("Ny profil", "Dette sletter lokale data. Fortsette?", [
                        { text: "Avbryt", style: "cancel" },
                        { text: "Slett og importer", style: "destructive", onPress: handleImport },
                      ]);
                    }}
                    tone="accent"
                  />
                  <Btn label="Avbryt" onPress={() => setBackupOpen(null)} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={dataToolsOpen} transparent animationType="fade" onRequestClose={() => setDataToolsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12, maxHeight: "90%" }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>Data & Rydding</Text>

            <TextField
              value={historySearch}
              onChangeText={setHistorySearch}
              placeholder="Søk øvelse..."
              placeholderTextColor={theme.muted}
              style={{
                color: theme.text,
                backgroundColor: theme.panel,
                borderColor: theme.line,
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
              }}
            />

            <ScrollView
              contentContainerStyle={{ gap: 8 }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
            >
              {filteredHistoryRows.map((row) => {
                const name = displayNameFor(row.exercise_id);
                const selected = !!historySelection[row.exercise_id];
                const isTest = isLikelyTestExercise(row.exercise_id, name);
                return (
                  <Pressable
                    key={row.exercise_id}
                    onPress={() => toggleHistorySelection(row.exercise_id)}
                    style={{
                      borderColor: selected ? theme.accent : theme.line,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      backgroundColor: theme.panel,
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: theme.text, fontSize: 15 }}>{name || row.exercise_id}</Text>
                      {selected ? (
                        <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>Valgt</Text>
                      ) : null}
                    </View>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                      {row.exercise_id} · {row.setCount} sett · {row.lastDate ? row.lastDate.slice(0, 10) : "-"}
                    </Text>
                    {isTest ? (
                      <Text style={{ color: theme.danger, fontFamily: theme.mono, fontSize: 11 }}>
                        Mulig test‑øvelse
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {filteredHistoryRows.length === 0 ? (
                <Text style={{ color: theme.muted }}>Ingen øvelser funnet.</Text>
              ) : null}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Btn label="Velg ingen" onPress={clearHistorySelection} />
              <Btn label="Slett valgte øvelser" tone="danger" onPress={deleteSelectedExercises} />
              <Btn label="Nullstill alt" tone="danger" onPress={resetAllData} />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label="Slett tomme økter" onPress={deleteEmptyWorkouts} />
              <Btn label="Lukk" onPress={() => setDataToolsOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={shareOpen !== null} transparent animationType="fade" onRequestClose={() => setShareOpen(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
              {shareOpen === "export" ? "Del program (eksport)" : "Del program (import)"}
            </Text>

            {shareOpen === "export" ? (
              <>
                <TextField
                  value={shareText}
                  editable={false}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.panel,
                    borderColor: theme.line,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label="Kopier" onPress={() => copyText(shareText)} tone="accent" />
                  <Btn label="Lukk" onPress={() => setShareOpen(null)} />
                </View>
              </>
            ) : (
              <>
                <TextField
                  value={shareImportText}
                  onChangeText={setShareImportText}
                  placeholder="Lim inn JSON"
                  placeholderTextColor={theme.muted}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.panel,
                    borderColor: theme.line,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                {shareError ? <Text style={{ color: theme.danger }}>{shareError}</Text> : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.text }}>Sett som aktivt program</Text>
                  <Switch value={shareSetActive} onValueChange={setShareSetActive} />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label="Importer" onPress={handleProgramImport} tone="accent" />
                  <Btn label="Avbryt" onPress={() => setShareOpen(null)} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}








