// src/components/ExactAlarmBanner.tsx
//
// Shown on the Log screen while Android is refusing exact alarms for the app
// (SCHEDULE_EXACT_ALARM is denied by default for fresh installs on Android
// 14+). Without the access, every scheduled rest-done notification falls back
// to an inexact alarm that Doze can defer for minutes — the timer looks
// broken. One tap opens the system "Alarms & reminders" screen; the banner
// re-checks on app resume and disappears on its own once access is granted.
//
// Unlike HintBanner this is not a dismiss-once tip: it reflects a live system
// state and must come back as long as the state persists.
import React, { useEffect, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";
import { canScheduleExactAlarms, openExactAlarmSettings } from "../../modules/rest-countdown";

export default function ExactAlarmBanner() {
  const theme = useTheme();
  const { t } = useI18n();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const check = () => setBlocked(!canScheduleExactAlarms());
    check();
    // Re-check when the user returns from the system settings screen.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, []);

  if (!blocked) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.warn,
        borderRadius: theme.radius.md,
        padding: 12,
        gap: 10,
      }}
    >
      <MaterialIcons name="alarm" size={20} color={theme.warn} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>
          {t("log.exactAlarmBanner")}
        </Text>
      </View>
      <Pressable onPress={openExactAlarmSettings} hitSlop={12} accessibilityRole="button">
        <Text style={{ color: theme.warn, fontFamily: theme.fontFamily.semibold, fontSize: 13 }}>
          {t("log.exactAlarmOpen")}
        </Text>
      </Pressable>
    </View>
  );
}
