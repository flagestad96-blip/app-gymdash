# Training Intelligence Architecture
**Feature set:** Per-Side Exercise Fixes, Training Status Indicator, Analysis Rethink
**Date:** 2026-02-25
**Author:** @architect
**Target branch:** experiment/agent-pipeline-gym-locations
**DB version after:** 24 (migrations 23, 24)

---

## 1. Overview

Three connected features forming a single intelligence layer:

1. **Per-Side Exercise Fixes** — Two silent bugs undercount volume for all dumbbell users. Fix data first.
2. **Training Status Indicator** — Multi-factor traffic light (green/yellow/red) from e1RM trend, RPE drift, volume trend, rep consistency over 4-week rolling window. Shared between home and analysis.
3. **Analysis Rethink** — Summary hero card at top, per-exercise insight sentences, actual horizontal bars replacing ListRow in MuscleGroupBars.

---

## 2. Critical Bugs Found

**Bug A — Custom exercises always bilateral.** `isPerSideExercise(id)` checks `byId[id]?.isPerSide` (hardcoded library only). `custom_exercises` has no `is_per_side` column. Custom unilateral exercises undercount volume by 50%.

**Bug B — Home screen volume ignores per-side multiplier entirely.** Week stats query: `SUM(s.weight * s.reps)` with no exercise-level per-side check. All 22 built-in per-side exercises show wrong weekly volume.

**Bug C — `log.perSideHint` i18n key exists but is never rendered.** Defined in `src/i18n/en/log.ts` line 130, appears in no component JSX.

---

## 3. Data Model

### Migration 23 — `is_per_side` on `custom_exercises`

```sql
ALTER TABLE custom_exercises ADD COLUMN is_per_side INTEGER NOT NULL DEFAULT 0;
```

### Migration 24 — Composite index on `workouts(date, id)`

```sql
CREATE INDEX IF NOT EXISTS idx_workouts_date_id ON workouts(date, id);
```

**No new tables for any sprint.** Training status computed on demand from existing tables.

---

## 4. Sprint 1 — Data Foundation (all S complexity)

### Item 1 — Add `is_per_side` to `custom_exercises`

**Files:** `src/db.ts` (migration 23), `src/exerciseLibrary.ts` (CustomExRow type, rowToExerciseDef, createCustomExercise, updateCustomExercise), `src/components/modals/ExerciseSwapModal.tsx` (toggle in create form), `src/backup.ts` (export/import add column)

**Data flow:** DB migration → CustomExRow type gains field → rowToExerciseDef() reads it → isPerSideExercise() works for custom IDs → create/update functions accept flag → UI form exposes toggle.

### Item 2 — Fix home screen volume per-side correction

**File:** `app/(tabs)/index.tsx`

**Solution:** Change week stats SQL to return per-exercise aggregates, apply `isPerSideExercise()` x2 multiplier in JS:
```typescript
const rawRows = db.getAllSync<{ exercise_id: string | null; vol: number }>(
  `SELECT s.exercise_id, COALESCE(SUM(s.weight * s.reps), 0) as vol
   FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
   WHERE w.date >= ? GROUP BY s.exercise_id`, [monday]
);
const correctedVolume = rawRows.reduce((total, row) => {
  const multiplier = isPerSideExercise(row.exercise_id ?? "") ? 2 : 1;
  return total + row.vol * multiplier;
}, 0);
```

### Item 3 — Wire up `log.perSideHint` in ExerciseCard

**File:** `src/components/workout/ExerciseCard.tsx`

Below weight field row in ExerciseHalf:
```tsx
{isPerSideExercise(exId) ? (
  <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 9, marginTop: 1, opacity: 0.7 }}>
    {t("log.perSideHint")}
  </Text>
) : null}
```

### Item 4 — Add "(ea)" to SetEntryRow and PR banners

**Files:** `src/components/workout/SetEntryRow.tsx` (add "(ea)" after weight), `app/(tabs)/log.tsx` (PR banner append "ea" suffix for per-side exercises)

