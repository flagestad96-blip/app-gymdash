# UX Analysis: Per-Side Logging / Training Status / Analysis Redesign
**Date:** 2026-02-25
**Reviewer:** UX Critic (Claude Code)
**App version context:** v1.4.0 (post history screen, rest time tracking, PR engine extraction)
**Scope:** Three feature areas evaluated against real component code, research docs, and five user personas.

---

## Grounding Notes

All findings are tied to specific files:
- Logging input UI: `src/components/workout/ExerciseCard.tsx` (ExerciseHalf component, lines 456-529)
- Set display: `src/components/workout/SetEntryRow.tsx`
- Per-side flag: `src/exerciseLibrary.ts` (`isPerSide?: boolean` on ExerciseDef, line 44)
- PR storage: `src/db.ts` (pr_records table, line 330) and `src/prEngine.ts`
- Sets schema: `src/db.ts` (sets table, lines 251-267) — no left/right columns exist
- e1RM math: `src/metrics.ts` (epley1RM, e1rmEpley — both present)
- Periodization: `src/periodization.ts` (deloadEvery, manualDeload, deloadPercent — all exist)
- Home i18n: `src/i18n/en/home.ts` — no training status keys exist yet
- Analysis i18n: `src/i18n/en/analysis.ts` — trend/comparison keys exist, no deload/status keys
- Log i18n: `src/i18n/en/log.ts` — `"log.each"`, `"log.perSideHint"` exist (lines 129-130)
- Chart: `src/components/charts/LineChart.tsx` — tap-to-tooltip on data points
- Muscle bars: `src/components/charts/MuscleGroupBars.tsx` — ListRow-based, no bars rendered

---

## FEATURE 1: Per-Side Exercise Input UX

### Current State

`ExerciseCard.tsx` line 465:
```ts
suffix={prefix ? undefined : (isPerSideExercise(exId) ? `${wu.unitLabel()} each` : wu.unitLabel())}
```

The weight field shows "kg each" or "lb each" as a suffix for exercises marked `isPerSide: true` in `exerciseLibrary.ts`. Volume is doubled silently in `prEngine.ts`. There is a single weight input. There are no left/right fields anywhere in the schema (`src/db.ts` sets table has no `left_weight` or `right_weight` columns).

The i18n string `"log.perSideHint": "Volume doubled (per side)"` exists but is not rendered in `ExerciseCard.tsx` or `SetEntryRow.tsx` — it is a key that exists but appears unused.

### What Works Now

- The suffix "kg each" communicates the per-side concept at the point of input
- `isPerSide` is a static flag on the exercise definition — clean, no runtime ambiguity
- PR engine accounts for per-side doubling at the volume level (confirmed in `prEngine.ts`)
- The "Use last" button pre-fills the last weight, removing cognitive load for symmetric sessions

### What Is Confusing or Missing

**Issue 1 — "each" is invisible at rest** PRIORITY: Must-have

The suffix only appears inside the active weight text field. In `SetEntryRow.tsx`, the logged set displays `formatWeight(wu.toDisplay(s.weight))` — raw value, no "each" indicator. A user who logs 20kg for a dumbbell curl sees "20.0" in the set list, not "20.0 each". They have no confirmation that the volume was doubled.

Specific fix: In `SetEntryRow.tsx`, after the weight Text element (line 72), check `isPerSideExercise(s.exercise_id)` and append a small muted "(ea)" tag inline.

**Issue 2 — Volume doubling is never surfaced** PRIORITY: Must-have

After adding a set, there is no confirmation that the volume math was doubled. A user logging three sets of 20kg x 8 reps sees no indication their session volume was 3840kg, not 1920kg.

Specific fix: In `ExerciseHalf`, below the set table, for per-side exercises show a single muted line: "Volume shown as per-arm. Total load = 2x."

**Issue 3 — The perSideHint i18n key exists but is not rendered** PRIORITY: Must-have

`"log.perSideHint": "Volume doubled (per side)"` is defined in `src/i18n/en/log.ts` (line 130) and the Norwegian equivalent exists too. This string is ready but is not rendered anywhere visible.

Specific fix: In `ExerciseHalf`, immediately below the weight field row (after line 529 in ExerciseCard.tsx), add:
```tsx
{isPerSideExercise(exId) ? (
  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 9, opacity: 0.7 }}>
    {t("log.perSideHint")}
  </Text>
) : null}
```

**Issue 4 — No L/R separate input fields yet** PRIORITY: Nice-to-have (Phase 2)

The research confirms no competitor does this well. Adding L/R fields to the current compact card would require a layout change and schema migration. The "each" clarification (Issues 1-3) covers 90% of users. L/R tracking is meaningful only for post-injury rehab and advanced imbalance tracking — a small minority.

**Issue 5 — PR banners for per-side exercises show ambiguous numbers** PRIORITY: Must-have

When a PR banner fires, it shows "New e1RM PR: 26 kg" but the user logged 26kg per arm. No "per arm" or "each" label. If tracking both dumbbell and barbell exercises, the comparison is meaningless.

