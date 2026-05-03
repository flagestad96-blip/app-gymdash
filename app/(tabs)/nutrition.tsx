// app/(tabs)/nutrition.tsx — Meal logging + daily/weekly macro overview
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTheme } from "../../src/theme";
import { useI18n } from "../../src/i18n";
import { Screen, TopBar, Card, Btn, TextField, IconButton, SegButton } from "../../src/ui";
import { SkeletonCard } from "../../src/components/Skeleton";
import { SuccessToast } from "../../src/ui/modern";
import { isoDateOnly } from "../../src/storage";
import { round1 } from "../../src/metrics";
import { listBodyMetrics, type BodyMetricRow } from "../../src/db";
import {
  createMeal,
  deleteMeal,
  getDailyTotals,
  getDailyTotalsRange,
  getWeeklySummary,
  listMealsByDate,
  MEAL_TYPES,
  updateMeal,
  type DailyTotals,
  type Meal,
  type MealType,
  type WeeklySummary,
} from "../../src/nutritionStore";

// Module-level flag - persists across component remounts (tab switches)
let _nutritionTabInitialized = false;

const MACRO_COLORS = {
  protein: "#7C3AED",
  carbs: "#F97316",
  fat: "#FBBF24",
};

function formatKcal(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString();
}

function formatGrams(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return String(Math.round(value));
}

