# Gym Locations — Task Plan
**Date:** 2026-02-24
**Feature branch:** experiment/agent-pipeline-gym-locations
**Architecture:** docs/architecture/gym-locations-arch-2026-02-24.md
**DB design:** docs/architecture/gym-locations-db-2026-02-24.md

Total tasks: 12
Phases covered: 1–9 (Phase 1 split into 3 sub-tasks)

---

## Execution Order Overview

```
Task 01  (Phase 1a) — DB migration + types
Task 02  (Phase 1b) — gymStore.ts
Task 03  (Phase 1c) — i18n keys + backup.ts
Task 04  (Phase 2)  — Settings gym management UI
Task 05  (Phase 3a) — GymPickerModal component
Task 06  (Phase 3b) — Log chip wiring
Task 07  (Phase 4)  — Workout tagging (gym_id on startWorkout)
Task 08  (Phase 5)  — Two-pass weight pre-fill
        ---- parallel zone below ----
Task 09  (Phase 6)  — Gym-scoped history (exerciseHistory.ts + ExerciseCard)
Task 10  (Phase 7)  — Equipment filter in swap modal
Task 11  (Phase 8)  — Gym plates in PlateCalcModal
Task 12  (Phase 9)  — Home passive gym indicator
```

---

### Task 01: Database migration v22 + GymLocation TypeScript types
**Phase:** 1a
**Depends on:** nothing
**Files:**
- `src/db.ts` — append migration v22 block
- `src/components/workout/ExerciseCard.tsx` — extend `LastSetInfo` with `fromOtherGym?: boolean`

**Summary:** Add the `gym_locations` table and `workouts.gym_id` column via the existing migration runner in `src/db.ts`. The migration creates the table, adds the nullable `gym_id` column to `workouts` (wrapped in try/catch for idempotency), and adds `idx_workouts_gym`. Also extend the `LastSetInfo` type in `ExerciseCard.tsx` so the `fromOtherGym` flag is available for later tasks without touching component logic yet.

**Verification:**
- App boots without runtime error
- `npx expo start` and open app; no crash on launch
- Inspect SQLite with a DB browser (or add a console.log in migration `up`) to confirm `gym_locations` table exists and `workouts` has `gym_id` column after first run on a fresh install or after clearing app data

**Can parallel with:** none

---

### Task 02: src/gymStore.ts — full CRUD + active gym + helpers
**Phase:** 1b
**Depends on:** Task 01
**Files:**
- `src/gymStore.ts` — create new file

**Summary:** Create the `gymStore.ts` module with the `GymLocation` type and `CreateGymInput` / `UpdateGymInput` input types, all CRUD functions (`listGyms`, `getGym`, `createGym`, `updateGym`, `deleteGym`), active gym management (`getActiveGymId`, `setActiveGymId`, `getActiveGym`), and the equipment/plate helpers (`getGymEquipmentSet`, `isEquipmentAvailable`, `getGymPlates`). Follow the synchronous named-export pattern from `src/exerciseNotes.ts`. Use `uid("gym")` from `src/storage.ts` for IDs. `getGymPlates` returns `DEFAULT_PLATES_KG` from `plateCalculator.ts` when `availablePlates` is null — but `DEFAULT_PLATES_KG` does not yet exist as a named export, so this task must also export it from `src/plateCalculator.ts`.

**Verification:**
- TypeScript compiles (`npx tsc --noEmit`) with no errors in `gymStore.ts` or `plateCalculator.ts`
- Manually import `listGyms` in a scratch component or console; confirm it returns `[]` on a fresh DB

**Can parallel with:** none

---

### Task 03: i18n translation keys + backup.ts gym support
**Phase:** 1c
**Depends on:** Task 02
**Files:**
- `src/i18n/en/gym.ts` — create new file (5 gym-specific keys)
- `src/i18n/nb/gym.ts` — create new file (5 gym-specific keys, Norwegian)
- `src/i18n/en/settings.ts` — add ~16 gym management keys
- `src/i18n/nb/settings.ts` — add ~16 gym management keys (Norwegian)
- `src/i18n/index.ts` (or equivalent barrel) — register new `gym` namespace
- `src/backup.ts` — bump `CURRENT_SCHEMA_VERSION` 3 → 4, add `gym_locations` to export query, add `gym_id` to workouts SELECT, add `gym_locations` import loop, add `gym_id` to workouts INSERT

