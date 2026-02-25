# Training Intelligence — Task Plan
**Feature set:** Per-Side Exercise Fixes, Training Status Indicator, Analysis Rethink
**Date:** 2026-02-25
**Architecture plan:** `docs/architecture/training-intelligence-2026-02-25.md`
**DB design:** `docs/architecture/db-migration-2026-02-25.md`
**Target branch:** experiment/agent-pipeline-gym-locations
**Total tasks:** 11

---

## Ordering Rationale

```
Task 1  — DB migrations (23 + 24) + backup.ts + exerciseLibrary.ts types
Task 2  — ExerciseSwapModal toggle UI for is_per_side (depends on Task 1)
Task 3  — Fix home screen volume (per-side correction + week-over-week arrow)
Task 4  — Wire log.perSideHint in ExerciseCard + "(ea)" in SetEntryRow + PR banners
Task 5  — src/trainingStatus.ts (pure computation, no UI) (depends on Task 1)
Task 6  — TrainingStatusCard component (depends on Task 5)
Task 7  — Wire TrainingStatusCard into home screen (depends on Tasks 3 + 6)
Task 8  — Analysis Summary Hero Card (depends on Tasks 6 + 7)
Task 9  — src/analysisInsights.ts + render in analysis (depends on Task 8)
Task 10 — Deload one-tap activation (depends on Tasks 7 + 8)
Task 11 — Sprint 3 visual polish: RPE histogram + MuscleGroupBars real bars
```

Items 3+6 combined: both touch `app/(tabs)/index.tsx` and are small S tasks — combining avoids two sessions on the same file.
Items 11+12+13 from the architecture: Item 11 (deload button) gets Task 10; Items 12+13 (RPE histogram + real bars) are combined as Task 11 because both are visual-only with no shared dependencies and no i18n overlap.

---

## Task 1 — DB migrations 23+24, exerciseLibrary types, backup.ts

**Depends on:** nothing

**Primary goal:** Land both DB migrations and all downstream TypeScript changes so the rest of the pipeline can import `is_per_side` from `CustomExRow`.

**Files modified:**
- `src/db.ts` — Add migration 23 (`custom_exercises.is_per_side INTEGER NOT NULL DEFAULT 0`) and migration 24 (composite index `idx_workouts_date_id ON workouts(date, id)`). Also add the composite index to the base schema block. Use the existing `hasColumn()` guard pattern for migration 23. Version goes from 22 to 24.
- `src/exerciseLibrary.ts` — Add `is_per_side: number` to `CustomExRow`. Update `rowToExerciseDef()` to map `isPerSide: row.is_per_side === 1`. Update `createCustomExercise()` to accept optional `isPerSide?: boolean` and include it in the INSERT. Update `updateCustomExercise()` similarly.
- `src/backup.ts` — Update `exportFullBackup()` SELECT for `custom_exercises` to include `is_per_side`. Update `importBackup()` INSERT for `custom_exercises` to 9 columns, passing `ce.is_per_side ?? 0` as the 8th value (before `created_at`).

**i18n changes:** None.

**Needs patterns from:** @codebase-scanner — scan `src/db.ts` for the existing migration block structure and `hasColumn()` usage pattern; scan `src/exerciseLibrary.ts` for `CustomExRow`, `rowToExerciseDef`, `createCustomExercise`, `updateCustomExercise` signatures; scan `src/backup.ts` for the current `custom_exercises` SELECT and INSERT strings.

**Verify:** `npm run verify` passes. `tsc --noEmit` passes. Check that `CustomExRow` is exported with `is_per_side` and that `isPerSideExercise()` still resolves correctly for both library and custom IDs.

---

## Task 2 — is_per_side toggle in ExerciseSwapModal create form

**Depends on:** Task 1 (needs `isPerSide` accepted by `createCustomExercise`)

**Primary goal:** Expose the `is_per_side` flag in the inline "Create new exercise" form inside `ExerciseSwapModal` so users can mark a new custom exercise as per-side at creation time.

