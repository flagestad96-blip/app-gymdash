# Task 09: Gym-Scoped History Panel in ExerciseCard

## Context from the team:
- Tasks 01-08 are complete. That means: `gym_locations` table exists (migration v22), `src/gymStore.ts` is in place with all CRUD + helpers, i18n keys for gym are registered, `GymPickerModal` is wired into the log chip row, workouts are tagged with `gym_id` on start, and `getRecentSessions()` in `src/exerciseHistory.ts` already accepts an optional `gymId` parameter with two-pass logic (pass 1: gym-scoped, pass 2: global fallback, marking fallback results with `fromOtherGym: true`). `ExerciseCard.tsx` already accepts `gymId` and `gymEquipment` props (types threaded in Task 08) and renders a muted "from other gym" hint under the pre-fill weight when `lastSet.fromOtherGym === true`.
- This task (09) can run in parallel with Tasks 10, 11, and 12 — all are independent once Task 08 is merged.

---

## What to do

Extend the expandable history panel inside `ExerciseHalf` (in `src/components/workout/ExerciseCard.tsx`) to:

1. Pass `gymId` to the `getRecentSessions` call inside `toggleHistory` so the panel shows gym-scoped sessions.
2. Render exercises whose required equipment is not in `gymEquipment` at 0.4 opacity with a muted "not at this gym" label.

### Step 1 — `src/exerciseHistory.ts`

The two-pass `getRecentSessions` signature added in Task 08 already handles `gymId`. Verify the signature is:

```typescript
export async function getRecentSessions(
  exerciseId: string,
  excludeWorkoutId: string | null,
  limit?: number,
  gymId?: string | null
): Promise<ExerciseSession[]>
```

If `gymId` is already there, no change needed in this file. If it is missing, add it now following the two-pass pattern described in Task 08 (pass 1 adds `AND w.gym_id = ?` to the workout query; exercises with no gym-specific rows fall back to the global query and mark `fromOtherGym: true` on `ExerciseSession` if you choose to extend the type, or simply return global results without the flag since the flag is only needed for pre-fill, not for the history panel display).

### Step 2 — `src/components/workout/ExerciseCard.tsx`

**2a. Thread `gymId` and `gymEquipment` into `ExerciseHalfProps`.**

`ExerciseHalfProps` currently does not include `gymId` or `gymEquipment`. Add them:

```typescript
type ExerciseHalfProps = {
  // ... existing props ...
  gymId?: string | null;
  gymEquipment?: Set<import("../../exerciseLibrary").Equipment> | null;
};
```

**2b. Pass them through in `ExerciseHalf`'s function signature** and update all call sites inside `SingleExerciseCard` and `SupersetCard` (the two `<ExerciseHalf ... />` blocks in `SingleExerciseCard` and the two in `SupersetCard`) to forward `gymId={props.gymId}` and `gymEquipment={props.gymEquipment}`.

**2c. Update the `toggleHistory` call inside `ExerciseHalf`** to pass `gymId`:

Current (line ~226):
```typescript
getRecentSessions(exId, workoutId).then(setHistorySessions);
```

Change to:
```typescript
getRecentSessions(exId, workoutId, 5, gymId).then(setHistorySessions);
```

**2d. Extend `SingleExerciseCardProps` and `SupersetCardProps`** to include `gymId` and `gymEquipment`:

```typescript
export type SingleExerciseCardProps = ExerciseCardCallbacks & {
  // ... existing ...
  gymId?: string | null;
  gymEquipment?: Set<import("../../exerciseLibrary").Equipment> | null;
};

export type SupersetCardProps = ExerciseCardCallbacks & {
  // ... existing ...
  gymId?: string | null;
  gymEquipment?: Set<import("../../exerciseLibrary").Equipment> | null;
};
```

**2e. Add equipment-availability opacity** to the outermost `Pressable` card wrapper in `SingleExerciseCard` and `SupersetCard`.

For `SingleExerciseCard`, compute availability before the return:

```typescript
const exEquipment = getExercise(props.exId)?.equipment as Equipment | undefined;
const equipmentUnavailable =
  props.gymEquipment != null &&
  exEquipment != null &&
  !props.gymEquipment.has(exEquipment);
```

