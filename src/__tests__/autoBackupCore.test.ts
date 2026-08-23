import {
  autoBackupFilename,
  isAutoBackupDue,
  selectBackupsToPrune,
  AUTO_BACKUP_PREFIX,
  AUTO_BACKUP_MIN_INTERVAL_MS,
} from "../autoBackupCore";

describe("autoBackupFilename", () => {
  it("embeds sortable date and time", () => {
    const name = autoBackupFilename(new Date(2026, 7, 23, 14, 5));
    expect(name).toBe("gymdash-auto-backup-2026-08-23_1405");
    expect(name.startsWith(AUTO_BACKUP_PREFIX)).toBe(true);
  });

  it("sorts chronologically as plain strings", () => {
    const earlier = autoBackupFilename(new Date(2026, 7, 23, 9, 30));
    const later = autoBackupFilename(new Date(2026, 8, 1, 7, 0));
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });
});

describe("isAutoBackupDue", () => {
  const now = Date.parse("2026-08-23T12:00:00Z");

  it("is due without a previous run or with a corrupt timestamp", () => {
    expect(isAutoBackupDue(null, now)).toBe(true);
    expect(isAutoBackupDue("not-a-date", now)).toBe(true);
  });

  it("throttles within the interval and allows after it", () => {
    const recent = new Date(now - AUTO_BACKUP_MIN_INTERVAL_MS + 60_000).toISOString();
    const old = new Date(now - AUTO_BACKUP_MIN_INTERVAL_MS - 60_000).toISOString();
    expect(isAutoBackupDue(recent, now)).toBe(false);
    expect(isAutoBackupDue(old, now)).toBe(true);
  });
});

describe("selectBackupsToPrune", () => {
  const mk = (d: string) => `${AUTO_BACKUP_PREFIX}${d}.json`;

  it("keeps the newest N of our files and never touches other files", () => {
    const files = [
      mk("2026-08-20_0900"),
      mk("2026-08-21_0900"),
      mk("2026-08-22_0900"),
      "gymdash_backup_manual.json",
      "holiday-photo.jpg",
    ];
    expect(selectBackupsToPrune(files, 2)).toEqual([mk("2026-08-20_0900")]);
  });

  it("returns nothing when at or below the keep limit", () => {
    expect(selectBackupsToPrune([mk("2026-08-22_0900")], 2)).toEqual([]);
    expect(selectBackupsToPrune([], 2)).toEqual([]);
  });

  it("prunes oldest-first regardless of input order", () => {
    const files = [mk("2026-08-23_0900"), mk("2026-08-19_0900"), mk("2026-08-21_0900"), mk("2026-08-22_0900")];
    expect(selectBackupsToPrune(files, 2)).toEqual([mk("2026-08-19_0900"), mk("2026-08-21_0900")]);
  });
});
