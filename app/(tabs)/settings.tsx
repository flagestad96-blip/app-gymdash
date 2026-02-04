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
import { useTheme, setThemeMode, getThemeMode, type ThemeMode as ThemeModeSetting } from "../../src/theme";
import { useI18n, type Locale, setLocale as setI18nLocale } from "../../src/i18n";
import { ensureDb, getDb, getSettingAsync, setSettingAsync } from "../../src/db";
import ProgramStore from "../../src/programStore";
import { displayNameFor, resolveExerciseId } from "../../src/exerciseLibrary";
import { exportFullBackup, importBackup, exportCsv, type ImportMode } from "../../src/backup";
import { saveBackupFile, shareFile, pickBackupFile } from "../../src/fileSystem";
import {
  requestNotificationPermissions,
  hasNotificationPermissions,
  scheduleWorkoutReminder,
  cancelWorkoutReminder,
  scheduleRestDayCheck,
  cancelRestDayCheck,
} from "../../src/notifications";
import AppLoading from "../../components/AppLoading";
import OnboardingModal from "../../components/OnboardingModal";
import { Screen, TopBar, Card, Chip, Btn, IconButton, TextField } from "../../src/ui";
import { patchNotes, CURRENT_VERSION, type PatchNote } from "../../src/patchNotes";
import { useWeightUnit, type WeightUnit } from "../../src/units";

type ProgramMode = "normal" | "back";
type ExerciseHistoryRow = {
  exercise_id: string;
  setCount: number;
  lastDate: string | null;
};

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

function WeightUnitCard() {
  const theme = useTheme();
  const { t } = useI18n();
  const { unit, setUnit } = useWeightUnit();
  return (
    <Card title={t("settings.weightUnit")}>
      <Text style={{ color: theme.muted, marginBottom: 8 }}>
        {t("settings.weightUnit.desc")}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {(["kg", "lbs"] as WeightUnit[]).map((u) => (
          <Chip
            key={`wu_${u}`}
            text={t(`settings.weightUnit.${u}`)}
            active={unit === u}
            onPress={() => setUnit(u)}
          />
        ))}
      </View>
    </Card>
  );
}

