# Gym Locations — Database Architecture Design
**Date:** 2026-02-24
**Migration target:** v22 (current: v21)
**Backup schema version:** 3 -> 4

---

## Design Decisions

1. **Equipment storage:** JSON column `available_equipment TEXT` on `gym_locations`
2. **Plates storage:** JSON column `available_plates TEXT` on `gym_locations`
3. **Active gym:** `settings` key `"activeGymId"` — empty string = no active gym
4. **workouts.gym_id:** Nullable TEXT, no enforced FK, NULL = pre-gym legacy workout
5. **Index:** `idx_workouts_gym ON workouts(gym_id)` — yes
6. **Other tables in v1:** None modified (sets, pr_records, exercise_targets, exercise_notes stay global)
7. **Backup:** Bump CURRENT_SCHEMA_VERSION 3 -> 4

---

## Migration v22

```typescript
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

---

## Column Rationale

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | TEXT PK | NO | `uid("gym")` |
| `name` | TEXT | NO | Required |
| `color` | TEXT | YES | Hex string for chip dot |
| `icon` | TEXT | YES | Emoji or icon key, unused in v1 |
| `available_equipment` | TEXT | YES | JSON `Equipment[]`. NULL = all equipment |
| `available_plates` | TEXT | YES | JSON `number[]`. NULL = use defaults |
| `sort_index` | INTEGER | NO DEFAULT 0 | Display order |
| `created_at` | TEXT | NO | ISO 8601 |

---

## Backward Compatibility

- All existing workouts: `gym_id = NULL`
- Queries: always LEFT JOIN on gym_locations
- NULL gym_id is permanent valid state
- Feature invisible until first gym created
- `getSetting("activeGymId")` returns null for existing users

---

## Backup Changes

- Bump CURRENT_SCHEMA_VERSION 3 -> 4
- Export: add gym_locations table, add gym_id to workouts SELECT
- Import: handle gym_locations array, pass gym_id in workouts INSERT
- v3 backup into v4 app: safe (empty gym_locations, NULL gym_ids)
- v4 backup into v3 app: rejected by existing version guard

---

## v2 Extension Points

- Gym-scoped exercise notes: new `gym_exercise_notes(gym_id, exercise_id)` table
- Per-gym bar preferences: `bar_prefs TEXT` column or junction table
- Gym-scoped PRs: add `gym_id` to `pr_records` PK
- Per-machine tracking: `gym_machines(id, gym_id, equipment_type, name, notes)` table
- Program-gym binding: nullable `gym_id TEXT` on `programs`
- GPS: `latitude REAL`, `longitude REAL` columns on `gym_locations`
