# Task 02: Create src/gymStore.ts + export DEFAULT_PLATES_KG from plateCalculator.ts

## Context
This is Prompt 2 of 4 for the Gym Locations feature. Task 01 has been completed: the `gym_locations` table and `workouts.gym_id` column exist in the database, and `LastSetInfo` has the `fromOtherGym` flag. This task creates the central data-access module for all gym CRUD and active-gym management, and also exports the plate default constant that `gymStore.ts` needs.

## What to do

### 1. Export `DEFAULT_PLATES_KG` from `src/plateCalculator.ts`

In `src/plateCalculator.ts`, line 76 currently reads:

```typescript
const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
```

Change `const` to `export const` so `gymStore.ts` can import it:

```typescript
export const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
```

No other changes to `plateCalculator.ts`.

### 2. Create `src/gymStore.ts`

Create the file from scratch following the synchronous named-export pattern of `src/exerciseNotes.ts`. Import `getDb` from `./db`, `getSetting`/`setSetting` from `./db`, `uid`/`isoNow` from `./storage`, `Equipment` type from `./exerciseLibrary`, and `DEFAULT_PLATES_KG` from `./plateCalculator`.

The full API surface to implement:

```typescript
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
```

#### DB row mapping helper

The DB columns use `snake_case`; the TypeScript type uses `camelCase`. Write a private mapping function:

```typescript
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

function rowToGym(row: GymRow): GymLocation {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon,
    availableEquipment: row.available_equipment ? JSON.parse(row.available_equipment) : null,
    availablePlates: row.available_plates ? JSON.parse(row.available_plates) : null,
    sortIndex: row.sort_index,
    createdAt: row.created_at,
  };
}
```

#### CRUD functions

All functions are synchronous and use `getDb()` directly (same pattern as `exerciseNotes.ts`). Wrap all DB calls in try/catch and return safe defaults on error.

```typescript
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
  return getGym(id)!;
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
  } catch {}
}
```

#### Active gym management

The active gym ID is stored as the settings key `"activeGymId"`. An empty string means no active gym (so existing users with no saved value get `null`).

```typescript
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
```

#### Equipment helpers

```typescript
export function getGymEquipmentSet(gym: GymLocation): Set<Equipment> | null {
  if (!gym.availableEquipment) return null;
  return new Set(gym.availableEquipment);
}

export function isEquipmentAvailable(equipment: Equipment, gym: GymLocation | null): boolean {
  if (!gym || !gym.availableEquipment) return true; // null = all equipment
  return gym.availableEquipment.includes(equipment);
}
```

#### Plate helpers

```typescript
export function getGymPlates(gym: GymLocation | null): number[] {
  if (!gym || !gym.availablePlates) return DEFAULT_PLATES_KG;
  return gym.availablePlates;
}
```

## Files to create/modify

- `c:/Users/Flage/Desktop/gymdash/src/gymStore.ts` — create new file (full content described above)
- `c:/Users/Flage/Desktop/gymdash/src/plateCalculator.ts` — change `const DEFAULT_PLATES_KG` to `export const DEFAULT_PLATES_KG` on line 76

## Patterns to follow

- See `c:/Users/Flage/Desktop/gymdash/src/exerciseNotes.ts` for the synchronous named-export pattern: `getDb()` called directly inside each function, try/catch returning safe defaults, no module-level state.
- See `c:/Users/Flage/Desktop/gymdash/src/storage.ts` for `uid(prefix)` and `isoNow()` usage.
- The JSON column pattern (stringify on write, parse on read with null guard) mirrors `exercises_json` handling in `programStore.ts`.
- `getSetting` / `setSetting` from `src/db.ts` are the correct synchronous settings API (already imported by many modules).

## Verification

Run `npm run verify` when done.

Additional checks:
- `npx tsc --noEmit` must produce zero errors in `gymStore.ts` and `plateCalculator.ts`.
- `listGyms()` should return `[]` on a fresh DB (the `gym_locations` table is empty).
- Confirm that existing callers of `calculatePlates()` in `src/plateCalculator.ts` are unaffected — the default argument `availablePlates: number[] = DEFAULT_PLATES_KG` still works because the value itself is unchanged.

## Important constraints

- Do NOT import `gymStore.ts` from `db.ts` or `exerciseLibrary.ts`. Those files are part of a circular-import chain that is carefully managed with lazy `require()`. `gymStore.ts` imports from `db.ts` only, which is safe.
- All DB functions must be synchronous (use `getAllSync`, `getFirstSync`, `runSync`). Async versions are not used in this module.
- `availableEquipment: null` means the gym has all equipment available — this is the default for newly created gyms unless the user explicitly restricts it.
- `getActiveGymId()` must never throw. If the settings table is unavailable (e.g. before `initDb` completes), it returns `null`.
- The `icon` field is reserved for v2 and is always `null` in v1. Accept it in the type but do not build any UI for it in this task.
