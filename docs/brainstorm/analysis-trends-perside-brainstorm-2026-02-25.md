# Analysis, Training Trends, and Per-Side Enhancement — Brainstorm
**Date:** 2026-02-25
**Author:** @brainstorm
**For:** @architect, @ux-critic

---

## Context Snapshot

Key findings from direct code reading:

**`src/exerciseLibrary.ts`**
- `isPerSideExercise(id)` only checks `byId[id]?.isPerSide` — the hardcoded library. Custom exercises go through `rowToExerciseDef()` which never reads `is_per_side` because the `custom_exercises` table has no such column. Custom exercises are always treated as bilateral.
- `createCustomExercise()` accepts `isBodyweight` but no `isPerSide` arg.

**`src/prEngine.ts`**
- `checkSetPRs()` uses `prWeight` (raw per-arm value) for both heaviest and e1RM. Volume PR correctly uses `isPerSideExercise(exId) ? 2 : 1` multiplier.
- No gap in per-side PR logic for built-in exercises. The gap is that custom exercises never have `isPerSide = true`, so their volume is undercounted by 50%.

**`app/(tabs)/index.tsx`**
- Week stats query: `SUM(s.weight * s.reps)` — no per-side multiplier. Home screen volume is silently undercounted for all 22 built-in per-side exercises and all custom unilateral exercises.
- No week-over-week trend computation. No e1RM trend. No training status.

**`app/(tabs)/analysis.tsx`**
- 4-week trend exists but only inside the exercise detail section (compares first 14 days vs last 14 days of e1RM). Never surfaced as an overall training status.
- No RPE distribution histogram.
- No actionable deload suggestion UI.

---

## The Interconnection Thesis

These three features form a single intelligence layer:

```
Accurate per-side data  →  Meaningful volume and e1RM signals
         |
         v
Training status computation  →  Home screen traffic light
         |
         v
Rethought analysis screen  →  "Why is my status yellow?" answered
```

**Per-side accuracy is the foundation.** If custom unilateral exercises undercount volume, the training status score will be miscalibrated. Fix the data first.

**Training status is the bridge.** The home screen currently shows a snapshot. Users want a verdict: am I getting stronger, plateauing, or overreaching?

**Analysis is the "why."** The rethought analysis screen becomes the destination from the training status card.

---

## Feature 1: Per-Side Exercise Enhancement

### The Two Distinct Problems

**Problem A (Data integrity — a silent bug):** Custom exercises can never be flagged per-side. Volume undercounted by 50% for custom unilateral exercises.

**Problem B (Advanced tracking):** Some users have genuine L/R asymmetries. 40% of per-side feature requests ask for separate L/R inputs. Valid but smaller user segment.

### Quick Wins

#### QW-1A: Add `is_per_side` to `custom_exercises` table
- DB migration: `ALTER TABLE custom_exercises ADD COLUMN is_per_side INTEGER NOT NULL DEFAULT 0`
- Update `CustomExRow` type, `rowToExerciseDef()`, `createCustomExercise()`
- Add toggle in `ExerciseSwapModal.tsx` inline create form
- **Complexity:** S

#### QW-1B: Fix home screen volume to use per-side multiplier
- `app/(tabs)/index.tsx` week stats query doesn't apply x2
- Fetch `exercise_id` per set and apply `isPerSideExercise()` in JS
- **Complexity:** S

#### QW-1C: "Unilateral" chip label on per-side exercise cards
- Small chip next to equipment label in `ExerciseCard.tsx`
- **Complexity:** S

### Medium Features

#### MF-1: Per-side toggle during workout (session override)
- `restTimerContext.tsx` already has `setPerSideOverride()` and `isPerSide()`
- Gap: `prEngine.ts` and volume calculations don't use these overrides
- Plumb context's per-side state through to volume calculation
- **Complexity:** M

#### MF-2: Per-side volume breakdown in Analysis
- Show "X kg (per arm)" and "X×2 kg (total load)" for per-side exercises
- Volume series chart should always use total load
- **Complexity:** M

#### MF-3: Per-side annotation in PR Cabinet
- Add "(per arm)" or "(ea)" suffix in `achievements.tsx` for per-side exercises
- **Complexity:** S