**Files modified:**
- `src/components/modals/ExerciseSwapModal.tsx` — In the inline create-exercise form, add a boolean toggle row (label: `t("common.perSide")`) that maps to `isPerSide`. Pass the value to `createCustomExercise()`. Follow the existing toggle/switch pattern used elsewhere in the form.
- `src/i18n/en/common.ts` — Add `"common.perSide": "Per side (unilateral)"`.
- `src/i18n/nb/common.ts` — Add `"common.perSide": "Per side (unilateral)"` (Norwegian TBD — use same English string as placeholder; architect note says Norwegian is maintained in parallel).
- `src/i18n/merge.ts` — Bump `EXPECTED_MIN_KEYS` from `586` to `587`.

**i18n changes:** +1 key (`common.perSide`).

**Needs patterns from:** @codebase-scanner — scan `src/components/modals/ExerciseSwapModal.tsx` for the inline create-exercise form structure, existing toggle/Switch pattern, and how `createCustomExercise` is currently called.

**Verify:** `npm run verify` passes. Visually: the create-exercise form in ExerciseSwapModal shows a toggle for "Per side". Creating a custom exercise with it ON and checking `custom_exercises` in DB shows `is_per_side = 1`.

---

## Task 3 — Fix home screen volume (per-side correction) + week-over-week trend arrow

**Depends on:** Task 1 (needs `isPerSideExercise()` to work for custom IDs)

**Primary goal:** Fix the silent volume undercounting bug on the home screen and add the week-over-week trend arrow immediately below the volume stat.

**Files modified:**
- `app/(tabs)/index.tsx` — Replace the existing single-number week stats SQL (`SUM(s.weight * s.reps)`) with a per-exercise aggregate query. Apply `isPerSideExercise(row.exercise_id ?? "") ? 2 : 1` multiplier in JS. Add a second identical query scoped to the previous calendar week (Monday-to-Sunday). Compute `pctChange = ((thisWeek - lastWeek) / lastWeek) * 100`. Render the trend line using the new `home.volumeTrend.*` i18n keys below the volume stat.
- `src/i18n/en/home.ts` — Add 3 keys:
  - `"home.volumeTrend.up": "↑ +{pct}% vs last week"`
  - `"home.volumeTrend.down": "↓ {pct}% vs last week"`
  - `"home.volumeTrend.flat": "→ Flat vs last week"`
- `src/i18n/nb/home.ts` — Add matching 3 Norwegian keys (same arrow format, Norwegian phrasing).
- `src/i18n/merge.ts` — Bump `EXPECTED_MIN_KEYS` from `587` to `590`.

**i18n changes:** +3 keys (`home.volumeTrend.up`, `home.volumeTrend.down`, `home.volumeTrend.flat`).

**Needs patterns from:** @codebase-scanner — scan `app/(tabs)/index.tsx` for the current week stats query, the SQL shape, Monday calculation logic, and where the volume stat is rendered; scan `src/i18n/en/home.ts` for the current key list and file end to append correctly.

**Verify:** `npm run verify` passes. Home screen volume figure changes (because it now applies x2 multiplier for per-side exercises). Trend arrow renders correctly for up/down/flat cases (can be tested by checking last week had a workout vs not).

---

## Task 4 — Wire log.perSideHint in ExerciseCard + "(ea)" in SetEntryRow and PR banners

**Depends on:** Task 1 (needs `isPerSideExercise()` custom ID support)

**Primary goal:** Render the three silent per-side UX elements that already exist in logic or i18n but are never shown.

**Files modified:**
- `src/components/workout/ExerciseCard.tsx` — Below the weight field row in the `ExerciseHalf` sub-component (or equivalent), add a conditional `<Text>` that renders `t("log.perSideHint")` when `isPerSideExercise(exId)` is true. Use `theme.muted` color, `theme.mono` font, `fontSize: 9`, `opacity: 0.7`. The i18n key already exists (`"log.perSideHint": "Volume doubled (per side)"`), so no new key needed.
- `src/components/workout/SetEntryRow.tsx` — After the weight display, append `" (ea)"` (using existing `"log.each"` key via `t("log.each")`) when `isPerSideExercise(exerciseId)` is true. The key already exists.
- `app/(tabs)/log.tsx` — In the PR banner render logic, append `" (ea)"` suffix to the weight string in `newHeaviest` and `newE1rm` banner messages when the exercise is per-side. Use the existing `"log.each"` key.

