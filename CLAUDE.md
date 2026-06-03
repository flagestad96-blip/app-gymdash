# Gymdash — CLAUDE.md

> Denne filen leses automatisk av Claude Code ved hver samtale.
> Hold den oppdatert med prosjektregler, beslutninger og backlog.

## Prosjekt

Gymdash er en privacy-first, 100% offline treningsapp bygget med React Native, Expo SDK 54, Expo Router, SQLite og TypeScript. Se `CONTEXT.md` for full arkitektur og funksjonalitet.

## Regler

- **Les CONTEXT.md** ved starten av hver sesjon for å forstå nåværende tilstand
- **Aldri** bruk `elevation` på elementer med transparent/semi-transparent bakgrunn (Android)
- **Vekter**: lagres alltid i kg internt. Bruk `useWeightUnit()` for display/input
- **i18n**: alle UI-strenger via `t("key")`, legg til i `src/i18n.ts` (nb + en)
- **expo-file-system**: `import * as FileSystem from "expo-file-system/src/legacy"`
- **UI-komponenter**: `src/ui/index.tsx` (base) + `src/ui/modern.tsx` (glassmorphism)
- **Sirkulær import**: db.ts ↔ exerciseLibrary.ts bruker lazy `require()`
- **Verifisering**: `npm run verify` etter alle endringer (tsc + jest + lint)
- **Unngå falske features**: hver funksjon må genuint hjelpe noen å trene bedre

## Agent-team

Gymdash har et komplett agent-team i `.claude/agents/`. Bruk dem via pipeline:

```
DISCOVERY → PLANNING → BUILD → QUALITY → OPS
@scout → @architect → @prompt-builder → @verify → @session-closer
@brainstorm → @db-designer → → @code-reviewer
@ux-critic → @task-splitter → → @tester
@bug-hunter
@codebase-scanner
@gemini-research
```

Output lagres i `docs/` (ideas/, plans/, prompts/, research/, reviews/, sessions/).

## Utgivelse (EAS Build → Play Store)

Appen publiseres til Play via **EAS Build + EAS Submit (auto-submit)**. Full guide: `docs/RELEASE.md`.

**Oppsett (ferdig per juni 2026):**
- Tjenestekonto `eas-submit@gymdash.iam.gserviceaccount.com` — satt opp i Play (13 tillatelser på appen), Google Cloud (**Android Publisher API enabled**, prosjekt «Gymdash») og lagret i EAS. Lokal nøkkel i `credentials/google-play-service-account.json` (git-ignorert).
- GitHub koblet til EAS-prosjektet (`flagestad96-blip/app-gymdash`, base `/`).
- Aktivt spor: **lukket testing «alpha»**. `eas.json` submit → track `alpha`, releaseStatus `completed`.
- `appVersionSource: "local"` — app.json er fasit for `versionCode`. Bumpes via `scripts/bump-version.js`, **ikke** EAS auto-increment (koblet til patch notes + håndhevet av `check-version`).

**Per release (kjerneflyt):**
1. `npm run bump-version <patch|minor|major>` (bumper app.json/package.json + patchNotes-placeholder)
2. Fyll inn ekte patch notes i `src/patchNotes.ts` + i18n (`src/i18n/{en,nb}/patchNotes.ts`) + `## vX.Y.Z` i `CHANGELOG.md`
3. `npm run verify`
4. **Sett «Hva er nytt» i Play Console manuelt** (se gotcha)
5. `npm run build:android` → bygger + auto-submitter til alpha. Testerne får auto-oppdatering når Google er ferdig å prosessere (minutter–timer).

**⚠️ Gotcha — Play «Hva er nytt» (release notes):**
EAS Submit laster KUN opp `.aab`-en — den setter **ikke** Play sin «Hva er nytt»-tekst. Når feltet er tomt, gjenbruker Google **forrige releases** tekst (derfor viste v0.10.0-beta gamle v0.9.0-notater). Dette er IKKE det samme som appens interne `patchNotes.ts` (som er korrekt) — det er Play Store-listingen.
→ **Sett release notes manuelt hver release:** Play Console → Test og publiser → Lukket testing «alpha» → *Administrer utgivelsen* → «Hva er nytt i denne utgaven» (per språk nb/en, maks 500 tegn). Kilde: nyeste entry i `patchNotes.ts` (tekstene ligger i i18n-filene).

**Sjekkliste til neste økt:**
- `versionCode` MÅ økes hver release, ellers avviser Play (duplikat).
- Play «Hva er nytt» settes manuelt — auto-submit gjør det ikke.
- **Produksjon** (åpen for alle): krever fortsatt 12 testere i 14 dager (har 2). Bytt `track` til `production` i eas.json når innvilget.
- **Tag-push-workflow** (`.eas/workflows/release-android.yml`): for at den skal trigge må branchen + workflow-fila pushes til GitHub, og `serviceAccountKeyPath` fjernes fra `eas.json` (serverne bruker EAS-lagret nøkkel, ikke lokal fil).
- 🔐 Vurder å rullere Play-tjenestekontonøkkelen i Google Cloud (den lå i en chat-logg under oppsettet).

## Pågående arbeid

- **Release-pipeline**: EAS auto-submit til alpha er live (se «Utgivelse» over). Workflow-finalisering + Play «Hva er nytt»-automatisering gjenstår om ønskelig.
- **Gym locations**: Migration 22 + `gymStore.ts` ferdig. UI-integrasjon gjenstår (gym-picker i logg, management i settings, utstyrsfiltrering)

## Backlog (prioritert)

Ideer diskutert og godkjent for fremtidig implementering:

### Høy prioritet
1. **Edit/delete sett → PR-rekalkulering** — Når bruker retter et sett, må PR-historikk oppdateres. Tillitsproblem.
2. **Gym locations UI** — Koble gymStore til logg-skjermen (gym-picker), settings (CRUD), og utstyrsfilter i exercise-picker.
3. **Workout resume-indikator** — Vis tydelig på hjem-skjermen når en økt er aktiv men appen ble lukket (`started_at` uten `ended_at`).

### Medium prioritet
4. **Utstyrsfilter i exercise-picker** — Vis kun øvelser som matcher tilgjengelig utstyr. Ekstra kraftig med gym locations.
5. **Rep-max estimator** — Vis estimert 3RM/5RM/10RM per øvelse (Epley/Brzycki). Lav innsats, høy opplevd verdi.
6. **Ukentlig ryggbelastnings-score** — Summer ukens volum vektet med backImpact-nivå. Nyttig for brukere med ryggproblemer.

### Lav prioritet / utforsk videre
7. **Fatigue-trend fra RPE-data** — Rullerende RPE-graf over tid per muskelgruppe. Overtrening-signal.
8. **Første-økt tooltips** — Kontekstuelle tips under første reelle logging (vis én gang).

## Ikke gjør

- **Treningsvideoer** — For stort innholdsprosjekt, bedre med eksterne lenker
- **Kardio-tracking** — Annet domene, ville utvannet styrkefokuset
- **Sosiale features / leaderboards** — Strider mot privacy-first-filosofien
- **Web-plattform** — DB er deaktivert, verdien er på mobil

## Sessjonslogger

Se `docs/sessions/` for full historikk over alle utviklingssesjoner.
