# DB Migration Design — Per-Side + Composite Index
**Date:** 2026-02-25
**Current migration version:** 22 (gym_locations)
**Current backup schemaVersion:** 4

---

## Summary of Changes

| # | Sprint | Change | Migration Version | Backup Version |
|---|--------|--------|-------------------|----------------|
| 1 | Sprint 1 | `custom_exercises.is_per_side` column | 23 | No change needed |
| 2 | Sprint 1 | Composite index `workouts(date, id)` | 24 | No change needed |
| 3 | Sprint 2 | Training status storage | None — on-demand computation | No change |

---

## Migration 23 — `custom_exercises.is_per_side`

### Problem

`isPerSideExercise(id)` only checks `byId[id]?.isPerSide`, the hardcoded library. Custom exercises can never be per-side, silently undercounting volume by 50%.

### SQL

```sql
ALTER TABLE custom_exercises ADD COLUMN is_per_side INTEGER NOT NULL DEFAULT 0;
```

### Migration block

```typescript
// 23: custom_exercises — is_per_side column
{ version: 23, up: (d) => {
  if (!hasColumn("custom_exercises", "is_per_side")) {
    d.execSync(`ALTER TABLE custom_exercises ADD COLUMN is_per_side INTEGER NOT NULL DEFAULT 0;`);
  }
}},
```

### Backward compatibility

`DEFAULT 0` preserves current behavior. All existing custom exercises remain bilateral. Users edit them after the toggle UI is added.

### Data backfill

None required. Default 0 matches pre-migration behavior.

### Backup / restore impact

Update `exportFullBackup()` SELECT to include `is_per_side`:
```sql
SELECT id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, is_per_side, created_at FROM custom_exercises
```

Update `importBackup()` INSERT to pass `is_per_side`:
```typescript
// 9 columns now:
`${verb} custom_exercises(id, display_name, equipment, tags, default_increment_kg, is_bodyweight, bodyweight_factor, is_per_side, created_at)
 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`
[ce.id, ce.display_name, ce.equipment, ce.tags, ce.default_increment_kg ?? 2.5, ce.is_bodyweight ?? 0, ce.bodyweight_factor ?? null, ce.is_per_side ?? 0, ce.created_at]
```

`ce.is_per_side ?? 0` handles old backups that pre-date this column. **No backup schemaVersion bump needed** — additive column with safe fallback.

### TypeScript type change

```typescript
// In CustomExRow, add:
is_per_side: number;  // 0 or 1

// In rowToExerciseDef(), add:
isPerSide: row.is_per_side === 1

// In createCustomExercise(), accept:
isPerSide?: boolean
// and include in INSERT
```

---

## Migration 24 — Composite index on `workouts(date, id)`

### Problem

Existing index is `idx_workouts_date ON workouts(date)`. Period comparison and training status queries filter by date range and need id. Composite index allows both from the index B-tree.

### SQL

```sql
CREATE INDEX IF NOT EXISTS idx_workouts_date_id ON workouts(date, id);
```

### Migration block

```typescript
// 24: workouts — composite (date, id) covering index
{ version: 24, up: (d) => {
  d.execSync(`CREATE INDEX IF NOT EXISTS idx_workouts_date_id ON workouts(date, id);`);
}},
```

### Notes

- Idempotent via `IF NOT EXISTS`
- Existing `idx_workouts_date` left in place (tiny storage cost, query planner uses more specific one)
- Also add to base schema block for fresh installs (defensive)
- No backup impact — indexes aren't exported

---

## Training Status — No Persistent Storage Needed

### Data volume analysis

Typical user: 4 workouts/week × 4 weeks = 16 workouts, ~320 sets. With `idx_workouts_date_id` and `idx_sets_workout`, this query completes in under 5ms on mid-range Android.

### Recommendation

On-demand computation in `src/trainingStatus.ts`. No new table. Both home screen and analysis call it directly. If performance ever becomes an issue, cache in `settings` table as JSON string with TTL — zero schema changes.

Persistent storage would introduce staleness risk (wrong after set edits) and cache invalidation complexity for no performance benefit.

---

## Files That Must Change

### Sprint 1 (DB-related):
| File | Change |
|------|--------|
| `src/db.ts` | Add migrations 23, 24; add composite index to base schema block |
| `src/exerciseLibrary.ts` | `CustomExRow` type, `rowToExerciseDef()`, `createCustomExercise()` |
| `src/backup.ts` | Add `is_per_side` to custom_exercises SELECT and INSERT |

### Sprint 2 (DB-adjacent):
| File | Change |
|------|--------|
| `src/trainingStatus.ts` | New file — pure computation, no new tables |

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| `hasColumn()` guard fails on old SQLite | Low | Guard catches and returns false safely |
| Old backup missing `is_per_side` | Handled | `?? 0` fallback in importBackup() |
| Both date indexes exist | Acceptable | Query planner picks the better one |
| Base schema block missing composite index | Medium | Add `CREATE INDEX IF NOT EXISTS` to base schema block too |
