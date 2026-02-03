// src/components/workout/ExerciseCard.tsx
import React, { useRef, useState } from "react";
import { View, Text, Pressable, Animated, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import { TextField, Btn } from "../../ui";
import { displayNameFor, getExercise } from "../../exerciseLibrary";
import BackImpactDot from "../BackImpactDot";
import SetEntryRow from "./SetEntryRow";
import type { SetRow } from "./SetEntryRow";
import { RestTimerInline } from "./RestTimer";
import type { ExerciseTarget } from "../../progressionStore";

export type SetType = "normal" | "warmup" | "dropset" | "restpause";

export type InputState = {
  weight: string;
  reps: string;
  rpe: string;
};

export type LastSetInfo = {
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  workout_id?: string | null;
};

function formatWeight(n: number) {
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

function AddSetButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => Promise<void> | void;
}) {
  const t = useTheme();
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await onPress();
        }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <LinearGradient
          colors={t.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            height: 52,
            borderRadius: t.radius.lg,
            alignItems: "center",
            justifyContent: "center",
            shadowColor: t.shadow.glow.color,
            shadowOpacity: t.shadow.glow.opacity,
            shadowRadius: t.shadow.glow.radius,
            shadowOffset: t.shadow.glow.offset,
            elevation: 4,
          }}
        >
          <Text style={{ color: "#FFFFFF", fontWeight: t.fontWeight.semibold, fontSize: t.fontSize.sm }}>{label}</Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ── Set table header + rows ──

type SetTableProps = {
  sets: SetRow[];
  lastAddedSetId: string | null;
  lastAddedAnim: Animated.Value;
  onEditSet: (row: SetRow) => void;
  onDeleteSet: (row: SetRow) => void;
};