Specific fix: Check `isPerSideExercise(exerciseId)` and append "ea" to the weight in the banner string. e.g. "New e1RM PR: 26 kg ea".

**Issue 6 — Lateral raises and symmetric dumbbell exercises** PRIORITY: Nice-to-have

L/R tracking is overkill for exercises like lateral raises where nobody expects an imbalance. Keep L/R as an opt-in per-exercise setting, off by default even for `isPerSide: true` exercises.

### What NOT To Do

- Do not add left/right weight fields as primary input on the exercise card — the three-field row (weight/reps/RPE) already fills horizontal width
- Do not show volume doubling math prominently during logging
- Do not create separate exercise entries per side ("Dumbbell Curl (Left)" / "Dumbbell Curl (Right)") — this is the workaround users hate on competing apps

### Priority Summary

| Issue | Priority | Effort |
|-------|----------|--------|
| Wire up `log.perSideHint` below weight field | Must-have | 10 minutes |
| Show "(ea)" tag in SetEntryRow for logged sets | Must-have | 15 minutes |
| Append "ea" to per-side PR banner weight labels | Must-have | 20 minutes |
| L/R separate input fields (new schema columns) | Nice-to-have | 2-3 days |
| User opt-in per-exercise L/R toggle | Nice-to-have | 1 day |

---

## FEATURE 2: Training Status / Deload Indicator on Home Screen

### Current State

`src/i18n/en/home.ts` has no training status keys. The home screen shows: streak, weekly stats, avg RPE, recent PRs, next workout preview, and backup reminder. There is no traffic light card, no trend indicator, and no deload suggestion anywhere.

`src/periodization.ts` has a fully functional deload system: `deloadEvery`, `deloadPercent`, `manualDeload`, `currentWeek`. But it is an opt-in program setting, not surfaced as a status indicator.

### What Works Now

- Streak and session count are already on the home screen
- RPE is tracked per set — raw data for RPE drift detection exists
- The periodization system already tracks current week and deload schedule
- The PR system records dates, so e1RM history is queryable

### What Is Confusing or Missing

**Issue 1 — No training status signal at all** PRIORITY: Must-have

The home screen has no way to tell a user they should consider a deload, that they are plateauing, or that their recent training is going well. The periodization screen has this knowledge but it is buried in settings.

**Issue 2 — Traffic light colors against the glassmorphism dark background** PRIORITY: Must-have

The app background is `#0D0B1A` deep purple-black. Standard traffic light colors need careful treatment.

