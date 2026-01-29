export type SQLiteDatabase = {
  execSync: (...args: any[]) => void;
  runSync: (...args: any[]) => { changes: number; lastInsertRowId: number };
  getAllSync: <T>(...args: any[]) => T[];
  getFirstSync: <T>(...args: any[]) => T | null;
  execAsync: (...args: any[]) => Promise<void>;
  runAsync: (...args: any[]) => Promise<{ changes: number; lastInsertRowId: number }>;
  getAllAsync: <T>(...args: any[]) => Promise<T[]>;
  getFirstAsync: <T>(...args: any[]) => Promise<T | null>;
  closeAsync: (...args: any[]) => Promise<void>;
};

const noopDb: SQLiteDatabase = {
  execSync: () => {},
  runSync: () => ({ changes: 0, lastInsertRowId: 0 }),
  getAllSync: <T,>() => [] as T[],
  getFirstSync: <T,>() => null as T | null,
  execAsync: async () => {},
  runAsync: async () => ({ changes: 0, lastInsertRowId: 0 }),
  getAllAsync: async <T,>() => [] as T[],
  getFirstAsync: async <T,>() => null as T | null,
  closeAsync: async () => {},
};

export function openDatabaseSync() {
  return noopDb;
}

export async function openDatabaseAsync() {
  return noopDb;
}
