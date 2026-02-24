# Task 08: Two-pass weight pre-fill — Prompt 8 av 12

## Kontekst fra teamet:
- @architect: Phase 5 — Decision 8: two-pass query (not SQL COALESCE); pass 1 gym-scoped, pass 2 global fallback; fallback rows get `fromOtherGym: true`; `lastSets` useEffect re-runs when `activeGymId` changes
- @db-designer: `workouts.gym_id` indexed by `idx_workouts_gym`; NULL `gym_id` = legacy workout; pass 1 joins `workouts` on `gym_id = ?`; pass 2 is the existing global query for any exercise IDs not found in pass 1
- @codebase-scanner: `getRecentSessions()` in `src/exerciseHistory.ts`; `lastSets` useEffect in `app/(tabs)/log.tsx` lines 521–538; `LastSetInfo` type in `ExerciseCard.tsx` line 25 (already has `fromOtherGym?: boolean` from Task 01); `SingleExerciseCard` and `SupersetCard` render sites in `log.tsx` lines 1266–1338

---

# Task 08: Two-pass weight pre-fill

## Context

This is part of the Gym Locations feature (branch `experiment/agent-pipeline-gym-locations`).

The following tasks are already complete:
- **Task 01**: `LastSetInfo` in `src/components/workout/ExerciseCard.tsx` already has `fromOtherGym?: boolean` added.
- **Task 02**: `src/gymStore.ts` — `getActiveGym()`, `getGymEquipmentSet()`, `isEquipmentAvailable()` available.
- **Task 03**: i18n keys exist, including `t("gym.fromOtherGym")` for the hint label.
- **Task 06**: `app/(tabs)/log.tsx` has `activeGymId` state.
- **Task 07**: `app/(tabs)/log.tsx` — `startWorkout()` writes `gym_id` to the `workouts` table.

**Task 08** has three parts:
1. Extend `getRecentSessions()` in `src/exerciseHistory.ts` with optional `gymId` parameter and two-pass logic.
2. Update the `lastSets` useEffect in `app/(tabs)/log.tsx` to call the new signature and add `activeGymId` to its dependency array.
3. Update `ExerciseCard.tsx` to accept `gymId` and `gymEquipment` props and render a "from other gym" hint label.

## What to do

### Part A — `src/exerciseHistory.ts`

The current `getRecentSessions` signature is:
```typescript
export async function getRecentSessions(
  exerciseId: string,
  excludeWorkoutId: string | null,
  limit: number = 5
): Promise<ExerciseSession[]>
```

Add a fourth optional parameter `gymId` and implement two-pass logic:

```typescript
export async function getRecentSessions(
  exerciseId: string,
  excludeWorkoutId: string | null,
  limit: number = 5,
  gymId?: string | null
): Promise<ExerciseSession[]>
```

**Two-pass logic** (only active when `gymId` is a non-null, non-empty string):

**Pass 1 — gym-scoped query:**
Replace the existing `workoutRows` query with a gym-scoped version that adds `AND w.gym_id = ?` to the JOIN condition:

```sql
SELECT DISTINCT s.workout_id, w.date
FROM sets s JOIN workouts w ON s.workout_id = w.id
WHERE s.exercise_id = ?
  AND w.gym_id = ?
  [AND s.workout_id != ? -- if excludeWorkoutId is set]
ORDER BY w.date DESC
LIMIT ?
```

**Pass 2 — global fallback:**
If pass 1 returns sessions (gym-scoped history found), return those sessions immediately (no pass 2 needed for the pre-fill use case — this function is called per exercise).

If pass 1 returns zero sessions, fall back to the original global query (the existing implementation without `gym_id` filter). The returned sessions must have no extra fields — but the **caller** in `log.tsx` will mark them `fromOtherGym: true` after checking whether the result came from a fallback.

To enable the caller to detect which pass was used, add a boolean field to `ExerciseSession`:

