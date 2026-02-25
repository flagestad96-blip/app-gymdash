# Training Intelligence — Prompt 11 av 11

## Kontekst fra teamet:
- @architect: Architecture doc section 6, Items 12 + 13 — RPE histogram (three horizontal bars: Light 6-7, Moderate 7.5-8.5, Hard 9+) + real horizontal bars in MuscleGroupBars replacing ListRow. Both are visual-only with no shared state or i18n overlap.
- @codebase-scanner: `MuscleGroupBars.tsx` currently uses `ListRow` from `src/ui`. `analysis.tsx` line 7 already imports `LinearGradient` from `expo-linear-gradient`. `theme.accentGradient` is `["#9C44DC", "#F97316"]` (dark) / `["#7C3AED", "#F97316"]` (light). RPE data available via `sets` array — `row.rpe` field (number | null | undefined).
- @task-splitter: Task 11 depends on Task 8 (analysis restructured). +4 i18n keys. EXPECTED_MIN_KEYS goes 615 → 619.
- @ux-critic: Bars use `View` with percentage width — NOT SVG. Background track shows healthy target range. No elevation on any bar element.

---

> "Sprint 3 visual polish: (A) create `src/components/charts/RpeHistogram.tsx` and render it in analysis.tsx below the consistency card; (B) replace `ListRow` render in `MuscleGroupBars.tsx` with real horizontal gradient bars."
>
> **Kontekst:** The analysis screen uses `ListRow` text rows for muscle groups (no visual fill) and has no RPE distribution view at all. This task adds actual data-driven visuals in both areas. `LinearGradient` is already a project dependency (`expo-linear-gradient`) and is already imported in `analysis.tsx`.
>
> **Steg:**
>
> ---
>
> ## Part A — RPE Histogram
>
> ### A1. Opprett `src/components/charts/RpeHistogram.tsx` — ny fil
>
> ```tsx
> // src/components/charts/RpeHistogram.tsx
> import React from "react";
> import { View, Text } from "react-native";
> import { LinearGradient } from "expo-linear-gradient";
> import { useTheme } from "../../theme";
> import { useI18n } from "../../i18n";
>
> export type RpeHistogramData = {
>   light: number;    // % of sets with RPE 6–7 (0–100)
>   moderate: number; // % of sets with RPE 7.5–8.5 (0–100)
>   hard: number;     // % of sets with RPE 9+ (0–100)
> };
>
> type RpeHistogramProps = {
>   data: RpeHistogramData;
> };
>
> // Healthy target range bands (% fill)
> const HEALTHY_RANGES = {
>   light:    { min: 20, max: 40 },
>   moderate: { min: 40, max: 60 },
>   hard:     { min: 10, max: 25 },
> };
>
> export default function RpeHistogram({ data }: RpeHistogramProps) {
>   const theme = useTheme();
>   const { t } = useI18n();
>
>   const rows: Array<{
>     labelKey: string;
>     pct: number;
>     color: string;
>     range: { min: number; max: number };
>   }> = [
>     { labelKey: "analysis.rpeLight",    pct: data.light,    color: theme.success,   range: HEALTHY_RANGES.light },
>     { labelKey: "analysis.rpeModerate", pct: data.moderate, color: theme.secondary ?? "#F97316", range: HEALTHY_RANGES.moderate },
>     { labelKey: "analysis.rpeHard",     pct: data.hard,     color: theme.danger,    range: HEALTHY_RANGES.hard },
>   ];
>
>   return (
>     <View style={{ gap: 10 }}>
>       {rows.map((row) => (
>         <View key={row.labelKey} style={{ gap: 4 }}>
>           {/* Label + value */}
>           <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
>             <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
>               {t(row.labelKey)}
>             </Text>
>             <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
>               {Math.round(row.pct)}%
>             </Text>
>           </View>
>
>           {/* Track */}
>           <View
>             style={{
>               height: 10,
>               borderRadius: 5,
>               backgroundColor: theme.glass,
>               borderWidth: 1,
>               borderColor: theme.glassBorder,
>               overflow: "hidden",
>               position: "relative",
>             }}
>           >
>             {/* Healthy range band (faint background) */}
>             <View
>               style={{
>                 position: "absolute",
>                 left: `${row.range.min}%`,
>                 width: `${row.range.max - row.range.min}%`,
>                 top: 0,
>                 bottom: 0,
>                 backgroundColor: row.color + "22",
>               }}
>             />
>             {/* Actual fill bar */}
>             {row.pct > 0 && (
>               <View
>                 style={{
>                   height: "100%",
>                   width: `${Math.min(100, row.pct)}%`,
>                   backgroundColor: row.color,
>                   borderRadius: 5,
>                 }}
>               />
>             )}
>           </View>
>         </View>
>       ))}
>     </View>
>   );
> }
> ```
>
> **Merk:** `theme.secondary` er ikke garantert å eksistere som token-navn. Bruk `"#F97316"` direkte for moderate-fargen som backup, slik koden over gjør med `?? "#F97316"`.
>
> ### A2. Beregn RPE-distribusjon i `app/(tabs)/analysis.tsx`
>
> Legg til et nytt `useMemo` rett etter `restStats`-blokken (rundt linje 533). Finn linjen som avslutter `restStats`:
>
> ```typescript
>   return { overallAvg, exercise: { avg, min, max, trend: trendDiff, count: exRest.length } };
> }, [sets, selectedExerciseKey]);
> ```
>
> Rett etter denne blokken, legg til:
>
> ```typescript
> // ── RPE Distribution ──────────────────────────────────────────────
> const rpeDistribution = useMemo(() => {
>   const rpeSets = sets.filter((s) => s.rpe != null && Number.isFinite(s.rpe as number));
>   if (rpeSets.length === 0) return null;
>
>   let light = 0, moderate = 0, hard = 0;
>   for (const s of rpeSets) {
>     const rpe = s.rpe as number;
>     if (rpe <= 7) light++;
>     else if (rpe <= 8.5) moderate++;
>     else hard++;
>   }
>   const total = rpeSets.length;
>   return {
>     light:    (light    / total) * 100,
>     moderate: (moderate / total) * 100,
>     hard:     (hard     / total) * 100,
>   };
> }, [sets]);
> ```
>
> ### A3. Import RpeHistogram in `app/(tabs)/analysis.tsx`
>
> Finn import-blokken øverst i filen (rundt linje 9 der `LineChart` og `MuscleGroupBars` importeres). Legg til:
>
> ```typescript
> import RpeHistogram from "../../src/components/charts/RpeHistogram";
> ```
>
> ### A4. Render RPE histogram i `app/(tabs)/analysis.tsx`
>
> Finn `<Card title={t("analysis.consistency")}>` (linje 947). RPE histogram-seksjonens plassering er **etter** consistency-kortet og **etter** rest-time-kortet. Finn avslutningen av `<Card title={t("analysis.restTime")}>` (rundt linje 991). Sett inn ny kortblokk rett etter:
>
> ```tsx
>         {/* ── RPE Distribution ──────────────────────────────── */}
>         {rpeDistribution && (
>           <Card title={t("analysis.rpeDistribution")}>
>             <RpeHistogram data={rpeDistribution} />
>           </Card>
>         )}
> ```
>
> ---
>
> ## Part B — Real Horizontal Bars in MuscleGroupBars
>
> ### B1. Erstatt hele innholdet av `src/components/charts/MuscleGroupBars.tsx`
>
> Les filen først. Den er 72 linjer. Erstatt hele filen med dette:
>
> ```tsx
> // src/components/charts/MuscleGroupBars.tsx
> import React from "react";
> import { View, Text } from "react-native";
> import { LinearGradient } from "expo-linear-gradient";
> import { useTheme } from "../../theme";
> import { useI18n } from "../../i18n";
> import { tagsFor, resolveExerciseId } from "../../exerciseLibrary";
>
> export const MUSCLE_GROUPS = [
>   "chest",
>   "back",
>   "shoulders",
>   "biceps",
>   "triceps",
>   "forearms",
>   "quads",
>   "hamstrings",
>   "glutes",
>   "calves",
>   "core",
> ] as const;
>
> export function primaryMuscleGroups(exerciseId?: string | null, exerciseName?: string | null): string[] {
>   const exId = exerciseId ? String(exerciseId) : exerciseName ? resolveExerciseId(exerciseName) : null;
>   if (!exId) return ["other"];
>   const tags = tagsFor(exId);
>   const groups = tags.filter((t) => MUSCLE_GROUPS.includes(t as (typeof MUSCLE_GROUPS)[number]));
>   if (groups.length === 0) return ["other"];
>   return groups.slice(0, 2);
> }
>
> export type MuscleGroupRow = {
>   group: string;
>   count: number;
>   delta: number;
>   status: string;
> };
>
> export type MuscleGroupBarsProps = {
>   rows: MuscleGroupRow[];
>   week: string;
> };
>
> function MuscleGroupBars({ rows, week }: MuscleGroupBarsProps) {
>   const theme = useTheme();
>   const { t } = useI18n();
>
>   if (rows.length === 0) {
>     return (
>       <Text style={{ color: theme.muted }}>{t("analysis.noData")}</Text>
>     );
>   }
>
>   // Compute max count for proportional bar width
>   const maxCount = Math.max(...rows.map((r) => r.count), 1);
>
>   return (
>     <View style={{ gap: 10 }}>
>       <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
>         {t("analysis.weekFrom", { week })}
>       </Text>
>       {rows.map((r) => {
>         const pct = Math.max(4, (r.count / maxCount) * 100); // min 4% so bar is always visible
>         const deltaLabel = r.delta === 0 ? "" : r.delta > 0 ? ` +${r.delta}` : ` ${r.delta}`;
>
>         return (
>           <View key={r.group} style={{ gap: 4 }}>
>             {/* Label row */}
>             <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
>               <Text style={{
>                 color: theme.text,
>                 fontFamily: theme.fontFamily.medium,
>                 fontSize: 13,
>                 textTransform: "capitalize",
>               }}>
>                 {r.group}
>               </Text>
>               <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 11 }}>
>                 {r.count} {t("common.sets").toLowerCase()}{deltaLabel}
>               </Text>
>             </View>
>
>             {/* Bar track */}
>             <View
>               style={{
>                 height: 8,
>                 borderRadius: 4,
>                 backgroundColor: theme.glass,
>                 borderWidth: 1,
>                 borderColor: theme.glassBorder,
>                 overflow: "hidden",
>               }}
>             >
>               {/* Gradient fill */}
>               <LinearGradient
>                 colors={theme.accentGradient}
>                 start={{ x: 0, y: 0 }}
>                 end={{ x: 1, y: 0 }}
>                 style={{
>                   height: "100%",
>                   width: `${pct}%`,
>                   borderRadius: 4,
>                 }}
>               />
>             </View>
>           </View>
>         );
>       })}
>     </View>
>   );
> }
>
> export default MuscleGroupBars;
> ```
>
> **Viktige detaljer for Part B:**
> - `theme.accentGradient` er `[string, string]` tuple (se `src/theme.ts`) — LinearGradient-`colors`-prop aksepterer dette direkte
> - `overflow: "hidden"` på bar-track gjør at `LinearGradient` med `width: ${pct}%` clippes korrekt innenfor avrundet hjørne
> - `ListRow`-importen er fjernet — den var den eneste bruken av ListRow i denne filen
> - Data-modellen (`MuscleGroupRow`, `MuscleGroupBarsProps`) og alle exports (`MUSCLE_GROUPS`, `primaryMuscleGroups`, `MuscleGroupBars`) er uendret — caller i `analysis.tsx` trenger ingen endringer
> - Ingen `elevation` på noe element (Android glass-regel fra CONTEXT.md)
>
> ---
>
> ## i18n
>
> ### i18n A — `src/i18n/en/analysis.ts`
>
> Legg til 4 nøkler på slutten av filen, rett **før** `};` og `export default analysis;`:
>
> ```typescript
>   // ── RPE Distribution (Task 11) ──
>   "analysis.rpeDistribution": "RPE DISTRIBUTION",
>   "analysis.rpeLight": "Light (6\u20137)",
>   "analysis.rpeModerate": "Moderate (7.5\u20138.5)",
>   "analysis.rpeHard": "Hard (9+)",
> ```
>
> ### i18n B — `src/i18n/nb/analysis.ts`
>
> Legg til 4 matchende norske nøkler på slutten av filen, rett **før** `};` og `export default analysis;`:
>
> ```typescript
>   // ── RPE Distribution (Task 11) ──
>   "analysis.rpeDistribution": "RPE-FORDELING",
>   "analysis.rpeLight": "Lett (6\u20137)",
>   "analysis.rpeModerate": "Moderat (7,5\u20138,5)",
>   "analysis.rpeHard": "Hard (9+)",
> ```
>
> ### Bump `EXPECTED_MIN_KEYS` i `src/i18n/merge.ts`
>
> Endre linje 55:
> ```typescript
> // Fra:
> const EXPECTED_MIN_KEYS = 615;
> // Til:
> const EXPECTED_MIN_KEYS = 619;
> ```
>
> ---
>
> **Mønster å følge:**
> - Se `src/components/charts/LineChart.tsx` for overall chart component structure (View wrapper, useMemo for data, conditional empty state)
> - Se `app/(tabs)/analysis.tsx` linje 7 — `LinearGradient` er allerede importert fra `expo-linear-gradient` der; `RpeHistogram.tsx` importerer det selvstendig
> - Se `app/(tabs)/analysis.tsx` linje 585–625 (`muscleStats` useMemo) for how `muscleStats.rows` og `muscleStats.week` beregnes og sendes til `<MuscleGroupBars rows={muscleStats.rows} week={muscleStats.week} />` (linje 944) — data-modellen forblir uendret
> - Se `src/ui/modern.tsx` — `GlassCard`-komponenten bruker `theme.glass` som backgroundColor og `theme.glassBorder` som borderColor — bruk de samme tokens i histogram-track
>
> **Viktig:**
> - Part B (MuscleGroupBars): `theme.accentGradient` er `[string, string]` — LinearGradient krever minimum 2 farger, dette oppfyller kravet
> - Part A (RpeHistogram): `position: "relative"` på track-View er nødvendig for at `position: "absolute"` på healthy-range-bandet skal fungere
> - RPE-histogram vises kun når `rpeDistribution !== null` (dvs. minst ett sett med RPE-data finnes)
> - Bruk Unicode `\u2013` (en-dash) for RPE-range-strenger (6–7, 7.5–8.5) i i18n-nøklene
> - Ingen `elevation` på noe element i noen av de to komponentene
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig.
