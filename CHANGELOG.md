# Gymdash Changelog

## v0.9.7-beta — 2026-05-13

### Features
- **Log tab redesign**: Top-level list of completed workouts; tap a workout for a read-only detail view of every exercise, set, RPE, note and rest. Old set-search behaviour preserved as a secondary view.
- **Workout detail view**: New route `app/workout/[id].tsx` with full session breakdown.
- **End-workout button**: Sticky footer on the log screen for an unambiguous way to finish.
- **Resume banner**: Home screen now surfaces an active workout with a "Continue workout" button.
- **End-of-workout prompt**: When all planned sets are done, the app asks whether to finish or keep going.
- **Three-way supersets**: Add a third exercise to any superset block in the program builder.
- **In-place superset edit**: Swap or remove an exercise without deleting and rebuilding the block.
- **Shared "+ Set" on supersets**: One tap adds a set to every exercise in the block.
- **Day names**: Name each program day (e.g. "Push"); names show in calendar and log header.
- **Per-set notes**: Quick free-text note per set with badge indicator.

### Improvements
- **Superset card layout**: Destructive actions tucked into an overflow menu; progressive actions stay flat.
- **Calendar mark dialog**: Replaced `Alert.alert` with a Modal sporting an explicit close button.
- **Version & patch-notes hygiene**: New `scripts/check-version.js` (wired into `npm run verify`) and `scripts/bump-version.js` keep `app.json`, `package.json`, `CHANGELOG.md` and `src/patchNotes.ts` in lockstep so future builds can't ship with stale "What's New" notes.

### Bug Fixes
- **Chip cropping**: Long category labels now ellipsize instead of being cut off.
- **Search behind keyboard**: `ExerciseAddModal` adds bottom padding so few results stay visible above the keyboard.
- **Stopwatch instructions overlap**: Floating rest timer no longer covers its own help text.
- **Auto-scroll offset**: "Jump to exercise" lands the card under the TopBar instead of at the bottom of the screen.
- **Add-exercise search**: Short queries (1–2 letters) now return results.

### Catch-up patch notes
- `src/patchNotes.ts` now carries the in-app "What's New" entries for v0.9.5-beta and v0.9.6-beta (previously only documented in this file, not surfaced in the app).

---

## v0.9.6-beta — 2026-02-27

### Features
- **Ad-hoc exercises in workout**: Add any exercise from the library mid-workout via the new "+" button on the log screen. Ad-hoc exercises persist across app restarts (stored in settings), are excluded from planned-set ratio calculations, and are cleaned up on workout finish or cancel. New `ExerciseAddModal` component handles search and selection.
- **Set tracking with target sets**: Exercise cards now display a live "X / Y sets" progress indicator when a `target_sets` value is configured for that exercise. Completing the exact target set triggers a success haptic. Bonus sets beyond the target are tracked separately and shown in the workout finish summary. The finish summary also lists any ad-hoc exercises performed.

### Improvements
- **Notification toggles persisted**: Notification on/off toggles in Settings are now written to SQLite so they survive app restarts. Previously the state was lost on cold start.
- **Settings lock message updated**: The "locked" explanation text in Settings has been revised for clarity.

### Bug Fixes
- **Double rest-timer notification**: Fixed a race condition in `restTimerContext.tsx` and `notifications.ts` that caused two rest-done notifications to fire on the same rest period. The previous notification is now cancelled before scheduling a new one.
- **Abandoned workout cleanup**: When an `activeWorkoutId` points to a workout that no longer exists in the DB, the stale setting is now cleared immediately instead of leaving the app in a broken half-active state.
- **Stale query after workout end**: Workout sets query is now invalidated correctly after finishing or cancelling a session, preventing stale data on the next open.
- **Duplicate ad-hoc guard**: `addAdHocExercise` now checks both the ad-hoc list and the scheduled exercise list before adding, preventing the same exercise appearing twice.
- **Set tracking math**: Warmup sets are excluded from the planned/done/bonus set counters so only working sets are counted against targets.
- **FlatList overflow in ExerciseAddModal**: Added `keyboardShouldPersistTaps="handled"` and correct flex constraints to prevent the list being clipped by the keyboard on Android.
- **Redundant cancel call removed**: A duplicate `cancelAllRestNotifications()` call on workout finish was removed.
- **Error logging**: Replaced silent `catch {}` blocks in `log.tsx` settings-load paths with named `catch (err)` to surface errors during debugging.

---

## v0.9.5-beta — 2026-02-26

### Features
- **Exercise goals modal**: Set, view, and delete per-exercise goals directly from log screen exercise cards using the flag icon. Goals integrate with training analysis for progress tracking.

### Improvements
- **Drawer menu cleanup**: Removed duplicate "Backup / Import" entry that redundantly pointed to the same Settings page, streamlining navigation.
- **Console cleanup**: Removed unnecessary console.warn statements from log.tsx for cleaner debugging output.

### Bug Fixes
- **Training intelligence enhancements**: Multiple stability fixes from previous session:
  - Replaced 7 silent `catch {}` blocks with proper console warnings to prevent false green status indicators
  - Added `sessionsInWindow` field to TrainingStatusResult for accurate session counting (replaces approximate `weeksOfData * 2` formula)
  - Filter warmup-only sessions from session count queries to prevent inflation of real training volume
  - Fixed analysisInsights fallthrough logic: flat e1RM + flat RPE now correctly returns plateau plateau instead of false "steady gains"
  - Session count in insight calculations now uses 28-day window instead of full history
  - Date filtering in analysis queries now uses workout date instead of set creation date to avoid midnight boundary mismatches
  - RPE distribution filtering now excludes sub-6 RPE values to prevent data pollution in Light (6-7) bucket
  - Replaced unsafe type override `(theme as any).secondary` with properly typed `theme.warn` in RPE histogram

