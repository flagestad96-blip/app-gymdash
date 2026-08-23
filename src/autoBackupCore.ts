// src/autoBackupCore.ts — pure logic behind automatic backups (no expo/fs
// imports, so every rule is unit-testable).

export const AUTO_BACKUP_PREFIX = "gymdash-auto-backup-";
export const AUTO_BACKUP_KEEP = 7;
/** ~20h so "once per day" tolerates varying workout times. */
export const AUTO_BACKUP_MIN_INTERVAL_MS = 20 * 60 * 60 * 1000;

/** "gymdash-auto-backup-2026-08-23_1436" — sortable, collision-safe per minute. */
export function autoBackupFilename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${AUTO_BACKUP_PREFIX}${date}_${time}`;
}

export function isAutoBackupDue(
  lastRunIso: string | null,
  nowMs: number,
  minIntervalMs: number = AUTO_BACKUP_MIN_INTERVAL_MS,
): boolean {
  if (!lastRunIso) return true;
  const lastMs = Date.parse(lastRunIso);
  if (!Number.isFinite(lastMs)) return true;
  return nowMs - lastMs >= minIntervalMs;
}

/**
 * Given the file names in the backup folder, pick which of OUR auto-backups to
 * delete so only the newest `keep` remain. Files without the prefix (the
 * user's own files, manual exports) are never touched. Names sort
 * chronologically because the filename embeds date + time.
 */
export function selectBackupsToPrune(fileNames: string[], keep: number = AUTO_BACKUP_KEEP): string[] {
  const ours = fileNames.filter((name) => name.startsWith(AUTO_BACKUP_PREFIX));
  if (ours.length <= keep) return [];
  return [...ours].sort().slice(0, ours.length - keep);
}
