import type { TranslationMap } from "./types";

import nbCommon from "./nb/common";
import nbHome from "./nb/home";
import nbLog from "./nb/log";
import nbAnalysis from "./nb/analysis";
import nbCalendar from "./nb/calendar";
import nbSettings from "./nb/settings";
import nbOnboarding from "./nb/onboarding";
import nbPatchNotes from "./nb/patchNotes";
import nbNotifications from "./nb/notifications";
import nbGym from "./nb/gym";
import nbAurora from "./nb/aurora";

import enCommon from "./en/common";
import enHome from "./en/home";
import enLog from "./en/log";
import enAnalysis from "./en/analysis";
import enCalendar from "./en/calendar";
import enSettings from "./en/settings";
import enOnboarding from "./en/onboarding";
import enPatchNotes from "./en/patchNotes";
import enNotifications from "./en/notifications";
import enGym from "./en/gym";
import enAurora from "./en/aurora";

function merge(...maps: TranslationMap[]): TranslationMap {
  const result: TranslationMap = {};
  for (const m of maps) Object.assign(result, m);
  return result;
}

export const nb: TranslationMap = merge(
  nbCommon, nbHome, nbLog, nbAnalysis,
  nbCalendar, nbSettings,
  nbOnboarding, nbPatchNotes, nbNotifications,
  nbGym, nbAurora,
);

export const en: TranslationMap = merge(
  enCommon, enHome, enLog, enAnalysis,
  enCalendar, enSettings,
  enOnboarding, enPatchNotes, enNotifications,
  enGym, enAurora,
);

if (__DEV__) {
  const nbCount = Object.keys(nb).length;
  const enCount = Object.keys(en).length;
  if (nbCount !== enCount) {
    console.warn(`[i18n] key count mismatch: nb=${nbCount}, en=${enCount}`);
  }
}
