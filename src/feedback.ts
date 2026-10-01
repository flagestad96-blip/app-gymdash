// src/feedback.ts — privacy-first feedback: nothing leaves the device unless
// the user explicitly sends it themselves.
//
// The app is 100% offline and has no telemetry, so feedback travels the only
// privacy-compatible way there is: the user composes an email/share where
// every byte is visible before sending. Diagnostics are opt-in, shown in
// full beforehand, and contain counts and versions — never training data.

import { Platform, Linking, Share } from "react-native";
import Constants from "expo-constants";
import { getDb, getSettingAsync, setSettingAsync } from "./db";
import { getLocale, t } from "./i18n";

// Developer contact (also the public contact address on the Play listing).
export const FEEDBACK_EMAIL = "flagestad96@gmail.com";

const LAST_FATAL_KEY = "lastFatalError";

// ── Crash capture (local only) ─────────────────────────────────────────────
// Stores the most recent fatal JS error in settings so the user can choose
// to include it in a feedback mail later. Never read by anything else.

let errorLoggerInstalled = false;

export function installErrorLogger() {
  if (errorLoggerInstalled) return;
  errorLoggerInstalled = true;
  try {
    const globalErrorUtils = (global as any).ErrorUtils;
    if (!globalErrorUtils?.setGlobalHandler) return;
    const previous = globalErrorUtils.getGlobalHandler?.();
    globalErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      try {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        const stack = error instanceof Error ? (error.stack ?? "").split("\n").slice(0, 8).join("\n") : "";
        const entry = JSON.stringify({ time: new Date().toISOString(), fatal: !!isFatal, message, stack });
        setSettingAsync(LAST_FATAL_KEY, entry).catch(() => {});
      } catch {}
      if (previous) previous(error, isFatal);
    });
  } catch {}
}

// ── Diagnostics ────────────────────────────────────────────────────────────

export async function buildDiagnostics(): Promise<string> {
  const lines: string[] = [];
  try {
    const version = Constants.expoConfig?.version ?? "?";
    const versionCode = (Constants.expoConfig?.android as { versionCode?: number } | undefined)?.versionCode;
    lines.push(`Gymdash ${version}${versionCode ? ` (vc${versionCode})` : ""}`);
  } catch {
    lines.push("Gymdash ?");
  }

  const constants = (Platform as unknown as { constants?: Record<string, unknown> }).constants ?? {};
  if (Platform.OS === "android") {
    const release = constants["Release"] ?? "?";
    const model = constants["Model"] ?? "?";
    const brand = constants["Brand"] ?? "";
    lines.push(`Android ${release} · ${brand ? `${brand} ` : ""}${model}`);
  } else {
    lines.push(`${Platform.OS} ${String(constants["osVersion"] ?? Platform.Version)}`);
  }

  lines.push(`Locale: ${getLocale()}`);

  // Scale of use only — counts, never content.
  try {
    const row = getDb().getFirstSync<{ w: number; s: number }>(
      `SELECT (SELECT COUNT(1) FROM workouts) as w, (SELECT COUNT(1) FROM sets) as s`
    );
    lines.push(`Workouts: ${row?.w ?? 0} · Sets: ${row?.s ?? 0}`);
  } catch {}

  try {
    const raw = await getSettingAsync(LAST_FATAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { time?: string; fatal?: boolean; message?: string; stack?: string };
      lines.push("");
      lines.push(`Last error (${parsed.time ?? "?"}${parsed.fatal ? ", fatal" : ""}):`);
      if (parsed.message) lines.push(parsed.message);
      if (parsed.stack) lines.push(parsed.stack);
    }
  } catch {}

  return lines.join("\n");
}

export async function clearLastError(): Promise<void> {
  await setSettingAsync(LAST_FATAL_KEY, "");
}

// ── Composing ──────────────────────────────────────────────────────────────

export async function sendFeedback(includeDiagnostics: boolean): Promise<void> {
  const subject = t("feedback.subject");
  let body = "\n\n";
  if (includeDiagnostics) {
    body += `----\n${await buildDiagnostics()}\n`;
  }
  const url =
    `mailto:${FEEDBACK_EMAIL}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      return;
    }
  } catch {}
  // No mail client — fall back to the native share sheet with the same text.
  try {
    await Share.share({ message: `${subject} (${FEEDBACK_EMAIL})\n${body}` });
  } catch {}
}