### Item 5 — Composite index on `workouts(date, id)`

**File:** `src/db.ts` — migration 24, plus add to base schema block.

### Item 6 — Week-over-week volume trend arrow

**File:** `app/(tabs)/index.tsx`

Query previous week volume (same per-side-corrected approach as Item 2). Compute % change. Display arrow + percentage next to volume stat.

**i18n:** New keys in `home.ts`:
```
"home.volumeTrend.up": "↑ +{pct}% vs last week"
"home.volumeTrend.down": "↓ {pct}% vs last week"
"home.volumeTrend.flat": "→ Flat vs last week"
```

---

## 5. Sprint 2 — Training Intelligence (M complexity)

### Item 7 — `src/trainingStatus.ts` (new file)

**Exported types:**
```typescript
export type TrainingStatusLevel = "green" | "yellow" | "red" | "insufficient_data" | "deload_active";
export type TrendDirection = "up" | "flat" | "down";
export type TrainingStatusFactors = {
  e1rmTrend: { direction: TrendDirection; pctChange: number } | null;
  rpeDrift: { direction: "up" | "stable" | "down"; delta: number } | null;
  volumeTrend: { direction: TrendDirection; pctChange: number } | null;
  repConsistency: { hitRate: number } | null;
};
export type TrainingStatusResult = {
  level: TrainingStatusLevel;
  score: number;
  factors: TrainingStatusFactors;
  weeksOfData: number;
  topExerciseIds: string[];
  deloadScheduled: boolean;
};
```

**Exported function:** `computeTrainingStatus(programId: string | null): Promise<TrainingStatusResult>`

**Algorithm:**
1. Check periodization first — if deload active, return `"deload_active"` immediately
2. Check data sufficiency — < 4 sessions returns `"insufficient_data"`
3. Identify top 3 exercises by set count in 28-day window
4. **e1RM trend (35%):** Best e1RM per workout for top exercises, compare early 2 weeks vs recent 2 weeks
5. **RPE drift (30%):** Average RPE per weight bucket, early vs recent half
6. **Volume trend (25%):** Per-side-corrected weekly volume, early vs recent average
7. **Rep consistency (10%):** % hitting target rep range (skip if no targets, reweight others)
8. Score < 0.3 = green, 0.3-0.6 = yellow, > 0.6 = red

### Item 8 — Training Status Card on home screen

**New file:** `src/components/TrainingStatusCard.tsx`

**Props:**
```typescript
type TrainingStatusCardProps = {
  result: TrainingStatusResult | null;
  loading: boolean;
  onViewAnalysis: () => void;
  onStartDeload?: () => void;
};
```

**Design:** GlassCard with status indicator dot (8px circle), status label, three factor rows, "View full analysis" link, optional "Start deload week" button (red/yellow only).

