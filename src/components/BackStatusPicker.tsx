import React from "react";
import { View, Text, Pressable } from "react-native";
import { theme } from "../theme";

export type BackStatus = "green" | "yellow" | "red";

const items: { key: BackStatus; label: string; hint: string }[] = [
  { key: "green", label: "🟢 Bra", hint: "Normal økt" },
  { key: "yellow", label: "🟡 Litt stram", hint: "Vurder ryggvennlig" },
  { key: "red", label: "🔴 Ikke bra", hint: "Ryggvennlig + ingen triggere" },
];

export function BackStatusPicker(props: {
  value: BackStatus;
  onChange: (v: BackStatus) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.muted, fontFamily: theme.mono }}>
        RYGG-STATUS
      </Text>

      <View style={{ flexDirection: "row", gap: 10 }}>
        {items.map((it) => {
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
                {it.label}
              </Text>
              <Text style={{ color: theme.muted, marginTop: 6, fontSize: 12 }}>
                {it.hint}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
