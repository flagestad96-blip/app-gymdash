// src/patchNotes.ts — Changelog / patch notes system
//
// The newest entry MUST match `expo.version` in app.json. The helper script
// `scripts/check-version.js` (wired into `npm run verify`) enforces this.

import Constants from "expo-constants";

export type PatchNote = {
  version: string;
  date: string;
  changes: { type: "new" | "improved" | "fix"; key: string }[];
};

/**
 * Changelog entries, newest first.
 * Each change uses an i18n key so notes appear in the user's language.
 * When adding a new entry, also add matching keys in
 * `src/i18n/en/patchNotes.ts` and `src/i18n/nb/patchNotes.ts`.
 */
export const patchNotes: PatchNote[] = [
  {
    version: "0.15.0-beta",
    date: "2026-08-25",
    changes: [
      { type: "new", key: "patchNotes.0_15_0.supersetControl" },
      { type: "new", key: "patchNotes.0_15_0.skipExercise" },
      { type: "new", key: "patchNotes.0_15_0.swapAny" },
      { type: "new", key: "patchNotes.0_15_0.fullHistory" },
      { type: "new", key: "patchNotes.0_15_0.homeDayPick" },
      { type: "improved", key: "patchNotes.0_15_0.firstSetSuggestion" },
      { type: "improved", key: "patchNotes.0_15_0.restSettings" },
      { type: "fix", key: "patchNotes.0_15_0.commaDecimal" },
      { type: "fix", key: "patchNotes.0_15_0.uxFixes" },
    ],
  },
  {
    version: "0.14.1-beta",
    date: "2026-08-24",
    changes: [
      { type: "new", key: "patchNotes.0_14_0.warmupRamp" },
      { type: "new", key: "patchNotes.0_14_0.comebackRamp" },
      { type: "new", key: "patchNotes.0_14_0.restCountdown" },
      { type: "new", key: "patchNotes.0_14_0.liveStats" },
      { type: "new", key: "patchNotes.0_14_0.muscleBalance" },
      { type: "improved", key: "patchNotes.0_14_0.uiPolish" },
      { type: "fix", key: "patchNotes.0_14_0.restNotification" },
      { type: "fix", key: "patchNotes.0_14_0.keepPosition" },
      { type: "fix", key: "patchNotes.0_14_0.bottomBar" },
    ],
  },
  {
    version: "0.13.0-beta",
    date: "2026-08-23",
    changes: [
      { type: "new", key: "patchNotes.0_13_0.superset" },
      { type: "new", key: "patchNotes.0_13_0.coach" },
      { type: "new", key: "patchNotes.0_13_0.comeback" },
      { type: "new", key: "patchNotes.0_13_0.autoBackup" },
      { type: "new", key: "patchNotes.0_13_0.repMax" },
      { type: "new", key: "patchNotes.0_13_0.backLoad" },
      { type: "improved", key: "patchNotes.0_13_0.font" },
      { type: "improved", key: "patchNotes.0_13_0.equipmentPicker" },
      { type: "fix", key: "patchNotes.0_13_0.restNotification" },
      { type: "fix", key: "patchNotes.0_13_0.contrast" },
      { type: "fix", key: "patchNotes.0_13_0.stats" },
    ],
  },
  {
    version: "0.12.0-beta",
    date: "2026-06-10",
    changes: [
      { type: "improved", key: "patchNotes.0_12_0.restBar" },
      { type: "new", key: "patchNotes.0_12_0.restExpand" },
      { type: "new", key: "patchNotes.0_12_0.restDone" },
      { type: "new", key: "patchNotes.0_12_0.workoutManage" },
      { type: "fix", key: "patchNotes.0_12_0.prSummary" },
      { type: "fix", key: "patchNotes.0_12_0.analysisLink" },
    ],
  },
  {
    version: "0.11.0-beta",
    date: "2026-06-03",
    changes: [
      { type: "improved", key: "patchNotes.0_11_0.restDeclutter" },
      { type: "new", key: "patchNotes.0_11_0.restNote" },
      { type: "new", key: "patchNotes.0_11_0.restNextUp" },
      { type: "improved", key: "patchNotes.0_11_0.noFinalTimer" },
      { type: "fix", key: "patchNotes.0_11_0.newIcon" },
    ],
  },
  {
    version: "0.10.0-beta",
    date: "2026-06-02",
    changes: [
      { type: "improved", key: "patchNotes.0_10_0.aurora" },
      { type: "new", key: "patchNotes.0_10_0.personalization" },
      { type: "improved", key: "patchNotes.0_10_0.nav" },
      { type: "improved", key: "patchNotes.0_10_0.logFocus" },
      { type: "new", key: "patchNotes.0_10_0.restOverlay" },
      { type: "fix", key: "patchNotes.0_10_0.chipFix" },
    ],
  },
  {
    version: "0.9.7-beta",
    date: "2026-05-13",
    changes: [
      { type: "improved", key: "patchNotes.0_9_7.loggTab" },
      { type: "new", key: "patchNotes.0_9_7.workoutDetail" },
      { type: "new", key: "patchNotes.0_9_7.endWorkoutButton" },
      { type: "new", key: "patchNotes.0_9_7.resumeBanner" },
      { type: "new", key: "patchNotes.0_9_7.endPrompt" },
      { type: "new", key: "patchNotes.0_9_7.threeWaySuperset" },
      { type: "improved", key: "patchNotes.0_9_7.supersetEdit" },
      { type: "new", key: "patchNotes.0_9_7.sharedAddSet" },
      { type: "improved", key: "patchNotes.0_9_7.supersetButtons" },
      { type: "new", key: "patchNotes.0_9_7.dayNames" },
      { type: "new", key: "patchNotes.0_9_7.setNotes" },
      { type: "improved", key: "patchNotes.0_9_7.calendarDialog" },
      { type: "fix", key: "patchNotes.0_9_7.chipCropping" },
      { type: "fix", key: "patchNotes.0_9_7.searchKeyboard" },
      { type: "fix", key: "patchNotes.0_9_7.stopwatchOverlap" },
      { type: "fix", key: "patchNotes.0_9_7.scrollOffset" },
      { type: "fix", key: "patchNotes.0_9_7.addExerciseSearch" },
      { type: "improved", key: "patchNotes.0_9_7.versionHygiene" },
    ],
  },
  {
    version: "0.9.6-beta",
    date: "2026-02-27",
    changes: [
      { type: "new", key: "patchNotes.0_9_6.adHocExercises" },
      { type: "new", key: "patchNotes.0_9_6.setTracking" },
      { type: "improved", key: "patchNotes.0_9_6.notificationToggles" },
      { type: "fix", key: "patchNotes.0_9_6.doubleRestNotif" },
      { type: "fix", key: "patchNotes.0_9_6.abandonedWorkout" },
      { type: "fix", key: "patchNotes.0_9_6.staleQuery" },
      { type: "fix", key: "patchNotes.0_9_6.duplicateAdHoc" },
      { type: "fix", key: "patchNotes.0_9_6.flatlistOverflow" },
    ],
  },
  {
    version: "0.9.5-beta",
    date: "2026-02-26",
    changes: [
      { type: "new", key: "patchNotes.0_9_5.exerciseGoals" },
      { type: "improved", key: "patchNotes.0_9_5.drawerCleanup" },
      { type: "fix", key: "patchNotes.0_9_5.trainingIntel" },
      { type: "fix", key: "patchNotes.0_9_5.rpeFiltering" },
    ],
  },
  {
    version: "0.9.1-beta",
    date: "2026-02-05",
    changes: [
      { type: "new", key: "patchNotes.0_9_1.localeDetection" },
      { type: "new", key: "patchNotes.0_9_1.weightUnitDetection" },
      { type: "new", key: "patchNotes.0_9_1.perSideExercises" },
      { type: "improved", key: "patchNotes.0_9_1.skeletonLoading" },
      { type: "improved", key: "patchNotes.0_9_1.backgroundPreload" },
    ],
  },
  {
    version: "0.9.0-beta",
    date: "2026-02-04",
    changes: [
      { type: "new", key: "patchNotes.0_9_0.perExerciseRest" },
      { type: "new", key: "patchNotes.0_9_0.customRestPresets" },
      { type: "new", key: "patchNotes.0_9_0.achievementNav" },
      { type: "new", key: "patchNotes.0_9_0.onboarding" },
      { type: "improved", key: "patchNotes.0_9_0.exportImport" },
      { type: "improved", key: "patchNotes.0_9_0.modalScroll" },
      { type: "fix", key: "patchNotes.0_9_0.exerciseSwap" },
      { type: "fix", key: "patchNotes.0_9_0.missingI18n" },
      { type: "fix", key: "patchNotes.0_9_0.calendarArrows" },
      { type: "fix", key: "patchNotes.0_9_0.tyngsteTypo" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-02-03",
    changes: [
      { type: "new", key: "patchNotes.1_0_0.backImpact" },
      { type: "new", key: "patchNotes.1_0_0.rpeHelper" },
      { type: "new", key: "patchNotes.1_0_0.finishSummary" },
      { type: "new", key: "patchNotes.1_0_0.equipmentLabel" },
      { type: "new", key: "patchNotes.1_0_0.templates" },
      { type: "new", key: "patchNotes.1_0_0.periodization" },
      { type: "new", key: "patchNotes.1_0_0.fileBackup" },
      { type: "new", key: "patchNotes.1_0_0.progressPhotos" },
      { type: "new", key: "patchNotes.1_0_0.sharing" },
      { type: "new", key: "patchNotes.1_0_0.strengthStandards" },
      { type: "new", key: "patchNotes.1_0_0.radarChart" },
      { type: "new", key: "patchNotes.1_0_0.notifications" },
      { type: "improved", key: "patchNotes.1_0_0.exerciseLibrary" },
      { type: "improved", key: "patchNotes.1_0_0.autoProgression" },
      { type: "improved", key: "patchNotes.1_0_0.refactoring" },
      { type: "fix", key: "patchNotes.1_0_0.requireCycle" },
      { type: "fix", key: "patchNotes.1_0_0.fileSystemLegacy" },
    ],
  },
  {
    version: "0.0.5",
    date: "2026-02-01",
    changes: [
      { type: "new", key: "patchNotes.0_0_5.homeScreen" },
      { type: "new", key: "patchNotes.0_0_5.i18n" },
      { type: "new", key: "patchNotes.0_0_5.achievements" },
      { type: "new", key: "patchNotes.0_0_5.calendarDetail" },
      { type: "new", key: "patchNotes.0_0_5.notes" },
      { type: "improved", key: "patchNotes.0_0_5.graphs" },
      { type: "improved", key: "patchNotes.0_0_5.modals" },
      { type: "improved", key: "patchNotes.0_0_5.logo" },
      { type: "fix", key: "patchNotes.0_0_5.encoding" },
      { type: "fix", key: "patchNotes.0_0_5.prBaseline" },
      { type: "fix", key: "patchNotes.0_0_5.kgLabels" },
    ],
  },
  {
    version: "0.0.1",
    date: "2026-01-15",
    changes: [
      { type: "new", key: "patchNotes.0_0_1.initial" },
    ],
  },
];

/**
 * Version actually running on the device (from app.json via expo-constants).
 * Falls back to the newest patchNotes entry if Constants is unavailable
 * (e.g. during unit tests). The verify script guarantees these match.
 */
export const CURRENT_VERSION: string =
  (Constants?.expoConfig?.version as string | undefined) ?? patchNotes[0].version;
