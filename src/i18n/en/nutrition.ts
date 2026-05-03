import type { TranslationMap } from "../types";

const nutrition: TranslationMap = {
  // ── Navigation ──
  "nav.nutrition": "Nutrition",

  // ── Screen ──
  "nutrition.title": "Nutrition",
  "nutrition.subtitle": "Log meals and macros",

  // ── Sections ──
  "nutrition.addMeal": "ADD MEAL",
  "nutrition.todayOverview": "TODAY",
  "nutrition.weeklyAverage": "WEEKLY AVERAGE",
  "nutrition.recentMeals": "MEALS",
  "nutrition.weeklyTrend": "7-DAY TREND",

  // ── Meal types ──
  "nutrition.mealType.breakfast": "Breakfast",
  "nutrition.mealType.lunch": "Lunch",
  "nutrition.mealType.dinner": "Dinner",
  "nutrition.mealType.snack": "Snack",

  // ── Form ──
  "nutrition.namePlaceholder": "Name (e.g. Chicken and rice)",
  "nutrition.notesPlaceholder": "Note (optional)",
  "nutrition.calories": "Calories",
  "nutrition.caloriesShort": "kcal",
  "nutrition.protein": "Protein",
  "nutrition.carbs": "Carbs",
  "nutrition.fat": "Fat",
  "nutrition.proteinShort": "P",
  "nutrition.carbsShort": "C",
  "nutrition.fatShort": "F",
  "nutrition.gramsSuffix": "g",
  "nutrition.kcalPlaceholder": "0",
  "nutrition.gramsPlaceholder": "0",

  // ── Stats ──
  "nutrition.totalCalories": "Total calories",
  "nutrition.totalProtein": "Total protein",
  "nutrition.proteinFocus": "Protein focus for strength",
  "nutrition.macroBreakdown": "Macro breakdown",
  "nutrition.dailyAverage": "Daily average",
  "nutrition.daysLogged": "Days logged",
  "nutrition.daysOf7": "{n} of 7 days",
  "nutrition.noMeals": "No meals logged yet.",
  "nutrition.noMealsToday": "No meals logged today.",
  "nutrition.startLogging": "Start by adding breakfast above.",
  "nutrition.proteinPerKg": "{value} g/kg",

  // ── Actions ──
  "nutrition.add": "Add",
  "nutrition.update": "Update",
  "nutrition.editMeal": "Edit meal",
  "nutrition.deleteMeal": "Delete meal?",
  "nutrition.deleteConfirm": "This cannot be undone.",
  "nutrition.editing": "Editing",
  "nutrition.saved": "Saved",

  // ── Validation ──
  "nutrition.invalidInput": "Invalid value",
  "nutrition.mustHaveValue": "Enter at least calories or one macro.",
};

export default nutrition;
