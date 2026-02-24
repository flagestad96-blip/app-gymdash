# Task 01: DB migration v22 + LastSetInfo type extension

## Context
This is the foundation task for the Gym Locations feature (Prompt 1 of 4). The feature lets users tag workouts to named gym locations and get gym-scoped weight history, equipment filtering, and plate sets. Nothing is visible to the user until at least one gym is created. This task lays the database groundwork by adding the `gym_locations` table and a `gym_id` column to `workouts`, and extends the `LastSetInfo` type so later tasks can use the `fromOtherGym` flag without touching component logic yet.

## What to do

### 1. Append migration v22 to `src/db.ts`

The migration array ends at version 21 (line 565 in `src/db.ts`). Append one new entry immediately after the closing `},` of migration 21, before the closing `];` of the `MIGRATIONS` array:

```typescript
// 22: gym_locations table + workouts.gym_id column + index
{ version: 22, up: (d) => {
  d.execSync(`
    CREATE TABLE IF NOT EXISTS gym_locations (
      id                  TEXT    PRIMARY KEY NOT NULL,
      name                TEXT    NOT NULL,
      color               TEXT,
      icon                TEXT,
      available_equipment TEXT,
      available_plates    TEXT,
      sort_index          INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT    NOT NULL
    );
  `);
  try { d.execSync(`ALTER TABLE workouts ADD COLUMN gym_id TEXT;`); } catch {}
  d.execSync(`CREATE INDEX IF NOT EXISTS idx_workouts_gym ON workouts(gym_id);`);
}},
```

Key points:
- `available_equipment` and `available_plates` are JSON TEXT columns, nullable. NULL means "all equipment" / "use defaults".
- The `ALTER TABLE` is wrapped in try/catch for idempotency, matching the pattern used throughout the existing migrations (see migrations 1, 2, 3, 11, 13, 15).
- Do NOT touch the baseline schema block (the `db.execSync` at the top of `initDb`). That block defines the initial schema for fresh installs. The migration handles existing installs.

### 2. Extend `LastSetInfo` in `src/components/workout/ExerciseCard.tsx`

The `LastSetInfo` type is defined at lines 25-31:

```typescript
export type LastSetInfo = {
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  workout_id?: string | null;
};
```

Add `fromOtherGym?: boolean;` as the last field:

```typescript
export type LastSetInfo = {
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  workout_id?: string | null;
  fromOtherGym?: boolean;  // true when pre-fill weight came from a different gym (Task 08)
};
```

Do NOT add any rendering logic for this flag yet. That is handled in Task 08. This change is type-only.

## Files to modify

- `c:/Users/Flage/Desktop/gymdash/src/db.ts` — append migration v22 to the `MIGRATIONS` array
- `c:/Users/Flage/Desktop/gymdash/src/components/workout/ExerciseCard.tsx` — add `fromOtherGym?: boolean` to `LastSetInfo`

## Patterns to follow

- Migration pattern: see migrations 1, 2, 11, 13 in `src/db.ts` for the try/catch ALTER TABLE style and single-line comment above each version block.
- The `CREATE INDEX IF NOT EXISTS` pattern is already used throughout. Do not use `CREATE INDEX` without `IF NOT EXISTS`.
- The `LastSetInfo` type follows the existing optional-field style (`rpe?: number | null`, `workout_id?: string | null`).

## Verification

Run `npm run verify` when done.

Additional manual checks:
- `npx expo start` — app must boot without any runtime error or crash.
- On a fresh install (or after clearing app data), the migration runner should log the v22 migration completing without error. You can add a temporary `console.log('[db] migration 22 done')` inside the migration body and remove it after confirming.
- Optionally inspect the SQLite file with a DB browser to confirm `gym_locations` table exists and `workouts` has a `gym_id` column.

## Important constraints

- Do NOT add `gym_locations` to the baseline schema block (`db.execSync` at line 236). New tables go only in migrations, not in the baseline. This mirrors how `exercise_notes` (migration 17) and `day_marks` (migration 16) were added.
- Do NOT modify any existing migration versions. Only append.
- Do NOT change any component rendering logic in `ExerciseCard.tsx` — the `fromOtherGym` flag is type-only in this task.
- Android: NEVER add `elevation` to elements with transparent/semi-transparent `backgroundColor` (causes white rectangle on Android). This task has no UI, so this constraint is informational for later tasks.
- The `gym_id` column on `workouts` has no enforced FK constraint — this is intentional. NULL is a valid permanent state for pre-gym legacy workouts.