function SetTable({ sets, lastAddedSetId, lastAddedAnim, onEditSet, onDeleteSet }: SetTableProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();

  if (sets.length === 0) {
    return (
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>
        {t("log.noSetsYet")}
      </Text>
    );
  }

  const highlightBg = lastAddedAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.glass, "rgba(182, 104, 245, 0.22)"],
  });

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
          backgroundColor: theme.isDark ? "rgba(25, 15, 50, 0.5)" : "rgba(243, 237, 255, 0.6)",
          borderWidth: 1,
          borderColor: theme.glassBorder,
        }}
      >
        <Text style={{ width: 28, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>#</Text>
        <Text style={{ flex: 1, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>{wu.unitLabel()}</Text>
        <Text style={{ width: 44, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>REPS</Text>
        <Text style={{ width: 48, color: theme.muted, fontFamily: theme.mono, fontSize: theme.fontSize.xs }}>TYPE</Text>
        <View style={{ width: 70 }} />
      </View>
      {sets.map((s) => (
        <SetEntryRow
          key={s.id}
          set={s}
          highlight={s.id === lastAddedSetId}
          highlightBg={highlightBg}
          onEdit={onEditSet}
          onDelete={onDeleteSet}
        />
      ))}
    </View>
  );
}

// ── Single exercise half (used for both single cards and each side of superset) ──

type ExerciseHalfProps = {
  exId: string;
  baseExId: string;
  anchorKey: string;
  prefix?: string; // "A" or "B" for superset, undefined for single
  input: InputState;
  sets: SetRow[];
  target: ExerciseTarget;
  lastSet: LastSetInfo | undefined;
  prBanner: string | undefined;
  coachHint: string | null;
  altList: string[];
  currentSetType: SetType;
  exerciseNote: string;
  isFocused: boolean;
  restEnabled: boolean;
  restRunning: boolean;
  restLabel: string;
  lastAddedSetId: string | null;
  lastAddedAnim: Animated.Value;
  onSetInput: (exId: string, field: keyof InputState, value: string) => void;
  onSetType: (exId: string, t: SetType) => void;
  onApplyWeightStep: (exId: string, delta: number) => void;
  onApplyLastSet: (exId: string) => void;
  onAddSet: (exId: string) => Promise<void>;
  onAddSetMultiple: (exId: string, count: number) => void;
  onEditSet: (row: SetRow) => void;
  onDeleteSet: (row: SetRow) => void;
  onFocusExercise: (exId: string) => void;
  onOpenAltPicker: (baseExId: string) => void;
  onRestToggle: () => void;
  onExerciseNoteChange: (exId: string, note: string) => void;
  onExerciseNoteBlur: (exId: string) => void;
  onOpenPlateCalc: (exId: string) => void;
};

function ExerciseHalf({
  exId,
  baseExId,
  anchorKey,
  prefix,
  input,
  sets,
  target,
  lastSet,
  prBanner,
  coachHint,
  altList,
  currentSetType,
  exerciseNote,
  isFocused,
  restEnabled,
  restRunning,
  restLabel,
  lastAddedSetId,
  lastAddedAnim,
  onSetInput,
  onSetType,
  onApplyWeightStep,
  onApplyLastSet,
  onAddSet,
  onAddSetMultiple,
  onEditSet,
  onDeleteSet,
  onFocusExercise,
  onOpenAltPicker,
  onRestToggle,
  onExerciseNoteChange,
  onExerciseNoteBlur,
  onOpenPlateCalc,
}: ExerciseHalfProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const [rpeHelperOpen, setRpeHelperOpen] = useState(false);

  const RPE_SCALE: { value: string; desc: string }[] = [
    { value: "6", desc: t("log.rpe6") },
    { value: "7", desc: t("log.rpe7") },
    { value: "8", desc: t("log.rpe8") },
    { value: "9", desc: t("log.rpe9") },
    { value: "10", desc: t("log.rpe10") },
  ];

  const inc = target.incrementKg;
  const incD = wu.toDisplay(inc);
  const steps = [-incD, incD, incD * 2];

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Text style={{ color: theme.text, fontSize: prefix ? undefined : theme.fontSize.md, fontWeight: prefix ? undefined : theme.fontWeight.semibold }}>
            {prefix ? `${prefix}: ` : ""}{displayNameFor(exId)}
          </Text>
          {(() => { const eq = getExercise(exId)?.equipment; return eq ? (
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{eq}</Text>
          ) : null; })()}
          <BackImpactDot exerciseId={exId} />
        </View>
        {altList.length ? (
          <Pressable
            onPress={() => onOpenAltPicker(baseExId)}
            style={{
              borderColor: theme.accent,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: theme.isDark ? "rgba(182, 104, 245, 0.15)" : "rgba(124, 58, 237, 0.08)",
            }}
          >
            <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11, fontWeight: theme.fontWeight.medium }}>ALT</Text>
          </Pressable>
        ) : null}
      </View>
      {baseExId !== exId ? (
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
          {t("log.alternativeFor", { name: displayNameFor(baseExId) })}
        </Text>
      ) : null}

      <View style={{ gap: 4 }}>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
          {t("log.target", { sets: target.targetSets, repMin: target.repMin, repMax: target.repMax, inc: formatWeight(wu.toDisplay(target.incrementKg)) })}
        </Text>
        {lastSet ? (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
            {t("log.lastSet", { weight: formatWeight(wu.toDisplay(lastSet.weight)), reps: lastSet.reps, date: lastSet.created_at ? lastSet.created_at.slice(0, 10) : "" })}
          </Text>
        ) : null}
        {coachHint ? (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
            {t("log.hintLabel", { hint: coachHint })}
          </Text>
        ) : null}
        {lastSet ? (
          <Pressable
            onPress={() => onApplyLastSet(exId)}
            style={{
              borderColor: theme.glassBorder,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: theme.glass,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>
              {t("log.useLast")}
            </Text>
          </Pressable>
        ) : null}
        {prBanner ? (
          <LinearGradient
            colors={theme.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: theme.radius.md,
              paddingHorizontal: 12,
              paddingVertical: 6,
              alignSelf: "flex-start",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontFamily: theme.mono, fontSize: 11, fontWeight: theme.fontWeight.semibold }}>
              {prBanner}
            </Text>
          </LinearGradient>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(["normal", "warmup", "dropset", "restpause"] as SetType[]).map((st) => (
          <Pressable
            key={`${anchorKey}_type_${prefix ?? "s"}_${st}`}
            onPress={() => onSetType(exId, st)}
            style={{
              borderColor: currentSetType === st ? theme.accent : theme.glassBorder,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: currentSetType === st ? (theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)") : theme.glass,
            }}
          >
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
              {st}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextField
        value={exerciseNote}
        onChangeText={(v) => onExerciseNoteChange(exId, v)}
        onBlur={() => onExerciseNoteBlur(exId)}
        onFocus={() => onFocusExercise(exId)}
        placeholder={t("log.notePlaceholder")}
        placeholderTextColor={theme.muted}
        style={{
          color: theme.text,
          backgroundColor: prefix ? theme.panel2 : theme.glass,
          borderColor: prefix ? theme.line : theme.glassBorder,
          borderWidth: 1,
          borderRadius: prefix ? 12 : theme.radius.md,
          padding: 10,
          fontFamily: theme.mono,
        }}
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", gap: 4, alignItems: "center" }}>
          <TextField
            value={input.weight}
            onChangeText={(v) => onSetInput(exId, "weight", v)}
            onFocus={() => onFocusExercise(exId)}
            placeholder={prefix ? wu.unitLabel().toLowerCase() : "0"}
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            suffix={prefix ? undefined : wu.unitLabel()}
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
          {!prefix && getExercise(exId)?.equipment === "barbell" ? (
            <Pressable
              onPress={() => onOpenPlateCalc(exId)}
              style={{ padding: 6 }}
            >
              <MaterialIcons name="view-week" size={20} color={theme.muted} />
            </Pressable>
          ) : null}
        </View>
        <TextField
          value={input.reps}
          onChangeText={(v) => onSetInput(exId, "reps", v)}
          onFocus={() => onFocusExercise(exId)}
          placeholder={prefix ? "reps" : "0"}
          placeholderTextColor={theme.muted}
          keyboardType="numeric"
          suffix={prefix ? undefined : "REPS"}
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
        <Pressable onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setRpeHelperOpen(true); }}>
          <TextField
            value={input.rpe}
            onChangeText={(v) => onSetInput(exId, "rpe", v)}
            onFocus={() => onFocusExercise(exId)}
            placeholder={prefix ? "rpe" : "0"}
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            suffix={prefix ? undefined : "RPE"}
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
        </Pressable>
      </View>

      {/* RPE helper modal */}
      <Modal visible={rpeHelperOpen} transparent animationType="fade">
        <Pressable
          onPress={() => setRpeHelperOpen(false)}
          style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", alignItems: "center" }}
        >
          <View
            style={{
              width: 280,
              backgroundColor: theme.modalGlass,
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: theme.glassBorder,
              padding: 20,
              gap: 6,
            }}
          >
            <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 16, marginBottom: 4 }}>
              RPE
            </Text>
            {RPE_SCALE.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => {
                  onSetInput(exId, "rpe", item.value);
                  setRpeHelperOpen(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: theme.radius.md,
                  backgroundColor: input.rpe === item.value
                    ? (theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.1)")
                    : pressed ? theme.glass : "transparent",
                })}
              >
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 16, width: 28, textAlign: "center" }}>
                  {item.value}
                </Text>
                <Text style={{ color: theme.text, fontSize: 13, fontFamily: theme.fontFamily.regular, flex: 1 }}>
                  {item.desc}
                </Text>
              </Pressable>
            ))}
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, marginTop: 4, textAlign: "center" }}>
              {t("log.rpeTapHint")}
            </Text>
          </View>
        </Pressable>
      </Modal>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {steps.map((step) => (
          <Pressable
            key={`${anchorKey}_${prefix ?? "s"}_${step}`}
            onPress={() => onApplyWeightStep(exId, step)}
            style={{
              borderColor: prefix ? theme.line : theme.glassBorder,
              borderWidth: 1,
              borderRadius: prefix ? 12 : theme.radius.md,
              paddingVertical: 6,
              paddingHorizontal: prefix ? 10 : 12,
              backgroundColor: prefix ? theme.panel2 : theme.glass,
            }}
          >
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
              {step > 0 ? "+" : ""}{formatWeight(step)}
            </Text>
          </Pressable>
        ))}
        <Btn label="+3" onPress={() => onAddSetMultiple(exId, 3)} />
      </View>

      {isFocused ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <RestTimerInline
            restEnabled={restEnabled}
            restRunning={restRunning}
            restLabel={restLabel}
            onToggle={onRestToggle}
          />
          <AddSetButton
            label={t("log.addSetBtn")}
            onPress={async () => {
              await onAddSet(exId);
            }}
          />
        </View>
      ) : null}

      <View style={{ gap: theme.space.sm }}>
        <SetTable
          sets={sets}
          lastAddedSetId={lastAddedSetId}
          lastAddedAnim={lastAddedAnim}
          onEditSet={onEditSet}
          onDeleteSet={onDeleteSet}
        />
      </View>
    </View>
  );
}

