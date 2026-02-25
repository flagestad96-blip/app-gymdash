# PR Recalculation on Set Edit/Delete — Task Plan
**Date:** 2026-02-24
**Feature:** pr-recalc
**Source plan:** docs/architecture/pr-recalc-arch-2026-02-24.md
**Code map:** docs/scout/pr-recalc-scout-2026-02-24.md

---

## Overview

Five ordered tasks. Task 1 is the foundation; tasks 2-5 each depend on Task 1 but are
otherwise independent of one another. Tasks 3 and 4 both modify `log.tsx` — they are
split because `saveEditSet` has a stricter ordering requirement and bwData scoping hazard.

Dependency graph:
```
Task 1 (prEngine.ts)
  ├── Task 2 (prEngine.test.ts)
  ├── Task 3 (log.tsx deleteSet)
  ├── Task 4 (log.tsx saveEditSet)
  └── Task 5 (settings.tsx + i18n)
```

---

## Task 1: Add `recomputePRForExercise` to `src/prEngine.ts`

- **Depends on:** nothing
- **Files modified:** `src/prEngine.ts`
- **Files scanned by @codebase-scanner before writing:** `src/prEngine.ts` (full),
  `src/db.ts` (pr_records schema + index definitions), `src/metrics.ts` (epley1RM, round1)

### What it does

Adds a new synchronous exported function `recomputePRForExercise` after the existing
`checkSetPRs` function (currently ending at line 130). The function:

1. Takes `(exerciseId: string, programId: string)` as parameters.
2. Returns `Partial<Record<PrType, PrRecord>>` — the corrected state for that exercise.
3. Uses `getAllSync` (not `runAsync`) for all reads — consistent with `loadPrRecords`.
4. Queries all non-warmup sets for the given exercise+program by joining `sets` on
   `workouts` filtered by `program_id`, with `WHERE (s.is_warmup = 0 OR s.is_warmup IS NULL)`.
5. For each row, uses `est_total_load_kg` when non-null (bodyweight exercises) and
   falls back to the `weight` column otherwise.
6. Finds the true max `heaviest` (highest effective weight) and max `e1rm` (Epley formula
   applied per set, highest result) across all qualifying rows.
7. If no qualifying sets remain: calls `db.runSync` (or equivalent synchronous delete) to
   `DELETE FROM pr_records WHERE exercise_id = ? AND program_id = ? AND type IN ('heaviest','e1rm')`,
   then returns `{}`.
8. If qualifying sets exist: calls `db.runSync` twice with
   `INSERT OR REPLACE INTO pr_records(exercise_id, type, value, reps, weight, set_id, date, program_id)`
   for `heaviest` and `e1rm` using the winning set's data. Returns both records.
9. Per-side exercises: uses raw weight (no doubling) for heaviest/e1RM — volume doubling
   is only relevant for `checkSessionVolumePRs`, not single-set records.
10. Empty `programId`: guard at entry — return `{}` immediately without any DB access.
11. Wraps all DB operations in try/catch; returns `{}` on any error.

### Key constraints

- Must be synchronous end-to-end (no `async`/`await`). The existing `loadPrRecords` at
  line 23 is the model — follow the same `getAllSync`/`runSync` pattern.
- The `checkSetPRs` function uses `runAsync` for writes. `recomputePRForExercise` uses
  `runSync`. Both are valid; the distinction matters for tests.
- Do NOT touch `checkSetPRs`, `checkSessionVolumePRs`, or `loadPrRecords`.
- Export the function so `log.tsx` and `settings.tsx` can import it.
- The function signature to export: `recomputePRForExercise(exerciseId: string, programId: string): Partial<Record<PrType, PrRecord>>`

### Verify

`npm run verify` passes (typecheck + lint). No runtime DB calls are made at module level.

---

## Task 2: Unit tests for `recomputePRForExercise` in `src/__tests__/prEngine.test.ts`

- **Depends on:** Task 1
- **Files modified:** `src/__tests__/prEngine.test.ts`
- **Files scanned by @codebase-scanner before writing:** `src/__tests__/prEngine.test.ts`
  (full, for mock structure and existing test patterns)

### What it does