**i18n changes:** None (all keys already exist: `log.perSideHint`, `log.each`).

**Needs patterns from:** @codebase-scanner — scan `src/components/workout/ExerciseCard.tsx` for `ExerciseHalf` structure and where the weight field row is rendered; scan `src/components/workout/SetEntryRow.tsx` for where weight is displayed; scan `app/(tabs)/log.tsx` for the PR banner render pattern (`log.newHeaviest`, `log.newE1rm`).

**Verify:** `npm run verify` passes. During a workout with a per-side exercise (e.g., Dumbbell Curl), ExerciseCard shows "Volume doubled (per side)" hint, SetEntryRow weight shows "(ea)" suffix, and PR banners say "(ea)" after the weight.

---

## Task 5 — src/trainingStatus.ts (pure computation module)

**Depends on:** Task 1 (needs `isPerSideExercise()` for per-side-corrected volume trend; needs composite index from migration 24 to be in schema)

**Primary goal:** Create the standalone `src/trainingStatus.ts` module. No UI. No new DB tables. Pure computation from existing SQLite data.

**Files created:**
- `src/trainingStatus.ts` — Export the following:
  - Types: `TrainingStatusLevel`, `TrendDirection`, `TrainingStatusFactors`, `TrainingStatusResult` (exact shapes from architecture doc section 5, Item 7).
  - Function: `computeTrainingStatus(programId: string | null): Promise<TrainingStatusResult>`.
  - Algorithm (7 steps from architecture doc):
    1. Check periodization — import `getPeriodizationState` (or equivalent) from `src/periodization.ts`. If deload active, return `{ level: "deload_active", ... }`.
    2. Check data sufficiency — count sessions in 28-day window. If < 4, return `{ level: "insufficient_data", ... }`.
    3. Identify top 3 exercises by set count in 28-day window.
    4. e1RM trend (35%): best e1RM per workout per top exercise, compare early 2 weeks vs recent 2 weeks.
    5. RPE drift (30%): average RPE per weight bucket per exercise, early vs recent half.
    6. Volume trend (25%): per-side-corrected weekly volume, early 2 weeks vs recent 2 weeks average.
    7. Rep consistency (10%): % of sets hitting target rep range from `exercise_targets`; skip factor and reweight others if no targets exist.
    8. Compute weighted score. Map to `green` (<0.3), `yellow` (0.3-0.6), `red` (>0.6).
  - All DB reads use `db.getAllSync` / `db.getFirstSync` from the existing `db` singleton (import from `src/db.ts`).
  - Do NOT import from `app/` — one-directional only.

**i18n changes:** None.

**Needs patterns from:** @codebase-scanner — scan `src/periodization.ts` for the exported function/object that exposes current deload state; scan `src/db.ts` for how the db singleton is exported and how `getAllSync`/`getFirstSync` are used in other utility files; scan `src/exerciseLibrary.ts` for how `isPerSideExercise()` is exported (to import correctly without circular dependency risk).

**Verify:** `npm run verify` passes. `tsc --noEmit` passes with no circular import errors. The function is importable from a test or a screen without causing db initialization side effects.

---

## Task 6 — TrainingStatusCard component

**Depends on:** Task 5 (needs `TrainingStatusResult` type)

**Primary goal:** Build the reusable `TrainingStatusCard` component. Not wired into any screen yet — just the component file.