```typescript
export type ExerciseSession = {
  workoutId: string;
  date: string;
  sets: { weight: number; reps: number; rpe?: number | null }[];
  exerciseOrder: number;
  fromOtherGym?: boolean;  // true when result is from global fallback while gymId was specified
};
```

Set `fromOtherGym: true` on all sessions returned from pass 2 when `gymId` was provided.

When `gymId` is null, undefined, or empty string, skip both passes and run only the original global query (existing behaviour, zero regression).

### Part B — `app/(tabs)/log.tsx` — lastSets useEffect

Find the `lastSets` useEffect (approximately lines 521–538):

```typescript
useEffect(() => {
  if (!ready || exerciseIds.length === 0) { setLastSets({}); return; }
  try {
    const placeholders = exerciseIds.map(() => "?").join(",");
    const rows = getDb().getAllSync<SetRow>(
      `SELECT workout_id, exercise_id, exercise_name, weight, reps, rpe, created_at
       FROM sets WHERE exercise_id IN (${placeholders}) ORDER BY created_at DESC`,
      [...exerciseIds]
    );
    const last: Record<string, LastSetInfo> = {};
    for (const r of rows ?? []) {
      const key = r.exercise_id ? String(r.exercise_id) : "";
      if (!key || last[key]) continue;
      last[key] = { weight: r.weight, reps: r.reps, rpe: r.rpe ?? null, created_at: r.created_at, workout_id: r.workout_id };
    }
    setLastSets(last);
  } catch { setLastSets({}); }
}, [ready, exerciseIdsKey, exerciseIds, program?.id]);
```

Replace this useEffect with a gym-aware two-pass implementation. The logic changes:

1. **When `activeGymId` is null or empty**: Run the existing global query, build `last` as before, set `fromOtherGym: false` (or omit the field). No behavior change.

2. **When `activeGymId` is set**:
   - **Pass 1**: Query the same sets table but `JOIN workouts w ON sets.workout_id = w.id AND w.gym_id = ?` with `activeGymId`. Collect the most-recent set per exercise that has gym-specific history.
   - **Pass 2**: For exercises in `exerciseIds` that are NOT yet in the `last` map after pass 1, run the global query restricted to those remaining exercise IDs. Mark those results `fromOtherGym: true`.
   - Merge both maps into `last` and call `setLastSets(last)`.

Add `activeGymId` to the dependency array:

```typescript
}, [ready, exerciseIdsKey, exerciseIds, program?.id, activeGymId]);
```

**SQL for pass 1 (gym-scoped):**
```sql
SELECT s.workout_id, s.exercise_id, s.weight, s.reps, s.rpe, s.created_at
FROM sets s
JOIN workouts w ON s.workout_id = w.id
WHERE s.exercise_id IN (${placeholders})
  AND w.gym_id = ?
ORDER BY s.created_at DESC
```
Parameters: `[...exerciseIds, activeGymId]`

**SQL for pass 2 (global fallback for remaining IDs):**
Same as the existing query but with `IN (${remainingPlaceholders})` for only the remaining exercise IDs.

### Part C — `src/components/workout/ExerciseCard.tsx`

#### 1. Extend `ExerciseHalfProps` and `ExerciseCardCallbacks`

Add to `ExerciseHalfProps`:
```typescript
gymId?: string | null;
gymEquipment?: Set<string> | null;
```

Add to `SingleExerciseCardProps` and `SupersetCardProps` (the public prop interfaces):
```typescript
gymId?: string | null;
gymEquipment?: Set<string> | null;
```

Thread these props through `SingleExerciseCard` -> `ExerciseHalf` and `SupersetCard` -> `ExerciseHalf` (both A and B halves).

#### 2. Render "from other gym" hint

In `ExerciseHalf`, find the `lastSet` display block (the section that shows `t("log.lastSet", ...)`). Immediately after the last set text line, add a muted hint when `lastSet.fromOtherGym === true`:

```tsx
{lastSet?.fromOtherGym ? (
  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, opacity: 0.7 }}>
    {t("gym.fromOtherGym")}
  </Text>
) : null}
```