Extends the existing test file with a new `describe("recomputePRForExercise", ...)` block.
The existing mock setup at lines 2-12 provides `mockGetAllSync`, `mockGetFirstSync`, and
`mockRunAsync`. A new `mockRunSync` mock must be added to the DB mock object alongside the
existing three. The import at line 19 must be extended to also import `recomputePRForExercise`.

Six test cases to add:

1. **No sets remain → deletes PR records**
   `mockGetAllSync` returns `[]`. Verify `mockRunSync` is called with a SQL string
   containing `DELETE FROM pr_records`.

2. **Max is not the most-recent set — finds true max**
   `mockGetAllSync` returns three rows with weights 80, 100, 90 kg (in that order).
   Verify returned `heaviest.value` is 100, not 90.

3. **Warmup sets are excluded**
   `mockGetAllSync` returns two rows: one work set at 100 kg (`is_warmup = 0`) and one
   warmup at 120 kg (`is_warmup = 1`). Verify `heaviest.value` is 100.
   Note: the SQL filter happens in the query, so the mock should only return the rows that
   the query would return (i.e., mock the filtered result — both rows passed to the mock
   means the filter is applied by the function itself, or only the filtered rows are
   returned by `getAllSync`). Follow whichever approach matches the existing pattern in
   `checkSetPRs` tests.

4. **Bodyweight exercise uses `est_total_load_kg`**
   Two rows for `pull_up`: one with `weight = 10`, `est_total_load_kg = 90`; one with
   `weight = 5`, `est_total_load_kg = 85`. Verify `heaviest.value` is 90, not 10.

5. **Per-side exercise uses raw weight (no doubling)**
   One row for `dumbbell_curl` with `weight = 25`, `est_total_load_kg = null`.
   Verify `heaviest.value` is 25 (not 50).

6. **Correct DB writes on found maximum**
   One row at 100 kg / 5 reps. Verify `mockRunSync` is called twice with SQL strings
   containing `'heaviest'` and `'e1rm'` respectively.

### Key constraints

- `mockRunSync` must be added to the mock object returned by `getDb()` at the top of
  the file, alongside the existing `getAllSync`, `getFirstSync`, `runAsync`.
- Add `mockRunSync.mockReset()` to the `beforeEach` block at line 21.
- Do not modify or remove any existing `checkSetPRs` or `checkSessionVolumePRs` tests.

### Verify

`npm run test` passes all 6 new cases plus all existing 11 cases.

---

## Task 3: Wire `recomputePRForExercise` into `deleteSet` in `app/(tabs)/log.tsx`

- **Depends on:** Task 1
- **Files modified:** `app/(tabs)/log.tsx`
- **Files scanned by @codebase-scanner before writing:** `app/(tabs)/log.tsx` lines
  1069-1131 (handleUndo + deleteSet), and the import block at the top of the file

### What it does

Modifies `deleteSet` (currently lines 1123-1131) so that after the set is deleted from
the DB, `recomputePRForExercise` is called for the affected exercise and the result is
merged into the `prRecords` state. The PR banner for the exercise is also cleared.

The pattern to follow is `handleUndo` (lines 1069-1089), which already does:
1. Delete the set from DB.
2. Reload PR records via `loadPrRecords`.
3. Update `prRecords` state.
4. Clear `prBanners` for the exercise.

`deleteSet` should follow the same structure but call `recomputePRForExercise` instead
of `loadPrRecords`. The difference: `recomputePRForExercise` does a full historical scan
and writes the corrected values to DB before returning, so no second DB read is needed.

Specific changes:
1. Add `recomputePRForExercise` to the import from `../../src/prEngine` at the top of
   `log.tsx`.
2. Inside the `onPress: async () => { ... }` callback inside `deleteSet`:
   - After `await getDb().runAsync('DELETE FROM sets WHERE id = ?', [row.id])` succeeds,
   - Derive `exId = row.exercise_id ?? row.exercise_name` (consistent with the existing
     exercise ID fallback pattern used elsewhere in the file).
   - Derive `programId = program?.id ?? ""`.
   - If `programId` is truthy, call `recomputePRForExercise(exId, programId)` and update
     `prRecords` state: `setPrRecords(prev => ({ ...prev, [exId]: result }))`.
   - Clear banner: `setPrBanners(prev => { const n = {...prev}; delete n[exId]; return n; })`.
   - Keep the existing `refreshWorkoutSets()` call — it must still run.
