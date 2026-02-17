// app/(tabs)/body.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { deleteBodyMetric, listBodyMetrics, upsertBodyMetric, getSettingAsync, setSettingAsync, type BodyMetricRow } from "../../src/db";
import { Screen, TopBar, Card, Btn, TextField, IconButton } from "../../src/ui";
import { useWeightUnit } from "../../src/units";
import PhotoPicker from "../../src/components/PhotoPicker";
import LineChart from "../../src/components/charts/LineChart";
import { isoDateOnly } from "../../src/storage";
import { round1 } from "../../src/metrics";

export default function BodyScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const wu = useWeightUnit();
  const navigation = useNavigation();
  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);

  const [metrics, setMetrics] = useState<BodyMetricRow[]>([]);
  const [heightCm, setHeightCm] = useState("");
  const [dateInput, setDateInput] = useState(isoDateOnly());
  const [weightInput, setWeightInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listBodyMetrics();
    setMetrics(rows ?? []);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const h = await getSettingAsync("height_cm");
      if (!alive) return;
      if (h) setHeightCm(h);
      await refresh();
    })();
    return () => { alive = false; };
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh])
  );

  const latestMetric = metrics[0] ?? null;
  const parsedHeight = Number(heightCm);
  const parsedWeightInput = Number(weightInput);

  const bmiValue = useMemo(() => {
    const hCm = parsedHeight;
    if (!Number.isFinite(hCm) || hCm <= 0) return null;
    const w = Number.isFinite(parsedWeightInput) ? wu.toKg(parsedWeightInput) : latestMetric?.weight_kg;
    if (!Number.isFinite(w ?? NaN)) return null;
    const hM = hCm / 100;
    return round1((w as number) / (hM * hM));
  }, [parsedHeight, parsedWeightInput, latestMetric]);

  const weightTrend = useMemo(() => {
    if (metrics.length < 2) return null;
    const sorted = [...metrics].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const rawLabels = sorted.map((m) => m.date.slice(5));
    const rawValues = sorted.map((m) => m.weight_kg);

    // 7-day rolling average
    const smoothed: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const cutoff = new Date(sorted[i].date);
      cutoff.setDate(cutoff.getDate() - 7);
      const cutoffIso = isoDateOnly(cutoff);
      const window = sorted.filter((m) => m.date > cutoffIso && m.date <= sorted[i].date);
      const avg = window.reduce((sum, m) => sum + m.weight_kg, 0) / window.length;
      smoothed.push(round1(avg));
    }

    // Phase tag: compare smoothed avg of last 7 entries vs first 7 entries (or fewer)
    const n = Math.min(7, Math.floor(smoothed.length / 2));
    const recentAvg = smoothed.slice(-n).reduce((a, b) => a + b, 0) / n;
    const earlyAvg = smoothed.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const delta = recentAvg - earlyAvg;
    let phase: "bulk" | "cut" | "maintenance" = "maintenance";
    if (delta > 0.5) phase = "bulk";
    else if (delta < -0.5) phase = "cut";

    return { rawLabels, rawValues, smoothed, phase };
  }, [metrics]);

  async function saveMetric() {
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w <= 0) {
      Alert.alert(t("body.invalidWeight"), t("body.invalidWeightMsg"));
      return;
    }
    await upsertBodyMetric(dateInput, wu.toKg(w), noteInput.trim() || null, photoUri);
    setEditing(false);
    setDateInput(isoDateOnly());
    setWeightInput("");
    setNoteInput("");
    setPhotoUri(null);
    await refresh();
  }

  function startEdit(row: BodyMetricRow) {
    setEditing(true);
    setDateInput(row.date);
    setWeightInput(String(wu.toDisplay(row.weight_kg)));
    setNoteInput(row.note ?? "");
    setPhotoUri(row.photo_uri ?? null);
  }

  function resetForm() {
    setEditing(false);
    setDateInput(isoDateOnly());
    setWeightInput("");
    setNoteInput("");
    setPhotoUri(null);
  }

  async function confirmDelete(date: string) {
    Alert.alert(t("body.deleteMeasurement"), t("program.noUndoWarning"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteBodyMetric(date);
          if (dateInput === date) resetForm();
          await refresh();
        },
      },
    ]);
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TopBar title={t("body.title")} subtitle={t("body.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />
          <Card title={t("body.register")}>
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                  {t("body.date", { date: dateInput })}
                </Text>
                {editing ? <Text style={{ color: theme.muted, fontSize: 12 }}>{t("body.editing")}</Text> : null}
              </View>

              <TextField
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder={t("body.weightPlaceholder")}
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                suffix={wu.unitLabel()}
                style={{
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.glassBorder,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  fontFamily: theme.mono,
                }}
              />

              <TextField
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder={t("body.notePlaceholder")}
                placeholderTextColor={theme.muted}
                style={{
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.glassBorder,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  fontFamily: theme.mono,
                }}
              />

              <TextField
                value={heightCm}
                onChangeText={(v) => {
                  setHeightCm(v);
                }}
                onBlur={() => {
                  setSettingAsync("height_cm", heightCm.trim()).catch(() => {});
                }}
                placeholder={t("body.heightPlaceholder")}
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                style={{
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.glassBorder,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  fontFamily: theme.mono,
                }}
              />

              {bmiValue !== null ? (
                <Text style={{ color: theme.muted, fontFamily: theme.mono }}>
                  BMI: {bmiValue}
                </Text>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <PhotoPicker
                  existingUri={photoUri}
                  onPicked={setPhotoUri}
                  onRemove={() => setPhotoUri(null)}
                />
                <Text style={{ color: theme.muted, fontSize: 12 }}>
                  {photoUri ? t("body.changePhoto") : t("body.addPhoto")}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn label={editing ? t("body.update") : t("common.save")} onPress={saveMetric} tone="accent" />
                {editing ? <Btn label={t("common.cancel")} onPress={resetForm} /> : null}
                {!editing ? (
                  <Btn label={t("common.today")} onPress={() => setDateInput(isoDateOnly())} />
                ) : null}
              </View>
            </View>
          </Card>

          {weightTrend && (
            <Card title={t("body.weightTrend")}>
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                    {t("body.smoothedNote")}
                  </Text>
                  <View style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: weightTrend.phase === "bulk" ? "#FBBF2422" : weightTrend.phase === "cut" ? "#34D39922" : `${theme.muted}22`,
                    borderWidth: 1,
                    borderColor: weightTrend.phase === "bulk" ? "#FBBF24" : weightTrend.phase === "cut" ? "#34D399" : theme.muted,
                  }}>
                    <Text style={{
                      color: weightTrend.phase === "bulk" ? "#FBBF24" : weightTrend.phase === "cut" ? "#34D399" : theme.muted,
                      fontFamily: theme.mono,
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}>
                      {t(`body.phase.${weightTrend.phase}`)}
                    </Text>
                  </View>
                </View>
                <LineChart
                  values={weightTrend.smoothed.map((v) => wu.toDisplay(v))}
                  labels={weightTrend.rawLabels}
                  unit={wu.unitLabel()}
                />
              </View>
            </Card>
          )}

          <Card title={t("body.recentMeasurements")}>
            {metrics.length === 0 ? (
              <Text style={{ color: theme.muted }}>{t("body.noMeasurements")}</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {metrics.map((m) => (
                  <View
                    key={`bm_${m.date}`}
                    style={{
                      borderColor: theme.glassBorder,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: theme.panel2,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      {m.photo_uri ? (
                        <PhotoPicker
                          existingUri={m.photo_uri}
                          onPicked={async (uri) => {
                            await upsertBodyMetric(m.date, m.weight_kg, m.note, uri);
                            await refresh();
                          }}
                          onRemove={async () => {
                            await upsertBodyMetric(m.date, m.weight_kg, m.note, null);
                            await refresh();
                          }}
                        />
                      ) : null}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontFamily: theme.mono }}>
                          {m.date} · {wu.formatWeight(m.weight_kg)}
                        </Text>
                      </View>
                    </View>
                    {parsedHeight > 0 ? (
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                        BMI: {round1(m.weight_kg / ((parsedHeight / 100) * (parsedHeight / 100)))}
                      </Text>
                    ) : null}
                    {m.note ? (
                      <Text style={{ color: theme.muted, marginTop: 6 }}>{m.note}</Text>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                      <Btn label={t("common.edit")} onPress={() => startEdit(m)} />
                      <Btn label={t("common.delete")} tone="danger" onPress={() => confirmDelete(m.date)} />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
