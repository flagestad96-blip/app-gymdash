# Gym Locations — Discovery Summary
**Date:** 2026-02-24
**Sources:** Scout report, Brainstorm, UX Critique

---

## What We're Building

Users can create named gym locations (e.g. "Trener1 Fagerholt", "Hjemmegym"), select an active gym before a workout, and each gym remembers available equipment. When logging, the app uses gym-specific weight history and filters exercises by available equipment.

---

## Key Discovery Findings

### Architecture (from Scout)
- **No gym concept exists today** — all data is global
- **SQLite migration system** at v21 — gym work starts at v22
- **Settings are key/value pairs** in SQLite — `activeGymId` fits this pattern perfectly
- **`calculatePlates()` already accepts `availablePlates[]`** — plate calc is pre-wired for gym-specific plates
- **`exercise_notes` keyed on `exercise_id` only** — global, not gym-scoped
- **`exercise_targets` keyed on `(program_id, exercise_id)`** — no gym dimension
- **Workout logging flow:** `loadSession()` -> loads program -> renders ExerciseCards -> `getRecentSessions()` queries global history

### Ideas Worth Pursuing (from Brainstorm)

**v1 Shortlist (recommended build order):**
1. **M1 — Gym Location CRUD** — Foundation. `gym_locations` table, Settings UI, `activeGymId` setting
2. **Q3 + Q2 — Log screen switcher + workout tagging** — Gym chip in log tab chip row, `gym_id` column on workouts
3. **M2 — Gym-specific plate inventory** — Available plate sizes per gym. `calculatePlates()` is already parameterized for this
4. **M4 — Gym-scoped weight defaults** — Filter last-set lookups by `workouts.gym_id`, fallback to global

**Defer to v2:**
- Gym-specific exercise notes (separate `gym_exercise_notes` table)
- Gym-scoped PRs and progression tracking
- Program-gym binding ("Switch to PPL Trener1?")
- GPS auto-detection
- Per-gym bar preferences in PlateCalcModal

### UX Constraints (from UX Critique)

**Red (must-haves):**
1. **Gym chip belongs in the log tab chip row** — leftmost position, same pattern as day picker
2. **Lock gym switching mid-session** — mirror `selectDayIndex` alert pattern
3. **Invisible to existing users** — nullable `gym_id`, no prompts, no broken state. Feature only appears after creating a gym in Settings

**Yellow (should-haves):**
4. **Settings manages gyms, log tab switches them** — Gym Locations card in Settings between WeightUnit and Default Day
5. **Show gym name during active workout** — muted text in session card below duration
6. **Unavailable exercises render at 0.4 opacity** — with "not at this gym" label, still tappable
7. **Fallback weight label** — when pre-fill comes from another gym, show "from other gym" hint

**Green (nice-to-haves):**
8. **Home screen passive gym indicator** — muted text in Today's Workout card
9. **PlateCalcModal bar prefs per gym** — defer to v2

---

## Recommended v1 Scope

### New Files
| File | Purpose |
|------|---------|
| `src/gymStore.ts` | CRUD for gym_locations table, equipment prefs, active gym helpers |
| `src/components/modals/GymPickerModal.tsx` | Gym picker modal (follows DayPicker pattern) |

### Modified Files
| File | Change |
|------|--------|
| `src/db.ts` | Migration v22: `gym_locations` table + `workouts.gym_id` column |
| `app/(tabs)/log.tsx` | Gym chip, picker modal, lock mid-session, pass gymId to startWorkout, gym-scoped lastSets |
| `app/(tabs)/settings.tsx` | Gym Locations management card + modal |
| `app/(tabs)/index.tsx` | Passive gym label in Today's Workout card |
| `src/exerciseHistory.ts` | Add optional `gymId` param to `getRecentSessions()` |
| `src/components/workout/ExerciseCard.tsx` | Accept gymId prop, show fallback weight label |
| `src/components/modals/ExerciseSwapModal.tsx` | Equipment availability filter |
| `src/components/modals/PlateCalcModal.tsx` | Load gym-specific plate inventory |
| `src/plateCalculator.ts` | No algorithm change — just pass gym plates |
| `src/i18n/nb/*.ts` + `src/i18n/en/*.ts` | ~15 new translation keys |

### Database Schema (v22)
```sql
CREATE TABLE gym_locations (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  available_equipment TEXT,  -- JSON array of Equipment enum values
  available_plates TEXT,     -- JSON array of plate weights
  sort_index INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

ALTER TABLE workouts ADD COLUMN gym_id TEXT;
CREATE INDEX idx_workouts_gym ON workouts(gym_id);
```
Active gym stored as `activeGymId` in existing `settings` key/value table.

---

## Open Decisions for Architect

1. **Separate `gym_equipment` table vs JSON column on `gym_locations`?** — JSON column is simpler for v1 (equipment is just a list of enum values). Separate table only needed if we track per-machine weights or quantities.

2. **Gym-specific plates storage:** Settings key `gymPlates_<gymId>` (consistent with existing `exerciseBarPrefs` pattern) vs column on `gym_locations` table?

3. **Exercise targets scoping:** Keep `(program_id, exercise_id)` for v1, or add gym dimension now?

4. **Historical backfill:** Design queries to handle `gym_id = NULL` gracefully. No backfill UI in v1.

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Existing users confused by gym UI | High | Feature invisible until first gym created |
| Mid-session gym switch corrupts data | High | Lock gym selection when workout active |
| Weight pre-fill wrong after gym switch | Medium | Two-pass query: gym-specific first, global fallback |
| Circular imports (db.ts <-> gymStore.ts) | Low | Follow existing lazy require pattern |
| Performance of gym-filtered queries | Low | Index on workouts(gym_id) |
