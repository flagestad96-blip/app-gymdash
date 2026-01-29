// app/(tabs)/body.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { theme } from "../../src/theme";
import { deleteBodyMetric, listBodyMetrics, upsertBodyMetric, getSettingAsync, setSettingAsync, type BodyMetricRow } from "../../src/db";
import { Screen, TopBar, Card, Btn, TextField, IconButton } from "../../src/ui";

function isoDateOnly(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export default function BodyScreen() {
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
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    const rows = await listBodyMetrics();
    setMetrics(rows ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      const h = await getSettingAsync("height_cm");
      if (h) setHeightCm(h);
      await refresh();
    })();
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
    const w = Number.isFinite(parsedWeightInput) ? parsedWeightInput : latestMetric?.weight_kg;
    if (!Number.isFinite(w ?? NaN)) return null;
    const hM = hCm / 100;
    return round1((w as number) / (hM * hM));
  }, [parsedHeight, parsedWeightInput, latestMetric]);

  async function saveMetric() {
    const w = Number(weightInput);
    if (!Number.isFinite(w) || w <= 0) {
      Alert.alert("Ugyldig vekt", "Skriv inn en gyldig vekt i kg.");
      return;
    }
    await upsertBodyMetric(dateInput, w, noteInput.trim() || null);
    setEditing(false);
    setDateInput(isoDateOnly());
    setWeightInput("");
    setNoteInput("");
    await refresh();
  }

  function startEdit(row: BodyMetricRow) {
    setEditing(true);
    setDateInput(row.date);
    setWeightInput(String(row.weight_kg));
    setNoteInput(row.note ?? "");
  }

  function resetForm() {
    setEditing(false);
    setDateInput(isoDateOnly());
    setWeightInput("");
    setNoteInput("");
  }

  async function confirmDelete(date: string) {
    Alert.alert("Slett måling?", "Dette kan ikke angres.", [
      { text: "Avbryt", style: "cancel" },
      {
        text: "Slett",
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
      <TopBar title="Kropp" subtitle="Vekt og BMI" left={<IconButton icon="menu" onPress={openDrawer} />} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Card title="REGISTRER">
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                  Dato: {dateInput}
                </Text>
                {editing ? <Text style={{ color: theme.muted, fontSize: 12 }}>Redigerer</Text> : null}
              </View>

              <TextField
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder="Vekt i dag (kg)"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                style={{
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.line,
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  fontFamily: theme.mono,
                }}
              />

              <TextField
                value={noteInput}
                onChangeText={setNoteInput}
                placeholder="Notat (valgfritt)"
                placeholderTextColor={theme.muted}
                style={{
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.line,
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
                placeholder="Høyde (cm)"
                placeholderTextColor={theme.muted}
                keyboardType="numeric"
                style={{
                  color: theme.text,
                  backgroundColor: theme.panel2,
                  borderColor: theme.line,
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

              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn label={editing ? "Oppdater" : "Lagre"} onPress={saveMetric} tone="accent" />
                {editing ? <Btn label="Avbryt" onPress={resetForm} /> : null}
                {!editing ? (
                  <Btn label="I dag" onPress={() => setDateInput(isoDateOnly())} />
                ) : null}
              </View>
            </View>
          </Card>

          <Card title="SISTE MÅLINGER">
            {metrics.length === 0 ? (
              <Text style={{ color: theme.muted }}>Ingen målinger ennå.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {metrics.map((m) => (
                  <View
                    key={`bm_${m.date}`}
                    style={{
                      borderColor: theme.line,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: theme.panel2,
                    }}
                  >
                    <Text style={{ color: theme.text, fontFamily: theme.mono }}>
                      {m.date} · {m.weight_kg} kg
                    </Text>
                    {parsedHeight > 0 ? (
                      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
                        BMI: {round1(m.weight_kg / ((parsedHeight / 100) * (parsedHeight / 100)))}
                      </Text>
                    ) : null}
                    {m.note ? (
                      <Text style={{ color: theme.muted, marginTop: 6 }}>{m.note}</Text>
                    ) : null}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                      <Btn label="Rediger" onPress={() => startEdit(m)} />
                      <Btn label="Slett" tone="danger" onPress={() => confirmDelete(m.date)} />
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