// ── Shared card callbacks type ──

export type ExerciseCardCallbacks = {
  onSetInput: (exId: string, field: keyof InputState, value: string) => void;
  onSetType: (exId: string, t: SetType) => void;
  onApplyWeightStep: (exId: string, delta: number) => void;
  onApplyLastSet: (exId: string) => void;
  onAddSet: (exId: string) => Promise<void>;
  onAddSetMultiple: (exId: string, count: number) => void;
  onEditSet: (row: SetRow) => void;
  onDeleteSet: (row: SetRow) => void;
  onFocusExercise: (exId: string) => void;
  onOpenAltPicker: (baseExId: string) => void;
  onRestToggle: () => void;
  onExerciseNoteChange: (exId: string, note: string) => void;
  onExerciseNoteBlur: (exId: string) => void;
  onOpenPlateCalc: (exId: string) => void;
};

// ── Single exercise card ──

export type SingleExerciseCardProps = ExerciseCardCallbacks & {
  exId: string;
  baseExId: string;
  anchorKey: string;
  input: InputState;
  sets: SetRow[];
  target: ExerciseTarget;
  lastSet: LastSetInfo | undefined;
  prBanner: string | undefined;
  coachHint: string | null;
  altList: string[];
  currentSetType: SetType;
  exerciseNote: string;
  isFocused: boolean;
  restEnabled: boolean;
  restRunning: boolean;
  restLabel: string;
  lastAddedSetId: string | null;
  lastAddedAnim: Animated.Value;
  onLayout: (e: any) => void;
};