**Files created:**
- `src/components/TrainingStatusCard.tsx` — Props as specified:
  ```
  type TrainingStatusCardProps = {
    result: TrainingStatusResult | null;
    loading: boolean;
    onViewAnalysis: () => void;
    onStartDeload?: () => void;
  };
  ```
  Layout: `GlassCard` from `src/ui/modern.tsx`. Top row: 8px status dot + status label text. Three factor rows below (e1RM trend, RPE drift, volume trend — each showing direction and value). "View full analysis" link (calls `onViewAnalysis`). Optional "Start deload week" button shown only for `red` and `yellow` levels (calls `onStartDeload`). Loading state: render a `Skeleton` placeholder (import from `src/components/Skeleton.tsx`). Insufficient data state: muted text coaching message using `t("home.status.insufficientData")`.
  Colors:
  - `green`: `theme.success` for dot + border
  - `yellow`: `#F97316` (orange, `theme.secondary`) for dot + border — NOT yellow
  - `red`: `theme.danger` for dot + border
  - `insufficient_data` / `deload_active`: `theme.muted`
  - No `elevation` on any element (Android rule from CONTEXT.md).
- `src/i18n/en/home.ts` — Add ~15 keys:
  - `"home.status.green": "On track"`
  - `"home.status.yellow": "Monitor closely"`
  - `"home.status.red": "Signs of fatigue"`
  - `"home.status.insufficientData": "Collecting data..."`
  - `"home.status.deloadActive": "Deload week active"`
  - `"home.status.e1rmTrend": "Strength trend"`
  - `"home.status.rpeDrift": "Effort trend"`
  - `"home.status.volumeTrend": "Volume trend"`
  - `"home.status.repConsistency": "Rep consistency"`
  - `"home.status.trendUp": "Improving"`
  - `"home.status.trendDown": "Declining"`
  - `"home.status.trendFlat": "Stable"`
  - `"home.status.viewAnalysis": "View full analysis"`
  - `"home.status.startDeload": "Start deload week"`
  - `"home.status.collectingHint": "Log {n} more sessions for training insights"`
- `src/i18n/nb/home.ts` — Add matching 15 Norwegian keys.
- `src/i18n/merge.ts` — Bump `EXPECTED_MIN_KEYS` from `590` to `605`.

**i18n changes:** +15 keys (all `home.status.*`).

**Needs patterns from:** @codebase-scanner — scan `src/ui/modern.tsx` for `GlassCard` props and usage pattern; scan `src/components/Skeleton.tsx` for how skeleton placeholders are rendered; scan existing card components (e.g., `src/components/workout/ExerciseCard.tsx`) for how `theme` tokens are applied without `elevation`.

**Verify:** `npm run verify` passes. Component renders without errors in isolation. Confirm no `elevation` style properties are present.

---

## Task 7 — Wire TrainingStatusCard into home screen

**Depends on:** Tasks 3 and 6 (Task 3 for updated index.tsx structure; Task 6 for the card component)

**Primary goal:** Call `computeTrainingStatus()` on the home screen and render the `TrainingStatusCard` between the week stats section and the recent PRs section.

**Files modified:**
- `app/(tabs)/index.tsx` — Add a `useEffect` that calls `computeTrainingStatus(activeProgramId)` on mount (and when program changes). Store result in local state (`trainingStatus`, `trainingStatusLoading`). Render `<TrainingStatusCard>` after the week stats block and before the recent PRs block. Wire `onViewAnalysis` to navigate to `/(tabs)/analysis`. Wire `onStartDeload` to call `toggleManualDeload()` from `src/periodization.ts` and then refresh the status. Use a loading skeleton while `trainingStatusLoading` is true.

**i18n changes:** None (all keys added in Task 6).

**Needs patterns from:** @codebase-scanner — scan `app/(tabs)/index.tsx` for the current screen structure (week stats section position, recent PRs section, active program ID access, navigation pattern to analysis tab); scan `src/periodization.ts` for `toggleManualDeload()` export signature.

**Verify:** `npm run verify` passes. Home screen shows the training status card between week stats and recent PRs. Loading skeleton appears briefly on first load. Tapping "View full analysis" navigates to the analysis tab.

---

## Task 8 — Analysis Summary Hero Card (reuse TrainingStatusCard at top)

**Depends on:** Task 7 (TrainingStatusCard is wired and tested in home; status computation confirmed working)

