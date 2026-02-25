# Training Intelligence — Prompt 10 av 11

## Kontekst fra teamet:
- @architect: Architecture doc section 6, Item 11 — deload one-tap; `toggleManualDeload(programId)` from `src/periodization.ts` returns `Promise<boolean>` (new state). No changes to periodization.ts.
- @codebase-scanner: `src/ui/modern.tsx` has `UndoToast` and `AchievementToast` but NO simple `Toast` component. Task 10 builds a minimal inline toast using local state + `Animated` — same pattern as `UndoToast`. `toggleManualDeload` needs `programId` which must be read from settings before calling.
- @task-splitter: Task 10 depends on Tasks 7 + 8. Touches `app/(tabs)/index.tsx` and `app/(tabs)/analysis.tsx`. EXPECTED_MIN_KEYS goes 614 → 615 (+1).
- @ux-critic: After deload activation, card must immediately reflect `deload_active` state; toast confirms action. Pattern: call `toggleManualDeload`, then refresh status, then show toast.

---

> "Wire the deload one-tap action in both home and analysis screens: after `toggleManualDeload()` succeeds, refresh the training status state and show a brief success toast."
>
> **Kontekst:** `TrainingStatusCard` (added in Task 6) already has an `onStartDeload` prop and a "Start deload week" button. Tasks 7 and 8 wired `onStartDeload` to call `toggleManualDeload()` but with no feedback. This task adds the confirmation toast and immediate status refresh so the card switches to `deload_active` state without requiring a screen reload.
>
> **Steg:**
>
> ### 1. Legg til toast-state og hjelpefunksjon i `app/(tabs)/index.tsx`
>
> Finn state-blokken øverst i `HomeScreen`-komponenten (rundt linje 62–71). Legg til etter eksisterende state-variabler:
>
> ```typescript
> const [deloadToast, setDeloadToast] = useState(false);
> ```
>
> Legg til denne hjelpefunksjonen rett etter `openDrawer`-callback (rundt linje 59):
>
> ```typescript
> const showDeloadToast = useCallback(() => {
>   setDeloadToast(true);
>   setTimeout(() => setDeloadToast(false), 3000);
> }, []);
> ```
>
> ### 2. Oppdater `onStartDeload`-handleren i `app/(tabs)/index.tsx`
>
> Finn der `<TrainingStatusCard>` er rendret (lagt til i Task 7, mellom weekly stats og recent PRs). Oppdater `onStartDeload`-propen slik:
>
> ```tsx
> onStartDeload={async () => {
>   try {
>     const programMode = (await getSettingAsync("programMode")) || "normal";
>     const programId = await getSettingAsync(`activeProgramId_${programMode}`);
>     if (!programId) return;
>     await toggleManualDeload(programId);
>     const freshStatus = await computeTrainingStatus(programId);
>     setTrainingStatus(freshStatus);
>     showDeloadToast();
>   } catch {}
> }}
> ```
>
> ### 3. Legg til toast-import og render i `app/(tabs)/index.tsx`
>
> Legg til import øverst i filen (med de andre src-importene):
>
> ```typescript
> import { toggleManualDeload } from "../../src/periodization";
> import { computeTrainingStatus } from "../../src/trainingStatus";
> ```
>
> Legg til toast-render helt nederst i `<ScrollView>`-innholdet, rett **etter** `</ScrollView>` og rett **før** den avsluttende `</Screen>` taggen:
>
> ```tsx
> {/* Deload activated toast */}
> {deloadToast && (
>   <View
>     style={{
>       position: "absolute",
>       bottom: 50,
>       left: 24,
>       right: 24,
>       backgroundColor: theme.glass,
>       borderColor: theme.success,
>       borderWidth: 1,
>       borderRadius: 14,
>       paddingVertical: 12,
>       paddingHorizontal: 18,
>       alignItems: "center",
>       zIndex: 9999,
>     }}
>   >
>     <Text style={{ color: theme.success, fontFamily: theme.fontFamily.semibold, fontSize: 14 }}>
>       {t("home.deloadStarted")}
>     </Text>
>   </View>
> )}
> ```
>
> **Viktig:** `Screen` i `src/ui/index.tsx` wraps a `SafeAreaView`. For `position: "absolute"` toast å fungere må du wrappe Screen + toast i en yttre `View` med `style={{ flex: 1 }}`. Sjekk om `Screen` allerede er en `SafeAreaView` med `flex: 1` — om ja, er absolutt posisjonering direkte tilstrekkelig. Alternativt: plasser toast inne i ScrollView som siste element med `position: "absolute"` og `bottom: 40`.
>
> ### 4. Samme mønster i `app/(tabs)/analysis.tsx`
>
> Finn state-blokken øverst i `Analysis`-komponenten (rundt linje 120). Legg til:
>
> ```typescript
> const [deloadToast, setDeloadToast] = useState(false);
> ```
>
> Finn der `<TrainingStatusCard>` er rendret (lagt til i Task 8, øverst i ScrollView etter TopBar). Oppdater `onStartDeload`-propen slik:
>
> ```tsx
> onStartDeload={async () => {
>   try {
>     const programMode = (await getSettingAsync("programMode")) || "normal";
>     const programId = await getSettingAsync(`activeProgramId_${programMode}`);
>     if (!programId) return;
>     await toggleManualDeload(programId);
>     const freshStatus = await computeTrainingStatus(programId);
>     setTrainingStatus(freshStatus);
>     setDeloadToast(true);
>     setTimeout(() => setDeloadToast(false), 3000);
>   } catch {}
> }}
> ```
>
> Legg til import i `app/(tabs)/analysis.tsx` (med de andre importene øverst):
>
> ```typescript
> import { toggleManualDeload } from "../../src/periodization";
> import { computeTrainingStatus } from "../../src/trainingStatus";
> ```
>
> Legg til toast-render i analysis.tsx, rett **etter** den avsluttende `</ScrollView>` og **før** de eksisterende `<Modal>` komponentene:
>
> ```tsx
> {/* Deload activated toast */}
> {deloadToast && (
>   <View
>     style={{
>       position: "absolute",
>       bottom: 50,
>       left: 24,
>       right: 24,
>       backgroundColor: theme.glass,
>       borderColor: theme.success,
>       borderWidth: 1,
>       borderRadius: 14,
>       paddingVertical: 12,
>       paddingHorizontal: 18,
>       alignItems: "center",
>       zIndex: 9999,
>     }}
>   >
>     <Text style={{ color: theme.success, fontFamily: theme.fontFamily.semibold, fontSize: 14 }}>
>       {t("home.deloadStarted")}
>     </Text>
>   </View>
> )}
> ```
>
> ### 5. i18n — `src/i18n/en/home.ts`
>
> Legg til 1 nøkkel på slutten av filen, rett **før** `};` og `export default home;`:
>
> ```typescript
>   // ── Deload feedback (Task 10) ──
>   "home.deloadStarted": "Deload week activated",
> ```
>
> ### 6. i18n — `src/i18n/nb/home.ts`
>
> Legg til 1 matchende norsk nøkkel på slutten av filen, rett **før** `};` og `export default home;`:
>
> ```typescript
>   // ── Deload feedback (Task 10) ──
>   "home.deloadStarted": "Deload-uke aktivert",
> ```
>
> ### 7. Bump `EXPECTED_MIN_KEYS` i `src/i18n/merge.ts`
>
> Endre linje 55:
> ```typescript
> // Fra:
> const EXPECTED_MIN_KEYS = 614;
> // Til:
> const EXPECTED_MIN_KEYS = 615;
> ```
>
> **Mønster å følge:**
> - Se `src/periodization.ts` for `toggleManualDeload(programId: string): Promise<boolean>` — returnerer ny `manualDeload`-verdi; du trenger ikke bruke returverdien
> - Se `app/(tabs)/index.tsx` linje 183–192 for how `getSettingAsync("programMode")` og `getSettingAsync(\`activeProgramId_${programMode}\`)` brukes for å hente aktiv program-ID — kopier dette mønsteret nøyaktig
> - Se `UndoToast` i `src/ui/modern.tsx` for absolutt-posisjonert toast-pattern med `position: "absolute"`, `bottom: 40`, `zIndex: 9999`
> - `computeTrainingStatus` og `setTrainingStatus` er lagt til av Task 7 i index.tsx og Task 8 i analysis.tsx — disse state-variablene eksisterer allerede
>
> **Viktig:**
> - `toggleManualDeload` er allerede importert fra `src/periodization.ts` i Tasks 7/8 hvis de fulgte planen — sjekk om importen allerede finnes før du legger til
> - Ingen `elevation` på toast-View (Android glass-regel fra CONTEXT.md)
> - Toast vises i 3 sekunder og fjernes deretter automatisk via `setTimeout`
> - Toasten bruker `theme.success` som border + tekstfarge (grønn) for å signalere positiv bekreftelse
> - `home.deloadStarted` brukes i **begge** screens for konsistens — begge importerer fra `src/i18n/en/home.ts` via den felles `t()`-hook
>
> Kjør `npx tsc --noEmit && npx jest` når du er ferdig.