3. The `refreshWorkoutSets()` call can remain after the recompute block (order:
   recompute → update state → clear banner → refresh sets).

### Key constraints

- Do not modify `handleUndo`. It already works correctly.
- Do not alter `saveEditSet` — that is Task 4.
- The `exId` fallback (`row.exercise_id ?? row.exercise_name`) is the same pattern used
  in `checkSessionVolumePRs` and throughout `log.tsx`.
- `recomputePRForExercise` is synchronous — no `await` needed.
- If `programId` is empty, skip the recompute silently (no crash).

### Verify

`npm run verify` passes. Manually: delete a set that holds a PR; the PR banner disappears
and the `prRecords` state reflects the new max (or no record if no sets remain).

---

## Task 4: Wire `recomputePRForExercise` into `saveEditSet` in `app/(tabs)/log.tsx`

- **Depends on:** Task 1 (and Task 3 should be complete first to keep log.tsx changes
  ordered, though not strictly required)
- **Files modified:** `app/(tabs)/log.tsx`
- **Files scanned by @codebase-scanner before writing:** `app/(tabs)/log.tsx` lines
  1099-1131 (saveEditSet + deleteSet in their post-Task-3 state)

### What it does

Modifies `saveEditSet` (currently lines 1099-1121) to:
1. Call `checkSetPRs` FIRST (forward/edit-up case — fires the PR banner if the new values
   beat the record).
2. Then call `recomputePRForExercise` (ghost correction — corrects the record if the new
   values are lower than the stored PR).

The ordering is critical: if `recomputePRForExercise` runs before `checkSetPRs`, the
edit-up banner will never fire (recompute overwrites before the comparison happens).

Specific changes:

1. `recomputePRForExercise` is already imported after Task 3. Confirm `checkSetPRs` is
   also imported (it is, at the existing import line).

2. After both `runAsync` DB update paths (the `if (isBw)` branch at line 1108 and the
   `else` branch at line 1115) complete — but before `refreshWorkoutSets()` — add the
   following logic inside the `try` block:

   a. Declare `estTotalLoadKgForCheck: number | null = null` BEFORE the `if (isBw)` branch
      so it is in scope after the branch closes. Inside the `if (isBw)` branch, after
      `bwData` is computed, assign `estTotalLoadKgForCheck = bwData.est_total_load_kg ?? null`.

   b. After the if/else update block, derive:
      - `exId = editSet.exercise_id ?? editSet.exercise_name`
      - `programId = program?.id ?? ""`
      - `isBwFlag = editSet.exercise_id ? isBodyweight(editSet.exercise_id) : false`

   c. If `programId` is truthy:
      - Call `await checkSetPRs({ exerciseId: exId, weight, reps, setId: editSet.id, workoutId: currentWorkout?.id ?? "", programId, currentVolumeRecord: prRecords[exId]?.volume, isBw: isBwFlag, estTotalLoadKg: estTotalLoadKgForCheck })`.
      - Apply the `updatedRecords` and `messages` from the result:
        - Update `prRecords`: `setPrRecords(prev => ({ ...prev, [exId]: { ...prev[exId], ...checkResult.updatedRecords } }))`.
        - If `checkResult.messages.length > 0`, fire the banner (same pattern as `addSetForExercise`).
      - Then call `recomputePRForExercise(exId, programId)` and merge the result into
        `prRecords` state: `setPrRecords(prev => ({ ...prev, [exId]: { ...prev[exId], ...recomputeResult } }))`.

   d. Keep `refreshWorkoutSets()` at the end.

3. `currentWorkout` is already available in `log.tsx` scope — use its `.id` for the
   `workoutId` argument to `checkSetPRs`.

### Key constraints

- ORDERING IS CRITICAL: `checkSetPRs` before `recomputePRForExercise`. Reversing this
  suppresses edit-up PR banners.
- `estTotalLoadKgForCheck` must be declared with `let` in the outer scope of the `try`
  block, before the `if (isBw)` branch, so it is readable after the branch closes. If
  declared inside the `if` block it will be out of scope.
