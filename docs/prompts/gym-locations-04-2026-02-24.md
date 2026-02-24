# Task 04: Settings — Gym Locations management card + CRUD modal

## Context
This is Prompt 4 of 4 for the Gym Locations feature (foundation phase). Tasks 01-03 are complete: the DB schema exists, `gymStore.ts` is implemented, and all i18n keys are registered. This task adds the visible gym management UI to the Settings screen — a `GymLocationsCard` between `WeightUnitCard` and the Default Day card, plus a full-screen CRUD modal. It also wires `resetAllData()` to clear the `gym_locations` table.

## What to do

All changes are in `app/(tabs)/settings.tsx`.

### 1. Add import for gymStore

Add a new import near the top of the file (after the existing `src/` imports):

```typescript
import { listGyms, createGym, updateGym, deleteGym, type GymLocation } from "../../src/gymStore";
```

### 2. Add gym state variables

Inside the `Settings` component function, after the existing `dataToolsOpen` state block (around line 108), add:

```typescript
const [gymModalOpen, setGymModalOpen] = useState(false);
const [gyms, setGyms] = useState<GymLocation[]>([]);
const [gymEditTarget, setGymEditTarget] = useState<GymLocation | null>(null);
const [gymFormName, setGymFormName] = useState("");
const [gymFormColor, setGymFormColor] = useState<string>("#B668F5");
const [gymFormError, setGymFormError] = useState<string | null>(null);
const [gymFormOpen, setGymFormOpen] = useState(false);
```

### 3. Load gyms in `loadSettings()`

At the end of the existing `loadSettings()` function (after `setWorkoutLocked`/`setLockedDayLabel` block, before the closing brace), add:

```typescript
const loadedGyms = listGyms();
setGyms(loadedGyms);
```

This ensures the gym list is refreshed every time settings are loaded (on mount and after import).

### 4. Add a `GymLocationsCard` component

Define this as a standalone function component inside `settings.tsx`, after the existing `WeightUnitCard` function and before the `Settings` default export. It receives the current gyms list and callbacks via props so it stays purely presentational:

```typescript
function GymLocationsCard({
  gyms,
  onManage,
}: {
  gyms: GymLocation[];
  onManage: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();

  return (
    <Card title={t("settings.gymLocations")}>
      <Text style={{ color: theme.muted, marginBottom: 8 }}>
        {t("settings.gymLocations.desc")}
      </Text>
      {gyms.length === 0 ? (
        <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12, marginBottom: 8 }}>
          {t("settings.gymLocations.empty")}
        </Text>
      ) : (
        <View style={{ gap: 6, marginBottom: 8 }}>
          {gyms.map((gym) => (
            <View
              key={gym.id}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: gym.color ?? theme.accent,
                }}
              />
              <Text style={{ color: theme.text, fontSize: theme.fontSize.sm }}>
                {gym.name}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Btn label={t("settings.gymLocations.manage")} onPress={onManage} />
    </Card>
  );
}
```

### 5. Place `GymLocationsCard` in the render tree

In the main `Settings` JSX, find where `<WeightUnitCard />` renders (around line 884) and the `<Card title={t("settings.defaultDay")}>` that follows it. Insert `<GymLocationsCard>` between them:

```tsx
<WeightUnitCard />

<GymLocationsCard
  gyms={gyms}
  onManage={() => setGymModalOpen(true)}
/>

<Card title={t("settings.defaultDay")}>
```

### 6. Add the gym management functions inside the `Settings` component

Add these functions inside the `Settings` component body, near the other data management functions (e.g. after `resetAllData`):

