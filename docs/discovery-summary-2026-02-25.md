# Discovery Summary — Per-Side, Training Status, Analysis Rethink
**Date:** 2026-02-25
**Pipeline Phase:** 1 Complete
**Sources:** Scout report, 2 research docs, brainstorm, UX critique

---

## Key Findings

### 1. These Three Features Are One Connected System

The brainstorm and UX critique independently arrived at the same conclusion: these aren't three separate features. They form a single intelligence layer:

```
Per-side data accuracy → Meaningful volume/e1RM signals
                              ↓
                    Training status computation → Home screen traffic light
                              ↓
                    Rethought analysis screen → Explains "why is my status yellow?"
```

**Per-side accuracy must come first** — if custom unilateral exercises undercount volume by 50%, the training status score will be miscalibrated from day one.

### 2. Critical Bug Found: Custom Exercises Can Never Be Per-Side

`isPerSideExercise(id)` only checks the hardcoded library (`byId[id]?.isPerSide`). The `custom_exercises` table has no `is_per_side` column. Any user who created a custom unilateral exercise (Cable Kickback, Single-Arm Lat Pulldown, etc.) has had their volume silently undercounted by 50% since they created it. This affects:
- Home screen weekly volume (no per-side multiplier in the SQL query at all)
- PR engine volume calculations
- Any future training status computation

### 3. Critical Bug Found: Home Screen Volume Ignores Per-Side Multiplier

The week stats query in `index.tsx` uses `SUM(s.weight * s.reps)` with no per-side x2 multiplier. This means **all 22 built-in per-side exercises** also show undercounted volume on the home screen. This is separate from the custom exercise bug — it affects everyone who trains with dumbbells.

### 4. The "each" Suffix Is The Only Per-Side UX — And It's Insufficient

The i18n key `"log.perSideHint": "Volume doubled (per side)"` exists but is **never rendered**. The "(ea)" indicator doesn't appear on logged sets in `SetEntryRow.tsx`. PR banners don't say "per arm." Three quick fixes (under 1 hour total) would dramatically improve clarity.

### 5. Training Status Algorithm: Multi-Factor Weighted Score

Research confirms the traffic light approach with 4-week rolling window. Both agents converged on the same weighting:
- **e1RM trend (35%)** — primary strength signal
- **RPE drift (30%)** — leading indicator of fatigue
- **Volume trend (25%)** — training load direction
- **Rep consistency (10%)** — hitting targets

Score < 0.3 = Green, 0.3-0.6 = Yellow, > 0.6 = Red. All data already exists in SQLite.

### 6. Existing Periodization System Must Be Respected

`periodization.ts` already has `deloadEvery`, `currentWeek`, `manualDeload`. The training status card **must check periodization state first** — if a programmatic deload is already scheduled, don't run the independent trend algorithm or users get conflicting signals.

### 7. Analysis Screen Needs Hierarchy, Not More Data

The analysis screen currently shows everything at equal prominence with no summary layer. Both agents recommend:
- **Default to program-wide overview** (not "Choose exercise")
- **Reuse the training status card** as the hero section at the top of analysis
- **Add per-exercise insight sentences** (decision tree, ~10 template strings, no ML)
- **Replace MuscleGroupBars ListRow with actual horizontal bars** (the component is named "Bars" but renders text)

### 8. L/R Split Logging Should Be Deferred

Research confirms no competitor does this well. The schema migration is significant (`left_weight`, `right_weight` on sets table). The "each" clarification fixes cover 90% of users. L/R tracking serves a small segment (rehab, advanced). Build only after the per-side foundation is solid.

---

## Ideas Worth Pursuing

### Must-Build (Sprint 1 — Data Foundation)
1. Add `is_per_side` to `custom_exercises` table (bug fix)
2. Fix home screen volume to apply per-side x2 multiplier (bug fix)
3. Wire up the existing `log.perSideHint` i18n key (already exists, just not rendered)
4. Add "(ea)" to `SetEntryRow` and PR banners for per-side exercises
5. Add composite index on `workouts(date, id)` (tech debt from CONTEXT.md)
6. Week-over-week volume trend arrow on home screen

### Must-Build (Sprint 2 — Training Intelligence)
7. `src/trainingStatus.ts` — shared computation for home + analysis
8. Training Status Card on home screen (traffic light + 3 sub-factors)
9. Analysis Summary Hero Card (reuses trainingStatus, replaces "Choose exercise" as default)
10. Per-exercise insight sentences (decision tree in `src/analysisInsights.ts`)

### Must-Build (Sprint 3 — Actions)
11. Deload suggestion with one-tap activation (wired into existing periodization.ts)
12. RPE distribution histogram in analysis
13. Replace MuscleGroupBars ListRow with actual horizontal bars

### Defer
- True L/R split weight logging (L complexity, schema migration)
- Data-driven per-exercise deload programming (needs validation first)
- Natural language training narrative (build after insight sentences prove the concept)
- Historical training status timeline (nice but not critical path)

---

## Constraints Discovered

1. **Per-side multiplier can't be done in SQL** — `isPerSideExercise()` is a JavaScript function, not a DB column on the `sets` table. Volume corrections must happen in JS after the query.
2. **No training status keys in i18n yet** — `home.ts` and `analysis.ts` need new keys for all status/trend/deload strings.
3. **`restTimerContext.tsx` has per-side overrides that volume ignores** — `setPerSideOverride()` and `isPerSide()` exist in context but `prEngine.ts` doesn't use them.
4. **Cold start** — training status needs at least 2 weeks / 8+ sessions to be meaningful. Must show a coached "collecting data" state for new users.
5. **Glass card aesthetic** — traffic light colors must work against `#0D0B1A` deep purple-black background. UX critique recommends border + indicator dot (not solid fill) and using existing `theme.secondary` orange instead of yellow.

---

## Recommended Approach

**Build in three sprints, each independently shippable:**

- **Sprint 1** fixes silent data bugs and adds minimal trend visibility. Every item is S complexity. Users immediately see more accurate numbers and a trend arrow.
- **Sprint 2** adds the headline feature (training status card + analysis hero). The computation is shared between home and analysis via `src/trainingStatus.ts`. Both screens get smarter simultaneously.
- **Sprint 3** closes the action loop (deload suggestion) and adds visual polish (RPE histogram, real muscle bars).

This ordering ensures each sprint builds trust in the data before the next sprint adds intelligence on top of it.

---

**Next step:** @architect designs the technical solution using this summary + all Phase 1 docs.
