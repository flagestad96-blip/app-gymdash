import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTheme } from "../theme";
import { useI18n } from "../i18n";

export type BackStatus = "green" | "yellow" | "red";

const STATUS_KEYS: { key: BackStatus; labelKey: string; hintKey: string }[] = [
  { key: "green", labelKey: "back.statusGreen", hintKey: "back.statusGreenHint" },
  { key: "yellow", labelKey: "back.statusYellow", hintKey: "back.statusYellowHint" },
  { key: "red", labelKey: "back.statusRed", hintKey: "back.statusRedHint" },
];

export function BackStatusPicker(props: {
  value: BackStatus;
  onChange: (v: BackStatus) => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.muted, fontFamily: theme.mono }}>
        {t("back.statusTitle")}
      </Text>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {STATUS_KEYS.map((it) => {
          const active = props.value === it.key;
          return (
            <Pressable
              key={it.key}
              onPress={() => props.onChange(it.key)}
              style={{
                flex: 1,
                backgroundColor: active ? theme.panel : theme.panel2,
                borderColor: active ? theme.accent : theme.line,
                borderWidth: 1,
                borderRadius: 14,
                padding: 12,
              }}
            >
              <Text style={{ color: theme.text, fontSize: 14 }}>
                {t(it.labelKey)}
              </Text>
              <Text style={{ color: theme.muted, marginTop: 6, fontSize: 12 }}>
                {t(it.hintKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
