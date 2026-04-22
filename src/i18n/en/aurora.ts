import type { TranslationMap } from "../types";

// i18n keys for aurora-redesign screens (Summary / Library / Exercise detail / Nutrition)
const aurora: TranslationMap = {
  // Summary
  "summary.complete": "Workout complete",
  "summary.niceWork": "Nice work,",
  "summary.niceWorkAccent": "you",
  "summary.subtitle": "Another one in the books.",
  "summary.exercises": "Exercises",
  "summary.newPrs": "{n} new personal records",
  "summary.feelTitle": "HOW DID IT FEEL?",
  "summary.feel.easy": "Easy",
  "summary.feel.good": "Good",
  "summary.feel.hard": "Hard",
  "summary.feel.brutal": "Brutal",
  "summary.share": "Share",
  "summary.done": "Done",
  // Legacy key kept in case other code still reads it
  "summary.header": "Session complete",
  "summary.title": "Nice work.",
  "summary.rpe": "HOW HARD WAS IT?",
  "summary.rpeDesc": "RPE helps Gymdash plan the next session.",

  // Library
  "library.subtitle": "Every exercise in Gymdash.",
  "library.searchPlaceholder": "Search exercises",
  "library.empty": "No exercises match your search.",
  "library.tab.programs": "Programs",
  "library.tab.exercises": "Exercises",
  "library.active": "Active",
  "library.daysPerWeek": "{n}/wk",
  "library.noPrograms": "No programs yet. Create one from Profile.",

  // Exercise detail
  "exerciseDetail.notFound": "Exercise not found",
  "exerciseDetail.prs": "PERSONAL RECORDS",
  "exerciseDetail.noPrs": "No PRs yet — log a few sets to set a baseline.",
  "exerciseDetail.history": "History",
  "exerciseDetail.noHistory": "You haven't logged this exercise yet.",
  "exerciseDetail.backImpact.high": "High back load",
  "exerciseDetail.backImpact.medium": "Moderate back load",
  "exerciseDetail.backImpact.low": "Back-friendly",
  "exerciseDetail.general": "Multiple muscle groups",
  "exerciseDetail.demoPlaceholder": "exercise demonstration",
  "exerciseDetail.oneRmEst": "1RM est.",
  "exerciseDetail.bestSet": "Best set",
  "exerciseDetail.cues": "Cues",
  "exerciseDetail.newPr": "New PR",

  // Workout
  "workout.freeSession": "Free session",
  "workout.exerciseCounter": "Exercise {i} of {n}",
  "workout.target": "Target",
  "workout.weight": "Weight",
  "workout.setLabel": "Set",
  "workout.logSet": "Log set · start rest",
  "workout.upNext": "Up next",
  "workout.rest": "Rest",
  "workout.restHint": "breathe · sip · reset",
  "workout.skipRest": "Skip rest",
  "workout.pause": "Pause",
  "workout.resume": "Resume",
  "workout.finish": "Finish workout",
  "workout.empty.pill": "No program yet",
  "workout.empty.title": "Pick a program to start logging",
  "workout.empty.body": "Gymdash needs to know what you're training before it can track sets and rest. Choose a template in Profile → Program.",
  "workout.empty.goToProfile": "Open profile",

  // Stats (aurora hero)
  "stats.title": "Your progress",
  "stats.trainingVolume": "Training volume",
  "stats.workouts": "Workouts",
  "stats.thisMonthCount": "+{n} this month",
  "stats.avgDuration": "Avg duration",
  "stats.min": "min",
  "stats.steady": "steady",
  "stats.personalRecords": "Personal records",
  "stats.oneRmEst": "1RM estimate",
  "stats.body": "Body",
  "stats.weight": "Weight",

  // Profile hero
  "profile.initial": "Y",
  "profile.greeting": "You",
  "profile.memberSince": "Member since {date}",
  "profile.trainingsPerWeek": "{n}× / week",
  "profile.level.beginner": "Beginner",
  "profile.level.intermediate": "Intermediate",
  "profile.level.advanced": "Advanced",
  "profile.stat.workouts": "Workouts",
  "profile.stat.prs": "PRs",
  "profile.more": "More",

  // Log (calendar)
  "log.legend.push": "Push",
  "log.legend.pull": "Pull",
  "log.legend.legs": "Legs",
  "log.thisMonth": "This month",
  "log.sessions": "sessions",
  "log.consistency": "Consistency",
  "log.onTrack": "On track",
  "log.keepGoing": "Keep going",

  // Nutrition
  "nutrition.subtitle": "Today's intake at a glance.",
  "nutrition.today": "Today",
  "nutrition.kcalOfGoal": "Calories of goal",
  "nutrition.empty": "No entries yet. Full logging lands in the next release.",
  "nutrition.ofTarget": "of {target} kcal",
  "nutrition.macro.protein": "Protein",
  "nutrition.macro.carbs": "Carbs",
  "nutrition.macro.fat": "Fat",
  "nutrition.todayMeals": "Today's meals",
  "nutrition.logMeal": "Log a meal",
};

export default aurora;
