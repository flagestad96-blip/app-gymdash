// src/notifications.ts
import { Platform } from "react-native";
import Constants from "expo-constants";
import { t } from "./i18n";
import { showRestCountdown, hideRestCountdown } from "../modules/rest-countdown";

// NOTE: Expo Go doesn't support expo-notifications on Android. Re-verify in preview/dev builds before release.
const IS_EXPO_GO =
  Constants.appOwnership === "expo" || (Constants as { executionEnvironment?: string }).executionEnvironment === "storeClient";

let notificationsPromise: Promise<typeof import("expo-notifications")> | null = null;

async function getNotifications() {
  if (Platform.OS === "web" || IS_EXPO_GO) return null;
  if (!notificationsPromise) notificationsPromise = import("expo-notifications");
  return notificationsPromise;
}

/**
 * Configure the default notification handler
 * This determines how notifications are displayed when the app is in foreground
 */
export function setupNotificationHandler() {
  void getNotifications().then((Notifications) => {
    if (!Notifications) return;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  });
}

/**
 * Request notification permissions from the user
 * Returns true if permission is granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web" || IS_EXPO_GO) {
    return false; // Notifications not supported on web
  }

  try {
    const Notifications = await getNotifications();
    if (!Notifications) return false;
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === "granted";
  } catch (error) {
    console.error("Failed to request notification permissions:", error);
    return false;
  }
}

// Cached "granted" so the per-set schedule path doesn't hit the permissions
// API every time. Never caches a denial — if the user grants later in system
// settings, the next check picks it up.
let grantedCache = false;

/**
 * Make sure rest notifications can actually fire: requests the OS permission
 * (Android 13+ requires a runtime prompt; without it every schedule silently
 * no-ops) and creates the Android notification channel. Safe to call often.
 */
export async function ensureRestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web" || IS_EXPO_GO) return false;
  if (grantedCache) return true;
  const granted = await requestNotificationPermissions();
  if (granted) {
    grantedCache = true;
    const Notifications = await getNotifications();
    if (Notifications) await ensureRestChannel(Notifications);
  }
  return granted;
}

export const REST_CHANNEL_ID = "rest-timer";
let channelEnsured = false;

/**
 * Android 8+: notifications land on a channel, and the channel's importance —
 * not the notification's — decides sound/heads-up. Without a dedicated
 * high-importance channel the rest alert can arrive silently or not at all.
 */
