import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";
import { getSettingAsync, setSettingAsync } from "../db";

export default function HintBanner({
  hintKey,
  icon,
  children,
}: {
  hintKey: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    getSettingAsync(`hint_dismissed_${hintKey}`).then((v) => {
      if (mounted && v !== "1") setVisible(true);
    });
    return () => { mounted = false; };
  }, [hintKey]);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    setSettingAsync(`hint_dismissed_${hintKey}`, "1").catch(() => {});
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.glass,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        borderRadius: theme.radius.md,
        padding: 12,
        gap: 10,
      }}
    >
      <MaterialIcons name={icon} size={20} color={theme.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 18 }}>{children}</Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={12}>
        <Text style={{ color: theme.accent, fontFamily: theme.mono, fontSize: 13 }}>
          {t("hint.dismiss")}
        </Text>
      </Pressable>
    </View>
  );
}
