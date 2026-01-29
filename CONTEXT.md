# Gymdash – CONTEXT

## Mål
Stabil og pen treningsapp (Expo Router) for logging, programbygging og analyse, med web-støtte.

## Design spec (UI v2 — NY PALETTE)
- Palette: lys base (off-white), dype nøytraler for text, indigo accent.
- Typografi: H1 28/32 semibold, H2 22/28 medium, body 15/22 regular, caption 12/16 mono.
- Spacing scale: 6/10/14/18/24/32 (xs–xxl).
- Card: radius 22, 1px line, soft shadow (sm/md), padding 18.
- Buttons: primary (accent fill), secondary (outline), ghost (transparent).
- Buttons: tydelig press feedback + disabled state.
- Inputs: tydelig padding, focus-ring i accent, error-border i danger.
- Chips: pill, active = accent + subtle fill.
- TopBar: høyere, tydelig tittel/subtittel + “UI v2” watermark.
- List rows: aligned left/right, separators for klar rytme.

## Nåværende funksjonalitet (MVP)
- Logg: dagvalg (1–5), start/avslutt økt, sett-logg med kg/reps/RPE.
- Logg: quick-input steppers (targets/inc), mål/forrige/forslag per øvelse, én-trykk “Bruk forslag”.
- Logg: supersett A/B alternering, mini-navigator og “Neste” scroll.
- Logg: rest-timer med presets, auto-start og haptics/vibrasjon.
- Logg: neste-dag forslag per program + dag-override med “Husk som neste”.
- Logg: PR-banner ved nye pers (tungeste/e1RM/volum).
- Logg: set-type (normal/warmup/dropset/restpause), +3 quick add, notater og cue/link per øvelse.
- Logg: superset auto-fokus til neste øvelse etter set.
- Navigasjon: Drawer med hamburger, ingen bottom tabs.
- Program: program builder, flere programmer, alternativer per øvelse (0–3).
- Program: per øvelse rep-range + increment (targets) via enkel modal.
- Program: targets inkluderer antall sett (target_sets).
- Program: import/export av program (JSON), dupliser/rename/slett.
- Program: innebygde templates inkl. “PPL 5-dagers (Brystfokus)” med targets + alternativer.
- Analyse: øvelsesgraf, overall strength, volumserie, muskelgruppe-sets og konsistens.
- Analyse: Strength Index-graf (e1RM-basert, uten warmup) + muskelgruppe-volum pr uke.
- Kalender: månedsoverblikk med økter per dato.
- Settings: lokal backup/restore av hele DB (JSON).
- Settings: del program (eksport/import av aktivt program uten historikk).
- Settings: full backup/restore (JSON), CSV-export, health check (orphan sets).
- Settings: Data & Rydding (liste per øvelse, slett historikk, slett tomme økter, nullstill alt).
- Onboarding: intro vises første gang og kan åpnes fra Settings.
- Splash: AppLoading er oppgradert med fade + logo + minimum varighet i root.

## Arkitektur (viktigste filer)
- app/_layout.tsx: Root layout (Drawer wrapper) + custom drawer content.
- app/(tabs)/index.tsx (Logg): øktflyt, settlogging, rest-timer, forslag/targets, navigator.
- app/(tabs)/program.tsx (Program): program builder + target editor + import/export.
- app/(tabs)/analysis.tsx (Analyse): graf per øvelse + overall + volum/muskel/konsistens.
- app/(tabs)/body.tsx (Kropp): vekt/BMI registrering + liste + høyde i settings.
- app/(tabs)/calendar.tsx (Kalender): månedskalender og øktliste per dato.
- app/(tabs)/settings.tsx (Settings): app-innstillinger + lokal backup/restore.
- src/db.ts: SQLite init, schema + settings helpers, web OPFS fallback.
- src/programStore.ts: program CRUD, defaults, active program per mode, replacements.
- src/progressionStore.ts: targets (rep-range/increment) + forslag-regler.
- src/exerciseLibrary.ts: øvelsesdata, displayName/tags/increment/search + name->id lookup + bodyweight-flagg/faktor.
- components/AppLoading.tsx: enkel loading/splash komponent.
- components/SplashScreen.tsx: splash med logo + fade.
- components/OnboardingModal.tsx: 3-stegs intro (førstegang + “vis igjen”).
- components/ui.tsx: delt Screen/Header/Card/Chip/Btn/IconButton.
- src/components/GymdashLogo.tsx: vektorlogo (react-native-svg).
- src/ui/index.tsx: nytt designsystem (Screen/TopBar/Card/Button/Chip/TextField/SectionHeader) brukt av hovedskjermene.

