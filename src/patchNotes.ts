// src/patchNotes.ts — Changelog / patch notes system

export type PatchNote = {
  version: string;
  date: string;
  changes: { type: "new" | "improved" | "fix"; key: string }[];
};

/**
 * Changelog entries, newest first.
 * Each change uses an i18n key so notes appear in the user's language.
 */
export const patchNotes: PatchNote[] = [
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

export const CURRENT_VERSION = patchNotes[0].version;