**Primary goal:** Restructure the analysis screen to show the training status card as a hero section at the top. Default view (no exercise selected) shows program-wide overview using the existing `computeTrainingStatus()` result.

**Files modified:**
- `app/(tabs)/analysis.tsx` — Import and render `<TrainingStatusCard>` at the top of the screen (above the exercise picker). Reuse the same `computeTrainingStatus()` call (accept the result from a shared hook or call again — keep it simple, on-demand computation is fast per the DB design doc). The "Choose exercise" picker is demoted to Section 2 with a label. When no exercise is selected, the hero card shows program-wide status. `onViewAnalysis` prop can be a no-op or scroll-to-detail since we are already on analysis. `onStartDeload` wired to `toggleManualDeload()`.
- `src/i18n/en/analysis.ts` — Add 2 keys:
  - `"analysis.overview": "Program Overview"`
  - `"analysis.exerciseDetail": "Exercise Detail"`
- `src/i18n/nb/analysis.ts` — Add matching 2 Norwegian keys.
- `src/i18n/merge.ts` — Bump `EXPECTED_MIN_KEYS` from `605` to `607`.

**i18n changes:** +2 keys (`analysis.overview`, `analysis.exerciseDetail`).

**Needs patterns from:** @codebase-scanner — scan `app/(tabs)/analysis.tsx` for the current top-of-screen structure, exercise picker position, and how `activeProgramId` is accessed; scan for how `toggleManualDeload` is or could be imported.

**Verify:** `npm run verify` passes. Analysis screen shows the training status hero card at the top before the exercise picker. The exercise picker section is clearly labelled "Exercise Detail". Tapping "Start deload week" triggers the deload without crashing.

---

## Task 9 — src/analysisInsights.ts + per-exercise insight sentences in analysis

**Depends on:** Task 8 (analysis screen restructured; exercise detail section is clearly defined)

**Primary goal:** Create the pure `generateExerciseInsight()` function and render the resulting sentence below the 4-week trend in exercise detail on the analysis screen.

**Files created:**
- `src/analysisInsights.ts` — Export:
  ```
  export function generateExerciseInsight(input: {
    e1rmPctChange: number | null;
    rpeDelta: number | null;
    sessionCount: number;
  }): { key: string; params?: Record<string, string | number> }
  ```
  7-branch decision tree (e1RM direction × RPE direction, as described in architecture Item 10). Pure function, no DB calls, no imports from `db.ts`.

**Files modified:**
- `app/(tabs)/analysis.tsx` — In the exercise detail section (below the 4-week trend row), call `generateExerciseInsight()` with the already-computed `e1rmPctChange` and `rpeDelta` values. Render the result as muted italic text: `t(insight.key, insight.params)`. Only render when `sessionCount >= 2`.
- `src/i18n/en/analysis.ts` — Add 7 insight keys:
  - `"analysis.insight.strongAndEasy": "Strength is up and effort is down — you're adapting well."`
  - `"analysis.insight.strongButHarder": "Strength is up but RPE is rising — monitor fatigue."`
  - `"analysis.insight.strongStableRpe": "Steady strength gains with consistent effort — keep going."`
  - `"analysis.insight.flatButEasier": "Strength is plateauing but getting easier — ready to push harder."`
  - `"analysis.insight.flatAndHard": "Strength plateau with rising effort — consider a deload."`
  - `"analysis.insight.decliningFatigued": "Strength and effort both declining — rest may be needed."`
  - `"analysis.insight.notEnoughData": "Log {n} more sessions to see insights."`
- `src/i18n/nb/analysis.ts` — Add matching 7 Norwegian keys.
- `src/i18n/merge.ts` — Bump `EXPECTED_MIN_KEYS` from `607` to `614`.

**i18n changes:** +7 keys (all `analysis.insight.*`).

**Needs patterns from:** @codebase-scanner — scan `app/(tabs)/analysis.tsx` for where the 4-week trend row is rendered and what `e1rmPctChange`/`rpeDelta` values are already computed or available; scan `src/i18n/en/analysis.ts` for the current file end to append correctly.

