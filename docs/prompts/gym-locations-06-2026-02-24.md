# Task 06: Log screen — gym chip in chip row — Prompt 6 av 12

## Kontekst fra teamet:
- @architect: Phase 3b — wire `GymPickerModal` into `log.tsx`; chip only visible when `gyms.length > 0`; picker's `onSelect` calls `setActiveGymId` from gymStore; session card gains muted gym name label
- @db-designer: Active gym stored in settings key `"activeGymId"` via `getSettingAsync`/`setSettingAsync`; `GymLocation` rows from `gym_locations` table
- @codebase-scanner: Chip row at `app/(tabs)/log.tsx` lines 1178–1189; `selectDayIndex` Alert lock pattern at line 741; session card at lines 1206–1244; `loadSession()` callback at line 233

---

# Task 06: Log screen — gym chip wiring

## Context

This is part of the Gym Locations feature (branch `experiment/agent-pipeline-gym-locations`).

The following tasks are already complete:
- **Task 01**: DB migration v22 — `gym_locations` table and `workouts.gym_id` column exist.
- **Task 02**: `src/gymStore.ts` exists with `listGyms()`, `getActiveGymId()`, `setActiveGymId()`, `getActiveGym()`, and the full `GymLocation` type.
- **Task 03**: i18n keys for the gym feature are in both `en` and `nb` locales.
- **Task 04**: Settings screen has gym management UI (may be running in parallel).
- **Task 05**: `src/components/modals/GymPickerModal.tsx` exists with the `GymPickerModalProps` interface and the presentational component.

**Task 06** wires the gym chip into the existing chip row in `app/(tabs)/log.tsx`. The gym picker lock (mid-session) is **not** enforced here — it is handled in Task 07. For now, pass `disabled={false}` to `GymPickerModal`.

## What to do

Modify `app/(tabs)/log.tsx` with the following targeted changes:

### 1. Add imports (near the top of the file, alongside existing imports)

```typescript
import { listGyms, getActiveGymId, setActiveGymId as setActiveGymIdStore, getActiveGym } from "../../src/gymStore";
import type { GymLocation } from "../../src/gymStore";
import GymPickerModal from "../../src/components/modals/GymPickerModal";
```

Note the `as setActiveGymIdStore` alias — this avoids collision with local state setters.

### 2. Add state variables

Add these three state variables alongside the existing `dayPickerOpen` and other states (around line 135):

```typescript
const [activeGymId, setActiveGymId] = useState<string | null>(null);
const [gyms, setGyms] = useState<GymLocation[]>([]);
const [gymPickerOpen, setGymPickerOpen] = useState(false);
```

### 3. Load gyms inside `loadSession()`

Inside the `loadSession` callback (after the existing `setSupersetAlternate` and `setShowOnboarding` calls, and before the active workout lookup), add:

```typescript
// Load gym data
const gymList = listGyms();
const savedGymId = await getActiveGymId();
setGyms(gymList);
setActiveGymId(savedGymId);
```

`listGyms()` is synchronous (returns directly from SQLite). `getActiveGymId()` reads the `settings` table and is also synchronous per the gymStore API — call it as synchronous: `const savedGymId = getActiveGymId();` (not awaited). The i18n key for the settings key is `"activeGymId"`.

### 4. Add gym chip to the chip row

The existing chip row is at lines 1178–1189:
```tsx
<View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
  <Chip text={programMode === "back" ? t("log.backFriendly") : t("log.standard")} />
  <Chip text={t("log.dayChip", { n: activeDayIndex + 1 })} active onPress={...} />
  <Chip text={activeWorkoutId ? t("log.activeWorkout") : t("log.noWorkout")} />
</View>
```

Add the gym chip as the **leftmost** element (before the program mode chip), but only when `gyms.length > 0`:

```tsx
{gyms.length > 0 ? (
  <Chip
    text={activeGymId ? (gyms.find((g) => g.id === activeGymId)?.name ?? t("gym.unknownGym")) : t("gym.noGym")}
    active={!!activeGymId}
    onPress={() => setGymPickerOpen(true)}
  />
) : null}
```

The i18n keys `t("gym.noGym")` and `t("gym.unknownGym")` must already exist from Task 03.

### 5. Add gym name label inside the session card

The session card is at lines 1206–1244. Inside the `Card` for the session, after the duration display block (the `View` containing duration label and elapsed time), add a muted gym name line that only appears when a workout is active AND a gym is selected:

```tsx
{activeWorkoutId && activeGymId ? (
  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
    {gyms.find((g) => g.id === activeGymId)?.name ?? ""}
  </Text>
) : null}
```

Place this immediately after the duration `View` block, before the button row (`marginTop: 12` View).

### 6. Render GymPickerModal

Add the `GymPickerModal` render alongside the other modals (after the Day Picker Modal, before the Edit Set Modal):

```tsx
<GymPickerModal
  visible={gymPickerOpen}
  onClose={() => setGymPickerOpen(false)}
  gyms={gyms}
  activeGymId={activeGymId}
  onSelect={(gymId) => {
    setActiveGymIdStore(gymId);
    setActiveGymId(gymId);
    setGymPickerOpen(false);
  }}
  disabled={false}
/>
```

## Files to modify/create

- `app/(tabs)/log.tsx` — modify existing file

## Patterns to follow

- **Chip row pattern**: See existing chip row in `app/(tabs)/log.tsx` lines 1178–1189. The new chip goes before all existing chips.
- **Modal rendering pattern**: See how `ExerciseSwapModal`, `PlateCalcModal`, and the Day Picker Modal are rendered at the bottom of the JSX return in `log.tsx`. Add `GymPickerModal` in the same area.
- **Session card structure**: See lines 1206–1244 in `log.tsx` for where to place the gym name label.
- **Lock Alert pattern for future reference**: See `selectDayIndex` function at line 740–743 — Task 07 will extend this same pattern for the gym chip.

## Verification

After implementation:
```
npx tsc --noEmit
```

Manually test:
- With zero gyms in Settings: chip row is unchanged (gym chip invisible)
- After creating one gym in Settings, return to Log tab: gym chip appears with the gym name or "No gym"
- Tapping chip opens `GymPickerModal` with correct gym list
- Selecting a gym updates the chip label immediately
- Selecting "No gym" deselects and shows the default label
- Session card shows gym name when a workout is active and a gym is selected

Then run `npm run verify` when you are done.

## Important constraints

- **Do not enforce mid-session lock in this task.** Pass `disabled={false}` unconditionally. Task 07 handles that.
- `setActiveGymIdStore` (the gymStore function) persists the gym choice to the `settings` table. The local React `setActiveGymId` updates UI state. Both must be called in `onSelect`.
- `listGyms()` is synchronous — do not add `await` before it.
- `getActiveGymId()` is synchronous — do not add `await` before it.
- The gym chip must be the **leftmost** chip (index 0) in the row when visible.
- Do NOT modify `ExerciseCard.tsx`, `exerciseHistory.ts`, or `PlateCalcModal.tsx` in this task.
- Do NOT remove or reorder any existing chips.
