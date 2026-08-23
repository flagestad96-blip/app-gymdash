// src/autoBackup.ts — automatic backups, so the user's data survives a lost
// or reset phone without them ever remembering to export.
//
// Android: the user picks a folder ONCE via Storage Access Framework (ideally
// one a cloud app syncs — Drive, Dropbox, OneDrive — or just Downloads); the
// app then writes a full JSON backup there automatically: on app launch at
// most once a day, and always right after a completed workout. The newest 7
// auto-backups are kept, older ones pruned (only files this feature created —
// never the user's own).
//
// iOS/other: backups land in the app's own documents folder (no SAF there).
//
// Everything stays on-device / in the user's own storage — no servers,
// consistent with the privacy-first philosophy.

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/src/legacy";
import { EncodingType } from "expo-file-system/src/legacy/FileSystem.types";
import { getSettingAsync, setSettingAsync } from "./db";
import { exportFullBackup } from "./backup";
import {
  AUTO_BACKUP_KEEP,
  autoBackupFilename,
  isAutoBackupDue,
  selectBackupsToPrune,
} from "./autoBackupCore";

const SAF = FileSystem.StorageAccessFramework;

export const AUTO_BACKUP_ENABLED_KEY = "autoBackupEnabled";
export const AUTO_BACKUP_DIR_KEY = "autoBackupDirUri";
export const AUTO_BACKUP_LAST_KEY = "lastAutoBackupAt";

export type AutoBackupRunResult = "done" | "throttled" | "disabled" | "unconfigured" | "error";

export type AutoBackupStatus = {
  enabled: boolean;
  /** SAF folder URI (Android). null on iOS (fixed app-documents location). */
  dirUri: string | null;
  lastRunAt: string | null;
};

export async function getAutoBackupStatus(): Promise<AutoBackupStatus> {
  const [enabled, dirUri, lastRunAt] = await Promise.all([
    getSettingAsync(AUTO_BACKUP_ENABLED_KEY),
    getSettingAsync(AUTO_BACKUP_DIR_KEY),
    getSettingAsync(AUTO_BACKUP_LAST_KEY),
  ]);
  return { enabled: enabled === "1", dirUri: dirUri || null, lastRunAt: lastRunAt || null };
}

export async function setAutoBackupEnabled(enabled: boolean): Promise<void> {
  await setSettingAsync(AUTO_BACKUP_ENABLED_KEY, enabled ? "1" : "0");
}

/**
 * Android only: let the user pick (and persist access to) the backup folder.
 * Returns the folder URI, or null if unsupported/cancelled.
 */
export async function chooseBackupDirectory(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  try {
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return null;
    await setSettingAsync(AUTO_BACKUP_DIR_KEY, perm.directoryUri);
    return perm.directoryUri;
  } catch (err) {
    console.warn("[autoBackup] folder pick failed", err);
    return null;
  }
}

/** Human-readable folder name from a SAF URI (best effort). */
export function describeBackupDir(dirUri: string | null): string | null {
  if (!dirUri) return null;
  try {
    const decoded = decodeURIComponent(dirUri);
    const tail = decoded.split(/[/:]/).filter(Boolean).pop();
    return tail ?? decoded;
  } catch {
    return dirUri;
  }
}

async function pruneSafBackups(dirUri: string): Promise<void> {
  const entries = await SAF.readDirectoryAsync(dirUri); // content:// URIs
  const nameOf = (uri: string) => {
    try {
      return decodeURIComponent(uri).split("/").pop() ?? uri;
    } catch {
      return uri;
    }
  };
  const byName = new Map(entries.map((uri) => [nameOf(uri), uri] as const));
  for (const name of selectBackupsToPrune([...byName.keys()], AUTO_BACKUP_KEEP)) {
    const uri = byName.get(name);
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

async function pruneLocalBackups(dir: string): Promise<void> {
  const names = await FileSystem.readDirectoryAsync(dir);
  for (const name of selectBackupsToPrune(names, AUTO_BACKUP_KEEP)) {
    await FileSystem.deleteAsync(`${dir}${name}`, { idempotent: true }).catch(() => {});
  }
}

/**
 * Run an automatic backup when enabled and due.
 *
 * @param opts.force  Skip the daily throttle (used right after a completed
 *                    workout — the moment new data exists is the moment a
 *                    backup is worth the write).
 */
export async function runAutoBackupIfDue(opts?: { force?: boolean }): Promise<AutoBackupRunResult> {
  if (Platform.OS === "web") return "disabled";
  try {
    const status = await getAutoBackupStatus();
    if (!status.enabled) return "disabled";
    if (!opts?.force && !isAutoBackupDue(status.lastRunAt, Date.now())) return "throttled";

    const now = new Date();
    const json = await exportFullBackup();

    if (Platform.OS === "android") {
      if (!status.dirUri) return "unconfigured";
      const fileUri = await SAF.createFileAsync(status.dirUri, autoBackupFilename(now), "application/json");
      await FileSystem.writeAsStringAsync(fileUri, json, { encoding: EncodingType.UTF8 });
      await pruneSafBackups(status.dirUri).catch(() => {});
    } else {
      const dir = `${FileSystem.documentDirectory}backups/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      await FileSystem.writeAsStringAsync(`${dir}${autoBackupFilename(now)}.json`, json, {
        encoding: EncodingType.UTF8,
      });
      await pruneLocalBackups(dir).catch(() => {});
    }

    await setSettingAsync(AUTO_BACKUP_LAST_KEY, now.toISOString());
    return "done";
  } catch (err) {
    console.warn("[autoBackup] run failed", err);
    return "error";
  }
}
