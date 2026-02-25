# Training Intelligence — Prompt 9 av 11

## Kontekst fra teamet:
- @architect: Architecture doc section 6, Item 10 — `src/analysisInsights.ts` pure function, 7-branch decision tree, renders as muted italic below the 4-week trend in exercise detail
- @codebase-scanner: `exerciseStats.trend` (e1RM delta in kg, line 483–485 of analysis.tsx) and `rpeDelta` are NOT yet pre-computed as a pct/delta pair — see derivation note below
- @task-splitter: Task 9 depends on Task 8 (analysis screen restructured with hero card at top); EXPECTED_MIN_KEYS goes 607 → 614 (+7)
- @ux-critic: Insight sentence renders only when `sessionCount >= 2`; "not enough data" variant with `{n}` param for sessions needed

---

> "Create `src/analysisInsights.ts` (pure 7-branch insight function) and render the insight sentence below the 4-week trend stat in `app/(tabs)/analysis.tsx`."
>
> **Kontekst:** The analysis screen already computes `exerciseStats.trend` (e1RM delta in kg over 4 weeks) and has access to RPE values in `sets`. This task adds a pure decision-tree function that maps those two signals to one of 7 human-readable insight sentences and renders it below the trend stat in the exercise stats card.
>
> **Steg:**
>
> ### 1. Oprett `src/analysisInsights.ts` — ny fil
>
> Opprett filen med dette eksakte innholdet:
>
> ```typescript
> // src/analysisInsights.ts
> // Pure function — no DB calls, no React imports.
>
> export type InsightResult = {
>   key: string;
>   params?: Record<string, string | number>;
> };
>
> /**
>  * Generate a one-sentence exercise insight based on e1RM % change and RPE delta.
>  *
>  * Decision tree (7 branches):
>  *   e1RM up   + RPE down  → strongAndEasy
>  *   e1RM up   + RPE up    → strongButHarder
>  *   e1RM up   + RPE flat  → strongStableRpe
>  *   e1RM flat + RPE down  → flatButEasier
>  *   e1RM flat + RPE up    → flatAndHard
>  *   e1RM down (any RPE)   → decliningFatigued
>  *   sessionCount < 2      → notEnoughData (with {n} param)
>  *
>  * Thresholds:
>  *   e1RM "up"   = e1rmPctChange >  2.0
>  *   e1RM "down" = e1rmPctChange < -2.0
>  *   e1RM "flat" = -2.0 to +2.0
>  *   RPE  "up"   = rpeDelta > 0.3
>  *   RPE  "down" = rpeDelta < -0.3
>  *   RPE  "flat" = -0.3 to +0.3
>  */
> export function generateExerciseInsight(input: {
>   e1rmPctChange: number | null;
>   rpeDelta: number | null;
>   sessionCount: number;
> }): InsightResult {
>   const { e1rmPctChange, rpeDelta, sessionCount } = input;
>
>   // Not enough data — need at least 2 sessions to split early/late halves
>   if (sessionCount < 2 || e1rmPctChange === null) {
>     const needed = Math.max(0, 2 - sessionCount);
>     return { key: "analysis.insight.notEnoughData", params: { n: needed } };
>   }
>
>   const e1rmUp   = e1rmPctChange >  2.0;
>   const e1rmDown = e1rmPctChange < -2.0;
>   // e1rmFlat = neither up nor down
>
>   const rpeUp   = rpeDelta !== null && rpeDelta >  0.3;
>   const rpeDown = rpeDelta !== null && rpeDelta < -0.3;
>   // rpeFlat = neither up nor down (or rpeDelta is null)
>
>   if (e1rmDown) {
>     return { key: "analysis.insight.decliningFatigued" };
>   }
>
>   if (e1rmUp && rpeDown) {
>     return { key: "analysis.insight.strongAndEasy" };
>   }
>
>   if (e1rmUp && rpeUp) {
>     return { key: "analysis.insight.strongButHarder" };
>   }
>
>   if (e1rmUp) {
>     // RPE flat or null
>     return { key: "analysis.insight.strongStableRpe" };
>   }
>
>   // e1RM flat from here
>   if (rpeDown) {
>     return { key: "analysis.insight.flatButEasier" };
>   }
>
>   if (rpeUp) {
>     return { key: "analysis.insight.flatAndHard" };
>   }
>
>   // e1RM flat + RPE flat (or no RPE data)
>   return { key: "analysis.insight.strongStableRpe" };
> }
> ```
>
> ### 2. Beregn `e1rmPctChange` og `rpeDelta` i `app/(tabs)/analysis.tsx`
>
> Filen har allerede `exerciseStats` (useMemo linje 449–501) som beregner `exerciseStats.trend` (e1RM absolutt delta i kg). Du trenger i tillegg prosentendring og RPE-delta. Legg til en ny `useMemo` rett etter `exerciseStats`-blokken (etter linje 501, før `restStats`):
>
> ```typescript
> // ── Insight inputs: e1RM % change + RPE delta ────────────────────
> const insightInputs = useMemo(() => {
>   if (!selectedExerciseKey) return { e1rmPctChange: null, rpeDelta: null, sessionCount: 0 };
>
>   const filtered = sets.filter((row) => {
>     const key = (row.exercise_id && String(row.exercise_id)) || row.exercise_name;
>     return key === selectedExerciseKey;
>   });
>
>   // Count distinct workout sessions
>   const sessionCount = new Set(filtered.map((s) => s.workout_id)).size;
>
>   // 4-week split: first 2 weeks vs last 2 weeks
>   const d14 = new Date(); d14.setDate(d14.getDate() - 14);
>   const d28 = new Date(); d28.setDate(d28.getDate() - 28);
>   const iso14 = isoDateOnly(d14);
>   const iso28 = isoDateOnly(d28);
>
>   const recent = filtered.filter((s) => isoDateOnly(new Date(s.created_at)) >= iso28);
>   const firstHalf = recent.filter((s) => isoDateOnly(new Date(s.created_at)) < iso14);
>   const secondHalf = recent.filter((s) => isoDateOnly(new Date(s.created_at)) >= iso14);
>
>   // e1RM % change
>   let e1rmPctChange: number | null = null;
>   if (firstHalf.length > 0 && secondHalf.length > 0) {
>     const avg1rm = (rows: RowSet[]) => {
>       const vals = rows.map((s) => { const w = weightForSet(s); return w == null ? 0 : epley1RM(w, s.reps); });
>       return vals.reduce((a, b) => a + b, 0) / vals.length;
>     };
>     const early = avg1rm(firstHalf);
>     const late  = avg1rm(secondHalf);
>     if (early > 0) {
>       e1rmPctChange = ((late - early) / early) * 100;
>     }
>   }
>
>   // RPE delta: avg RPE in first half vs second half
>   let rpeDelta: number | null = null;
>   const rpeOf = (rows: RowSet[]) => {
>     const vals = rows.map((s) => s.rpe).filter((v): v is number => v != null && Number.isFinite(v));
>     return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
>   };
>   const earlyRpe = rpeOf(firstHalf);
>   const lateRpe  = rpeOf(secondHalf);
>   if (earlyRpe !== null && lateRpe !== null) {
>     rpeDelta = lateRpe - earlyRpe;
>   }
>
>   return { e1rmPctChange, rpeDelta, sessionCount };
> }, [sets, selectedExerciseKey]);
> ```
>
> ### 3. Import `generateExerciseInsight` in `app/(tabs)/analysis.tsx`
>
> Finn import-blokken øverst i filen (rundt linje 14 der `epley1RM` og andre utils importeres). Legg til:
>
> ```typescript
> import { generateExerciseInsight } from "../../src/analysisInsights";
> ```
>
> ### 4. Render insight-setningen i `app/(tabs)/analysis.tsx`
>
> Finn `<Card title={t("analysis.stats")}>` (linje 1081). Inne i denne kortet, rett etter consistency-linjen (etter `t("analysis.sessionsPerWeek", ...)`) og rett **før** den avsluttende `</View>` og `</Card>`:
>
> **Kontekst rundt innsettingspunktet (eksisterende kode):**
> ```tsx
>               <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 13 }}>
>                 {t("analysis.consistencyLabel")}: {t("analysis.sessionsPerWeek", { value: exerciseStats.consistency })}
>               </Text>
>             </View>
>           )}
>         </Card>
> ```
>
> **Etter endringen:**
> ```tsx
>               <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 13 }}>
>                 {t("analysis.consistencyLabel")}: {t("analysis.sessionsPerWeek", { value: exerciseStats.consistency })}
>               </Text>
>               {/* ── Exercise insight sentence ── */}
>               {(() => {
>                 const insight = generateExerciseInsight(insightInputs);
>                 return (
>                   <Text style={{
>                     color: theme.muted,
>                     fontFamily: theme.mono,
>                     fontSize: 12,
>                     fontStyle: "italic",
>                     marginTop: 6,
>                     lineHeight: 17,
>                   }}>
>                     {t(insight.key, insight.params)}
>                   </Text>
>                 );
>               })()}
>             </View>
>           )}
>         </Card>
> ```
>
> ### 5. i18n — `src/i18n/en/analysis.ts`
>
> Legg til 7 nøkler på slutten av filen, rett **før** den avsluttende `};` og `export default analysis;`:
>
> ```typescript
>   // ── Exercise Insights (Task 9) ──
>   "analysis.insight.strongAndEasy": "Strength is up and effort is down — you're adapting well.",
>   "analysis.insight.strongButHarder": "Strength is up but RPE is rising — monitor fatigue.",
>   "analysis.insight.strongStableRpe": "Steady strength gains with consistent effort — keep going.",
>   "analysis.insight.flatButEasier": "Strength is plateauing but getting easier — ready to push harder.",
>   "analysis.insight.flatAndHard": "Strength plateau with rising effort — consider a deload.",
>   "analysis.insight.decliningFatigued": "Strength and effort both declining — rest may be needed.",
>   "analysis.insight.notEnoughData": "Log {n} more sessions to see insights.",
> ```
>
> ### 6. i18n — `src/i18n/nb/analysis.ts`
>
> Legg til 7 matchende norske nøkler på slutten av filen, rett **før** den avsluttende `};` og `export default analysis;`:
>
> ```typescript
>   // ── Exercise Insights (Task 9) ──
>   "analysis.insight.strongAndEasy": "Styrken \u00f8ker og innsatsen g\u00e5r ned \u2014 du tilpasser deg bra.",
>   "analysis.insight.strongButHarder": "Styrken \u00f8ker, men RPE stiger \u2014 f\u00f8lg med p\u00e5 trettheten.",
>   "analysis.insight.strongStableRpe": "Stabil styrke\u00f8kning med jevn innsats \u2014 fortsett slik.",
>   "analysis.insight.flatButEasier": "Styrken flater ut, men \u00f8velsen f\u00f8les lettere \u2014 klar for mer?",
>   "analysis.insight.flatAndHard": "Styrkeplateu med stigende innsats \u2014 vurder en deload-uke.",
>   "analysis.insight.decliningFatigued": "B\u00e5de styrke og innsats synker \u2014 hvile kan v\u00e6re n\u00f8dvendig.",
>   "analysis.insight.notEnoughData": "Logg {n} flere \u00f8kter for \u00e5 se innsikt.",
> ```
>
> ### 7. Bump `EXPECTED_MIN_KEYS` i `src/i18n/merge.ts`
>
> Endre linje 55:
> ```typescript
> // Fra:
> const EXPECTED_MIN_KEYS = 607;
> // Til:
> const EXPECTED_MIN_KEYS = 614;
> ```
>
> **Mønster å følge:**
> - Se `src/components/charts/MuscleGroupBars.tsx` for how a component imports `useI18n` and calls `t()` — samme pattern brukes her men inline i analysis.tsx
> - Se `app/(tabs)/analysis.tsx` linje 449–501 (`exerciseStats` useMemo) for the existing first/second half split pattern — `insightInputs` følger nøyaktig samme split-logikk
> - `epley1RM` er allerede importert i analysis.tsx (linje 20) — ingen ny import nødvendig
> - `isoDateOnly` er allerede importert (linje 19)
>
> **Viktig:**
> - `generateExerciseInsight` er en **ren funksjon** — ingen imports fra `db.ts`, ingen React, ingen side-effekter
> - Insight-setningen rendres kun inne i `{!exerciseStats ? ... : <View>...}` sin true-branch — ingen nullsjekk nødvendig utover det
> - Bruk `fontStyle: "italic"` (ikke font-family endring) for kursiv stil
> - Ingen `elevation` på noe element (Android glass-regel fra CONTEXT.md)
> - `RowSet` typen (linje 26–36) har `rpe?: number | null` — filtrer med `v != null && Number.isFinite(v)` som vist
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig.