export function SingleExerciseCard(props: SingleExerciseCardProps) {
  const theme = useTheme();

  return (
    <View
      onLayout={props.onLayout}
      style={{
        borderColor: theme.glassBorder,
        borderWidth: 1,
        borderRadius: theme.radius.xl,
        backgroundColor: theme.glass,
        padding: 16,
        gap: 12,
        shadowColor: theme.shadow.sm.color,
        shadowOpacity: theme.shadow.sm.opacity,
        shadowRadius: theme.shadow.sm.radius,
        shadowOffset: theme.shadow.sm.offset,
        elevation: theme.shadow.sm.elevation,
      }}
    >
      <ExerciseHalf
        exId={props.exId}
        baseExId={props.baseExId}
        anchorKey={props.anchorKey}
        input={props.input}
        sets={props.sets}
        target={props.target}
        lastSet={props.lastSet}
        prBanner={props.prBanner}
        coachHint={props.coachHint}
        altList={props.altList}
        currentSetType={props.currentSetType}
        exerciseNote={props.exerciseNote}
        isFocused={props.isFocused}
        restEnabled={props.restEnabled}
        restRunning={props.restRunning}
        restLabel={props.restLabel}
        lastAddedSetId={props.lastAddedSetId}
        lastAddedAnim={props.lastAddedAnim}
        onSetInput={props.onSetInput}
        onSetType={props.onSetType}
        onApplyWeightStep={props.onApplyWeightStep}
        onApplyLastSet={props.onApplyLastSet}
        onAddSet={props.onAddSet}
        onAddSetMultiple={props.onAddSetMultiple}
        onEditSet={props.onEditSet}
        onDeleteSet={props.onDeleteSet}
        onFocusExercise={props.onFocusExercise}
        onOpenAltPicker={props.onOpenAltPicker}
        onRestToggle={props.onRestToggle}
        onExerciseNoteChange={props.onExerciseNoteChange}
        onExerciseNoteBlur={props.onExerciseNoteBlur}
        onOpenPlateCalc={props.onOpenPlateCalc}
      />
    </View>
  );
}

// ── Superset card ──

export type SupersetCardProps = ExerciseCardCallbacks & {
  anchorKey: string;
  exIdA: string;
  exIdB: string;
  baseA: string;
  baseB: string;
  inputA: InputState;
  inputB: InputState;
  setsA: SetRow[];
  setsB: SetRow[];
  targetA: ExerciseTarget;
  targetB: ExerciseTarget;
  lastSetA: LastSetInfo | undefined;
  lastSetB: LastSetInfo | undefined;
  prBannerA: string | undefined;
  prBannerB: string | undefined;
  coachHintA: string | null;
  coachHintB: string | null;
  altListA: string[];
  altListB: string[];
  setTypeA: SetType;
  setTypeB: SetType;
  exerciseNoteA: string;
  exerciseNoteB: string;
  focusedExerciseId: string | null;
  restEnabled: boolean;
  restRunning: boolean;
  restLabel: string;
  lastAddedSetId: string | null;
  lastAddedAnim: Animated.Value;
  nextLabel: string;
  onLayout: (e: any) => void;
  onAddSuperset: () => void;
};