**Summary:** Add all translation strings needed for the gym feature in both `en` and `nb` locales, following the existing namespace file pattern. Also update `backup.ts` so that gym data round-trips correctly through JSON backup/restore — existing v3 backups import safely because `gym_locations` will be an empty array and `gym_id` will be null.

**Verification:**
- `npx tsc --noEmit` with no errors
- Export a backup from the app and confirm the JSON contains `"gym_locations": []` and `"schemaVersion": 4`
- Import that backup and confirm it completes without error

**Can parallel with:** none

---

### Task 04: Settings — Gym Locations management card + CRUD modal
**Phase:** 2
**Depends on:** Task 03
**Files:**
- `app/(tabs)/settings.tsx` — add gym state, `GymLocationsCard` component, full-screen gym management Modal with create/edit/delete, add gym_locations cleanup to `resetAllData()`

**Summary:** Add a `GymLocationsCard` between the WeightUnit and Default Day cards in Settings. Tapping "Manage Gyms" opens a full-screen Modal (following the `dataToolsOpen` pattern already present in settings). The modal lists existing gyms, allows creating a new gym (name + color), editing the name and color, deleting with an Alert confirmation, and reordering via sort_index. Wire `resetAllData()` to DELETE all rows from `gym_locations`. Load gym list via `listGyms()` from `src/gymStore.ts`.

**Verification:**
- Create a gym in Settings; it persists after closing and reopening Settings
- Edit and delete the gym; list updates correctly
- Reset all data; gym list becomes empty
- Feature does not appear broken when zero gyms exist (card still renders, list is empty)

**Can parallel with:** none

---

### Task 05: GymPickerModal component
**Phase:** 3a
**Depends on:** Task 03
**Files:**
- `src/components/modals/GymPickerModal.tsx` — create new file

**Summary:** Build the `GymPickerModal` component following the `DayPicker` inline modal pattern (transparent overlay, glass card). It accepts `visible`, `onClose`, `gyms`, `activeGymId`, `onSelect`, and `disabled` props. The list always shows a "No gym" option first, then each gym with its color dot. When `disabled` is true, tapping any item shows a lock Alert instead of calling `onSelect`. The component is purely presentational — it does not call gymStore directly.

**Verification:**
- `npx tsc --noEmit` passes
- Component renders in isolation (can be temporarily mounted in any screen for visual check)
- Tapping "No gym" calls `onSelect(null)`; tapping a gym calls `onSelect(gymId)`
- When `disabled=true`, an Alert appears instead of selecting

**Can parallel with:** Task 04 (both depend only on Task 03)

---

### Task 06: Log screen — gym chip in chip row
**Phase:** 3b
**Depends on:** Task 05
**Files:**
- `app/(tabs)/log.tsx` — import `gymStore` and `GymPickerModal`, add `activeGymId` / `gyms` / `gymPickerOpen` state, load gyms in `loadSession()`, add gym chip as leftmost chip in the chip row, render `GymPickerModal`, show gym name in the session card during an active workout

**Summary:** Wire the gym chip into the existing chip row in `log.tsx`. The chip only renders when `gyms.length > 0`. Tapping it opens `GymPickerModal`. The picker's `onSelect` calls `setActiveGymId` from gymStore and updates local state. The session card (shown when a workout is active) gains a muted gym name label below the duration. The gym lock logic (disabled prop) is wired here but the actual lock enforcement (mid-session) is handled in Task 07.

**Verification:**
- With zero gyms: chip is invisible, log screen is unchanged
- After creating a gym in Settings: chip appears with gym name
- Tapping chip opens GymPickerModal with correct gym list
- Selecting a gym updates the chip label immediately
- "No gym" option deselects active gym

**Can parallel with:** Task 04 (both depend only on Task 03; Task 06 also needs Task 05)

---

### Task 07: Workout tagging — gym_id written on startWorkout
**Phase:** 4
**Depends on:** Task 06
**Files:**
- `app/(tabs)/log.tsx` — add `gym_id` to the `startWorkout()` INSERT statement, set `disabled=true` on `GymPickerModal` when a workout is active, mirror the existing `selectDayIndex` Alert pattern for mid-session lock