Specific fix: Do not use solid-fill colored cards. Instead:
- Green state: subtle accent-colored border with a small circle indicator filled green
- Yellow state: use `theme.secondary` orange (#F97316) border with circle indicator (avoids sick-yellow problem)
- Red state: danger-tinted border with the circle indicator, subtle red glow using FocusGlow pattern

**Issue 3 — "Not enough data yet" for new users** PRIORITY: Must-have

Show the status card from day 1 with a gray/muted "Collecting data" state. Progress text: "Training data: 3 sessions logged / 10 minimum for trend analysis". Threshold: at least 2 weeks with 2+ sessions each, or 8+ sessions total for MVP.

**Issue 4 — Will red scare users away?** PRIORITY: Must-have

Use language that frames fatigue as normal:
- Green: "Building well" (not "Progressing")
- Yellow: "Time to consolidate" (not "Plateau zone")
- Red: "Ready for a deload" (not "Fatigue detected")

Sub-stats should be observations, not alarms: "e1RM held steady 3 weeks", "RPE trending up on Bench Press", "4 weeks since last deload".

**Issue 5 — Deload suggestion vs existing periodization system** PRIORITY: Must-have

If periodization is enabled and a deload week is scheduled, the card should say "Deload week coming up (scheduled)" rather than running the independent trend algorithm. The trend algorithm should only activate for users without programmatic periodization.

**Issue 6 — Overall vs per-exercise status** PRIORITY: Nice-to-have

Show overall status on home screen. Per-exercise trends belong in Analysis. One exception: if RPE drift is the primary signal, name the specific exercise.

**Issue 7 — Card placement in home screen hierarchy** PRIORITY: Must-have

Place between "this week stats" and "recent PRs". Not the first card — the first thing a returning user needs is what they're doing today.

### What NOT To Do

- Do not use emoji traffic lights — render inconsistently across devices
- Do not auto-program a deload week — always suggest only
- Do not show the deload score (0.0-1.0) — surface the result (green/yellow/red) and reasons
- Do not put the training status card above the today's workout section

### Priority Summary

| Issue | Priority | Effort |
|-------|----------|--------|
| Build status card component with glass styling | Must-have | 2 days |
| Neutral "collecting data" state for new users | Must-have | Half day |
| Reframe copy to avoid alarming language | Must-have | 2 hours |
| Connect card to periodization system | Must-have | 1 day |
| Color system using orange for yellow state | Must-have | Half day |
| Per-exercise breakdown in card (secondary) | Nice-to-have | 1 day |

---

## FEATURE 3: Analysis System Redesign

### Current State

The Analysis screen has: range selector, strength index, volume chart, muscle group hard sets (MuscleGroupBars using ListRow — no actual bars), consistency metric, exercise picker with graph (4 chart modes), period comparison, 4-week trend, strength standards, goals, rest time analysis, radar chart, body composition, muscle balance.

All on one scrolling screen. The chart component (`LineChart.tsx`) is solid with tap-to-tooltip and PR markers. But the muscle group bars are not actual bars — they use `ListRow` which renders text rows with no visual bar indicator.

### What Works Now

- The chart toggle (e1RM / Volume / Reps PR / Top Set) is a good pattern
- PR markers on chart as orange diamond shapes are a nice touch
- Period comparison is exactly what serious lifters want
- 4-week trend with directional arrows exists
- Strength standards contextualizes absolute numbers

### What Is Confusing or Missing

**Issue 1 — Everything on one screen, no information hierarchy** PRIORITY: Must-have

Specific fix: Two-section structure within the existing screen:

Section 1 — OVERVIEW (always visible at top): Training status traffic light (reuse home screen component), three key numbers, period selector.

Section 2 — DETAILS (scrollable): Exercise graph, period comparison, muscle groups, rest time, body composition, strength standards, goals.

**Issue 2 — Muscle group bars are not bars** PRIORITY: Must-have

`MuscleGroupBars.tsx` uses `ListRow` instead of actual horizontal bar charts. Replace with a simple horizontal-fill View: `width: \`${(count / maxCount) * 100}%\`` using the accent gradient.

**Issue 3 — 4-week trend is not prominent** PRIORITY: Must-have

When an exercise is selected, show the 4-week trend summary as the first element below the exercise name, before the chart. Large arrow icon + percentage change + "4-week trend".

**Issue 4 — No "actionable insight" layer** PRIORITY: Must-have

Below the trend indicator, show one sentence of insight:
- "4-week trend flat, RPE rising — consider a deload this week"
- "Strong progression, +4.2% e1RM — your rep range is working"
- "Volume decreasing past 3 weeks — check if sessions are being skipped"

These are ~10 template strings selected by a decision tree on trend + RPE signal.

**Issue 5 — Exercise-specific vs program-wide wrong default** PRIORITY: Must-have

The Analysis screen defaults to "Choose exercise." Most users want the program-wide view first. Default state should show program-wide overview with no exercise selected. Exercise-specific graph should be a secondary section.

**Issue 6 — RadarChart and strength standards together** PRIORITY: Nice-to-have

Keep strength standards table (more understandable). Move radar chart to collapsed/expandable section.

**Issue 7 — Goals section buried at bottom** PRIORITY: Nice-to-have

Create a "Progress" row near the top showing active goals and completion percentage using `ProgressRing` from `modern.tsx`.

**Issue 8 — Mobile-first scrolling** PRIORITY: Must-have

Strength standards five-column table likely overflows on narrow screens. Replace with a horizontal progress bar per exercise showing position on beginner-to-elite scale.

### What NOT To Do

- Do not add more chart types — four toggles are already enough
- Do not split Analysis into multiple screens with sub-navigation tabs
- Do not show a "Training Stress Score" composite metric users can't understand
- Do not remove the exercise-specific graph — just demote it from primary entry point

### Priority Summary

| Issue | Priority | Effort |
|-------|----------|--------|
| Overview section at top (training status + 3 numbers) | Must-have | 1.5 days |
| Replace ListRow in MuscleGroupBars with actual bars | Must-have | Half day |
| Promote 4-week trend above chart for selected exercise | Must-have | 2 hours |
| Actionable insight sentence below trend indicator | Must-have | Half day |
| Default to program-wide view (no exercise selected) | Must-have | Half day |
| Strength standards as progress bar instead of table | Must-have | 1 day |
| Goals section near top with ProgressRing | Nice-to-have | 1 day |
| Collapse radar chart into expandable section | Nice-to-have | Half day |

---

## Cross-Feature Integration Notes

- **Training status card + Analysis**: Same component reused at home screen summary size and analysis full size.
- **Per-side volume + Analysis**: When per-side corrections land, muscle group volume bars will show correct numbers. Flag this dependency.
- **Periodization + Training status**: If `periodization.enabled === true`, query `currentWeek` and `deloadEvery` before running the trend algorithm.

## Implementation Order Recommendation

1. Wire up `log.perSideHint` below weight field in ExerciseCard.tsx (10 min)
2. Add "(ea)" indicator to SetEntryRow for per-side exercises (15 min)
3. Fix PR banner weight label to include "ea" for per-side (20 min)
4. Replace ListRow with horizontal bars in MuscleGroupBars.tsx (half day)
5. Promote 4-week trend to top position in exercise-specific view (2 hours)
6. Add actionable insight sentence below trend indicator (half day)
7. Default Analysis to program-wide view (half day)
8. Build training status card component (2 days)
9. Connect training status to periodization system (1 day)
10. L/R separate inputs (2-3 days, schema migration, Phase 2 only)

---

*Document written against codebase state at v1.4.0, branch experiment/agent-pipeline-gym-locations.*
