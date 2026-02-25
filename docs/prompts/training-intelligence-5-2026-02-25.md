# Training Intelligence — Prompt 5 av 8

## Kontekst fra teamet:
- @task-splitter: Task 5 — `src/trainingStatus.ts` (pure computation, no UI). Depends on Task 1 (is_per_side column + composite index in place).
- @architect: Architecture doc Item 7, Sprint 2. Exact SQL queries and 7-step algorithm with 4 weighted factors (35/30/25/10%). Score thresholds: <0.3 green, 0.3-0.6 yellow, >0.6 red.
- @codebase-scanner: `periodization.ts` exports `getPeriodization` (async, reads `periodization_json` from programs table) and `isDeloadWeek(config)`. `getDb()` from `src/db.ts` returns `SQLite.SQLiteDatabase` with `.getAllSync<T>()` and `.getFirstSync<T>()`. `isPerSideExercise(id)` exported from `src/exerciseLibrary.ts` — checks `byId[id]?.isPerSide`. `epley1RM(weight, reps)` from `src/metrics.ts`. Circular import risk: `exerciseLibrary.ts` uses lazy `require("./db")` — `trainingStatus.ts` can import from both safely using normal imports since it never calls `initDb`.
- @gemini-research: Not used.

---

> "Opprett `src/trainingStatus.ts` — ren beregningsmodul for treningsstatus (ingen UI, ingen nye tabeller)
>
> **Kontekst:** Denne modulen er hjertet i Training Intelligence-funksjonen. Den brukes av hjemskjermen og analyseskjermen. Ingen andre filer trenger endringer i dette steget — bare lag filen.
>
> **Steg:**
>
> 1. Opprett ny fil `src/trainingStatus.ts` med dette komplette innholdet:
>
> ```typescript
> // src/trainingStatus.ts — Training status computation (pure, no UI)
> import { getPeriodization, isDeloadWeek } from "./periodization";
> import { ensureDb, getDb, getSettingAsync } from "./db";
> import { isPerSideExercise } from "./exerciseLibrary";
> import { epley1RM } from "./metrics";
>
> // ── Exported types ────────────────────────────────────────────────
>
> export type TrainingStatusLevel =
>   | "green"
>   | "yellow"
>   | "red"
>   | "insufficient_data"
>   | "deload_active";
>
> export type TrendDirection = "up" | "flat" | "down";
>
> export type TrainingStatusFactors = {
>   e1rmTrend: { direction: TrendDirection; pctChange: number } | null;
>   rpeDrift: { direction: "up" | "stable" | "down"; delta: number } | null;
>   volumeTrend: { direction: TrendDirection; pctChange: number } | null;
>   repConsistency: { hitRate: number } | null;
> };
>
> export type TrainingStatusResult = {
>   level: TrainingStatusLevel;
>   score: number;
>   factors: TrainingStatusFactors;
>   weeksOfData: number;
>   topExerciseIds: string[];
>   deloadScheduled: boolean;
> };
>
> // ── Helpers ───────────────────────────────────────────────────────
>
> function isoDateMinus(days: number): string {
>   const d = new Date();
>   d.setDate(d.getDate() - days);
>   return d.toISOString().slice(0, 10);
> }
>
> function avg(nums: number[]): number {
>   if (!nums.length) return 0;
>   return nums.reduce((a, b) => a + b, 0) / nums.length;
> }
>
> function pctChange(earlier: number, later: number): number {
>   if (earlier === 0) return 0;
>   return (later - earlier) / earlier;
> }
>
> // ── Main export ───────────────────────────────────────────────────
>
> export async function computeTrainingStatus(
>   programId: string | null
> ): Promise<TrainingStatusResult> {
>   await ensureDb();
>   const db = getDb();
>
>   const emptyFactors: TrainingStatusFactors = {
>     e1rmTrend: null,
>     rpeDrift: null,
>     volumeTrend: null,
>     repConsistency: null,
>   };
>
>   // ── Step 1: Check periodization ──────────────────────────────────
>   // Resolve programId from settings if not passed
>   let resolvedProgramId = programId;
>   if (!resolvedProgramId) {
>     try {
>       const mode = (await getSettingAsync("programMode")) || "normal";
>       resolvedProgramId = await getSettingAsync(`activeProgramId_${mode}`);
>     } catch {}
>   }
>
>   let deloadScheduled = false;
>   if (resolvedProgramId) {
>     try {
>       const periodization = await getPeriodization(resolvedProgramId);
>       if (periodization && isDeloadWeek(periodization)) {
>         return {
>           level: "deload_active",
>           score: 0,
>           factors: emptyFactors,
>           weeksOfData: 0,
>           topExerciseIds: [],
>           deloadScheduled: true,
>         };
>       }
>       deloadScheduled = !!(periodization?.enabled);
>     } catch {}
>   }
>
>   // ── Step 2: Check data sufficiency ──────────────────────────────
>   const window28 = isoDateMinus(28);
>
>   const sessionCount = (() => {
>     try {
>       const row = db.getFirstSync<{ c: number }>(
>         `SELECT COUNT(DISTINCT w.id) as c
>          FROM workouts w
>          JOIN sets s ON s.workout_id = w.id
>          WHERE w.date >= ?`,
>         [window28]
>       );
>       return row?.c ?? 0;
>     } catch {
>       return 0;
>     }
>   })();
>
>   if (sessionCount < 4) {
>     return {
>       level: "insufficient_data",
>       score: 0,
>       factors: emptyFactors,
>       weeksOfData: Math.floor(sessionCount / 2),
>       topExerciseIds: [],
>       deloadScheduled,
>     };
>   }
>
>   // ── Step 3: Top 3 exercises by set count in 28-day window ────────
>   const topExRows = db.getAllSync<{ exercise_id: string; set_count: number }>(
>     `SELECT s.exercise_id, COUNT(1) as set_count
>      FROM sets s
>      JOIN workouts w ON s.workout_id = w.id
>      WHERE w.date >= ?
>        AND s.exercise_id IS NOT NULL
>        AND s.is_warmup IS NOT 1
>      GROUP BY s.exercise_id
>      ORDER BY set_count DESC
>      LIMIT 3`,
>     [window28]
>   );
>
>   const topExerciseIds = (topExRows ?? []).map((r) => r.exercise_id);
>
>   if (topExerciseIds.length === 0) {
>     return {
>       level: "insufficient_data",
>       score: 0,
>       factors: emptyFactors,
>       weeksOfData: 1,
>       topExerciseIds: [],
>       deloadScheduled,
>     };
>   }
>
>   const window14 = isoDateMinus(14);
>   const placeholders = topExerciseIds.map(() => "?").join(",");
>
>   // ── Step 4: e1RM trend (35%) ─────────────────────────────────────
>   // Best e1RM per workout per exercise — compare early 2w vs recent 2w
>   let e1rmTrendFactor: TrainingStatusFactors["e1rmTrend"] = null;
>   let e1rmScore = 0;
>
>   try {
>     // Early half: window28 to window14
>     const earlyRows = db.getAllSync<{ workout_id: string; weight: number; reps: number }>(
>       `SELECT s.workout_id, s.weight, s.reps
>        FROM sets s
>        JOIN workouts w ON s.workout_id = w.id
>        WHERE w.date >= ? AND w.date < ?
>          AND s.exercise_id IN (${placeholders})
>          AND s.is_warmup IS NOT 1
>          AND s.weight > 0 AND s.reps > 0`,
>       [window28, window14, ...topExerciseIds]
>     );
>
>     // Recent half: window14 to now
>     const recentRows = db.getAllSync<{ workout_id: string; weight: number; reps: number }>(
>       `SELECT s.workout_id, s.weight, s.reps
>        FROM sets s
>        JOIN workouts w ON s.workout_id = w.id
>        WHERE w.date >= ?
>          AND s.exercise_id IN (${placeholders})
>          AND s.is_warmup IS NOT 1
>          AND s.weight > 0 AND s.reps > 0`,
>       [window14, ...topExerciseIds]
>     );
>
>     const bestByWorkout = (rows: typeof earlyRows) => {
>       const map: Record<string, number> = {};
>       for (const r of rows ?? []) {
>         const e = epley1RM(r.weight, r.reps);
>         map[r.workout_id] = Math.max(map[r.workout_id] ?? 0, e);
>       }
>       return Object.values(map);
>     };
>
>     const earlyVals = bestByWorkout(earlyRows);
>     const recentVals = bestByWorkout(recentRows);
>
>     if (earlyVals.length > 0 && recentVals.length > 0) {
>       const earlyAvg = avg(earlyVals);
>       const recentAvg = avg(recentVals);
>       const change = pctChange(earlyAvg, recentAvg);
>       const direction: TrendDirection =
>         change > 0.02 ? "up" : change < -0.02 ? "down" : "flat";
>
>       e1rmTrendFactor = { direction, pctChange: Math.round(change * 1000) / 10 };
>       // Declining e1RM = fatigue signal. Map: down→1.0, flat→0.3, up→0.0
>       e1rmScore = direction === "down" ? 1.0 : direction === "flat" ? 0.3 : 0.0;
>     }
>   } catch {}
>
>   // ── Step 5: RPE drift (30%) ──────────────────────────────────────
>   // Average RPE per weight bucket, early vs recent half
>   let rpeDriftFactor: TrainingStatusFactors["rpeDrift"] = null;
>   let rpeScore = 0;
>
>   try {
>     const earlyRpe = db.getAllSync<{ rpe: number; weight: number; exercise_id: string }>(
>       `SELECT s.rpe, s.weight, s.exercise_id
>        FROM sets s
>        JOIN workouts w ON s.workout_id = w.id
>        WHERE w.date >= ? AND w.date < ?
>          AND s.exercise_id IN (${placeholders})
>          AND s.rpe IS NOT NULL AND s.rpe > 0
>          AND s.is_warmup IS NOT 1`,
>       [window28, window14, ...topExerciseIds]
>     );
>
>     const recentRpe = db.getAllSync<{ rpe: number; weight: number; exercise_id: string }>(
>       `SELECT s.rpe, s.weight, s.exercise_id
>        FROM sets s
>        JOIN workouts w ON s.workout_id = w.id
>        WHERE w.date >= ?
>          AND s.exercise_id IN (${placeholders})
>          AND s.rpe IS NOT NULL AND s.rpe > 0
>          AND s.is_warmup IS NOT 1`,
>       [window14, ...topExerciseIds]
>     );
>
>     if ((earlyRpe?.length ?? 0) >= 2 && (recentRpe?.length ?? 0) >= 2) {
>       const earlyAvgRpe = avg((earlyRpe ?? []).map((r) => r.rpe));
>       const recentAvgRpe = avg((recentRpe ?? []).map((r) => r.rpe));
>       const delta = Math.round((recentAvgRpe - earlyAvgRpe) * 10) / 10;
>       const direction: "up" | "stable" | "down" =
>         delta > 0.3 ? "up" : delta < -0.3 ? "down" : "stable";
>
>       rpeDriftFactor = { direction, delta };
>       // Rising RPE at same weight = fatigue. Map: up→1.0, stable→0.3, down→0.0
>       rpeScore = direction === "up" ? 1.0 : direction === "stable" ? 0.3 : 0.0;
>     }
>   } catch {}
>
>   // ── Step 6: Volume trend (25%) ───────────────────────────────────
>   // Per-side-corrected weekly volume, early 2w vs recent 2w
>   let volumeTrendFactor: TrainingStatusFactors["volumeTrend"] = null;
>   let volumeScore = 0;
>
>   try {
>     const earlyVolRows = db.getAllSync<{ exercise_id: string | null; weight: number; reps: number }>(
>       `SELECT s.exercise_id, s.weight, s.reps
>        FROM sets s
>        JOIN workouts w ON s.workout_id = w.id
>        WHERE w.date >= ? AND w.date < ?
>          AND s.exercise_id IN (${placeholders})
>          AND s.is_warmup IS NOT 1
>          AND s.weight > 0 AND s.reps > 0`,
>       [window28, window14, ...topExerciseIds]
>     );
>
>     const recentVolRows = db.getAllSync<{ exercise_id: string | null; weight: number; reps: number }>(
>       `SELECT s.exercise_id, s.weight, s.reps
>        FROM sets s
>        JOIN workouts w ON s.workout_id = w.id
>        WHERE w.date >= ?
>          AND s.exercise_id IN (${placeholders})
>          AND s.is_warmup IS NOT 1
>          AND s.weight > 0 AND s.reps > 0`,
>       [window14, ...topExerciseIds]
>     );
>
>     const totalVol = (rows: typeof earlyVolRows) =>
>       (rows ?? []).reduce((sum, r) => {
>         const m = isPerSideExercise(r.exercise_id ?? "") ? 2 : 1;
>         return sum + r.weight * r.reps * m;
>       }, 0);
>
>     const earlyVol = totalVol(earlyVolRows);
>     const recentVol = totalVol(recentVolRows);
>
>     if (earlyVol > 0) {
>       const change = pctChange(earlyVol, recentVol);
>       const direction: TrendDirection =
>         change > 0.05 ? "up" : change < -0.05 ? "down" : "flat";
>
>       volumeTrendFactor = { direction, pctChange: Math.round(change * 1000) / 10 };
>       // Dropping volume = potential overtraining. Map: down→0.8, flat→0.3, up→0.0
>       volumeScore = direction === "down" ? 0.8 : direction === "flat" ? 0.3 : 0.0;
>     }
>   } catch {}
>
>   // ── Step 7: Rep consistency (10%) ────────────────────────────────
>   // % of sets hitting target rep range from exercise_targets; skip if no targets
>   let repConsistencyFactor: TrainingStatusFactors["repConsistency"] = null;
>   let repScore = 0;
>   let hasRepTargets = false;
>
>   if (resolvedProgramId && topExerciseIds.length > 0) {
>     try {
>       const targets = db.getAllSync<{ exercise_id: string; rep_min: number; rep_max: number }>(
>         `SELECT exercise_id, rep_min, rep_max
>          FROM exercise_targets
>          WHERE program_id = ?
>            AND exercise_id IN (${placeholders})`,
>         [resolvedProgramId, ...topExerciseIds]
>       );
>
>       if ((targets?.length ?? 0) > 0) {
>         hasRepTargets = true;
>         const targetMap: Record<string, { min: number; max: number }> = {};
>         for (const t of targets ?? []) {
>           targetMap[t.exercise_id] = { min: t.rep_min, max: t.rep_max };
>         }
>
>         const repRows = db.getAllSync<{ exercise_id: string; reps: number }>(
>           `SELECT s.exercise_id, s.reps
>            FROM sets s
>            JOIN workouts w ON s.workout_id = w.id
>            WHERE w.date >= ?
>              AND s.exercise_id IN (${placeholders})
>              AND s.is_warmup IS NOT 1`,
>           [window28, ...topExerciseIds]
>         );
>
>         let hits = 0;
>         let total = 0;
>         for (const r of repRows ?? []) {
>           const target = targetMap[r.exercise_id];
>           if (!target) continue;
>           total++;
>           if (r.reps >= target.min && r.reps <= target.max) hits++;
>         }
>
>         if (total > 0) {
>           const hitRate = hits / total;
>           repConsistencyFactor = { hitRate: Math.round(hitRate * 100) / 100 };
>           // Low hit rate = inconsistency. Map: <50%→1.0, 50-80%→0.5, >80%→0.0
>           repScore = hitRate < 0.5 ? 1.0 : hitRate < 0.8 ? 0.5 : 0.0;
>         }
>       }
>     } catch {}
>   }
>
>   // ── Step 8: Weighted score → level ───────────────────────────────
>   // Weights: e1RM 35%, RPE 30%, Volume 25%, RepConsistency 10%
>   // If rep targets not available, reweight: e1RM 39%, RPE 33%, Volume 28%
>   let score: number;
>   if (hasRepTargets) {
>     score = e1rmScore * 0.35 + rpeScore * 0.30 + volumeScore * 0.25 + repScore * 0.10;
>   } else {
>     const total = 0.35 + 0.30 + 0.25;
>     score =
>       (e1rmScore * 0.35 + rpeScore * 0.30 + volumeScore * 0.25) / total;
>   }
>
>   const level: TrainingStatusLevel =
>     score < 0.3 ? "green" : score <= 0.6 ? "yellow" : "red";
>
>   return {
>     level,
>     score: Math.round(score * 1000) / 1000,
>     factors: {
>       e1rmTrend: e1rmTrendFactor,
>       rpeDrift: rpeDriftFactor,
>       volumeTrend: volumeTrendFactor,
>       repConsistency: repConsistencyFactor,
>     },
>     weeksOfData: Math.min(4, Math.ceil(sessionCount / 2)),
>     topExerciseIds,
>     deloadScheduled,
>   };
> }
> ```
>
> **Mønster å følge:**
> - Se `src/periodization.ts` for hvordan `getPeriodization` og `isDeloadWeek` brukes
> - Se `src/db.ts` linje 641 (`getDb()`) og linje 648 (`ensureDb()`) for korrekt DB-tilgang
> - Se `src/exerciseLibrary.ts` linje 1764 (`isPerSideExercise`) for per-side multiplier
> - Se `src/metrics.ts` for `epley1RM(weight, reps)` signaturen
>
> **Viktig:**
> - Ingen UI, ingen import fra `app/` — kun `src/`-filer
> - Ingen nye DB-tabeller — all lesing fra eksisterende `sets`, `workouts`, `exercise_targets`
> - Cirkulær import-fare er unngått: `trainingStatus.ts` importerer fra `exerciseLibrary.ts` og `db.ts` med normale imports (ikke lazy require) siden denne filen aldri kalles under `initDb()`
> - Ingen `elevation` noe sted (ikke UI i dette steget)
> - `is_warmup IS NOT 1` brukes (ikke `= 0`) fordi NULL skal behandles som ikke-warmup
> - Dersom `programId` er null, hentes aktivt program fra settings slik at komponenten kan kalle `computeTrainingStatus(null)` uten å vite program-ID
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig."
