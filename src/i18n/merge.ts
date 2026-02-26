import type { TranslationMap } from "./types";

import nbCommon from "./nb/common";
import nbHome from "./nb/home";
import nbLog from "./nb/log";
import nbProgram from "./nb/program";
import nbAnalysis from "./nb/analysis";
import nbCalendar from "./nb/calendar";
import nbHistory from "./nb/history";
import nbBody from "./nb/body";
import nbSettings from "./nb/settings";
import nbAchievements from "./nb/achievements";
import nbOnboarding from "./nb/onboarding";
import nbPatchNotes from "./nb/patchNotes";
import nbNotifications from "./nb/notifications";
import nbGym from "./nb/gym";

import enCommon from "./en/common";
import enHome from "./en/home";
import enLog from "./en/log";
import enProgram from "./en/program";
import enAnalysis from "./en/analysis";
import enCalendar from "./en/calendar";
import enHistory from "./en/history";
import enBody from "./en/body";
import enSettings from "./en/settings";
import enAchievements from "./en/achievements";
import enOnboarding from "./en/onboarding";
import enPatchNotes from "./en/patchNotes";
import enNotifications from "./en/notifications";
import enGym from "./en/gym";

function merge(...maps: TranslationMap[]): TranslationMap {
  const result: TranslationMap = {};
  for (const m of maps) Object.assign(result, m);
  return result;
}

export const nb: TranslationMap = merge(
  nbCommon, nbHome, nbLog, nbProgram, nbAnalysis,
  nbCalendar, nbHistory, nbBody, nbSettings,
  nbAchievements, nbOnboarding, nbPatchNotes, nbNotifications,
  nbGym,
);

export const en: TranslationMap = merge(
  enCommon, enHome, enLog, enProgram, enAnalysis,
  enCalendar, enHistory, enBody, enSettings,
  enAchievements, enOnboarding, enPatchNotes, enNotifications,
  enGym,
);

// Key count assertion — ensures no keys are accidentally lost during splits.
// If you add/remove keys, update the expected count here.
const EXPECTED_MIN_KEYS = 627;
if (__DEV__) {
  const nbCount = Object.keys(nb).length;
  const enCount = Object.keys(en).length;
  if (nbCount < EXPECTED_MIN_KEYS) {
    console.warn(`[i18n] nb has only ${nbCount} keys (expected >= ${EXPECTED_MIN_KEYS})`);
  }
  if (enCount < EXPECTED_MIN_KEYS) {
    console.warn(`[i18n] en has only ${enCount} keys (expected >= ${EXPECTED_MIN_KEYS})`);
  }
  if (nbCount !== enCount) {
    console.warn(`[i18n] key count mismatch: nb=${nbCount}, en=${enCount}`);
  }
}
