// src/gymStore.ts — Gym location CRUD + active gym management
import { getDb, getSetting, setSetting } from "./db";
import { uid, isoNow } from "./storage";
import type { Equipment } from "./exerciseLibrary";
import { DEFAULT_PLATES_KG } from "./plateCalculator";

// ── Types ──

export type GymLocation = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  availableEquipment: Equipment[] | null;
  availablePlates: number[] | null;
  sortIndex: number;
  createdAt: string;
};

export type CreateGymInput = {
  name: string;
  color?: string | null;
  icon?: string | null;
  availableEquipment?: Equipment[] | null;
  availablePlates?: number[] | null;
  sortIndex?: number;
};

export type UpdateGymInput = Partial<Omit<CreateGymInput, "sortIndex"> & { sortIndex: number }>;

// ── Row mapping ──

type GymRow = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  available_equipment: string | null;
  available_plates: string | null;
  sort_index: number;
  created_at: string;
};

function safeJsonParse<T>(json: string | null): T | null {
  if (!json) return null;
  try { return JSON.parse(json); }
  catch { return null; }
}

function rowToGym(row: GymRow): GymLocation {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    availableEquipment: safeJsonParse<Equipment[]>(row.available_equipment),
    availablePlates: safeJsonParse<number[]>(row.available_plates),
    sortIndex: row.sort_index,
    createdAt: row.created_at,
  };
}

// ── CRUD ──

export function listGyms(): GymLocation[] {
  try {
    const rows = getDb().getAllSync<GymRow>(
      `SELECT id, name, color, icon, available_equipment, available_plates, sort_index, created_at
       FROM gym_locations ORDER BY sort_index ASC, created_at ASC`
    );
    return (rows ?? []).map(rowToGym);
  } catch {
    return [];
  }
}

export function getGym(id: string): GymLocation | null {
  try {
    const row = getDb().getFirstSync<GymRow>(
      `SELECT id, name, color, icon, available_equipment, available_plates, sort_index, created_at
       FROM gym_locations WHERE id = ? LIMIT 1`,
      [id]
    );
    return row ? rowToGym(row) : null;
  } catch {
    return null;
  }
}

export function createGym(input: CreateGymInput): GymLocation {
  const id = uid("gym");
  const now = isoNow();
  const sortIndex = input.sortIndex ?? 0;
  getDb().runSync(
    `INSERT INTO gym_locations(id, name, color, icon, available_equipment, available_plates, sort_index, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.color ?? null,
      input.icon ?? null,
      input.availableEquipment ? JSON.stringify(input.availableEquipment) : null,
      input.availablePlates ? JSON.stringify(input.availablePlates) : null,
      sortIndex,
      now,
    ]
  );
  const gym = getGym(id);
  if (!gym) throw new Error(`createGym: failed to read back gym ${id}`);
  return gym;
}

export function updateGym(id: string, input: UpdateGymInput): GymLocation | null {
  const existing = getGym(id);
  if (!existing) return null;
  const name = input.name ?? existing.name;
  const color = "color" in input ? (input.color ?? null) : existing.color;
  const icon = "icon" in input ? (input.icon ?? null) : existing.icon;
  const availableEquipment = "availableEquipment" in input ? input.availableEquipment ?? null : existing.availableEquipment;
  const availablePlates = "availablePlates" in input ? input.availablePlates ?? null : existing.availablePlates;
  const sortIndex = input.sortIndex ?? existing.sortIndex;
  getDb().runSync(
    `UPDATE gym_locations SET name=?, color=?, icon=?, available_equipment=?, available_plates=?, sort_index=? WHERE id=?`,
    [
      name,
      color,
      icon,
      availableEquipment ? JSON.stringify(availableEquipment) : null,
      availablePlates ? JSON.stringify(availablePlates) : null,
      sortIndex,
      id,
    ]
  );
  return getGym(id);
}

export function deleteGym(id: string): void {
  try {
    getDb().runSync(`DELETE FROM gym_locations WHERE id = ?`, [id]);
    if (getActiveGymId() === id) setActiveGymId(null);
  } catch {}
}

// ── Active gym management ──

export function getActiveGymId(): string | null {
  const val = getSetting("activeGymId");
  return val && val.length > 0 ? val : null;
}

export function setActiveGymId(gymId: string | null): void {
  setSetting("activeGymId", gymId ?? "");
}

export function getActiveGym(): GymLocation | null {
  const id = getActiveGymId();
  return id ? getGym(id) : null;
}

// ── Equipment helpers ──

export function getGymEquipmentSet(gym: GymLocation): Set<Equipment> | null {
  if (!gym.availableEquipment) return null;
  return new Set(gym.availableEquipment);
}

export function isEquipmentAvailable(equipment: Equipment, gym: GymLocation | null): boolean {
  if (!gym || !gym.availableEquipment) return true;
  return gym.availableEquipment.includes(equipment);
}

// ── Plate helpers ──

export function getGymPlates(gym: GymLocation | null): number[] {
  if (!gym || !gym.availablePlates) return DEFAULT_PLATES_KG;
  return gym.availablePlates;
}