**Summary:** When `startWorkout()` inserts a new row into `workouts`, it now also writes the current `activeGymId` (or NULL if none selected) to the `gym_id` column. The gym chip becomes locked mid-session — tapping it while a workout is active shows an Alert ("Cannot change gym during an active workout") matching the day-change lock pattern. The `GymPickerModal` receives `disabled={!!activeWorkoutId}`.

**Verification:**
- Start a workout with a gym selected; inspect DB and confirm `workouts.gym_id` is set
- Start a workout with no gym; confirm `gym_id` is NULL
- Try tapping the gym chip mid-session; Alert appears
- Complete or discard the workout; gym chip is unlocked again

**Can parallel with:** none

---

### Task 08: Two-pass weight pre-fill
**Phase:** 5
**Depends on:** Task 07
**Files:**
- `src/exerciseHistory.ts` — add optional `gymId?: string | null` parameter to `getRecentSessions()`; implement two-pass logic (pass 1: gym-scoped WHERE clause, pass 2: global fallback); set `fromOtherGym: true` on fallback results
- `app/(tabs)/log.tsx` — pass `activeGymId` to the `lastSets` useEffect dependency array, update the call site to `getRecentSessions()` to forward `activeGymId`, thread `gymId` and `gymEquipment` props to all `SingleExerciseCard` and `SupersetCard` renders
- `src/components/workout/ExerciseCard.tsx` — accept new `gymId` and `gymEquipment` props (types only for now; visual rendering of "from other gym" label uses the `fromOtherGym` flag already added in Task 01); render a muted "from other gym" hint when `lastSet.fromOtherGym === true`

**Summary:** Extend `getRecentSessions()` to optionally scope results to a specific gym, with a global fallback pass for exercises that have no gym-specific history. The fallback results are marked `fromOtherGym: true`. `ExerciseCard` displays a small muted label ("from other gym") beneath the pre-fill weight when the flag is set. The `lastSets` useEffect in `log.tsx` re-runs whenever `activeGymId` changes.

**Verification:**
- With no active gym: pre-fill behavior is identical to current (no regression)
- With a gym selected and gym-specific history: pre-fill shows gym-specific weight, no hint label
- With a gym selected but only global history: pre-fill shows global weight with "from other gym" hint
- Changing active gym immediately re-queries and updates pre-fill

**Can parallel with:** none

---

### Task 09: Gym-scoped history panel in ExerciseCard
**Phase:** 6
**Depends on:** Task 08
**Files:**
- `src/exerciseHistory.ts` — add `gymId` filter support to the inline history panel query (the `getRecentSessions` call used for the expand-history drawer inside ExerciseCard, distinct from the pre-fill query)
- `src/components/workout/ExerciseCard.tsx` — pass `gymId` through to the history panel `getRecentSessions` call; render equipment-availability opacity (0.4) for exercises whose equipment is not in `gymEquipment`; add "not at this gym" label at 0.4 opacity

**Summary:** The expandable history panel inside each ExerciseCard now respects the active gym — it shows gym-scoped sessions first, then global. Exercises whose required equipment is not in `gymEquipment` render at 0.4 opacity with a "not at this gym" muted label, while remaining fully tappable.

**Verification:**
- Open history panel for an exercise in a gym where you have logged it; shows gym-specific sessions
- Open history for an exercise never done at this gym; shows global sessions
- Exercise with equipment not in gym's equipment list renders at 0.4 opacity
- Exercise with no equipment restriction (or gym with null equipment) renders at full opacity

**Can parallel with:** Tasks 10, 11, 12 (all parallel after Task 08)

---

### Task 10: Equipment filter in ExerciseSwapModal
**Phase:** 7
**Depends on:** Task 08
**Files:**
- `app/(tabs)/log.tsx` — before passing `alternativeIds` to `ExerciseSwapModal`, filter the list using `isEquipmentAvailable()` from gymStore when a gym with non-null equipment is active; unavailable alternatives are either excluded or passed with an `unavailable` flag depending on ExerciseSwapModal's existing prop shape