- The double-write (checkSetPRs writes, then recomputePRForExercise also writes the same
  row) is harmless — both use `INSERT OR REPLACE`.
- Do not move or restructure the `if (isBw)` / `else` DB update branches themselves.
- `checkSetPRs` is async; `recomputePRForExercise` is synchronous. Both are called
  inside the existing `async function saveEditSet`.

### Verify

`npm run verify` passes. Manually:
- Edit a set upward (e.g. 80 → 90 kg when record is 85): PR banner fires.
- Edit a set downward (e.g. 100 → 80 kg when that set was the PR): PR updates to next
  highest set in the session, no ghost PR remains.

---

## Task 5: "Repair All PRs" button in `app/(tabs)/settings.tsx` + i18n

- **Depends on:** Task 1
- **Files modified:**
  - `app/(tabs)/settings.tsx`
  - `src/i18n/nb/settings.ts`
  - `src/i18n/en/settings.ts`
  - `src/i18n/merge.ts`
- **Files scanned by @codebase-scanner before writing:**
  - `app/(tabs)/settings.tsx` — the "Data & Rydding" card section and surrounding
    button patterns (search for `settings.dataCleanup` and nearby `GradientButton` /
    `ListRow` usages)
  - `src/i18n/nb/settings.ts` (full, for key naming conventions)
  - `src/i18n/en/settings.ts` (full)
  - `src/i18n/merge.ts` (for `EXPECTED_MIN_KEYS` value)

### What it does

Adds a "Repair All PRs" action to the Data & Rydding card in settings. When tapped, it:
1. Shows an `Alert.alert` confirmation dialog.
2. On confirm: queries `SELECT DISTINCT exercise_id, program_id FROM pr_records` to find
   all exercise+program pairs that have any PR record.
3. Calls `recomputePRForExercise(exerciseId, programId)` for each pair (synchronous loop).
4. Shows a success `Alert.alert` with the count of exercises repaired.

The function lives in `settings.tsx` (not a separate file). It follows the same async
pattern as `deleteEmpty` and other data-cleanup functions already in the file.

#### i18n keys to add (6 total, both nb and en)

| Key | nb value | en value |
|-----|----------|----------|
| `settings.repairPrs` | `"Reparer PRs"` | `"Repair PRs"` |
| `settings.repairPrs.desc` | `"Skann alle sett og korriger PR-rekorder som kan ha blitt feil etter redigering eller sletting."` | `"Scan all sets and correct PR records that may have become stale after editing or deleting sets."` |
| `settings.repairPrs.confirm` | `"Reparer alle PRs?"` | `"Repair all PRs?"` |
| `settings.repairPrs.confirmMsg` | `"Dette skanner alle sett og oppdaterer PR-tabellen. Ingen data slettes."` | `"This will scan all sets and update the PR table. No data will be deleted."` |
| `settings.repairPrs.done` | `"PRs reparert"` | `"PRs repaired"` |
| `settings.repairPrs.doneMsg` | `"Oppdaterte {n} øvelse(r)."` | `"Updated {n} exercise(s)."` |

#### merge.ts change

Increment `EXPECTED_MIN_KEYS` from `580` to `586` (adding 6 new keys).

### Key constraints

- `recomputePRForExercise` only handles `heaviest` and `e1rm` — volume PR is deliberately
  excluded (it is session-total and only written at workout end). Do not add volume to
  the repair loop.
- The query to find pairs (`SELECT DISTINCT exercise_id, program_id FROM pr_records`)
  covers only exercises that already have a PR record. Exercises with no PR record at all
  are not affected — this is correct behaviour (they would produce empty repairs anyway).
- The button should be placed inside the Data & Rydding card, after the existing
  "Slett tomme økter" button, before any destructive (reset/delete-all) buttons.
- Import `recomputePRForExercise` from `../../src/prEngine` at the top of `settings.tsx`.
- The repair runs synchronously per exercise but the outer function is `async` (it uses
  `getDb().getAllSync` inside the loop). Wrap in try/catch and show an error alert on failure.

### Verify

`npm run verify` passes. In the settings screen, the Data & Rydding modal contains a
"Reparer PRs" button. Tapping it shows the confirmation alert; confirming runs the repair
and shows the done alert with an exercise count.