export default function NutritionScreen() {
  const theme = useTheme();
  const { t } = useI18n();
  const navigation = useNavigation();
  const openDrawer = useCallback(() => {
    const parent = (navigation as any)?.getParent?.();
    if (parent?.openDrawer) parent.openDrawer();
    else if ((navigation as any)?.openDrawer) (navigation as any).openDrawer();
  }, [navigation]);

  const [ready, setReady] = useState(_nutritionTabInitialized);
  const [today, setToday] = useState<string>(isoDateOnly());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dailyTotals, setDailyTotals] = useState<DailyTotals | null>(null);
  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [trend, setTrend] = useState<DailyTotals[]>([]);
  const [latestBodyMetric, setLatestBodyMetric] = useState<BodyMetricRow | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>("breakfast");
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [notes, setNotes] = useState("");
  const [successToast, setSuccessToast] = useState(false);

  const refresh = useCallback(async () => {
    const dateIso = isoDateOnly();
    const [dailyMeals, totals, week, range, bodyMetrics] = await Promise.all([
      listMealsByDate(dateIso),
      getDailyTotals(dateIso),
      getWeeklySummary(dateIso),
      getDailyTotalsRange(7, dateIso),
      listBodyMetrics(1).catch(() => [] as BodyMetricRow[]),
    ]);
    setToday(dateIso);
    setMeals(dailyMeals);
    setDailyTotals(totals);
    setWeekly(week);
    setTrend(range);
    setLatestBodyMetric(bodyMetrics[0] ?? null);
  }, []);

  useEffect(() => {
    if (_nutritionTabInitialized) {
      setReady(true);
      refresh().catch(() => {});
      return;
    }
    let alive = true;
    refresh().finally(() => {
      if (!alive) return;
      setReady(true);
      _nutritionTabInitialized = true;
    });
    return () => { alive = false; };
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh])
  );

  const proteinPerKg = useMemo(() => {
    if (!latestBodyMetric || !dailyTotals || dailyTotals.proteinG === 0) return null;
    if (!Number.isFinite(latestBodyMetric.weight_kg) || latestBodyMetric.weight_kg <= 0) return null;
    return round1(dailyTotals.proteinG / latestBodyMetric.weight_kg);
  }, [latestBodyMetric, dailyTotals]);

  const macroPercent = useMemo(() => {
    if (!dailyTotals) return null;
    const proteinKcal = dailyTotals.proteinG * 4;
    const carbsKcal = dailyTotals.carbsG * 4;
    const fatKcal = dailyTotals.fatG * 9;
    const total = proteinKcal + carbsKcal + fatKcal;
    if (total <= 0) return null;
    return {
      protein: Math.round((proteinKcal / total) * 100),
      carbs: Math.round((carbsKcal / total) * 100),
      fat: Math.round((fatKcal / total) * 100),
    };
  }, [dailyTotals]);

  const trendMaxKcal = useMemo(() => {
    const max = trend.reduce((m, d) => Math.max(m, d.calories), 0);
    return max > 0 ? max : 1;
  }, [trend]);

  function resetForm() {
    setEditingId(null);
    setMealType("breakfast");
    setName("");
    setCalories("");
    setProtein("");
    setCarbs("");
    setFat("");
    setNotes("");
  }

  function startEdit(meal: Meal) {
    setEditingId(meal.id);
    setMealType(meal.mealType);
    setName(meal.name ?? "");
    setCalories(meal.calories > 0 ? String(meal.calories) : "");
    setProtein(meal.proteinG > 0 ? String(meal.proteinG) : "");
    setCarbs(meal.carbsG > 0 ? String(meal.carbsG) : "");
    setFat(meal.fatG > 0 ? String(meal.fatG) : "");
    setNotes(meal.notes ?? "");
  }

  function parseNum(v: string): number {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  async function saveMeal() {
    const cal = parseNum(calories);
    const p = parseNum(protein);
    const c = parseNum(carbs);
    const f = parseNum(fat);

    if (cal === 0 && p === 0 && c === 0 && f === 0) {
      Alert.alert(t("nutrition.invalidInput"), t("nutrition.mustHaveValue"));
      return;
    }

    if (editingId) {
      await updateMeal(editingId, {
        mealType,
        name: name.trim() || null,
        calories: cal,
        proteinG: p,
        carbsG: c,
        fatG: f,
        notes: notes.trim() || null,
      });
    } else {
      await createMeal({
        date: isoDateOnly(),
        mealType,
        name: name.trim() || null,
        calories: cal,
        proteinG: p,
        carbsG: c,
        fatG: f,
        notes: notes.trim() || null,
      });
    }

    resetForm();
    await refresh();
    setSuccessToast(true);
  }

  async function confirmDelete(meal: Meal) {
    Alert.alert(t("nutrition.deleteMeal"), t("nutrition.deleteConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          await deleteMeal(meal.id);
          if (editingId === meal.id) resetForm();
          await refresh();
        },
      },
    ]);
  }

  if (!ready) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md }}>
          <TopBar title={t("nutrition.title")} left={<IconButton icon="menu" onPress={openDrawer} />} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: theme.space.lg, gap: theme.space.md, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <TopBar
            title={t("nutrition.title")}
            subtitle={t("nutrition.subtitle")}
            left={<IconButton icon="menu" onPress={openDrawer} />}
          />

          {/* Today overview */}
          <Card title={t("nutrition.todayOverview")}>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <View>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, letterSpacing: 0.5 }}>
                    {t("nutrition.totalCalories")}
                  </Text>
                  <Text style={{ color: theme.text, fontSize: 32, fontFamily: theme.fontFamily.bold }}>
                    {formatKcal(dailyTotals?.calories ?? 0)}
                    <Text style={{ color: theme.muted, fontSize: 14, fontFamily: theme.mono }}>
                      {" "}{t("nutrition.caloriesShort")}
                    </Text>
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, letterSpacing: 0.5 }}>
                    {t("nutrition.totalProtein")}
                  </Text>
                  <Text style={{ color: MACRO_COLORS.protein, fontSize: 24, fontFamily: theme.fontFamily.bold }}>
                    {formatGrams(dailyTotals?.proteinG ?? 0)}
                    <Text style={{ color: theme.muted, fontSize: 14, fontFamily: theme.mono }}>
                      {" "}{t("nutrition.gramsSuffix")}
                    </Text>
                  </Text>
                  {proteinPerKg !== null ? (
                    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11, marginTop: 2 }}>
                      {t("nutrition.proteinPerKg", { value: proteinPerKg })}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Macro breakdown bar */}
              <MacroBar
                protein={dailyTotals?.proteinG ?? 0}
                carbs={dailyTotals?.carbsG ?? 0}
                fat={dailyTotals?.fatG ?? 0}
              />

              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 6 }}>
                <MacroChip
                  label={t("nutrition.protein")}
                  value={formatGrams(dailyTotals?.proteinG ?? 0)}
                  unit={t("nutrition.gramsSuffix")}
                  percent={macroPercent?.protein}
                  color={MACRO_COLORS.protein}
                />
                <MacroChip
                  label={t("nutrition.carbs")}
                  value={formatGrams(dailyTotals?.carbsG ?? 0)}
                  unit={t("nutrition.gramsSuffix")}
                  percent={macroPercent?.carbs}
                  color={MACRO_COLORS.carbs}
                />
                <MacroChip
                  label={t("nutrition.fat")}
                  value={formatGrams(dailyTotals?.fatG ?? 0)}
                  unit={t("nutrition.gramsSuffix")}
                  percent={macroPercent?.fat}
                  color={MACRO_COLORS.fat}
                />
              </View>
            </View>
          </Card>

          {/* Add meal form */}
          <Card title={editingId ? t("nutrition.editMeal").toUpperCase() : t("nutrition.addMeal")}>
            <View style={{ gap: 10 }}>
              {editingId ? (
                <Text style={{ color: theme.muted, fontSize: 12 }}>{t("nutrition.editing")}</Text>
              ) : null}

              <View style={{ flexDirection: "row", gap: 6 }}>
                {MEAL_TYPES.map((type) => (
                  <SegButton
                    key={type}
                    label={t(`nutrition.mealType.${type}`)}
                    active={mealType === type}
                    onPress={() => setMealType(type)}
                  />
                ))}
              </View>

              <TextField
                value={name}
                onChangeText={setName}
                placeholder={t("nutrition.namePlaceholder")}
                placeholderTextColor={theme.muted}
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={calories}
                    onChangeText={setCalories}
                    placeholder={t("nutrition.kcalPlaceholder")}
                    placeholderTextColor={theme.muted}
                    keyboardType="numeric"
                    suffix={t("nutrition.caloriesShort")}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={protein}
                    onChangeText={setProtein}
                    placeholder={t("nutrition.gramsPlaceholder")}
                    placeholderTextColor={theme.muted}
                    keyboardType="numeric"
                    suffix={`${t("nutrition.proteinShort")} ${t("nutrition.gramsSuffix")}`}
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={carbs}
                    onChangeText={setCarbs}
                    placeholder={t("nutrition.gramsPlaceholder")}
                    placeholderTextColor={theme.muted}
                    keyboardType="numeric"
                    suffix={`${t("nutrition.carbsShort")} ${t("nutrition.gramsSuffix")}`}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={fat}
                    onChangeText={setFat}
                    placeholder={t("nutrition.gramsPlaceholder")}
                    placeholderTextColor={theme.muted}
                    keyboardType="numeric"
                    suffix={`${t("nutrition.fatShort")} ${t("nutrition.gramsSuffix")}`}
                  />
                </View>
              </View>

              <TextField
                value={notes}
                onChangeText={setNotes}
                placeholder={t("nutrition.notesPlaceholder")}
                placeholderTextColor={theme.muted}
              />

              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Btn
                  label={editingId ? t("nutrition.update") : t("nutrition.add")}
                  onPress={saveMeal}
                  tone="accent"
                />
                {editingId ? <Btn label={t("common.cancel")} onPress={resetForm} /> : null}
              </View>
            </View>
          </Card>

          {/* Today's meals */}
          <Card title={t("nutrition.recentMeals")}>
            {meals.length === 0 ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: theme.muted }}>{t("nutrition.noMealsToday")}</Text>
                <Text style={{ color: theme.muted, fontSize: 12, fontFamily: theme.mono }}>
                  {t("nutrition.startLogging")}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {meals.map((meal) => (
                  <MealRow
                    key={meal.id}
                    meal={meal}
                    onEdit={() => startEdit(meal)}
                    onDelete={() => confirmDelete(meal)}
                  />
                ))}
              </View>
            )}
          </Card>

          {/* Weekly trend bar chart */}
          {trend.length > 0 && (
            <Card title={t("nutrition.weeklyTrend")}>
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 100, gap: 4 }}>
                  {trend.map((d) => {
                    const heightPct = (d.calories / trendMaxKcal) * 100;
                    const isToday = d.date === today;
                    return (
                      <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                        <View
                          style={{
                            width: "100%",
                            height: `${Math.max(heightPct, 2)}%`,
                            borderRadius: 4,
                            backgroundColor: isToday ? theme.accent : `${theme.accent}55`,
                            minHeight: 2,
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 4 }}>
                  {trend.map((d) => {
                    const isToday = d.date === today;
                    const day = d.date.slice(8, 10);
                    return (
                      <Text
                        key={`label_${d.date}`}
                        style={{
                          flex: 1,
                          textAlign: "center",
                          color: isToday ? theme.accent : theme.muted,
                          fontFamily: theme.mono,
                          fontSize: 10,
                        }}
                      >
                        {day}
                      </Text>
                    );
                  })}
                </View>
              </View>
            </Card>
          )}

          {/* Weekly average */}
          {weekly && (
            <Card title={t("nutrition.weeklyAverage")}>
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                    {t("nutrition.daysOf7", { n: weekly.daysWithLogs })}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <SummaryStat
                    label={t("nutrition.calories")}
                    value={formatKcal(weekly.averages.calories)}
                    unit={t("nutrition.caloriesShort")}
                    color={theme.accent}
                  />
                  <SummaryStat
                    label={t("nutrition.protein")}
                    value={formatGrams(weekly.averages.proteinG)}
                    unit={t("nutrition.gramsSuffix")}
                    color={MACRO_COLORS.protein}
                  />
                  <SummaryStat
                    label={t("nutrition.carbs")}
                    value={formatGrams(weekly.averages.carbsG)}
                    unit={t("nutrition.gramsSuffix")}
                    color={MACRO_COLORS.carbs}
                  />
                  <SummaryStat
                    label={t("nutrition.fat")}
                    value={formatGrams(weekly.averages.fatG)}
                    unit={t("nutrition.gramsSuffix")}
                    color={MACRO_COLORS.fat}
                  />
                </View>
                <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
                  {t("nutrition.proteinFocus")}
                </Text>
              </View>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      <SuccessToast visible={successToast} message={t("nutrition.saved")} onDismiss={() => setSuccessToast(false)} />
    </Screen>
  );
}

// ── Subcomponents ──────────────────────────────────────────

function MacroBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const theme = useTheme();
  const proteinKcal = protein * 4;
  const carbsKcal = carbs * 4;
  const fatKcal = fat * 9;
  const total = proteinKcal + carbsKcal + fatKcal;

  if (total <= 0) {
    return (
      <View
        style={{
          height: 10,
          borderRadius: 6,
          backgroundColor: theme.panel2,
          borderWidth: 1,
          borderColor: theme.glassBorder,
        }}
      />
    );
  }

  const pP = (proteinKcal / total) * 100;
  const pC = (carbsKcal / total) * 100;
  const pF = (fatKcal / total) * 100;

  return (
    <View
      style={{
        flexDirection: "row",
        height: 10,
        borderRadius: 6,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: theme.glassBorder,
      }}
    >
      {pP > 0 ? <View style={{ width: `${pP}%`, backgroundColor: MACRO_COLORS.protein }} /> : null}
      {pC > 0 ? <View style={{ width: `${pC}%`, backgroundColor: MACRO_COLORS.carbs }} /> : null}
      {pF > 0 ? <View style={{ width: `${pF}%`, backgroundColor: MACRO_COLORS.fat }} /> : null}
    </View>
  );
}

function MacroChip({
  label,
  value,
  unit,
  percent,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  percent?: number;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        backgroundColor: theme.panel2,
        paddingVertical: 8,
        paddingHorizontal: 8,
        gap: 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 14 }}>
        {value}
        <Text style={{ color: theme.muted, fontSize: 11, fontFamily: theme.mono }}> {unit}</Text>
      </Text>
      {percent !== undefined ? (
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 }}>
          {percent}%
        </Text>
      ) : null}
    </View>
  );
}