**Verify:** `npm run verify` passes. In analysis, selecting an exercise with 2+ sessions shows a muted italic insight sentence below the trend. Selecting an exercise with 0-1 sessions shows the "not enough data" variant.

---

## Task 10 — Deload one-tap activation (Sprint 3, Item 11)

**Depends on:** Tasks 7 and 8 (deload button exists in TrainingStatusCard but may need polish; analysis screen is restructured)

**Primary goal:** Ensure the "Start deload week" one-tap action is fully wired and provides feedback. The `TrainingStatusCard` already has the button from Task 6 and Task 7 wires it — this task adds the confirmation feedback and ensures the status card refreshes after activation.

**Files modified:**
- `app/(tabs)/index.tsx` — After `toggleManualDeload()` succeeds, re-call `computeTrainingStatus()` and update `trainingStatus` state so the card immediately reflects `deload_active`. Add a brief success toast (use existing `Toast` from `src/ui/modern.tsx`) with text `t("home.deloadStarted")`.
- `app/(tabs)/analysis.tsx` — Same pattern: after deload activation, refresh the training status result and show the same toast.
- `src/i18n/en/home.ts` — Add 1 key: `"home.deloadStarted": "Deload week activated"`.
- `src/i18n/nb/home.ts` — Add matching 1 Norwegian key.
- `src/i18n/merge.ts` — Bump `EXPECTED_MIN_KEYS` from `614` to `615`.

**i18n changes:** +1 key (`home.deloadStarted`).

**Needs patterns from:** @codebase-scanner — scan `src/ui/modern.tsx` for `Toast` component props and usage pattern; scan `src/periodization.ts` for `toggleManualDeload()` return value (void or Promise); scan `app/(tabs)/index.tsx` for the current `onStartDeload` handler added in Task 7 to extend it correctly.

**Verify:** `npm run verify` passes. Tapping "Start deload week" on home or analysis screen shows a toast, and the card immediately switches to the `deload_active` state (grey dot, "Deload week active" label).

---

## Task 11 — Sprint 3 visual polish: RPE histogram + MuscleGroupBars real bars

**Depends on:** Task 8 (analysis screen restructured; safe to add new sections)

**Primary goal:** Two visual improvements to the analysis screen. Combined because both are self-contained visual changes with no shared state or i18n overlap.

### Part A — RPE distribution histogram

**Files created or modified:**
- `src/components/charts/RpeHistogram.tsx` (new) — Three horizontal bars: Light (RPE 6-7), Moderate (7.5-8.5), Hard (9+). Each bar is a `View` with percentage-width fill using `theme.success`, `theme.secondary`, `theme.danger` respectively. Faint background band behind each bar showing the "healthy" fill range. Props: `data: { light: number; moderate: number; hard: number }` (percentages 0-100).
- `app/(tabs)/analysis.tsx` — Query RPE distribution from sets in the selected time range. Compute the three buckets. Render `<RpeHistogram>` in the analysis screen below the consistency section. Add section label using `t("analysis.rpeDistribution")`.
- `src/i18n/en/analysis.ts` — Add 4 keys:
  - `"analysis.rpeDistribution": "RPE DISTRIBUTION"`
  - `"analysis.rpeLight": "Light (6–7)"`
  - `"analysis.rpeModerate": "Moderate (7.5–8.5)"`
  - `"analysis.rpeHard": "Hard (9+)"`
- `src/i18n/nb/analysis.ts` — Add matching 4 Norwegian keys.

### Part B — Real horizontal bars in MuscleGroupBars

**Files modified:**
- `src/components/charts/MuscleGroupBars.tsx` — Replace the `ListRow` render with a horizontal fill bar. For each muscle group row: render the muscle group label, then a background `View` (full width, height 8, radius 4, muted background), then an inner `View` (width: `${pct}%`, same height, `LinearGradient` using `accentGradient` from `src/theme.ts`). Data model and caller in `analysis.tsx` are unchanged. Import `LinearGradient` from `expo-linear-gradient` (already a project dependency).

