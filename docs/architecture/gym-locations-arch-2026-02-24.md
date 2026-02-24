# Gym Locations — Architecture
**Date:** 2026-02-24
**Feature branch:** experiment/agent-pipeline-gym-locations
**Schema version:** v21 -> v22

---

## 1. Overview

Users create named gym locations (e.g. "Trener1 Fagerholt", "Hjemmegym"), select one before a workout, and each gym remembers its available equipment and plate inventory. The log screen uses gym-scoped weight history for pre-fill and filters exercise alternatives by available equipment. The plate calculator uses gym-specific plate sets. The feature is completely invisible until the user creates at least one gym.

---

## 2. Resolved Open Decisions

### Decision 1: Equipment storage — JSON column on `gym_locations`
Rationale: Equipment is a flat list of `Equipment` enum values. No per-machine quantity or weight tracking in v1. JSON column matches the existing `exercises_json` pattern in `workout_templates`.

### Decision 2: Plate inventory storage — JSON column on `gym_locations`
Rationale: Plates are tightly coupled to a gym entity. Keeping all gym data in one row keeps CRUD atomic.

### Decision 3: exercise_targets scoping — keep `(program_id, exercise_id)` for v1
Rationale: Targets represent programming intent (rep ranges, increments), which is gym-agnostic.

### Decision 4: gymStore.ts API — named exports, synchronous, follows exerciseNotes.ts pattern

### Decision 5: GymPickerModal — follows DayPicker inline modal pattern exactly

### Decision 6: Settings gym management — full-screen Modal (dataToolsOpen pattern)

### Decision 7: ExerciseSwapModal equipment filter — parent-side filtering

### Decision 8: Query strategy — two-pass, not SQL COALESCE

---

## 3. Data Model

### Migration v22

```typescript
{ version: 22, up: (d) => {
  d.execSync(`
    CREATE TABLE IF NOT EXISTS gym_locations (
      id                  TEXT    PRIMARY KEY NOT NULL,
      name                TEXT    NOT NULL,
      color               TEXT,
      icon                TEXT,
      available_equipment TEXT,
      available_plates    TEXT,
      sort_index          INTEGER NOT NULL DEFAULT 0,
      created_at          TEXT    NOT NULL
    );
  `);
  try { d.execSync(`ALTER TABLE workouts ADD COLUMN gym_id TEXT;`); } catch {}
  d.execSync(`CREATE INDEX IF NOT EXISTS idx_workouts_gym ON workouts(gym_id);`);
}},
```

### TypeScript types (in src/gymStore.ts)

```typescript
export type GymLocation = {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  availableEquipment: Equipment[] | null;
  availablePlates: number[] | null;
  sortIndex: number;
  createdAt: string;
};
```

### LastSetInfo extension

```typescript
export type LastSetInfo = {
  weight: number;
  reps: number;
  rpe?: number | null;
  created_at: string;
  workout_id?: string | null;
  fromOtherGym?: boolean;  // NEW
};
```

---

## 4. New File: src/gymStore.ts — API Surface

```typescript
// CRUD
export function listGyms(): GymLocation[];
export function getGym(id: string): GymLocation | null;
export function createGym(input: CreateGymInput): GymLocation;
export function updateGym(id: string, input: UpdateGymInput): GymLocation | null;
export function deleteGym(id: string): void;

// Active gym
export function getActiveGymId(): string | null;
export function setActiveGymId(gymId: string | null): void;
export function getActiveGym(): GymLocation | null;

// Equipment helpers
export function getGymEquipmentSet(gym: GymLocation): Set<Equipment> | null;
export function isEquipmentAvailable(equipment: Equipment, gym: GymLocation | null): boolean;

// Plate helpers
export function getGymPlates(gym: GymLocation | null): number[];
```

---

## 5. New File: src/components/modals/GymPickerModal.tsx

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

Modal with transparent overlay, glass card, "No gym" option first, gym list with color dots, lock alert when disabled.

---

## 6. Modified Files — Summary

### src/db.ts
- Append migration v22

### src/plateCalculator.ts
- Export `DEFAULT_PLATES_KG`

