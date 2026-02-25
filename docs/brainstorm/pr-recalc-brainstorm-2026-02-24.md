# PR Recalculation on Set Edit / Delete — Brainstorm
**Date:** 2026-02-24
**Author:** @creative-director
**For:** @architect, @ux-critic

---

## Context Snapshot

Before ideating, here is what the code actually does today (read from source):

**`src/prEngine.ts`**
- `checkSetPRs()` — called after every set is logged. Reads DB directly (not React state) for heaviest/e1RM.
  Writes `INSERT OR REPLACE` into `pr_records`. Sets a baseline flag for first-ever session.
- `checkSessionVolumePRs()` — called at `endWorkout`. Sums session total per exercise, compares to DB volume PR.

**`app/(tabs)/log.tsx`**
- `saveEditSet()` — UPDATEs the set row in DB, then calls `refreshWorkoutSets()`. Does NOT touch `pr_records`
  or re-run any PR check. This is the gap.
- `deleteSet()` — DELETEs the set row from DB, calls `refreshWorkoutSets()`. Also does NOT touch `pr_records`.
  No undo window, no PR consideration at all.
- `handleUndo()` — DELETEs the set row, DELETEs `pr_records WHERE set_id = ?`, then reloads PR map from DB
  via `loadPrRecords()`. Clears the banner for that exercise. This is the pattern to build on.
- `prBanners` state — per-exercise string, auto-dismissed after 3500 ms. Once gone, it's gone.

**Known gap (from CONTEXT.md):**
> "Edit/slett sett oppdaterer ikke PR-historikk automatisk."

---

## The Core Problem, Stated Simply

When a user edits 100 kg → 80 kg on the set that was their PR, the `pr_records` row still says 100 kg.
The DB is now lying. Future PR checks compare against 100 kg, making a real 95 kg set look like not a PR.
The same happens on delete: the deleted set might be the record-holder, leaving a ghost PR in `pr_records`.

Volume PR is different: it lives entirely in session totals at workout end, so editing a set mid-session
cannot invalidate a volume PR that has not been written yet. The complication is only at workout end.

---

## Ideas

### Tier 1 — Quick Wins (< 1 hour each)

---

#### QW-1: Re-run PR check after saveEditSet (Optimistic Forward Check)

**User story:**
As a gym-goer who just upgraded a set from 80 to 85 kg mid-workout, I want the PR banner to fire
immediately so I feel the win in the moment.

**What it does:**
After `saveEditSet()` writes the UPDATE to the DB, call `checkSetPRs()` on the edited set with its new
weight/reps. If the new values beat the current `pr_records`, update the record and show the banner.
If they do not beat it, do nothing — the old PR stays in place (may still be valid from another set).

**Complexity:** S

---

#### QW-2: Invalidation Guard on saveEditSet (Was-It-The-PR? Check)

**User story:**
As a gym-goer who accidentally logged 150 kg instead of 105 kg and corrected it, I don't want my
all-time bench press record to stay at 150 kg forever.

**What it does:**
When `saveEditSet()` runs, check: is the set being edited currently the `set_id` stored in
`pr_records` for this exercise? If yes AND new values are lower, invalidate the PR record by
deleting it, then re-query all sets for that exercise to find the real current maximum.

**Complexity:** M

---

#### QW-3: Delete Set Triggers Same Invalidation as Undo

**User story:**
As a gym-goer who deletes a set I logged by mistake, I want the PR to be corrected if that set
was the one holding the record.

**What it does:**
Mirror the undo pattern in `deleteSet()`: after deletion, call `recomputePRForExercise`
for the affected exercise, then reload `prRecords` and clear the banner.

**Complexity:** S (once the helper exists)

---

### Tier 2 — Medium Features (1–4 hours)

---

#### MF-1: recomputePRForExercise — Historical Full Scan Helper

A new export in `src/prEngine.ts` that queries all non-warmup sets for an exercise+program,
finds the max heaviest and max e1RM, and writes back to `pr_records`. Foundation for QW-2, QW-3.

**Complexity:** M

**Performance:** ~1,800 rows for 3 years of data = well under 10 ms on indexed SQLite.

---

#### MF-3: Settings — "Repair All PRs" Action

A button in Settings → Data & Rydding that iterates all exercises and calls
`recomputePRForExercise()` for each. Escape hatch for historical ghost PRs.

**Complexity:** M

---

## Edge Case Analysis

### The Undo Window Interaction
Undo already has clean PR handling (DELETE + reload). Safe as-is. After MF-1 lands, undo could
call that instead, but it's a refactor not a bug fix.

### Volume PR Mid-Session
Correctly left alone mid-session. Volume PR is only checked at `endWorkout` from actual DB state,
so any edits made mid-session are automatically reflected.

### Warmup Sets
`recomputePRForExercise` filters `is_warmup = 0`. The live `checkSetPRs()` path needs the caller
to pass `is_warmup` — verify the call site guards this.

### Legacy Sets Without exercise_id
The recompute query uses `exercise_id`. Legacy sets without it will be invisible. Existing known
issue, not introduced by PR recalc.

### Per-Program PR Isolation
`recomputePRForExercise` must take `programId` and scope the query to that program.

---

## Recommended Shortlist (Priority Order)

1. **MF-1 — recomputePRForExercise helper** (M) — Foundation. Build first.
2. **QW-3 — deleteSet triggers recompute** (S) — Most impactful bug fix.
3. **QW-2 — saveEditSet triggers invalidation guard** (M) — Typo-correction scenario.
4. **QW-1 — saveEditSet runs checkSetPRs for forward case** (S) — Under-entry scenario.
5. **MF-3 — Settings "Repair All PRs" action** (M) — Escape hatch for existing users.

**Defer:** Banner retraction (cosmetic), warmup guard (verify first), PR versioning (schema change),
live volume counter (design-heavy), smart edit warning (UX review needed).

---

## Implementation Notes for @architect

**New function in `src/prEngine.ts`:**
```typescript
export async function recomputePRForExercise(
  exerciseId: string,
  programId: string,
): Promise<Partial<Record<PrType, PrRecord>>>
```

**Indexes to verify in `src/db.ts`:**
- `CREATE INDEX IF NOT EXISTS idx_sets_exercise_id ON sets(exercise_id)`
- `CREATE INDEX IF NOT EXISTS idx_workouts_program_id ON workouts(program_id)`

**Call sites to update in `log.tsx`:**
- `saveEditSet()` — after UPDATE + refreshWorkoutSets
- `deleteSet()` — after DELETE + refreshWorkoutSets

**Test file to extend:** `src/__tests__/prEngine.test.ts`
