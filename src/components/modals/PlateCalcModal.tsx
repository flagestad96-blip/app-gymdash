// src/components/modals/PlateCalcModal.tsx
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Pressable, Modal, ScrollView, TextInput, Alert } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import {
  calculatePlates, plateColor,
  BUILT_IN_BARS, BarType,
  loadCustomBars, saveCustomBars,
  loadExerciseBarPrefs, saveExerciseBarPref,
} from "../../plateCalculator";
import { getGym, getGymPlates } from "../../gymStore";

export type PlateCalcModalProps = {
  visible: boolean;
  onClose: () => void;
  /** The current weight string from the input field (in display units) */
  weightStr: string;
  /** Exercise ID — used to remember bar preference per exercise */
  exerciseId?: string | null;
  /** Active gym ID — used to resolve gym-specific plate set */
  gymId?: string | null;
};

export default function PlateCalcModal({ visible, onClose, weightStr, exerciseId, gymId }: PlateCalcModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();

  const [allBars, setAllBars] = useState<BarType[]>(BUILT_IN_BARS);
  const [selectedBarId, setSelectedBarId] = useState("olympic");
  const [, setExercisePrefs] = useState<Record<string, string>>({});
  const [showAddBar, setShowAddBar] = useState(false);
  const [newBarName, setNewBarName] = useState("");
  const [newBarWeight, setNewBarWeight] = useState("");
  const [gymPlates, setGymPlates] = useState<number[] | null>(null);

  // Load custom bars + exercise preferences on mount
  const loadData = useCallback(async () => {
    const [custom, prefs] = await Promise.all([loadCustomBars(), loadExerciseBarPrefs()]);
    const merged = [...BUILT_IN_BARS, ...custom];
    setAllBars(merged);
    setExercisePrefs(prefs);

    // Resolve which bar to select
    const prefBarId = exerciseId ? prefs[exerciseId] : null;
    if (prefBarId && merged.some((b) => b.id === prefBarId)) {
      setSelectedBarId(prefBarId);
    } else if (!merged.some((b) => b.id === selectedBarId)) {
      setSelectedBarId("olympic");
    }

    // Resolve gym-specific plates
    const activeGym = gymId ? getGym(gymId) : null;
    setGymPlates(getGymPlates(activeGym));
  }, [exerciseId, gymId]);

  useEffect(() => {
    if (visible) loadData();
  }, [visible, loadData]);

  function selectBar(barId: string) {
    setSelectedBarId(barId);
    if (exerciseId) {
      saveExerciseBarPref(exerciseId, barId).catch(() => {});
      setExercisePrefs((prev) => ({ ...prev, [exerciseId]: barId }));
    }
  }

  async function handleAddCustomBar() {
    const name = newBarName.trim();
    const weightVal = parseFloat(newBarWeight);
    if (!name) return;
    if (!Number.isFinite(weightVal) || weightVal < 0) return;

    const kgVal = wu.toKg(weightVal);
    const id = `custom_${Date.now()}`;
    const newBar: BarType = { id, customName: name, kg: kgVal, builtIn: false };

    const customOnly = allBars.filter((b) => !b.builtIn);
    const updated = [...customOnly, newBar];
    await saveCustomBars(updated);

    setAllBars([...BUILT_IN_BARS, ...updated]);
    setNewBarName("");
    setNewBarWeight("");
    setShowAddBar(false);
    selectBar(id);
  }

  function handleDeleteCustomBar(barId: string) {
    const bar = allBars.find((b) => b.id === barId);
    if (!bar || bar.builtIn) return;
    Alert.alert(
      t("plate.deleteBar"),
      t("plate.deleteBarMsg", { name: bar.customName ?? "" }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("common.delete"),
          style: "destructive",
          onPress: async () => {
            const customOnly = allBars.filter((b) => !b.builtIn && b.id !== barId);
            await saveCustomBars(customOnly);
            setAllBars([...BUILT_IN_BARS, ...customOnly]);
            if (selectedBarId === barId) setSelectedBarId("olympic");
          },
        },
      ]
    );
  }

  function barDisplayName(bar: BarType): string {
    if (bar.builtIn && bar.nameKey) return t(bar.nameKey);
    return bar.customName ?? bar.id;
  }

  const selectedBar = allBars.find((b) => b.id === selectedBarId) ?? BUILT_IN_BARS[0];
  const barKg = selectedBar.kg;

  const displayVal = parseFloat(weightStr);
  const targetKg = Number.isFinite(displayVal) ? wu.toKg(displayVal) : 0;
  const result = calculatePlates(targetKg, barKg, gymPlates ?? undefined);

  const activeBg = theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "flex-end" }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: theme.modalGlass,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderWidth: 1,
            borderColor: theme.glassBorder,
            padding: 18,
            paddingBottom: 40,
            maxHeight: "85%",
          }}
        >
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 16, marginBottom: 14 }}>
              {t("log.plateCalc")}
            </Text>

            <View style={{ gap: 10 }}>
              {/* ── Bar selection ── */}
              <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
                {t("plate.barType")}
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {allBars.map((bar) => {
                  const active = selectedBarId === bar.id;
                  return (
                    <Pressable
                      key={bar.id}
                      onPress={() => selectBar(bar.id)}
                      onLongPress={() => { if (!bar.builtIn) handleDeleteCustomBar(bar.id); }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: active ? theme.accent : theme.glassBorder,
                        backgroundColor: active ? activeBg : theme.glass,
                      }}
                    >
                      <Text style={{ color: active ? theme.accent : theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                        {barDisplayName(bar)} ({wu.formatWeight(bar.kg)})
                      </Text>
                    </Pressable>
                  );
                })}

                {/* Add custom bar button */}
                <Pressable
                  onPress={() => setShowAddBar((v) => !v)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: theme.radius.md,
                    borderWidth: 1,
                    borderColor: theme.glassBorder,
                    borderStyle: "dashed",
                    backgroundColor: "transparent",
                  }}
                >
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                    + {t("plate.addCustomBar")}
                  </Text>
                </Pressable>
              </View>

              {/* ── Inline custom bar form ── */}
              {showAddBar ? (
                <View style={{
                  borderWidth: 1,
                  borderColor: theme.glassBorder,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.glass,
                  padding: 12,
                  gap: 8,
                }}>
                  <TextInput
                    value={newBarName}
                    onChangeText={setNewBarName}
                    placeholder={t("plate.barNamePlaceholder")}
                    placeholderTextColor={theme.muted}
                    style={{
                      color: theme.text,
                      fontFamily: theme.mono,
                      fontSize: 14,
                      borderWidth: 1,
                      borderColor: theme.glassBorder,
                      borderRadius: theme.radius.md,
                      padding: 8,
                    }}
                  />
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <TextInput
                      value={newBarWeight}
                      onChangeText={setNewBarWeight}
                      placeholder={`0 ${wu.unit}`}
                      placeholderTextColor={theme.muted}
                      keyboardType="decimal-pad"
                      style={{
                        color: theme.text,
                        fontFamily: theme.mono,
                        fontSize: 14,
                        borderWidth: 1,
                        borderColor: theme.glassBorder,
                        borderRadius: theme.radius.md,
                        padding: 8,
                        flex: 1,
                      }}
                    />
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{wu.unit}</Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Pressable
                      onPress={() => { setShowAddBar(false); setNewBarName(""); setNewBarWeight(""); }}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: theme.glassBorder,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>{t("common.cancel")}</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleAddCustomBar}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: theme.radius.md,
                        borderWidth: 1,
                        borderColor: theme.accent,
                        backgroundColor: activeBg,
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 12 }}>{t("common.save")}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              {/* ── Bar weight info ── */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                  {t("log.bar")}: {wu.formatWeight(result.barWeight)}
                </Text>
                {!result.achievable ? (
                  <Text style={{ color: theme.warn, fontFamily: theme.mono, fontSize: 11 }}>
                    {t("log.notExact")}: {wu.formatWeight(result.totalWeight)}
                  </Text>
                ) : null}
              </View>

              {/* ── Plate breakdown ── */}
              {result.plates.length === 0 ? (
                <Text style={{ color: theme.muted, textAlign: "center", padding: 10 }}>
                  {wu.formatWeight(result.barWeight)} ({t("log.bar")})
                </Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {result.plates.map((p, idx) => (
                    <View
                      key={`${p.weight}_${idx}`}
                      style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
                    >
                      <View
                        style={{
                          width: Math.max(24, Math.min(60, p.weight * 2.4)),
                          height: 28,
                          borderRadius: 4,
                          backgroundColor: plateColor(p.weight),
                          borderWidth: 1,
                          borderColor: theme.glassBorder,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: p.weight >= 5 && p.weight < 15 ? "#000" : "#FFF", fontFamily: theme.mono, fontSize: 11, fontWeight: "700" }}>
                          {wu.toDisplay(p.weight)}
                        </Text>
                      </View>
                      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 14 }}>
                        {wu.toDisplay(p.weight)} {wu.unit} × {p.count} {t("log.perSide")}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Hint for custom bar deletion ── */}
              {allBars.some((b) => !b.builtIn) ? (
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, textAlign: "center", marginTop: 4 }}>
                  {t("plate.longPressToDelete")}
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