### Moonshot: True Left/Right Split Weight Logging
- Add `left_weight REAL`, `right_weight REAL` (nullable) to sets table
- Dual-input UI in `SetEntryRow.tsx`
- Asymmetry trending in analysis
- **Complexity:** L — Build only after per-side foundation is solid

---

## Feature 2: Training Status Indicator and Deload Recommendation

### Quick Wins

#### QW-2A: Week-over-week volume trend arrow on home screen
- Add second SQL query for previous week's stats
- Show `↑ +8%` in green or `↓ -5%` in orange next to volume stat
- **Complexity:** S

#### QW-2B: Session frequency context ("3 of usual 4 this week")
- Compute 4-week average session count
- Show as "3/4 sessions" alongside streak
- **Complexity:** S

### Medium Features

#### MF-2A: Training Status Card — multi-factor traffic light

**The computation (from research Tier 2 algorithm):**

```
Training Status Score (0.0 → 1.0, higher = more fatigued):

Factor 1 — e1RM trend (35%):
  - Best e1RM per workout for top 3 exercises
  - Compare first 2 weeks vs last 2 weeks of 4-week window
  - Declining >2%: high. Flat (±1%): medium. Rising: zero.

Factor 2 — RPE drift (30%):
  - Average RPE first 2 weeks vs last 2 weeks
  - Increasing >0.5: high. Stable (±0.3): low. Decreasing: zero.

Factor 3 — Volume trend (25%):
  - Weekly total volume, linear regression slope
  - Declining: high. Flat: medium. Rising: zero.

Factor 4 — Rep consistency (10%):
  - % of sets hitting target rep range
  - Below 80%: contribution. No targets: skip, reweight.

Score → Status:
  < 0.3: Green ("Progressing well")
  0.3–0.6: Yellow ("Plateau zone")
  > 0.6: Red ("Deload recommended")
```

**Display:**
```
THIS WEEK'S TRAINING
● PROGRESSING WELL

Strength    ↑ +2.1%  (e1RM trend)
Volume      ↑ +8%    (vs last week)
Effort      → Stable  (RPE 7.2)

View full analysis →
```

- **Complexity:** M
- New file: `src/trainingStatus.ts`

#### MF-2B: Deload suggestion with one-tap activation
- "Start deload week" button visible only on yellow/red status
- Add `triggerManualDeload(programId)` to `src/periodization.ts`
- Uses existing deload banner in `log.tsx`
- **Complexity:** M

#### MF-2C: Historical training status chart in Analysis
- Weekly timeline of colored dots for past 12 weeks
- Either store per-week in settings or recompute on demand
- **Complexity:** M

### Moonshot: Data-Driven Per-Exercise Deload Programming
- Per-exercise training status scores
- Smart deload targets only fatigued movements
- **Complexity:** L — Requires MF-2A and MF-2B validated first

---

## Feature 3: Analysis System Rethink

### Quick Wins

#### QW-3A: Add composite index on workouts(date, id)
- `src/db.ts` migration: `CREATE INDEX IF NOT EXISTS idx_workouts_date_id ON workouts(date, id);`
- Noted in CONTEXT.md technical debt
- **Complexity:** S

#### QW-3B: RPE Distribution Histogram
- Group sets by RPE bucket, count per bucket
- Horizontal bars labeled "Light (RPE 6-7)", "Moderate (7.5-8.5)", "Hard (9+)"
- Show healthy target ranges as faint background bands
- **Complexity:** S-M

#### QW-3C: Coached empty state for new users
- When fewer than 3 data points: show card explaining what will appear
- "Log 4 sessions with this exercise to see your strength trend here"
- **Complexity:** S

### Medium Features

#### MF-3A: Analysis Summary Hero Card (Layer 0)
- Same training status computation as home screen card (reuse `src/trainingStatus.ts`)
- With more detail: 4 supporting stats
- Target of "View full analysis" link from home screen
- **Complexity:** M

