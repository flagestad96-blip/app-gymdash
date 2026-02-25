# Training Intelligence — Prompt 8 av 8

## Kontekst fra teamet:
- @task-splitter: Task 8 — Analyse Summary Hero Card. Avhenger av Task 7 (TrainingStatusCard bekreftet fungerende i hjemskjermen). Endrer `app/(tabs)/analysis.tsx` og legger til 2 i18n-nøkler.
- @architect: Architecture doc Item 9. `TrainingStatusCard` plasseres øverst i analyseskjermen, alltid synlig. Øvelses-pickeren demoteres til seksjon 2 med ny label `t("analysis.exerciseDetail")`. Default-state (ingen øvelse valgt) viser programomfattende status. `onViewAnalysis` er no-op siden vi allerede er på analyse-skjermen. `onStartDeload` kobles til `toggleManualDeload()`.
- @codebase-scanner: `app/(tabs)/analysis.tsx` — TopBar er ved linje 911. Første `<Card>` er "RANGE"-kortet ved linje 913. `activeProgramId` finnes ikke som state — det hentes via `getSettingAsync` i `loadGoals()` (linje 332-334). Riktig mønster: legg til eget `useEffect` for å hente program-ID og kjøre `computeTrainingStatus`. `toggleManualDeload` kan importeres fra `src/periodization.ts`.

---

> "Legg `TrainingStatusCard` øverst i `app/(tabs)/analysis.tsx` som hero-seksjon og restrukturaliser skjermen
>
> **Kontekst:** Analyseskjermen skal ha treningsstatuskortet som alltid synlig hero øverst — uavhengig av om en øvelse er valgt. Øvelses-pickeren demoteres visuelt til en "Exercise Detail"-seksjon under.
>
> **Steg:**
>
> 1. Legg til imports øverst i `app/(tabs)/analysis.tsx` — etter de eksisterende importene, men innenfor import-blokken:
>
> ```typescript
> import TrainingStatusCard from "../../src/components/TrainingStatusCard";
> import { computeTrainingStatus, type TrainingStatusResult } from "../../src/trainingStatus";
> import { toggleManualDeload } from "../../src/periodization";
> ```
>
> 2. Legg til ny state i `Analysis`-komponenten — rett etter de eksisterende state-deklarasjonene (etter `prevPeriodData`-linjen, ca. linje 147):
>
> ```typescript
>   const [trainingStatus, setTrainingStatus] = useState<TrainingStatusResult | null>(null);
>   const [trainingStatusLoading, setTrainingStatusLoading] = useState(true);
>   const [analysisProgramId, setAnalysisProgramId] = useState<string | null>(null);
> ```
>
> 3. Legg til ny `useEffect` for å hente treningsstatus — sett inn etter den eksisterende `useEffect` for bodyweight (ca. linje 185, etter `return () => { alive = false; };` / `}, [ready]);`):
>
> ```typescript
>   useEffect(() => {
>     if (!ready) return;
>     let alive = true;
>     (async () => {
>       try {
>         const mode = (await getSettingAsync("programMode")) || "normal";
>         const progId = await getSettingAsync(`activeProgramId_${mode}`);
>         if (alive) setAnalysisProgramId(progId);
>         const result = await computeTrainingStatus(progId);
>         if (alive) setTrainingStatus(result);
>       } catch {}
>       if (alive) setTrainingStatusLoading(false);
>     })();
>     return () => { alive = false; };
>   }, [ready]);
> ```
>
> 4. I return-JSX — sett inn `TrainingStatusCard` og en ny seksjons-header etter `<TopBar>` og **før** det eksisterende `<Card title={t("analysis.range")}>`. Finn denne blokken (ca. linje 911-913):
>
> ```tsx
>         <TopBar title={t("analysis.title")} subtitle={t("analysis.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />
>
>         <Card title={t("analysis.range")}>
> ```
>
>    Endre til:
>
> ```tsx
>         <TopBar title={t("analysis.title")} subtitle={t("analysis.subtitle")} left={<IconButton icon="menu" onPress={openDrawer} />} />
>
>         {/* ── Program Overview Hero ─────────────────────────────── */}
>         <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
>           {t("analysis.overview")}
>         </Text>
>         <TrainingStatusCard
>           result={trainingStatus}
>           loading={trainingStatusLoading}
>           onViewAnalysis={() => {/* already on analysis */}}
>           onStartDeload={
>             analysisProgramId
>               ? async () => {
>                   try {
>                     await toggleManualDeload(analysisProgramId);
>                     const refreshed = await computeTrainingStatus(analysisProgramId);
>                     setTrainingStatus(refreshed);
>                   } catch {}
>                 }
>               : undefined
>           }
>         />
>
>         {/* ── Exercise Detail Section ───────────────────────────── */}
>         <Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>
>           {t("analysis.exerciseDetail")}
>         </Text>
>
>         <Card title={t("analysis.range")}>
> ```
>
> 5. Legg til 2 nye nøkler i `src/i18n/en/analysis.ts` — sett dem inn rett før den avsluttende `};`:
>
> ```typescript
>   // ── Analysis screen sections ──
>   "analysis.overview": "Program Overview",
>   "analysis.exerciseDetail": "Exercise Detail",
> ```
>
> 6. Legg til tilsvarende 2 nøkler i `src/i18n/nb/analysis.ts` — sett dem inn rett før den avsluttende `};`:
>
> ```typescript
>   // ── Analysis screen sections ──
>   "analysis.overview": "Programoversikt",
>   "analysis.exerciseDetail": "Øvelsesdetaljer",
> ```
>
>    (For nb: `\u00d8velsesdetaljer` som unicode-escape — eller skriv direkte som `"Øvelsesdetaljer"` siden filen allerede bruker norske tegn.)
>
> 7. Bump `EXPECTED_MIN_KEYS` i `src/i18n/merge.ts` — endre linjen:
>
> ```typescript
> // Fra (etter Task 6):
> const EXPECTED_MIN_KEYS = 605;
> // Til:
> const EXPECTED_MIN_KEYS = 607;
> ```
>
> **Mønster å følge:**
> - Se `app/(tabs)/index.tsx` (oppdatert i Task 7) for nøyaktig samme `computeTrainingStatus` + `toggleManualDeload`-mønster
> - Se eksisterende seksjonsoverskrifter i `app/(tabs)/analysis.tsx` linje 375-376 (`<Text style={{ color: theme.muted, fontFamily: theme.mono, fontSize: 10 ... }}>`) for konsistent sesjons-label-stil
> - Se `app/(tabs)/analysis.tsx` linje 332-334 for `getSettingAsync("programMode")` + `getSettingAsync("activeProgramId_${mode}")`-mønsteret som allerede brukes i `loadGoals`
>
> **Viktig:**
> - `onViewAnalysis` er en no-op (`() => {/* already on analysis */}`) — vi er allerede på analyseskjermen, så "View full analysis"-lenken i kortet kan ignoreres her
> - `analysisProgramId` er et separat state-felt (ikke gjenbruk av eventuelt eksisterende programId-state) for å holde koden selvforklarende
> - `trainingStatusLoading` starter som `true` og settes `false` i `useEffect` uavhengig av om `ready` er true — legg til `if (!ready) return;` guard i useEffect for å ikke kjøre før DB er initialisert
> - Ingen `elevation` noe sted
> - Ikke endre eksisterende logikk eller komponent-orden under seksjonsoverskriftene — bare sett inn hero-seksjon øverst og legg til seksjonslabel over range-kortet
> - EXPECTED_MIN_KEYS er `605` etter Task 6. Denne oppgaven bumper den til `607` (+2 nøkler).
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig."
