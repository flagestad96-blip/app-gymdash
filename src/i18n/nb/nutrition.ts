import type { TranslationMap } from "../types";

const nutrition: TranslationMap = {
  // ── Navigation ──
  "nav.nutrition": "Kosthold",

  // ── Screen ──
  "nutrition.title": "Kosthold",
  "nutrition.subtitle": "Logg måltider og makroer",

  // ── Sections ──
  "nutrition.addMeal": "LEGG TIL MÅLTID",
  "nutrition.todayOverview": "DAGENS OVERSIKT",
  "nutrition.weeklyAverage": "UKENTLIG SNITT",
  "nutrition.recentMeals": "MÅLTIDER",
  "nutrition.weeklyTrend": "7-DAGERS TREND",

  // ── Meal types ──
  "nutrition.mealType.breakfast": "Frokost",
  "nutrition.mealType.lunch": "Lunsj",
  "nutrition.mealType.dinner": "Middag",
  "nutrition.mealType.snack": "Snack",

  // ── Form ──
  "nutrition.namePlaceholder": "Navn (f.eks. Kylling og ris)",
  "nutrition.notesPlaceholder": "Notat (valgfritt)",
  "nutrition.calories": "Kalorier",
  "nutrition.caloriesShort": "kcal",
  "nutrition.protein": "Protein",
  "nutrition.carbs": "Karbohydrater",
  "nutrition.fat": "Fett",
  "nutrition.proteinShort": "P",
  "nutrition.carbsShort": "K",
  "nutrition.fatShort": "F",
  "nutrition.gramsSuffix": "g",
  "nutrition.kcalPlaceholder": "0",
  "nutrition.gramsPlaceholder": "0",

  // ── Stats ──
  "nutrition.totalCalories": "Totalt kalorier",
  "nutrition.totalProtein": "Totalt protein",
  "nutrition.proteinFocus": "Proteinfokus for styrke",
  "nutrition.macroBreakdown": "Makrofordeling",
  "nutrition.dailyAverage": "Dagsnitt",
  "nutrition.daysLogged": "Dager logget",
  "nutrition.daysOf7": "{n} av 7 dager",
  "nutrition.noMeals": "Ingen måltider logget ennå.",
  "nutrition.noMealsToday": "Ingen måltider i dag.",
  "nutrition.startLogging": "Start med å legge til frokost over.",
  "nutrition.proteinPerKg": "{value} g/kg",

  // ── Actions ──
  "nutrition.add": "Legg til",
  "nutrition.update": "Oppdater",
  "nutrition.editMeal": "Rediger måltid",
  "nutrition.deleteMeal": "Slett måltid?",
  "nutrition.deleteConfirm": "Dette kan ikke angres.",
  "nutrition.editing": "Redigerer",
  "nutrition.saved": "Lagret",

  // ── Validation ──
  "nutrition.invalidInput": "Ugyldig verdi",
  "nutrition.mustHaveValue": "Skriv inn minst kalorier eller en makro.",
};

export default nutrition;