#### MF-3B: Per-exercise insight sentence
- `generateExerciseInsight(stats)` pure function — decision tree, no ML
- Decision tree:
  ```
  e1RM ↑>2%, RPE stable: "Progressing well. Keep your current approach."
  e1RM ↑>2%, RPE rising: "Strength up but working harder. Consider deload after block."
  e1RM flat, RPE stable: "Plateau detected. Try adding 1-2 reps before weight."
  e1RM flat, RPE rising: "Stagnating with rising effort — deload likely due."
  e1RM ↓, RPE rising: "Performance declining. Deload recommended."
  e1RM ↓, RPE stable: "Strength dipped but effort fine — could be a bad week."
  < 3 sessions: "Log 3+ sessions to see a trend here."
  ```
- **Complexity:** M — Highest analysis screen value-add

#### MF-3C: Muscle group training balance over 4 weeks
- Compare current 4-week muscle group volume vs previous 4-week
- Show which muscles grew (arrows) and which shrank
- **Complexity:** M

### Moonshot: Natural Language Training Narrative
- Template-based paragraph summarizing past month — no ML, no API
- Pure JavaScript string templates filled from existing analysis queries
- **Complexity:** L — Build after MF-3B proves the concept

---

## Edge Cases

### Per-side x Training Status
Fix QW-1A before building MF-2A — inaccurate volume corrupts the training status score.

### RPE Drift and Per-Side
RPE drift uses `(exercise_id, weight_bucket, rpe)` — per-side flag doesn't affect RPE values. No special handling needed.

### Deload Week and Status Reset
After deload, the 4-week window includes the low-volume week, pushing score toward green. This is correct behavior.

### Cold Start (< 4 Weeks)
- < 1 week: "Log more sessions to unlock training insights"
- 1-2 weeks: show only volume trend
- 3+ weeks: show all factors with limited-data note
- 4+ weeks: full computation

---

## Recommended Shortlist (Priority Order)

### Sprint 1 — Foundation (data integrity + quick wins)
1. **QW-1A: `is_per_side` for custom exercises** (S)
2. **QW-1B: Fix home screen volume query** (S)
3. **QW-3A: Composite index on workouts(date, id)** (S)
4. **QW-2A: Week-over-week volume trend arrow** (S)
5. **QW-3B: RPE distribution histogram** (S-M)

### Sprint 2 — Training Intelligence
6. **MF-2A: Training Status Card on home screen** (M)
7. **MF-3A: Analysis Summary Hero Card** (M)
8. **MF-3B: Per-exercise insight sentence** (M)

### Sprint 3 — Completion
9. **MF-2B: Deload suggestion with one-tap activation** (M)
10. **MF-1: Per-side workout toggle** (M)
11. **QW-1C: "Unilateral" chip on exercise cards** (S)
12. **MF-3: Per-side annotation in PR Cabinet** (S)

### Defer
- True L/R split logging (L)
- Data-driven per-exercise deload programming (L)
- Natural language training narrative (L)
- Historical training status chart (M)
- Muscle group balance over time (M)
- Session frequency context (S)

---

## Implementation Notes for @architect

### New file: `src/trainingStatus.ts`
```typescript
export type TrainingStatusLevel = "green" | "yellow" | "red" | "insufficient_data";

export type TrainingStatusResult = {
  level: TrainingStatusLevel;
  score: number;
  factors: {
    e1rmTrend: { direction: "up" | "flat" | "down"; pct: number } | null;
    rpeDrift: { direction: "up" | "stable" | "down"; delta: number } | null;
    volumeTrend: { direction: "up" | "flat" | "down"; pct: number } | null;
    repConsistency: { hitRate: number } | null;
  };
  weeksOfData: number;
  topExercises: string[];
};
```

### DB migration for QW-1A
```sql
ALTER TABLE custom_exercises ADD COLUMN is_per_side INTEGER NOT NULL DEFAULT 0;
```

### Files for QW-1A
- `src/db.ts` — migration
- `src/exerciseLibrary.ts` — `CustomExRow`, `rowToExerciseDef()`, `createCustomExercise()`, `updateCustomExercise()`
- `src/components/modals/ExerciseSwapModal.tsx` — toggle in create form

---

*Document written against codebase state at v1.4.0, branch experiment/agent-pipeline-gym-locations.*
