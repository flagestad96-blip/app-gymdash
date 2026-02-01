// src/fileSystem.ts — File backup save/pick/share utilities
import * as FileSystem from "expo-file-system/src/legacy";
import { EncodingType } from "expo-file-system/src/legacy/FileSystem.types";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

/**
 * Save a JSON string as a backup file in the app's document directory.
 * Returns the file URI.
 */
export async function saveBackupFile(json: string, filename?: string): Promise<string> {
  const name = filename ?? `gymdash_backup_${Date.now()}.json`;
  const uri = `${FileSystem.documentDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, json, { encoding: EncodingType.UTF8 });
  return uri;
}

/**
 * Share a file via the native share sheet.
 */
export async function shareFile(uri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Gymdash Backup",
  });
}

/**
 * Open a document picker and read the selected JSON file.
 * Returns the file content as a string, or null if cancelled.
 */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: EncodingType.UTF8,
  });
  return content;
}

/**
 * Save text as a CSV file and return the URI.
 */
export async function saveCsvFile(csv: string, filename?: string): Promise<string> {
  const name = filename ?? `gymdash_export_${Date.now()}.csv`;
  const uri = `${FileSystem.documentDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: EncodingType.UTF8 });
  return uri;
}

/**
 * Share a CSV file via the native share sheet.
 */
export async function shareCsvFile(uri: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device");
  }
  await Sharing.shareAsync(uri, {
    mimeType: "text/csv",
    dialogTitle: "Gymdash CSV Export",
  });
}

/**
 * Delete a file at the given URI (cleanup after sharing).
 */
export async function deleteFile(uri: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri);
    }
  } catch {
    // Silently ignore
  }
}