---

## v1.5.0 — 2026-02-24

### Features
- **Visual overhaul**: Complete UI refresh with enhanced glassmorphism effects and improved visual hierarchy.
- **Onboarding redesign**: 10-step guided introduction with modern layout and skip option.

### Improvements
- **UX polish**:
  - Enhanced focus states and card interactions
  - Better visual feedback for user actions
  - Improved accessibility across all screens
- **Bug audit fixes**: Multiple minor fixes from comprehensive UX review

---

## v1.4.0 — 2026-02-22

### Features
- **Multi-gym support**: Equipment awareness with gym-specific configuration.
- **Gym-specific plates**: Customize plate loading per gym location.
- **Backup/restore enhancements**: Full gym location data persistence.

### Improvements
- **Equipment management**: Better integration of equipment awareness across the app.

---

## v1.3.0 — 2026-02-17

### Bug Fixes
- **PR system**: Heaviest/e1RM checks now read directly from the database instead of React state, preventing false PR banners caused by stale state after tab navigation or re-renders.
- **Volume PR**: Calculated as session-total (sum of all sets per exercise) at workout end, not per-set mid-session. Also reads from DB for comparison.
- **Undo set**: Reloads PR records from DB after deletion instead of wiping all records for the exercise from state.
- **Exercise swap (Alt) reversion**: Selected alternatives now restore in the same render batch as program/day data, preventing intermediate renders with base exercises. Day-change effect blocked during initial load to avoid wiping persisted selections.

### UI Improvements
- **Focus glow**: Active exercise cards show a graduated purple glow effect (3 layered views + iOS accent shadow) instead of a sharp border.
- **Light mode polish**: Reduced glass/border opacity for cleaner appearance. Darkened success/warn/danger colors for better text readability.
- **Drawer**: Inactive items now fully transparent (no borders/backgrounds), reduced visual noise.
- **Consistent layouts**: Body and Achievements tabs now have TopBar inside ScrollView, matching all other tabs.

### Localization
- Program day labels use translated `t("common.day")` instead of hardcoded "Dag" when creating new programs or importing.

### Assets
- Added `gymdash-icon.svg` and `gymdash-icon-foreground.svg` for Play Store icon generation.

---

## v1.2.0 — 2026-02-10

### Features
- **Floating rest timer**: Persistent pill overlay during active workouts, shows rest time for focused exercise. Tap for settings, long-press to start/stop.
- **Card tap-to-focus**: Tap exercise card to focus it, updates floating rest timer pill with correct rest time.
- **Custom exercises from ALT picker**: Create new custom exercises inline (name + equipment), auto-saved as alternative for the base exercise.
- **Plate calculator bar types**: Choose between Olympic (20kg), Women's (15kg), EZ Bar (10kg), Smith (15kg), Trap Bar (25kg) with persisted preference.
- **Volume PR fix**: Volume PRs now calculated based on completed session totals, not per-set.

### Bug Fixes
- Clipboard fix for export text on mobile (expo-clipboard).
- Program import deduplication (replaces existing with same name).

---

## v1.1.0 — 2026-02-05

### Features
- **i18n auto-detection**: Language auto-detected from device locale (Norwegian for nb/no, English otherwise).
- **Weight unit auto-detection**: KG/LBS auto-detected from device region.
- **Per-side exercises**: Unilateral exercises show "each" suffix, volume calculated with x2 multiplier.
- **Skeleton loading**: Animated placeholder cards during tab loading.
- **Background preloading**: Program data preloaded after startup for faster tab switches.

### Improvements
- Per-exercise rest defaults (compound 2:30, isolation 1:15).
- Custom rest presets (add/remove via "+" chip, long-press to delete).
- Exercise swap persists during tab navigation.

---

## v1.0.0 — 2026-02-03

### Features
- **Back impact system**: backImpact rating (red/yellow/green) per exercise with BackImpactDot on all screens.
- **RPE helper**: Long-press RPE field for quick-select scale (6-10 with descriptions).
- **Workout summary modal**: Duration, sets, volume, top e1RM, PR badges shown at workout end.
- **Equipment labels**: Equipment type shown next to exercise names during workouts.
- 184 exercises with alternatives for all (was 163/183).

### Bug Fixes
- Circular import deadlock (db.ts <-> exerciseLibrary.ts).
- expo-file-system v19 legacy API import fix.

---

## v0.9.0-beta — 2026-02-01

### Features
- Flexible day count (1-10 days per program).
- Custom exercises (create/delete with equipment/tags/increment).
- Auto-progression (analyse at workout end, suggest weight increases).
- File-based backup/restore via native share + document picker.
- Progress photos per body measurement.
- Social sharing (workouts, programs, achievements).
- Workout templates (save/load).
- Training periodization (mesocycles, deload weeks).
- Advanced analysis (strength level, body composition, muscle balance radar).
- Notifications & reminders.
- Exercise comparison (side-by-side stacked graphs).
- Goal system (weight/volume/reps goals per exercise).
- KG/LBS weight unit toggle.
- Undo last set (5-sec window with UndoToast).
- Plate calculator for barbell exercises.
- i18n (Norwegian + English) — all 9 screens migrated.
- Patch notes system.
- New logo (stylized dumbbell with purple-to-orange gradient).
- Production build profile.

---

## v0.8.0 — 2026-01-31

### Features
- UI v3 glassmorphism overhaul (AppBackground, glass cards, GradientButton, theme redesign).
- Achievements system (25+ achievements, gallery, tier system, auto-check).
- Rest timer background notifications.
- Exercise alternatives with swap button during workouts.
- Home dashboard, per-workout/set notes, calendar detail view.
- Expanded exercise library (~140+ exercises).
