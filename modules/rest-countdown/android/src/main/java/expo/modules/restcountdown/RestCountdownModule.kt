package expo.modules.restcountdown

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Ongoing, silent notification showing a live rest countdown in the shade.
// The system chronometer renders the ticking time (no periodic updates from
// JS needed — background JS is paused anyway), and setTimeoutAfter makes the
// notification remove itself the moment the rest is over, which is exactly
// when the separate "rest done" alert from expo-notifications fires.
private const val CHANNEL_ID = "rest-countdown"
private const val NOTIFICATION_ID = 0x5EC0

class RestCountdownModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val notificationManager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name("RestCountdown")

    // title/body/channelName arrive localized from JS. endsAtMs is epoch ms.
    Function("show") { title: String, body: String, channelName: String, endsAtMs: Double ->
      val endsAt = endsAtMs.toLong()
      val remaining = endsAt - System.currentTimeMillis()
      if (remaining <= 0) {
        notificationManager.cancel(NOTIFICATION_ID)
        return@Function
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        // IMPORTANCE_LOW: visible in the shade, never makes a sound — the
        // high-importance "rest done" alert lives on its own channel.
        val channel = NotificationChannel(CHANNEL_ID, channelName, NotificationManager.IMPORTANCE_LOW)
        channel.setShowBadge(false)
        notificationManager.createNotificationChannel(channel)
      }

      val builder = NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(body)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setShowWhen(true)
        .setWhen(endsAt)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setTimeoutAfter(remaining)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setCategory(NotificationCompat.CATEGORY_PROGRESS)

      context.packageManager.getLaunchIntentForPackage(context.packageName)?.let { launch ->
        val pendingIntent = PendingIntent.getActivity(
          context,
          0,
          launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        builder.setContentIntent(pendingIntent)
      }

      notificationManager.notify(NOTIFICATION_ID, builder.build())
    }

    Function("hide") {
      notificationManager.cancel(NOTIFICATION_ID)
    }

    // SCHEDULE_EXACT_ALARM is user-revocable and denied by default for fresh
    // installs on Android 14+. Without it every scheduled rest-done alert
    // falls back to an inexact alarm that Doze can defer for minutes, so the
    // app surfaces a banner (see ExactAlarmBanner) until access is granted.
    Function("canScheduleExactAlarms") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function true
      val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      alarmManager.canScheduleExactAlarms()
    }

    // Opens the system "Alarms & reminders" screen for this app.
    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return@Function
      val intent = Intent(
        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
        Uri.parse("package:" + context.packageName),
      )
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }
}