async function ensureRestChannel(Notifications: Awaited<ReturnType<typeof getNotifications>>): Promise<void> {
  if (Platform.OS !== "android" || channelEnsured || !Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync(REST_CHANNEL_ID, {
      name: t("notifications.restChannelName"),
      importance: Notifications.AndroidImportance.MAX,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
    channelEnsured = true;
  } catch (error) {
    console.error("Failed to create rest notification channel:", error);
  }
}

/**
 * Check if notification permissions are currently granted
 */
export async function hasNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === "web" || IS_EXPO_GO) {
    return false;
  }

  try {
    const Notifications = await getNotifications();
    if (!Notifications) return false;
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

/**
 * Schedule a rest timer notification that will fire after the specified duration
 * Returns the notification ID if successful, null otherwise
 */
export async function scheduleRestNotification(seconds: number): Promise<string | null> {
  if (Platform.OS === "web" || IS_EXPO_GO) {
    return null;
  }

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const hasPermission = await hasNotificationPermissions();
  if (!hasPermission) {
    return null;
  }

  await ensureRestChannel(Notifications);

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${t("notifications.restDone")} 💪`,
        body: t("notifications.nextSet"),
        sound: true,
        vibrate: [0, 250, 250, 250],
        data: { type: "rest_timer" },
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: REST_CHANNEL_ID,
      },
    });

    return id;
  } catch (error) {
    console.error("Failed to schedule rest notification:", error);
    return null;
  }
}

/**
 * Cancel a specific scheduled notification by ID
 */
export async function cancelRestNotification(id: string): Promise<void> {
  if (Platform.OS === "web" || IS_EXPO_GO || !id) {
    return;
  }

  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.error("Failed to cancel notification:", error);
  }
}

/**
 * Cancel all scheduled rest timer notifications
 */
export async function cancelAllRestNotifications(): Promise<void> {
  if (Platform.OS === "web" || IS_EXPO_GO) {
    return;
  }

  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Failed to cancel all notifications:", error);
  }
}

/**
 * Cancel every scheduled notification with the given data.type. More robust
 * than cancelling by stored id: ids get lost (cleared settings, reinstalls)
 * while the OS keeps firing the schedule — cancelling by type always catches
 * strays and duplicates.
 */
export async function cancelAllNotificationsOfType(type: string): Promise<void> {
  if (Platform.OS === "web" || IS_EXPO_GO) return;
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const notif of scheduled) {
      if ((notif.content?.data as Record<string, unknown>)?.type === type) {
        await Notifications.cancelScheduledNotificationAsync(notif.identifier);
      }
    }
  } catch (e) {
    console.error(`[notifications] cancelAllNotificationsOfType(${type}) error:`, e);
  }
}

/**
 * Cancel only rest-timer notifications (not workout reminders or rest day checks).
 */
export async function cancelAllRestTimerNotifications(): Promise<void> {
  await cancelAllNotificationsOfType("rest_timer");
}

/**
 * Reconcile scheduled reminders with the persisted toggles, run once at app
 * start. A recurring notification the toggle says is OFF gets cancelled — this
 * is what clears orphans left by earlier versions that dropped the stored id
 * without cancelling (observed in the wild: two daily "rest day check"
 * notifications firing with the toggle off).
 */
export async function syncReminderNotifications(): Promise<void> {
  if (Platform.OS === "web" || IS_EXPO_GO) return;
  try {
    // Lazy import, mirroring the repo's pattern for avoiding import cycles.
    const { getSettingAsync } = await import("./db");
    const reminderOn = (await getSettingAsync("reminderEnabled")) === "1";
    const restDayOn = (await getSettingAsync("restDayEnabled")) === "1";
    if (!reminderOn) await cancelAllNotificationsOfType("workout_reminder");
    if (!restDayOn) await cancelAllNotificationsOfType("rest_day_check");
  } catch (e) {
    console.error("[notifications] syncReminderNotifications error:", e);
  }
}

// ── Live rest countdown (Android notification shade) ─────────────────────────
// Silent ongoing notification with a system chronometer counting down to the
// end of the rest — visible with the screen locked, no JS while backgrounded.
// No-op on iOS/web/Expo Go and in binaries built before the native module
// (modules/rest-countdown) existed.

export function showRestCountdownNotification(endsAtMs: number): void {
  if (Platform.OS !== "android" || IS_EXPO_GO) return;
  showRestCountdown({
    title: t("notifications.restCountdownTitle"),
    body: t("notifications.restCountdownBody"),
    channelName: t("notifications.restCountdownChannel"),
    endsAtMs,
  });
}

export function hideRestCountdownNotification(): void {
  if (Platform.OS !== "android" || IS_EXPO_GO) return;
  hideRestCountdown();
}

// ── Workout Reminders (Tier 5) ────────────────────────────────────

/**
 * Schedule a weekly recurring workout reminder.
 * weekday: 1 (Sunday) through 7 (Saturday)
 * hour/minute: time of day (24h format)
 * Returns notification ID or null.
 */
export async function scheduleWorkoutReminder(
  weekday: number,
  hour: number,
  minute: number
): Promise<string | null> {
  if (Platform.OS === "web" || IS_EXPO_GO) return null;

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const hasPermission = await hasNotificationPermissions();
  if (!hasPermission) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${t("notifications.workoutTime")} 💪`,
        body: t("notifications.readyForSession"),
        sound: true,
        data: { type: "workout_reminder" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday,
        hour,
        minute,
      },
    });
    return id;
  } catch (error) {
    console.error("Failed to schedule workout reminder:", error);
    return null;
  }
}

/**
 * Cancel a specific workout reminder by notification ID.
 */
export async function cancelWorkoutReminder(id: string): Promise<void> {
  if (Platform.OS === "web" || IS_EXPO_GO || !id) return;
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.error("Failed to cancel workout reminder:", error);
  }
}

/**
 * Schedule a daily rest day suggestion check at 18:00.
 * Fires a notification reminding user to work out if they haven't in a while.
 */
export async function scheduleRestDayCheck(): Promise<string | null> {
  if (Platform.OS === "web" || IS_EXPO_GO) return null;

  const Notifications = await getNotifications();
  if (!Notifications) return null;

  const hasPermission = await hasNotificationPermissions();
  if (!hasPermission) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: t("notifications.restDayCheck"),
        body: t("notifications.restDayMessage"),
        sound: true,
        data: { type: "rest_day_check" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 18,
        minute: 0,
      },
    });
    return id;
  } catch (error) {
    console.error("Failed to schedule rest day check:", error);
    return null;
  }
}

/**
 * Cancel the rest day check notification.
 */
export async function cancelRestDayCheck(id: string): Promise<void> {
  if (Platform.OS === "web" || IS_EXPO_GO || !id) return;
  try {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (error) {
    console.error("Failed to cancel rest day check:", error);
  }
}
