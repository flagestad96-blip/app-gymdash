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

## Pågående arbeid

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
