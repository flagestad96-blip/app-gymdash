# Task 11: Gym-Specific Plates in PlateCalcModal

## Context from the team:
- Tasks 01-08 are complete. That means: `src/gymStore.ts` exports `getActiveGym()` and `getGymPlates(gym: GymLocation | null): number[]`. `src/plateCalculator.ts` already exports `DEFAULT_PLATES_KG` as a named export (this was added in Task 02). The `calculatePlates` function at `src/plateCalculator.ts` already accepts an optional third argument `availablePlates: number[] = DEFAULT_PLATES_KG`. The `PlateCalcModal` is rendered in `app/(tabs)/log.tsx` at line ~1411. `activeGymId` state is available in `log.tsx`.
- This task (11) can run in parallel with Tasks 09, 10, and 12 — all are independent once Task 08 is merged.

---

## What to do

### Step 1 — Extend `PlateCalcModalProps` in `src/components/modals/PlateCalcModal.tsx`

Add an optional `gymId` prop to the props type:

```typescript
export type PlateCalcModalProps = {
  visible: boolean;
  onClose: () => void;
  /** The current weight string from the input field (in display units) */
  weightStr: string;
  /** Exercise ID — used to remember bar preference per exercise */
  exerciseId?: string | null;
  /** Active gym ID — used to resolve gym-specific plate set */
  gymId?: string | null;
};
```

Update the function signature to destructure it:

```typescript
export default function PlateCalcModal({ visible, onClose, weightStr, exerciseId, gymId }: PlateCalcModalProps) {
```

### Step 2 — Update `loadData` in `PlateCalcModal.tsx`

`loadData` is a `useCallback` defined around line 36. Currently it loads custom bars and exercise preferences. Add gym plate resolution after those loads.

Import `getActiveGym` and `getGymPlates` from gymStore:

```typescript
import { getActiveGym, getGymPlates } from "../../gymStore";
```

Add a state variable for the resolved plate set:

```typescript
const [gymPlates, setGymPlates] = useState<number[] | null>(null);
```

Inside `loadData`, after the `Promise.all`, resolve the gym plates:

```typescript
const loadData = useCallback(async () => {
  const [custom, prefs] = await Promise.all([loadCustomBars(), loadExerciseBarPrefs()]);
  const merged = [...BUILT_IN_BARS, ...custom];
  setAllBars(merged);
  setExercisePrefs(prefs);

  // Resolve bar preference
  const prefBarId = exerciseId ? prefs[exerciseId] : null;
  if (prefBarId && merged.some((b) => b.id === prefBarId)) {
    setSelectedBarId(prefBarId);
  } else if (!merged.some((b) => b.id === selectedBarId)) {
    setSelectedBarId("olympic");
  }

  // Resolve gym-specific plates
  const activeGym = gymId ? getActiveGym() : null;
  setGymPlates(getGymPlates(activeGym));
}, [exerciseId, gymId]);
```

`getGymPlates` returns `DEFAULT_PLATES_KG` when `activeGym` is null or when `activeGym.availablePlates` is null. So `gymPlates` will always be a valid `number[]` after this call.

### Step 3 — Pass `gymPlates` to `calculatePlates`

Currently around line 116:

```typescript
const result = calculatePlates(targetKg, barKg);
```

Change to:

```typescript
const result = calculatePlates(targetKg, barKg, gymPlates ?? undefined);
```

`gymPlates ?? undefined` ensures the default parameter in `calculatePlates` kicks in if somehow `gymPlates` is null (defensive). In practice `getGymPlates` always returns a non-null array.

### Step 4 — Pass `gymId` from `app/(tabs)/log.tsx`

Find the `PlateCalcModal` render block (around line 1411-1416):

```typescript
<PlateCalcModal
  visible={plateCalcExId !== null}
  onClose={() => setPlateCalcExId(null)}
  weightStr={plateCalcExId ? (inputs[plateCalcExId]?.weight ?? "") : ""}
  exerciseId={plateCalcExId}
/>
```

Add the `gymId` prop:

```typescript
<PlateCalcModal
  visible={plateCalcExId !== null}
  onClose={() => setPlateCalcExId(null)}
  weightStr={plateCalcExId ? (inputs[plateCalcExId]?.weight ?? "") : ""}
  exerciseId={plateCalcExId}
  gymId={activeGymId}
/>
```

`activeGymId` is already in state in `log.tsx` from Task 06.

## Files to modify

- `src/components/modals/PlateCalcModal.tsx` — add `gymId` prop, import gym helpers, add `gymPlates` state, update `loadData`, pass `gymPlates` to `calculatePlates`
- `app/(tabs)/log.tsx` — add `gymId={activeGymId}` to the `PlateCalcModal` render

## Patterns to follow

- `loadData` already uses `useCallback` with `[exerciseId]` in its dependency array (line ~49). Add `gymId` to the dependency array so it reloads when the active gym changes: `}, [exerciseId, gymId])`.
- `DEFAULT_PLATES_KG` is a `const` defined at line 76 of `src/plateCalculator.ts` — it was made a named export in Task 02. If for some reason it is not yet exported, add `export` to that line.
- `getGymPlates` falls back to `DEFAULT_PLATES_KG` when `gym.availablePlates` is null, as specified in Task 02's summary. Do not add any additional fallback logic in `PlateCalcModal`.
- The `gymPlates` state initial value can be `null` — `calculatePlates` will receive `undefined` and use its own default until `loadData` completes (which happens before the user sees the modal content, because `loadData` fires inside `useEffect` on `visible` becoming true).

## Verification

After implementation, run `npx tsc --noEmit` to confirm no TypeScript errors.

Manual checks:
- **No gym active** (`activeGymId` is null): open the plate calculator on any barbell exercise. The plate breakdown is identical to the current behavior (default plate set: 25, 20, 15, 10, 5, 2.5, 1.25 kg). No regression.
- **Gym with `availablePlates = null`**: same as above — shows default plate set.
- **Gym with custom plates** (e.g. `[20, 10, 5, 2.5]`): open the plate calculator. The breakdown uses only those plate sizes. A 100 kg target with a 20 kg bar and only `[20, 10, 5, 2.5]` available should show 2x20 + 2x10 per side (= 100 kg total).
- The bar selection and custom bar management UI is unchanged.
- The `achievable` flag in `PlateResult` correctly reflects whether the target weight is achievable with the gym's plate set (it may be false if the gym has a limited plate set).

## Important constraints

- Do NOT change `calculatePlates` in `src/plateCalculator.ts`. The algorithm already accepts `availablePlates` as a third argument — this task only passes the correct value from the modal.
- Do NOT call `getActiveGymId()` from `gymStore` to then look up the gym separately. Call `getActiveGym()` directly — it returns the full `GymLocation | null` which is what `getGymPlates` expects.
- `gymId` prop on `PlateCalcModal` is used only to determine when to re-run `loadData` via the `useCallback` dependency. The actual gym lookup inside `loadData` uses `getActiveGym()` (synchronous, reads in-memory state) rather than a DB query — this is intentional and consistent with how gymStore is designed (Decision 4 in architecture: named exports, synchronous).
- The `gymPlates` state is local to `PlateCalcModal` and reset on every `visible = true` cycle via `loadData`. Do not persist it.

Run `npm run verify` when done.
