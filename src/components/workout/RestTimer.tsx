// src/components/workout/RestTimer.tsx
import React from "react";
import { View, Text, Pressable, Switch, Modal, ScrollView } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { Chip, Btn } from "../../ui";

function mmss(totalSec: number) {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export type RestTimerInlineProps = {
  restEnabled: boolean;
  restRunning: boolean;
  restLabel: string;
  onToggle: () => void;
};

/** Inline rest timer button shown inside exercise cards */
export function RestTimerInline({ restEnabled, restRunning, restLabel, onToggle }: RestTimerInlineProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Pressable
      onPress={onToggle}
      style={{
        borderColor: restEnabled ? theme.glassBorder : theme.danger,
        borderWidth: 1,
        borderRadius: theme.radius.lg,
        paddingVertical: 8,
        paddingHorizontal: 14,
        backgroundColor: theme.glass,
      }}
    >
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 12 }}>
        {t("log.restPrefix", { time: restLabel })}
      </Text>
    </Pressable>
  );
}

export type RestSettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  restEnabled: boolean;
  onRestEnabledChange: (value: boolean) => void;
  restHaptics: boolean;
  onRestHapticsChange: (value: boolean) => void;
  restVibrate: boolean;
  onRestVibrateChange: (value: boolean) => void;
  restSeconds: number;
  onRestSecondsChange: (seconds: number) => void;
  recommendedSeconds: number | null;
  onUseRecommended: () => void;
  onReset: () => void;
};

/** Modal for configuring rest timer settings */
export default function RestSettingsModal({
  visible,
  onClose,
  restEnabled,
  onRestEnabledChange,
  restHaptics,
  onRestHapticsChange,
  restVibrate,
  onRestVibrateChange,
  restSeconds,
  onRestSecondsChange,
  recommendedSeconds,
  onUseRecommended,
  onReset,
}: RestSettingsModalProps) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}>
        <View
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
          <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>{t("log.restTimerTitle")}</Text>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>{t("log.restActive")}</Text>
            <Switch value={restEnabled} onValueChange={onRestEnabledChange} />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>{t("log.restHaptics")}</Text>
            <Switch value={restHaptics} onValueChange={onRestHapticsChange} />
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: theme.text }}>{t("log.restVibrate")}</Text>
            <Switch value={restVibrate} onValueChange={onRestVibrateChange} />
          </View>

          <Text style={{ color: theme.muted, marginTop: 6 }}>{t("log.restLength")}</Text>
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            {[60, 90, 120, 150, 180].map((sec) => (
              <Chip
                key={`rest_${sec}`}
                text={`${sec}s`}
                active={restSeconds === sec}
                onPress={() => onRestSecondsChange(sec)}
              />
            ))}
          </View>

          {recommendedSeconds != null ? (
            <Pressable
              onPress={onUseRecommended}
              style={{
                borderColor: theme.glassBorder,
                borderWidth: 1,
                borderRadius: theme.radius.md,
                paddingVertical: 8,
                paddingHorizontal: 14,
                backgroundColor: theme.glass,
                alignSelf: "flex-start",
              }}
            >
              <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 12 }}>
                {t("log.useRecommended", { seconds: recommendedSeconds })}
              </Text>
            </Pressable>
          ) : null}

          <View style={{ flexDirection: "row", gap: 10 }}>
            <Btn label={t("common.close")} onPress={onClose} />
            <Btn label={t("log.reset")} onPress={onReset} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
