# Task 07: Workout tagging — gym_id written on startWorkout — Prompt 7 av 12

## Kontekst fra teamet:
- @architect: Phase 4 — `startWorkout()` INSERT gains `gym_id`; chip locks mid-session; matches `selectDayIndex` Alert lock pattern exactly
- @db-designer: `workouts.gym_id` is a nullable TEXT column added in migration v22 (Task 01); NULL is valid for no-gym workouts
- @codebase-scanner: `startWorkout()` function in `app/(tabs)/log.tsx` lines 758–773; `selectDayIndex` lock pattern lines 740–743; `GymPickerModal` render added in Task 06

---

# Task 07: Workout tagging — gym_id on startWorkout

## Context

This is part of the Gym Locations feature (branch `experiment/agent-pipeline-gym-locations`).

The following tasks are already complete:
- **Task 01**: DB migration v22 — `gym_locations` table and `workouts.gym_id` nullable TEXT column exist. Index `idx_workouts_gym` exists.
- **Task 02**: `src/gymStore.ts` — full CRUD, `getActiveGymId()`, `setActiveGymId()`.
- **Task 03**: i18n keys including `t("gym.lockedMidSession")` (the alert message key).
- **Task 05**: `GymPickerModal.tsx` created — it accepts a `disabled` prop; when `true`, shows an Alert instead of calling `onSelect`.
- **Task 06**: `app/(tabs)/log.tsx` now has `activeGymId`, `gyms`, `gymPickerOpen` state; gym chip renders in the chip row; `GymPickerModal` is rendered with `disabled={false}`.

**Task 07** makes two targeted changes to `app/(tabs)/log.tsx`:
1. Write `gym_id` to the `workouts` table when a workout starts.
2. Lock the gym chip mid-session (change `disabled={false}` to `disabled={!!activeWorkoutId}`).

## What to do

Modify `app/(tabs)/log.tsx` with the following targeted changes only:

### 1. Add `gym_id` to the `startWorkout()` INSERT

Find the `startWorkout` function (approximately lines 758–773). The current INSERT statement is:

```typescript
await getDb().runAsync(
  `INSERT INTO workouts(id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [id, isoDateOnly(), programMode, programId, getDayKey(), "green", "", activeDayIndex, startedAt]
);
```

Change it to include `gym_id`:

```typescript
await getDb().runAsync(
  `INSERT INTO workouts(id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at, gym_id) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  [id, isoDateOnly(), programMode, programId, getDayKey(), "green", "", activeDayIndex, startedAt, activeGymId ?? null]
);
```

`activeGymId` is already available as a React state variable (added in Task 06). Pass `activeGymId ?? null` to ensure a string `null` never gets written (the `??` null coalescing guards against undefined).

### 2. Lock the gym chip mid-session

Find the `GymPickerModal` render added in Task 06. Change the `disabled` prop from `disabled={false}` to:

```tsx
disabled={!!activeWorkoutId}
```

This means:
- When no workout is active (`activeWorkoutId` is `null`): `disabled` is `false` — picker works normally.
- When a workout is active (`activeWorkoutId` is a string): `disabled` is `true` — `GymPickerModal` internally shows an Alert (`t("gym.lockedMidSession")`) instead of calling `onSelect`.

No other changes are needed. The gym chip itself in the chip row should already call `setGymPickerOpen(true)` on press — the modal's `disabled` prop handles the lock, matching the architecture decision (Decision 5).

## Files to modify/create

- `app/(tabs)/log.tsx` — modify existing file (two targeted changes only)

## Patterns to follow

- **`selectDayIndex` lock pattern**: See `app/(tabs)/log.tsx` function `selectDayIndex` at line 740–743. The day chip already uses `Alert.alert(t("log.lockedAlert"), t("log.lockedSwitchDay"))` when `activeWorkoutId` is truthy. The gym lock follows this same concept, but the Alert is surfaced inside `GymPickerModal` via its `disabled` prop rather than at the chip's `onPress` level.
- **`startWorkout()` INSERT pattern**: See the existing `startWorkout` function. The new `gym_id` column appends after `started_at` in both the column list and the values array.

## Verification

After implementation:
```
npx tsc --noEmit
```

Manually test:
1. **Gym written on start**: Select a gym in the chip row, start a workout, then inspect the `workouts` table (e.g., via a debug log or SQLite browser). Confirm `gym_id` matches the selected gym's ID.
2. **NULL when no gym**: Deselect gym (choose "No gym"), start a workout, confirm `workouts.gym_id` is `NULL`.
3. **Lock mid-session**: With an active workout, tap the gym chip. The `GymPickerModal` opens and immediately shows an Alert (from the `disabled` prop) without allowing a selection.
4. **Unlock after finish**: End or discard the workout. Tap the gym chip. The picker opens normally.

Then run `npm run verify` when you are done.

## Important constraints

- **Only two changes** in this task: the INSERT statement and the `disabled` prop. Do not refactor anything else.
- The `gym_id` column must be added at the **end** of both the column list and the values array in the INSERT — the column order does not matter in SQLite but it must be consistent between the two.
- `activeGymId ?? null` — use `?? null` to be safe; `activeGymId` from state is `string | null`, so this is redundant but explicit.
- The `GymPickerModal` component (Task 05) already handles showing the lock Alert internally when `disabled={true}`. Do not add a second Alert at the chip's `onPress` level.
- Do NOT modify `gymStore.ts`, `ExerciseCard.tsx`, `exerciseHistory.ts`, or any other file.
