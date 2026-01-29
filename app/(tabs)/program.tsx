// app/(tabs)/program.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Modal, Alert, Platform } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { theme } from "../../src/theme";
import { ensureDb, getDb, getSettingAsync, setSettingAsync } from "../../src/db";
import { displayNameFor, searchExercises, EXERCISES, EXERCISE_TAGS, type ExerciseTag } from "../../src/exerciseLibrary";
import ProgramStore from "../../src/programStore";
import type { Program, ProgramBlock, ProgramDay } from "../../src/programStore";
import ProgressionStore, { defaultTargetForExercise, type ExerciseTarget } from "../../src/progressionStore";
import AppLoading from "../../components/AppLoading";
import { Screen, TopBar, Card, Chip, Btn, IconButton, TextField } from "../../src/ui";

type PickerMode = "addSingle" | "addSupersetA" | "addSupersetB";

type ProgramMode = "normal" | "back";

type AltContext = {
  dayIndex: number;
  exerciseId: string;
};

type AlternativesMap = Record<number, Record<string, string[]>>;

type ImportPayload = {
  name: string;
  days: Array<{ name: string; blocks: Array<{ type: string; exId?: string; ex?: string; a?: string; b?: string }> }>;
};

function isoNow() {
  return new Date().toISOString();
}

