# Scout Report: PR Recalculation System
**Date:** 2026-02-24

## Key Files

| File | Role | Key Lines |
|------|------|-----------|
| `src/prEngine.ts` (214 lines) | PR calculation engine | `checkSetPRs()` 64-130, `checkSessionVolumePRs()` 153-213, `loadPrRecords()` 23-43 |
| `app/(tabs)/log.tsx` (1500+ lines) | Workout UI & state | `saveEditSet()` 1099-1121, `deleteSet()` 1123-1131, `handleUndo()` 1069-1089, `addSetForExercise()` ~950, `endWorkout()` 827-907 |
| `src/db.ts` | Schema & migrations | `pr_records` table, indexes |
| `src/__tests__/prEngine.test.ts` (257 lines) | Test suite | heaviest/e1rm/volume/baseline tests |

## PR Types & Table

```typescript
type PrType = "heaviest" | "e1rm" | "volume";
// pr_records: PRIMARY KEY (exercise_id, type, program_id)
// Columns: exercise_id, type, value, reps, weight, set_id, date, program_id
// Index: idx_pr_records_exercise
```

## Current Flows

### Set Add → PR Check (WORKING)
`addSetForExercise()` → `checkSetPRs()` → reads DB → INSERT OR REPLACE if new PR → banner 4sec

### Set Edit (BROKEN - no PR recalc)
`saveEditSet()` → UPDATE DB → `refreshWorkoutSets()` → DONE (pr_records untouched)

### Set Delete (BROKEN - no PR recalc)
`deleteSet()` → DELETE FROM DB → `refreshWorkoutSets()` → DONE (pr_records untouched)

### Undo Set (WORKING - the pattern to follow)
`handleUndo()` → DELETE set → DELETE pr_records WHERE set_id → `loadPrRecords()` → update state → clear banner

### Workout End → Volume PR (WORKING)
`endWorkout()` → `checkSessionVolumePRs()` → sums session total per exercise → writes if new PR

## The Gap

`saveEditSet()` and `deleteSet()` update/remove the set in DB but never touch `pr_records`. If the edited/deleted set was the PR-holder, the ghost PR persists forever.

## Key Patterns

**Reload PR from DB (from handleUndo):**
```typescript
const reloaded = loadPrRecords(programId, [exerciseId]);
setPrRecords((prev) => ({ ...prev, [exerciseId]: reloaded[exerciseId] ?? {} }));
```

**Show PR banner:**
```typescript
setPrBanners((prev) => ({ ...prev, [exId]: messages.join("\n") }));
setTimeout(() => setPrBanners(prev => { const n={...prev}; delete n[exId]; return n; }), 4000);
```

## Gotchas
- DB is source of truth, React state is cache — always reload from DB after mutation
- Exercise ID fallback: `exId = exercise_id ?? exercise_name` (legacy sets)
- Warmup sets should be excluded from PR scans (`is_warmup = 0`)
- Per-side exercises multiply volume × 2
- Bodyweight exercises use `est_total_load_kg` instead of `weight`
- Volume PR is session-total, only computed at workout end
- Baseline detection: first-ever session for an exercise → no banner (just records)
