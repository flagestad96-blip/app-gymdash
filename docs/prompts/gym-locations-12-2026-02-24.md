# Task 12: Home Screen Passive Gym Indicator

## Context from the team:
- Tasks 01-08 are complete. That means: `src/gymStore.ts` exports `getActiveGym(): GymLocation | null` (synchronous, reads from in-memory state that was set by `setActiveGymId`). The feature is invisible until the user creates at least one gym. The home screen (`app/(tabs)/index.tsx`) currently loads data inside a `useEffect` that calls `ensureDb()` on mount, and uses `useFocusEffect` is not yet present — data loads once on mount. The "Today's Workout" card is rendered around line 279-311 as a `<Card>` component.
- This task (12) can run in parallel with Tasks 09, 10, and 11 — it depends only on Task 03 (i18n keys) and the gymStore from Task 02, both of which are done.

---

## What to do

Add a passive gym indicator to the home screen's "Today's Workout" card. When an active gym is set, show a muted gym name line inside the card. When no gym is active, or no gyms exist, render nothing — the home screen is visually identical for existing users.

### Step 1 — Add `activeGymName` state to `HomeScreen`

After the existing state declarations (around line 68), add:

```typescript
const [activeGymName, setActiveGymName] = useState<string | null>(null);
```

### Step 2 — Load the active gym name

The home screen currently loads all its data in a single `useEffect` with `ensureDb().then(async () => { ... })` starting at line 71. At the end of that block (just before `if (alive) setReady(true)`), add:

```typescript
// Active gym name for passive indicator
try {
  const { getActiveGym } = await import("../../src/gymStore");
  const gym = getActiveGym();
  if (alive) setActiveGymName(gym?.name ?? null);
} catch {
  // gymStore not yet initialized or no gym — silently ignore
}
```

Use a dynamic import here to avoid adding a static import that could fail if `gymStore.ts` is not present on a fresh checkout without Task 02 complete. However, since Tasks 01-08 are done and `gymStore.ts` exists, a static import is also acceptable:

```typescript
import { getActiveGym } from "../../src/gymStore";
```

If using a static import, call it synchronously at the end of the `ensureDb().then` block:

```typescript
try {
  const gym = getActiveGym();
  if (alive) setActiveGymName(gym?.name ?? null);
} catch {}
```

**Use the static import approach** for consistency with how `log.tsx` uses gymStore — it imports synchronously.

### Step 3 — Re-load on tab focus using `useFocusEffect`

The home screen currently uses `useEffect` for initial load but does not re-load on tab re-focus. Add a `useFocusEffect` that refreshes the active gym name when the user navigates back to the home tab (e.g. after changing active gym on the log tab):

```typescript
useFocusEffect(
  useCallback(() => {
    try {
      const gym = getActiveGym();
      setActiveGymName(gym?.name ?? null);
    } catch {}
  }, [])
);
```

`useFocusEffect` is already imported from `@react-navigation/native` at line 17. `useCallback` is imported from React at line 2.

### Step 4 — Render the gym name label inside the "Today's Workout" card

The "Today's Workout" card begins at line ~279:

```typescript
<Card>
  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
    {t("home.todayWorkout")}
  </Text>
  {todayWorkout ? (
    ...
  ) : (
    ...
  )}
</Card>
```

Add the gym name label between the "TODAY'S WORKOUT" label and the conditional content block:

```typescript
<Card>
  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
    {t("home.todayWorkout")}
  </Text>
  {activeGymName ? (
    <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, opacity: 0.7 }}>
      {activeGymName}
    </Text>
  ) : null}
  {todayWorkout ? (
    ...
  ) : (
    ...
  )}
</Card>
```

The gym name sits below the card title and above the workout stats or "no workout" message. It is a passive indicator — no tap handler, no icon.

## Files to modify

- `app/(tabs)/index.tsx` — add `activeGymName` state, static import of `getActiveGym`, load gym name in the existing `useEffect`, refresh in `useFocusEffect`, render label in the Today's Workout card

## Patterns to follow

- The home screen already uses `useFocusEffect` — check if it exists. Looking at the current `index.tsx` (line 1-18), `useFocusEffect` is imported from `@react-navigation/native` but not yet used in the component body. Add it.
- The `backupDaysAgo` state follows the same "load once, show conditionally" pattern. `activeGymName` follows the same approach.
- The muted label style `{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, opacity: 0.7 }` matches the existing secondary text style used throughout the home screen (e.g. the streak and total labels at line ~440).
- `getActiveGym()` is synchronous — it reads from in-memory state set by `setActiveGymId`. No await needed. If gymStore has not yet been initialized (no gym has ever been set), it returns null, which is handled by `gym?.name ?? null`.

## Verification

After implementation, run `npx tsc --noEmit` to confirm no TypeScript errors.

Manual checks:
- **No gym exists**: home screen is visually identical to before — no label, no empty space, no crash. The `activeGymName` is null and nothing renders.
- **Gym exists but no active gym selected**: home screen is still unchanged. `getActiveGym()` returns null.
- **Active gym set on the log tab**: navigate to home tab. The gym name appears as muted text below "TODAY'S WORKOUT".
- **Clear active gym on log tab** (select "No gym" in `GymPickerModal`): navigate to home tab. The gym name disappears.
- The `useFocusEffect` ensures the label updates when the user switches tabs — no need to restart the app.
- All existing home screen content (stats, next workout preview, PRs, streak) is unchanged.

## Important constraints

- Do NOT show the gym name label anywhere other than inside the Today's Workout card. The architecture specifies a passive indicator in that card specifically.
- Do NOT add a tap handler or navigation action to the gym label. It is a read-only display.
- Do NOT query the `gym_locations` table directly in this file. Use `getActiveGym()` from `src/gymStore.ts` — it reads the in-memory active gym, which reflects whatever the user last selected.
- Do NOT call `listGyms()` here — that would be an unnecessary DB read. The home screen only needs to know the active gym name.
- If the home screen's `useEffect` cleanup sets `alive = false`, ensure the `setActiveGymName` call is guarded by `if (alive)`. This prevents a state update after unmount (line ~206 pattern: `return () => { alive = false; }`).

Run `npm run verify` when done.
