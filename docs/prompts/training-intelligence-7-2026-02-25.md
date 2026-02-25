# Training Intelligence — Prompt 7 av 8

## Kontekst fra teamet:
- @task-splitter: Task 7 — Koble `TrainingStatusCard` inn i hjemskjermen. Avhenger av Task 3 (oppdatert `index.tsx`) og Task 6 (kortkomponenten).
- @architect: Architecture doc Item 8. `computeTrainingStatus()` kalles i `useEffect` ved mount og når program endres. Kortet plasseres mellom "Weekly Stats"-blokken og "Recent PRs"-blokken. `onViewAnalysis` navigerer til `/(tabs)/analysis`. `onStartDeload` kaller `toggleManualDeload()` og refresher status.
- @codebase-scanner: `app/(tabs)/index.tsx` — Weekly Stats-blokk slutter ved linje ~391 (`</Card>` etter avgRpe-badge). Recent PRs starter ved linje ~473. Navigasjon: `router.push("/analysis")`. ActiveProgramId hentes via `getSettingAsync("programMode")` + `getSettingAsync("activeProgramId_${mode}")` — samme mønster som "Next workout preview"-blokken (linje 170-172). `toggleManualDeload` fra `src/periodization.ts` returnerer `Promise<boolean>`.

---

> "Koble `TrainingStatusCard` inn i `app/(tabs)/index.tsx` mellom ukesstatistikk og siste PRs
>
> **Kontekst:** Hjemskjermen skal vise treningsstatuskortet slik at brukeren får umiddelbar tilbakemelding på treningsstatus rett etter ukesstatistikken.
>
> **Steg:**
>
> 1. Legg til følgende imports øverst i `app/(tabs)/index.tsx` — etter de eksisterende importene:
>
> ```typescript
> import TrainingStatusCard from "../../src/components/TrainingStatusCard";
> import { computeTrainingStatus, type TrainingStatusResult } from "../../src/trainingStatus";
> import { toggleManualDeload } from "../../src/periodization";
> ```
>
> 2. Legg til ny state rett etter de eksisterende `useState`-deklarasjonene (ca. linje 71, etter `setActiveGymName`-linjen):
>
> ```typescript
>   const [trainingStatus, setTrainingStatus] = useState<TrainingStatusResult | null>(null);
>   const [trainingStatusLoading, setTrainingStatusLoading] = useState(true);
>   const [activeProgramId, setActiveProgramId] = useState<string | null>(null);
> ```
>
> 3. Legg til en separat `useEffect` for treningsstatus — sett den inn etter den eksisterende `useFocusEffect`-blokken (ca. linje 227, etter `}, [])` som avslutter `useFocusEffect`):
>
> ```typescript
>   useEffect(() => {
>     let alive = true;
>     (async () => {
>       try {
>         const mode = (await getSettingAsync("programMode")) || "normal";
>         const progId = await getSettingAsync(`activeProgramId_${mode}`);
>         if (alive) setActiveProgramId(progId);
>         const result = await computeTrainingStatus(progId);
>         if (alive) setTrainingStatus(result);
>       } catch {}
>       if (alive) setTrainingStatusLoading(false);
>     })();
>     return () => { alive = false; };
>   }, []);
> ```
>
> 4. Legg til `TrainingStatusCard`-render i JSX — sett inn blokken **etter** den avsluttende `</Card>` for "Weekly Stats" og **før** den eksisterende `{/* Progression Suggestions */}`-blokken.
>
>    I den eksisterende koden er "Weekly Stats"-kortet slik (ca. linje 374-391):
>    ```tsx
>        {/* Weekly Stats */}
>        <Card>
>          ...
>        </Card>
>
>        {/* Progression Suggestions */}   <-- sett inn MELLOM disse to
>        {suggestions.length > 0 ? (
>    ```
>
>    Sett inn følgende blokk mellom `</Card>` (Weekly Stats) og `{/* Progression Suggestions */}`:
>
> ```tsx
>        {/* Training Status */}
>        <TrainingStatusCard
>          result={trainingStatus}
>          loading={trainingStatusLoading}
>          onViewAnalysis={() => router.push("/analysis")}
>          onStartDeload={
>            activeProgramId
>              ? async () => {
>                  try {
>                    await toggleManualDeload(activeProgramId);
>                    const refreshed = await computeTrainingStatus(activeProgramId);
>                    setTrainingStatus(refreshed);
>                  } catch {}
>                }
>              : undefined
>          }
>        />
> ```
>
> **Mønster å følge:**
> - Se den eksisterende `activeProgramId`-hentingen linje ~170-172 i `app/(tabs)/index.tsx` for samme `getSettingAsync("programMode")` + `getSettingAsync("activeProgramId_${mode}")`-mønster
> - Se `src/periodization.ts` linje 93 for `toggleManualDeload(programId)` — returnerer `Promise<boolean>`, returverdien ignoreres
> - Se eksisterende `useEffect` med `let alive = true` mønster for korrekt cleanup (linje ~73-217)
>
> **Viktig:**
> - `trainingStatusLoading` starter som `true` — kortet viser skeleton til beregningen er ferdig
> - `router.push("/analysis")` (uten leading slash på analysis-segmentet) matcher det eksisterende navigasjonsmønsteret i filen
> - Ikke fjern eller flytt eksisterende blokker — bare sett inn ny blokk mellom Weekly Stats og Progression Suggestions
> - `onStartDeload` sendes kun dersom `activeProgramId` finnes — ellers `undefined` (knappen skjules i kortet)
> - Ingen `elevation` noe sted
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig."