export default function Settings() {
  const theme = useTheme();
  const { t, locale } = useI18n();
  const [ready, setReady] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);

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

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [restDayEnabled, setRestDayEnabled] = useState(false);
  const [notifPermission, setNotifPermission] = useState(false);
  const [reminderNotifId, setReminderNotifId] = useState<string | null>(null);
  const [restDayNotifId, setRestDayNotifId] = useState<string | null>(null);

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

  useEffect(() => {
    hasNotificationPermissions().then((granted) => setNotifPermission(granted));
  }, []);

  async function handleExportToFile() {
    setBackupBusy(true);
    try {
      const json = await exportFullBackup();
      const uri = await saveBackupFile(json);
      await shareFile(uri);
      Alert.alert(t("settings.backupComplete"));
    } catch (err) {
      Alert.alert(t("common.error"), t("settings.couldNotExport"));
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleImportFromFile() {
    try {
      const content = await pickBackupFile();
      if (!content) return;

      setBackupBusy(true);
      setImportError(null);

      const result = await importBackup(content, importMode);

      if (!result.success) {
        const errorMap: Record<string, string> = {
          invalid_json: t("program.invalidJson"),
          invalid_format: t("program.invalidFormat"),
          backup_too_new: t("settings.backupTooNew"),
          backup_empty: t("settings.backupEmpty"),
          import_failed: t("settings.importFailed"),
        };
        Alert.alert(t("common.error"), errorMap[result.error ?? ""] ?? t("settings.importFailed"));
        setBackupBusy(false);
        return;
      }

      await loadSettings();
      setBackupBusy(false);
      Alert.alert(t("settings.importDone"), t("settings.importFileSuccess"), [
        { text: t("settings.importLater"), style: "cancel" },
        { text: t("settings.importCleanNow"), onPress: () => openDataTools(true) },
      ]);
    } catch {
      Alert.alert(t("common.error"), t("settings.importFileFailed"));
      setBackupBusy(false);
    }
  }

  async function handleToggleReminder(enabled: boolean) {
    if (enabled && !notifPermission) {
      const granted = await requestNotificationPermissions();
      setNotifPermission(granted);
      if (!granted) {
        Alert.alert(t("notifications.permissionRequired"));
        return;
      }
    }
    setReminderEnabled(enabled);
    if (enabled) {
      // Schedule Mon-Fri at 17:00 (weekday 2=Mon through 6=Fri)
      const id = await scheduleWorkoutReminder(2, 17, 0);
      setReminderNotifId(id);
    } else {
      if (reminderNotifId) {
        await cancelWorkoutReminder(reminderNotifId);
        setReminderNotifId(null);
      }
    }
  }

  async function handleToggleRestDay(enabled: boolean) {
    if (enabled && !notifPermission) {
      const granted = await requestNotificationPermissions();
      setNotifPermission(granted);
      if (!granted) {
        Alert.alert(t("notifications.permissionRequired"));
        return;
      }
    }
    setRestDayEnabled(enabled);
    if (enabled) {
      const id = await scheduleRestDayCheck();
      setRestDayNotifId(id);
    } else {
      if (restDayNotifId) {
        await cancelRestDayCheck(restDayNotifId);
        setRestDayNotifId(null);
      }
    }
  }

  async function handleRequestNotifPermission() {
    const granted = await requestNotificationPermissions();
    setNotifPermission(granted);
    if (granted) {
      Alert.alert(t("notifications.enabled"));
    } else {
      Alert.alert(t("notifications.permissionRequired"));
    }
  }

  async function copyText(text: string) {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      Alert.alert(t("settings.copied"), t("settings.copiedMsg"));
      return;
    }
    Alert.alert(t("settings.copyManual"), t("settings.copyManualMsg"));
  }

  async function openExport() {
    setBackupBusy(true);
    setImportError(null);
    try {
      const json = await exportFullBackup();
      setBackupText(json);
      setBackupOpen("export");
    } catch (err) {
      Alert.alert(t("common.error"), t("settings.couldNotExport"));
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
      Alert.alert(t("common.error"), t("settings.couldNotExportProgram"));
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
      setShareError(t("program.invalidJson"));
      setShareBusy(false);
      return;
    }

    if (!parsed || typeof parsed !== "object") {
      setShareError(t("program.invalidFormat"));
      setShareBusy(false);
      return;
    }

    if (parsed.schemaVersion !== 1) {
      setShareError(t("settings.schemaError"));
      setShareBusy(false);
      return;
    }

    const program = parsed.program && typeof parsed.program === "object" ? parsed.program : null;
    const days = Array.isArray(parsed.days) ? parsed.days : [];
    if (!program || typeof program.name !== "string" || days.length === 0) {
      setShareError(t("settings.missingData"));
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
      Alert.alert(t("settings.importDone"), t("program.importSuccess"));
    } catch {
      setShareError(t("program.importFailed"));
    } finally {
      setShareBusy(false);
    }
  }

  async function openCsvExport() {
    setBackupBusy(true);
    try {
      const csv = await exportCsv();
      setBackupCsvText(csv);
      setBackupOpen("csv");
    } catch {
      Alert.alert(t("common.error"), t("settings.couldNotExport"));
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
        Alert.alert(t("settings.healthCheck"), t("settings.noOrphans"));
        return;
      }

      Alert.alert(
        t("settings.healthCheck"),
        t("settings.orphansFound", { n: count }),
        [
          { text: t("settings.ignore"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: async () => {
              try {
                await db.execAsync(
                  `DELETE FROM sets WHERE workout_id NOT IN (SELECT id FROM workouts)`
                );
                Alert.alert(t("settings.cleaned"), t("settings.orphansCleaned"));
              } catch {
                Alert.alert(t("common.error"), t("settings.couldNotClean"));
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert(t("common.error"), t("settings.healthCheck"));
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
      Alert.alert(t("settings.sanityOk"), t("common.ok"));
    } catch (err) {
      Alert.alert(t("settings.sanityFailed"), String(err));
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
      Alert.alert(t("common.error"), t("settings.noExercisesFound"));
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
      Alert.alert(t("settings.noSelection"), t("settings.noSelectionMsg"));
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
        t("settings.confirmDelete"),
        t("settings.confirmDeleteMsg", { sets: count, exercises: ids.length }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
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
                Alert.alert(t("common.done"), t("settings.historyDeleted"));
              } catch {
                try {
                  await db.execAsync("ROLLBACK");
                } catch {}
                Alert.alert(t("common.error"), t("settings.couldNotDelete"));
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert(t("common.error"), t("settings.couldNotDelete"));
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
        Alert.alert(t("settings.noEmpty"), t("settings.noEmptyMsg"));
        return;
      }
      Alert.alert(t("settings.deleteEmpty"), t("settings.deleteEmptyMsg", { n: count }), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await db.execAsync(
                `DELETE FROM workouts
                 WHERE id NOT IN (SELECT DISTINCT workout_id FROM sets WHERE workout_id IS NOT NULL)`
              );
              Alert.alert(t("common.done"), t("settings.emptyDeleted"));
            } catch {
              Alert.alert(t("common.error"), t("settings.couldNotDeleteEmpty"));
            }
          },
        },
      ]);
    } catch {
      Alert.alert(t("common.error"), t("settings.couldNotDeleteEmpty"));
    }
  }

  async function resetAllData() {
    Alert.alert(
      t("settings.resetAll"),
      t("settings.resetAllMsg"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("settings.deleteAll"),
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
              Alert.alert(t("settings.resetDone"), t("settings.resetDoneMsg"));
            } catch {
              try {
                const db = getDb();
                await db.execAsync("ROLLBACK");
              } catch {}
              Alert.alert(t("common.error"), t("settings.couldNotReset"));
            }
          },
        },
      ]
    );
  }

  async function handleImport() {
    setBackupBusy(true);
    setImportError(null);

    const result = await importBackup(importText, importMode);

    if (!result.success) {
      const errorMap: Record<string, string> = {
        invalid_json: t("program.invalidJson"),
        invalid_format: t("program.invalidFormat"),
        backup_too_new: t("settings.backupTooNew"),
        backup_empty: t("settings.backupEmpty"),
        import_failed: t("settings.importFailed"),
      };
      setImportError(errorMap[result.error ?? ""] ?? t("settings.importFailed"));
      setBackupBusy(false);
      return;
    }

    await loadSettings();
    setBackupOpen(null);
    setImportText("");
    setImportMode("merge");
    setBackupBusy(false);
    Alert.alert(
      t("settings.importDone"),
      t("settings.importDoneMsg"),
      [
        { text: t("settings.importLater"), style: "cancel" },
        { text: t("settings.importCleanNow"), onPress: () => openDataTools(true) },
      ]
    );
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
        <TopBar title={t("settings.title")} subtitle={t("settings.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />
        <Text style={{ color: theme.muted }}>
          {t("settings.description")}
        </Text>

        {workoutLocked ? (
          <Card style={{ borderColor: theme.warn }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono }}>
              {t("settings.lockedDuringWorkout", { day: lockedDayLabel ? ` (${lockedDayLabel})` : "" })}
            </Text>
          </Card>
        ) : null}

        <Card title={t("settings.programMode")}>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Chip
              text={t("settings.programMode.standard")}
              active={programMode === "normal"}
              onPress={() => {
                if (workoutLocked) {
                  Alert.alert(t("settings.lockedAlert"), t("settings.lockedAlertMsg", { setting: "program" }));
                  return;
                }
                setProgramMode("normal");
                setSettingAsync("programMode", "normal").catch(() => {});
              }}
            />
            <Chip
              text={t("settings.programMode.back")}
              active={programMode === "back"}
              onPress={() => {
                if (workoutLocked) {
                  Alert.alert(t("settings.lockedAlert"), t("settings.lockedAlertMsg", { setting: "program" }));
                  return;
                }
                setProgramMode("back");
                setSettingAsync("programMode", "back").catch(() => {});
              }}
            />
          </View>

          <Text style={{ color: theme.muted }}>
            {t("settings.programMode.desc")}
          </Text>
        </Card>

        <Card title={t("settings.theme")}>
          <Text style={{ color: theme.muted, marginBottom: 8 }}>
            {t("settings.theme.desc")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {(["system", "light", "dark"] as ThemeModeSetting[]).map((mode) => (
              <Chip
                key={`theme_${mode}`}
                text={t(`settings.theme.${mode}`)}
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

        <Card title={t("settings.language")}>
          <Text style={{ color: theme.muted, marginBottom: 8 }}>
            {t("settings.language.desc")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {(["nb", "en"] as Locale[]).map((loc) => (
              <Chip
                key={`lang_${loc}`}
                text={t(`settings.language.${loc}`)}
                active={locale === loc}
                onPress={() => setI18nLocale(loc)}
              />
            ))}
          </View>
        </Card>

        <WeightUnitCard />

        <Card title={t("settings.defaultDay")}>
          <Text style={{ color: theme.muted, marginBottom: 8 }}>
            {t("settings.defaultDay.desc")}
          </Text>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Chip
                key={`ddi_${i}`}
                text={`${t("common.day")} ${i + 1}`}
                active={defaultDayIndex === i}
                onPress={() => {
                  if (workoutLocked) {
                    Alert.alert(t("settings.lockedAlert"), t("settings.lockedAlertMsg", { setting: t("settings.defaultDay") }));
                    return;
                  }
                  setDefaultDayIndex(i);
                  setSettingAsync("defaultDayIndex", String(i)).catch(() => {});
                }}
              />
            ))}
          </View>
        </Card>

        <Card title={t("settings.restTimer")}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>{t("settings.restTimer.active")}</Text>
            <Switch
              value={restEnabled}
              onValueChange={(v) => {
                setRestEnabled(v);
                setSettingAsync("restEnabled", v ? "1" : "0").catch(() => {});
              }}
            />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>{t("settings.restTimer.vibrate")}</Text>
            <Switch
              value={restVibrate}
              onValueChange={(v) => {
                setRestVibrate(v);
                setSettingAsync("restVibrate", v ? "1" : "0").catch(() => {});
              }}
            />
          </View>

          <Text style={{ color: theme.muted, marginTop: 6 }}>{t("settings.restTimer.length")}</Text>
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
            {t("settings.restTimer.note")}
          </Text>
        </Card>

        <Card title={t("settings.superset")}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: theme.text }}>{t("settings.superset.autoAlternate")}</Text>
              <Text style={{ color: theme.muted }}>
                {t("settings.superset.desc")}
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

        <Card title={t("notifications.title")}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: theme.text }}>{t("notifications.workoutReminders")}</Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={handleToggleReminder}
            />
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: 10 }}>
              <Text style={{ color: theme.text }}>{t("notifications.restDaySuggestions")}</Text>
            </View>
            <Switch
              value={restDayEnabled}
              onValueChange={handleToggleRestDay}
            />
          </View>
          {!notifPermission ? (
            <Btn label={t("notifications.requestPermission")} onPress={handleRequestNotifPermission} tone="accent" />
          ) : null}
        </Card>

        <Card title={t("settings.backup")}>
          <Text style={{ color: theme.muted }}>
            {t("settings.backup.desc")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label={t("settings.backup.exportJson")} onPress={openExport} tone="accent" />
            <Btn label={t("settings.backup.importJson")} onPress={() => setBackupOpen("import")} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Btn label={t("settings.exportFile")} onPress={handleExportToFile} tone="accent" />
            <Btn label={t("settings.importFile")} onPress={handleImportFromFile} />
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            <Btn label={t("settings.backup.exportCsv")} onPress={openCsvExport} />
            <Btn label={t("settings.backup.healthCheck")} onPress={runHealthCheck} />
          </View>
          {backupBusy ? <Text style={{ color: theme.muted }}>{t("common.working")}</Text> : null}
        </Card>

        <Card title={t("settings.shareProgram")}>
          <Text style={{ color: theme.muted }}>
            {t("settings.shareProgram.desc")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label={t("settings.shareProgram.export")} onPress={openProgramExport} tone="accent" />
            <Btn label={t("settings.shareProgram.import")} onPress={() => setShareOpen("import")} />
          </View>
          {shareBusy ? <Text style={{ color: theme.muted }}>{t("common.working")}</Text> : null}
        </Card>

        <Card title={t("settings.dataCleanup")}>
          <Text style={{ color: theme.muted }}>
            {t("settings.dataCleanup.desc")}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label={t("settings.dataCleanup.open")} onPress={() => openDataTools(false)} tone="accent" />
            <Btn label={t("settings.dataCleanup.deleteEmpty")} onPress={deleteEmptyWorkouts} />
          </View>
          {dataToolsBusy ? <Text style={{ color: theme.muted }}>{t("settings.fetchingHistory")}</Text> : null}
        </Card>

        <Card title={t("settings.tools")}>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Btn
              label={t("settings.tools.resetWorkout")}
              tone="danger"
              onPress={() => {
                Alert.alert(
                  t("settings.resetWorkout"),
                  t("settings.resetWorkoutMsg"),
                  [
                    { text: t("common.cancel"), style: "cancel" },
                    {
                      text: t("settings.tools.resetWorkout"),
                      style: "destructive",
                      onPress: () => {
                        setSettingAsync("activeWorkoutId", "").catch(() => {});
                        Alert.alert(t("common.ok"), t("settings.resetWorkoutDone"));
                      },
                    },
                  ]
                );
              }}
            />
            <Btn
              label={t("settings.tools.showIntro")}
              onPress={() => setShowOnboarding(true)}
            />
          </View>

          <Text style={{ color: theme.muted }}>
            {t("settings.tools.backupNote")}
          </Text>
          {__DEV__ ? (
            <View style={{ marginTop: 8 }}>
              <Btn label={t("settings.tools.sanityCheck")} onPress={runSanityCheck} />
            </View>
          ) : null}
        </Card>

        <Card title={t("settings.privacy")}>
          <View style={{ gap: 10 }}>
            <View>
              <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 13, marginBottom: 4 }}>
                {t("settings.privacy.offlineOnly")}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13 }}>
                {t("settings.privacy.offlineDesc")}
              </Text>
            </View>
            <View>
              <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 13, marginBottom: 4 }}>
                {t("settings.privacy.storageTitle")}
              </Text>
              <Text style={{ color: theme.muted, fontSize: 13 }}>
                {t("settings.privacy.storageDesc")}
              </Text>
            </View>
          </View>
        </Card>

        {/* Patch Notes */}
        <Card title={t("patchNotes.title")}>
          <Text style={{ color: theme.muted, marginBottom: 8 }}>
            v{CURRENT_VERSION}
          </Text>
          <Btn label={t("patchNotes.whatsNew", { version: CURRENT_VERSION })} onPress={() => setShowPatchNotes(true)} tone="accent" />
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
        <View style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.modalGlass, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
              {backupOpen === "export" ? t("settings.modal.backupExport") : backupOpen === "csv" ? t("settings.modal.csvExport") : t("settings.modal.backupImport")}
            </Text>

            {backupOpen === "export" ? (
              <>
                <TextField
                  value={backupText}
                  editable={false}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.glass,
                    borderColor: theme.glassBorder,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label={t("common.copy")} onPress={() => copyText(backupText)} tone="accent" />
                  <Btn label={t("common.close")} onPress={() => setBackupOpen(null)} />
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
                    backgroundColor: theme.glass,
                    borderColor: theme.glassBorder,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label={t("common.copy")} onPress={() => copyText(backupCsvText)} tone="accent" />
                  <Btn label={t("common.close")} onPress={() => setBackupOpen(null)} />
                </View>
              </>
            ) : (
              <>
                <TextField
                  value={importText}
                  onChangeText={setImportText}
                  placeholder={t("settings.paste")}
                  placeholderTextColor={theme.muted}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.glass,
                    borderColor: theme.glassBorder,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                {importError ? <Text style={{ color: theme.danger }}>{importError}</Text> : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.text }}>{t("settings.newProfile")}</Text>
                  <Switch
                    value={importMode === "fresh"}
                    onValueChange={(v) => setImportMode(v ? "fresh" : "merge")}
                  />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn
                    label={t("program.import")}
                    onPress={() => {
                      if (importMode !== "fresh") {
                        handleImport();
                        return;
                      }
                      Alert.alert(t("settings.newProfileConfirm"), t("settings.newProfileMsg"), [
                        { text: t("common.cancel"), style: "cancel" },
                        { text: t("settings.deleteAndImport"), style: "destructive", onPress: handleImport },
                      ]);
                    }}
                    tone="accent"
                  />
                  <Btn label={t("common.cancel")} onPress={() => setBackupOpen(null)} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={dataToolsOpen} transparent animationType="fade" onRequestClose={() => setDataToolsOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.modalGlass, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12, maxHeight: "90%" }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>{t("settings.modal.dataCleanup")}</Text>

            <TextField
              value={historySearch}
              onChangeText={setHistorySearch}
              placeholder={t("common.search")}
              placeholderTextColor={theme.muted}
              style={{
                color: theme.text,
                backgroundColor: theme.glass,
                borderColor: theme.glassBorder,
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
                      borderColor: selected ? theme.accent : theme.glassBorder,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 10,
                      backgroundColor: theme.glass,
                      gap: 4,
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Text style={{ color: theme.text, fontSize: 15 }}>{name || row.exercise_id}</Text>
                      {selected ? (
                        <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>{t("common.yes")}</Text>
                      ) : null}
                    </View>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                      {row.exercise_id} · {row.setCount} {t("common.sets").toLowerCase()} · {row.lastDate ? row.lastDate.slice(0, 10) : "-"}
                    </Text>
                    {isTest ? (
                      <Text style={{ color: theme.danger, fontFamily: theme.mono, fontSize: 11 }}>
                        {t("settings.possibleTest")}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {filteredHistoryRows.length === 0 ? (
                <Text style={{ color: theme.muted }}>{t("settings.noExercisesFound")}</Text>
              ) : null}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Btn label={t("settings.selectNone")} onPress={clearHistorySelection} />
              <Btn label={t("settings.deleteSelected")} tone="danger" onPress={deleteSelectedExercises} />
              <Btn label={t("settings.resetAllBtn")} tone="danger" onPress={resetAllData} />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label={t("settings.dataCleanup.deleteEmpty")} onPress={deleteEmptyWorkouts} />
              <Btn label={t("common.close")} onPress={() => setDataToolsOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={shareOpen !== null} transparent animationType="fade" onRequestClose={() => setShareOpen(null)}>
        <View style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.modalGlass, borderColor: theme.glassBorder, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
              {shareOpen === "export" ? t("settings.modal.shareExport") : t("settings.modal.shareImport")}
            </Text>

            {shareOpen === "export" ? (
              <>
                <TextField
                  value={shareText}
                  editable={false}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.glass,
                    borderColor: theme.glassBorder,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label={t("common.copy")} onPress={() => copyText(shareText)} tone="accent" />
                  <Btn label={t("common.close")} onPress={() => setShareOpen(null)} />
                </View>
              </>
            ) : (
              <>
                <TextField
                  value={shareImportText}
                  onChangeText={setShareImportText}
                  placeholder={t("settings.paste")}
                  placeholderTextColor={theme.muted}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.glass,
                    borderColor: theme.glassBorder,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 180,
                    textAlignVertical: "top",
                  }}
                />
                {shareError ? <Text style={{ color: theme.danger }}>{shareError}</Text> : null}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.text }}>{t("settings.setActiveProgram")}</Text>
                  <Switch value={shareSetActive} onValueChange={setShareSetActive} />
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label={t("program.import")} onPress={handleProgramImport} tone="accent" />
                  <Btn label={t("common.cancel")} onPress={() => setShareOpen(null)} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Patch Notes Modal */}
      <Modal visible={showPatchNotes} transparent animationType="fade" onRequestClose={() => setShowPatchNotes(false)}>
        <View style={{ flex: 1, justifyContent: "center", backgroundColor: theme.modalOverlay }}>
          <Pressable style={{ flex: 1 }} onPress={() => setShowPatchNotes(false)} />
          <View style={{ marginHorizontal: 20, backgroundColor: theme.modalGlass, borderRadius: 20, padding: 20, maxHeight: "70%", gap: 16 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontFamily: theme.fontFamily.semibold, textAlign: "center" }}>
              {t("patchNotes.whatsNew", { version: CURRENT_VERSION })}
            </Text>
            <ScrollView style={{ flexGrow: 0 }}>
              {patchNotes.map((release) => (
                <View key={release.version} style={{ marginBottom: 16, gap: 8 }}>
                  <Text style={{ color: theme.accent, fontSize: 14, fontFamily: theme.fontFamily.semibold }}>
                    v{release.version} — {release.date}
                  </Text>
                  {release.changes.map((change, i) => {
                    const typeLabel = t(`patchNotes.${change.type}`);
                    const typeColor = change.type === "new" ? theme.success : change.type === "improved" ? theme.accent : theme.warn;
                    return (
                      <View key={`${release.version}_${i}`} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: typeColor, marginTop: 2 }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 10, fontFamily: theme.fontFamily.semibold }}>{typeLabel}</Text>
                        </View>
                        <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>{t(change.key)}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
            <Btn label={t("common.close")} onPress={() => setShowPatchNotes(false)} tone="accent" />
          </View>
          <Pressable style={{ flex: 1 }} onPress={() => setShowPatchNotes(false)} />
        </View>
      </Modal>
    </Screen>
  );
}








