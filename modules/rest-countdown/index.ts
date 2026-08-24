// modules/rest-countdown — live rest countdown in the Android notification
// shade, rendered by the system chronometer (ticks with the screen off, no JS
// involvement while backgrounded, removes itself when the rest is over).
//
// The native side only exists in builds made after this module was added.
// requireOptionalNativeModule returns null in older binaries (and in Expo Go
// and on iOS/web), so every call degrades to a silent no-op there.
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

type RestCountdownNativeModule = {
  show(title: string, body: string, channelName: string, endsAtMs: number): void;
  hide(): void;
};

const native =
  Platform.OS === "android"
    ? requireOptionalNativeModule<RestCountdownNativeModule>("RestCountdown")
    : null;

/** Whether the current binary actually contains the native module. */
export function isRestCountdownAvailable(): boolean {
  return native != null;
}

export function showRestCountdown(args: {
  title: string;
  body: string;
  channelName: string;
  endsAtMs: number;
}): void {
  try {
    native?.show(args.title, args.body, args.channelName, args.endsAtMs);
  } catch {
    // Never let a notification cosmetic break the timer flow.
  }
}

export function hideRestCountdown(): void {
  try {
    native?.hide();
  } catch {}
}