```typescript
function openGymAdd() {
  setGymEditTarget(null);
  setGymFormName("");
  setGymFormColor("#B668F5");
  setGymFormError(null);
  setGymFormOpen(true);
}

function openGymEdit(gym: GymLocation) {
  setGymEditTarget(gym);
  setGymFormName(gym.name);
  setGymFormColor(gym.color ?? "#B668F5");
  setGymFormError(null);
  setGymFormOpen(true);
}

function handleGymSave() {
  const name = gymFormName.trim();
  if (!name) {
    setGymFormError(t("settings.gym.nameRequired"));
    return;
  }
  if (gymEditTarget) {
    updateGym(gymEditTarget.id, { name, color: gymFormColor });
  } else {
    const nextSortIndex = gyms.length;
    createGym({ name, color: gymFormColor, sortIndex: nextSortIndex });
  }
  setGyms(listGyms());
  setGymFormOpen(false);
}

function handleGymDelete(gym: GymLocation) {
  Alert.alert(
    t("settings.gym.confirmDelete"),
    t("settings.gym.confirmDeleteMsg", { name: gym.name }),
    [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.gym.delete"),
        style: "destructive",
        onPress: () => {
          deleteGym(gym.id);
          setGyms(listGyms());
          if (!gymFormOpen) return;
          setGymFormOpen(false);
        },
      },
    ]
  );
}
```

### 7. Add `DELETE FROM gym_locations` to `resetAllData()`

In the existing `resetAllData()` function, the transaction block currently deletes from sets, workouts, programs, etc. Add `gym_locations` to the transaction (after `DELETE FROM settings`, before `COMMIT`):

```typescript
await db.execAsync("DELETE FROM gym_locations");
```

And after `ProgramStore.ensurePrograms()` and `loadSettings()` in the success handler, the `gyms` state will be automatically refreshed because `loadSettings()` now calls `listGyms()` (from Step 3).

### 8. Add the gym management Modal

Add the full-screen gym management Modal at the end of the JSX return, alongside the existing `dataToolsOpen` Modal. The gym modal follows the same full-screen pattern (`visible={gymModalOpen}`, `transparent`, `animationType="fade"`) as `dataToolsOpen` Modal:

```tsx
{/* ── Gym Management Modal ── */}
<Modal
  visible={gymModalOpen}
  transparent
  animationType="fade"
  onRequestClose={() => setGymModalOpen(false)}
>
  <View style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}>
    <View style={{
      backgroundColor: theme.modalGlass,
      borderColor: theme.glassBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      gap: 12,
      maxHeight: "85%",
    }}>
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
        {t("settings.gym.title")}
      </Text>

      <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 8 }}>
        {gyms.length === 0 ? (
          <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
            {t("settings.gymLocations.empty")}
          </Text>
        ) : (
          gyms.map((gym) => (
            <Pressable
              key={gym.id}
              onPress={() => openGymEdit(gym)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                padding: 10,
                borderRadius: 12,
                backgroundColor: theme.glass,
                borderWidth: 1,
                borderColor: theme.glassBorder,
              }}
            >
              <View style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: gym.color ?? theme.accent,
              }} />
              <Text style={{ color: theme.text, flex: 1 }}>{gym.name}</Text>
              <MaterialIcons name="chevron-right" size={18} color={theme.muted} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Btn label={t("settings.gym.add")} onPress={openGymAdd} />
        <Btn label={t("common.close")} onPress={() => setGymModalOpen(false)} />
      </View>
    </View>
  </View>
</Modal>

{/* ── Gym Add/Edit Form Modal ── */}
<Modal
  visible={gymFormOpen}
  transparent
  animationType="fade"
  onRequestClose={() => setGymFormOpen(false)}
>
  <View style={{ flex: 1, backgroundColor: theme.modalOverlay, justifyContent: "center", padding: 16 }}>
    <View style={{
      backgroundColor: theme.modalGlass,
      borderColor: theme.glassBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: 14,
      gap: 12,
    }}>
      <Text style={{ color: theme.text, fontFamily: theme.mono, fontSize: 18 }}>
        {gymEditTarget ? t("settings.gym.editTitle") : t("settings.gym.addTitle")}
      </Text>

      <TextField
        value={gymFormName}
        onChangeText={(v) => { setGymFormName(v); setGymFormError(null); }}
        placeholder={t("settings.gym.namePlaceholder")}
        placeholderTextColor={theme.muted}
        style={{
          color: theme.text,
          backgroundColor: theme.panel2,
          borderColor: gymFormError ? "#EF4444" : theme.line,
          borderWidth: 1,
          borderRadius: 12,
          padding: 10,
          fontSize: 15,
          fontFamily: theme.mono,
        }}
      />
      {gymFormError ? (
        <Text style={{ color: "#EF4444", fontFamily: theme.mono, fontSize: 12 }}>
          {gymFormError}
        </Text>
      ) : null}

      <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 12 }}>
        {t("settings.gym.colorLabel")}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        {["#B668F5", "#F97316", "#22C55E", "#3B82F6", "#EF4444", "#F59E0B", "#EC4899", "#6366F1"].map((c) => (
          <Pressable
            key={c}
            onPress={() => setGymFormColor(c)}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: c,
              borderWidth: gymFormColor === c ? 3 : 1,
              borderColor: gymFormColor === c ? theme.text : theme.glassBorder,
            }}
          />
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Btn label={t("settings.gym.save")} onPress={handleGymSave} />
        {gymEditTarget ? (
          <Btn
            label={t("settings.gym.delete")}
            tone="danger"
            onPress={() => handleGymDelete(gymEditTarget)}
          />
        ) : null}
        <Btn label={t("common.cancel")} onPress={() => setGymFormOpen(false)} />
      </View>
    </View>
  </View>
</Modal>
```

