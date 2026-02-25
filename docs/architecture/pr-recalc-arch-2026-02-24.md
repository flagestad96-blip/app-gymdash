# PR Recalculation on Set Edit/Delete — Architecture

**Date:** 2026-02-24
**Feature:** pr-recalc
**Complexity:** M
**Status:** Ready for task splitting

---

## Overview

When a user edits a set's weight/reps downward, or deletes a set, `pr_records` is not updated. Ghost PRs persist. Fix: add `recomputePRForExercise()` to prEngine.ts, wire into deleteSet/saveEditSet, add Settings repair button.

No schema changes. No migrations. 5 phases.

## Phases

### Phase 1: `recomputePRForExercise` in `src/prEngine.ts`
- New synchronous export after `checkSetPRs` (line ~130)
- Queries all non-warmup sets for exercise+program, finds true max heaviest + e1RM
- Writes via INSERT OR REPLACE, or DELETE if no sets remain
- Returns `Partial<Record<PrType, PrRecord>>` for direct state update

### Phase 2: Wire into `deleteSet()` in `log.tsx`
- After DELETE + refreshWorkoutSets, call recomputePRForExercise
- Update prRecords state, clear stale banner

### Phase 3: Wire into `saveEditSet()` in `log.tsx`
- CRITICAL: `checkSetPRs` FIRST (forward/edit-up banner), then `recomputePRForExercise` (ghost correction)
- Handle bwData scoping: declare `estTotalLoadKgForCheck` before if/else branches

### Phase 4: "Repair All PRs" in `settings.tsx`
- New button in Data & Cleanup card
- Iterates all distinct (exercise_id, program_id) pairs, calls recomputePRForExercise
- 6 new i18n keys (nb + en), update EXPECTED_MIN_KEYS

### Phase 5: Unit tests in `src/__tests__/prEngine.test.ts`
- Add mockRunSync to DB mock
- 6 test cases: no sets → delete, max in middle, warmup filter, bodyweight, per-side, DB writes

## Files Changed

| File | Phases |
|------|--------|
| `src/prEngine.ts` | 1 |
| `app/(tabs)/log.tsx` | 2, 3 |
| `app/(tabs)/settings.tsx` | 4 |
| `src/i18n/nb/settings.ts` | 4 |
| `src/i18n/en/settings.ts` | 4 |
| `src/i18n/merge.ts` | 4 |
| `src/__tests__/prEngine.test.ts` | 5 |

## Key Decisions

1. `recomputePRForExercise` is synchronous (getAllSync/runSync) — consistent with loadPrRecords
2. saveEditSet ordering: checkSetPRs BEFORE recompute (reversing suppresses edit-up banners)
3. Volume PR untouched — session-total computed at endWorkout, edits reflected automatically
4. Per-side exercises use raw weight (no doubling) for heaviest/e1RM
5. "Repair All PRs" handles only heaviest + e1rm, not volume

## Edge Cases

- Empty programId → skip (PRs not tracked without program)
- Legacy sets without exercise_id → invisible to recompute (pre-existing known gap)
- est_total_load_kg NULL for bodyweight → falls back to weight column
- Double-write in edit-up (checkSetPRs then recompute both write) → harmless INSERT OR REPLACE
- Warmup IS NULL guard → treats legacy sets as work sets