Apply `opacity: equipmentUnavailable ? 0.4 : 1` to the outer `View` wrapper (the one with `onLayout`):

```typescript
<View onLayout={props.onLayout} style={{ position: "relative", opacity: equipmentUnavailable ? 0.4 : 1 }}>
```

For `SupersetCard`, check both `props.exIdA` and `props.exIdB` — render at 0.4 opacity if either exercise has unavailable equipment.

**2f. Add a "not at this gym" label** inside `ExerciseHalf`, shown only when `gymEquipment` is non-null and the exercise's equipment is not in the set. Place it immediately after the exercise name row (after the `{baseExId !== exId ? ... : null}` block at ~line 308):

```typescript
{(() => {
  if (!gymEquipment) return null;
  const eq = getExercise(exId)?.equipment as Equipment | undefined;
  if (!eq || gymEquipment.has(eq)) return null;
  return (
    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, opacity: 0.6 }}>
      {t("gym.notAtThisGym")}
    </Text>
  );
})()}
```

The i18n key `gym.notAtThisGym` was added in Task 03 in `src/i18n/en/gym.ts` and `src/i18n/nb/gym.ts`.

## Files to modify

- `src/exerciseHistory.ts` — verify or add `gymId` parameter to `getRecentSessions`
- `src/components/workout/ExerciseCard.tsx` — thread `gymId`/`gymEquipment` into `ExerciseHalfProps`, `SingleExerciseCardProps`, `SupersetCardProps`; update `toggleHistory`; add opacity + label

## Patterns to follow

- The `getRecentSessions` two-pass pattern is already established in Task 08; this task only passes `gymId` to the same function at the history panel call site.
- The `fromOtherGym` hint rendering (added in Task 08 in the `lastSet` row) is the model for how the "not at this gym" label should look — muted, mono, small font, low opacity.
- Opacity 0.4 is specified in the architecture doc for unavailable equipment items; match the existing pattern where `lightbulb` icon uses `opacity: exerciseNote ? 1 : 0.4` (line ~267 in ExerciseCard).
- Do not disable tapping on unavailable exercises — they remain fully pressable; only the visual opacity changes.

## Verification

After implementation, run `npx tsc --noEmit` to confirm no TypeScript errors.

Manual checks:
- Select a gym that has a restricted equipment list (e.g. only "dumbbell"). An exercise requiring "barbell" should render at 0.4 opacity with "not at this gym" text.
- Exercise requiring "dumbbell" at a gym that includes "dumbbell" renders at full opacity with no label.
- With no gym active (`gymEquipment` is null/undefined): all exercises render at full opacity, no label shown.
- Open the history panel for an exercise done previously at the active gym: sessions from that gym appear first.
- Open the history panel for an exercise never done at this gym but done elsewhere: global sessions appear (no crash, no empty state when records exist).
- Changing active gym re-fires the `lastSets` effect in `log.tsx` (from Task 08); the history panel clears and reloads on next expand.

## Important constraints

- Do NOT modify `ExerciseCardCallbacks` — the callbacks object does not carry `gymId`. The props are passed directly on `SingleExerciseCardProps` and `SupersetCardProps`, not through the shared callbacks type.
- Do NOT make the opacity conditional on `gymEquipment` being an empty set. An empty set (`size === 0`) means zero equipment available; that is a valid state. Only skip the opacity when `gymEquipment` is `null` or `undefined` (meaning the gym has no restriction or no gym is active).
- The `gymEquipment` prop type is `Set<Equipment> | null | undefined` — a null value means "all equipment available" per Decision 1 in the architecture (`availableEquipment: null` on `gym_locations` means unrestricted).
- Do not import `gymStore` directly into `ExerciseCard`. The `gymEquipment` set is already resolved in `log.tsx` via `getGymEquipmentSet()` and threaded down as a prop.
- The history panel's `historySessions` state is per-component. After `gymId` changes in the parent, the panel's cached `historySessions` becomes stale. This is acceptable — the user simply closes and reopens the panel to see fresh data. Do not add a `useEffect` to clear `historySessions` on `gymId` changes inside `ExerciseHalf`; that would complicate the component and the architecture doc does not require it.

Run `npm run verify` when done.
