# Task 05: GymPickerModal component — Prompt 5 av 12

## Kontekst fra teamet:
- @architect: Phase 3a — purely presentational modal, follows DayPicker inline modal pattern (transparent overlay, glass card)
- @db-designer: `GymLocation` type lives in `src/gymStore.ts` (created in Task 02)
- @codebase-scanner: Modal glass card pattern used in log.tsx Day Picker modal at line 1360; `Chip` component from `src/ui/index.tsx` line 209; theme tokens from `src/theme.ts`

---

# Task 05: GymPickerModal component

## Context

This is part of the Gym Locations feature (branch `experiment/agent-pipeline-gym-locations`).

The following tasks are already complete:
- **Task 01**: DB migration v22 — `gym_locations` table and `workouts.gym_id` column exist. `LastSetInfo` in `ExerciseCard.tsx` has `fromOtherGym?: boolean`.
- **Task 02**: `src/gymStore.ts` exists with full CRUD + active gym helpers + `GymLocation` type.
- **Task 03**: i18n keys for the gym feature exist in `src/i18n/en/gym.ts`, `src/i18n/nb/gym.ts`, `src/i18n/en/settings.ts`, `src/i18n/nb/settings.ts`. Backup schema version is 4.
- **Task 04**: Settings screen has gym management UI (can run in parallel with Task 05).

**Task 05** creates the `GymPickerModal` component, which is a purely presentational modal — it does not call `gymStore` directly.

## What to do

Create the file `src/components/modals/GymPickerModal.tsx`.

The modal must follow the exact same pattern as the **Day Picker modal** in `app/(tabs)/log.tsx` (lines 1360–1380): transparent overlay via `Modal` with `animationType="fade"`, a glass card (`backgroundColor: theme.modalGlass`, `borderColor: theme.glassBorder`, `borderWidth: 1`, `borderRadius: theme.radius.xl`), and a backdrop `Pressable` that closes on tap.

### Props interface

```typescript
export type GymPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  gyms: GymLocation[];
  activeGymId: string | null;
  onSelect: (gymId: string | null) => void;
  disabled?: boolean;
};
```

### Behaviour

1. **"No gym" option**: Always rendered first in the list. Calls `onSelect(null)` when tapped. Active state (highlighted with `theme.accent` border + background) when `activeGymId` is `null`.

2. **Gym list**: Each gym is rendered as a pressable row with:
   - A filled circular color dot (diameter 10, `backgroundColor: gym.color ?? theme.muted`) on the left
   - The gym name in `theme.text` / `theme.fontFamily.medium`
   - Active state when `gym.id === activeGymId` (same accent highlight as the "No gym" option)
   - Calls `onSelect(gym.id)` when tapped

3. **Disabled lock**: When `disabled` is `true`, tapping any item (including "No gym") shows an `Alert` with the i18n key `t("gym.lockedMidSession")` as the message, instead of calling `onSelect`. Do **not** visually grey out the picker — keep all rows fully visible and tappable; just intercept the action.

4. **Close button**: A close `Btn` (or simple `Pressable`) at the bottom that calls `onClose`.

5. **Title**: Use the i18n key `t("gym.pickerTitle")` as the modal title.

### Active row styling

Use the same active chip pattern from `src/ui/index.tsx` (Chip component):
- `borderColor: theme.accent`
- `backgroundColor`: `theme.isDark ? "rgba(182, 104, 245, 0.18)" : "rgba(124, 58, 237, 0.12)"`
- Text color: `theme.accent`

For inactive rows:
- `borderColor: theme.glassBorder`
- `backgroundColor: theme.glass`
- Text color: `theme.text`

## Files to modify/create

- `src/components/modals/GymPickerModal.tsx` — **create new file**

## Patterns to follow

- **Modal glass card pattern**: See `app/(tabs)/log.tsx` lines 1360–1380 (Day Picker modal) for the exact overlay + glass card structure.
- **Chip active/inactive styling**: See `src/ui/index.tsx` `Chip` function (line 209) for color tokens.
- **Existing modals for structure reference**: See `src/components/modals/PlateCalcModal.tsx` for how modal files are organised (imports, prop types, default export).
- **i18n usage**: `const { t } = useI18n();` — import `useI18n` from `"../../i18n"`.
- **Theme usage**: `const theme = useTheme();` — import `useTheme` from `"../../theme"`.

## Verification

After implementation, run:
```
npx tsc --noEmit
```

Check:
- No TypeScript errors in `GymPickerModal.tsx`
- `GymLocation` type is imported from `"../../gymStore"` (not redefined)
- The `disabled` prop: when `true`, `Alert.alert(t("gym.lockedMidSession"))` fires on any row tap; `onSelect` is never called
- Tapping "No gym" calls `onSelect(null)`
- Tapping a gym calls `onSelect(gym.id)`

Then run `npm run verify` when you are done.

## Important constraints

- **Purely presentational**: This component must NOT import or call `gymStore` functions (`getActiveGymId`, `setActiveGymId`, etc.). All state is passed in via props.
- The component renders nothing when `gyms.length === 0` is not the caller's concern — the component should render normally; the caller in `log.tsx` controls whether to show the chip and open the picker.
- Use `import { GymLocation } from "../../gymStore"` for the type — do not copy-paste the type definition.
- Use `import { Alert } from "react-native"` for the lock alert.
- Keep the modal list non-scrollable (simple `View` with `gap`) unless there are more than 8 gyms — do not add ScrollView for the base case.
- Do NOT use emoji characters anywhere in this file.