## Database (skjema)
- workouts: id, date, program_mode, program_id, day_key, back_status, notes, day_index, started_at
- sets: id, workout_id, exercise_name, set_index, weight, reps, rpe, created_at, exercise_id, set_type, is_warmup
- sets: + external_load_kg, bodyweight_kg_used, bodyweight_factor, est_total_load_kg
- settings: key, value
- body_metrics: date (PK), weight_kg, note
- programs: id, name, mode, json, created_at, updated_at
- pr_records: exercise_id, type, value, reps, weight, set_id, date, program_id
- backup JSON: schemaVersion, exportedAt, appVersion + alle tabeller
- program_days: id, program_id, day_index, name
- program_day_exercises: id, program_id, day_index, sort_index, type, ex_id, a_id, b_id
- program_exercise_alternatives: id, program_id, day_index, exercise_id, alt_exercise_id, sort_index
- program_replacements: legacy (ikke brukt i UI)
- exercise_targets: id, program_id, exercise_id, rep_min, rep_max, target_sets, increment_kg, updated_at

## Konvensjoner / constraints
- Full file output for endrede filer (ikke diff/snutter)
- Ikke store refactors uten å bli bedt om det
- Ikke bruk expo-notifications i Expo Go (begrensninger)
- Web: expo-sqlite wasm/COOP/COEP og OPFS fallback
- Unngå hooks inne i loops/conditionals
- Hold UI minimalistisk (UI v2 light palette), monofont metadata
- Safe area: Screen wrapper (SafeAreaView) + StatusBar i root
- UI: ny visuell stil via src/ui (components/ui.tsx regnes som legacy)
- Program templates: 5-dagers Normal/Ryggvennlig + PPL 5-dagers (Brystfokus) (stable IDs) + legacy v1 navnes korrekt
- Preview APK: EAS build profile preview (internal, android apk); bump expo.android.versionCode per build
- Preview APK: `android.versionCode` er nå 2 (oppdater ved neste build)
- Testing: `npm run verify` (typecheck + jest + lint), `npm run test` for unit tests

## Kjent teknisk gjeld / “huskeliste”
- Web: DB er deaktivert (in-memory no-op, ingen persistens).
- Forslagslogikk er enkel v1 (bør forbedres senere).
- Analyse: ingen avansert filtrering per program ennå.
- Backup/restore: stor JSON kan være treg på eldre enheter.
- Data & Rydding: sletter PR/targets for valgte øvelser (workouts ryddes via egen knapp).
- Legacy sets uten exercise_id kan mangle match hvis exercise_name ikke finnes i bibliotek.
- Eldre workouts uten program_id faller tilbake til program_mode for “neste dag”.
- PRs beregnes per program_id; Analyse viser beste PR på tvers av program.
- Warmup-sett lagres, men ikke brukt i PR/volum/strength index.
- Edit/slett sett oppdaterer ikke PR-historikk automatisk.
- Coaching hints: enkel rule-based hint i Logg (basert på siste sett + rep-range/RPE).
- Cue/link UI fjernet (legacy data beholdes kun i storage).
- “Husk som neste” fjernet fra Logg (dagvalg er kun midlertidig).
- Rest-timer flyttet ned til set-området; settings-ikon i topbar.
- Legg-til-sett CTA er større og mer tydelig i sticky bar.
- Logg: bottom-sheet/øya fjernet; kun inline input i øvelseskort.
- Repair av splittede økter flytter sett inn i én økt; tomme "Merged into ..."-rader kan bli igjen.
- Expo CLI start feiler lokalt uten nett (fetch failed i doctor); bruk nett/skip doctor for sanity.

- Logg: auto-scroll følger nye sett (kun når bunnen er synlig).
## Neste pakke (plan)
- 1) QA av set-type/warmup, +3 quick add og notater/cue.
- 2) QA av strength index + muskelgruppe-volum (warmup-filter).
- 3) QA av backup/restore + health check + CSV.

## Build – Preview APK (Android)
- Kommandoer: `npx eas login` (ved behov) og `npx eas build --platform android --profile preview`
- Install: åpne build-link/QR, last ned APK, installer (tillat “unknown apps” ved prompt)
- Update: øk `expo.android.versionCode` + bygg ny APK + installer over eksisterende (data beholdes)

## Sist endret (dato + hva)
- 2026-01-29: Lås aktiv dag/program under aktiv økt + one-time repair av splittede økter (dag 2).
- 2026-01-29: Fjernet Logg bottom-sheet for å fjerne dobbel input og bar nederst.
- 2026-01-29: Program header overflow fix (dag-tittel presser ikke actions ut av skjerm).
- 2026-01-29: Kropp-fane + body_metrics-tabell + bodyweight-sett felter og logg/analyse-kobling.









