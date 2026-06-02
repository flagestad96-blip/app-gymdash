# Gymdash — Pro Overhaul Roadmap

> Branch: `redesign/pro-overhaul` (off `main` @ PR #3 / median-duration)
> Created: 2026-06-02
> Goal: Refaktorer hele appen til en profesjonell treningsapp **og** gi designet en
> skikkelig overhaling — uten å miste funksjonalitet.

## STATUS (2026-06-02)

**Done & verified (verify green throughout, expo export bundles clean):**
- Aurora dark-only design system, fonts, animated bg, frosted glass, palette + glass-intensity (Settings).
- Tidy grouped drawer nav. Log: one-exercise pager + large RestOverlay between sets.
- All screens reskinned; all 15 Gym-dash notes triaged/fixed (most already worked).
- Release prep: v0.10.0-beta (vc 11) + changelog + patch notes.

**Code-architecture refactor — safe layer complete (16 new tested modules/components, tests 120→166, 2 bug fixes):**
Pure logic: `asyncUtils`, `streak` (+off-by-one fix), `weekRange`, `analysisHelpers`, `programImport`,
`programExercises`, `calendarHelpers`, `historyHelpers`, `bodyMetrics`, `components/workout/superset`.
Sub-components: `workout/RestOverlay`, `workout/AddSetButton`, `workout/SetTable`,
`settings/WeightUnitCard` + `GymLocationsCard`, `achievements/AchievementCard` + `AchievementDetailModal`.
Every screen's pure logic now lives in a tested module. File reductions: ExerciseCard 1550→~1310,
achievements 708→450, settings −70.

**Remaining:**
- Deeper splitting of the *integrated* component bodies (stateful inline modals in log/program, data-loading hooks) — higher-risk, no user-facing effect, NOT launch-blocking.
- USER-only: on-device test (no emulator here) + EAS build (`npx eas build -p android --profile preview`).
- Branch not pushed yet.

## Locked decisions (avklart med Marius 2026-06-02)

| Spørsmål | Valg |
|---|---|
| **Utgangspunkt** | **Hybrid** — adopter aurora sitt visuelle språk på dagens oppdaterte `main`. Behold alle 32 nyere commits, ingen smertefull rebase. |
| **Omfang** | **Begge deler fullt** — visuell overhaling + kode-arkitektur (bryt opp 2k-linjers filer, rydd state, øk testdekning). |
| **Fremgangsmåte** | **Inkrementelt, skjerm for skjerm** — `npm run verify` etter hver. Appen holdes kjørbar hele veien. |
| **Funksjonalitet** | **Bevar alt** — ingen feature går tapt. IA kan forbedres/konsolideres, men alt forblir tilgjengelig. |

## Resolved decisions

- **Light mode? → DARK-ONLY** (avklart 2026-06-02). Følger aurora-prototypen. Tema-velgeren
  (system/lys/mørk) erstattes av *palette* (aurora/violet/emerald/sunset) + *glass-intensitet*-slider.
  Konsekvens: `setThemeMode/getThemeMode/ThemeMode` beholdes som deprecated back-compat-shims
  (så bygget holder seg grønt) til Settings-personaliseringen bygges om i Phase 3 (#5).
  `theme.isDark` forblir `true` overalt → lys-grenene blir død kode som ryddes per skjerm.

## Design system (hentet fra `redesign/aurora-fixes`)

Kilde: `Gymdash test/Gymdash.html` (2042 linjer prototype) + `src/theme.ts` på aurora-branchen.

- **Bakgrunn:** deep near-black `#05070f` med aurora-orbs (blå/violet/pink) bak transparente containere.
- **Glass:** hvit-basert frostet glass drevet av `glassIntensity` (0–100, default 65):
  - `blur = 8 + k·24` (8–32) — backdrop-filter på web; native simuleres med fill+stroke+gradient
  - `fillA = 0.04 + k·0.10`, `fillB = 0.02 + k·0.06`, `stroke = 0.12 + k·0.22`
- **Accent-paletter** (4 stk, bytter live):
  - aurora `#60a5fa/#c084fc/#67e8f9/#f472b6`, violet, emerald, sunset
  - `accent = violet`, `accentGradient = [blue, violet]`, `success = cyan`, `warn #f59e0b`, `danger #fb7185`
- **Typografi:** Inter (400/500/600/700) body, Instrument Serif display, JetBrains Mono numerikk.
- **Spacing/radius:** uendret (6/10/14/18/24/32 · 10/14/18/22/pill) — samme skala som i dag.
- **Skygger:** dypere/svartere (`#000` opacity 0.35–0.55) + violet glow.
- **Regel består:** ALDRI `elevation` på transparente glass-elementer (Android hvit-rektangel-bug).

## Phases

### Phase 0 — Fundament & oppsett  ✅ pågår
- [x] Branch `redesign/pro-overhaul`
- [x] Roadmap (dette dokumentet)
- [x] Avklar light-mode-beslutning → **dark-only**
- [ ] Installer fonter: `@expo-google-fonts/inter`, `instrument-serif`, `jetbrains-mono` + last i `_layout`

### Phase 1 — Designsystem (foundation, deler alle skjermer)
- [x] `src/theme.ts` → aurora-tokens (farger, glass, palette, intensitet, skygger) — fonter beholdt på Manrope til font-steget
- [ ] `src/components/AppBackground.tsx` → aurora-orbs
- [ ] `src/ui/index.tsx` → Screen/TopBar/Card/Button/Chip/TextField/ListRow/SegButton
- [ ] `src/ui/modern.tsx` → GlassCard/GradientButton/ProgressRing/StatPill/AnimatedNumber/Toast
- [ ] Verifiser: app rendrer i ny stil uten skjerm-spesifikke endringer

### Phase 2 — Navigasjon & skall
- [ ] `app/_layout.tsx` + `app/(tabs)/_layout.tsx` — drawer/nav i ny stil
- [ ] IA-gjennomgang (bevar alle skjermer; forbedre gruppering der det gir mening)

### Phase 3..N — Skjerm for skjerm (re-skin + refaktor + tester)
Rekkefølge etter synlighet/innsats. Hver: ny stil → bryt opp fil → ekstraher ren logikk → tester → `verify`.

| # | Skjerm | Fil | LOC i dag | Refaktor-mål |
|---|---|---|---|---|
| 1 | Hjem | `app/(tabs)/index.tsx` | 774 | seksjons-komponenter |
| 2 | Logg | `app/(tabs)/log.tsx` | 2353 | **størst** — hooks + sub-komponenter, ren øktlogikk |
| 3 | Program | `app/(tabs)/program.tsx` | 1923 | builder/editor/modaler ut |
| 4 | Analyse | `app/(tabs)/analysis.tsx` | 1909 | chart-seksjoner + selektorer ut |
| 5 | Innstillinger | `app/(tabs)/settings.tsx` | 1747 | seksjoner ut, ren backup/data-logikk |
| 6 | Kalender | `app/(tabs)/calendar.tsx` | 925 | |
| 7 | Historikk | `app/(tabs)/history.tsx` | 699 | |
| 8 | Prestasjoner | `app/(tabs)/achievements.tsx` | 708 | |
| 9 | Kropp | `app/(tabs)/body.tsx` | — | |
| 10 | Øktdetalj | `app/(tabs)/workout/[id].tsx` | — | |
| — | ExerciseCard | `src/components/workout/ExerciseCard.tsx` | 1550 | bryt opp sammen med Logg |

### Phase N+1 — Polish & release
- [ ] Animasjoner/haptics-konsistens, tomme tilstander, skeletons, a11y
- [ ] Oppdater `CONTEXT.md` + `CLAUDE.md` design-spec til aurora
- [ ] Full `verify` + preview-APK (bump `android.versionCode`)

## Guardrails (gjelder hver increment)
- `npm run verify` (tsc + jest + lint) etter hver skjerm. Aldri commit på rødt.
- Vekter alltid i kg internt; display/input via `useWeightUnit()`.
- Alle UI-strenger via `t()` (nb + en) — i18n-filer i `src/i18n/`.
- `expo-file-system` kun via `expo-file-system/src/legacy`.
- Ikke rør db.ts ↔ exerciseLibrary.ts sirkulær-import-løsningen (lazy require).
- Ingen `elevation` på transparente flater.
- Ingen tap av funksjonalitet — kryssjekk mot CONTEXT.md "Nåværende funksjonalitet".

## Definition of done (per skjerm)
1. Visuelt: aurora-stil, konsistent med designsystemet.
2. Kode: ingen fil > ~800 LOC uten god grunn; ren logikk ekstrahert + testet.
3. Funksjonalitet: 1:1 paritet (eller forbedret) mot før.
4. `verify` grønt. Manuell røyktest av kjernflyten.
