// src/components/settings/WeightUnitCard.tsx
import React from "react";
import { View, Text } from "react-native";
import { useTheme } from "../../theme";
import { useI18n } from "../../i18n";
import { useWeightUnit, type WeightUnit } from "../../units";
import { Card, Chip } from "../../ui";

export default function WeightUnitCard() {
  const theme = useTheme();
  const { t } = useI18n();
  const { unit, setUnit } = useWeightUnit();
  return (
    <Card title={t("settings.weightUnit")}>
      <Text style={{ color: theme.muted, marginBottom: 8 }}>
        {t("settings.weightUnit.desc")}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {(["kg", "lbs"] as WeightUnit[]).map((u) => (
          <Chip
            key={`wu_${u}`}
            text={t(`settings.weightUnit.${u}`)}
            active={unit === u}
            onPress={() => setUnit(u)}
          />
        ))}
      </View>
    </Card>
  );
}