export function SupersetCard(props: SupersetCardProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View
      onLayout={props.onLayout}
      style={{
        borderColor: theme.glassBorder,
        borderWidth: 1,
        borderRadius: theme.radius.xl,
        backgroundColor: theme.glass,
        padding: 16,
        gap: 12,
        shadowColor: theme.shadow.sm.color,
        shadowOpacity: theme.shadow.sm.opacity,
        shadowRadius: theme.shadow.sm.radius,
        shadowOffset: theme.shadow.sm.offset,
        elevation: theme.shadow.sm.elevation,
      }}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono }}>{t("log.superset")}</Text>

      <View style={{ gap: 10 }}>
        <ExerciseHalf
          exId={props.exIdA}
          baseExId={props.baseA}
          anchorKey={props.anchorKey}
          prefix="A"
          input={props.inputA}
          sets={props.setsA}
          target={props.targetA}
          lastSet={props.lastSetA}
          prBanner={props.prBannerA}
          coachHint={props.coachHintA}
          altList={props.altListA}
          currentSetType={props.setTypeA}
          exerciseNote={props.exerciseNoteA}
          isFocused={props.focusedExerciseId === props.exIdA}
          restEnabled={props.restEnabled}
          restRunning={props.restRunning}
          restLabel={props.restLabel}
          lastAddedSetId={props.lastAddedSetId}
          lastAddedAnim={props.lastAddedAnim}
          onSetInput={props.onSetInput}
          onSetType={props.onSetType}
          onApplyWeightStep={props.onApplyWeightStep}
          onApplyLastSet={props.onApplyLastSet}
          onAddSet={props.onAddSet}
          onAddSetMultiple={props.onAddSetMultiple}
          onEditSet={props.onEditSet}
          onDeleteSet={props.onDeleteSet}
          onFocusExercise={props.onFocusExercise}
          onOpenAltPicker={props.onOpenAltPicker}
          onRestToggle={props.onRestToggle}
          onExerciseNoteChange={props.onExerciseNoteChange}
          onExerciseNoteBlur={props.onExerciseNoteBlur}
          onOpenPlateCalc={props.onOpenPlateCalc}
        />

        <ExerciseHalf
          exId={props.exIdB}
          baseExId={props.baseB}
          anchorKey={props.anchorKey}
          prefix="B"
          input={props.inputB}
          sets={props.setsB}
          target={props.targetB}
          lastSet={props.lastSetB}
          prBanner={props.prBannerB}
          coachHint={props.coachHintB}
          altList={props.altListB}
          currentSetType={props.setTypeB}
          exerciseNote={props.exerciseNoteB}
          isFocused={props.focusedExerciseId === props.exIdB}
          restEnabled={props.restEnabled}
          restRunning={props.restRunning}
          restLabel={props.restLabel}
          lastAddedSetId={props.lastAddedSetId}
          lastAddedAnim={props.lastAddedAnim}
          onSetInput={props.onSetInput}
          onSetType={props.onSetType}
          onApplyWeightStep={props.onApplyWeightStep}
          onApplyLastSet={props.onApplyLastSet}
          onAddSet={props.onAddSet}
          onAddSetMultiple={props.onAddSetMultiple}
          onEditSet={props.onEditSet}
          onDeleteSet={props.onDeleteSet}
          onFocusExercise={props.onFocusExercise}
          onOpenAltPicker={props.onOpenAltPicker}
          onRestToggle={props.onRestToggle}
          onExerciseNoteChange={props.onExerciseNoteChange}
          onExerciseNoteBlur={props.onExerciseNoteBlur}
          onOpenPlateCalc={props.onOpenPlateCalc}
        />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
          {t("log.nextLabel", { label: props.nextLabel })}
        </Text>
        <Btn label="+" onPress={props.onAddSuperset} tone="accent" />
      </View>
    </View>
  );
}

export default SingleExerciseCard;
