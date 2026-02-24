# Task 03: i18n translation keys + backup.ts gym support

## Context
This is Prompt 3 of 4 for the Gym Locations feature. Tasks 01 and 02 are complete: the DB schema and `gymStore.ts` exist. This task adds all translation strings needed by the gym feature across both locales, registers the new `gym` namespace in the i18n merge barrel, and updates `backup.ts` so gym data survives export/import round-trips.

## What to do

### 1. Create `src/i18n/en/gym.ts`

New file. Contains 5 gym-specific log/chip/picker keys used across the Log screen and ExerciseCard (Tasks 06-09). Follow the exact module pattern of existing namespace files like `src/i18n/en/log.ts`.

```typescript
import type { TranslationMap } from "../types";

const gym: TranslationMap = {
  "gym.noGym": "No gym",
  "gym.selectGym": "Select gym",
  "gym.lockedMidSession": "Cannot change gym during an active workout.",
  "gym.fromOtherGym": "from other gym",
  "gym.notAtThisGym": "not at this gym",
};

export default gym;
```

### 2. Create `src/i18n/nb/gym.ts`

New file. Same keys in Norwegian:

```typescript
import type { TranslationMap } from "../types";

const gym: TranslationMap = {
  "gym.noGym": "Ingen treningssenter",
  "gym.selectGym": "Velg treningssenter",
  "gym.lockedMidSession": "Kan ikke bytte treningssenter under en aktiv \u00f8kt.",
  "gym.fromOtherGym": "fra annet treningssenter",
  "gym.notAtThisGym": "ikke p\u00e5 dette treningssenteret",
};

export default gym;
```

### 3. Add gym management keys to `src/i18n/en/settings.ts`

Append the following block at the end of the `settings` object, immediately before the final `};`. Place it after the existing `"settings.privacy.storageDesc"` line:

```typescript
  // ── Gym Locations ──
  "settings.gymLocations": "GYM LOCATIONS",
  "settings.gymLocations.desc": "Create and manage your gym locations.",
  "settings.gymLocations.manage": "Manage Gyms",
  "settings.gymLocations.empty": "No gyms yet. Tap \u201cManage Gyms\u201d to add one.",
  "settings.gym.title": "Manage Gyms",
  "settings.gym.add": "Add Gym",
  "settings.gym.addTitle": "New Gym",
  "settings.gym.editTitle": "Edit Gym",
  "settings.gym.namePlaceholder": "Gym name",
  "settings.gym.colorLabel": "Color",
  "settings.gym.save": "Save",
  "settings.gym.delete": "Delete",
  "settings.gym.confirmDelete": "Delete gym?",
  "settings.gym.confirmDeleteMsg": "Delete \u201c{name}\u201d? This does not delete workout history.",
  "settings.gym.nameRequired": "Gym name is required.",
```

### 4. Add gym management keys to `src/i18n/nb/settings.ts`

Append the same block in Norwegian, immediately before the final `};`:

```typescript
  // ── Gym Locations ──
  "settings.gymLocations": "TRENINGSSTEDER",
  "settings.gymLocations.desc": "Opprett og administrer dine treningssteder.",
  "settings.gymLocations.manage": "Administrer treningssteder",
  "settings.gymLocations.empty": "Ingen treningssteder enn\u00e5. Trykk \u00ABAdministrer treningssteder\u00BB for \u00e5 legge til.",
  "settings.gym.title": "Administrer treningssteder",
  "settings.gym.add": "Legg til treningssenter",
  "settings.gym.addTitle": "Nytt treningssenter",
  "settings.gym.editTitle": "Rediger treningssenter",
  "settings.gym.namePlaceholder": "Navn p\u00e5 treningssenter",
  "settings.gym.colorLabel": "Farge",
  "settings.gym.save": "Lagre",
  "settings.gym.delete": "Slett",
  "settings.gym.confirmDelete": "Slette treningssenter?",
  "settings.gym.confirmDeleteMsg": "Slette \u00AB{name}\u00BB? Historikk slettes ikke.",
  "settings.gym.nameRequired": "Navn er p\u00e5krevd.",
```

### 5. Register the `gym` namespace in `src/i18n/merge.ts`

The barrel file currently imports and merges 13 namespaces per locale. Add `gym` as namespace 14.

After the existing imports (before the `function merge` line), add:

```typescript
import nbGym from "./nb/gym";
import enGym from "./en/gym";
```

Then in the `nb` merge call, add `nbGym` as the last argument:
```typescript
export const nb: TranslationMap = merge(
  nbCommon, nbHome, nbLog, nbProgram, nbAnalysis,
  nbCalendar, nbHistory, nbBody, nbSettings,
  nbAchievements, nbOnboarding, nbPatchNotes, nbNotifications,
  nbGym,
);
```

And in the `en` merge call:
```typescript
export const en: TranslationMap = merge(
  enCommon, enHome, enLog, enProgram, enAnalysis,
  enCalendar, enHistory, enBody, enSettings,
  enAchievements, enOnboarding, enPatchNotes, enNotifications,
  enGym,
);
```

Also update the `EXPECTED_MIN_KEYS` assertion on line 51 from `560` to `580` (adding 5 gym keys + 14 settings keys = 19 keys per locale, so the new minimum is 560 + 19 = 579, round up to 580 for safety):

```typescript
const EXPECTED_MIN_KEYS = 580;
```

### 6. Update `src/backup.ts`

Six changes, all surgical:

**a. Bump schema version (line 7):**
```typescript
export const CURRENT_SCHEMA_VERSION = 4;
```

