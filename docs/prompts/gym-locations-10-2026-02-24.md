# Task 10: Equipment Filter in ExerciseSwapModal

## Context from the team:
- Tasks 01-08 are complete. That means: `src/gymStore.ts` exists with `isEquipmentAvailable(equipment, gym)` and `getActiveGym()` exported. The log screen (`app/(tabs)/log.tsx`) has `activeGymId` state, loads gyms in `loadSession()`, and passes the active gym through. The `ExerciseSwapModal` at `src/components/modals/ExerciseSwapModal.tsx` receives `alternativeIds: string[]` from `log.tsx` — that array is built at its call site (line ~1350):
  ```
  alternativeIds={altPickerBase ? [altPickerBase, ...(alternatives[activeDayIndex]?.[altPickerBase] ?? [])] : []}
  ```
- This task (10) can run in parallel with Tasks 09, 11, and 12 — all are independent once Task 08 is merged.

---

## What to do

Apply parent-side equipment filtering in `app/(tabs)/log.tsx` so that `ExerciseSwapModal` only receives alternatives whose equipment is available at the active gym. **Do not modify `ExerciseSwapModal.tsx`** — this is a single-call-site change in `log.tsx`.

### Step 1 — Import helpers from gymStore

`log.tsx` already imports from `src/gymStore` as part of Task 06/07 work. Ensure these are imported (add if not already present):

```typescript
import { getActiveGym, getGymEquipmentSet, isEquipmentAvailable } from "../../src/gymStore";
```

Also ensure `getExercise` is already imported from `exerciseLibrary` — it is, at line ~29.

### Step 2 — Build the filtered `alternativeIds` at the `ExerciseSwapModal` call site

Find the `ExerciseSwapModal` render block (around line 1346-1358 of the current file). The current `alternativeIds` prop is:

```typescript
alternativeIds={altPickerBase ? [altPickerBase, ...(alternatives[activeDayIndex]?.[altPickerBase] ?? [])] : []}
```

Replace this with a filtered version. Extract the logic into a local constant computed inline or just inline it directly:

```typescript
alternativeIds={(() => {
  if (!altPickerBase) return [];
  const fullList = [altPickerBase, ...(alternatives[activeDayIndex]?.[altPickerBase] ?? [])];
  const activeGym = getActiveGym();
  // If no gym active, or gym has null equipment (all equipment available), return full list
  const gymEquipment = activeGym ? getGymEquipmentSet(activeGym) : null;
  if (!gymEquipment) return fullList;
  // Filter: always include the base exercise regardless; filter alternatives by equipment
  return fullList.filter((exId) => {
    const eq = getExercise(exId)?.equipment;
    // Exercises with no equipment tag pass through unconditionally
    if (!eq) return true;
    return isEquipmentAvailable(eq, activeGym);
  });
})()}
```

This approach:
- Keeps the base exercise (`altPickerBase`) in the list always, since the current exercise is already in use.
- Filters out alternatives whose equipment type is not in the gym's `availableEquipment` set.
- Falls back to the full list when no gym is active or when the gym has `availableEquipment = null`.

### Step 3 — Verify `isEquipmentAvailable` signature

`isEquipmentAvailable` in `src/gymStore.ts` was defined in Task 02 as:

```typescript
export function isEquipmentAvailable(equipment: Equipment, gym: GymLocation | null): boolean
```

It returns `true` when `gym` is null (no restriction) or when `gym.availableEquipment` is null (all equipment). It returns `true` when `equipment` is in `gym.availableEquipment`. Confirm this behavior by reading `src/gymStore.ts` before implementing if uncertain.

## Files to modify

- `app/(tabs)/log.tsx` — filter `alternativeIds` at the `ExerciseSwapModal` call site only

## Patterns to follow

- Architecture Decision 7 explicitly mandates parent-side filtering. `ExerciseSwapModal` is not touched.
- The inline IIFE pattern `{(() => { ... })()}` is already used elsewhere in the codebase for conditional JSX (e.g. in `ExerciseCard.tsx` for the equipment label and `BackImpactDot` row around line 254). This is acceptable, but a local `const filteredAlts = ...` computed above the return statement is cleaner if you prefer. Either is fine.
- `getExercise(exId)?.equipment` is the same pattern used in `ExerciseCard.tsx` at line 254 and in `ExerciseSwapModal.tsx` at line 129.

## Verification

After implementation, run `npx tsc --noEmit` to confirm no TypeScript errors.

Manual checks:
- **No gym active**: open the swap modal for any exercise — the full alternative list appears, identical to the current behavior. No regression.
- **Gym with `availableEquipment = null`**: full list shown. No filtering occurs.
- **Gym with restricted equipment** (e.g. only `["dumbbell", "cable"]`): open swap modal for a barbell exercise. Alternatives requiring "barbell" or "machine" are absent. Alternatives requiring "dumbbell" or "cable" appear. The base exercise itself always appears regardless of its equipment.
- **Exercise with no equipment tag**: always appears in the list regardless of gym restrictions (no equipment = unrestricted).
- Selecting an alternative from the filtered list still calls `chooseAlternative` correctly.

## Important constraints

- Do NOT modify `src/components/modals/ExerciseSwapModal.tsx`. The component is unchanged.
- The base exercise (`altPickerBase`) must always be included in the filtered list. Even if a gym does not have the base exercise's equipment, the user may already be mid-exercise and needs to revert to it or see it in the list.
- `getActiveGym()` calls `getGymId()` internally (synchronous, reads from in-memory state set by `setActiveGymId`). This is a synchronous call — do not `await` it.
- Do not add `filteredAlts` as a separate piece of React state. Compute it inline at the call site to keep the change minimal and avoid introducing a stale-state bug.
- If `alternatives[activeDayIndex]?.[altPickerBase]` is undefined (no alternatives exist for the exercise), the list is just `[altPickerBase]` — the base only. The filter still runs but returns `[altPickerBase]` because the base is always included. This is correct.

Run `npm run verify` when done.