function newProgramId() {
  return `program_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function collectExerciseIds(program: Program, alts: AlternativesMap): string[] {
  const set = new Set<string>();
  for (let di = 0; di < program.days.length; di += 1) {
    const day = program.days[di];
    const map = alts[di] ?? {};
    for (const block of day.blocks) {
      if (block.type === "single") {
        set.add(block.exId);
        for (const alt of map[block.exId] ?? []) set.add(alt);
      } else {
        set.add(block.a);
        set.add(block.b);
        for (const alt of map[block.a] ?? []) set.add(alt);
        for (const alt of map[block.b] ?? []) set.add(alt);
      }
    }
  }
  return Array.from(set);
}

function validateImport(payload: unknown): { ok: true; program: ImportPayload } | { ok: false; error: string } {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Ugyldig JSON" };
  const p = payload as ImportPayload;
  if (!p.name || typeof p.name !== "string") return { ok: false, error: "Program må ha name" };
  if (!Array.isArray(p.days) || (p.days.length !== 4 && p.days.length !== 5)) {
    return { ok: false, error: "Program må ha 4 eller 5 dager" };
  }

  for (const day of p.days) {
    if (!day || typeof day.name !== "string" || !Array.isArray(day.blocks)) {
      return { ok: false, error: "Ugyldig day-format" };
    }
    for (const block of day.blocks) {
      if (!block || typeof block.type !== "string") return { ok: false, error: "Ugyldig blokk" };
      if (block.type === "single") {
        const exId = block.exId ?? block.ex;
        if (!exId || typeof exId !== "string") return { ok: false, error: "Single blokk mangler exId" };
      } else if (block.type === "superset") {
        if (!block.a || !block.b || typeof block.a !== "string" || typeof block.b !== "string") {
          return { ok: false, error: "Superset mangler a/b" };
        }
      } else {
        return { ok: false, error: "Ukjent blokk-type" };
      }
    }
  }

  return { ok: true, program: p };
}

export default function ProgramScreen() {
  const [ready, setReady] = useState(false);

  const [programMode, setProgramMode] = useState<ProgramMode>("normal");
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeProgramId, setActiveProgramId] = useState<string>("");
  const [activeProgram, setActiveProgram] = useState<Program | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativesMap>({});
  const [targets, setTargets] = useState<Record<string, ExerciseTarget>>({});
  const [workoutLocked, setWorkoutLocked] = useState(false);

  const navigation = useNavigation();
  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);

  const [dayEditorOpen, setDayEditorOpen] = useState(false);
  const [editingDayIndex, setEditingDayIndex] = useState<number>(0);

  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [nameAction, setNameAction] = useState<"new" | "rename" | "duplicate">("new");
  const [newProgramDays, setNewProgramDays] = useState(5);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>("addSingle");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerTag, setPickerTag] = useState<ExerciseTag | "all">("all");
  const [pendingSupersetA, setPendingSupersetA] = useState<string | null>(null);
  const [altEditorOpen, setAltEditorOpen] = useState(false);
  const [altContext, setAltContext] = useState<AltContext | null>(null);
  const [altQuery, setAltQuery] = useState("");
  const [altTag, setAltTag] = useState<ExerciseTag | "all">("all");
  const [altSelection, setAltSelection] = useState<string[]>([]);

  const [importExportOpen, setImportExportOpen] = useState<"export" | "import" | null>(null);
  const [exportText, setExportText] = useState("");
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const [targetEditorOpen, setTargetEditorOpen] = useState(false);
  const [targetExerciseId, setTargetExerciseId] = useState<string | null>(null);
  const [targetRepMin, setTargetRepMin] = useState(6);
  const [targetRepMax, setTargetRepMax] = useState(10);
  const [targetSets, setTargetSets] = useState(3);
  const [targetIncrement, setTargetIncrement] = useState(2.5);

  const loadAll = useCallback(async () => {
    await ProgramStore.ensurePrograms();
    const pmRaw = await getSettingAsync("programMode");
    const pm: ProgramMode = pmRaw === "back" ? "back" : "normal";

    const adiRaw = (await getSettingAsync("activeDayIndex")) ?? (await getSettingAsync("defaultDayIndex")) ?? "0";
    const activeWorkoutId = await getSettingAsync("activeWorkoutId");
    let activeWorkoutRow: { id: string; day_index?: number | null; day_key?: string | null; program_id?: string | null } | null = null;
    if (activeWorkoutId) {
      const row = getDb().getFirstSync<{ id: string; day_index?: number | null; day_key?: string | null; program_id?: string | null }>(
        `SELECT id, day_index, day_key, program_id FROM workouts WHERE id = ? LIMIT 1`,
        [activeWorkoutId]
      );
      if (row?.id) activeWorkoutRow = row;
    }

    const list = await ProgramStore.listPrograms(pm);
    let active = await ProgramStore.getActiveProgram(pm);
    if (activeWorkoutRow?.program_id) {
      const fromWorkout = await ProgramStore.getProgram(activeWorkoutRow.program_id);
      if (fromWorkout) active = fromWorkout;
    }
    const dayMax = Math.max(0, active.days.length - 1);
    let adi = clampInt(parseInt(adiRaw, 10), 0, dayMax);
    if (activeWorkoutRow) {
      const fromIndex = Number.isFinite(activeWorkoutRow.day_index ?? NaN) ? Number(activeWorkoutRow.day_index) : NaN;
      let fromKey = NaN;
      if (!Number.isFinite(fromIndex) && activeWorkoutRow.day_key) {
        const match = String(activeWorkoutRow.day_key).match(/day_(\d+)/i);
        if (match) fromKey = Number(match[1]) - 1;
      }
      const locked = Number.isFinite(fromIndex) ? fromIndex : Number.isFinite(fromKey) ? fromKey : adi;
      adi = clampInt(locked, 0, dayMax);
    }
    const alts = await ProgramStore.getAlternativesForProgram(active.id);
    const exerciseIds = collectExerciseIds(active, alts);
    await ProgressionStore.ensureTargets(active.id, exerciseIds);
    const targetMap = await ProgressionStore.getTargets(active.id);

    setProgramMode(pm);
    setActiveDayIndex(adi);
    if (!activeWorkoutRow && String(adi) !== String(adiRaw)) {
      setSettingAsync("activeDayIndex", String(adi)).catch(() => {});
    }
    if (activeWorkoutRow) {
      setEditingDayIndex(adi);
    }
    setPrograms(list);
    setActiveProgram(active);
    setActiveProgramId(active.id);
    setAlternatives(alts);
    setTargets(targetMap);
    setWorkoutLocked(!!activeWorkoutRow);
  }, []);

  useEffect(() => {
    ensureDb().then(async () => {
      await loadAll();
      setReady(true);
    });
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return () => {};
      let alive = true;
      (async () => {
        await loadAll();
        if (!alive) return;
      })();
      return () => {
        alive = false;
      };
    }, [ready, loadAll])
  );

  const headerStatus = useMemo(() => {
    const pm = programMode === "back" ? "Ryggvennlig" : "Standard";
    return `${pm}`;
  }, [programMode]);

  const activeDay = useMemo(() => {
    if (!activeProgram) return null;
    return activeProgram.days[editingDayIndex] ?? activeProgram.days[0] ?? null;
  }, [activeProgram, editingDayIndex]);

  const filteredExercises = useMemo(() => {
    const base = pickerQuery.trim() ? searchExercises(pickerQuery.trim()) : EXERCISES;
    const withTag = pickerTag === "all" ? base : base.filter((e) => e.tags.includes(pickerTag));
    return withTag;
  }, [pickerQuery, pickerTag]);

  const filteredAltExercises = useMemo(() => {
    const base = altQuery.trim() ? searchExercises(altQuery.trim()) : EXERCISES;
    const withTag = altTag === "all" ? base : base.filter((e) => e.tags.includes(altTag));
    return withTag;
  }, [altQuery, altTag]);

  const canDeleteProgram = !!(
    activeProgram &&
    ![
      ProgramStore.STANDARD_PROGRAM_ID,
      ProgramStore.BACK_PROGRAM_ID,
      ProgramStore.LEGACY_STANDARD_PROGRAM_ID,
      ProgramStore.LEGACY_BACK_PROGRAM_ID,
    ].includes(activeProgram.id)
  );

  function ensureUnlocked(message = "Avslutt økten før du gjør endringer i programmet.") {
    if (!workoutLocked) return true;
    Alert.alert("Økt pågår", message);
    return false;
  }

  async function saveProgram(next: Program) {
    await ProgramStore.saveProgram(programMode, next);
    setActiveProgram(next);
    const list = await ProgramStore.listPrograms(programMode);
    setPrograms(list);
  }

  function buildEmptyDay(name: string): ProgramDay {
    return { id: newProgramId(), name, blocks: [] };
  }

  async function setDayCount(count: number) {
    if (!activeProgram) return;
    if (!ensureUnlocked()) return;
    const target = clampInt(count, 4, 5);
    const current = activeProgram.days.length;
    if (current === target) return;
    let nextDays = [...activeProgram.days];
    if (target < current) {
      nextDays = nextDays.slice(0, target);
    } else {
      for (let i = current; i < target; i += 1) {
        nextDays.push(buildEmptyDay(`Dag ${i + 1}`));
      }
    }
    const renamed = nextDays.map((d, idx) => ({ ...d, name: d.name || `Dag ${idx + 1}` }));
    const next = { ...activeProgram, days: renamed, updatedAt: isoNow() };
    await saveProgram(next);
    if (activeDayIndex >= renamed.length) {
      setActiveDayIndex(Math.max(0, renamed.length - 1));
      setSettingAsync("activeDayIndex", String(Math.max(0, renamed.length - 1))).catch(() => {});
    }
  }

  async function setActiveProgramById(programId: string) {
    if (!ensureUnlocked("Avslutt økten før du bytter program.")) return;
    await ProgramStore.setActiveProgram(programMode, programId);
    const prog = await ProgramStore.getActiveProgram(programMode);
    setActiveProgram(prog);
    setActiveProgramId(prog.id);
    const alts = await ProgramStore.getAlternativesForProgram(prog.id);
    setAlternatives(alts);
    await ProgressionStore.ensureTargets(prog.id, collectExerciseIds(prog, alts));
    setTargets(await ProgressionStore.getTargets(prog.id));
  }

  function openDayEditor(idx: number) {
    if (!ensureUnlocked("Avslutt økten før du redigerer dager.")) return;
    setEditingDayIndex(idx);
    setDayEditorOpen(true);
  }

  function addBlock(block: ProgramBlock) {
    if (!activeProgram || !activeDay) return;
    if (!ensureUnlocked()) return;
    const nextDays = activeProgram.days.map((d, di) => {
      if (di !== editingDayIndex) return d;
      return { ...d, blocks: [...d.blocks, block] };
    });
    const next = { ...activeProgram, days: nextDays };
    saveProgram(next).catch(() => {});
  }

  function removeBlock(index: number) {
    if (!activeProgram || !activeDay) return;
    if (!ensureUnlocked()) return;
    const nextDays = activeProgram.days.map((d, di) => {
      if (di !== editingDayIndex) return d;
      const blocks = d.blocks.filter((_, i) => i !== index);
      return { ...d, blocks };
    });
    const next = { ...activeProgram, days: nextDays };
    saveProgram(next).catch(() => {});
  }

  function moveBlock(index: number, dir: -1 | 1) {
    if (!activeProgram || !activeDay) return;
    if (!ensureUnlocked()) return;
    const target = index + dir;
    if (target < 0 || target >= activeDay.blocks.length) return;
    const nextDays = activeProgram.days.map((d, di) => {
      if (di !== editingDayIndex) return d;
      const blocks = [...d.blocks];
      const tmp = blocks[index];
      blocks[index] = blocks[target];
      blocks[target] = tmp;
      return { ...d, blocks };
    });
    const next = { ...activeProgram, days: nextDays };
    saveProgram(next).catch(() => {});
  }

  function openAlternatives(dayIndex: number, exerciseId: string) {
    if (!ensureUnlocked()) return;
    const current = alternatives[dayIndex]?.[exerciseId] ?? [];
    setAltContext({ dayIndex, exerciseId });
    setAltSelection(current.slice(0, 3));
    setAltQuery("");
    setAltTag("all");
    setAltEditorOpen(true);
  }

  async function saveAlternatives() {
    if (!activeProgram || !altContext) return;
    if (!ensureUnlocked()) return;
    const trimmed = altSelection.filter((id) => id !== altContext.exerciseId).slice(0, 3);
    await ProgramStore.setAlternatives({
      programId: activeProgram.id,
      dayIndex: altContext.dayIndex,
      exerciseId: altContext.exerciseId,
      alternatives: trimmed,
    });
    const map = await ProgramStore.getAlternativesForProgram(activeProgram.id);
    setAlternatives(map);
    await ProgressionStore.ensureTargets(activeProgram.id, collectExerciseIds(activeProgram, map));
    setTargets(await ProgressionStore.getTargets(activeProgram.id));
    setAltEditorOpen(false);
  }

  function openTargetEditor(exId: string) {
    if (!ensureUnlocked()) return;
    const current = targets[exId];
    const fallback = defaultTargetForExercise(exId);
    setTargetExerciseId(exId);
    setTargetRepMin(current?.repMin ?? fallback.repMin);
    setTargetRepMax(current?.repMax ?? fallback.repMax);
    setTargetSets(current?.targetSets ?? fallback.targetSets);
    setTargetIncrement(current?.incrementKg ?? fallback.incrementKg);
    setTargetEditorOpen(true);
  }

  async function saveTarget() {
    if (!activeProgram || !targetExerciseId) return;
    if (!ensureUnlocked()) return;
    const repMin = clampInt(targetRepMin, 1, 30);
    const repMax = clampInt(targetRepMax, repMin, 40);
    const sets = clampInt(targetSets, 1, 10);
    const incrementKg = Math.max(0, Number(targetIncrement) || 0);

    await ProgressionStore.upsertTarget({
      programId: activeProgram.id,
      exerciseId: targetExerciseId,
      repMin,
      repMax,
      targetSets: sets,
      incrementKg: incrementKg || defaultTargetForExercise(targetExerciseId).incrementKg,
    });
    const targetMap = await ProgressionStore.getTargets(activeProgram.id);
    setTargets(targetMap);
    setTargetEditorOpen(false);
  }

  function startAddSingle() {
    if (!ensureUnlocked()) return;
    setPickerMode("addSingle");
    setPickerQuery("");
    setPickerTag("all");
    setPickerOpen(true);
  }

  function startAddSuperset() {
    if (!ensureUnlocked()) return;
    setPickerMode("addSupersetA");
    setPickerQuery("");
    setPickerTag("all");
    setPendingSupersetA(null);
    setPickerOpen(true);
  }

  function handlePickExercise(exId: string) {
    if (!ensureUnlocked()) return;
    if (pickerMode === "addSingle") {
      addBlock({ type: "single", exId });
      setPickerOpen(false);
      return;
    }
    if (pickerMode === "addSupersetA") {
      setPendingSupersetA(exId);
      setPickerMode("addSupersetB");
      setPickerQuery("");
      return;
    }
    if (pickerMode === "addSupersetB") {
      if (!pendingSupersetA) return;
      addBlock({ type: "superset", a: pendingSupersetA, b: exId });
      setPendingSupersetA(null);
      setPickerOpen(false);
      return;
    }
  }

  function openNameModal(action: "new" | "rename" | "duplicate") {
    if (!ensureUnlocked()) return;
    setNameAction(action);
    setNameValue(action === "rename" && activeProgram ? activeProgram.name : "");
    if (action === "new") setNewProgramDays(5);
    setNameModalOpen(true);
  }

  async function submitName() {
    if (!ensureUnlocked()) return;
    const name = nameValue.trim();
    if (!name) return;
    if (nameAction === "new") {
      const p = ProgramStore.createBlankProgram(name, clampInt(newProgramDays, 1, 10));
      const created: Program = { ...p, id: newProgramId(), createdAt: isoNow(), updatedAt: isoNow() };
      await ProgramStore.saveProgram(programMode, created);
      await ProgramStore.setActiveProgram(programMode, created.id);
      await setSettingAsync("activeDayIndex", "0");
      await loadAll();
      setEditingDayIndex(0);
      setDayEditorOpen(true);
    } else if (nameAction === "duplicate" && activeProgram) {
      const clone = ProgramStore.cloneProgram(activeProgram, name);
      await ProgramStore.saveProgram(programMode, clone);
      await ProgramStore.setActiveProgram(programMode, clone.id);
      await loadAll();
    } else if (nameAction === "rename" && activeProgram) {
      const next = { ...activeProgram, name, updatedAt: isoNow() };
      await ProgramStore.saveProgram(programMode, next);
      await loadAll();
    }
    setNameModalOpen(false);
    setNameValue("");
  }

  async function deleteActiveProgram() {
    if (!activeProgram) return;
    if (!ensureUnlocked()) return;
    if (!canDeleteProgram) {
      Alert.alert("Kan ikke slette default-program", "Du kan duplisere og redigere i stedet.");
      return;
    }
    Alert.alert("Slett program?", "Dette kan ikke angres.", [
      { text: "Avbryt", style: "cancel" },
      {
        text: "Slett",
        style: "destructive",
        onPress: async () => {
          await ProgramStore.deleteProgram(activeProgram.id);
          await ProgramStore.setActiveProgram(programMode, programMode === "back" ? ProgramStore.BACK_PROGRAM_ID : ProgramStore.STANDARD_PROGRAM_ID);
          await loadAll();
        },
      },
    ]);
  }

  function openExport() {
    if (!activeProgram) return;
    const payload = {
      name: activeProgram.name,
      days: activeProgram.days.map((d) => ({
        name: d.name,
        blocks: d.blocks.map((b) =>
          b.type === "single"
            ? { type: "single", exId: b.exId }
            : { type: "superset", a: b.a, b: b.b }
        ),
      })),
    };
    setExportText(JSON.stringify(payload, null, 2));
    setImportExportOpen("export");
  }

  async function copyText(text: string) {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      Alert.alert("Kopiert", "JSON kopiert til utklippstavlen.");
      return;
    }
    Alert.alert("Kopier manuelt", "Marker teksten og kopier manuelt.");
  }

  async function handleImport() {
    if (!ensureUnlocked()) return;
    setImportError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError("Ugyldig JSON");
      return;
    }

    const res = validateImport(parsed);
    if (!res.ok) {
      setImportError(res.error);
      return;
    }

    const base = res.program;
    const now = isoNow();
    const program: Program = {
      id: newProgramId(),
      name: base.name,
      createdAt: now,
      updatedAt: now,
      days: base.days.map((d) => ({
        id: newProgramId(),
        name: d.name,
        blocks: d.blocks.map((b) => {
          if (b.type === "single") return { type: "single", exId: (b.exId ?? b.ex) as string };
          return { type: "superset", a: b.a as string, b: b.b as string };
        }),
      })),
    };

    await ProgramStore.saveProgram(programMode, program);
    await ProgramStore.setActiveProgram(programMode, program.id);
    await loadAll();
    setImportExportOpen(null);
    setImportText("");
  }

  if (!ready || !activeProgram) {
    return <AppLoading />;
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: 80 }}>
        <TopBar
          title="Program"
          subtitle={headerStatus}
          left={<IconButton icon="menu" onPress={openDrawer} />}
        />
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Chip text={headerStatus} />
          <Chip text={`Aktiv dag: ${activeDayIndex + 1}`} />
          <Chip text={`Program: ${activeProgram.name}`} active />
        </View>

        {workoutLocked ? (
          <Card style={{ borderColor: theme.warn }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono }}>
              Økt pågår (Dag {activeDayIndex + 1}) – endringer låst.
            </Text>
          </Card>
        ) : null}

        <Card title="PROGRAMMER">
          <View style={{ gap: 8 }}>
            {programs.map((p) => {
              const isActive = p.id === activeProgramId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setActiveProgramById(p.id)}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: isActive ? theme.accent : theme.line,
                    backgroundColor: theme.panel2,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {isActive ? <Chip text="AKTIV" active /> : null}
                  </View>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>Dager: {p.days.length}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <Btn label="Nytt program" onPress={() => openNameModal("new")} tone="accent" />
            <Btn label="Dupliser" onPress={() => openNameModal("duplicate")} />
            <Btn label="Gi nytt navn" onPress={() => openNameModal("rename")} />
            <Btn label="Slett" onPress={deleteActiveProgram} tone="danger" />
          </View>

          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <Btn label="Eksporter" onPress={openExport} />
            <Btn
              label="Importer"
              onPress={() => {
                setImportText("");
                setImportError(null);
                setImportExportOpen("import");
              }}
            />
          </View>
        </Card>

        <Card title="UKEOVERSIKT">
          <Text style={{ color: theme.muted }}>Trykk på en dag for å åpne editor. Bytt øvelser om du må.</Text>
          <View style={{ gap: 10, marginTop: 8 }}>
            {activeProgram.days.map((day, idx) => {
              const isActive = idx === activeDayIndex;
              const altMap = alternatives[idx] ?? {};
              return (
                <View key={day.id} style={{ gap: 6, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.panel2 }}>
                  <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <Text
                        style={{ color: theme.text, fontFamily: theme.mono, flex: 1, minWidth: 0 }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {day.name}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      <Pressable
                        onPress={() => {
                          if (workoutLocked) {
                            Alert.alert("Låst under aktiv økt", "Avslutt økten før du bytter aktiv dag.");
                            return;
                          }
                          setActiveDayIndex(idx);
                          setSettingAsync("activeDayIndex", String(idx)).catch(() => {});
                        }}
                        style={{ borderColor: isActive ? theme.accent : theme.line, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: theme.panel }}
                      >
                        <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>{isActive ? "AKTIV" : "SETT AKTIV"}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => openDayEditor(idx)}
                        style={{ borderColor: theme.line, borderWidth: 1, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: theme.panel }}
                      >
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>EDIT</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    {day.blocks.length === 0 ? (
                      <Text style={{ color: theme.muted }}>Ingen øvelser.</Text>
                    ) : (
                      day.blocks.map((block, bi) => {
                        if (block.type === "single") {
                          const altList = altMap[block.exId] ?? [];
                          return (
                            <View key={`${day.id}_${bi}`} style={{ gap: 2 }}>
                              <Text style={{ color: theme.text }}>• {displayNameFor(block.exId)}</Text>
                              {altList.length ? (
                                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                                  Alt: {altList.map((id) => displayNameFor(id)).join(", ")}
                                </Text>
                              ) : null}
                            </View>
                          );
                        }
                        const altA = altMap[block.a] ?? [];
                        const altB = altMap[block.b] ?? [];
                        return (
                          <View key={`${day.id}_${bi}`} style={{ gap: 2 }}>
                            <Text style={{ color: theme.text }}>• {displayNameFor(block.a)}</Text>
                            {altA.length ? (
                              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                                Alt: {altA.map((id) => displayNameFor(id)).join(", ")}
                              </Text>
                            ) : null}
                            <Text style={{ color: theme.text }}>  + {displayNameFor(block.b)}</Text>
                            {altB.length ? (
                              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                                Alt: {altB.map((id) => displayNameFor(id)).join(", ")}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      </ScrollView>

      <Modal visible={dayEditorOpen} transparent animationType="slide" onRequestClose={() => setDayEditorOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", padding: 14, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 18, overflow: "hidden", maxHeight: "85%" }}>
            <View style={{ padding: 14, borderBottomColor: theme.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1} ellipsizeMode="tail">
                  {activeDay?.name ?? "Dag"}
                </Text>
              </View>
              <View style={{ flexShrink: 0 }}>
                <Pressable
                  onPress={() => setDayEditorOpen(false)}
                  style={{ borderColor: theme.line, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}
                >
                  <Text style={{ color: theme.muted, fontFamily: theme.mono }}>LUKK</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 14, gap: 10 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Btn label="Legg til øvelse" onPress={startAddSingle} tone="accent" />
                <Btn label="Legg til supersett" onPress={startAddSuperset} />
              </View>

              {activeDay ? (
                <View style={{ gap: 10 }}>
                  {activeDay.blocks.length === 0 ? (
                    <Text style={{ color: theme.muted }}>Ingen blokker. Legg til øvelser.</Text>
                  ) : (
                    activeDay.blocks.map((block, idx) => {
                      const altMap = alternatives[editingDayIndex] ?? {};
                      if (block.type === "single") {
                        const altList = altMap[block.exId] ?? [];
                        return (
                          <View key={`${activeDay.id}_${idx}`} style={{ borderColor: theme.line, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: theme.panel }}>
                            <Text style={{ color: theme.text }}>{displayNameFor(block.exId)}</Text>
                            {altList.length ? (
                              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                                Alternativer: {altList.map((id) => displayNameFor(id)).join(", ")}
                              </Text>
                            ) : null}
                            <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                              <Btn label="Alternativer" onPress={() => openAlternatives(editingDayIndex, block.exId)} />
                              <Btn label="Mål" onPress={() => openTargetEditor(block.exId)} />
                              <Btn label="↑" onPress={() => moveBlock(idx, -1)} />
                              <Btn label="↓" onPress={() => moveBlock(idx, 1)} />
                              <Btn label="Fjern" tone="danger" onPress={() => removeBlock(idx)} />
                            </View>
                          </View>
                        );
                      }
                      const altA = altMap[block.a] ?? [];
                      const altB = altMap[block.b] ?? [];
                      return (
                        <View key={`${activeDay.id}_${idx}`} style={{ borderColor: theme.line, borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: theme.panel }}>
                          <Text style={{ color: theme.text }}>A: {displayNameFor(block.a)}</Text>
                          {altA.length ? (
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                              Alternativer: {altA.map((id) => displayNameFor(id)).join(", ")}
                            </Text>
                          ) : null}
                          <Text style={{ color: theme.text, marginTop: 6 }}>B: {displayNameFor(block.b)}</Text>
                          {altB.length ? (
                            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                              Alternativer: {altB.map((id) => displayNameFor(id)).join(", ")}
                            </Text>
                          ) : null}
                          <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            <Btn label="Alt A" onPress={() => openAlternatives(editingDayIndex, block.a)} />
                            <Btn label="Alt B" onPress={() => openAlternatives(editingDayIndex, block.b)} />
                            <Btn label="Mål A" onPress={() => openTargetEditor(block.a)} />
                            <Btn label="Mål B" onPress={() => openTargetEditor(block.b)} />
                            <Btn label="↑" onPress={() => moveBlock(idx, -1)} />
                            <Btn label="↓" onPress={() => moveBlock(idx, 1)} />
                            <Btn label="Fjern" tone="danger" onPress={() => removeBlock(idx)} />
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", padding: 14, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 18, overflow: "hidden", maxHeight: "85%" }}>
            <View style={{ padding: 14, borderBottomColor: theme.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: theme.text, fontSize: 16 }}>Velg øvelse</Text>
              <Pressable
                onPress={() => {
                  setPickerOpen(false);
                  setPendingSupersetA(null);
                }}
                style={{ borderColor: theme.line, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text style={{ color: theme.muted, fontFamily: theme.mono }}>LUKK</Text>
              </Pressable>
            </View>

            <View style={{ padding: 14, gap: 10 }}>
              <TextField
                value={pickerQuery}
                onChangeText={setPickerQuery}
                placeholder="Søk..."
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

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Chip text="All" active={pickerTag === "all"} onPress={() => setPickerTag("all")} />
                {EXERCISE_TAGS.map((t) => (
                  <Chip key={t} text={t} active={pickerTag === t} onPress={() => setPickerTag(t)} />
                ))}
              </ScrollView>

              <ScrollView
                contentContainerStyle={{ gap: 8 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
              >
                {filteredExercises.map((ex) => (
                  <Pressable
                    key={ex.id}
                    onPress={() => handlePickExercise(ex.id)}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: theme.line,
                      backgroundColor: theme.panel,
                    }}
                  >
                  <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>{ex.displayName}</Text>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{ex.equipment} · {ex.tags.join("/")}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {pickerMode === "addSupersetB" && pendingSupersetA ? (
                <Text style={{ color: theme.muted, fontFamily: theme.mono }}>
                  Velg øvelse B (A er {displayNameFor(pendingSupersetA)}).
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={altEditorOpen} transparent animationType="slide" onRequestClose={() => setAltEditorOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", padding: 14, justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 18, overflow: "hidden", maxHeight: "85%" }}>
            <View style={{ padding: 14, borderBottomColor: theme.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ gap: 4 }}>
                <Text style={{ color: theme.text, fontSize: 16 }}>Alternativer</Text>
                {altContext ? (
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                    {displayNameFor(altContext.exerciseId)} (0–3)
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => setAltEditorOpen(false)}
                style={{ borderColor: theme.line, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 }}
              >
                <Text style={{ color: theme.muted, fontFamily: theme.mono }}>LUKK</Text>
              </Pressable>
            </View>

            <View style={{ padding: 14, gap: 10 }}>
              <TextField
                value={altQuery}
                onChangeText={setAltQuery}
                placeholder="Søk..."
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

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Chip text="All" active={altTag === "all"} onPress={() => setAltTag("all")} />
                {EXERCISE_TAGS.map((t) => (
                  <Chip key={`alt_${t}`} text={t} active={altTag === t} onPress={() => setAltTag(t)} />
                ))}
              </ScrollView>

              <ScrollView
                contentContainerStyle={{ gap: 8 }}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
              >
                {filteredAltExercises
                  .filter((ex) => ex.id !== altContext?.exerciseId)
                  .map((ex) => {
                    const selected = altSelection.includes(ex.id);
                    return (
                      <Pressable
                        key={`alt_pick_${ex.id}`}
                        onPress={() =>
                          setAltSelection((prev) => {
                            if (prev.includes(ex.id)) return prev.filter((id) => id !== ex.id);
                            if (prev.length >= 3) return prev;
                            return [...prev, ex.id];
                          })
                        }
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: selected ? theme.accent : theme.line,
                          backgroundColor: theme.panel,
                        }}
                      >
                        <Text style={{ color: theme.text, fontSize: 16 }} numberOfLines={1}>{ex.displayName}</Text>
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                          {ex.equipment} · {ex.tags.join("/")}
                        </Text>
                      </Pressable>
                    );
                  })}
              </ScrollView>

              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn label="Lagre" onPress={saveAlternatives} tone="accent" />
                <Btn label="Tøm" onPress={() => setAltSelection([])} />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={nameModalOpen} transparent animationType="fade" onRequestClose={() => setNameModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
              {nameAction === "new" ? "Nytt program" : nameAction === "duplicate" ? "Dupliser program" : "Gi nytt navn"}
            </Text>
            <TextField
              value={nameValue}
              onChangeText={setNameValue}
              placeholder="Navn"
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
            {nameAction === "new" ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: theme.muted }}>Antall dager</Text>
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <Btn
                    label="-"
                    onPress={() => setNewProgramDays((v) => clampInt(v - 1, 1, 10))}
                  />
                  <Chip text={`${clampInt(newProgramDays, 1, 10)} dager`} active />
                  <Btn
                    label="+"
                    onPress={() => setNewProgramDays((v) => clampInt(v + 1, 1, 10))}
                  />
                </View>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label="Lagre" onPress={submitName} tone="accent" />
              <Btn label="Avbryt" onPress={() => setNameModalOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={targetEditorOpen} transparent animationType="fade" onRequestClose={() => setTargetEditorOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>Mål per øvelse</Text>
            <Text style={{ color: theme.muted, fontFamily: theme.mono }}>
              {targetExerciseId ? displayNameFor(targetExerciseId) : ""}
            </Text>

            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted }}>Rep range</Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn
                  label="-1"
                  onPress={() => {
                    const nextMin = clampInt(targetRepMin - 1, 1, 40);
                    setTargetRepMin(nextMin);
                    if (targetRepMax < nextMin) setTargetRepMax(nextMin);
                  }}
                />
                <Chip text={`Min: ${targetRepMin}`} />
                <Btn
                  label="+1"
                  onPress={() => {
                    const nextMin = clampInt(targetRepMin + 1, 1, 40);
                    setTargetRepMin(nextMin);
                    if (targetRepMax < nextMin) setTargetRepMax(nextMin);
                  }}
                />
                <Btn
                  label="-1"
                  onPress={() => setTargetRepMax((v) => clampInt(v - 1, targetRepMin, 50))}
                />
                <Chip text={`Max: ${targetRepMax}`} />
                <Btn label="+1" onPress={() => setTargetRepMax((v) => clampInt(v + 1, targetRepMin, 50))} />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted }}>Antall sett</Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn label="-1" onPress={() => setTargetSets((v) => clampInt(v - 1, 1, 10))} />
                <Chip text={`${clampInt(targetSets, 1, 10)} sett`} active />
                <Btn label="+1" onPress={() => setTargetSets((v) => clampInt(v + 1, 1, 10))} />
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.muted }}>Increment (kg)</Text>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn label="-2.5" onPress={() => setTargetIncrement((v) => Math.max(0, v - 2.5))} />
                <Chip text={`${targetIncrement.toFixed(1)} kg`} />
                <Btn label="+2.5" onPress={() => setTargetIncrement((v) => v + 2.5)} />
                <Btn label="+5" onPress={() => setTargetIncrement((v) => v + 5)} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label="Lagre" onPress={saveTarget} tone="accent" />
              <Btn label="Avbryt" onPress={() => setTargetEditorOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={importExportOpen !== null} transparent animationType="fade" onRequestClose={() => setImportExportOpen(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 16 }}>
          <View style={{ backgroundColor: theme.bg, borderColor: theme.line, borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 }}>
            <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
              {importExportOpen === "export" ? "Eksporter program" : "Importer program"}
            </Text>
            {importExportOpen === "export" ? (
              <>
                <TextField
                  value={exportText}
                  editable={false}
                  multiline
                  style={{
                    color: theme.text,
                    backgroundColor: theme.panel,
                    borderColor: theme.line,
                    borderWidth: 1,
                    borderRadius: 14,
                    padding: 12,
                    minHeight: 160,
                    textAlignVertical: "top",
                  }}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label="Kopier" onPress={() => copyText(exportText)} tone="accent" />
                  <Btn label="Lukk" onPress={() => setImportExportOpen(null)} />
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
                    minHeight: 160,
                    textAlignVertical: "top",
                  }}
                />
                {importError ? <Text style={{ color: theme.danger }}>{importError}</Text> : null}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Btn label="Importer" onPress={handleImport} tone="accent" />
                  <Btn label="Avbryt" onPress={() => setImportExportOpen(null)} />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}