### src/exerciseHistory.ts
- Add optional `gymId` param to `getRecentSessions()`
- Two-pass logic: gym-scoped first, global fallback

### src/components/workout/ExerciseCard.tsx
- Add `fromOtherGym` to LastSetInfo
- Add `gymId` and `gymEquipment` props
- Equipment availability opacity (0.4 for unavailable)
- "from other gym" label for fallback weights

### app/(tabs)/log.tsx
- Import gymStore + GymPickerModal
- Add activeGymId, gyms, gymPickerOpen state
- Load gyms in loadSession()
- Gym chip in chip row (leftmost, hidden when no gyms exist)
- Lock gym switching mid-session
- Two-pass lastSets query with activeGymId dependency
- Add gym_id to startWorkout() INSERT
- Show gym name in session card during active workout
- Filter alternativeIds by gym equipment before passing to ExerciseSwapModal
- Pass gymId to PlateCalcModal
- Thread gymId + gymEquipment to all ExerciseCard renders
- Render GymPickerModal

### app/(tabs)/settings.tsx
- Import gymStore
- Add gym state + management modal state
- Load gyms in loadSettings()
- GymLocationsCard between WeightUnit and DefaultDay
- Full gym management Modal with CRUD
- Add gym_locations cleanup to resetAllData()

### app/(tabs)/index.tsx
- Load active gym name
- Passive gym label in Today's Workout card

### src/components/modals/PlateCalcModal.tsx
- Add gymId prop
- Load gym-specific plates in loadData()
- Pass availablePlates to calculatePlates()

### src/backup.ts
- Bump CURRENT_SCHEMA_VERSION 3 -> 4
- Add gym_locations to export
- Add gym_id to workouts export
- Add gym_locations import loop
- Add gym_id to workouts import

### src/i18n/nb/gym.ts + src/i18n/en/gym.ts (NEW)
- 5 gym-specific keys

### src/i18n/nb/settings.ts + src/i18n/en/settings.ts
- ~16 new gym management keys

---

## 7. Data Flow Diagrams

### Gym Selection
```
User taps gym chip -> if locked: Alert -> else: GymPickerModal
-> onSelect(gymId) -> setActiveGymId (state + settings)
-> lastSets useEffect re-fires -> two-pass query -> ExerciseCards re-render
```

### Workout Start with Gym
```
startWorkout() -> INSERT INTO workouts(..., gym_id) -> gym chip locks
-> session card shows gym name
```

### Gym-Scoped Weight Pre-fill
```
activeGymId set? -> Pass 1: gym-scoped query (fromOtherGym: false)
-> missing exercises? -> Pass 2: global fallback (fromOtherGym: true)
-> inputs pre-fill with label hint
```

---

## 8. Implementation Order

| Phase | Title | Files | Depends on |
|-------|-------|-------|------------|
| 1 | Foundation | plateCalculator, db.ts, gymStore.ts, i18n, backup.ts | Nothing |
| 2 | Settings Gym Management | settings.tsx | Phase 1 |
| 3 | Log Chip + GymPickerModal | GymPickerModal.tsx, log.tsx | Phase 1 |
| 4 | Workout Tagging | log.tsx | Phase 3 |
| 5 | Two-Pass Weight Pre-fill | ExerciseCard.tsx, log.tsx | Phase 4 |
| 6 | Gym-Scoped History | exerciseHistory.ts, ExerciseCard.tsx | Phase 5 |
| 7 | Equipment Filter in Swap | log.tsx | Phase 3 |
| 8 | Gym Plates in Plate Calc | PlateCalcModal.tsx, log.tsx | Phase 3 |
| 9 | Home Passive Indicator | index.tsx | Phase 1 |

Phases 6, 7, 8, 9 can run in parallel after Phase 5.

---

## 9. Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| backup.ts not updated | High | Phase 1 mandates backup.ts audit |
| resetAllData() misses gym_locations | Medium | Add DELETE to transaction |
| Two-pass query slow on large DBs | Medium | idx_workouts_gym + idx_sets_exercise |
| setActiveGymId naming collision | Low | Import alias setActiveGymIdStore |
| Legacy gym_id = NULL | Handled | Two-pass: NULL rows caught in pass 2 as fromOtherGym |
