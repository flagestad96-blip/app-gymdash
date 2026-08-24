# Gymdash Changelog

## v0.14.0-beta — 2026-08-24

### Train smarter
- **Warm-up ramp on the exercise card**: a "Warm-up" expander computes the classic ramp — empty bar ×10 (barbell/trapbar), then 40%×5 / 60%×3 / 80%×1 of today's working weight, rounded to the exercise increment. Each step logs with one tap as a true warmup set (no rest timer, no RPE, excluded from stats — the first UI path that actually writes `is_warmup`). Pure logic in `src/warmupRamp.ts` with tests; steps below the bar weight are impossible by construction.
- **Comeback ramp across sessions** (`progressionEngine.ts`): when a 21+ day gap sits in recent history and the comeback session went fine, the coach bridges half the remaining distance to the pre-gap top per session (min. one increment, capped at the old top) instead of crawling back in normal small steps. Defers to conservative verdicts on grinders (avg RPE ≥ 9) or missed rep ranges; the "Start at X" quick-apply pill covers ramp suggestions too.
- **Live session stats in the ØKT card**: sets done/planned (bonus sets shown as "+N"), volume lifted so far, and a session PR counter — updated on every logged set, computed by the same `summarizeSessionSets()` the end-of-workout summary uses.
- **Muscle balance assessment** (Analysis): the per-group weekly verdict (too little / ok / high vs. 6–10 hard sets, 8–12 for big groups) was computed but never rendered — now shown as colored badges, plus a push/pull ratio line with advice when it skews past 1.5:1.

### Live rest countdown (Android)
- New local Expo module (`modules/rest-countdown`, Kotlin): a silent ongoing notification with the system chronometer counting down to the end of the rest — ticks with the screen locked, repositions on ±15s/+30s, and removes itself (`setTimeoutAfter`) exactly when the "rest done" alert fires. Own IMPORTANCE_LOW channel so it never makes a sound. Degrades to a no-op on iOS/web/Expo Go and in older binaries.

### First-session tips
- Two new one-time hints staggered through the first real workout: the ALT swap (from 3 logged sets) and mid-session superset linking (from 6 sets).

### Fixes
- **Rest notifications arriving late or never**: expo-notifications only uses exact alarms when `canScheduleExactAlarms()` is true, and the app never declared `USE_EXACT_ALARM` — on Android 12+ every scheduled rest alert fell back to an inexact alarm that Doze defers for minutes. The permission is now declared (auto-granted on API 33+; a rest timer is a permitted timer use case).
- **Log screen forgot your exercise on tab switches**: drawer navigation remounts the screen; the pager position is now remembered per day (module memory) and persisted while a workout is active, keyed on anchor keys so superset merges don't shift it. The session PR set moved to the same pattern, fixing PRs vanishing from the finish summary after a mid-workout tab visit.
- **System navigation bar covering bottom content**: the app runs edge-to-edge but no screen reserved the bottom inset — the `Screen` wrapper now includes the bottom safe-area edge on all ten screens.
- **"Set added" toast hidden behind the docked rest bar**: the root-mounted bar always paints above screen content; the toast now lifts above it while a rest runs.
- **Chip rows clipped early**: all seven horizontal chip rows (jump-to, filters, equipment/tags) now bleed to their container's edge instead of cutting off at the inner padding.

## v0.13.0-beta — 2026-08-23

### Supersets on the fly
- **Create supersets mid-workout**: a link button on each exercise card opens a picker to merge 2–3 exercises into a superset round-card; a split button in the superset header reverses it. Groups persist for the active workout and clear on workout end / day change. Pure merge logic in `superset.ts` with Jest coverage.

### Smarter progression coach
- **Detraining awareness** (`src/progressionEngine.ts`): after 14+ days away from an exercise the coach holds the weight; after 21+/42+ days it suggests a concrete −10%/−15% starting weight (rounded to the exercise increment) with a "Start at X" quick-apply pill, plus a welcome-back banner on the Log screen.
- **Insightful advice**: verdicts now read every working set against the rep range plus average RPE (increase / hold on high RPE / build reps / reduce) and detect plateaus across three sessions at the same weight (low RPE → push reps, high RPE → light deload). Every hint explains *why*, with concrete numbers.
- **RPE-gated auto-progression**: no weight increase is suggested when hitting the reps cost avg RPE ≥ 9; suggestions store a structured reason rendered as a localized explanation instead of a cryptic `3x10+ @ 60kg`.

### Automatic backup
- **Backs itself up**: pick a folder once (Android SAF — ideally a cloud-synced one) and the app writes a full JSON backup on launch (max once a day) and right after every completed workout, keeping the 7 newest and pruning only files it created itself. iOS falls back to the app documents folder. Toggle, folder picker and last-run status live in Settings → Backup, and each run stamps `last_backup_at` so the home-screen backup nag quiets down on its own.