**b. Add `gym_id` to the workouts SELECT in `exportFullBackup()` (line 50):**
```typescript
const workouts = await db.getAllAsync(
  `SELECT id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at, ended_at, gym_id FROM workouts`
);
```

**c. Add `gym_locations` query in `exportFullBackup()`, after the `exerciseNotes` query (around line 103):**
```typescript
const gymLocations = await db.getAllAsync(
  `SELECT id, name, color, icon, available_equipment, available_plates, sort_index, created_at FROM gym_locations`
);
```

**d. Add `gym_locations` to the `data` payload object in `exportFullBackup()`, after `exercise_notes`:
```typescript
      exercise_notes: exerciseNotes ?? [],
      gym_locations: gymLocations ?? [],
```

**e. Add `gym_locations` parsing in `importBackup()`, after the `exerciseNotes` parsing line (around line 196):**
```typescript
const gymLocations = Array.isArray(data.gym_locations) ? data.gym_locations : [];
```

Also add `gymLocations.length > 0` to the `hasAnyData` check — but note that an empty array is valid (v3 backups will have no `gym_locations`), so do NOT make `gym_locations` required. The existing `hasAnyData` check remains correct as-is; just add the variable without affecting the check.

**f. Add the `gym_locations` DELETE in the `"fresh"` mode block (after `DELETE FROM exercise_notes`):**
```typescript
await db.execAsync("DELETE FROM gym_locations");
```

**g. Add the import loop for `gym_locations` (after the `exercise_notes` loop, before `await db.execAsync("COMMIT")`):**
```typescript
for (const gl of gymLocations) {
  await db.runAsync(
    `${verb} gym_locations(id, name, color, icon, available_equipment, available_plates, sort_index, created_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      gl.id,
      gl.name,
      gl.color ?? null,
      gl.icon ?? null,
      gl.available_equipment ?? null,
      gl.available_plates ?? null,
      gl.sort_index ?? 0,
      gl.created_at,
    ]
  );
}
```

**h. Add `gym_id` to the workouts INSERT in `importBackup()`.** The current workouts INSERT (around line 254) is:

```typescript
`${verb} workouts(id, date, program_mode, day_key, back_status, notes, day_index, started_at)
 VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
[w.id, w.date, w.program_mode, w.day_key, w.back_status, w.notes ?? null, w.day_index ?? null, w.started_at ?? null]
```

Update it to:

```typescript
`${verb} workouts(id, date, program_mode, day_key, back_status, notes, day_index, started_at, gym_id)
 VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
[w.id, w.date, w.program_mode, w.day_key, w.back_status, w.notes ?? null, w.day_index ?? null, w.started_at ?? null, w.gym_id ?? null]
```

## Files to create/modify

- `c:/Users/Flage/Desktop/gymdash/src/i18n/en/gym.ts` — create new file
- `c:/Users/Flage/Desktop/gymdash/src/i18n/nb/gym.ts` — create new file
- `c:/Users/Flage/Desktop/gymdash/src/i18n/en/settings.ts` — append 14 gym management keys
- `c:/Users/Flage/Desktop/gymdash/src/i18n/nb/settings.ts` — append 14 gym management keys (Norwegian)
- `c:/Users/Flage/Desktop/gymdash/src/i18n/merge.ts` — import + merge nbGym/enGym, bump EXPECTED_MIN_KEYS to 580
- `c:/Users/Flage/Desktop/gymdash/src/backup.ts` — 8 changes: version bump, gym_locations export, gym_id in workouts export/import, gym_locations import loop, fresh-mode DELETE

## Patterns to follow

- See `c:/Users/Flage/Desktop/gymdash/src/i18n/en/log.ts` for the exact namespace file structure (`import type { TranslationMap }`, named `const`, `export default`).
- See `c:/Users/Flage/Desktop/gymdash/src/i18n/merge.ts` for the merge pattern and how to extend the import list and merge calls.
- See the `exerciseNotes` handling in `src/backup.ts` as the template for both the export query and import loop for `gym_locations`.
- The workouts INSERT pattern in `backup.ts` already handles nullable columns with `?? null` — follow the same convention for `gym_id`.

## Verification

Run `npm run verify` when done.

Additional checks:
- `npx tsc --noEmit` must produce zero errors.
- The `EXPECTED_MIN_KEYS` console warning must not appear in dev mode (key count matches).
- Export a backup from the app and confirm the JSON contains `"gym_locations": []` and `"schemaVersion": 4`.
- Import that same backup and confirm it completes without error.
- Importing a v3 backup (schemaVersion 3, no `gym_locations` key) must also succeed — the `Array.isArray(data.gym_locations)` guard with fallback `[]` handles this safely.

## Important constraints

- All Norwegian strings must use unicode escapes for non-ASCII characters (e.g. `\u00f8` for `ø`, `\u00e5` for `å`, `\u00e6` for `æ`). Follow the exact same encoding style as the existing Norwegian strings in `src/i18n/nb/settings.ts`.
- The `CURRENT_SCHEMA_VERSION` bump from 3 to 4 is a hard requirement. The version guard `if (schemaVersion > CURRENT_SCHEMA_VERSION)` in `importBackup()` uses this value to reject backups from newer app versions. Do not set it to any other value.
- Do NOT add a `gym_locations.length > 0` term to the `hasAnyData` check — an empty gym list is valid for both v3 legacy backups and fresh installs.
- i18n: all UI strings go through `t("key")` from `useI18n()`. Do not hardcode any gym-related text directly in components.
- The `gym` namespace file must export its object as `export default gym` (not as a named export), to match every other namespace file in the codebase.