**Summary:** Apply parent-side equipment filtering (Decision 7 from architecture) so that `ExerciseSwapModal` only receives alternatives whose equipment is available at the active gym. When no gym is active, or when the gym has `availableEquipment = null` (meaning all equipment), the full alternative list is passed unchanged. This is a targeted change to a single call site in `log.tsx` — `ExerciseSwapModal` itself is not modified.

**Verification:**
- With no active gym: swap modal shows full alternative list (no regression)
- With a gym that has a restricted equipment list: alternatives using unavailable equipment are absent from the swap list
- With a gym with `availableEquipment = null`: full list shown

**Can parallel with:** Tasks 09, 11, 12

---

### Task 11: Gym-specific plates in PlateCalcModal
**Phase:** 8
**Depends on:** Task 08
**Files:**
- `src/components/modals/PlateCalcModal.tsx` — add `gymId?: string | null` prop; in `loadData()`, call `getGymPlates(getActiveGym())` from gymStore and use the result as `availablePlates` argument to `calculatePlates()`
- `app/(tabs)/log.tsx` — pass `gymId={activeGymId}` to all `PlateCalcModal` renders

**Summary:** `PlateCalcModal` reads gym-specific plate inventory via `getGymPlates()` when a `gymId` is supplied, falling back to `DEFAULT_PLATES_KG` for gyms with no custom plates or when no gym is active. No change to `calculatePlates()` algorithm — it already accepts a `availablePlates` array.

**Verification:**
- Open plate calc with no gym: shows default plate set (no regression)
- Open plate calc with a gym that has custom plates: plate display reflects gym-specific set
- Open plate calc with a gym with null plates: shows default set

**Can parallel with:** Tasks 09, 10, 12

---

### Task 12: Home screen passive gym indicator
**Phase:** 9
**Depends on:** Task 03 (i18n keys) — does not require Task 08
**Files:**
- `app/(tabs)/index.tsx` — load active gym name via `getActiveGym()` from gymStore on `useFocusEffect`; render a muted gym name label inside the "Today's Workout" card when a gym is active

**Summary:** Add a passive gym indicator to the home screen's Today's Workout card. When an active gym is set, a small muted text line shows the gym name (e.g. "Trener1 Fagerholt") below the card's existing content. When no gym is active, or no gyms exist, nothing is rendered — the home screen is visually unchanged for existing users.

**Verification:**
- No gym active: home screen is visually identical to current (no regression)
- Set a gym active in the log tab or settings, navigate home: gym name appears as muted text
- Clear active gym: gym label disappears

**Can parallel with:** Tasks 09, 10, 11 (depends only on Task 03, can run after Task 08 is merged if that is the integration point, but logically independent)

---

## Parallelization Summary

| After Task | Can run in parallel |
|------------|---------------------|
| Task 03 done | Tasks 04 and 05 (and 06 after 05) |
| Task 08 done | Tasks 09, 10, 11, 12 |

Recommended sequential critical path:
01 -> 02 -> 03 -> 05 -> 06 -> 07 -> 08

Tasks 04 and 05 can be developed in parallel after Task 03.
Tasks 09, 10, 11, 12 can be developed in parallel after Task 08.

---

## File Change Index

| File | Tasks |
|------|-------|
| `src/db.ts` | 01 |
| `src/plateCalculator.ts` | 02 |
| `src/gymStore.ts` (NEW) | 02 |
| `src/i18n/en/gym.ts` (NEW) | 03 |
| `src/i18n/nb/gym.ts` (NEW) | 03 |
| `src/i18n/en/settings.ts` | 03 |
| `src/i18n/nb/settings.ts` | 03 |
| `src/i18n/index.ts` | 03 |
| `src/backup.ts` | 03 |
| `app/(tabs)/settings.tsx` | 04 |
| `src/components/modals/GymPickerModal.tsx` (NEW) | 05 |
| `app/(tabs)/log.tsx` | 06, 07, 08, 10, 11 |
| `src/exerciseHistory.ts` | 08, 09 |
| `src/components/workout/ExerciseCard.tsx` | 01, 08, 09 |
| `src/components/modals/PlateCalcModal.tsx` | 11 |
| `app/(tabs)/index.tsx` | 12 |
