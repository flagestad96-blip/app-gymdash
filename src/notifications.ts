// src/notifications.ts
import { Platform } from "react-native";
import Constants from "expo-constants";
import { t } from "./i18n";

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