Note: `MaterialIcons` is already imported in `ExerciseCard.tsx` and other files but may not be imported in `settings.tsx`. Check the top of `settings.tsx` — if `MaterialIcons` is not already imported, add:
```typescript
import { MaterialIcons } from "@expo/vector-icons";
```

## Files to modify

- `c:/Users/Flage/Desktop/gymdash/app/(tabs)/settings.tsx` — all changes above

## Patterns to follow

- See the existing `dataToolsOpen` Modal in `settings.tsx` (around line 1226) for the full-screen modal structure: `transparent`, `animationType="fade"`, `theme.modalOverlay` background, `theme.modalGlass` card, `borderRadius: 16`, `padding: 14`, `gap: 12`, `maxHeight: "90%"`.
- See `WeightUnitCard` (the function at line 44) for the pattern of an internal named card component that uses `useTheme()` and `useI18n()` directly.
- See `resetAllData()` (line 701) for the exact transaction pattern to model the `DELETE FROM gym_locations` addition.
- The `Btn` component from `src/ui` accepts a `tone` prop (`"danger"` for destructive actions). See existing usage in the `dataToolsOpen` modal.
- The `TextField` component from `src/ui` is already imported in settings.tsx.
- Alert confirmations follow the `Alert.alert(title, msg, buttons)` pattern — see `resetAllData()` for the cancel/destructive button array.
- Color swatches: use a simple `Pressable` + `View` with `borderRadius: 16` (circle), thicker border on selected. No elevation.

## Verification

Run `npm run verify` when done.

Manual checks:
- Create a gym in Settings with a name and color — it persists after closing and reopening the modal.
- Edit the gym name and color — changes are saved.
- Delete the gym via the edit form — list updates to empty state.
- Open Settings after Reset All Data — gym list is empty.
- With zero gyms: `GymLocationsCard` renders the empty state message, not a crash.
- The card appears between `WeightUnitCard` and the Default Day card in the scroll view.

## Important constraints

- Android: do NOT add `elevation` to any of the modal card `View` elements. The modal overlay already handles visual layering. Elevation on semi-transparent views causes a white rectangle on Android.
- The gym management modal opens on top of the settings scroll view — it is NOT a nested navigator screen. Use `Modal` from `react-native`, same as the existing modals in this file.
- `gymFormOpen` and `gymModalOpen` are separate state variables — the form modal stacks on top of the list modal. Both can be open simultaneously (user taps a gym in the list modal, form slides up). Closing the form does NOT close the list modal.
- The color palette is a fixed hardcoded list of 8 colors. Do not add a full color picker — a simple row of color dot `Pressable` elements is sufficient for v1.
- Sorting: `sortIndex` is set to `gyms.length` on create (appended to end). No drag-to-reorder UI in v1.
- `listGyms()` is synchronous (uses `getDb().getAllSync`) — no async/await needed when calling it in handlers.
- i18n: every visible string must use `t("key")` — no hardcoded English or Norwegian text in JSX.
