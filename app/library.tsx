// app/library.tsx — Library (aurora)
//
// Port of Gymdash.html's <Library> component:
//
//   ScreenHeader "Library"
//   Segmented tab: Programs | Exercises (gradient fill on active)
//   Tab=Programs: rich glass cards with icon, name, Active pill, meta line,
//     progress bar for the active program.
//   Tab=Exercises: simple glass rows with icon, name, muscle groups, arrow.
//
// Tapping an exercise pushes `/exercise-detail?id=...`.
// Programs are read from the existing ProgramStore; the active one is marked.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../src/theme";
import { useI18n } from "../src/i18n";
import { EXERCISES, displayNameFor, tagsFor, type ExerciseDef } from "../src/exerciseLibrary";
import ProgramStore, { type Program } from "../src/programStore";
import { getSettingAsync } from "../src/db";
import { GlassCard, Pill, Mono } from "../src/ui/modern";

type Tab = "programs" | "exercises";

export default function LibraryScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("programs");
  const [query, setQuery] = useState("");
  const [programs, setPrograms] = useState<Program[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // ── Load programs ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const mode = ((await getSettingAsync("programMode")) === "back" ? "back" : "normal") as "normal" | "back";
      const list = await ProgramStore.listPrograms(mode);
      const active = await ProgramStore.getActiveProgramIdForMode(mode);
      setPrograms(list ?? []);
      setActiveId(active ?? null);
    } catch {}
  }, []);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const filteredExercises = useMemo<ExerciseDef[]>(() => {
    if (!query.trim()) return EXERCISES;
    const q = query.toLowerCase();
    return EXERCISES.filter((e) => displayNameFor(e.id).toLowerCase().includes(q));
  }, [query]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "transparent" }} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4, marginBottom: 14 }}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
              alignItems: "center", justifyContent: "center",
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <MaterialIcons name="arrow-back" size={16} color="#fff" />
          </Pressable>
          <Text style={{ flex: 1, color: theme.text, fontSize: 22, fontFamily: theme.fontFamily.serif, letterSpacing: -0.2 }}>
            {t("nav.library")}
          </Text>
        </View>

        {/* Segmented tabs */}
        <View
          style={{
            flexDirection: "row",
            gap: 6,
            backgroundColor: "rgba(255,255,255,0.05)",
            padding: 4,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            marginBottom: 14,
          }}
        >
          {(["programs", "exercises"] as Tab[]).map((id) => {
            const active = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={{ flex: 1, height: 36, borderRadius: 9, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
              >
                {active ? (
                  <LinearGradient
                    colors={["rgba(96,165,250,0.3)", "rgba(192,132,252,0.3)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                <Text style={{ color: active ? "#fff" : theme.muted2, fontSize: 12, fontFamily: theme.fontFamily.medium }}>
                  {t(`library.tab.${id}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === "programs" ? <ProgramsTab programs={programs} activeId={activeId} /> : null}
        {tab === "exercises" ? (
          <ExercisesTab
            query={query}
            onQuery={setQuery}
            exercises={filteredExercises}
            router={router}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Programs tab ─────────────────────────────────────────────────────────────

function ProgramsTab({ programs, activeId }: { programs: Program[]; activeId: string | null }) {
  const theme = useTheme();
  const { t } = useI18n();

  if (programs.length === 0) {
    return (
      <GlassCard padding={18}>
        <Text style={{ color: theme.muted, textAlign: "center" }}>
          {t("library.noPrograms")}
        </Text>
      </GlassCard>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {programs.map((p) => {
        const isActive = p.id === activeId;
        const meta = buildProgramMeta(p, t);
        return (
          <GlassCard key={p.id} radius={20} padding={16} strong={isActive}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
              <View
                style={{
                  width: 48, height: 48, borderRadius: 14,
                  alignItems: "center", justifyContent: "center",
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.12)",
                  backgroundColor: isActive ? "transparent" : "rgba(255,255,255,0.06)",
                }}
              >
                {isActive ? (
                  <LinearGradient
                    colors={[theme.aurora.blue, theme.aurora.violet]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                <MaterialIcons name="auto-awesome" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <Text
                    style={{ color: theme.text, fontSize: 15, fontFamily: theme.fontFamily.semibold }}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  {isActive ? <Pill tone="violet">{t("library.active")}</Pill> : null}
                </View>
                <Text style={{ color: theme.muted2, fontSize: 11, marginTop: 2 }}>{meta}</Text>
              </View>
            </View>
          </GlassCard>
        );
      })}
    </View>
  );
}

function buildProgramMeta(p: Program, t: (k: string, v?: Record<string, string | number>) => string): string {
  const parts: string[] = [];
  if (p.days?.length) parts.push(t("library.daysPerWeek", { n: p.days.length }));
  return parts.join(" · ");
}

// ── Exercises tab ────────────────────────────────────────────────────────────

function ExercisesTab({
  query, onQuery, exercises, router,
}: {
  query: string;
  onQuery: (s: string) => void;
  exercises: ExerciseDef[];
  router: ReturnType<typeof useRouter>;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 14,
          backgroundColor: theme.glass,
          borderWidth: 1,
          borderColor: theme.glassBorder,
          marginBottom: 10,
        }}
      >
        <MaterialIcons name="search" size={18} color={theme.muted2} />
        <TextInput
          value={query}
          onChangeText={onQuery}
          placeholder={t("library.searchPlaceholder")}
          placeholderTextColor={theme.muted2}
          style={{ flex: 1, color: theme.text, fontSize: 15, fontFamily: theme.fontFamily.regular }}
        />
      </View>

      {exercises.length === 0 ? (
        <GlassCard padding={18}>
          <Text style={{ color: theme.muted, textAlign: "center" }}>{t("library.empty")}</Text>
        </GlassCard>
      ) : (
        <View style={{ gap: 8 }}>
          {exercises.map((ex) => (
            <Pressable
              key={ex.id}
              onPress={() => router.push({ pathname: "/exercise-detail", params: { id: ex.id } })}
            >
              <GlassCard radius={16} padding={12}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 40, height: 40, borderRadius: 12,
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <MaterialIcons name="fitness-center" size={18} color="rgba(255,255,255,0.7)" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: theme.text, fontSize: 14, fontFamily: theme.fontFamily.medium }} numberOfLines={1}>
                      {displayNameFor(ex.id)}
                    </Text>
                    <Text style={{ color: theme.muted2, fontSize: 11, marginTop: 1 }} numberOfLines={1}>
                      {tagsFor(ex.id).slice(0, 3).join(" · ")}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-forward" size={16} color="rgba(255,255,255,0.4)" />
                </View>
              </GlassCard>
            </Pressable>
          ))}
        </View>
      )}
    </>
  );
}
