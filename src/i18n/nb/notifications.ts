import type { TranslationMap } from "../types";

const notifications: TranslationMap = {
  // ── Back Impact ──
  "back.red": "H\u00f8y ryggbelastning",
  "back.yellow": "Moderat ryggbelastning",
  "back.green": "Ryggvennlig",
  "back.statusTitle": "RYGG-STATUS",
  "back.statusGreen": "\ud83d\udfe2 Bra",
  "back.statusGreenHint": "Normal \u00f8kt",
  "back.statusYellow": "\ud83d\udfe1 Litt stram",
  "back.statusYellowHint": "Vurder ryggvennlig",
  "back.statusRed": "\ud83d\udd34 Ikke bra",
  "back.statusRedHint": "Ryggvennlig + ingen triggere",

  // ── Social Sharing ──
  "share.workout": "Del \u00f8kt",
  "share.program": "Del program",
  "share.achievement": "Del prestasjon",
  "share.failed": "Deling feilet.",

  // ── Notifications ──
  "notifications.title": "VARSLER",
  "notifications.workoutReminders": "Treningsp\u00e5minnelser",
  "notifications.restDaySuggestions": "Hviledag-forslag",
  "notifications.reminderTime": "Tidspunkt",
  "notifications.permissionRequired": "Varslingstillatelse n\u00f8dvendig",
  "notifications.requestPermission": "Gi tillatelse",
  "notifications.enabled": "Aktivert",
  "notifications.restDayMessage": "Du har ikke trent p\u00e5 en stund. Tid for en \u00f8kt?",
};

export default notifications;