**i18n changes total:** +4 keys (`analysis.rpeDistribution`, `analysis.rpeLight`, `analysis.rpeModerate`, `analysis.rpeHard`).
`src/i18n/merge.ts` — Bump `EXPECTED_MIN_KEYS` from `615` to `619`.

**Needs patterns from:** @codebase-scanner — scan `src/components/charts/MuscleGroupBars.tsx` for current `ListRow` usage and the data shape passed from `analysis.tsx`; scan `src/theme.ts` for `accentGradient` export and how it is used in other components; scan `app/(tabs)/analysis.tsx` for where MuscleGroupBars is rendered and where to insert the RPE histogram section.

**Verify:** `npm run verify` passes. In analysis, muscle group bars are real filled horizontal bars (not ListRow text). RPE distribution shows three colored bars with correct proportions based on logged RPE values.

---

## Dependency Graph

```
Task 1 (DB + types)
  ├── Task 2 (ExerciseSwapModal toggle)         [independent of Task 3+]
  ├── Task 3 (home volume fix + trend arrow)
  │     └── Task 7 (wire card into home)
  │           └── Task 10 (deload feedback)
  ├── Task 4 (log.perSideHint + ea labels)      [independent of Task 3+]
  └── Task 5 (trainingStatus.ts computation)
        └── Task 6 (TrainingStatusCard component)
              └── Task 7 (wire card into home)
                    └── Task 8 (analysis hero card)
                          ├── Task 9 (insight sentences)
                          ├── Task 10 (deload feedback)
                          └── Task 11 (RPE histogram + real bars)
```

Tasks 2 and 4 are fully independent of each other and of Tasks 5-11. They can be parallelized after Task 1.

---

## EXPECTED_MIN_KEYS Progression

| After Task | Keys added | New EXPECTED_MIN_KEYS |
|------------|-----------|----------------------|
| Baseline   | —         | 586                  |
| Task 2     | +1        | 587                  |
| Task 3     | +3        | 590                  |
| Task 4     | +0        | 590                  |
| Task 6     | +15       | 605                  |
| Task 8     | +2        | 607                  |
| Task 9     | +7        | 614                  |
| Task 10    | +1        | 615                  |
| Task 11    | +4        | 619                  |

Note: Tasks 1, 5, and 7 add zero new i18n keys. Task 4 uses only pre-existing keys.

---

## Files Created / Modified Summary

| File | Tasks |
|------|-------|
| `src/db.ts` | Task 1 |
| `src/exerciseLibrary.ts` | Task 1 |
| `src/backup.ts` | Task 1 |
| `src/components/modals/ExerciseSwapModal.tsx` | Task 2 |
| `app/(tabs)/index.tsx` | Tasks 3, 7, 10 |
| `src/components/workout/ExerciseCard.tsx` | Task 4 |
| `src/components/workout/SetEntryRow.tsx` | Task 4 |
| `app/(tabs)/log.tsx` | Task 4 |
| `src/trainingStatus.ts` (new) | Task 5 |
| `src/components/TrainingStatusCard.tsx` (new) | Task 6 |
| `app/(tabs)/analysis.tsx` | Tasks 8, 9, 10, 11 |
| `src/analysisInsights.ts` (new) | Task 9 |
| `src/components/charts/RpeHistogram.tsx` (new) | Task 11 |
| `src/components/charts/MuscleGroupBars.tsx` | Task 11 |
| `src/i18n/en/common.ts` | Task 2 |
| `src/i18n/nb/common.ts` | Task 2 |
| `src/i18n/en/home.ts` | Tasks 3, 6, 10 |
| `src/i18n/nb/home.ts` | Tasks 3, 6, 10 |
| `src/i18n/en/analysis.ts` | Tasks 8, 9, 11 |
| `src/i18n/nb/analysis.ts` | Tasks 8, 9, 11 |
| `src/i18n/merge.ts` | Tasks 2, 3, 6, 8, 9, 10, 11 |
