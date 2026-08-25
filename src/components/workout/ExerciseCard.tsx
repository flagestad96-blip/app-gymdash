// src/components/workout/ExerciseCard.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, Modal, LayoutAnimation } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import { TextField, Btn } from "../../ui";
import { formatWeight, parseDecimal } from "../../format";
import { epley1RM } from "../../metrics";
import { displayNameFor, getExercise, isPerSideExercise, type Equipment } from "../../exerciseLibrary";
import BackImpactDot from "../BackImpactDot";
import type { SetRow } from "./SetEntryRow";
import AddSetButton from "./AddSetButton";
import SetTable from "./SetTable";
import { warmupRamp, barWeightForEquipment } from "../../warmupRamp";
import { SLOT_COLORS, SLOT_LABELS, workingCount, type SupersetSlotKey, type SupersetLogPhase } from "./superset";
export type { SupersetSlotKey, SupersetLogPhase };
import type { ExerciseTarget } from "../../progressionStore";
import { getRecentSessions, type ExerciseSession } from "../../exerciseHistory";

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
  fromOtherGym?: boolean;
};


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
  exerciseNote: string;
  isFocused: boolean;
  hideAddSetButton?: boolean; // Hide the per-half "Add set" button (used in supersets — shared bottom button is the canonical action)
  lastAddedSetId: string | null;
  lastAddedAnim: Animated.Value;
  onLogWarmupSet: (exId: string, weightKg: number, reps: number) => void;
  /** Skipped-this-session state for single cards (undefined = not skipped). */
  skippedReason?: string;
  onSkipExercise?: (exId: string) => void;
  onUndoSkip?: (exId: string) => void;
  onSetInput: (exId: string, field: keyof InputState, value: string) => void;
  onApplyWeightStep: (exId: string, delta: number) => void;
  onApplyLastSet: (exId: string) => void;
  onAddSet: (exId: string) => Promise<unknown>;
  onAddSetMultiple: (exId: string, count: number) => void;
  onEditSet: (row: SetRow) => void;
  onDeleteSet: (row: SetRow) => void;
  onFocusExercise: (exId: string) => void;
  onOpenAltPicker: (baseExId: string) => void;
  onSetAsDefault?: (baseExId: string, newDefaultExId: string) => void;
  onExerciseNoteChange: (exId: string, note: string) => void;
  onExerciseNoteBlur: (exId: string) => void;
  onSetGoal: (exId: string) => void;
  onOpenPlateCalc: (exId: string) => void;
  onCreateSuperset?: (baseExId: string) => void;
  /** Reduced start weight (kg) after a training break — renders a quick-apply pill. */
  comebackWeightKg?: number;
  workoutId: string | null;
  exerciseIndex: number;
  gymId?: string | null;
  gymEquipment?: Set<Equipment> | null;
  activeGoalLabel?: string;
  isAdHoc?: boolean;
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
  exerciseNote,
  isFocused,
  hideAddSetButton,
  lastAddedSetId,
  lastAddedAnim,
  onSetInput,
  onApplyWeightStep,
  onApplyLastSet,
  onAddSet,
  onAddSetMultiple,
  onLogWarmupSet,
  skippedReason,
  onSkipExercise,
  onUndoSkip,
  onEditSet,
  onDeleteSet,
  onFocusExercise,
  onOpenAltPicker,
  onSetAsDefault,
  onExerciseNoteChange,
  onExerciseNoteBlur,
  onSetGoal,
  onOpenPlateCalc,
  onCreateSuperset,
  comebackWeightKg,
  workoutId,
  exerciseIndex,
  gymId,
  gymEquipment,
  activeGoalLabel,
  isAdHoc,
}: ExerciseHalfProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const router = useRouter();
  const [rpeHelperOpen, setRpeHelperOpen] = useState(false);
  const [noteExpanded, setNoteExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySessions, setHistorySessions] = useState<ExerciseSession[] | null>(null);
  const [warmupOpen, setWarmupOpen] = useState(false);

  const toggleHistory = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (!historyOpen && !historySessions) {
      getRecentSessions(exId, workoutId, 5, gymId).then(setHistorySessions);
    }
    setHistoryOpen((prev) => !prev);
  };

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

  // Warm-up ramp for today's working weight: typed input first, then the
  // comeback suggestion, then last session's weight.
  const rampWorkingKg = useMemo(() => {
    const typed = parseDecimal(input.weight);
    if (Number.isFinite(typed) && typed > 0) return wu.toKg(typed);
    if (comebackWeightKg != null && comebackWeightKg > 0) return comebackWeightKg;
    if (lastSet && lastSet.weight > 0) return lastSet.weight;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.weight, comebackWeightKg, lastSet, wu.unit]);
  const warmupSteps = useMemo(() => {
    if (rampWorkingKg == null) return [];
    return warmupRamp(rampWorkingKg, {
      incrementKg: inc,
      barWeightKg: barWeightForEquipment(getExercise(exId)?.equipment),
    });
  }, [rampWorkingKg, inc, exId]);

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" }}>
          <Text
            style={{ color: theme.text, fontSize: prefix ? undefined : theme.fontSize.md, fontWeight: prefix ? undefined : theme.fontWeight.semibold }}
            numberOfLines={2}
          >
            {prefix ? `${prefix}: ` : ""}{displayNameFor(exId)}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {(() => { const eq = getExercise(exId)?.equipment; return eq ? (
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>{eq}</Text>
            ) : null; })()}
            <BackImpactDot exerciseId={exId} />
            {isAdHoc ? (
              <View style={{
                backgroundColor: theme.isDark ? "rgba(249, 115, 22, 0.18)" : "rgba(249, 115, 22, 0.12)",
                borderColor: theme.warn,
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 1,
              }}>
                <Text style={{ color: theme.warn, fontFamily: theme.mono, fontSize: 9 }}>
                  {t("log.extraExercise")}
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={() => onSetGoal(exId)}
              hitSlop={8}
            >
              <MaterialIcons
                name="flag"
                size={16}
                color={activeGoalLabel ? theme.accent : theme.muted}
                style={{ opacity: activeGoalLabel ? 1 : 0.4 }}
              />
            </Pressable>
            <Pressable
              onPress={() => setNoteExpanded((p) => !p)}
              onLongPress={() => setNoteExpanded(true)}
              hitSlop={8}
            >
              <MaterialIcons
                name="lightbulb-outline"
                size={16}
                color={exerciseNote ? theme.accent : theme.muted}
                style={{ opacity: exerciseNote ? 1 : 0.4 }}
              />
            </Pressable>
          </View>
        </View>
        {altList.length || onCreateSuperset ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            {baseExId !== exId && onSetAsDefault ? (
              <Pressable
                onPress={() => {
                  onSetAsDefault(baseExId, exId);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                style={{
                  borderColor: theme.accent,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  // Solid accent fill — translucent tints wash out against the
                  // aurora background (the old success-on-green pill was
                  // unreadable on the sunset palette).
                  backgroundColor: theme.accent,
                }}
              >
                <Text style={{ color: "#05070f", fontFamily: theme.mono, fontSize: 11, fontWeight: theme.fontWeight.semibold }}>{t("log.setAsDefault")}</Text>
              </Pressable>
            ) : null}
            {onCreateSuperset ? (
              <Pressable
                onPress={() => onCreateSuperset(baseExId)}
                accessibilityRole="button"
                accessibilityLabel={t("log.createSuperset")}
                style={{
                  borderColor: theme.accent,
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: theme.accent + "26",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MaterialIcons name="add-link" size={16} color={theme.accent} />
              </Pressable>
            ) : null}
            {altList.length ? (
              <Pressable
                onPress={() => onOpenAltPicker(baseExId)}
                style={{
                  borderColor: theme.accent,
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: theme.accent + "26",
                }}
              >
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11, fontWeight: theme.fontWeight.medium }}>ALT</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      {baseExId !== exId ? (
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
          {t("log.alternativeFor", { name: displayNameFor(baseExId) })}
        </Text>
      ) : null}
      {(() => {
        if (!gymEquipment) return null;
        const eq = getExercise(exId)?.equipment as Equipment | undefined;
        if (!eq || gymEquipment.has(eq)) return null;
        return (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, opacity: 0.6 }}>
            {t("gym.notAtThisGym")}
          </Text>
        );
      })()}

      <View style={{ gap: 4 }}>
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
          {t("log.target", { sets: target.targetSets, repMin: target.repMin, repMax: target.repMax, inc: formatWeight(wu.toDisplay(target.incrementKg)) })}
        </Text>
        {(() => {
          const workingSets = sets.filter(s => !s.is_warmup).length;
          const planned = target.targetSets;
          if (planned <= 0) {
            return workingSets > 0 ? (
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                {workingSets} {t("common.sets").toLowerCase()}
              </Text>
            ) : null;
          }
          const isComplete = workingSets >= planned;
          const bonusCount = Math.max(0, workingSets - planned);
          return (
            <Text style={{ color: isComplete ? theme.success : theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
              {isComplete
                ? bonusCount > 0
                  ? `\u2713 ${t("log.setsComplete")} + ${bonusCount} ${t("log.bonusSet")}`
                  : `\u2713 ${t("log.setsComplete")}`
                : t("log.setsProgress", { done: String(workingSets), total: String(planned) })}
            </Text>
          );
        })()}
        {activeGoalLabel ? (
          <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>
            {activeGoalLabel}
          </Text>
        ) : null}
        {lastSet ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, flex: 1 }}>
                {t("log.lastSet", { weight: formatWeight(wu.toDisplay(lastSet.weight)), reps: lastSet.reps, date: lastSet.created_at ? lastSet.created_at.slice(0, 10) : "" })}
              </Text>
              <Pressable onPress={toggleHistory} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <MaterialIcons name="history" size={14} color={theme.accent} />
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>
                  {historyOpen ? t("log.hideHistory") : t("log.showHistory")}
                </Text>
              </Pressable>
            </View>
            {lastSet.fromOtherGym ? (
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, opacity: 0.7 }}>
                {t("gym.fromOtherGym")}
              </Text>
            ) : null}
          </>
        ) : null}
        {historyOpen && (
          <View style={{ gap: 6, paddingTop: 2 }}>
            {(() => {
              // Estimated rep-maxes (Epley) from the best working set in the
              // fetched sessions \u2014 helps pick loads for other rep ranges.
              if (!historySessions || historySessions.length === 0) return null;
              let bestE1 = 0;
              for (const sess of historySessions) {
                for (const s of sess.sets) {
                  if (s.isWarmup || !(s.weight > 0) || !(s.reps > 0)) continue;
                  const e = epley1RM(s.weight, s.reps);
                  if (e > bestE1) bestE1 = e;
                }
              }
              if (bestE1 <= 0) return null;
              const est = (reps: number) => formatWeight(wu.toDisplay(bestE1 / (1 + reps / 30)));
              return (
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>
                  {t("log.estRepMaxes", { r3: est(3), r5: est(5), r10: est(10), unit: wu.unitLabel() })}
                </Text>
              );
            })()}
            {historySessions === null ? (
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>...</Text>
            ) : historySessions.length === 0 ? (
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{t("log.noHistoryFound")}</Text>
            ) : (
              historySessions.map((session) => {
                const [, mo, da] = session.date.split("-");
                const dateLabel = `${parseInt(da)}.${parseInt(mo)}`;
                // Warmups are shown in the sets line but never picked as "best".
                const workingSets = session.sets.filter((s) => !s.isWarmup);
                const displaySets = workingSets.length > 0 ? workingSets : session.sets;
                if (displaySets.length === 0) return null;
                const best = displaySets.reduce((a, b) => (a.weight * a.reps >= b.weight * b.reps ? a : b));
                const setsLine = displaySets.map((s) => `${formatWeight(wu.toDisplay(s.weight))}\u00d7${s.reps}`).join(", ");
                const orderDiffers = session.exerciseOrder !== exerciseIndex;
                return (
                  <View key={session.workoutId} style={{ gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 11 }}>{dateLabel}</Text>
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                        {t("log.setsCount", { n: String(displaySets.length) })}
                      </Text>
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                        {t("log.bestSet", { weight: formatWeight(wu.toDisplay(best.weight)), reps: String(best.reps) })}
                      </Text>
                      {orderDiffers && (
                        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
                          {"\u2195"} {t("log.differentOrder")}
                        </Text>
                      )}
                    </View>
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, opacity: 0.7 }}>
                      {setsLine}
                    </Text>
                  </View>
                );
              })
            )}
            {historySessions && historySessions.length > 0 ? (
              <Pressable
                onPress={() => router.push({ pathname: "/history", params: { exerciseId: exId } })}
                accessibilityRole="button"
                hitSlop={8}
                style={{ alignSelf: "flex-start", paddingVertical: 4 }}
              >
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>
                  {t("log.fullHistory")} {"→"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
        {coachHint ? (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
            {t("log.hintLabel", { hint: coachHint })}
          </Text>
        ) : null}
        {skippedReason !== undefined ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderColor: theme.warn,
              borderWidth: 1,
              borderRadius: theme.radius.md,
              padding: 10,
              backgroundColor: theme.warn + "14",
            }}
          >
            <MaterialIcons name="skip-next" size={18} color={theme.warn} />
            <Text style={{ color: theme.warn, fontSize: 12, flex: 1 }} numberOfLines={2}>
              {skippedReason
                ? t("log.skippedWithReason", { reason: skippedReason })
                : t("log.skippedNoReason")}
            </Text>
            {onUndoSkip ? (
              <Pressable onPress={() => onUndoSkip(exId)} hitSlop={8} accessibilityRole="button">
                <Text style={{ color: theme.warn, fontFamily: theme.fontFamily.semibold, fontSize: 12 }}>
                  {t("log.undo")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {onSkipExercise && skippedReason === undefined ? (
          <Pressable
            onPress={() => onSkipExercise(exId)}
            accessibilityRole="button"
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
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
              {t("log.skipExercise")}
            </Text>
          </Pressable>
        ) : null}
        {warmupSteps.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setWarmupOpen((prev) => !prev);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: warmupOpen }}
              style={{
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor: theme.glass,
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                {warmupOpen ? "\u25BE" : "\u25B8"} {t("log.warmupRamp")}
              </Text>
            </Pressable>
            {warmupOpen
              ? warmupSteps.map((step, i) => (
                  <View
                    key={`wu_${i}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderColor: theme.glassBorder,
                      borderWidth: 1,
                      borderRadius: theme.radius.md,
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      backgroundColor: theme.glass,
                    }}
                  >
                    <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: theme.fontSize.sm }}>
                      {step.isBar
                        ? t("log.warmupBarStep", { weight: `${formatWeight(wu.toDisplay(step.weightKg))} ${wu.unitLabel()}` })
                        : `${formatWeight(wu.toDisplay(step.weightKg))} ${wu.unitLabel()}`}
                      {" \u00D7 "}
                      {step.reps}
                    </Text>
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        onLogWarmupSet(exId, step.weightKg, step.reps);
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => ({
                        borderColor: theme.accent,
                        borderWidth: 1,
                        borderRadius: 999,
                        paddingHorizontal: 14,
                        paddingVertical: 4,
                        opacity: pressed ? 0.7 : 1,
                      })}
                    >
                      <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>
                        {t("log.warmupLogStep")}
                      </Text>
                    </Pressable>
                  </View>
                ))
              : null}
          </View>
        ) : null}
        {lastSet || comebackWeightKg != null ? (
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {comebackWeightKg != null ? (
              <Pressable
                onPress={() => {
                  onSetInput(exId, "weight", formatWeight(wu.toDisplay(comebackWeightKg)));
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={{
                  borderColor: theme.accent,
                  borderWidth: 1,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: theme.accent + "26",
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 11 }}>
                  {t("log.advice.useComebackWeight", { weight: `${formatWeight(wu.toDisplay(comebackWeightKg))} ${wu.unitLabel()}` })}
                </Text>
              </Pressable>
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
          </View>
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

      {(noteExpanded || exerciseNote) ? (
        <TextField
          value={exerciseNote}
          onChangeText={(v) => onExerciseNoteChange(exId, v)}
          onBlur={() => { onExerciseNoteBlur(exId); if (!exerciseNote) setNoteExpanded(false); }}
          onFocus={() => onFocusExercise(exId)}
          placeholder={t("exerciseNotes.placeholder")}
          placeholderTextColor={theme.muted}
          multiline
          style={{
            color: theme.text,
            backgroundColor: prefix ? theme.panel2 : theme.glass,
            borderColor: prefix ? theme.line : theme.glassBorder,
            borderWidth: 1,
            borderRadius: prefix ? 12 : theme.radius.md,
            padding: 10,
            fontSize: 13,
            fontFamily: theme.mono,
            fontStyle: "italic",
          }}
        />
      ) : null}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", gap: 4, alignItems: "center" }}>
          <TextField
            value={input.weight}
            onChangeText={(v) => onSetInput(exId, "weight", v)}
            onFocus={() => onFocusExercise(exId)}
            placeholder={prefix ? wu.unitLabel().toLowerCase() : "0"}
            placeholderTextColor={theme.muted}
            keyboardType="numeric"
            suffix={prefix ? undefined : (isPerSideExercise(exId) ? `${wu.unitLabel()} each` : wu.unitLabel())}
            style={{
              flex: 1,
              color: theme.text,
              backgroundColor: theme.panel2,
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: 12,
              padding: 10,
              fontSize: 15,
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
            fontSize: 15,
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
              fontSize: 15,
              fontFamily: theme.mono,
            }}
          />
        </Pressable>
      </View>
      {isPerSideExercise(exId) ? (
        <Text style={{
          color: theme.muted,
          fontFamily: theme.mono,
          fontSize: 10,
          marginTop: 1,
          opacity: 0.85,
        }}>
          {t("log.perSideHint")}
        </Text>
      ) : null}
      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, textAlign: "right", marginTop: 2, opacity: 0.85 }}>
        {t("log.rpeHoldHint")}
      </Text>

      {/* RPE helper modal */}
      <Modal visible={rpeHelperOpen} transparent animationType="fade" onRequestClose={() => setRpeHelperOpen(false)}>
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
                    ? theme.accent + "2E"
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

      {isFocused && !hideAddSetButton ? (
        <AddSetButton
          label={t("log.addSetBtn")}
          onPress={async () => {
            await onAddSet(exId);
          }}
        />
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
  onLogWarmupSet: (exId: string, weightKg: number, reps: number) => void;
  onSkipExercise?: (exId: string) => void;
  onUndoSkip?: (exId: string) => void;
  onApplyWeightStep: (exId: string, delta: number) => void;
  onApplyLastSet: (exId: string) => void;
  onAddSet: (exId: string) => Promise<unknown>;
  onAddSetMultiple: (exId: string, count: number) => void;
  onEditSet: (row: SetRow) => void;
  onDeleteSet: (row: SetRow) => void;
  onFocusExercise: (exId: string) => void;
  onOpenAltPicker: (baseExId: string) => void;
  onSetAsDefault?: (baseExId: string, newDefaultExId: string) => void;
  onActivateExercise: (exId: string) => void;
  onExerciseNoteChange: (exId: string, note: string) => void;
  onExerciseNoteBlur: (exId: string) => void;
  onOpenPlateCalc: (exId: string) => void;
  onSetGoal: (exId: string) => void;
};

// ── Single exercise card ──

export type SingleExerciseCardProps = ExerciseCardCallbacks & {
  exId: string;
  baseExId: string;
  anchorKey: string;
  skippedReason?: string;
  input: InputState;
  sets: SetRow[];
  target: ExerciseTarget;
  lastSet: LastSetInfo | undefined;
  prBanner: string | undefined;
  coachHint: string | null;
  altList: string[];
  exerciseNote: string;
  isFocused: boolean;
  lastAddedSetId: string | null;
  lastAddedAnim: Animated.Value;
  onLayout: (e: any) => void;
  onCreateSuperset?: (baseExId: string) => void;
  comebackWeightKg?: number;
  workoutId: string | null;
  exerciseIndex: number;
  gymId?: string | null;
  gymEquipment?: Set<Equipment> | null;
  activeGoalLabel?: string;
  isAdHoc?: boolean;
};

function FocusGlow({ borderRadius, isDark }: { borderRadius: number; isDark: boolean }) {
  const base = isDark ? "rgba(192, 128, 252," : "rgba(124, 58, 237,";
  return (
    <>
      <View style={{ position: "absolute", top: -10, left: -10, right: -10, bottom: -10, borderRadius: borderRadius + 10, backgroundColor: base + " 0.06)" }} />
      <View style={{ position: "absolute", top: -6, left: -6, right: -6, bottom: -6, borderRadius: borderRadius + 6, backgroundColor: base + " 0.09)" }} />
      <View style={{ position: "absolute", top: -3, left: -3, right: -3, bottom: -3, borderRadius: borderRadius + 3, backgroundColor: base + " 0.12)" }} />
    </>
  );
}

export function SingleExerciseCard(props: SingleExerciseCardProps) {
  const theme = useTheme();
  const exEquipment = getExercise(props.exId)?.equipment as Equipment | undefined;
  const equipmentUnavailable =
    props.gymEquipment != null &&
    exEquipment != null &&
    !props.gymEquipment.has(exEquipment);

  return (
    <View onLayout={props.onLayout} style={{ position: "relative", opacity: equipmentUnavailable ? 0.4 : 1 }}>
      {props.isFocused && <FocusGlow borderRadius={theme.radius.xl} isDark={theme.isDark} />}
      <Pressable
        onPress={() => props.onActivateExercise(props.exId)}
        style={{
          borderColor: props.isFocused ? theme.accent : theme.glassBorder,
          borderWidth: 1,
          borderRadius: theme.radius.xl,
          backgroundColor: theme.glass,
          padding: 16,
          gap: 12,
          shadowColor: props.isFocused ? theme.accent : theme.shadow.sm.color,
          shadowOpacity: props.isFocused ? 0.45 : theme.shadow.sm.opacity,
          shadowRadius: props.isFocused ? 16 : theme.shadow.sm.radius,
          shadowOffset: props.isFocused ? { width: 0, height: 0 } : theme.shadow.sm.offset,
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
        exerciseNote={props.exerciseNote}
        isFocused={props.isFocused}
        lastAddedSetId={props.lastAddedSetId}
        lastAddedAnim={props.lastAddedAnim}
        onSetInput={props.onSetInput}
        onApplyWeightStep={props.onApplyWeightStep}
        onApplyLastSet={props.onApplyLastSet}
        onAddSet={props.onAddSet}
        onAddSetMultiple={props.onAddSetMultiple}
        onEditSet={props.onEditSet}
        onDeleteSet={props.onDeleteSet}
        onFocusExercise={props.onFocusExercise}
        onOpenAltPicker={props.onOpenAltPicker}
        onSetAsDefault={props.onSetAsDefault}
        onExerciseNoteChange={props.onExerciseNoteChange}
        onExerciseNoteBlur={props.onExerciseNoteBlur}
        onSetGoal={props.onSetGoal}
        onOpenPlateCalc={props.onOpenPlateCalc}
        onLogWarmupSet={props.onLogWarmupSet}
        skippedReason={props.skippedReason}
        onSkipExercise={props.onSkipExercise}
        onUndoSkip={props.onUndoSkip}
        onCreateSuperset={props.onCreateSuperset}
        comebackWeightKg={props.comebackWeightKg}
        workoutId={props.workoutId}
        exerciseIndex={props.exerciseIndex}
        gymId={props.gymId}
        gymEquipment={props.gymEquipment}
        activeGoalLabel={props.activeGoalLabel}
        isAdHoc={props.isAdHoc}
      />
    </Pressable>
    </View>
  );
}

// ── Superset round-card ──

type SlotInfo = {
  key: SupersetSlotKey;
  exId: string;
  baseExId: string;
  input: InputState;
  sets: SetRow[];
  target: ExerciseTarget;
  lastSet: LastSetInfo | undefined;
  prBanner: string | undefined;
  coachHint: string | null;
  altList: string[];
  exerciseNote: string;
  activeGoalLabel?: string;
};

type CollapsedSlotRowProps = {
  slot: SlotInfo;
  workingSets: number;
  done: boolean;
  isSkippedThisRound: boolean;
  isDropped: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

function CollapsedSlotRow({ slot, workingSets, done, isSkippedThisRound, isDropped, onPress, onLongPress }: CollapsedSlotRowProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const slotColor = SLOT_COLORS[slot.key];
  const planned = slot.target.targetSets;
  const last = slot.lastSet;
  const lastSummary = last ? `${formatWeight(wu.toDisplay(last.weight))}×${last.reps}` : null;
  const dimmed = isDropped || done;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 14,
        backgroundColor: pressed ? theme.glass : theme.panel2,
        borderWidth: 1,
        borderColor: theme.line,
        opacity: dimmed ? 0.55 : 1,
      })}
    >
      <View
        style={{
          width: 4,
          alignSelf: "stretch",
          borderRadius: 2,
          backgroundColor: slotColor,
          opacity: isDropped ? 0.3 : 1,
        }}
      />
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: slotColor,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDropped ? 0.3 : 1,
        }}
      >
        <Text style={{ color: "#FFFFFF", fontFamily: theme.mono, fontSize: 11, fontWeight: theme.fontWeight.semibold }}>
          {SLOT_LABELS[slot.key]}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            color: theme.text,
            fontFamily: theme.fontFamily.medium,
            fontSize: 13,
            textDecorationLine: isDropped ? "line-through" : "none",
          }}
        >
          {displayNameFor(slot.exId)}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, marginTop: 1 }}
        >
          {isDropped
            ? t("log.supersetDroppedHint")
            : isSkippedThisRound
              ? t("log.supersetSkippedHint", { n: String(workingSets + 1) })
              : lastSummary
                ? `${t("log.lastSet", { weight: formatWeight(wu.toDisplay(last!.weight)), reps: last!.reps, date: "" }).replace(/\(\)\s*$/, "").trim()}`
                : t("log.supersetCollapsedHint")}
        </Text>
      </View>
      {planned > 0 ? (
        <Text style={{ color: done ? theme.success : theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
          {done ? `✓ ${t("log.supersetSlotProgress", { done: String(workingSets), total: String(planned) })}` : t("log.supersetSlotProgress", { done: String(workingSets), total: String(planned) })}
        </Text>
      ) : workingSets > 0 ? (
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>{workingSets}</Text>
      ) : null}
    </Pressable>
  );
}

type SlotContextAction =
  | { type: "skip" }
  | { type: "drop" }
  | { type: "bonus" }
  | { type: "alt" }
  | { type: "undoSkip" }
  | { type: "undoDrop" };

type SlotContextMenuProps = {
  visible: boolean;
  slot: SupersetSlotKey | null;
  exId: string | null;
  isSkippedThisRound: boolean;
  isDropped: boolean;
  hasAlt: boolean;
  onClose: () => void;
  onChoose: (action: SlotContextAction) => void;
};

function SlotContextMenu({ visible, slot, exId, isSkippedThisRound, isDropped, hasAlt, onClose, onChoose }: SlotContextMenuProps) {
  const theme = useTheme();
  const { t } = useI18n();
  if (!slot || !exId) return null;
  const slotLabel = SLOT_LABELS[slot];
  const items: { label: string; action: SlotContextAction; danger?: boolean }[] = [];
  if (isDropped) {
    items.push({ label: t("log.supersetActionUndoSkip", { slot: slotLabel }), action: { type: "undoDrop" } });
  } else {
    if (!isSkippedThisRound) {
      items.push({ label: t("log.supersetActionSkipRound", { slot: slotLabel }), action: { type: "skip" } });
    } else {
      items.push({ label: t("log.supersetActionUndoSkip", { slot: slotLabel }), action: { type: "undoSkip" } });
    }
    items.push({ label: t("log.supersetActionBonusSet", { slot: slotLabel }), action: { type: "bonus" } });
    if (hasAlt) {
      items.push({ label: t("log.supersetActionSwapAlt", { slot: slotLabel }), action: { type: "alt" } });
    }
    items.push({ label: t("log.supersetActionDropExercise", { slot: slotLabel }), action: { type: "drop" }, danger: true });
  }
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: theme.modalGlass,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            borderTopWidth: 1,
            borderColor: theme.glassBorder,
            padding: 16,
            paddingBottom: 28,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 8 }}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: SLOT_COLORS[slot],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontFamily: theme.mono, fontSize: 12, fontWeight: theme.fontWeight.semibold }}>
                {slotLabel}
              </Text>
            </View>
            <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 15, flex: 1 }} numberOfLines={1}>
              {displayNameFor(exId)}
            </Text>
          </View>
          {items.map((item, idx) => (
            <Pressable
              key={`ctx_${idx}`}
              onPress={() => { onChoose(item.action); onClose(); }}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 14,
                borderRadius: theme.radius.md,
                backgroundColor: pressed ? theme.glass : "transparent",
                borderWidth: 1,
                borderColor: theme.glassBorder,
              })}
            >
              <Text style={{ color: item.danger ? theme.danger : theme.text, fontFamily: theme.fontFamily.medium, fontSize: 14 }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type SupersetLogArgs = {
  slot: SupersetSlotKey;
  exId: string;
  phase: SupersetLogPhase;
  roundNum: number;
  totalRounds: number;
  isBonus: boolean;
};

export type SupersetCardProps = ExerciseCardCallbacks & {
  anchorKey: string;
  exIdA: string;
  exIdB: string;
  exIdC?: string;
  baseA: string;
  baseB: string;
  baseC?: string;
  inputA: InputState;
  inputB: InputState;
  inputC?: InputState;
  setsA: SetRow[];
  setsB: SetRow[];
  setsC?: SetRow[];
  targetA: ExerciseTarget;
  targetB: ExerciseTarget;
  targetC?: ExerciseTarget;
  lastSetA: LastSetInfo | undefined;
  lastSetB: LastSetInfo | undefined;
  lastSetC?: LastSetInfo | undefined;
  prBannerA: string | undefined;
  prBannerB: string | undefined;
  prBannerC?: string | undefined;
  coachHintA: string | null;
  coachHintB: string | null;
  coachHintC?: string | null;
  altListA: string[];
  altListB: string[];
  altListC?: string[];
  exerciseNoteA: string;
  exerciseNoteB: string;
  exerciseNoteC?: string;
  focusedExerciseId: string | null;
  lastAddedSetId: string | null;
  lastAddedAnim: Animated.Value;
  onLayout: (e: any) => void;
  onLogRoundSet: (args: SupersetLogArgs) => Promise<void> | void;
  /** Splits the group into singles: removes a manual (mid-session) superset,
   *  or splits a program superset for the rest of this session only. */
  onUngroup?: () => void;
  /** Rotates the slot order (A/B → B/A) for this session. */
  onRotate?: () => void;
  workoutId: string | null;
  exerciseIndex: number;
  gymId?: string | null;
  gymEquipment?: Set<Equipment> | null;
  activeGoalLabelA?: string;
  activeGoalLabelB?: string;
  activeGoalLabelC?: string;
};


export function SupersetCard(props: SupersetCardProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const hasC = !!props.exIdC && !!props.baseC && !!props.targetC;

  const slots: SlotInfo[] = useMemo(() => {
    const arr: SlotInfo[] = [
      {
        key: "a",
        exId: props.exIdA,
        baseExId: props.baseA,
        input: props.inputA,
        sets: props.setsA,
        target: props.targetA,
        lastSet: props.lastSetA,
        prBanner: props.prBannerA,
        coachHint: props.coachHintA,
        altList: props.altListA,
        exerciseNote: props.exerciseNoteA,
        activeGoalLabel: props.activeGoalLabelA,
      },
      {
        key: "b",
        exId: props.exIdB,
        baseExId: props.baseB,
        input: props.inputB,
        sets: props.setsB,
        target: props.targetB,
        lastSet: props.lastSetB,
        prBanner: props.prBannerB,
        coachHint: props.coachHintB,
        altList: props.altListB,
        exerciseNote: props.exerciseNoteB,
        activeGoalLabel: props.activeGoalLabelB,
      },
    ];
    if (hasC) {
      arr.push({
        key: "c",
        exId: props.exIdC!,
        baseExId: props.baseC!,
        input: props.inputC ?? { weight: "", reps: "", rpe: "" },
        sets: props.setsC ?? [],
        target: props.targetC!,
        lastSet: props.lastSetC,
        prBanner: props.prBannerC,
        coachHint: props.coachHintC ?? null,
        altList: props.altListC ?? [],
        exerciseNote: props.exerciseNoteC ?? "",
        activeGoalLabel: props.activeGoalLabelC,
      });
    }
    return arr;
  }, [hasC, props.exIdA, props.exIdB, props.exIdC, props.baseA, props.baseB, props.baseC, props.inputA, props.inputB, props.inputC, props.setsA, props.setsB, props.setsC, props.targetA, props.targetB, props.targetC, props.lastSetA, props.lastSetB, props.lastSetC, props.prBannerA, props.prBannerB, props.prBannerC, props.coachHintA, props.coachHintB, props.coachHintC, props.altListA, props.altListB, props.altListC, props.exerciseNoteA, props.exerciseNoteB, props.exerciseNoteC, props.activeGoalLabelA, props.activeGoalLabelB, props.activeGoalLabelC]);

  // Per-card local state
  const [droppedSlots, setDroppedSlots] = useState<Set<SupersetSlotKey>>(new Set());
  const [skippedRoundBySlot, setSkippedRoundBySlot] = useState<Record<SupersetSlotKey, number | null>>({ a: null, b: null, c: null });
  const [focusOverride, setFocusOverride] = useState<SupersetSlotKey | null>(null);
  const [contextSlot, setContextSlot] = useState<SupersetSlotKey | null>(null);

  // Compute total rounds = max(targetSets) across non-dropped slots, default 3 if none specified
  const totalRounds = useMemo(() => {
    const candidates = slots
      .filter((s) => !droppedSlots.has(s.key))
      .map((s) => s.target.targetSets)
      .filter((n) => n > 0);
    if (candidates.length === 0) return 3;
    return Math.max(...candidates);
  }, [slots, droppedSlots]);

  // Per-slot working set counts
  const slotCounts: Record<SupersetSlotKey, number> = useMemo(() => ({
    a: workingCount(props.setsA),
    b: workingCount(props.setsB),
    c: hasC ? workingCount(props.setsC ?? []) : 0,
  }), [props.setsA, props.setsB, props.setsC, hasC]);

  // Compute current round: lowest round index where any non-dropped slot has not yet logged for that round (and target_sets >= round, or skipped)
  // A simpler model: currentRound = min(slotCounts[s] across non-dropped, target_sets >= round) + 1.
  // For mismatched targets: a slot is "ineligible" for rounds beyond its targetSets.
  const currentRound = useMemo(() => {
    for (let r = 1; r <= totalRounds; r += 1) {
      // Find any slot still owed a set in round r
      const owes = slots.some((s) => {
        if (droppedSlots.has(s.key)) return false;
        if (s.target.targetSets > 0 && s.target.targetSets < r) return false;
        if (skippedRoundBySlot[s.key] === r) return false;
        return slotCounts[s.key] < r;
      });
      if (owes) return r;
    }
    return totalRounds + 1; // overflow → bonus territory
  }, [slots, droppedSlots, skippedRoundBySlot, slotCounts, totalRounds]);

  const supersetComplete = currentRound > totalRounds;

  // Eligible slots in the current round (in slot order)
  const remainingInRound = useMemo(() => {
    if (supersetComplete) return [] as SupersetSlotKey[];
    return slots
      .filter((s) => {
        if (droppedSlots.has(s.key)) return false;
        if (s.target.targetSets > 0 && s.target.targetSets < currentRound) return false;
        if (skippedRoundBySlot[s.key] === currentRound) return false;
        return slotCounts[s.key] < currentRound;
      })
      .map((s) => s.key);
  }, [slots, droppedSlots, skippedRoundBySlot, slotCounts, currentRound, supersetComplete]);

  // Active slot: focus override (e.g. user tapped a collapsed row), else first remaining in round, else first non-dropped slot
  const activeSlot: SupersetSlotKey = useMemo(() => {
    if (focusOverride && !droppedSlots.has(focusOverride)) return focusOverride;
    if (remainingInRound.length > 0) return remainingInRound[0];
    const fallback = slots.find((s) => !droppedSlots.has(s.key));
    return fallback?.key ?? "a";
  }, [focusOverride, droppedSlots, remainingInRound, slots]);

  // Clear focus override once user logs a set in that slot or it becomes irrelevant.
  // Reset override if it points to a dropped slot.
  useEffect(() => {
    if (focusOverride && droppedSlots.has(focusOverride)) setFocusOverride(null);
  }, [focusOverride, droppedSlots]);

  // Notify parent that the active exercise changed (so floating timer/focus mirrors the active slot).
  // Avoid running before mount; only when activeSlot changes.
  const lastReportedFocusRef = useRef<string | null>(null);
  useEffect(() => {
    const slotInfo = slots.find((s) => s.key === activeSlot);
    if (!slotInfo) return;
    const exId = slotInfo.exId;
    if (lastReportedFocusRef.current !== exId) {
      lastReportedFocusRef.current = exId;
      props.onFocusExercise(exId);
    }
  }, [activeSlot, slots, props]);

  const eqA = getExercise(props.exIdA)?.equipment as Equipment | undefined;
  const eqB = getExercise(props.exIdB)?.equipment as Equipment | undefined;
  const eqC = hasC ? (getExercise(props.exIdC!)?.equipment as Equipment | undefined) : undefined;
  const equipmentUnavailable =
    props.gymEquipment != null &&
    ((eqA != null && !props.gymEquipment.has(eqA)) ||
      (eqB != null && !props.gymEquipment.has(eqB)) ||
      (hasC && eqC != null && !props.gymEquipment.has(eqC)));

  const isCardFocused =
    props.focusedExerciseId === props.exIdA ||
    props.focusedExerciseId === props.exIdB ||
    (hasC && props.focusedExerciseId === props.exIdC);

  // Determine phase for next CTA tap
  const isBonusTap = !supersetComplete && remainingInRound.length === 0 ? false : !supersetComplete && !remainingInRound.includes(activeSlot);
  const phaseAfter: SupersetLogPhase = (() => {
    if (supersetComplete) return "final"; // bonus territory
    if (!remainingInRound.includes(activeSlot)) return "transition"; // bonus while round ongoing
    if (remainingInRound.length === 1) return currentRound >= totalRounds ? "final" : "round";
    return "transition";
  })();

  // Build CTA label + subtitle. The button itself reads "+ Sett A"; any
  // workflow hint ("Next: B", "Finishes round 3") lives in the small
  // subtitle so the action stays unambiguous at a glance.
  const activeSlotInfo = slots.find((s) => s.key === activeSlot)!;
  const slotLabel = SLOT_LABELS[activeSlot];
  const { ctaLabel, ctaSubtitle } = (() => {
    if (supersetComplete || isBonusTap) {
      return {
        ctaLabel: t("log.supersetActionBonusSet", { slot: slotLabel }),
        ctaSubtitle: null as string | null,
      };
    }
    if (phaseAfter === "transition") {
      const remainingAfterThis = remainingInRound.filter((k) => k !== activeSlot);
      const nextKey = remainingAfterThis[0] ?? activeSlot;
      return {
        ctaLabel: t("log.supersetLogNext", { slot: slotLabel }),
        ctaSubtitle: t("log.supersetNextHint", { next: SLOT_LABELS[nextKey] }),
      };
    }
    if (phaseAfter === "final") {
      return {
        ctaLabel: t("log.supersetLogFinishSuperset", { slot: slotLabel }),
        ctaSubtitle: null,
      };
    }
    return {
      ctaLabel: t("log.supersetLogFinishRound", { slot: slotLabel }),
      ctaSubtitle: t("log.supersetFinishRoundHint", { n: String(currentRound) }),
    };
  })();

  function onPrimaryCta() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    props.onLogRoundSet({
      slot: activeSlot,
      exId: activeSlotInfo.exId,
      phase: phaseAfter,
      roundNum: supersetComplete ? totalRounds : currentRound,
      totalRounds,
      isBonus: supersetComplete || isBonusTap,
    });
    // After logging, clear focus override (if any).
    setFocusOverride(null);
  }

  function handleContextAction(slotKey: SupersetSlotKey, action: SlotContextAction) {
    const slotInfo = slots.find((s) => s.key === slotKey);
    if (!slotInfo) return;
    if (action.type === "skip") {
      setSkippedRoundBySlot((prev) => ({ ...prev, [slotKey]: currentRound }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (action.type === "undoSkip") {
      setSkippedRoundBySlot((prev) => ({ ...prev, [slotKey]: null }));
    } else if (action.type === "drop") {
      setDroppedSlots((prev) => {
        const next = new Set(prev);
        next.add(slotKey);
        return next;
      });
      if (focusOverride === slotKey) setFocusOverride(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (action.type === "undoDrop") {
      setDroppedSlots((prev) => {
        const next = new Set(prev);
        next.delete(slotKey);
        return next;
      });
    } else if (action.type === "bonus") {
      setFocusOverride(slotKey);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else if (action.type === "alt") {
      props.onOpenAltPicker(slotInfo.baseExId);
    }
  }

  // Round dots
  const dots: { filled: boolean; current: boolean }[] = [];
  for (let i = 1; i <= totalRounds; i += 1) {
    dots.push({ filled: i < currentRound, current: i === currentRound });
  }

  return (
    <View onLayout={props.onLayout} style={{ position: "relative", opacity: equipmentUnavailable ? 0.4 : 1 }}>
      {isCardFocused && <FocusGlow borderRadius={theme.radius.xl} isDark={theme.isDark} />}
      <View
        style={{
          borderColor: isCardFocused ? theme.accent : theme.glassBorder,
          borderWidth: 1,
          borderRadius: theme.radius.xl,
          backgroundColor: theme.glass,
          padding: 16,
          gap: 12,
          shadowColor: isCardFocused ? theme.accent : theme.shadow.sm.color,
          shadowOpacity: isCardFocused ? 0.45 : theme.shadow.sm.opacity,
          shadowRadius: isCardFocused ? 16 : theme.shadow.sm.radius,
          shadowOffset: isCardFocused ? { width: 0, height: 0 } : theme.shadow.sm.offset,
        }}
      >
        {/* Header: SUPERSET label + round counter + dots */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10, flexShrink: 1 }}>
            <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, letterSpacing: 1 }}>
              {t("log.superset").toUpperCase()}
            </Text>
            <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 15 }}>
              {supersetComplete
                ? t("log.supersetComplete")
                : t("log.supersetRound", { n: String(currentRound), total: String(totalRounds) })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            {dots.map((d, i) => (
              <View
                key={`dot_${i}`}
                style={{
                  width: d.current ? 9 : 7,
                  height: d.current ? 9 : 7,
                  borderRadius: 5,
                  backgroundColor: d.filled ? theme.accent : "transparent",
                  borderWidth: d.filled ? 0 : 1,
                  borderColor: d.current ? theme.accent : theme.line,
                }}
              />
            ))}
            {props.onRotate ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  props.onRotate!();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("log.rotateSuperset")}
                style={{ marginLeft: 8 }}
              >
                <MaterialIcons name="swap-vert" size={18} color={theme.muted} />
              </Pressable>
            ) : null}
            {props.onUngroup ? (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  props.onUngroup!();
                }}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("log.ungroupSuperset")}
                style={{ marginLeft: 8 }}
              >
                <MaterialIcons name="link-off" size={18} color={theme.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Slots */}
        <View style={{ gap: 8 }}>
          {slots.map((slot) => {
            const isActive = slot.key === activeSlot && !droppedSlots.has(slot.key);
            const planned = slot.target.targetSets;
            const wcount = slotCounts[slot.key];
            const slotDone = planned > 0 ? wcount >= planned : false;
            const isSkippedThisRound = skippedRoundBySlot[slot.key] === currentRound;
            const isDropped = droppedSlots.has(slot.key);

            if (isActive) {
              const slotColor = SLOT_COLORS[slot.key];
              return (
                <View
                  key={`expanded_${slot.key}`}
                  style={{
                    flexDirection: "row",
                    gap: 10,
                  }}
                >
                  <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: slotColor }} />
                  <View style={{ flex: 1 }}>
                    <ExerciseHalf
                      exId={slot.exId}
                      baseExId={slot.baseExId}
                      anchorKey={props.anchorKey}
                      prefix={SLOT_LABELS[slot.key]}
                      input={slot.input}
                      sets={slot.sets}
                      target={slot.target}
                      lastSet={slot.lastSet}
                      prBanner={slot.prBanner}
                      coachHint={slot.coachHint}
                      altList={slot.altList}
                      exerciseNote={slot.exerciseNote}
                      isFocused={false}
                      hideAddSetButton
                      lastAddedSetId={props.lastAddedSetId}
                      lastAddedAnim={props.lastAddedAnim}
                      onSetInput={props.onSetInput}
                      onApplyWeightStep={props.onApplyWeightStep}
                      onApplyLastSet={props.onApplyLastSet}
                      onAddSet={props.onAddSet}
                      onAddSetMultiple={props.onAddSetMultiple}
                      onEditSet={props.onEditSet}
                      onDeleteSet={props.onDeleteSet}
                      onFocusExercise={props.onFocusExercise}
                      onOpenAltPicker={props.onOpenAltPicker}
                      onSetAsDefault={props.onSetAsDefault}
                      onExerciseNoteChange={props.onExerciseNoteChange}
                      onExerciseNoteBlur={props.onExerciseNoteBlur}
                      onSetGoal={props.onSetGoal}
                      onOpenPlateCalc={props.onOpenPlateCalc}
                      onLogWarmupSet={props.onLogWarmupSet}
                      onSkipExercise={undefined}
                      onUndoSkip={undefined}
                      workoutId={props.workoutId}
                      exerciseIndex={props.exerciseIndex}
                      gymId={props.gymId}
                      gymEquipment={props.gymEquipment}
                      activeGoalLabel={slot.activeGoalLabel}
                    />
                  </View>
                </View>
              );
            }

            return (
              <CollapsedSlotRow
                key={`collapsed_${slot.key}`}
                slot={slot}
                workingSets={wcount}
                done={slotDone}
                isSkippedThisRound={isSkippedThisRound}
                isDropped={isDropped}
                onPress={() => {
                  if (isDropped) {
                    setContextSlot(slot.key);
                    return;
                  }
                  Haptics.selectionAsync().catch(() => {});
                  setFocusOverride(slot.key);
                }}
                onLongPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setContextSlot(slot.key);
                }}
              />
            );
          })}
        </View>

        {/* Primary CTA — hidden if active slot is dropped */}
        {!droppedSlots.has(activeSlot) ? (
          <Pressable onPress={onPrimaryCta} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
            <LinearGradient
              colors={[SLOT_COLORS[activeSlot], theme.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                height: 52,
                borderRadius: theme.radius.lg,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 14,
                shadowColor: theme.shadow.glow.color,
                shadowOpacity: theme.shadow.glow.opacity,
                shadowRadius: theme.shadow.glow.radius,
                shadowOffset: theme.shadow.glow.offset,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ color: "#FFFFFF", fontFamily: theme.fontFamily.semibold, fontSize: theme.fontSize.sm, textAlign: "center" }}
              >
                {ctaLabel}
              </Text>
              {ctaSubtitle ? (
                <Text
                  numberOfLines={1}
                  style={{ color: "rgba(255,255,255,0.85)", fontFamily: theme.mono, fontSize: 10, textAlign: "center", marginTop: 2, letterSpacing: 0.3 }}
                >
                  {ctaSubtitle}
                </Text>
              ) : null}
            </LinearGradient>
          </Pressable>
        ) : null}

        {/* Long-press hint (subtle) */}
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, opacity: 0.7, textAlign: "center" }}>
          {t("log.supersetCollapsedHint")}
        </Text>
      </View>

      <SlotContextMenu
        visible={contextSlot != null}
        slot={contextSlot}
        exId={contextSlot ? slots.find((s) => s.key === contextSlot)?.exId ?? null : null}
        isSkippedThisRound={contextSlot ? skippedRoundBySlot[contextSlot] === currentRound : false}
        isDropped={contextSlot ? droppedSlots.has(contextSlot) : false}
        hasAlt={contextSlot ? (slots.find((s) => s.key === contextSlot)?.altList.length ?? 0) > 0 : false}
        onClose={() => setContextSlot(null)}
        onChoose={(action) => {
          if (contextSlot) handleContextAction(contextSlot, action);
        }}
      />
    </View>
  );
}

export default SingleExerciseCard;