function SummaryStat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.glassBorder,
        backgroundColor: theme.panel2,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 0.5 }}>
          {label.toUpperCase()}
        </Text>
      </View>
      <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 16, marginTop: 2 }}>
        {value}
        <Text style={{ color: theme.muted, fontSize: 12, fontFamily: theme.mono }}> {unit}</Text>
      </Text>
    </View>
  );
}

function MealRow({
  meal,
  onEdit,
  onDelete,
}: {
  meal: Meal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const title = meal.name?.trim() || t(`nutrition.mealType.${meal.mealType}`);
  return (
    <View
      style={{
        borderColor: theme.glassBorder,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        backgroundColor: theme.panel2,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 0.5 }}>
            {t(`nutrition.mealType.${meal.mealType}`).toUpperCase()}
          </Text>
          <Text style={{ color: theme.text, fontFamily: theme.fontFamily.semibold, fontSize: 15 }}>
            {title}
          </Text>
        </View>
        <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 14 }}>
          {formatKcal(meal.calories)}
          <Text style={{ color: theme.muted, fontSize: 11 }}> {t("nutrition.caloriesShort")}</Text>
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Text style={{ color: MACRO_COLORS.protein, fontFamily: theme.mono, fontSize: 12 }}>
          {t("nutrition.proteinShort")} {formatGrams(meal.proteinG)}{t("nutrition.gramsSuffix")}
        </Text>
        <Text style={{ color: MACRO_COLORS.carbs, fontFamily: theme.mono, fontSize: 12 }}>
          {t("nutrition.carbsShort")} {formatGrams(meal.carbsG)}{t("nutrition.gramsSuffix")}
        </Text>
        <Text style={{ color: MACRO_COLORS.fat, fontFamily: theme.mono, fontSize: 12 }}>
          {t("nutrition.fatShort")} {formatGrams(meal.fatG)}{t("nutrition.gramsSuffix")}
        </Text>
      </View>

      {meal.notes ? (
        <Text style={{ color: theme.muted, fontSize: 12 }}>{meal.notes}</Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
        <Btn label={t("common.edit")} onPress={onEdit} small />
        <Btn label={t("common.delete")} tone="danger" onPress={onDelete} small />
      </View>
    </View>
  );
}