Place this inside the `lastSet ? (...)` block, right after the existing `View` that contains the last set text and the "show history" pressable.

#### 3. Update `log.tsx` call sites

In `app/(tabs)/log.tsx`, pass `gymId` and `gymEquipment` to all `SingleExerciseCard` and `SupersetCard` renders.

For `SingleExerciseCard` (around line 1270):
```tsx
gymId={activeGymId}
gymEquipment={null}  // Task 09 will wire equipment; use null for now
```

For `SupersetCard` (around line 1301):
```tsx
gymId={activeGymId}
gymEquipment={null}  // Task 09 will wire equipment; use null for now
```

These props are optional (`?`) so passing `null` is safe and creates no TypeScript errors.

## Files to modify/create

- `src/exerciseHistory.ts` — extend `ExerciseSession` type and `getRecentSessions()` with two-pass logic
- `app/(tabs)/log.tsx` — replace `lastSets` useEffect with two-pass version; add `activeGymId` to dep array; pass `gymId`/`gymEquipment` to exercise card renders
- `src/components/workout/ExerciseCard.tsx` — add `gymId`/`gymEquipment` props; render "from other gym" hint

## Patterns to follow

- **Two-pass query concept**: Architecture doc Section 7 ("Gym-Scoped Weight Pre-fill" data flow diagram). Pass 1 gym-scoped, pass 2 global fallback for missing IDs only.
- **Existing lastSets useEffect**: `app/(tabs)/log.tsx` lines 521–538 — this is the block being replaced.
- **LastSetInfo type**: `src/components/workout/ExerciseCard.tsx` line 25 — `fromOtherGym?: boolean` already exists from Task 01.
- **ExerciseSession type extension**: `src/exerciseHistory.ts` line 4 — add `fromOtherGym?: boolean` field.
- **Muted hint text style**: See the `coachHint` render in `ExerciseHalf` (around line 369 in ExerciseCard.tsx): `color: theme.muted, fontFamily: theme.mono, fontSize: 10`.

## Verification

After implementation:
```
npx tsc --noEmit
```

Manually test:
1. **No active gym**: Pre-fill behavior is identical to before this task (no regression). No "from other gym" label appears.
2. **Active gym with gym-specific history**: Log a set at Gym A, then switch to Gym A and open the log. Pre-fill shows the gym-specific weight. No "from other gym" label.
3. **Active gym with only global history**: Set a gym, but have no sets logged at that gym for an exercise. Pre-fill shows the global weight. The "from other gym" hint text appears below the last set line.
4. **Changing active gym**: Switch between gyms; the `lastSets` useEffect re-runs and pre-fill weights update immediately.

Then run `npm run verify` when you are done.

## Important constraints

- **`getRecentSessions()` signature is additive**: The new `gymId` parameter is the fourth parameter and is optional with a default of `undefined`. All existing call sites in `ExerciseCard.tsx` (the history panel toggle) pass only 2 arguments and remain unaffected.
- **Two-pass is in the `lastSets` useEffect, not only in `getRecentSessions()`**: The useEffect handles the per-batch two-pass; `getRecentSessions()` also gets two-pass logic for its own use (the history panel in Task 09 will use it), but that is separate.
- **`gymEquipment` is `null` in this task**: Task 09 will wire equipment filtering. Pass `null` as a placeholder at all call sites.
- **Do not break the existing history panel**: `ExerciseHalf.toggleHistory` calls `getRecentSessions(exId, workoutId)` with only 2 arguments. This must continue to work as before (global history, no gym scope). Task 09 extends this.
- **`fromOtherGym` on `LastSetInfo` vs `ExerciseSession`**: Both types need the field. `LastSetInfo` already has it (Task 01). `ExerciseSession` needs it added now.
- The useEffect dependency array must include `activeGymId` — failure to do this means pre-fill does not update when the gym changes.
- Keep pass 2 SQL using the same `JOIN workouts` approach as the main query for consistency; do not use a subquery.
