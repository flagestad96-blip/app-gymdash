// src/components/settings/GymLocationsCard.tsx
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { type GymLocation } from "../../gymStore";
import { Card, Btn } from "../../ui";

export default function GymLocationsCard({
  gyms,
  onManage,
}: {
  gyms: GymLocation[];
  onManage: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Card title={t("settings.gymLocations")}>
      <Text style={{ color: theme.muted, marginBottom: 8 }}>
        {t("settings.gymLocations.desc")}
      </Text>
      {gyms.length === 0 ? (
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, marginBottom: 8 }}>
          {t("settings.gymLocations.empty")}
        </Text>
      ) : (
        <View style={{ gap: 6, marginBottom: 8 }}>
          {gyms.map((gym) => (
            <View key={gym.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: gym.color ?? theme.accent,
                }}
              />
              <Text style={{ color: theme.text, fontSize: theme.fontSize.sm }}>{gym.name}</Text>
            </View>
          ))}
        </View>
      )}
      <Btn label={t("settings.gymLocations.manage")} onPress={onManage} />
    </Card>
  );
}
