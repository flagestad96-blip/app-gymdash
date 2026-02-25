# Training Intelligence — Prompt 3 av 4

## Kontekst fra teamet:
- @architect: `docs/architecture/training-intelligence-2026-02-25.md` — Item 2: fix home screen `SUM(s.weight * s.reps)` with per-exercise aggregate + JS multiplier; Item 6: add week-over-week trend arrow
- @codebase-scanner: `app/(tabs)/index.tsx` — week stats query at lines 108-127; `getMonday()` at lines 40-46; volume rendered via `StatBadge` at line 381 `wu.formatWeight(weekStats.volume)`; weekly stats `Card` block at lines 374-391. `src/i18n/en/home.ts` lines 1-30 (append after `"home.lastBackup"`). `src/i18n/nb/home.ts` same structure.
- @task-plan: Task 3 — depends on Task 1 (needs `isPerSideExercise()` to work for custom exercise IDs after `is_per_side` is in DB and cache).

---

> "Fix the home screen volume undercounting bug (per-side x2 multiplier) and add a week-over-week trend arrow below the volume stat.
>
> **Kontekst:** The week stats query at line 109 in `app/(tabs)/index.tsx` uses a single `SUM(s.weight * s.reps)` which ignores the per-side multiplier entirely — all 22+ built-in dumbbell exercises undercount volume. This task fixes the SQL to return per-exercise aggregates and applies a x2 multiplier in JS using `isPerSideExercise()`. It also queries the previous calendar week to render a trend arrow.
>
> **Steg:**
>
> 1. Add `isPerSideExercise` import — `app/(tabs)/index.tsx`
>    - Find the import from `exerciseLibrary` at line 13:
>    ```typescript
>    import { displayNameFor } from "../../src/exerciseLibrary";
>    ```
>    - Add `isPerSideExercise` to the import:
>    ```typescript
>    import { displayNameFor, isPerSideExercise } from "../../src/exerciseLibrary";
>    ```
>
> 2. Add `getPrevMonday()` helper — `app/(tabs)/index.tsx`
>    - Find the existing `getMonday()` function at lines 40-46:
>    ```typescript
>    function getMonday(): string {
>      const d = new Date();
>      const day = d.getDay();
>      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
>      const mon = new Date(d.setDate(diff));
>      return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
>    }
>    ```
>    - Add a second function immediately after it:
>    ```typescript
>    function getPrevMonday(): string {
>      const d = new Date();
>      const day = d.getDay();
>      const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
>      const mon = new Date(d.setDate(diff));
>      return `${mon.getFullYear()}-${String(mon.getMonth() + 1).padStart(2, "0")}-${String(mon.getDate()).padStart(2, "0")}`;
>    }
>    ```
>
> 3. Add `volumeTrend` state — `app/(tabs)/index.tsx`
>    - Find the state declarations around line 63:
>    ```typescript
>    const [weekStats, setWeekStats] = useState({ days: 0, sets: 0, volume: 0, avgRpe: null as number | null });
>    ```
>    - Add a new state variable on the next line:
>    ```typescript
>    const [volumeTrend, setVolumeTrend] = useState<{ pct: number; dir: "up" | "down" | "flat" } | null>(null);
>    ```
>
> 4. Replace the week stats volume query — `app/(tabs)/index.tsx`
>    - Find the week stats block at lines 107-127:
>    ```typescript
>    // Week stats
>    try {
>      const ws = db.getFirstSync<{ days: number; sets: number; vol: number }>(
>        `SELECT COUNT(DISTINCT w.date) as days,
>                COUNT(s.id) as sets,
>                COALESCE(SUM(s.weight * s.reps), 0) as vol
>         FROM workouts w
>         LEFT JOIN sets s ON s.workout_id = w.id
>         WHERE w.date >= ?`,
>        [monday]
>      );
>      // ... rpe query ...
>      if (ws) setWeekStats({ days: ws.days ?? 0, sets: ws.sets ?? 0, volume: Math.round(ws.vol ?? 0), avgRpe });
>    } catch {}
>    ```
>    - Replace the entire `// Week stats` try block with this new version:
>    ```typescript
>    // Week stats — per-side-corrected volume
>    try {
>      // Count days and sets (unchanged)
>      const wsMeta = db.getFirstSync<{ days: number; sets: number }>(
>        `SELECT COUNT(DISTINCT w.date) as days, COUNT(s.id) as sets
>         FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
>         WHERE w.date >= ?`,
>        [monday]
>      );
>
>      // Per-exercise volume for this week (apply isPerSide multiplier in JS)
>      const thisWeekRows = db.getAllSync<{ exercise_id: string | null; vol: number }>(
>        `SELECT s.exercise_id, COALESCE(SUM(s.weight * s.reps), 0) as vol
>         FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
>         WHERE w.date >= ? AND s.is_warmup IS NOT 1
>         GROUP BY s.exercise_id`,
>        [monday]
>      );
>      const thisWeekVol = (thisWeekRows ?? []).reduce((total, row) => {
>        const multiplier = isPerSideExercise(row.exercise_id ?? "") ? 2 : 1;
>        return total + row.vol * multiplier;
>      }, 0);
>
>      // Previous week (Mon–Sun before current week)
>      const prevMonday = getPrevMonday();
>      const prevWeekRows = db.getAllSync<{ exercise_id: string | null; vol: number }>(
>        `SELECT s.exercise_id, COALESCE(SUM(s.weight * s.reps), 0) as vol
>         FROM workouts w LEFT JOIN sets s ON s.workout_id = w.id
>         WHERE w.date >= ? AND w.date < ? AND s.is_warmup IS NOT 1
>         GROUP BY s.exercise_id`,
>        [prevMonday, monday]
>      );
>      const prevWeekVol = (prevWeekRows ?? []).reduce((total, row) => {
>        const multiplier = isPerSideExercise(row.exercise_id ?? "") ? 2 : 1;
>        return total + row.vol * multiplier;
>      }, 0);
>
>      // Compute trend
>      if (prevWeekVol > 0) {
>        const pct = Math.round(((thisWeekVol - prevWeekVol) / prevWeekVol) * 100);
>        const dir = pct > 3 ? "up" : pct < -3 ? "down" : "flat";
>        setVolumeTrend({ pct: Math.abs(pct), dir });
>      } else {
>        setVolumeTrend(null);
>      }
>
>      const rpeRow = db.getFirstSync<{ avg: number | null }>(
>        `SELECT AVG(s.rpe) as avg
>         FROM sets s JOIN workouts w ON s.workout_id = w.id
>         WHERE w.date >= ? AND s.rpe IS NOT NULL`,
>        [monday]
>      );
>      const avgRpe = rpeRow?.avg != null ? Math.round(rpeRow.avg * 10) / 10 : null;
>
>      if (wsMeta) setWeekStats({
>        days: wsMeta.days ?? 0,
>        sets: wsMeta.sets ?? 0,
>        volume: Math.round(thisWeekVol),
>        avgRpe,
>      });
>    } catch {}
>    ```
>
> 5. Add the trend line below the volume StatBadge — `app/(tabs)/index.tsx`
>    - Find the `{/* Weekly Stats */}` card block at lines 373-391. Currently the volume badge is rendered at line 381:
>    ```tsx
>    <StatBadge label={t("common.volume")} value={wu.formatWeight(weekStats.volume)} theme={theme} />
>    ```
>    - After the entire `<View style={{ flexDirection: "row", ...}}>` closing tag (after all StatBadges, around line 389), add the trend line inside the Card but after the badges row:
>    ```tsx
>    {volumeTrend && (
>      <Text style={{
>        color: volumeTrend.dir === "up" ? theme.success : volumeTrend.dir === "down" ? theme.danger : theme.muted,
>        fontFamily: theme.mono,
>        fontSize: 11,
>        marginTop: 4,
>      }}>
>        {volumeTrend.dir === "up"
>          ? t("home.volumeTrend.up", { pct: String(volumeTrend.pct) })
>          : volumeTrend.dir === "down"
>            ? t("home.volumeTrend.down", { pct: String(volumeTrend.pct) })
>            : t("home.volumeTrend.flat")}
>      </Text>
>    )}
>    ```
>
> 6. Add trend i18n keys — `src/i18n/en/home.ts`
>    - Append 3 keys before the closing `};` (after `"home.lastBackup"`):
>    ```typescript
>    "home.volumeTrend.up": "\u2191 +{pct}% vs last week",
>    "home.volumeTrend.down": "\u2193 {pct}% vs last week",
>    "home.volumeTrend.flat": "\u2192 Flat vs last week",
>    ```
>
> 7. Add trend i18n keys — `src/i18n/nb/home.ts`
>    - Append 3 keys before the closing `};`:
>    ```typescript
>    "home.volumeTrend.up": "\u2191 +{pct}% vs forrige uke",
>    "home.volumeTrend.down": "\u2193 {pct}% vs forrige uke",
>    "home.volumeTrend.flat": "\u2192 Flatt vs forrige uke",
>    ```
>
> 8. Bump `EXPECTED_MIN_KEYS` — `src/i18n/merge.ts`
>    - Task 2 set it to 587. Change to: `const EXPECTED_MIN_KEYS = 590;`
>    - (If Task 2 has not been run yet, change from 586 to 590 in one step.)
>
> **Mønster å følge:**
> - Se `app/(tabs)/index.tsx` linje 40-46 for `getMonday()` — `getPrevMonday()` er identisk men med `- 7` i diff.
> - Se `app/(tabs)/index.tsx` linje 541-563 `StatBadge`-komponenten — `accentColor` prop kontrollerer farge, men her bruker vi en separat `<Text>` under badges-raden for trendindikatoren.
> - Arkitekturdokumentet `docs/architecture/training-intelligence-2026-02-25.md` Item 2 inneholder det nøyaktige SQL-mønsteret som fasit.
>
> **Viktig:**
> - `is_warmup IS NOT 1` i SQL ekskluderer warmup-sett fra volum (konsistent med existing PR-logikk).
> - `exercise_id` kan være `null` for eldre sett — `row.exercise_id ?? ""` gir `isPerSideExercise("")` som returnerer `false` (riktig fallback).
> - Terskel på 3% for flat: `pct > 3 ? "up" : pct < -3 ? "down" : "flat"` — unngår flimrende piler ved minimale endringer.
> - Ingen `elevation` på noen elementer.
> - `getPrevMonday()` bruker `d.setDate()` som muterer — kopier logikken fra `getMonday()` nøyaktig.
> - Task 1 MÅ være merged: `isPerSideExercise()` må returnere `true` for egendefinerte unilaterale øvelser.
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig."