### Insight
- **Rep-max estimator**: estimated 3RM/5RM/10RM (Epley) at the top of each exercise's history panel.
- **Weekly back load**: home week-stats now show volume weighted by each exercise's back-impact level (red 1.0 / yellow 0.5 / green 0.15), with a week-over-week trend.
- **Equipment-aware exercise picker**: exercises available at the active gym sort first; the rest are marked "not at this gym" rather than hidden.

### Typography
- **JetBrains Mono retired** app-wide (user request); `theme.mono` now maps to Inter Medium and the font package was uninstalled.

### Fixes
- **Rest notification outside the app**: two root causes — the OS notification permission was only ever requested from the workout-reminder toggles (on Android 13+ that meant every scheduled rest notification was silently dropped), and no Android notification channel existed (on Android 8+ the channel, not the notification, decides sound and heads-up). Permission is now requested at workout start / first timer, and a high-importance `rest-timer` channel with sound and vibration is created.
- **"Set as default" contrast**: solid accent fill with dark text instead of a success-on-green tint that was unreadable on the sunset palette.
- Home "today" volume counted warmup sets while week stats excluded them — the two cards now agree.
- End-of-workout planned/done/bonus stats ignored the C slot of 3-way supersets.
- History "best set" could pick a warmup set; warmups are now excluded from best-set and per-session counts.

## v0.12.0-beta — 2026-06-10

### Docked rest bar
- **Rest timer reworked as a docked bar** (beta-tester feedback: the full-screen overlay "became the whole world"): a slim bottom bar with the countdown + always-visible −15s / skip / +30s, so the screen above stays free to browse upcoming exercises and history between sets. Visible across the whole app while a rest runs.
- **Tap to expand**: the bar opens into a compact control card with a countdown ring, the next exercise, and the quick set-note field — never a full-screen takeover.
- **"Rest done" moment**: when the countdown completes naturally the bar lingers ~2s as a success confirmation before fading out.
- **Stable progress ring**: ±15s/+30s adjustments no longer flash the ring back to full (`startRestTimer` gained a `durationSec` denominator option).
- **Serialized notifications**: rapid time adjustments can no longer race the async cancel/reschedule and leave duplicate rest notifications.
- The Log screen adds bottom clearance while the bar is visible so it never covers the add-exercise / end-workout buttons.

### Workout management
- **Delete workouts & edit workout notes** from history rows, the workout detail screen and the calendar detail modal. Deleting recomputes PRs for affected exercises.
- **Fixed "PRs this session"**: the finish summary listed every exercise's all-time best; now only genuine new records set during the session are shown.
- Removed a dead "View full analysis" link on the analysis tab.

## v0.11.0-beta — 2026-06-03

### Rest timer & set notes
- **Decluttered rest screen**: removed the floating timer pill; the large rest overlay is the single timer surface, and rest settings stay on the Log top-bar gear.
- **Quick set note on the rest screen**: jot a note for the set you just finished while the timer runs (persists immediately so nothing is lost).
- **Next exercise on the rest screen**: shows what's next when you finish an exercise.
- **No timer after the final set**: finishing the workout's last exercise starts no rest timer — there's nothing to rest for.
- Removed the redundant per-set note button (the edit button already covers notes).

### Icon & name
- **Fixed app icon**: regenerated the icon assets from the SVG source (the build was shipping a stray template export with guide lines); added `scripts/render-icons.js`.
- Capitalized the launcher name to "Gymdash".

### Build & release
- **Auto-submit pipeline**: `npm run release:android` builds, submits to the Play closed-testing track, and sets the store "What's new" via the Play Developer API (`scripts/set-release-notes.js`).
- Dropped unused `victory-native`; aligned packages to Expo SDK 54 (`expo doctor` clean).
- Removed deprecated StatusBar props for Android 15 edge-to-edge compliance.

## v0.10.0-beta — 2026-06-02

### Aurora redesign (dark-only)
- **New design system**: deep aurora-night background with animated orbs, white frosted glass cards, Inter / Instrument Serif / JetBrains Mono type.
- **Personalization**: accent palette (Aurora / Violet / Emerald / Sunset) + glass-intensity in Settings, replacing the old light/dark picker (app is now dark-only).
- **Tidier navigation**: drawer grouped into Training / Insights / App with an icon per item.

### Log
- **One exercise at a time**: a focus-mode pager (prev/next + position + jump-to strip) instead of one long scroll.
- **Large between-sets rest timer**: a full-screen rest overlay with countdown ring + −15s / Skip / +30s.

### Fixes
- Category chip text no longer vertically cropped.
- Palette-derived accent tints across all screens (palette switching repaints the whole app).

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