**Colors:**
- Green: `theme.success` border + dot
- Yellow: `theme.secondary` orange (#F97316) — not yellow (renders poorly on dark bg)
- Red: `theme.danger` border + FocusGlow pattern
- Insufficient data: `theme.muted`

**Placement:** After week stats, before recent PRs.

**i18n:** ~15 new keys in `home.ts` for status labels, factor labels, CTA text.

### Item 9 — Analysis Summary Hero Card

**File:** `app/(tabs)/analysis.tsx`

Reuse `TrainingStatusCard` at top of analysis screen. Restructure: hero card always visible at top, exercise picker demoted to Section 2. Default state when no exercise selected shows program-wide overview.

### Item 10 — Per-exercise insight sentences

**New file:** `src/analysisInsights.ts`

```typescript
export function generateExerciseInsight(input: {
  e1rmPctChange: number | null;
  rpeDelta: number | null;
  sessionCount: number;
}): { key: string; params?: Record<string, string | number> }
```

**Decision tree:** 7 branches based on e1RM direction × RPE direction. Pure function, no DB calls. Renders as muted italic text below 4-week trend in exercise detail.

**i18n:** 7 insight keys in `analysis.ts`.

---

## 6. Sprint 3 — Actions & Polish

### Item 11 — Deload suggestion one-tap activation

**File:** `app/(tabs)/analysis.tsx`

When status is red/yellow, show "Start deload week" button. Calls existing `toggleManualDeload()` from `periodization.ts`. No changes to periodization.ts needed.

### Item 12 — RPE distribution histogram

**File:** `app/(tabs)/analysis.tsx` (or extracted to `src/components/charts/RpeHistogram.tsx`)

Three horizontal bars: Light (RPE 6-7), Moderate (7.5-8.5), Hard (9+). Percentage fill with faint healthy-range background bands.

### Item 13 — Replace MuscleGroupBars ListRow with actual horizontal bars

**File:** `src/components/charts/MuscleGroupBars.tsx`

Replace `ListRow` render with horizontal fill using `LinearGradient` + `accentGradient`. Data model unchanged. Caller in analysis.tsx needs no changes.

---

## 7. Complexity Estimate

| Item | Description | Complexity | Sprint |
|------|-------------|------------|--------|
| 1 | `is_per_side` on custom_exercises | S | 1 |
| 2 | Home volume per-side correction | S | 1 |
| 3 | Wire `log.perSideHint` | S | 1 |
| 4 | "(ea)" in SetEntryRow + PR banners | S | 1 |
| 5 | Composite index workouts(date, id) | S | 1 |
| 6 | Week-over-week volume trend arrow | S | 1 |
| 7 | `src/trainingStatus.ts` computation | M | 2 |
| 8 | Training Status Card on home screen | M | 2 |
| 9 | Analysis Summary Hero Card | M | 2 |
| 10 | Per-exercise insight sentences | M | 2 |
| 11 | Deload suggestion one-tap | S | 3 |
| 12 | RPE distribution histogram | S-M | 3 |
| 13 | Real horizontal bars in MuscleGroupBars | S | 3 |

Sprint 1: ~1 day | Sprint 2: ~3-4 days | Sprint 3: ~1-1.5 days

---

## 8. Risk Areas

**R1:** Per-side volume correction changes displayed numbers (users may think bug). Consider one-time info chip.
**R2:** "insufficient_data" state for users with < 8 sessions in 4 weeks. Must show coached collecting state.
**R3:** RPE drift needs repeated exercises at similar weights. Falls back to null, reweights other factors.
**R4:** Circular import risk — `trainingStatus.ts` imports from `exerciseLibrary.ts` and `db.ts` (one-directional, safe).
**R5:** `computeTrainingStatus()` may cause visible lag on home screen. Use loading skeleton.
**R6:** `LinearGradient` with percentage width in MuscleGroupBars — test on both platforms.

---

## 9. File Map

**New files:**
- `src/trainingStatus.ts` (Item 7)
- `src/analysisInsights.ts` (Item 10)
- `src/components/TrainingStatusCard.tsx` (Item 8)

**Modified files:**
- `src/db.ts` (Items 1, 5)
- `src/exerciseLibrary.ts` (Item 1)
- `src/backup.ts` (Item 1)
- `src/components/workout/SetEntryRow.tsx` (Item 4)
- `src/components/workout/ExerciseCard.tsx` (Item 3)
- `src/components/modals/ExerciseSwapModal.tsx` (Item 1)
- `src/components/charts/MuscleGroupBars.tsx` (Item 13)
- `app/(tabs)/index.tsx` (Items 2, 6, 8)
- `app/(tabs)/analysis.tsx` (Items 9, 10, 11, 12)
- `app/(tabs)/log.tsx` (Item 4)
- `src/i18n/en/home.ts` + `nb/home.ts` (Items 6, 8)
- `src/i18n/en/analysis.ts` + `nb/analysis.ts` (Items 10, 11, 12)
- `src/i18n/en/common.ts` + `nb/common.ts` (Item 1)
