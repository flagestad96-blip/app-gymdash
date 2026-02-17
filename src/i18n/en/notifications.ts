import type { TranslationMap } from "../types";

const notifications: TranslationMap = {
  // ── Back Impact ──
  "back.red": "High back strain",
  "back.yellow": "Moderate back strain",
  "back.green": "Back-friendly",
  "back.statusTitle": "BACK STATUS",
  "back.statusGreen": "\ud83d\udfe2 Good",
  "back.statusGreenHint": "Normal workout",
  "back.statusYellow": "\ud83d\udfe1 A bit tight",
  "back.statusYellowHint": "Consider back-friendly",
  "back.statusRed": "\ud83d\udd34 Not good",
  "back.statusRedHint": "Back-friendly + no triggers",

  // ── Social Sharing ──
  "share.workout": "Share workout",
  "share.program": "Share program",
  "share.achievement": "Share achievement",
  "share.failed": "Sharing failed.",

  // ── Notifications ──
  "notifications.title": "NOTIFICATIONS",
  "notifications.workoutReminders": "Workout reminders",
  "notifications.restDaySuggestions": "Rest day suggestions",
  "notifications.reminderTime": "Time",
  "notifications.permissionRequired": "Notification permission required",
  "notifications.requestPermission": "Grant permission",
  "notifications.enabled": "Enabled",
  "notifications.restDayMessage": "You haven't trained in a while. Time for a workout?",
};

export default notifications;
