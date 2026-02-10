// src/components/modals/PlateCalcModal.tsx
import React, { useState, useEffect } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit } from "../../units";
import { calculatePlates, plateColor } from "../../plateCalculator";
import { getSettingAsync, setSettingAsync } from "../../db";

type BarOption = { label: string; kg: number };

const BAR_OPTIONS: BarOption[] = [
  { label: "Olympic", kg: 20 },
  { label: "Women's", kg: 15 },
  { label: "EZ Bar", kg: 10 },
  { label: "Smith", kg: 15 },
  { label: "Trap Bar", kg: 25 },
];

export type PlateCalcModalProps = {
  visible: boolean;
  onClose: () => void;
  /** The current weight string from the input field (in display units) */
  weightStr: string;
};

export default function PlateCalcModal({ visible, onClose, weightStr }: PlateCalcModalProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();

  const [selectedBar, setSelectedBar] = useState("Olympic");

  // Load saved bar preference
  useEffect(() => {
    getSettingAsync("plateCalcBar").then((v) => {
      if (v && BAR_OPTIONS.some((b) => b.label === v)) setSelectedBar(v);
    }).catch(() => {});
  }, []);

  function selectBar(label: string) {
    setSelectedBar(label);
    setSettingAsync("plateCalcBar", label).catch(() => {});
  }

  const barKg = BAR_OPTIONS.find((b) => b.label === selectedBar)?.kg ?? 20;

  const displayVal = parseFloat(weightStr);
  const targetKg = Number.isFinite(displayVal) ? wu.toKg(displayVal) : 0;
  const result = calculatePlates(targetKg, barKg);

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
          }}
        >
          <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 16, marginBottom: 14 }}>
            {t("log.plateCalc")}
          </Text>
          <View style={{ gap: 10 }}>
            {/* Bar selection */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {BAR_OPTIONS.map((bar) => {
                const active = selectedBar === bar.label;
                return (
                  <Pressable
                    key={bar.label}
                    onPress={() => selectBar(bar.label)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: theme.radius.md,
                      borderWidth: 1,
                      borderColor: active ? theme.accent : theme.glassBorder,
                      backgroundColor: active
                        ? (theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)")
                        : theme.glass,
                    }}
                  >
                    <Text style={{ color: active ? theme.accent : theme.text, fontFamily: theme.mono, fontSize: 12 }}>
                      {bar.label} ({wu.formatWeight(bar.kg)})
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

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
            {result.plates.length === 0 ? (
              <Text style={{ color: theme.muted, textAlign: "center", padding: 10 }}>
                {wu.formatWeight(result.barWeight)} ({t("log.bar")})
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {result.plates.map((p, idx) => (
                  <View
                    key={`${p.weight}_${idx}`}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                    }}
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
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
