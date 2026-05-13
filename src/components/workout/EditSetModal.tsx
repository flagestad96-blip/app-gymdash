// src/components/workout/EditSetModal.tsx
//
// Reusable modal for editing or deleting a single completed set. Used by:
//   - log.tsx (live workout edit/delete)
//   - workout/[id].tsx (historical workout detail)
//   - calendar.tsx (historical workout detail)
//
// On save, runs full-historical PR recompute for the affected exercise so
// edited values don't leave stale PR records behind.

import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, Alert } from "react-native";
import { getDb, computeBodyweightLoad } from "../../db";
import { isoDateOnly } from "../../storage";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { TextField, Btn } from "../../ui";
import { useWeightUnit } from "../../units";
import { isBodyweight } from "../../exerciseLibrary";
import { recomputePRForExercise } from "../../prEngine";
import type { SetRow } from "./SetEntryRow";

type Props = {
  visible: boolean;
  set: SetRow | null;
  programId: string | null;
  onClose: () => void;
  onChanged: () => void;
};

export default function EditSetModal({ visible, set, programId, onClose, onChanged }: Props) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!visible || !set) return;
    setWeight(set.weight != null ? String(wu.toDisplay(set.weight)) : "");
    setReps(String(set.reps ?? ""));
    setRpe(set.rpe != null ? String(set.rpe) : "");
    setNote(set.notes ?? "");
  }, [visible, set, wu]);

  async function save() {
    if (!set) return;
    const isBw = set.exercise_id ? isBodyweight(set.exercise_id) : false;
    const parsedWeight = parseFloat(weight);
    const weightKg = Number.isFinite(parsedWeight) ? wu.toKg(parsedWeight) : isBw ? 0 : NaN;
    const repsN = parseInt(reps, 10);
    const rpeN = parseFloat(rpe);
    if (!Number.isFinite(weightKg) || !Number.isFinite(repsN)) {
      Alert.alert(t("log.missingData"), t("log.missingDataMsg"));
      return;
    }
    const noteToSave = note.trim() ? note.trim() : null;
    try {
      if (isBw && set.exercise_id) {
        const dateOnly = set.created_at ? set.created_at.slice(0, 10) : isoDateOnly();
        const bwData = await computeBodyweightLoad(set.exercise_id, dateOnly, weightKg);
        await getDb().runAsync(
          `UPDATE sets SET weight = ?, reps = ?, rpe = ?, notes = ?, external_load_kg = ?, bodyweight_kg_used = ?, bodyweight_factor = ?, est_total_load_kg = ? WHERE id = ?`,
          [
            weightKg,
            repsN,
            Number.isFinite(rpeN) ? rpeN : null,
            noteToSave,
            bwData.external_load_kg ?? 0,
            bwData.bodyweight_kg_used ?? null,
            bwData.bodyweight_factor ?? null,
            bwData.est_total_load_kg ?? null,
            set.id,
          ],
        );
      } else {
        await getDb().runAsync(
          `UPDATE sets SET weight = ?, reps = ?, rpe = ?, notes = ? WHERE id = ?`,
          [weightKg, repsN, Number.isFinite(rpeN) ? rpeN : null, noteToSave, set.id],
        );
      }
      // Recompute PR records so an edit-down can't leave a ghost PR. No-op
      // if exercise has no programId attached (ad-hoc historical sets).
      const exId = set.exercise_id ?? set.exercise_name;
      if (exId && programId) {
        try { recomputePRForExercise(exId, programId); } catch (err) { console.warn("PR recompute failed", err); }
      }
      onChanged();
      onClose();
    } catch (err) {
      console.warn("EditSetModal save failed", err);
      Alert.alert(t("common.error"), t("log.missingDataMsg"));
    }
  }

  function confirmDelete() {
    if (!set) return;
    Alert.alert(
      t("log.deleteSet"),
      t("log.deleteSetConfirm"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await getDb().runAsync(`DELETE FROM sets WHERE id = ?`, [set.id]);
              const exId = set.exercise_id ?? set.exercise_name;
              if (exId && programId) {
                try { recomputePRForExercise(exId, programId); } catch (err) { console.warn("PR recompute failed", err); }
              }
              onChanged();
              onClose();
            } catch (err) {
              console.warn("EditSetModal delete failed", err);
            }
          },
        },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}
        onPress={onClose}
      >
        <View
          onStartShouldSetResponder={() => true}
          style={{
            backgroundColor: theme.modalGlass,
            borderColor: theme.glassBorder,
            borderWidth: 1,
            borderRadius: theme.radius.xl,
            padding: 18,
            gap: 14,
            shadowColor: theme.shadow.lg.color,
            shadowOpacity: theme.shadow.lg.opacity,
            shadowRadius: theme.shadow.lg.radius,
            shadowOffset: theme.shadow.lg.offset,
            elevation: theme.shadow.lg.elevation,
          }}
        >
          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>{t("log.editSet")}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextField
              value={weight}
              onChangeText={setWeight}
              placeholder={wu.unitLabel().toLowerCase()}
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              style={{
                flex: 1, minHeight: 48, color: theme.text,
                backgroundColor: theme.panel, borderColor: theme.glassBorder,
                borderWidth: 1, borderRadius: theme.radius.md,
                paddingHorizontal: 14, paddingVertical: 12, fontSize: 17,
              }}
            />
            <TextField
              value={reps}
              onChangeText={setReps}
              placeholder="reps"
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              style={{
                flex: 1, minHeight: 48, color: theme.text,
                backgroundColor: theme.panel, borderColor: theme.glassBorder,
                borderWidth: 1, borderRadius: theme.radius.md,
                paddingHorizontal: 14, paddingVertical: 12, fontSize: 17,
              }}
            />
            <TextField
              value={rpe}
              onChangeText={setRpe}
              placeholder="rpe"
              placeholderTextColor={theme.muted}
              keyboardType="numeric"
              style={{
                width: 80, minHeight: 48, color: theme.text,
                backgroundColor: theme.panel, borderColor: theme.glassBorder,
                borderWidth: 1, borderRadius: theme.radius.md,
                paddingHorizontal: 14, paddingVertical: 12, fontSize: 17,
              }}
            />
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t("log.setNotePlaceholder")}
            placeholderTextColor={theme.muted}
            multiline
            style={{
              color: theme.text, backgroundColor: theme.panel,
              borderColor: theme.glassBorder, borderWidth: 1,
              borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10,
              fontFamily: theme.mono, fontSize: 14, minHeight: 60, maxHeight: 120,
              textAlignVertical: "top",
            }}
          />
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
            <Btn label={t("common.delete")} onPress={confirmDelete} tone="danger" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Btn label={t("common.cancel")} onPress={onClose} />
              <Btn label={t("common.save")} onPress={save} tone="accent" />
            </View>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
